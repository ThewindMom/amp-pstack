import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { cliSeat } from './backend-routing'

import {
	type Access,
	type CliBackendId,
	type CliRunRequest,
	type Collected,
	type RunResult,
	classifyAttempt,
	cliRunStatus,
	collectCliRun,
	prepareCliRun,
	launchCliRun,
	pruneCliRuns,
	runCli,
	startCliRun,
	stopCliRun,
} from './cli-backends'

// One fake serves as both `grok` and `cursor-agent`. The prompt selects its behavior with FAKE:<name>=<behavior>.
const FAKE_CLI = String.raw`#!/usr/bin/env bun
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
const name = process.argv[1].split('/').pop()
const args = process.argv.slice(2)
const prompt = args.includes('--prompt-file') ? readFileSync(args[args.indexOf('--prompt-file') + 1], 'utf8') : await Bun.stdin.text()
const behavior = prompt.match(new RegExp('FAKE:' + name + '=([a-z]+)'))?.[1] ?? 'report'
const emit = (event) => console.log(JSON.stringify(event))
const finish = (text) => {
	emit({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
	emit({ type: 'result', subtype: 'success', is_error: false, result: text })
}
const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null)
if (behavior === 'ignored') writeFileSync('ignored.txt', 'mutation')
if (behavior === 'dependency') writeFileSync('node_modules/fixture.txt', 'mutation')
if (behavior === 'ignoredlimit') {
	writeFileSync('ignored.txt', 'mutation')
	console.error('Error: usage limit reached')
	process.exit(1)
}
if (behavior === 'unauth' && name === 'grok') {
	emit({ type: 'result', subtype: 'error_during_execution', is_error: true, errors: ['Not signed in. To authenticate without a browser, run:\n  grok login --device-code'] })
	console.error('Error: Not signed in. To authenticate without a browser, run:')
	process.exit(1)
}
if (behavior === 'unauth') {
	console.error("Error: Authentication required. Please run 'agent login' first, or set CURSOR_API_KEY environment variable.")
	process.exit(1)
}
if (behavior === 'limit') {
	console.error("Error: You've hit the rate limit for your plan.")
	process.exit(1)
}
if (behavior === 'fail') {
	console.error('Error: tool crashed while parsing src/main.ts')
	process.exit(1)
}
if (behavior === 'slow') await Bun.sleep(1500)
if (behavior === 'hang') {
	writeFileSync(prompt.match(/PIDFILE=(\S+)/)[1], String(process.pid))
	await Bun.sleep(60000)
}
if (behavior === 'write') {
	writeFileSync('tracked.txt', 'changed by child\n')
	rmSync('gone.txt')
	writeFileSync('bin.dat', new Uint8Array([0, 1, 2, 255, 0, 10]))
	finish('wrote files')
} else {
	finish(JSON.stringify({ cwd: process.cwd(), args, tracked: read('tracked.txt'), untracked: read('notes/untracked.txt'), ignored: read('ignored.txt') }))
}
`

const root = mkdtempSync(join(tmpdir(), 'pstack-cli-backends-'))
const stateDir = join(root, 'state')
const previousPath = process.env.PATH

beforeAll(() => {
	const bin = join(root, 'bin')
	mkdirSync(bin)
	for (const name of ['grok', 'cursor-agent', 'claude']) {
		writeFileSync(join(bin, name), FAKE_CLI)
		chmodSync(join(bin, name), 0o755)
	}
	process.env.PATH = `${bin}:${previousPath}`
})

afterAll(() => {
	process.env.PATH = previousPath
	rmSync(root, { recursive: true, force: true })
})

function sh(cwd: string, command: string): string {
	const run = Bun.spawnSync(['bash', '-c', command], { cwd, stdout: 'pipe', stderr: 'pipe' })
	if (run.exitCode !== 0) throw new Error(`${command}: ${run.stderr.toString()}`)
	return run.stdout.toString()
}

function makeCheckout(): string {
	const dir = mkdtempSync(join(root, 'checkout-'))
	writeFileSync(join(dir, 'tracked.txt'), 'committed\n')
	writeFileSync(join(dir, 'gone.txt'), 'to delete\n')
	writeFileSync(join(dir, '.gitignore'), 'ignored.txt\n')
	sh(dir, 'git init -q && git add -A && git -c commit.gpgsign=false -c user.name=t -c user.email=t@t commit -qm init')
	writeFileSync(join(dir, 'tracked.txt'), 'uncommitted edit\n')
	mkdirSync(join(dir, 'notes'))
	writeFileSync(join(dir, 'notes', 'untracked.txt'), 'untracked note\n')
	writeFileSync(join(dir, 'ignored.txt'), 'ignored secret\n')
	return dir
}

