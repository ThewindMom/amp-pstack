import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { type CliRunRequest, type Collected, cliRunStatus, collectCliRun, detectLauncher, runCli, startCliRun, stopCliRun } from '../cli-backends'

const checkout = join(import.meta.dir, '..')
const timeoutMs = 20 * 60_000
const roleInstructions = 'Follow the brief exactly. Cite file paths and line numbers for every claim.'

function readonly(brief: string, backend: [NonNullable<CliRunRequest['backend']>] = ['cursor-cli']): CliRunRequest {
	return { role: 'how-explorer', roleInstructions, brief, access: 'readonly', checkout, backend: backend[0] }
}

function show(label: string, collected: Collected): void {
	if (collected.status === 'timeout') return console.log(JSON.stringify({ label, ...collected }))
	const { result } = collected
	console.log(JSON.stringify({
		label,
		id: result.id,
		verdict: result.verdict,
		backend: result.backend,
		attempts: result.attempts.map(({ backend, classification, evidence, exitCode }) => ({ backend, classification, evidence, exitCode })),
		patchPath: result.patchPath,
		diffstat: result.diffstat,
		transcriptPath: result.transcriptPath,
		finalText: result.finalText.slice(0, 2000),
	}, null, 2))
}

function git(...args: string[]): string {
	const run = Bun.spawnSync(['git', '-C', checkout, ...args], { stdout: 'pipe', stderr: 'pipe' })
	return `${run.exitCode} ${run.stdout.toString().trim()} ${run.stderr.toString().trim()}`.trim()
}

const [scenario, id] = process.argv.slice(2)
console.log(`launcher: ${detectLauncher()} scenario: ${scenario}`)
const started = Date.now()

if (scenario === 'explore') {
	show('explore', await runCli(readonly('In index.ts, what are the values of DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, and MAX_TIMEOUT_MS, and on which line is DEFAULT_STATE_DIRECTORY defined?'), { timeoutMs }))
} else if (scenario === 'writer') {
	const collected = await runCli({
		role: 'feature',
		roleInstructions,
		brief: 'Create the file scratch/smoke.txt containing exactly one line: pstack cli smoke ok. Change nothing else.',
		access: 'writer',
		checkout,
	}, { timeoutMs })
	show('writer', collected)
	if (collected.status === 'done' && collected.result.patchPath) {
		const clean = join(tmpdir(), `pstack-smoke-clean-${Date.now()}`)
		console.log('clean copy at HEAD:', git('worktree', 'add', '--detach', clean, 'HEAD'))
		console.log('git apply --check:', Bun.spawnSync(['git', '-C', clean, 'apply', '--check', '--verbose', collected.result.patchPath], { stderr: 'pipe' }).stderr.toString().trim())
		Bun.spawnSync(['git', '-C', clean, 'apply', collected.result.patchPath])
		console.log('scratch/smoke.txt after apply:', JSON.stringify(await Bun.file(join(clean, 'scratch', 'smoke.txt')).text()))
		console.log('remove clean copy:', git('worktree', 'remove', '--force', clean))
	}
} else if (scenario === 'readonly-write') {
	show('readonly-write', await runCli(readonly('Create a file named SHOULD_NOT_EXIST.txt at the repository root containing the word hello.', ['cursor-cli']), { timeoutMs }))
} else if (scenario === 'claude') {
	show('claude', await runCli(readonly('Read package.json and quote its name and test script. Do not change files.', ['claude-code']), { timeoutMs }))
} else if (scenario === 'mixed') {
	const results = await Promise.all((['cursor-cli', 'claude-code'] as const).map((backend) =>
		runCli(readonly('Read package.json and quote its name and test script. Do not change files.', [backend]), { timeoutMs })))
	results.forEach((result, index) => show(`mixed-${index + 1}`, result))
} else if (scenario === 'background-start') {
	const run = startCliRun(readonly('List the exported functions of webhook-runtime.ts with line numbers.', ['cursor-cli']))
	console.log(JSON.stringify({ ...run, status: cliRunStatus(run.id).state }))
	console.log(Bun.spawnSync(['amp', 'orb', 'service', 'list']).stdout.toString().trim())
} else if (scenario === 'background-collect' && id) {
	show('background-collect', await collectCliRun(id, { timeoutMs }))
} else if (scenario === 'stop') {
	const run = startCliRun(readonly('Explain every exported function in index.ts in detail.', ['cursor-cli']))
	await Bun.sleep(8000)
	const agents = () => Bun.spawnSync(['pgrep', '-c', '-f', 'cursor-agent']).stdout.toString().trim()
	console.log(JSON.stringify({ id: run.id, before: cliRunStatus(run.id).state, cursorAgentProcesses: agents() }))
	const stopped = stopCliRun(run.id)
	await Bun.sleep(1000)
	console.log(JSON.stringify({ after: stopped.state === 'done' ? stopped.result.verdict : stopped.state, cursorAgentProcesses: agents() }))
	console.log(Bun.spawnSync(['amp', 'orb', 'service', 'list']).stdout.toString().trim())
} else if (scenario === 'fanout') {
	const briefs = [
		'Quote the "test" script from package.json.',
		'List the exported function names in runtime-store.ts.',
		'What does preload.ts do? Answer in two sentences.',
	]
	const results = await Promise.all(briefs.map((brief) => runCli(readonly(brief, ['cursor-cli']), { timeoutMs })))
	results.forEach((collected, index) => show(`fanout-${index + 1}`, collected))
} else {
	throw new Error('usage: bun scripts/cli-backends-smoke.ts explore|writer|readonly-write|claude|mixed|background-start|background-collect <id>|stop|fanout')
}
console.log(`wall ms: ${Date.now() - started}`)
