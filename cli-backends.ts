import { spawn } from 'node:child_process'
import { closeSync, cpSync, existsSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readlinkSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export type CliBackendId = 'grok-build' | 'cursor-cli' | 'claude-code'
export type Access = 'readonly' | 'writer'
export type Classification = 'ok' | 'unavailable' | 'task-failure'
export type Verdict = Classification | 'readonly-violation' | 'cancelled'
export type Launcher = 'orb' | 'local'

export type BackendConfig = { command: string; model: string; effort?: string }

export type Attempt = {
	backend: CliBackendId
	classification: Classification
	evidence: string
	exitCode: number | null
	logPath: string | null
}

export type RunResult = {
	id: string
	verdict: Verdict
	backend: CliBackendId | null
	attempts: Attempt[]
	finalText: string
	transcriptPath: string | null
	patchPath: string | null
	diffstat: string
}

export type RunStatus = { id: string; state: 'running' } | { id: string; state: 'done'; result: RunResult }
export type Collected = { status: 'done'; id: string; result: RunResult } | { status: 'timeout'; id: string }

export type CliRunRequest = {
	role: string
	roleInstructions: string
	brief: string
	access: Access
	checkout: string
	backend?: CliBackendId
	backends?: Partial<Record<CliBackendId, Partial<BackendConfig>>>
	skillsDir?: string
}

export type CliRunOptions = { stateDir?: string; launcher?: Launcher }

export const DEFAULT_BACKENDS: Readonly<Record<CliBackendId, BackendConfig>> = {
	'claude-code': { command: 'claude', model: 'opus' },
	// Grok Build 1.0.41 has no offline catalog entry for Grok 4.7, so this id is unverified.
	'grok-build': { command: 'grok', model: 'grok-4.7', effort: 'xhigh' },
	// Cursor encodes effort in the model id. The Grok Build installer replaces ~/.local/bin/agent.
	'cursor-cli': { command: 'cursor-agent', model: 'grok-4.7-xhigh-fast' },
}
export const DEFAULT_STATE_DIR = join(homedir(), '.config', 'amp', 'pstack', 'cli-runs')
export const SKILLS_DIR = join(import.meta.dir, 'skills')

// Observed from grok 1.0.41 and cursor-agent 2026.09.23 without or with bad credentials,
// plus the limit and plan error strings embedded in both binaries.
export const UNAVAILABLE_PATTERNS: readonly RegExp[] = [
	/not signed in|authentication required|api key is invalid|not logged in|AUTH_TOKEN_(NOT_FOUND|EXPIRED)|unauthorized|status 401|sign-in is not available/i,
	/usage[ _]limit|session limit|usage balance exhausted|free-usage-exhausted|out of credits|spending (limit|cap)|payment required/i,
	/rate[ _]limit|too many requests|resource_exhausted|\b429\b|quota/i,
	/requires a grok subscription|subscription (is )?(inactive|expired|required)/i,
	/cannot use this model|is not in your available models|unknown model|model (?:is )?not available/i,
]

type BackendInvocation = { args: string[]; stdinPrompt: boolean }

const BACKEND_ARGS: Record<CliBackendId, (config: BackendConfig, access: Access, promptPath: string) => BackendInvocation> = {
	'claude-code': (config, access) => ({
		args: ['-p', '--model', config.model, '--verbose', '--output-format', 'stream-json',
			...(config.effort ? ['--effort', config.effort] : []),
			'--permission-mode', access === 'readonly' ? 'plan' : 'bypassPermissions'],
		stdinPrompt: true,
	}),
	'grok-build': (config, access, promptPath) => ({
		args: [
			'--prompt-file', promptPath,
			'-m', config.model,
			...(config.effort ? ['--reasoning-effort', config.effort] : []),
			'--output-format', 'streaming-messages-json',
			...(access === 'readonly' ? ['--permission-mode', 'dontAsk', '--deny', 'Edit', '--deny', 'Write'] : ['--always-approve']),
		],
		stdinPrompt: false,
	}),
	'cursor-cli': (config, access) => ({
		args: [
			'-p', '--trust', '--sandbox', 'disabled',
			'--model', config.model,
			'--output-format', 'stream-json',
			...(access === 'readonly' ? ['--mode', 'ask'] : ['--force']),
		],
		stdinPrompt: true,
	}),
}

export function buildPrompt(request: Pick<CliRunRequest, 'role' | 'roleInstructions' | 'brief' | 'access' | 'skillsDir'>): string {
	const skillsDir = request.skillsDir ?? SKILLS_DIR
	return [
		`You are the pstack ${request.role} delegate. You run headless in an isolated git worktree of the caller's checkout, without Amp tools.`,
		`Role instructions:\n${request.roleInstructions}`,
		`pstack skills are on disk under ${skillsDir}. When the role or the brief names a skill, read ${skillsDir}/<name>/SKILL.md and follow it.`,
		request.access === 'readonly'
			? 'This run is read-only. Do not create, edit, or delete any file. pstack discards any change and reports it as a violation.'
			: 'Edit files in this worktree to do the task. Do not commit, push, or create branches. pstack hands your changes to the caller as a patch for review.',
		`Task brief:\n${request.brief}`,
		'You have no Amp tools and must not start nested agents or wait for one. Perform this assignment yourself. Return your report as final text; the plugin delivers it. Writers install dependencies only as directed by the brief.',
		'Contract: do the task now. Do not ask questions; make reasonable assumptions and state them. End with a final report that lists outcome, evidence (commands, paths, decisive output), files changed, and blockers.',
	].join('\n\n')
}

type StreamEvent = {
	type?: unknown
	result?: unknown
	is_error?: unknown
	error?: unknown
	errors?: unknown
	message?: { model?: unknown; content?: { type?: unknown; text?: unknown }[] }
}

const ANSI = /\x1b\[[0-9;]*m/g

export function classifyAttempt(exitCode: number | null, log: string): { classification: Classification; evidence: string; finalText: string } {
	let result: StreamEvent | undefined
	const texts: string[] = []
	const plain: string[] = []
	let started = false
	for (const line of log.split('\n')) {
		if (!line.trim()) continue
		let event: StreamEvent | null
		try {
			event = JSON.parse(line) as StreamEvent | null
		} catch {
			plain.push(line)
			continue
		}
		if (event?.type === 'result') result = event
		if (event?.type === 'assistant') {
			if (!(event.error === 'rate_limit' && event.message?.model === '<synthetic>')) started = true
			for (const block of event.message?.content ?? []) if (block.type === 'text' && typeof block.text === 'string') texts.push(block.text)
		}
	}
	const finalText = typeof result?.result === 'string' ? result.result : texts.join('\n')
	if (exitCode === 0 && result && result.is_error !== true) return { classification: 'ok', evidence: 'exit 0', finalText }
	const errors = Array.isArray(result?.errors) ? result.errors.map(String) : []
	const lines = [...errors, ...plain, finalText]
		.flatMap((text) => text.split('\n'))
		.map((line) => line.replace(ANSI, '').trim())
		.filter(Boolean)
	const hit = lines.find((line) => UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(line)))
	if (hit && !started) return { classification: 'unavailable', evidence: hit.slice(0, 500), finalText }
	return { classification: 'task-failure', evidence: (lines[0] ?? `exit ${exitCode}`).slice(0, 500), finalText }
}

type RunRecord = {
	id: string
	role: string
	access: Access
	checkout: string
	worktree: string
	snapshot: string
	backend: CliBackendId
	backends: Record<CliBackendId, BackendConfig>
	createdAt: string
	linkedModules?: boolean
	readonlyHash?: string
}

type LaunchRecord = { kind: 'orb'; service: string } | { kind: 'local'; pid: number }

const COMMIT_FLAGS = ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', '-c', 'user.name=pstack', '-c', 'user.email=pstack@localhost']

function git(cwd: string, args: string[]): Buffer {
	const run = Bun.spawnSync(['git', '-C', cwd, ...args], { stdout: 'pipe', stderr: 'pipe' })
	if (run.exitCode !== 0) throw new Error(`git ${args.join(' ')} failed: ${run.stderr.toString().trim()}`)
	return run.stdout
}

function gitText(cwd: string, args: string[]): string {
	return git(cwd, args).toString().trim()
}

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, 'utf8')) as T
}