function request(checkout: string, access: Access, brief: string, backend: [CliBackendId] = ['grok-build']): CliRunRequest {
	return { role: 'feature', roleInstructions: 'Follow the brief.', brief, access, checkout, backend: backend[0] }
}

async function done(pending: Promise<Collected>): Promise<RunResult> {
	const collected = await pending
	if (collected.status !== 'done') throw new Error(`run ${collected.id} timed out`)
	return collected.result
}

function run(req: CliRunRequest): Promise<RunResult> {
	return done(runCli(req, { stateDir, launcher: 'local', timeoutMs: 20_000 }))
}

const summary = (result: RunResult) => result.attempts.map((attempt) => [attempt.backend, attempt.classification, attempt.evidence])

describe('cli backends', () => {
	test('an unstarted orb launch reconciles despite supervisor errors and rejects a delayed worker', () => {
		const bin = join(root, 'missing-supervisor')
		mkdirSync(bin)
		writeFileSync(join(bin, 'amp'), '#!/bin/sh\nexit 1\n')
		chmodSync(join(bin, 'amp'), 0o755)
		const path = process.env.PATH
		process.env.PATH = `${bin}:${path}`
		try {
			for (const expired of [false, true]) {
				const { id, runDir } = prepareCliRun(request(makeCheckout(), 'writer', 'FAKE:cursor-agent=write', ['cursor-cli']), { stateDir })
				writeFileSync(join(runDir, 'launch-intent.json'), JSON.stringify({ kind: 'orb' }))
				writeFileSync(join(runDir, 'launch.json'), JSON.stringify({ kind: 'orb', service: 'never-created' }))
				if (expired) {
					const record = JSON.parse(readFileSync(join(runDir, 'run.json'), 'utf8'))
					record.createdAt = new Date(Date.now() - 600_001).toISOString()
					writeFileSync(join(runDir, 'run.json'), JSON.stringify(record))
				}
				const status = expired ? cliRunStatus(id, { stateDir }) : stopCliRun(id, { stateDir })
				expect(status.state === 'done' && status.result.verdict).toBe(expired ? 'task-failure' : 'cancelled')
				const delayed = Bun.spawnSync([process.execPath, join(import.meta.dir, 'cli-backends.ts'), '__pstack_cli_worker', runDir])
				expect(delayed.exitCode).toBe(0)
				expect(existsSync(join(runDir, 'cursor-cli.log'))).toBe(false)
				expect(existsSync(join(runDir, 'worktree'))).toBe(false)
			}
		} finally { process.env.PATH = path }
	})

	test('CLI seat mapping preserves alternate Claude model and effort and rejects unsupported Cursor effort', async () => {
		const config = cliSeat('claude-code', 'anthropic/claude-opus-4-6', 'medium')
		const result = await run({ ...request(makeCheckout(), 'readonly', 'FAKE:claude=report', ['claude-code']), backends: { 'claude-code': config } })
		expect(JSON.parse(result.finalText).args).toEqual(['-p', '--model', 'claude-opus-4-6', '--verbose', '--output-format', 'stream-json', '--effort', 'medium', '--permission-mode', 'plan'])
		expect(() => cliSeat('cursor-cli', 'xai/grok-4.7', 'low')).toThrow('No verified cursor-cli mapping')
		expect(() => cliSeat('claude-code', 'anthropic/claude-opus-5-5', 'minimal')).toThrow('does not support effort minimal')
	})

	test('abandoned launch preparation terminates after ten minutes and cannot replay', () => {
		for (const intent of [false, true]) {
			const { id, runDir } = prepareCliRun(request(makeCheckout(), 'writer', 'FAKE:cursor-agent=write', ['cursor-cli']), { stateDir })
			if (intent) writeFileSync(join(runDir, 'launch-intent.json'), JSON.stringify({ kind: 'local' }))
			expect(cliRunStatus(id, { stateDir }).state).toBe('running')
			const record = JSON.parse(readFileSync(join(runDir, 'run.json'), 'utf8'))
			record.createdAt = new Date(Date.now() - 600_001).toISOString()
			writeFileSync(join(runDir, 'run.json'), JSON.stringify(record))
			const status = cliRunStatus(id, { stateDir })
			expect(status.state === 'done' && status.result.verdict).toBe('task-failure')
			expect(status.state === 'done' && status.result.finalText).toBe('Worker launch was not established within ten minutes.')
			launchCliRun(id, { stateDir, launcher: 'local' })
			expect(existsSync(join(runDir, 'launch.json'))).toBe(false)
			expect(existsSync(join(runDir, 'worktree'))).toBe(false)
		}
	})

	test('cancellation before launch prevents execution', () => {
		const { id, runDir } = prepareCliRun(request(makeCheckout(), 'writer', 'FAKE:cursor-agent=write', ['cursor-cli']), { stateDir })
		const stopped = stopCliRun(id, { stateDir })
		expect(stopped.state === 'done' && stopped.result.verdict).toBe('cancelled')
		launchCliRun(id, { stateDir, launcher: 'local' })
		expect(existsSync(join(runDir, 'launch.json'))).toBe(false)
		expect(existsSync(join(runDir, 'worktree'))).toBe(false)
	})

	test('read-only checks include ignored writes and dependencies without modifying the caller', async () => {
		const checkout = makeCheckout()
		mkdirSync(join(checkout, 'node_modules'))
		writeFileSync(join(checkout, 'node_modules', 'fixture.txt'), 'original')
		writeFileSync(join(checkout, '.gitignore'), 'ignored.txt\nnode_modules/\n')
		for (const behavior of ['ignored', 'dependency']) {
			const result = await run(request(checkout, 'readonly', `FAKE:cursor-agent=${behavior}`, ['cursor-cli']))
			expect(result.verdict).toBe('readonly-violation')
		}
		expect(readFileSync(join(checkout, 'node_modules', 'fixture.txt'), 'utf8')).toBe('original')
		expect(readFileSync(join(checkout, 'ignored.txt'), 'utf8')).toBe('ignored secret\n')
	}, 30_000)

	test('Claude uses plan for read-only runs and returns its final report', async () => {
		const result = await run(request(makeCheckout(), 'readonly', 'FAKE:claude=report', ['claude-code']))
		expect(result.verdict).toBe('ok')
		expect(JSON.parse(result.finalText).args).toEqual(['-p', '--model', 'opus', '--verbose', '--output-format', 'stream-json', '--permission-mode', 'plan'])
	}, 30_000)

	test('an ignored writer mutation prevents fallback even without assistant output', async () => {
		const result = await run(request(makeCheckout(), 'writer', 'FAKE:grok=ignoredlimit'))
		expect([result.verdict, result.backend]).toEqual(['task-failure', 'grok-build'])
		expect(result.attempts).toHaveLength(1)
	}, 30_000)

	test('a mid-task limit and a missing result never permit a replay', () => {
		const log = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Started work' }] } }) + '\nError: usage limit reached'
		expect(classifyAttempt(1, log).classification).toBe('task-failure')
		expect(classifyAttempt(0, '').classification).toBe('task-failure')
		expect(classifyAttempt(1, 'Model not available').classification).toBe('unavailable')
	})

	test('Claude synthetic startup limits are distinguished from limits after real work', () => {
		const limit = JSON.stringify({ type: 'assistant', error: 'rate_limit', message: { model: '<synthetic>', content: [{ type: 'text', text: "You've hit your session limit" }] } })
		expect(classifyAttempt(1, limit).classification).toBe('unavailable')
		const started = JSON.stringify({ type: 'assistant', message: { model: 'claude-opus-5-5', content: [{ type: 'tool_use', name: 'Read' }] } })
		expect(classifyAttempt(1, `${started}\n${limit}`).classification).toBe('task-failure')
	})

	test('classifies real CLI error output', () => {
		const grokUnauth = `${JSON.stringify({ type: 'result', is_error: true, errors: ['Not signed in. To authenticate without a browser, run:\n  grok login --device-code'] })}\nError: Not signed in.`
		expect(classifyAttempt(1, grokUnauth)).toEqual({ classification: 'unavailable', evidence: 'Not signed in. To authenticate without a browser, run:', finalText: '' })
		expect(classifyAttempt(1, '\x1b[33m⚠ Warning: The provided API key is invalid.\x1b[0m\n').evidence).toBe('⚠ Warning: The provided API key is invalid.')
		expect(classifyAttempt(1, 'Cannot use this model: grok-9. Available models: grok-4.7-high').classification).toBe('unavailable')
		expect(classifyAttempt(1, 'Error: ENOENT reading src/app.ts').classification).toBe('task-failure')
		expect(classifyAttempt(0, JSON.stringify({ type: 'result', is_error: true, result: 'PRO_USER_USAGE_LIMIT' })).classification).toBe('unavailable')
		expect(classifyAttempt(0, JSON.stringify({ type: 'result', is_error: false, result: 'Rate limits are handled in api.ts' }))).toEqual({ classification: 'ok', evidence: 'exit 0', finalText: 'Rate limits are handled in api.ts' })
	})

	test('authentication, limit and task failures stop on the selected backend', async () => {
		const checkout = makeCheckout()
		const [unauth, limit, failure] = await Promise.all([
			run(request(checkout, 'readonly', 'FAKE:grok=unauth')),
			run(request(checkout, 'readonly', 'FAKE:grok=limit')),
			run(request(checkout, 'readonly', 'FAKE:grok=fail')),
		])
		expect([unauth.verdict, unauth.backend, limit.verdict]).toEqual(['task-failure', 'grok-build', 'task-failure'])
		expect(summary(unauth)).toEqual([
			['grok-build', 'unavailable', 'Not signed in. To authenticate without a browser, run:'],
		])
		expect(summary(limit)).toEqual([
			['grok-build', 'unavailable', "Error: You've hit the rate limit for your plan."],
		])
		expect([failure.verdict, failure.backend]).toEqual(['task-failure', 'grok-build'])
		expect(summary(failure)).toEqual([['grok-build', 'task-failure', 'Error: tool crashed while parsing src/main.ts']])
	}, 30_000)

	test('a missing binary is terminal and does not propose an automatic successor', async () => {
		const checkout = makeCheckout()
		const missingGrok = { 'grok-build': { command: 'grok-missing-binary' } }
		const result = await run({ ...request(checkout, 'readonly', 'FAKE:cursor-agent=report'), backends: missingGrok })
		expect(result.verdict).toBe('task-failure')
		expect(result).not.toHaveProperty('next')
		expect(summary(result)).toEqual([
			['grok-build', 'unavailable', 'command not found: grok-missing-binary'],
		])
	}, 30_000)

	test('runs read-only in a removed worktree holding the caller edit and untracked file', async () => {
		const checkout = makeCheckout()
		const [cursor, grok] = await Promise.all([
			run(request(checkout, 'readonly', 'FAKE:cursor-agent=report', ['cursor-cli'])),
			run(request(checkout, 'readonly', 'FAKE:grok=report', ['grok-build'])),
		])
		const seen = JSON.parse(cursor.finalText)
		expect([seen.tracked, seen.untracked, seen.ignored]).toEqual(['uncommitted edit\n', 'untracked note\n', null])
		expect(seen.cwd.startsWith(stateDir)).toBe(true)
		expect(existsSync(seen.cwd)).toBe(false)
		expect(seen.args).toContain('ask')
		expect(seen.args).not.toContain('--force')
		expect(JSON.parse(grok.finalText).args).toContain('dontAsk')
		expect([cursor.verdict, cursor.patchPath, grok.verdict]).toEqual(['ok', null, 'ok'])
		expect(sh(checkout, 'git worktree list --porcelain').match(/^worktree /gm)).toHaveLength(1)
	}, 30_000)

	test('reports a read-only run that writes as a violation and leaves the caller untouched', async () => {
		const checkout = makeCheckout()
		const before = sh(checkout, 'git status --porcelain --ignored')
		const result = await run(request(checkout, 'readonly', 'FAKE:cursor-agent=write', ['cursor-cli']))
		expect(result.verdict).toBe('readonly-violation')
		expect(result.patchPath?.endsWith('violation.diff')).toBe(true)
		expect(readFileSync(result.patchPath!, 'utf8')).toContain('deleted file mode 100644')
		expect(sh(checkout, 'git status --porcelain --ignored')).toBe(before)
		expect(readFileSync(join(checkout, 'tracked.txt'), 'utf8')).toBe('uncommitted edit\n')
	}, 30_000)

	test('writer patch applies to the snapshot with a binary file and a deletion', async () => {
		const checkout = makeCheckout()
		const result = await run(request(checkout, 'writer', 'FAKE:cursor-agent=write', ['cursor-cli']))
		expect([result.verdict, result.patchPath?.endsWith('patch.diff')]).toEqual(['ok', true])
		expect(result.diffstat).toContain('3 files changed')
		expect(existsSync(join(checkout, 'bin.dat'))).toBe(false)
		const copy = join(root, `apply-${crypto.randomUUID()}`)
		cpSync(checkout, copy, { recursive: true })
		sh(copy, `git apply '${result.patchPath}'`)
		expect(readFileSync(join(copy, 'tracked.txt'), 'utf8')).toBe('changed by child\n')
		expect(existsSync(join(copy, 'gone.txt'))).toBe(false)
		expect([...readFileSync(join(copy, 'bin.dat'))]).toEqual([0, 1, 2, 255, 0, 10])
		expect(readFileSync(join(copy, 'notes', 'untracked.txt'), 'utf8')).toBe('untracked note\n')
	}, 30_000)

	test('a fresh process collects a background run', async () => {
		const checkout = makeCheckout()
		const { id } = startCliRun(request(checkout, 'readonly', 'FAKE:cursor-agent=slow', ['cursor-cli']), { stateDir, launcher: 'local' })
		expect(cliRunStatus(id, { stateDir }).state).toBe('running')
		const script = `import { collectCliRun } from ${JSON.stringify(join(import.meta.dir, 'cli-backends.ts'))}
console.log(JSON.stringify(await collectCliRun(${JSON.stringify(id)}, { stateDir: ${JSON.stringify(stateDir)}, timeoutMs: 20000 })))`
		const fresh = Bun.spawnSync([process.execPath, '-e', script], { stdout: 'pipe', stderr: 'pipe' })
		const collected = JSON.parse(fresh.stdout.toString()) as Collected
		expect(collected.status).toBe('done')
		if (collected.status === 'done') expect([collected.result.id, collected.result.verdict, JSON.parse(collected.result.finalText).tracked]).toEqual([id, 'ok', 'uncommitted edit\n'])
	}, 30_000)

	test('timeout preserves a collectable run and retention uses completion time', async () => {
		const { id, runDir } = startCliRun(request(makeCheckout(), 'readonly', 'FAKE:cursor-agent=slow', ['cursor-cli']), { stateDir, launcher: 'local' })
		expect(await collectCliRun(id, { stateDir, timeoutMs: 0 })).toEqual({ id, status: 'timeout' })
		const result = await done(collectCliRun(id, { stateDir, timeoutMs: 20_000 }))
		expect(result.verdict).toBe('ok')
		const resultPath = join(runDir, 'result.json')
		const now = Date.now()
		utimesSync(resultPath, new Date(now - 6 * 86400_000), new Date(now - 6 * 86400_000))
		pruneCliRuns({ stateDir }, now)
		expect(existsSync(runDir)).toBe(true)
		utimesSync(resultPath, new Date(now - 8 * 86400_000), new Date(now - 8 * 86400_000))
		pruneCliRuns({ stateDir }, now)
		expect(existsSync(runDir)).toBe(false)
	}, 30_000)

	test('stop kills the running CLI and marks the run cancelled', async () => {
		const checkout = makeCheckout()
		const pidFile = join(root, `hang-${crypto.randomUUID()}.pid`)
		const { id, runDir } = startCliRun(request(checkout, 'writer', `FAKE:cursor-agent=hang PIDFILE=${pidFile}`, ['cursor-cli']), { stateDir, launcher: 'local' })
		for (let tries = 0; !existsSync(pidFile) && tries < 100; tries++) await Bun.sleep(100)
		const pid = Number(readFileSync(pidFile, 'utf8'))
		expect(() => process.kill(pid, 0)).not.toThrow()
		const stopped = stopCliRun(id, { stateDir })
		expect(stopped.state === 'done' && stopped.result.verdict).toBe('cancelled')
		let alive = true
		for (let tries = 0; alive && tries < 30; tries++) {
			await Bun.sleep(100)
			try {
				process.kill(pid, 0)
			} catch {
				alive = false
			}
		}
		expect(alive).toBe(false)
		expect(existsSync(join(runDir, 'worktree'))).toBe(false)
	}, 30_000)
})
