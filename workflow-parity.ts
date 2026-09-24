export const WRITE_TOOLS = ['apply_patch', 'create_file', 'edit_file'] as const

export const CODE_IMPLEMENTATION_ROLES = new Set([
	'feature',
	'refactoring',
	'bug-fix',
	'perf-issue',
	'hillclimb',
])

export const STRICT_READONLY_ROLES = new Set([
	'how-explorer',
	'how-explainer',
	'comment-reviewer',
	'arena-cross-judge',
])

export const STRICT_READONLY_TOOLS = [
	'Read',
	'finder',
	'find_thread',
	'read_thread',
	'read_web_page',
	'web_search',
	'view_media',
	'librarian',
] as const

export const REPORTING_READONLY_TOOLS = [...STRICT_READONLY_TOOLS, 'pstack_send_to_thread'] as const

export const RESEARCH_EXCLUDED_TOOLS = [...WRITE_TOOLS] as const

export const ORB_SIZES = ['a1.tiny', 'a1.small', 'a1.medium', 'a1.large', 'a1.xxlarge'] as const
export type OrbSize = (typeof ORB_SIZES)[number]
export type RunnerExecutor = Readonly<{ type: 'runner'; id: string }>
export type DelegateExecutor = 'local' | 'orb' | RunnerExecutor
export type ParentExecutorKind = 'local' | 'orb' | 'runner' | 'remote' | 'unknown'

export const ARBITRARY_SHELL_GAP =
	'Arbitrary shell_command is not classified as a write. filesModifiedByToolCall recognizes editor calls and limited in-place mutations such as sed, not arbitrary shell, other processes, user edits, or unpaired native threads.'

export const IMPLEMENTATION_BLOCKING_ERROR =
	'Implementation roles cannot use blocking pstack_run_agent. Use pstack_start_agent with a non-empty scope and a launch target.'

export const REMOTE_LOCAL_EXECUTOR_ERROR =
	'executor local is unavailable when the parent runs in an Amp-managed orb. Keep work that needs the live orb filesystem in the parent, or use a fresh orb with transferred inputs.'

export const REMOTE_CURRENT_CHECKOUT_ERROR =
	'current-checkout is unavailable when the parent runs in an orb because local targets the current Amp client, not the parent orb filesystem. Use parent-project-orb or native-orb for a fresh orb. Keep the work in the parent thread or transfer/persist its state first when the child needs live parent-orb files.'

export type LaunchTarget =
	| { kind: 'current-checkout' }
	| { kind: 'parent-project-orb' }
	| { kind: 'repo-independent-orb' }
	| { kind: 'named-runner'; runnerId: string; workingDirectory?: string }
	| {
			kind: 'native-orb'
			project: string
			orbSize?: OrbSize
			agentMode?: string
	  }
	| { kind: 'cloud-base-branch'; branch: string }

export type RoleCapability =
	| { kind: 'implementation'; tools: 'all' }
	| { kind: 'strict-readonly'; tools: { include: readonly string[] } }
	| { kind: 'research'; tools: { exclude: readonly string[] } }

export type ImplementationOwner =
	| {
			state: 'reserving'
			parentThreadID: string
			role: string
			scope: string
			resourceKey: string
			logicalKey: string
			workspaceKey: string
			scopePaths: string[]
			expectedNative?: Record<string, unknown>
			nativeToolUseID?: string
	  }
	| {
			state: 'running'
			parentThreadID: string
			role: string
			scope: string
			resourceKey: string
			logicalKey: string
			workspaceKey: string
			scopePaths: string[]
			threadID: string
	  }

export type ImplementationResource = Readonly<{
	resourceKey: string
	logicalKey: string
	workspaceKey: string
	scopePaths: readonly string[]
}>

export type DesignRun =
	| {
			state: 'candidates-running'
			parentThreadID: string
			panel: string
			candidateThreadIDs: string[]
			pendingCandidateThreadIDs: string[]
			completedCandidateThreadIDs: string[]
			failedCandidateThreadIDs: string[]
	  }
	| {
			state: 'judge-required'
			parentThreadID: string
			panel: string
			candidateThreadIDs: string[]
			judgeReserved?: boolean
			expectedNative?: Record<string, unknown>
			nativeToolUseID?: string
	  }
	| {
			state: 'judging'
			parentThreadID: string
			panel: string
			candidateThreadIDs: string[]
			judgeThreadID: string
	  }

type ThreadState = 'idle' | 'running' | 'awaiting-approval' | 'error'