function writeJson(path: string, value: unknown): void {
	writeFileSync(`${path}.tmp`, `${JSON.stringify(value, null, '\t')}\n`)
	renameSync(`${path}.tmp`, path)
}

function publishResult(path: string, result: RunResult): void {
	const temporary = `${path}.${crypto.randomUUID()}`
	writeFileSync(temporary, JSON.stringify(result))
	try { linkSync(temporary, path) } catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
	} finally { rmSync(temporary, { force: true }) }
}

function treeHash(root: string): string {
	const hash = new Bun.CryptoHasher('sha256')
	const visit = (directory: string) => {
		for (const name of readdirSync(directory).sort()) {
			if (name === '.git') continue
			const path = join(directory, name)
			const info = lstatSync(path)
			hash.update(`${path.slice(root.length)}\0${info.mode}\0`)
			if (info.isSymbolicLink()) hash.update(readlinkSync(path))
			else if (info.isDirectory()) visit(path)
			else if (info.isFile()) hash.update(readFileSync(path))
		}
	}
	if (existsSync(root)) visit(root)
	return hash.digest('hex')
}

// The snapshot commit holds the caller's tracked edits and untracked non-ignored files,
// so the child sees the caller's current state and every patch is relative to it.
function createSnapshot(checkout: string, worktree: string): { checkout: string; snapshot: string } {
	const root = gitText(checkout, ['rev-parse', '--show-toplevel'])
	const base = gitText(root, ['stash', 'create']) || gitText(root, ['rev-parse', 'HEAD'])
	git(root, ['worktree', 'add', '--detach', worktree, base])
	for (const file of git(root, ['ls-files', '--others', '--exclude-standard', '-z']).toString().split('\0')) {
		if (!file || file.endsWith('/')) continue
		mkdirSync(dirname(join(worktree, file)), { recursive: true })
		cpSync(join(root, file), join(worktree, file), { verbatimSymlinks: true })
	}
	git(worktree, ['add', '-A'])
	git(worktree, [...COMMIT_FLAGS, 'commit', '-q', '--allow-empty', '--no-verify', '-m', 'pstack cli snapshot'])
	return { checkout: root, snapshot: gitText(worktree, ['rev-parse', 'HEAD']) }
}

