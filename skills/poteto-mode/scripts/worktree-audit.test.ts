import { describe, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const script = join(import.meta.dir, 'worktree-audit.sh')

function runAudit(searchJson: string, searchExit = 0) {
	const dir = mkdtempSync(join(tmpdir(), 'pstack-audit-'))
	const stub = join(dir, 'amp-search')
	const git = (...args: string[]) => {
		const result = Bun.spawnSync(['git', '-C', dir, ...args], { stderr: 'pipe' })
		if (result.exitCode !== 0) throw new Error(result.stderr.toString())
	}
	git('init', '-q')
	git('-c', 'commit.gpgsign=false', '-c', 'user.name=test', '-c', 'user.email=test@example.test', 'commit', '--allow-empty', '-qm', 'fixture')
	git('update-ref', 'refs/remotes/origin/main', 'HEAD')
	git('worktree', 'add', '--detach', join(dir, 'child'), 'HEAD')
	writeFileSync(
		stub,
		`#!/usr/bin/env bash
printf '%s\\n' ${JSON.stringify(searchJson)}
exit ${searchExit}
`,
	)
	chmodSync(stub, 0o755)
	const result = Bun.spawnSync(['bash', script], {
		cwd: dir,
		env: { ...process.env, AMP_THREADS_SEARCH: stub },
	})
	rmSync(dir, { recursive: true, force: true })
	return {
		stdout: result.stdout.toString(),
		stderr: result.stderr.toString(),
		exitCode: result.exitCode,
	}
}

describe('worktree-audit', () => {
	test('emits LAST_THREAD and treats a recent Amp thread as hold-recent-thread', () => {
		const recent = new Date().toISOString()
		const { stdout, exitCode } = runAudit(
			JSON.stringify([{ id: 'T-hold', updatedAt: recent }]),
		)
		expect(exitCode).toBe(0)
		expect(stdout).toContain('LAST_THREAD')
		expect(stdout).toContain('BUCKET')
		expect(stdout.trim().split('\n')).toHaveLength(2)
		expect(stdout.split('\n')[1]?.split('\t').slice(6, 8)).toEqual(['T-hold', 'hold-recent-thread'])
	})

	test('old thread timestamps leave a clean merged worktree safe', () => {
		const { stdout } = runAudit(JSON.stringify([{ id: 'T-old', updatedAt: '2020-01-02T03:04:05.123Z' }]))
		expect(stdout.split('\n')[1]?.split('\t').slice(6, 8)).toEqual(['T-old', 'safe'])
	})

	test('headers stay stable when there are no matching threads', () => {
		const { stdout, exitCode } = runAudit('[]')
		expect(exitCode).toBe(0)
		expect(stdout.split('\n')[0]).toBe(
			'SIZE\tAGE\tMERGED\tDIRTY\tREMOTE\tPR\tLAST_THREAD\tBUCKET\tWORKTREE',
		)
	})

	test('failed or malformed searches never mark a merged worktree safe', () => {
		for (const [response, code] of [['[]', 1], ['{}', 0], ['not json', 0]] as const) {
			const { stdout } = runAudit(response, code)
			expect(stdout.split('\n')[1]?.split('\t').slice(6, 8)).toEqual(['unavailable', 'verify-thread-then-safe'])
		}
	})

	test('prints usage for --help without treating it as a repo path', () => {
		const result = Bun.spawnSync(['bash', script, '--help'])
		expect(result.exitCode).toBe(0)
		expect(result.stdout.toString()).toContain('Usage: worktree-audit.sh [repo-path]')
		expect(result.stdout.toString()).toContain('Never deletes anything')
	})
})