type StateThread = {
	id: string
	state: {
		subscribe: (listener: (state: ThreadState) => void) => { unsubscribe(): void }
		get: () => Promise<ThreadState>
	}
}

type GuardedChild = {
	role: string
	parentThreadID: string
	kind: 'implementation' | 'strict-readonly' | 'candidate' | 'judge'
	seenActive: boolean
	subscription: { unsubscribe(): void }
}

type CandidateNotifier = (parentThreadID: string, message: string) => void
type OwnerObserver = (resourceKey: string, owner: ImplementationOwner | undefined) => void
type DesignObserver = (parentThreadID: string, run: DesignRun | undefined) => void

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isImplementationRole(role: string): boolean {
	return CODE_IMPLEMENTATION_ROLES.has(role)
}

export function isStrictReadonlyRole(role: string): boolean {
	if (STRICT_READONLY_ROLES.has(role)) return true
	return role.startsWith('interrogate-reviewers-')
}

export function isResearchRole(role: string): boolean {
	return (
		role === 'why-investigator' ||
		role === 'why-synthesizer' ||
		role === 'reflect-tooling' ||
		role === 'reflect-judgment' ||
		role.startsWith('why-') ||
		role.startsWith('reflect-')
	)
}

export function isDesignPanel(panel: string): boolean {
	return panel === 'architect-runners' || panel === 'arena-runners'
}

export function capabilityFor(role: string): RoleCapability {
	if (isStrictReadonlyRole(role)) {
		const tools =
			role === 'how-explorer' ||
			role === 'how-explainer' ||
			role === 'comment-reviewer' ||
			role === 'arena-cross-judge'
				? REPORTING_READONLY_TOOLS
				: STRICT_READONLY_TOOLS
		return { kind: 'strict-readonly', tools: { include: tools } }
	}
	if (isResearchRole(role)) {
		return { kind: 'research', tools: { exclude: RESEARCH_EXCLUDED_TOOLS } }
	}
	return { kind: 'implementation', tools: 'all' }
}

export function toolsFor(role: string): RoleCapability['tools'] {
	return capabilityFor(role).tools
}

export function parseLaunchTarget(value: unknown, required: boolean): LaunchTarget | null {
	if (value === undefined || value === null || value === '') {
		return required ? { kind: 'current-checkout' } : null
	}
	if (!isRecord(value)) throw new Error('launchTarget must be an object.')
	if (typeof value.cloudBaseBranch === 'string' && value.cloudBaseBranch.trim()) {
		return { kind: 'cloud-base-branch', branch: value.cloudBaseBranch.trim() }
	}
	const kind = value.kind
	if (kind === 'current-checkout') return { kind: 'current-checkout' }
	if (kind === 'parent-project-orb') return { kind: 'parent-project-orb' }
	if (kind === 'repo-independent-orb') return { kind: 'repo-independent-orb' }
	if (kind === 'named-runner') {
		if (typeof value.runnerId !== 'string' || !value.runnerId.trim()) {
			throw new Error('named-runner launchTarget requires a non-empty runnerId.')
		}
		if (
			value.workingDirectory !== undefined &&
			(typeof value.workingDirectory !== 'string' ||
				!value.workingDirectory.startsWith('/'))
		) {
			throw new Error('named-runner workingDirectory must be an absolute path.')
		}
		return {
			kind: 'named-runner',
			runnerId: value.runnerId.trim(),
			workingDirectory:
				typeof value.workingDirectory === 'string'
					? value.workingDirectory
					: undefined,
		}
	}
	if (kind === 'native-orb') {
		if (typeof value.project !== 'string' || !value.project.trim()) {
			throw new Error('native-orb launchTarget requires a project.')
		}
		const target: Extract<LaunchTarget, { kind: 'native-orb' }> = {
			kind: 'native-orb',
			project: value.project.trim(),
		}
		if (typeof value.orbSize === 'string') {
			if (!ORB_SIZES.includes(value.orbSize as OrbSize)) {
				throw new Error('orbSize must be a1.tiny, a1.small, a1.medium, a1.large, or a1.xxlarge.')
			}
			target.orbSize = value.orbSize as OrbSize
		}
		if (typeof value.agentMode === 'string' && value.agentMode.trim()) {
			target.agentMode = value.agentMode.trim()
		}
		return target
	}
	throw new Error(
		'launchTarget.kind must be current-checkout, parent-project-orb, repo-independent-orb, named-runner, or native-orb.',
	)
}