function removeWorktree(record: RunRecord): void {
	if (existsSync(record.worktree)) Bun.spawnSync(['git', '-C', record.checkout, 'worktree', 'remove', '--force', record.worktree])
	rmSync(record.worktree, { recursive: true, force: true })
	Bun.spawnSync(['git', '-C', record.checkout, 'worktree', 'prune'])
}

async function runAttempt(record: RunRecord, runDir: string, backend: CliBackendId): Promise<{ attempt: Attempt; finalText: string }> {
	const config = record.backends[backend]
	if (!Bun.which(config.command)) {
		return { attempt: { backend, classification: 'unavailable', evidence: `command not found: ${config.command}`, exitCode: null, logPath: null }, finalText: '' }
	}
	const promptPath = join(runDir, 'prompt.md')
	const logPath = join(runDir, `${backend}.log`)
	const { args, stdinPrompt } = BACKEND_ARGS[backend](config, record.access, promptPath)
	const log = openSync(logPath, 'w')
	const child = Bun.spawn([config.command, ...args], {
		cwd: record.worktree,
		stdin: stdinPrompt ? Bun.file(promptPath) : 'ignore',
		stdout: log,
		stderr: log,
	})
	const exitCode = await child.exited
	closeSync(log)
	const { classification, evidence, finalText } = classifyAttempt(exitCode, readFileSync(logPath, 'utf8'))
	return { attempt: { backend, classification, evidence, exitCode, logPath }, finalText }
}

function unavailable(id: string, attempts: Attempt[]): RunResult {
	return { id, verdict: 'unavailable', backend: null, attempts, finalText: '', transcriptPath: null, patchPath: null, diffstat: '' }
}

