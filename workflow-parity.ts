export const WRITE_TOOLS = ['apply_patch', 'create_file', 'edit_file'] as const

export const CODE_IMPLEMENTATION_ROLES = new Set([
	'feature-refactoring',
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
export type DelegateExecutor = 'local' | 'orb'
export type ParentExecutorKind = 'local' | 'remote' | 'unknown'

export const ARBITRARY_SHELL_GAP =
	'Arbitrary shell_command is not classified as a write. filesModifiedByToolCall recognizes editor calls and limited in-place mutations such as sed, not arbitrary shell, other processes, user edits, or unpaired native threads.'

export const IMPLEMENTATION_BLOCKING_ERROR =
	'Implementation roles cannot use blocking pstack_run_agent. Use pstack_start_agent with a non-empty scope and a launch target.'

export const REMOTE_LOCAL_EXECUTOR_ERROR =
	'executor local is unavailable when the parent runs in an orb. Use an orb child, or keep the work in the parent thread when it depends on that orb\'s live filesystem.'

export const REMOTE_CURRENT_CHECKOUT_ERROR =
	'current-checkout is unavailable when the parent runs in an orb because local targets the current Amp client, not the parent orb filesystem. Use parent-project-orb or native-orb for a fresh orb. Keep the work in the parent thread or transfer/persist its state first when the child needs live parent-orb files.'

export type LaunchTarget =
	| { kind: 'current-checkout' }
	| { kind: 'parent-project-orb' }
	| { kind: 'repo-independent-orb' }
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
			expectedNative?: Record<string, unknown>
			nativeToolUseID?: string
	  }
	| {
			state: 'running'
			parentThreadID: string
			role: string
			scope: string
			threadID: string
	  }

export type DesignRun =
	| {
			state: 'candidates-running'
			parentThreadID: string
			panel: string
			candidateThreadIDs: string[]
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
	kind: 'implementation' | 'strict-readonly' | 'judge'
	seenActive: boolean
	subscription: { unsubscribe(): void }
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isImplementationRole(role: string): boolean {
	return CODE_IMPLEMENTATION_ROLES.has(role)
}

export function isStrictReadonlyRole(role: string): boolean {
	if (STRICT_READONLY_ROLES.has(role)) return true
	return role.startsWith('how-critics-') || role.startsWith('interrogate-reviewers-')
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
			role === 'how-explorer' || role === 'how-explainer' || role === 'arena-cross-judge'
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
		'launchTarget.kind must be current-checkout, parent-project-orb, repo-independent-orb, or native-orb.',
	)
}

export function executorForParent(
	value: unknown,
	parentExecutorKind: ParentExecutorKind,
): DelegateExecutor {
	const executor = value === undefined || value === null || value === '' ? undefined : value
	if (executor !== undefined && executor !== 'local' && executor !== 'orb') {
		throw new Error('executor must be local or orb.')
	}
	if (parentExecutorKind === 'remote') {
		if (executor === 'local') throw new Error(REMOTE_LOCAL_EXECUTOR_ERROR)
		return 'orb'
	}
	return executor ?? 'local'
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
		if (target.kind === 'current-checkout' && options.parentExecutorKind === 'remote') {
			throw new Error(REMOTE_CURRENT_CHECKOUT_ERROR)
		}
		return target
	}
	if (executor === 'orb') return { kind: 'parent-project-orb' }
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
	return `An implementation owner is already live for this parent: role ${owner.role}, scope ${owner.scope}, thread ${thread}.`
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

export class WorkflowParityPolicy {
	private owners = new Map<string, ImplementationOwner>()
	private designs = new Map<string, DesignRun>()
	private children = new Map<string, GuardedChild>()

	owner(parentThreadID: string): ImplementationOwner | undefined {
		return this.owners.get(parentThreadID)
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

	reserveImplementation(parentThreadID: string, role: string, scope: string): ImplementationOwner {
		const existing = this.owners.get(parentThreadID)
		if (existing) throw new Error(ownerConflictMessage(existing))
		const reserved: ImplementationOwner = {
			state: 'reserving',
			parentThreadID,
			role,
			scope,
		}
		this.owners.set(parentThreadID, reserved)
		return reserved
	}

	expectNative(parentThreadID: string, expectedNative: Record<string, unknown>): void {
		const owner = this.owners.get(parentThreadID)
		if (!owner || owner.state !== 'reserving') return
		this.owners.set(parentThreadID, { ...owner, expectedNative })
	}

	async attachRunning(parentThreadID: string, thread: StateThread): Promise<ImplementationOwner> {
		const owner = this.owners.get(parentThreadID)
		if (!owner || owner.state !== 'reserving') {
			throw new Error('No implementation reservation to attach.')
		}
		const running: ImplementationOwner = {
			state: 'running',
			parentThreadID,
			role: owner.role,
			scope: owner.scope,
			threadID: thread.id,
		}
		this.owners.set(parentThreadID, running)
		try {
			await this.observe(thread, {
				role: owner.role,
				parentThreadID,
				kind: 'implementation',
			})
		} catch (error) {
			this.owners.delete(parentThreadID)
			throw error
		}
		return running
	}

	release(parentThreadID: string): void {
		const owner = this.owners.get(parentThreadID)
		this.owners.delete(parentThreadID)
		if (owner?.state === 'running') this.unobserve(owner.threadID)
	}

	releaseIfReserving(parentThreadID: string): void {
		const owner = this.owners.get(parentThreadID)
		if (owner?.state === 'reserving') this.owners.delete(parentThreadID)
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
		}
		this.designs.set(parentThreadID, run)
		return run
	}

	addCandidate(parentThreadID: string, threadID: string): void {
		const run = this.designs.get(parentThreadID)
		if (!run || run.state !== 'candidates-running') return
		run.candidateThreadIDs.push(threadID)
	}

	markJudgeRequired(parentThreadID: string): DesignRun | undefined {
		const run = this.designs.get(parentThreadID)
		if (!run || run.state !== 'candidates-running') return run
		const next: DesignRun = {
			state: 'judge-required',
			parentThreadID,
			panel: run.panel,
			candidateThreadIDs: run.candidateThreadIDs,
		}
		this.designs.set(parentThreadID, next)
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
		this.designs.set(parentThreadID, { ...run, judgeReserved: true })
		return true
	}

	expectNativeJudge(parentThreadID: string, expectedNative: Record<string, unknown>): void {
		const run = this.designs.get(parentThreadID)
		if (!run || run.state !== 'judge-required' || !run.judgeReserved) {
			throw new Error('No cross-judge reservation to attach to a native create_thread call.')
		}
		this.designs.set(parentThreadID, { ...run, expectedNative })
	}

	cancelJudgeReservation(parentThreadID: string): void {
		const run = this.designs.get(parentThreadID)
		if (!run || run.state !== 'judge-required' || !run.judgeReserved) return
		this.designs.set(parentThreadID, {
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
		this.designs.set(parentThreadID, next)
		try {
			await this.observe(thread, {
				role: 'arena-cross-judge',
				parentThreadID,
				kind: 'judge',
			})
		} catch (error) {
			this.designs.set(parentThreadID, {
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
		this.designs.set(parentThreadID, {
			state: 'judge-required',
			parentThreadID,
			panel: run.panel,
			candidateThreadIDs: run.candidateThreadIDs,
		})
	}

	clearDesign(parentThreadID: string): void {
		const run = this.designs.get(parentThreadID)
		this.designs.delete(parentThreadID)
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
			const owner = this.owners.get(event.thread.id)
			if (owner?.state === 'reserving' && owner.expectedNative && !owner.nativeToolUseID) {
				if (createThreadInputMatches(event.input, owner.expectedNative)) {
					this.owners.set(event.thread.id, {
						...owner,
						nativeToolUseID: event.toolUseID,
					})
					return { action: 'allow' }
				}
			}
			const run = this.designs.get(event.thread.id)
			if (
				run?.state === 'judge-required' &&
				run.judgeReserved &&
				run.expectedNative &&
				!run.nativeToolUseID &&
				createThreadInputMatches(event.input, run.expectedNative)
			) {
				this.designs.set(event.thread.id, { ...run, nativeToolUseID: event.toolUseID })
				return { action: 'allow' }
			}
		}

		const child = this.children.get(event.thread.id)
		if (child?.kind === 'strict-readonly' && this.isRejectedMutation(event.tool, filesModified)) {
			return {
				action: 'reject-and-continue',
				message: `Strict read-only role ${child.role} cannot mutate files.`,
			}
		}

		const owner = this.owners.get(event.thread.id)
		if (owner && this.isRejectedMutation(event.tool, filesModified)) {
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
		const owner = this.owners.get(event.thread.id)
		if (
			owner?.state === 'reserving' &&
			owner.nativeToolUseID &&
			owner.nativeToolUseID === event.toolUseID
		) {
			if (event.status && event.status !== 'done') {
				this.release(event.thread.id)
				return
			}
			const threadID = threadIDFromCreateThreadResult(event.output)
			const handle = threadID ? resolveThread(threadID) : undefined
			if (!handle?.state?.subscribe) {
				this.release(event.thread.id)
				return
			}
			try {
				await this.attachRunning(event.thread.id, handle)
			} catch {
				this.release(event.thread.id)
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
		if (run?.state === 'judging') {
			return {
				action: 'continue',
				userMessage: `Cross-judge thread ${run.judgeThreadID} is still live. Continue parent-owned candidate review and synthesis without replacing the judge. This design run can finish after that judge reaches terminal idle or error.`,
			}
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

	private isRejectedMutation(tool: string, filesModified: readonly string[] | null): boolean {
		if (isWriteTool(tool)) return true
		return Array.isArray(filesModified) && filesModified.length > 0
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
			if (!seenActive) return
			if (state !== 'idle' && state !== 'error') return
			this.releaseObserved(thread.id)
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

	private releaseObserved(threadID: string): void {
		const child = this.children.get(threadID)
		if (!child) return
		child.subscription.unsubscribe()
		this.children.delete(threadID)
		if (child.kind === 'implementation') this.owners.delete(child.parentThreadID)
		if (child.kind === 'judge') this.designs.delete(child.parentThreadID)
	}

	private unobserve(threadID: string): void {
		const child = this.children.get(threadID)
		if (!child) return
		child.subscription.unsubscribe()
		this.children.delete(threadID)
	}
}