function parseExecutor(value: unknown): DelegateExecutor | undefined {
	if (value === undefined || value === null || value === '') return undefined
	if (value === 'local' || value === 'orb') return value
	if (isRecord(value) && value.type === 'runner') {
		if (typeof value.id !== 'string' || !value.id.trim()) {
			throw new Error('runner executor requires a non-empty id.')
		}
		return { type: 'runner', id: value.id.trim() }
	}
	throw new Error('executor must be local, orb, or { type: "runner", id }.')
}

export function executorForParent(
	value: unknown,
	parentExecutorKind: ParentExecutorKind,
): DelegateExecutor {
	const executor = parseExecutor(value)
	if (parentExecutorKind === 'orb') {
		if (executor === 'local') throw new Error(REMOTE_LOCAL_EXECUTOR_ERROR)
		return executor ?? 'orb'
	}
	if (executor) return executor
	if (parentExecutorKind === 'local' || parentExecutorKind === 'runner') return 'local'
	throw new Error(
		'Cannot infer an execution target from a remote or unknown parent. Pass an explicit execution target.',
	)
}

export function launchTargetForParent(
	value: unknown,
	options: {
		implementation: boolean
		parentExecutorKind: ParentExecutorKind
		executor: unknown
	},
): LaunchTarget | null {
	const executor = executorForParent(options.executor, options.parentExecutorKind)
	const target = parseLaunchTarget(value, false)
	if (target) {
		if (target.kind === 'current-checkout' && options.parentExecutorKind === 'orb') {
			throw new Error(REMOTE_CURRENT_CHECKOUT_ERROR)
		}
		return target
	}
	if (executor === 'orb') return { kind: 'parent-project-orb' }
	if (typeof executor === 'object') {
		return { kind: 'named-runner', runnerId: executor.id }
	}
	return options.implementation ? { kind: 'current-checkout' } : null
}

export function nativeRedirect(input: {
	role: string
	model: string
	parentThreadID: string
	prompt: string
	scope: string
	modeKey: string
	target: Extract<LaunchTarget, { kind: 'native-orb' }>
}): Record<string, unknown> {
	const agentMode = input.target.agentMode ?? input.modeKey
	const create_thread: Record<string, unknown> = {
		executor: 'orb',
		agent_mode: agentMode,
		project: input.target.project,
		prompt: input.prompt,
		intent: 'delegation',
	}
	const fields: string[] = ['agentMode', 'project']
	if (input.target.orbSize) {
		create_thread.orb_size = input.target.orbSize
		fields.push('orbSize')
	}
	return {
		action: 'use-native-create-thread',
		reason: 'plugin-createThread-cannot-set-field',
		fields,
		role: input.role,
		model: input.model,
		parentThreadID: input.parentThreadID,
		scope: input.scope,
		agentModeOverride: Boolean(input.target.agentMode),
		create_thread,
		next: 'Call Amp create_thread next with exactly these fields. Pairing observes only that next matching call from this parent. Arbitrary native threads bypass the implementation-owner guard.',
	}
}

export function cloudBaseBranchUnsupported(branch: string): Record<string, unknown> {
	return {
		action: 'unsupported',
		reason: 'Amp has no cloud_base_branch equivalent.',
		field: 'cloudBaseBranch',
		branch,
	}
}

export function ownerConflictMessage(owner: ImplementationOwner): string {
	const thread = owner.state === 'running' ? owner.threadID : 'not started yet'
	return `An implementation owner already holds resource ${owner.resourceKey}: role ${owner.role}, scope ${owner.scope}, thread ${thread}.`
}

export function judgeContinueMessage(run: Extract<DesignRun, { state: 'judge-required' }>): string {
	if (run.nativeToolUseID) {
		return `The paired native create_thread call ${run.nativeToolUseID} for arena-cross-judge has not produced an observable child yet. Do not start another judge. Candidate thread IDs: ${run.candidateThreadIDs.join(', ') || '(none)'}.`
	}
	if (run.expectedNative) {
		return `Call native create_thread next with the exact fields returned by pstack_start_agent for arena-cross-judge. Do not start another judge. Candidate thread IDs: ${run.candidateThreadIDs.join(', ') || '(none)'}.`
	}
	return `Call pstack_start_agent with role arena-cross-judge before completing this design run. Candidate thread IDs: ${run.candidateThreadIDs.join(', ') || '(none)'}. Pick, graft, synthesis quality, and verification stay with this parent.`
}