async function execute(record: RunRecord, runDir: string): Promise<RunResult> {
	const backend = record.backend
	const { attempt, finalText } = await runAttempt(record, runDir, backend)
	const after = treeHash(record.worktree) + treeHash(join(runDir, 'dependencies'))
	const readonlyChanged = record.access === 'readonly' && record.readonlyHash !== after
	if (record.linkedModules) rmSync(join(record.worktree, 'node_modules'), { force: true })
	git(record.worktree, ['add', '-A'])
	const patch = git(record.worktree, ['diff', '--binary', '--cached', record.snapshot])
	const diffstat = gitText(record.worktree, ['diff', '--cached', '--stat', record.snapshot])
	const violation = readonlyChanged || (record.access === 'readonly' && patch.length > 0)
	const patchPath = violation ? join(runDir, 'violation.diff') : record.access === 'writer' ? join(runDir, 'patch.diff') : null
	if (patchPath) writeFileSync(patchPath, patch)
	const verdict = violation ? 'readonly-violation' : attempt.classification === 'unavailable' ? 'task-failure' : attempt.classification
	return { id: record.id, verdict, backend, attempts: [attempt], finalText, transcriptPath: attempt.logPath, patchPath, diffstat }
}

async function runWorker(runDir: string): Promise<void> {
	const record = readJson<RunRecord>(join(runDir, 'run.json'))
	const intent = readJson<{ kind: Launcher }>(join(runDir, 'launch-intent.json'))
	if (intent.kind === 'local') writeJson(join(runDir, 'launch.json'), { kind: 'local', pid: process.pid } satisfies LaunchRecord)
	const resultPath = join(runDir, 'result.json')
	if (existsSync(join(runDir, 'cancelled'))) return
	if (!existsSync(resultPath)) {
		try { closeSync(openSync(join(runDir, 'started'), 'wx')) } catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
			// The supervisor stops the service after this exit. Status reconciliation
			// reports the interruption only after the service is confirmed stopped.
			return
		}
		const result = await execute(record, runDir).catch((error: unknown): RunResult => ({
			...unavailable(record.id, []),
			verdict: 'task-failure',
			finalText: `pstack cli worker error: ${error instanceof Error ? error.message : String(error)}`,
		}))
		removeWorktree(record)
		rmSync(join(runDir, 'dependencies'), { recursive: true, force: true })
		publishResult(resultPath, result)
	}
}