export function threadIDFromCreateThreadResult(output: unknown): string | null {
	const fromRecord = (value: unknown): string | null => {
		if (!isRecord(value)) return null
		if (typeof value.threadID === 'string' && value.threadID.startsWith('T-')) return value.threadID
		if (isRecord(value.thread) && typeof value.thread.id === 'string' && value.thread.id.startsWith('T-')) {
			return value.thread.id
		}
		return null
	}
	const direct = fromRecord(output)
	if (direct) return direct
	if (Array.isArray(output)) {
		for (const block of output) {
			if (!isRecord(block) || block.type !== 'text' || typeof block.text !== 'string') continue
			const parsed = threadIDFromCreateThreadResult(block.text)
			if (parsed) return parsed
		}
	}
	if (typeof output === 'string') {
		try {
			const parsed = fromRecord(JSON.parse(output))
			if (parsed) return parsed
		} catch {}
		const match = output.match(/T-[0-9a-fA-F-]{8,}/)
		if (match) return match[0]
	}
	return null
}

export function createThreadInputMatches(
	input: Record<string, unknown>,
	expected: Record<string, unknown>,
): boolean {
	for (const [key, value] of Object.entries(expected)) {
		if (input[key] !== value) return false
	}
	return true
}

function isWriteTool(name: string): boolean {
	return (WRITE_TOOLS as readonly string[]).includes(name)
}