const WORKER_FLAG = '__pstack_cli_worker'
const RUN_ID = /^cli-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`
}

function runDirFor(id: string, options: CliRunOptions): string {
	if (!RUN_ID.test(id)) throw new Error(`invalid cli run id: ${id}`)
	return join(options.stateDir ?? DEFAULT_STATE_DIR, id)
}

// Orb services outlive Amp CLI restarts; processes started from the Amp CLI do not.
export function detectLauncher(env: Record<string, string | undefined> = process.env): Launcher {
	return env.AMP_ORB === '1' && Bun.which('amp', { PATH: env.PATH ?? '' }) ? 'orb' : 'local'
}

function launch(kind: Launcher, id: string, runDir: string): LaunchRecord {
	const worker = [process.execPath, import.meta.path, WORKER_FLAG, runDir]
	if (kind === 'orb') {
		// Orb service names are limited to 32 characters.
		const service = `pstack-${id.slice(4).replaceAll('-', '').slice(0, 25)}`
		writeJson(join(runDir, 'launch.json'), { kind, service })
		// A service restarts its command after any exit, so the worker stops its own service.
		const command = `BUN_BE_BUN=1 ${worker.map(shellQuote).join(' ')} >>worker.log 2>&1; amp orb service stop ${shellQuote(service)}`
		const started = Bun.spawnSync(['amp', 'orb', 'service', 'start', service, '--cwd', runDir, '--command', command], { stdout: 'pipe', stderr: 'pipe' })
		if (started.exitCode !== 0) throw new Error(`amp orb service start failed: ${started.stderr.toString().trim()}`)
		return { kind, service }
	}
	const log = openSync(join(runDir, 'worker.log'), 'a')
	const child = spawn(worker[0]!, worker.slice(1), { detached: true, stdio: ['ignore', log, log], env: { ...process.env, BUN_BE_BUN: '1' } })
	closeSync(log)
	if (child.pid === undefined) throw new Error('cli worker failed to spawn')
	child.unref()
	return { kind, pid: child.pid }
}

export function prepareCliRun(request: CliRunRequest, options: CliRunOptions = {}): { id: string; runDir: string } {
	pruneCliRuns(options)
	const id = `cli-${crypto.randomUUID()}`
	const runDir = runDirFor(id, options)
	mkdirSync(runDir, { recursive: true })
	try {
		writeFileSync(join(runDir, 'prompt.md'), buildPrompt(request))
		const worktree = join(runDir, 'worktree')
		const { checkout, snapshot } = createSnapshot(request.checkout, worktree)
		const linkedModules = request.access === 'readonly' && existsSync(join(checkout, 'node_modules')) && !existsSync(join(worktree, 'node_modules'))
		if (linkedModules) {
			cpSync(join(checkout, 'node_modules'), join(runDir, 'dependencies'), { recursive: true, dereference: true })
			symlinkSync(join(runDir, 'dependencies'), join(worktree, 'node_modules'))
		}
		const record: RunRecord = {
			id,
			linkedModules,
			readonlyHash: request.access === 'readonly' ? treeHash(worktree) + treeHash(join(runDir, 'dependencies')) : undefined,
			role: request.role,
			access: request.access,
			checkout,
			worktree,
			snapshot,
			backend: request.backend ?? 'cursor-cli',
			backends: {
				'claude-code': { ...DEFAULT_BACKENDS['claude-code'], ...request.backends?.['claude-code'] },
				'grok-build': { ...DEFAULT_BACKENDS['grok-build'], ...request.backends?.['grok-build'] },
				'cursor-cli': { ...DEFAULT_BACKENDS['cursor-cli'], ...request.backends?.['cursor-cli'] },
			},
			createdAt: new Date().toISOString(),
		}
		writeJson(join(runDir, 'run.json'), record)
	} catch (error) {
		rmSync(runDir, { recursive: true, force: true })
		Bun.spawnSync(['git', '-C', request.checkout, 'worktree', 'prune'])
		throw error
	}
	return { id, runDir }
}

export function launchCliRun(id: string, options: CliRunOptions = {}): void {
	const runDir = runDirFor(id, options)
	if (existsSync(join(runDir, 'result.json'))) return
	const kind = options.launcher ?? detectLauncher()
	try { writeFileSync(join(runDir, 'launch-intent.json'), JSON.stringify({ kind }), { flag: 'wx' }) } catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') return
		throw error
	}
	launch(kind, id, runDir)
}

export function startCliRun(request: CliRunRequest, options: CliRunOptions = {}): { id: string; runDir: string } {
	const prepared = prepareCliRun(request, options)
	launchCliRun(prepared.id, options)
	return prepared
}

function stopLocalGroup(pid: number): boolean {
	try { process.kill(-pid, 'SIGKILL') } catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true
		throw error
	}
	for (let attempt = 0; attempt < 100; attempt++) {
		if (process.platform === 'linux') {
			const live = readdirSync('/proc').filter((entry) => /^\d+$/.test(entry)).some((entry) => {
				try {
					const stat = readFileSync(`/proc/${entry}/stat`, 'utf8')
					const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
					return Number(fields[2]) === pid && fields[0] !== 'Z'
				} catch (error) {
					return !['ENOENT', 'ESRCH'].includes((error as NodeJS.ErrnoException).code ?? '')
				}
			})
			if (!live) return true
		}
		try { process.kill(-pid, 0) } catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true
			throw error
		}
		Bun.sleepSync(10)
	}
	return false
}

export function cliRunStatus(id: string, options: CliRunOptions = {}): RunStatus {
	const runDir = runDirFor(id, options)
	if (!existsSync(join(runDir, 'run.json'))) throw new Error(`unknown cli run: ${id}`)
	const resultPath = join(runDir, 'result.json')
	if (!existsSync(resultPath) && !existsSync(join(runDir, 'started'))) {
		const record = readJson<RunRecord>(join(runDir, 'run.json'))
		if (Date.now() - Date.parse(record.createdAt) >= 600_000) {
			try {
				// Compete with the worker's execution claim; a delayed launch must never replay this run.
				closeSync(openSync(join(runDir, 'started'), 'wx'))
				writeFileSync(join(runDir, 'cancelled'), '')
				publishResult(resultPath, { ...unavailable(id, []), verdict: 'task-failure', finalText: 'Worker launch was not established within ten minutes.' })
				removeWorktree(record)
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
			}
		}
	}
	if (!existsSync(resultPath) && existsSync(join(runDir, 'launch.json'))) {
		const launched = readJson<LaunchRecord>(join(runDir, 'launch.json'))
		let stopped = false
		if (launched.kind === 'local') {
			try { process.kill(launched.pid, 0) } catch (error) {
				if ((error as NodeJS.ErrnoException).code === 'ESRCH') stopped = stopLocalGroup(launched.pid)
			}
		} else {
			const status = Bun.spawnSync(['amp', 'orb', 'service', 'status', launched.service], { stdout: 'pipe', stderr: 'pipe' })
			stopped = status.exitCode === 0 && /\b(STOPPED|EXITED|FATAL|BACKOFF)\b/.test(status.stdout.toString())
		}
		if (stopped && !existsSync(resultPath)) {
			publishResult(resultPath, { ...unavailable(id, []), verdict: existsSync(join(runDir, 'cancelled')) ? 'cancelled' : 'task-failure', finalText: 'Worker stopped without a result.' } satisfies RunResult)
			removeWorktree(readJson<RunRecord>(join(runDir, 'run.json')))
		}
	}
	return existsSync(resultPath) ? { id, state: 'done', result: readJson<RunResult>(resultPath) } : { id, state: 'running' }
}

export function pruneCliRuns(options: CliRunOptions = {}, now = Date.now()): void {
	const root = options.stateDir ?? DEFAULT_STATE_DIR
	if (!existsSync(root)) return
	for (const id of readdirSync(root)) {
		if (!RUN_ID.test(id)) continue
		const dir = join(root, id)
		const result = join(dir, 'result.json')
		if (!existsSync(result) || now - statSync(result).mtimeMs < 7 * 86400_000) continue
		removeWorktree(readJson<RunRecord>(join(dir, 'run.json')))
		rmSync(dir, { recursive: true, force: true })
	}
}

export async function collectCliRun(id: string, options: CliRunOptions & { timeoutMs: number }): Promise<Collected> {
	const deadline = Date.now() + options.timeoutMs
	for (;;) {
		const status = cliRunStatus(id, options)
		if (status.state === 'done') return { status: 'done', id, result: status.result }
		if (Date.now() >= deadline) return { status: 'timeout', id }
		await Bun.sleep(250)
	}
}

export async function runCli(request: CliRunRequest, options: CliRunOptions & { timeoutMs: number }): Promise<Collected> {
	return collectCliRun(startCliRun(request, options).id, options)
}

export function stopCliRun(id: string, options: CliRunOptions = {}): RunStatus {
	const runDir = runDirFor(id, options)
	const status = cliRunStatus(id, options)
	if (status.state === 'done') return status
	writeFileSync(join(runDir, 'cancelled'), '')
	// If execution has not started, own its one-shot claim before publishing cancellation.
	let preventedExecution = false
	try {
		closeSync(openSync(join(runDir, 'started'), 'wx'))
		preventedExecution = true
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
	}
	const launched = existsSync(join(runDir, 'launch.json')) ? readJson<LaunchRecord>(join(runDir, 'launch.json')) : undefined
	if (launched?.kind === 'orb') {
		const stopped = Bun.spawnSync(['amp', 'orb', 'service', 'stop', launched.service], { stdout: 'pipe', stderr: 'pipe' })
		if (stopped.exitCode !== 0 && !preventedExecution) throw new Error('Service stop failed; CLI run remains owned. Reconcile before retrying.')
	} else if (launched?.kind === 'local' && !stopLocalGroup(launched.pid)) {
		return { id, state: 'running' }
	}
	const resultPath = join(runDir, 'result.json')
	publishResult(resultPath, { ...unavailable(id, []), verdict: 'cancelled' } satisfies RunResult)
	removeWorktree(readJson<RunRecord>(join(runDir, 'run.json')))
	return cliRunStatus(id, options)
}

if (import.meta.main && process.argv[2] === WORKER_FLAG) void runWorker(process.argv[3] ?? '')