function normalizeOwnedPath(path: string): string {
	return path
		.replace(/^file:\/\//, '')
		.replaceAll('\\', '/')
		.replace(/\/+/g, '/')
		.replace(/\/$/, '')
}

export function ownedPathsOverlap(left: string, right: string): boolean {
	const a = normalizeOwnedPath(left)
	const b = normalizeOwnedPath(right)
	if (a === b) return true
	if (a.startsWith(`${b}/`) || b.startsWith(`${a}/`)) return true
	return a.endsWith(`/${b}`) || b.endsWith(`/${a}`)
}

export class WorkflowParityPolicy {
	private owners = new Map<string, ImplementationOwner>()
	private designs = new Map<string, DesignRun>()
	private children = new Map<string, GuardedChild>()
	private candidateNotifier: CandidateNotifier | undefined
	private ownerObserver: OwnerObserver | undefined
	private designObserver: DesignObserver | undefined

	constructor(
		candidateNotifier?: CandidateNotifier,
		ownerObserver?: OwnerObserver,
		designObserver?: DesignObserver,
	) {
		this.candidateNotifier = candidateNotifier
		this.ownerObserver = ownerObserver
		this.designObserver = designObserver
	}

	owner(parentThreadID: string): ImplementationOwner | undefined {
		return [...this.owners.values()].find((owner) => owner.parentThreadID === parentThreadID)
	}

	ownersForParent(parentThreadID: string): ImplementationOwner[] {
		return [...this.owners.values()].filter((owner) => owner.parentThreadID === parentThreadID)
	}

	design(parentThreadID: string): DesignRun | undefined {
		return this.designs.get(parentThreadID)
	}

	child(threadID: string): GuardedChild | undefined {
		return this.children.get(threadID)
	}

	liveGuardCount(): number {
		return this.owners.size + this.designs.size + this.children.size
	}

	reserveImplementation(
		parentThreadID: string,
		role: string,
		scope: string,
		resource: ImplementationResource,
	): ImplementationOwner {
		const existing = [...this.owners.values()].find(
			(owner) =>
				owner.resourceKey === resource.resourceKey ||
				owner.logicalKey === resource.logicalKey ||
				(owner.workspaceKey === resource.workspaceKey &&
					owner.scopePaths.some((owned) =>
						resource.scopePaths.some((requested) => ownedPathsOverlap(owned, requested)),
					)),
		)
		if (existing) throw new Error(ownerConflictMessage(existing))
		const reserved: ImplementationOwner = {
			state: 'reserving',
			parentThreadID,
			role,
			scope,
			resourceKey: resource.resourceKey,
			logicalKey: resource.logicalKey,
			workspaceKey: resource.workspaceKey,
			scopePaths: [...resource.scopePaths],
		}
		this.owners.set(resource.resourceKey, reserved)
		return reserved
	}

	async restoreImplementation(owner: ImplementationOwner, thread?: StateThread): Promise<void> {
		this.owners.set(owner.resourceKey, owner)
		if (owner.state === 'running' && thread) {
			await this.observe(thread, {
				role: owner.role,
				parentThreadID: owner.parentThreadID,
				kind: 'implementation',
			})
		}
	}

	async restoreDesign(
		run: DesignRun,
		resolveThread: (threadID: string) => StateThread | undefined,
	): Promise<void> {
		this.designs.set(run.parentThreadID, run)
		if (run.state === 'candidates-running') {
			for (const threadID of run.pendingCandidateThreadIDs) {
				const thread = resolveThread(threadID)
				if (thread) {
					await this.observe(thread, {
						role: 'arena-candidate',
						parentThreadID: run.parentThreadID,
						kind: 'candidate',
					})
				}
			}
		}
		if (run.state === 'judging') {
			const thread = resolveThread(run.judgeThreadID)
			if (thread) {
				await this.observe(thread, {
					role: 'arena-cross-judge',
					parentThreadID: run.parentThreadID,
					kind: 'judge',
				})
			}
		}
	}

	expectNative(resourceKey: string, expectedNative: Record<string, unknown>): void {
		const owner = this.owners.get(resourceKey)
		if (!owner || owner.state !== 'reserving') return
		const updated = { ...owner, expectedNative }
		this.owners.set(resourceKey, updated)
		this.ownerObserver?.(resourceKey, updated)
	}

	async attachRunning(resourceKey: string, thread: StateThread): Promise<ImplementationOwner> {
		const owner = this.owners.get(resourceKey)
		if (!owner || owner.state !== 'reserving') {
			throw new Error('No implementation reservation to attach.')
		}
		const running: ImplementationOwner = {
			state: 'running',
			parentThreadID: owner.parentThreadID,
			role: owner.role,
			scope: owner.scope,
			resourceKey: owner.resourceKey,
			logicalKey: owner.logicalKey,
			workspaceKey: owner.workspaceKey,
			scopePaths: owner.scopePaths,
			threadID: thread.id,
		}
		this.owners.set(resourceKey, running)
		this.ownerObserver?.(resourceKey, running)
		try {
			await this.observe(thread, {
				role: owner.role,
				parentThreadID: owner.parentThreadID,
				kind: 'implementation',
			})
		} catch (error) {
			this.owners.delete(resourceKey)
			this.ownerObserver?.(resourceKey, undefined)
			throw error
		}
		return running
	}

	release(resourceKey: string): void {
		const owner = this.owners.get(resourceKey)
		this.owners.delete(resourceKey)
		this.ownerObserver?.(resourceKey, undefined)
		if (owner?.state === 'running') this.unobserve(owner.threadID)
	}

	releaseIfReserving(resourceKey: string): void {
		const owner = this.owners.get(resourceKey)
		if (owner?.state === 'reserving') {
			this.owners.delete(resourceKey)
			this.ownerObserver?.(resourceKey, undefined)
		}
	}

	beginDesign(parentThreadID: string, panel: string): DesignRun {
		const existing = this.designs.get(parentThreadID)
		if (existing) {
			throw new Error(
				`A design run is already live for this parent: panel ${existing.panel}, state ${existing.state}.`,
			)
		}
		const run: DesignRun = {
			state: 'candidates-running',
			parentThreadID,
			panel,
			candidateThreadIDs: [],
			pendingCandidateThreadIDs: [],
			completedCandidateThreadIDs: [],
			failedCandidateThreadIDs: [],
		}
		this.setDesign(run)
		return run
	}

	async trackCandidate(parentThreadID: string, thread: StateThread, role: string): Promise<void> {
		const run = this.designs.get(parentThreadID)
		if (!run || run.state !== 'candidates-running') return
		if (!run.candidateThreadIDs.includes(thread.id)) {
			run.candidateThreadIDs.push(thread.id)
			run.pendingCandidateThreadIDs.push(thread.id)
		}
		this.setDesign(run)
		await this.observe(thread, { role, parentThreadID, kind: 'candidate' })
	}

	recordCandidateResult(
		parentThreadID: string,
		threadID: string,
		status: 'done' | 'timeout' | 'error',
	): DesignRun | undefined {
		if (status === 'timeout') return this.designs.get(parentThreadID)
		return this.settleCandidate(
			parentThreadID,
			threadID,
			status === 'done' ? 'completed' : 'failed',
		)
	}

	finishCandidateLaunch(parentThreadID: string): DesignRun | undefined {
		const run = this.designs.get(parentThreadID)
		if (!run || run.state !== 'candidates-running') return run
		if (run.candidateThreadIDs.length === 0) {
			this.deleteDesign(parentThreadID)
			return undefined
		}
		return this.advanceCandidateRun(run)
	}

	markJudgeRequired(parentThreadID: string): DesignRun | undefined {
		const run = this.designs.get(parentThreadID)
		if (!run || run.state !== 'candidates-running') return run
		if (run.pendingCandidateThreadIDs.length > 0 || run.completedCandidateThreadIDs.length === 0) {
			return run
		}
		const next: DesignRun = {
			state: 'judge-required',
			parentThreadID,
			panel: run.panel,
			candidateThreadIDs: run.candidateThreadIDs,
		}
		this.setDesign(next)
		return next
	}

	reserveJudge(parentThreadID: string): boolean {
		const run = this.designs.get(parentThreadID)
		if (!run) return false
		if (run.state === 'candidates-running') {
			throw new Error('The design candidates are still running; the cross-judge cannot start yet.')
		}
		if (run.state === 'judging' || run.judgeReserved) {
			throw new Error('An arena-cross-judge is already reserved or running for this design run.')
		}
		this.setDesign({ ...run, judgeReserved: true })
		return true
	}

	expectNativeJudge(parentThreadID: string, expectedNative: Record<string, unknown>): void {
		const run = this.designs.get(parentThreadID)
		if (!run || run.state !== 'judge-required' || !run.judgeReserved) {
			throw new Error('No cross-judge reservation to attach to a native create_thread call.')
		}
		this.setDesign({ ...run, expectedNative })
	}

	cancelJudgeReservation(parentThreadID: string): void {
		const run = this.designs.get(parentThreadID)
		if (!run || run.state !== 'judge-required' || !run.judgeReserved) return
		this.setDesign({
			state: 'judge-required',
			parentThreadID,
			panel: run.panel,
			candidateThreadIDs: run.candidateThreadIDs,
		})
	}

	async startJudge(parentThreadID: string, thread: StateThread): Promise<DesignRun | undefined> {
		const run = this.designs.get(parentThreadID)
		if (!run) return undefined
		if (run.state !== 'judge-required' || !run.judgeReserved) {
			throw new Error('No cross-judge reservation to start.')
		}
		const next: DesignRun = {
			state: 'judging',
			parentThreadID,
			panel: run.panel,
			candidateThreadIDs: run.candidateThreadIDs,
			judgeThreadID: thread.id,
		}
		this.setDesign(next)
		try {
			await this.observe(thread, {
				role: 'arena-cross-judge',
				parentThreadID,
				kind: 'judge',
			})
		} catch (error) {
			this.setDesign({
				state: 'judge-required',
				parentThreadID,
				panel: run.panel,
				candidateThreadIDs: run.candidateThreadIDs,
			})
			throw error
		}
		return next
	}

	failJudgeStart(parentThreadID: string): void {
		const run = this.designs.get(parentThreadID)
		if (!run || run.state !== 'judging') return
		this.unobserve(run.judgeThreadID)
		this.setDesign({
			state: 'judge-required',
			parentThreadID,
			panel: run.panel,
			candidateThreadIDs: run.candidateThreadIDs,
		})
	}

	clearDesign(parentThreadID: string): void {
		const run = this.designs.get(parentThreadID)
		this.deleteDesign(parentThreadID)
		if (run?.state === 'judging') this.unobserve(run.judgeThreadID)
	}

	async trackReadonly(thread: StateThread, role: string, parentThreadID: string): Promise<void> {
		await this.observe(thread, { role, parentThreadID, kind: 'strict-readonly' })
	}

	untrack(threadID: string): void {
		this.unobserve(threadID)
	}

	onToolCall(
		event: {
			tool: string
			toolUseID?: string
			thread: { id: string }
			input: Record<string, unknown>
		},
		filesModified: readonly string[] | null,
	): { action: 'allow' } | { action: 'reject-and-continue'; message: string } {
		if (event.tool === 'create_thread') {
			const ownerEntry = [...this.owners.entries()].find(
				([, owner]) =>
					owner.parentThreadID === event.thread.id &&
					owner.state === 'reserving' &&
					owner.expectedNative &&
					!owner.nativeToolUseID &&
					createThreadInputMatches(event.input, owner.expectedNative),
			)
			const owner = ownerEntry?.[1]
			if (owner?.state === 'reserving' && owner.expectedNative && !owner.nativeToolUseID) {
				const resourceKey = ownerEntry?.[0] ?? owner.resourceKey
				const updated = {
					...owner,
					nativeToolUseID: event.toolUseID,
				}
				this.owners.set(resourceKey, updated)
				this.ownerObserver?.(resourceKey, updated)
				return { action: 'allow' }
			}
			const run = this.designs.get(event.thread.id)
			if (
				run?.state === 'judge-required' &&
				run.judgeReserved &&
				run.expectedNative &&
				!run.nativeToolUseID &&
				createThreadInputMatches(event.input, run.expectedNative)
			) {
				this.setDesign({ ...run, nativeToolUseID: event.toolUseID })
				return { action: 'allow' }
			}
		}

		const child = this.children.get(event.thread.id)
		if (child && isStrictReadonlyRole(child.role) && this.isRejectedMutation(event.tool, filesModified)) {
			return {
				action: 'reject-and-continue',
				message: `Strict read-only role ${child.role} cannot mutate files.`,
			}
		}

		const owner = this.ownersForParent(event.thread.id).find((candidate) =>
			this.ownerRejectsMutation(candidate, event.tool, filesModified),
		)
		if (owner) {
			return {
				action: 'reject-and-continue',
				message: `Parent writes are blocked while an implementation owner is live. ${ownerConflictMessage(owner)} Arbitrary shell_command is an allowed gap. ${ARBITRARY_SHELL_GAP}`,
			}
		}

		return { action: 'allow' }
	}

	async onToolResult(
		event: {
			tool: string
			toolUseID?: string
			thread: { id: string }
			status?: string
			output?: unknown
		},
		resolveThread: (threadID: string) => StateThread | undefined,
	): Promise<void> {
		if (event.tool !== 'create_thread') return
		const ownerEntry = [...this.owners.entries()].find(
			([, owner]) =>
				owner.parentThreadID === event.thread.id &&
				owner.state === 'reserving' &&
				owner.nativeToolUseID === event.toolUseID,
		)
		const owner = ownerEntry?.[1]
		if (
			owner?.state === 'reserving' &&
			owner.nativeToolUseID &&
			owner.nativeToolUseID === event.toolUseID
		) {
			const resourceKey = ownerEntry?.[0] ?? owner.resourceKey
			if (event.status && event.status !== 'done') {
				this.release(resourceKey)
				return
			}
			const threadID = threadIDFromCreateThreadResult(event.output)
			const handle = threadID ? resolveThread(threadID) : undefined
			if (!handle?.state?.subscribe) {
				return
			}
			try {
				await this.attachRunning(resourceKey, handle)
			} catch {
				this.release(resourceKey)
			}
			return
		}

		const run = this.designs.get(event.thread.id)
		if (
			run?.state !== 'judge-required' ||
			!run.judgeReserved ||
			!run.nativeToolUseID ||
			run.nativeToolUseID !== event.toolUseID
		) {
			return
		}
		if (event.status && event.status !== 'done') {
			this.cancelJudgeReservation(event.thread.id)
			return
		}
		const threadID = threadIDFromCreateThreadResult(event.output)
		const handle = threadID ? resolveThread(threadID) : undefined
		if (!handle?.state?.subscribe) {
			this.cancelJudgeReservation(event.thread.id)
			return
		}
		try {
			await this.startJudge(event.thread.id, handle)
		} catch {
			this.cancelJudgeReservation(event.thread.id)
		}
	}

	onAgentEnd(threadID: string): { action: 'continue'; userMessage: string } | undefined {
		const run = this.designs.get(threadID)
		if (run?.state === 'judge-required') {
			return { action: 'continue', userMessage: judgeContinueMessage(run) }
		}
		return undefined
	}

	dispose(): { discarded: number } {
		const discarded = this.liveGuardCount()
		for (const child of this.children.values()) child.subscription.unsubscribe()
		this.children.clear()
		this.owners.clear()
		this.designs.clear()
		return { discarded }
	}

	private setDesign(run: DesignRun): void {
		this.designs.set(run.parentThreadID, run)
		this.designObserver?.(run.parentThreadID, run)
	}

	private deleteDesign(parentThreadID: string): void {
		this.designs.delete(parentThreadID)
		this.designObserver?.(parentThreadID, undefined)
	}

	private isRejectedMutation(tool: string, filesModified: readonly string[] | null): boolean {
		if (isWriteTool(tool)) return true
		return Array.isArray(filesModified) && filesModified.length > 0
	}

	private ownerRejectsMutation(
		owner: ImplementationOwner,
		tool: string,
		filesModified: readonly string[] | null,
	): boolean {
		if (!this.isRejectedMutation(tool, filesModified)) return false
		if (!filesModified || filesModified.length === 0) return true
		return filesModified.some((modified) =>
			owner.scopePaths.some((owned) => ownedPathsOverlap(modified, owned)),
		)
	}

	private async observe(
		thread: StateThread,
		info: { role: string; parentThreadID: string; kind: GuardedChild['kind'] },
	): Promise<void> {
		this.unobserve(thread.id)
		let seenActive = false
		const handleState = (state: ThreadState) => {
			if (state === 'running' || state === 'awaiting-approval') {
				seenActive = true
				const tracked = this.children.get(thread.id)
				if (tracked) tracked.seenActive = true
				return
			}
			if (state === 'error') {
				this.releaseObserved(thread.id, state)
				return
			}
			if (!seenActive || state !== 'idle') return
			this.releaseObserved(thread.id, state)
		}
		const subscription = thread.state.subscribe(handleState)
		const child: GuardedChild = {
			role: info.role,
			parentThreadID: info.parentThreadID,
			kind: info.kind,
			seenActive,
			subscription,
		}
		this.children.set(thread.id, child)
		try {
			handleState(await thread.state.get())
		} catch {
			// Keep the subscription as the source of truth when a point-in-time read is unavailable.
		}
	}

	private settleCandidate(
		parentThreadID: string,
		threadID: string,
		outcome: 'completed' | 'failed',
	): DesignRun | undefined {
		const run = this.designs.get(parentThreadID)
		if (!run || run.state !== 'candidates-running') return run
		if (!run.pendingCandidateThreadIDs.includes(threadID)) return run
		run.pendingCandidateThreadIDs = run.pendingCandidateThreadIDs.filter((id) => id !== threadID)
		const destination =
			outcome === 'completed' ? run.completedCandidateThreadIDs : run.failedCandidateThreadIDs
		if (!destination.includes(threadID)) destination.push(threadID)
		return this.advanceCandidateRun(run)
	}

	private advanceCandidateRun(
		run: Extract<DesignRun, { state: 'candidates-running' }>,
	): DesignRun | undefined {
		if (run.pendingCandidateThreadIDs.length > 0) {
			this.setDesign(run)
			return run
		}
		if (run.completedCandidateThreadIDs.length === 0) {
			this.deleteDesign(run.parentThreadID)
			this.candidateNotifier?.(
				run.parentThreadID,
				`Design panel ${run.panel} finished without a completed candidate. Review the failed candidate threads before retrying.`,
			)
			return undefined
		}
		const next = this.markJudgeRequired(run.parentThreadID)
		if (next?.state === 'judge-required') {
			this.candidateNotifier?.(
				run.parentThreadID,
				`Design candidates are terminal. Start the required cross-judge for ${run.panel}.`,
			)
		}
		return next
	}

	private releaseObserved(threadID: string, state?: ThreadState): void {
		const child = this.children.get(threadID)
		if (!child) return
		child.subscription.unsubscribe()
		this.children.delete(threadID)
		if (child.kind === 'implementation') {
			const ownerEntry = [...this.owners.entries()].find(
				([, owner]) => owner.state === 'running' && owner.threadID === threadID,
			)
			if (ownerEntry) this.owners.delete(ownerEntry[0])
			if (ownerEntry) this.ownerObserver?.(ownerEntry[0], undefined)
		}
		if (child.kind === 'candidate') {
			this.settleCandidate(
				child.parentThreadID,
				threadID,
				state === 'error' ? 'failed' : 'completed',
			)
		}
		if (child.kind === 'judge') {
			const run = this.designs.get(child.parentThreadID)
			if (state === 'error' && run?.state === 'judging') {
				this.setDesign({
					state: 'judge-required',
					parentThreadID: run.parentThreadID,
					panel: run.panel,
					candidateThreadIDs: run.candidateThreadIDs,
				})
				this.candidateNotifier?.(
					child.parentThreadID,
					`Cross-judge ${threadID} failed. Start one replacement judge for ${run.panel}.`,
				)
			} else {
				this.deleteDesign(child.parentThreadID)
			}
		}
	}

	private unobserve(threadID: string): void {
		const child = this.children.get(threadID)
		if (!child) return
		child.subscription.unsubscribe()
		this.children.delete(threadID)
	}
}
