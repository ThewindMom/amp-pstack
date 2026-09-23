import { homedir } from 'node:os'
import { join } from 'node:path'

import type {
	Agent,
	AgentReasoningEffort,
	BuiltinAgentMode,
	PluginAgentModel,
	PluginAPI,
	PluginThread,
	Subscription,
	ThreadID,
	ThreadMessage,
} from '@ampcode/plugin'

import { RuntimeStore } from './runtime-store'
import { WakeWebhookCoordinator } from './webhook-runtime'
import {
	CODE_IMPLEMENTATION_ROLES,
	IMPLEMENTATION_BLOCKING_ERROR,
	WRITE_TOOLS,
	WorkflowParityPolicy,
	capabilityFor,
	cloudBaseBranchUnsupported,
	executorForParent,
	isDesignPanel,
	isImplementationRole,
	isStrictReadonlyRole,
	launchTargetForParent,
	nativeRedirect,
	type DelegateExecutor,
	type ImplementationOwner,
	type ImplementationResource,
	type LaunchTarget,
	type ParentExecutorKind,
} from './workflow-parity'

export {
	ARBITRARY_SHELL_GAP,
	CODE_IMPLEMENTATION_ROLES,
	IMPLEMENTATION_BLOCKING_ERROR,
	REPORTING_READONLY_TOOLS,
	REMOTE_CURRENT_CHECKOUT_ERROR,
	REMOTE_LOCAL_EXECUTOR_ERROR,
	STRICT_READONLY_TOOLS,
	WRITE_TOOLS,
	WorkflowParityPolicy,
	capabilityFor,
	cloudBaseBranchUnsupported,
	executorForParent,
	isDesignPanel,
	isImplementationRole,
	isStrictReadonlyRole,
	launchTargetForParent,
	nativeRedirect,
	parseLaunchTarget,
} from './workflow-parity'

export type { DelegateExecutor, LaunchTarget, ParentExecutorKind } from './workflow-parity'

export const description =
	'Ports pstack to Amp with 47 workflow skills, the poteto mode, configurable multi-model delegates, background threads, transcript tools, and wake webhooks.'

export const SKILL_PATHS = [
	'skills/architect',
	'skills/arena',
	'skills/automate-me',
	'skills/blast-radius',
	'skills/bro',
	'skills/create-verification-skill',
	'skills/figure-it-out',
	'skills/how',
	'skills/interrogate',
	'skills/maintain-verification-skill',
	'skills/make-bot-ui',
	'skills/no-comments',
	'skills/poteto-mode',
	'skills/principle-attack-the-premise',
	'skills/principle-boundary-discipline',
	'skills/principle-build-the-lever',
	'skills/principle-encode-lessons-in-structure',
	'skills/principle-exhaust-the-design-space',
	'skills/principle-experience-first',
	'skills/principle-fix-root-causes',
	'skills/principle-foundational-thinking',
	'skills/principle-guard-the-context-window',
	'skills/principle-laziness-protocol',
	'skills/principle-make-operations-idempotent',
	'skills/principle-migrate-callers-then-delete-legacy-apis',
	'skills/principle-minimize-reader-load',
	'skills/principle-model-the-domain',
	'skills/principle-never-block-on-the-human',
	'skills/principle-outcome-oriented-execution',
	'skills/principle-prove-it-works',
	'skills/principle-redesign-from-first-principles',
	'skills/principle-separate-before-serializing-shared-state',
	'skills/principle-sequence-verifiable-units',
	'skills/principle-subtract-before-you-add',
	'skills/principle-test-behavior-not-implementation',
	'skills/principle-type-system-discipline',
	'skills/recall',
	'skills/reflect',
	'skills/setup-pstack',
	'skills/show-me-your-work',
	'skills/swarm',
	'skills/tdd',
	'skills/teach',
	'skills/technical-writing',
	'skills/typescript-best-practices',
	'skills/unslop',
	'skills/why',
] as const

export const DEFAULT_MODELS = {
	feature: 'xai/grok-4.7',
	refactoring: 'xai/grok-4.7',
	'bug-fix': 'xai/grok-4.7',
	'perf-issue': 'xai/grok-4.7',
	hillclimb: 'xai/grok-4.7',
	judgment: 'anthropic/claude-opus-5-5',
	'how-explorer': 'xai/grok-4.7',
	'how-explainer': 'anthropic/claude-opus-5-5',
	'why-investigator': 'xai/grok-4.7',
	'why-synthesizer': 'anthropic/claude-opus-5-5',
	'reflect-tooling': 'openai/gpt-6-sol',
	'reflect-judgment': 'anthropic/claude-opus-5-5',
	'reflect-divergent': 'anthropic/claude-opus-5-5',
	'reflect-synthesizer': 'anthropic/claude-opus-5-5',
	'swarm-worker': 'xai/grok-4.7',
	'comment-reviewer': 'anthropic/claude-opus-5-5',
	'arena-runners': [
		'anthropic/claude-opus-5-5',
		'openai/gpt-6-sol',
		'xai/grok-4.7',
	],
	'arena-cross-judge': [
		'anthropic/claude-opus-5-5',
		'openai/gpt-6-sol',
		'xai/grok-4.7',
	],
	'architect-runners': [
		'anthropic/claude-opus-5-5',
		'openai/gpt-6-sol',
		'xai/grok-4.7',
	],
	'interrogate-reviewers': [
		'anthropic/claude-opus-5-5',
		'openai/gpt-6-sol',
		'xai/grok-4.7',
	],
} as const

export const MODEL_REASONING_EFFORT = {
	'anthropic/claude-opus-5-5': 'high',
	'openai/gpt-6-sol': 'high',
	'xai/grok-4.7': 'high',
} as const satisfies Record<string, AgentReasoningEffort>

const ROLE_GUIDANCE = `Configured delegate role, not a skill or workflow name. Valid roles: ${Object.keys(DEFAULT_MODELS).join(', ')}. how is a workflow, not a role: use how-explorer for investigation or how-explainer for explanation. These strict read-only roles cannot run shell commands or tests. Use judgment for reviews requiring test execution; its no-code-change restriction must be stated in the brief and is not a sandbox. Blocking pstack_run_agent rejects implementation roles.`

export const CHEAP_MODELS = {
	feature: 'xai/grok-4.7',
	refactoring: 'xai/grok-4.7',
	'bug-fix': 'xai/grok-4.7',
	'perf-issue': 'xai/grok-4.7',
	hillclimb: 'xai/grok-4.7',
	judgment: 'xai/grok-4.7',
	'how-explorer': 'xai/grok-4.7',
	'how-explainer': 'xai/grok-4.7',
	'why-investigator': 'xai/grok-4.7',
	'why-synthesizer': 'xai/grok-4.7',
	'reflect-tooling': 'openai/gpt-5.6-sol',
	'reflect-judgment': 'xai/grok-4.7',
	'reflect-divergent': 'xai/grok-4.7',
	'reflect-synthesizer': 'xai/grok-4.7',
	'swarm-worker': 'xai/grok-4.7',
	'comment-reviewer': 'xai/grok-4.7',
	'arena-runners': ['xai/grok-4.7', 'openai/gpt-5.6-sol'],
	'arena-cross-judge': ['xai/grok-4.7', 'openai/gpt-5.6-sol'],
	'architect-runners': ['xai/grok-4.7', 'openai/gpt-5.6-sol'],
	'interrogate-reviewers': ['xai/grok-4.7', 'openai/gpt-5.6-sol'],
} as const

export const MODEL_PROFILES = ['balanced', 'cheap', 'builtin', 'reset'] as const
export type ModelProfileName = (typeof MODEL_PROFILES)[number]

export const WORKSPACE_MODEL_FILE = '.amp/pstack.models.json'
export const USER_MODEL_FILE = join(homedir(), '.config', 'amp', 'pstack.models.json')
export const PLUGIN_MODEL_FILE = join(import.meta.dir, 'pstack.models.json')
export const DEFAULT_STATE_DIRECTORY = join(homedir(), '.config', 'amp', 'pstack')

export function userModelPath(): string {
	return process.env.PSTACK_USER_MODEL_FILE ?? USER_MODEL_FILE
}

export function pluginModelPath(): string {
	return process.env.PSTACK_PLUGIN_MODEL_FILE ?? PLUGIN_MODEL_FILE
}

export function runtimeStatePath(ampURL: URL, userID: string | null): string {
	if (process.env.PSTACK_STATE_FILE) return process.env.PSTACK_STATE_FILE
	const hasher = new Bun.CryptoHasher('sha256')
	hasher.update(JSON.stringify([ampURL.origin, userID ?? 'anonymous']))
	return join(DEFAULT_STATE_DIRECTORY, `runtime-${hasher.digest('hex').slice(0, 16)}.sqlite`)
}

export const CONFIG_KEY = 'pstack.models'
export const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
export const MIN_TIMEOUT_MS = 30_000
export const MAX_TIMEOUT_MS = 60 * 60 * 1000
export const COMMENT_REVIEWER_MIN_TIMEOUT_MS = DEFAULT_TIMEOUT_MS
export const RUN_AGENT_MIN_TIMEOUT_MS = DEFAULT_TIMEOUT_MS
export const COMMENT_REVIEWER_EXCLUDED_TOOLS = [
	...WRITE_TOOLS,
	'Task',
	'skill',
	'oracle',
	'librarian',
	'find_thread',
	'read_thread',
	'create_thread',
	'wait_for_threads',
	'send_thread_message',
	'pstack_run_agent',
	'pstack_run_panel',
	'pstack_start_agent',
	'pstack_send_to_thread',
	'pstack_configure_models',
	'pstack_create_wake_webhook',
	'shell_command_kill',
] as const

type ModelValue = string | readonly string[]
export type ModelMap = Record<string, ModelValue>

export type ResolvedAgentSpec = Readonly<{
	role: string
	model: string
}>

const BUILTIN_MODE = /^builtin:(low|medium|high|ultra)$/
const MODEL_ID = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9._-]+)*$/i
const KNOWN_ROLES = new Set(Object.keys(DEFAULT_MODELS))
const PANEL_ROLES = new Set([
	'arena-runners',
	'architect-runners',
	'interrogate-reviewers',
])
const POOL_ROLES = new Set(['arena-cross-judge'])

export const ORB_MODE_RELOAD_ERROR =
	'Orb agents use the role/model map captured when pstack loaded. Reload plugins, then retry this orb launch. Local launches use configuration changes immediately.'

export function orbAgentModeFor(role: string, model: string): { key: string; label: string } {
	const hasher = new Bun.CryptoHasher('sha256')
	hasher.update(JSON.stringify([role, model]))
	const digest = hasher.digest('hex')
	const roleSlug =
		role
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
	const seat = roleSlug.match(/-\d+$/)?.[0] ?? ''
	const roleLabel =
		(seat ? `${roleSlug.slice(0, 11 - seat.length)}${seat}` : roleSlug.slice(0, 11)) || 'delegate'
	return {
		key: `pstack-${digest.slice(0, 16)}`,
		label: `${roleLabel}-${digest.slice(0, 12)}`,
	}
}

export function orbAgentSpecsFor(models: ModelMap): ResolvedAgentSpec[] {
	return Object.entries(models).flatMap(([role, value]) => {
		if (PANEL_ROLES.has(role)) {
			const seats = typeof value === 'string' ? [value] : value
			return seats.map((model, index) => ({ role: `${role}-${index + 1}`, model }))
		}
		if (POOL_ROLES.has(role)) {
			const pool = typeof value === 'string' ? [value] : value
			return [...new Set(pool)].map((model) => ({ role, model }))
		}
		if (typeof value === 'string') return [{ role, model: value }]
		throw new Error(`Single pstack role ${role} must configure one model.`)
	})
}

export const AGENT_INSTRUCTIONS = [
	'You are a pstack delegate running in Amp.',
	'Follow the caller’s exact scope and return compact, evidenced results.',
	'Use available tools directly rather than guessing.',
	'Do not push, merge, deploy, publish, delete shared data, or perform other external writes unless the user explicitly authorized that action.',
	'When editing, verify the result and report files changed, checks run, blockers, and the next action.',
	'Keep reports short: outcome, evidence (paths, commands, thread IDs), blockers, next action. Do not dump files.',
	'If a large artifact is required, write it and cite the path so the parent can pull it with download_thread_file.',
	'Do not spawn another agent for this same scope.',
	'Do not message sibling threads. Report only to the named parent.',
	'The parent may steer you mid-run. Treat a steering message as the new scope.',
].join(' ')

export const POTETO_DELEGATE_INSTRUCTIONS =
	'Before work, load pstack:poteto-mode and read it in full. Follow its principles while directly owning the delegated scope.'

function usesPotetoDelegateWrapper(role: string): boolean {
	return (
		CODE_IMPLEMENTATION_ROLES.has(role) ||
		role === 'judgment' ||
		role.startsWith('arena-runners-') ||
		role.startsWith('architect-runners-')
	)
}

export function steerFrom(value: unknown): boolean {
	return value !== false
}

export function backgroundChildPrompt(prompt: string, parentThreadID: string): string {
	return [
		prompt,
		'',
		`Parent thread: ${parentThreadID}.`,
		'When finished, call pstack_send_to_thread with that thread ID and a compact report.',
		'Omit steer unless you must not wake the parent (steer defaults to true).',
		'Report outcome, evidence, blockers, and next action. No file dumps.',
		'Do not spawn another agent for this same scope.',
		'Do not message sibling threads. The parent may steer you mid-run.',
		'If either this child or the parent is an orb, or the artifact is large, write the file and cite the path for download_thread_file instead of pasting it.',
	].join('\n')
}

export const START_AGENT_NEXT =
	'The child exclusively owns the delegated scope. Continue only work that is independent of that scope; end this turn when the child blocks further progress. Do not call wait_for_threads to judge startup. Amp reports unknown/settled with an empty transcript while the child is still starting; that is not failure. Do not spawn Task, pstack_run_agent, or a second pstack_start_agent for this scope. Never redo or replace a live child. The child reports through pstack_send_to_thread, and the parent may steer it. If you must check later, read_thread; zero messages means not started yet, not dead.'

const COMMENT_REVIEWER_INSTRUCTIONS = [
	AGENT_INSTRUCTIONS,
	'Assigned role: comment-reviewer.',
	'You are a terminal report-only reviewer.',
	'Do not load skills, spawn agents, create threads, or call pstack tools.',
	'Use read-only git and file reads to inspect the named scope.',
	'Do not edit files or run mutating shell.',
	'Return findings and MUST KILL symbols. Never apply a patch.',
].join(' ')

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function modelMapFrom(value: unknown): ModelMap {
	if (!isRecord(value)) return {}
	const result: ModelMap = {}
	for (const [role, candidate] of Object.entries(value)) {
		if (typeof candidate === 'string') result[role] = candidate
		if (
			Array.isArray(candidate) &&
			candidate.length > 0 &&
			candidate.every((item) => typeof item === 'string')
		) {
			result[role] = candidate
		}
	}
	return result
}

export function validateModel(value: string): boolean {
	return BUILTIN_MODE.test(value) || MODEL_ID.test(value)
}

export function modelFamily(model: string): 'claude' | 'gpt' | 'grok' | undefined {
	if (/^anthropic\/claude-/i.test(model)) return 'claude'
	if (/^openai\/gpt-/i.test(model)) return 'gpt'
	if (/^xai\/grok-/i.test(model)) return 'grok'
	return undefined
}

export function selectPoolModel(models: readonly string[], parentModel?: string): string {
	if (models.length === 0) throw new Error('A pstack model pool cannot be empty.')
	const parentFamily = parentModel ? modelFamily(parentModel) : undefined
	if (parentFamily) {
		const differentFamily = models.find((model) => {
			const family = modelFamily(model)
			return family !== undefined && family !== parentFamily
		})
		if (differentFamily) return differentFamily
	}
	return models[0]
}

export function isKnownRole(role: string): boolean {
	return KNOWN_ROLES.has(role)
}

function isValidRoleModel(role: string, value: unknown): value is ModelValue {
	if (typeof value === 'string') return validateModel(value)
	return (
		(PANEL_ROLES.has(role) || POOL_ROLES.has(role)) &&
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((model) => typeof model === 'string' && validateModel(model))
	)
}

export function storedModelMap(value: unknown): ModelMap {
	if (!isRecord(value)) return {}
	const result: ModelMap = {}
	const legacy = value['feature-refactoring']
	const legacyModel =
		typeof legacy === 'string' && validateModel(legacy)
			? legacy
			: Array.isArray(legacy) &&
				legacy.length > 0 &&
				typeof legacy[0] === 'string' &&
				validateModel(legacy[0])
				? legacy[0]
				: undefined
	if (legacyModel) {
		result.feature = legacyModel
		result.refactoring = legacyModel
	}
	for (const [role, model] of Object.entries(value)) {
		if (!isKnownRole(role)) continue
		if (isValidRoleModel(role, model)) result[role] = model
	}
	return result
}

export function validateOverrides(value: unknown): ModelMap {
	if (value === undefined || value === null) {
		throw new Error('Missing overrides. Pass an object of known pstack roles.')
	}
	if (!isRecord(value)) {
		throw new Error('overrides must be an object of known pstack roles.')
	}
	if (Object.keys(value).length === 0) {
		throw new Error('overrides must include at least one known pstack role.')
	}
	const overrides: ModelMap = {}
	for (const [role, model] of Object.entries(value)) {
		if (!isKnownRole(role)) {
			if (role === 'feature-refactoring') {
				throw new Error('feature-refactoring was replaced by separate feature and refactoring roles.')
			}
			throw new Error(`Unknown pstack role: ${role}.`)
		}
		if (!isValidRoleModel(role, model)) {
			throw new Error(`Invalid model for ${role}. Use provider/model or builtin:<mode>.`)
		}
		overrides[role] = model
	}
	return overrides
}

export function mergeModels(stored: unknown): ModelMap {
	return { ...DEFAULT_MODELS, ...storedModelMap(stored) }
}

export function builtinProfile(): ModelMap {
	return Object.fromEntries(
		Object.keys(DEFAULT_MODELS).map((role) => [
			role,
			Array.isArray(DEFAULT_MODELS[role as keyof typeof DEFAULT_MODELS])
				? ['builtin:high', 'builtin:medium', 'builtin:low']
				: 'builtin:medium',
		]),
	)
}

export function namedProfile(profile: string): ModelMap | undefined {
	if (profile === 'cheap') return { ...CHEAP_MODELS }
	if (profile === 'builtin') return builtinProfile()
	if (profile === 'balanced' || profile === 'reset') return { ...DEFAULT_MODELS }
	return undefined
}

export function profileModels(profile: string): ModelMap {
	const named = namedProfile(profile)
	if (!named) throw new Error('profile must be balanced, cheap, builtin, or reset.')
	return named
}

export async function readJsonFile(path: string): Promise<unknown> {
	try {
		const file = Bun.file(path)
		if (!(await file.exists())) return undefined
		return JSON.parse(await file.text())
	} catch {
		return undefined
	}
}

export function fileModelMap(value: unknown): ModelMap {
	if (!isRecord(value)) return {}
	const fromProfile = typeof value.profile === 'string' ? (namedProfile(value.profile) ?? {}) : {}
	const extras = isRecord(value.models)
		? value.models
		: Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'profile' && key !== 'models'))
	return { ...fromProfile, ...storedModelMap(extras) }
}

export function resolveModels(input: {
	pluginFile?: unknown
	userFile?: unknown
	workspaceFile?: unknown
	stored?: unknown
}): ModelMap {
	return {
		...DEFAULT_MODELS,
		...fileModelMap(input.pluginFile),
		...fileModelMap(input.userFile),
		...storedModelMap(input.stored),
		...fileModelMap(input.workspaceFile),
	}
}

export function workspaceRootPath(amp: PluginAPI): string | null {
	const root = amp.system?.workspaceRoot
	if (!root) return null
	return amp.helpers.filePathFromURI(root)
}

export async function loadFileLayers(
	workspaceRoot: string | null,
	userFile = userModelPath(),
	pluginFile = pluginModelPath(),
): Promise<{
	pluginFile: unknown
	userFile: unknown
	workspaceFile: unknown
}> {
	return {
		pluginFile: await readJsonFile(pluginFile),
		userFile: await readJsonFile(userFile),
		workspaceFile: workspaceRoot
			? await readJsonFile(join(workspaceRoot, WORKSPACE_MODEL_FILE))
			: undefined,
	}
}

export function text(value: unknown, name: string): string {
	if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${name}.`)
	return value.trim()
}

export function scopePathsFrom(value: unknown, fallback: string): string[] {
	if (value === undefined || value === null) return [fallback]
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		!value.every((path) => typeof path === 'string' && path.trim())
	) {
		throw new Error('scopePaths must be a non-empty array of paths.')
	}
	return [...new Set(value.map((path) => path.trim()))].sort()
}

export function executorFrom(
	value: unknown,
	parentExecutorKind: ParentExecutorKind = 'unknown',
): DelegateExecutor {
	return executorForParent(value, parentExecutorKind)
}

export function timeoutFrom(value: unknown, options?: { role?: string; floor?: number }): number {
	const parsed = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_TIMEOUT_MS
	const clamped = Math.max(MIN_TIMEOUT_MS, Math.min(parsed, MAX_TIMEOUT_MS))
	const roleFloor = options?.role === 'comment-reviewer' ? COMMENT_REVIEWER_MIN_TIMEOUT_MS : 0
	const floor = Math.max(options?.floor ?? 0, roleFloor)
	return Math.max(floor, clamped)
}

export function formatMessage(message: ThreadMessage): Record<string, unknown> {
	const content = 'content' in message && Array.isArray(message.content) ? message.content : []
	const formatted: Array<Record<string, unknown>> = []
	for (const block of content) {
		if (block.type === 'text') {
			formatted.push({ type: 'text', text: block.text })
		} else if (block.type === 'tool_use') {
			formatted.push({
				type: 'tool_use',
				name: block.name,
				input: block.input,
			})
		} else if (block.type === 'tool_result') {
			formatted.push({
				type: 'tool_result',
				toolUseID: block.toolUseID,
				status: block.status,
				output: block.output,
			})
		}
	}
	return {
		id: message.id,
		role: message.role,
		content: formatted,
	}
}

function toolsFor(role: string) {
	return capabilityFor(role).tools
}

function instructionsFor(role: string): string {
	if (role === 'comment-reviewer') return COMMENT_REVIEWER_INSTRUCTIONS
	if (usesPotetoDelegateWrapper(role)) {
		return `${AGENT_INSTRUCTIONS} ${POTETO_DELEGATE_INSTRUCTIONS} Assigned role: ${role}.`
	}
	return `${AGENT_INSTRUCTIONS} Assigned role: ${role}.`
}

export default async function pstack(amp: PluginAPI) {
	const runtimeStore = new RuntimeStore(
		runtimeStatePath(amp.system.ampURL, amp.system.user?.id ?? null),
	)
	const wakeWebhooks = new WakeWebhookCoordinator(amp, runtimeStore)
	const policy = new WorkflowParityPolicy(
		(parentThreadID, message) => {
			void amp.threads
				.get(parentThreadID as ThreadID)
				.appendUserMessage({ type: 'user-message', content: message }, { steer: true })
				.catch((error: unknown) => {
					amp.logger.log(`Could not notify parent ${parentThreadID}: ${String(error)}`)
				})
		},
		(resourceKey, owner) => {
			if (owner) runtimeStore.saveOwner(owner)
			else runtimeStore.releaseOwner(resourceKey)
		},
		(parentThreadID, run) => {
			if (run) runtimeStore.saveDesignRun(run)
			else runtimeStore.releaseDesignRun(parentThreadID)
		},
	)
	for (const owner of runtimeStore.listOwners()) {
		let thread
		if (owner.state === 'running') {
			try {
				thread = amp.threads.get(owner.threadID as ThreadID)
			} catch (error) {
				amp.logger.log(`Could not reattach owner ${owner.resourceKey}: ${String(error)}`)
			}
		}
		await policy.restoreImplementation(owner, thread)
	}
	for (const run of runtimeStore.listDesignRuns()) {
		await policy.restoreDesign(run, (threadID) => {
			try {
				return amp.threads.get(threadID as ThreadID)
			} catch {
				return undefined
			}
		})
	}
	await wakeWebhooks.restore()
	await Promise.all(SKILL_PATHS.map((path) => amp.registerSkill({ path })))
	let detectedParentExecutor: ParentExecutorKind | undefined

	const parentExecutorKind = async (): Promise<ParentExecutorKind> => {
		if (detectedParentExecutor) return detectedParentExecutor
		const kind = amp.system.executor.kind
		if (kind === 'local') {
			detectedParentExecutor = 'local'
			return detectedParentExecutor
		}
		if (kind === 'unknown') {
			detectedParentExecutor = 'unknown'
			return detectedParentExecutor
		}
		try {
			const lease = await amp.system.executor.keepAlive()
			lease.unsubscribe()
			detectedParentExecutor = 'orb'
		} catch {
			detectedParentExecutor = 'runner'
		}
		return detectedParentExecutor
	}

	const implementationResource = (
		target: LaunchTarget | null,
		parentThreadID: string,
		scope: string,
		scopePaths: readonly string[],
	): ImplementationResource => {
		const workspaceRoot = workspaceRootPath(amp) ?? process.cwd()
		const workspaceKey =
			target?.kind === 'named-runner'
				? `runner:${target.runnerId}:${target.workingDirectory ?? 'default'}`
				: target?.kind === 'current-checkout' || target === null
					? `current:${workspaceRoot}`
					: `isolated:${parentThreadID}:${scope}`
		return {
			workspaceKey,
			scopePaths,
			logicalKey: JSON.stringify(scopePaths),
			resourceKey: JSON.stringify([workspaceKey, scopePaths]),
		}
	}

	const fileLayers = () => loadFileLayers(workspaceRootPath(amp), userModelPath(), pluginModelPath())

	const resolvedFrom = async (stored: unknown): Promise<ModelMap> => {
		return resolveModels({ ...(await fileLayers()), stored })
	}

	const configuredModels = async (): Promise<ModelMap> => {
		const configuration = await amp.configuration.get()
		return resolvedFrom(configuration[CONFIG_KEY])
	}

	const storedOverrides = async (): Promise<ModelMap> => {
		const configuration = await amp.configuration.get()
		return storedModelMap(configuration[CONFIG_KEY])
	}

	const modelFor = async (role: string, parentThread?: Pick<PluginThread, 'agent'>): Promise<string> => {
		const value = (await configuredModels())[role]
		if (POOL_ROLES.has(role) && value !== undefined) {
			const pool = typeof value === 'string' ? [value] : value
			let parentModel: string | undefined
			try {
				const parentAgent = await parentThread?.agent()
				if (parentAgent?.definition.kind === 'agent-definition') {
					parentModel = parentAgent.definition.model
				}
			} catch {}
			return selectPoolModel(pool, parentModel)
		}
		if (!PANEL_ROLES.has(role) && typeof value === 'string') return value
		throw new Error(`Unknown pstack role: ${role}. ${ROLE_GUIDANCE}`)
	}

	const panelFor = async (panel: string): Promise<string[]> => {
		if (!PANEL_ROLES.has(panel)) throw new Error(`Unknown pstack panel: ${panel}`)
		const value = (await configuredModels())[panel]
		if (Array.isArray(value) && value.length > 0) return value
		if (typeof value === 'string') return [value]
		throw new Error(`Unknown pstack panel: ${panel}`)
	}

	const reasoningFor = (model: string): AgentReasoningEffort | undefined => {
		for (const [known, effort] of Object.entries(MODEL_REASONING_EFFORT)) {
			if (known === model) return effort
		}
		return undefined
	}

	const lastAssistantText = (message: { content?: unknown }): string => {
		const content = Array.isArray(message.content) ? message.content : []
		return content
			.filter((block): block is { type: string; text: string } => {
				return (
					typeof block === 'object' &&
					block !== null &&
					'type' in block &&
					block.type === 'text' &&
					'text' in block &&
					typeof block.text === 'string'
				)
			})
			.map((block) => block.text)
			.join('\n')
			.trim()
	}

	const agentFor = (model: string, role: string): Agent => {
		const builtin = model.match(BUILTIN_MODE)
		if (builtin) {
			return amp.createAgent({
				extends: builtin[1] as BuiltinAgentMode,
				instructions: instructionsFor(role),
				tools: toolsFor(role),
				display: { label: role.slice(0, 24) },
			})
		}
		return amp.createAgent({
			extends: 'medium',
			model: model as PluginAgentModel,
			instructions: instructionsFor(role),
			tools: toolsFor(role),
			reasoningEffort: reasoningFor(model),
			display: { label: role.slice(0, 24) },
		})
	}

	type RegisteredOrbAgent = { agent: Agent; subscription: Subscription }
	const orbAgents = new Map<string, RegisteredOrbAgent>()

	const orbAgentIdentity = (model: string, role: string): string => {
		return JSON.stringify([role, model])
	}

	const registerOrbAgent = (model: string, role: string): Agent => {
		const identity = orbAgentIdentity(model, role)
		const registered = orbAgents.get(identity)
		if (registered) return registered.agent
		const agent = agentFor(model, role)
		const mode = orbAgentModeFor(role, model)
		const subscription = amp.registerAgentMode({ ...mode, agent: agent.definition })
		orbAgents.set(identity, { agent, subscription })
		return agent
	}

	const orbAgentFor = (model: string, role: string): Agent => {
		const registered = orbAgents.get(orbAgentIdentity(model, role))
		if (!registered) throw new Error(ORB_MODE_RELOAD_ERROR)
		return registered.agent
	}

	const startupModels = await configuredModels().catch(async (error: unknown) => {
		amp.logger.log(
			`Could not read Amp configuration while registering orb modes; using file layers: ${String(error)}`,
		)
		return resolvedFrom(undefined)
	})
	for (const spec of orbAgentSpecsFor(startupModels)) {
		registerOrbAgent(spec.model, spec.role)
	}

	const createAgentThread = (input: {
		model: string
		role: string
		parentThreadID: ThreadID
		executor: DelegateExecutor
	}) => {
		const agent =
			input.executor === 'orb' || typeof input.executor === 'object'
				? orbAgentFor(input.model, input.role)
				: agentFor(input.model, input.role)
		return agent.createThread({
			parentThreadID: input.parentThreadID,
			executor: input.executor,
		})
	}

	const runOnThread = async (input: {
		model: string
		role: string
		prompt: string
		parentThreadID: ThreadID
		executor: ReturnType<typeof executorFrom>
		timeoutMs: number
		onThread?: (
			thread: Awaited<ReturnType<typeof createAgentThread>>,
		) => Promise<void>
	}): Promise<{ threadID: string; text: string; status: 'done' | 'timeout' | 'error' }> => {
		const thread = await createAgentThread(input)
		if (input.onThread) {
			await input.onThread(thread)
		} else if (isStrictReadonlyRole(input.role)) {
			await policy.trackReadonly(thread, input.role, input.parentThreadID)
		}
		try {
			await thread.appendUserMessage({ type: 'user-message', content: input.prompt })
		} catch (error) {
			if (input.onThread) {
				policy.untrack(thread.id)
				policy.recordCandidateResult(input.parentThreadID, thread.id, 'error')
			}
			if (isStrictReadonlyRole(input.role)) policy.untrack(thread.id)
			throw error
		}
		try {
			const reply = await thread.waitForResponse({ timeoutMs: input.timeoutMs })
			return { threadID: thread.id, text: lastAssistantText(reply), status: 'done' }
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error)
			const state = await thread.state.get().catch(() => 'unavailable' as const)
			if (state !== 'running' && state !== 'awaiting-approval') {
				return {
					threadID: thread.id,
					status: 'error',
					text: `Agent response failed while child thread ${thread.id} was ${state}. ${detail}`,
				}
			}
			return {
				threadID: thread.id,
				status: 'timeout',
				text: `Timed out waiting for agent response after ${input.timeoutMs}ms. Child thread ${thread.id} is still the owner of this work. Read that thread and use its report. Do not redo the delegated work in the parent. ${detail}`,
			}
		}
	}

	amp.registerTool({
		name: 'pstack_run_agent',
		title: 'Run pstack delegate',
		transcriptGroup: { active: 'Running pstack delegate', complete: 'Ran pstack delegate' },
		description:
			'Run one configured pstack role in a child Amp thread and wait for its report. Use only when this turn has nothing else to do and needs one result, such as comment-reviewer. Prefer pstack_start_agent for feature, how, bug-fix, and other long work. Local parents default to local; orb parents default to orb and reject executor local because it cannot target the parent orb filesystem. Always returns threadID. On timeout the child remains the owner; read that thread instead of redoing the work. Roles include feature, refactoring, bug-fix, and comment-reviewer.',
		inputSchema: {
			type: 'object',
			properties: {
				role: { type: 'string', description: ROLE_GUIDANCE },
				prompt: { type: 'string', description: 'Complete standalone task brief.' },
				executor: {
					oneOf: [
						{ type: 'string', enum: ['local', 'orb'] },
						{
							type: 'object',
							properties: {
								type: { type: 'string', enum: ['runner'] },
								id: { type: 'string' },
							},
							required: ['type', 'id'],
						},
					],
				},
				timeoutMs: { type: 'number' },
			},
			required: ['role', 'prompt'],
		},
		async execute(input, ctx) {
			const role = text(input.role, 'role')
			if (isImplementationRole(role)) throw new Error(IMPLEMENTATION_BLOCKING_ERROR)
			const prompt = text(input.prompt, 'prompt')
			const model = await modelFor(role, ctx.thread)
			const timeoutMs = timeoutFrom(input.timeoutMs, { role, floor: RUN_AGENT_MIN_TIMEOUT_MS })
			const executor = executorFrom(input.executor, await parentExecutorKind())
			if (typeof executor === 'object') {
				throw new Error(
					'Named runner delegation cannot use blocking pstack_run_agent because Amp forbids recursive plugin-agent runner creation. Use pstack_start_agent with launchTarget named-runner, then call the returned native create_thread redirect.',
				)
			}
			const result = await runOnThread({
				model,
				role,
				prompt,
				parentThreadID: ctx.thread.id,
				executor,
				timeoutMs,
			})
			return JSON.stringify({ role, model, timeoutMs, ...result })
		},
	})

	amp.registerTool({
		name: 'pstack_run_panel',
		title: 'Run pstack panel',
		transcriptGroup: { active: 'Running pstack panel', complete: 'Ran pstack panel' },
		description:
			'Run the same standalone brief concurrently across every model configured for a pstack panel. Each seat is a child thread. Local parents default to local; orb parents default to orb and reject executor local because it cannot target the parent orb filesystem. Returns threadID even when a seat times out so the parent can read that thread instead of redoing the work.',
		inputSchema: {
			type: 'object',
			properties: {
				panel: { type: 'string', description: 'Configured pstack panel.' },
				prompt: { type: 'string', description: 'Complete standalone task brief.' },
				executor: {
					oneOf: [
						{ type: 'string', enum: ['local', 'orb'] },
						{
							type: 'object',
							properties: {
								type: { type: 'string', enum: ['runner'] },
								id: { type: 'string' },
							},
							required: ['type', 'id'],
						},
					],
				},
				timeoutMs: { type: 'number' },
			},
			required: ['panel', 'prompt'],
		},
		async execute(input, ctx) {
			const panel = text(input.panel, 'panel')
			const prompt = text(input.prompt, 'prompt')
			const models = await panelFor(panel)
			const timeoutMs = timeoutFrom(input.timeoutMs, { floor: RUN_AGENT_MIN_TIMEOUT_MS })
			const executor = executorFrom(input.executor, await parentExecutorKind())
			if (typeof executor === 'object') {
				throw new Error(
					'Named runner panels cannot use blocking pstack_run_panel because Amp forbids recursive plugin-agent runner creation. Start runner seats with pstack_start_agent named-runner redirects and aggregate their reports in the parent.',
				)
			}
			if (isDesignPanel(panel)) policy.beginDesign(ctx.thread.id, panel)
			const settled = await Promise.allSettled(
				models.map(async (model, index) => {
					const role = `${panel}-${index + 1}`
					const result = await runOnThread({
						model,
						role,
						prompt,
						parentThreadID: ctx.thread.id,
						executor,
						timeoutMs,
						onThread: isDesignPanel(panel)
							? (thread) => policy.trackCandidate(ctx.thread.id, thread, role)
							: undefined,
					})
					if (isDesignPanel(panel)) {
						policy.recordCandidateResult(ctx.thread.id, result.threadID, result.status)
					}
					return { label: role, model, timeoutMs, ...result }
				}),
			)
			if (isDesignPanel(panel)) policy.finishCandidateLaunch(ctx.thread.id)
			return JSON.stringify(
				settled.map((result, index) =>
					result.status === 'fulfilled'
						? result.value
						: { status: 'error', model: models[index], error: String(result.reason) },
				),
			)
		},
	})

	amp.registerTool({
		name: 'pstack_start_agent',
		title: 'Start pstack background agent',
		transcriptGroup: { active: 'Starting pstack agent', complete: 'Started pstack agent' },
		description:
			'Start a durable background pstack agent in a child thread and return immediately. Default for feature, how, bug-fix, and other long work. Implementation roles require a non-empty scope. Local parents default implementation to current-checkout; orb parents and explicit executor orb use a fresh parent-project-orb. current-checkout is rejected from an orb parent because it cannot share that orb filesystem. repo-independent-orb is for work that does not depend on a checkout. native-orb requires a project and redirects to Amp create_thread for project, orb size, or custom mode. The child exclusively owns its delegated scope and reports with pstack_send_to_thread (steer defaults on). Continue independent parent work, then end the turn when blocked on the child. Never use wait_for_threads to judge startup, redo the scope, or replace a live child.',
		inputSchema: {
			type: 'object',
			properties: {
				role: { type: 'string', description: ROLE_GUIDANCE },
				prompt: { type: 'string' },
				scope: { type: 'string' },
				scopePaths: {
					type: 'array',
					items: { type: 'string' },
					description: 'Concrete paths exclusively owned by this implementation.',
				},
				executor: {
					oneOf: [
						{ type: 'string', enum: ['local', 'orb'] },
						{
							type: 'object',
							properties: {
								type: { type: 'string', enum: ['runner'] },
								id: { type: 'string' },
							},
							required: ['type', 'id'],
						},
					],
				},
				launchTarget: {
					type: 'object',
					properties: {
						kind: {
							type: 'string',
							enum: [
								'current-checkout',
								'parent-project-orb',
								'repo-independent-orb',
								'named-runner',
								'native-orb',
							],
						},
						runnerId: { type: 'string', description: 'Required for named-runner.' },
						workingDirectory: {
							type: 'string',
							description:
								'Optional absolute directory served by the named runner.',
						},
						project: { type: 'string', description: 'Required for native-orb.' },
						orbSize: { type: 'string', enum: ['a1.tiny', 'a1.small', 'a1.medium', 'a1.large', 'a1.xxlarge'] },
						agentMode: { type: 'string' },
						cloudBaseBranch: { type: 'string' },
					},
				},
				cloudBaseBranch: { type: 'string' },
			},
			required: ['role', 'prompt'],
		},
		async execute(input, ctx) {
			const role = text(input.role, 'role')
			const prompt = text(input.prompt, 'prompt')
			const implementation = isImplementationRole(role)
			const scope = implementation
				? text(input.scope, 'scope')
				: typeof input.scope === 'string'
					? input.scope.trim()
					: ''
			const scopePaths = implementation ? scopePathsFrom(input.scopePaths, scope) : []
			const launchValue =
				input.launchTarget && typeof input.launchTarget === 'object' && !Array.isArray(input.launchTarget)
					? {
							...(input.launchTarget as Record<string, unknown>),
							cloudBaseBranch:
								(input.launchTarget as Record<string, unknown>).cloudBaseBranch ?? input.cloudBaseBranch,
						}
					: typeof input.cloudBaseBranch === 'string'
						? { cloudBaseBranch: input.cloudBaseBranch }
						: input.launchTarget
			const launchTarget = launchTargetForParent(launchValue, {
				implementation,
				parentExecutorKind: await parentExecutorKind(),
				executor: input.executor,
			})
			if (launchTarget?.kind === 'cloud-base-branch') {
				return JSON.stringify(cloudBaseBranchUnsupported(launchTarget.branch))
			}
			const judgeReserved =
				role === 'arena-cross-judge' ? policy.reserveJudge(ctx.thread.id) : false
			const resource = implementation
				? implementationResource(launchTarget, ctx.thread.id, scope, scopePaths)
				: undefined
			let owner: ImplementationOwner | undefined
			if (implementation && resource) {
				const reservation: ImplementationOwner = {
					state: 'reserving',
					parentThreadID: ctx.thread.id,
					role,
					scope,
					resourceKey: resource.resourceKey,
					logicalKey: resource.logicalKey,
					workspaceKey: resource.workspaceKey,
					scopePaths: [...resource.scopePaths],
				}
				runtimeStore.claimOwner(reservation)
				try {
					owner = policy.reserveImplementation(ctx.thread.id, role, scope, resource)
				} catch (error) {
					runtimeStore.releaseOwner(resource.resourceKey)
					throw error
				}
			}
			let judgeStarted = false
			try {
				const model = await modelFor(role, ctx.thread)
				if (launchTarget?.kind === 'native-orb' || launchTarget?.kind === 'named-runner') {
					if (
						launchTarget.kind === 'native-orb' &&
						judgeReserved &&
						launchTarget.agentMode
					) {
						throw new Error(
							'The required arena-cross-judge must use its registered pstack mode; omit agentMode.',
						)
					}
					const mode = orbAgentModeFor(role, model)
					const childPrompt = backgroundChildPrompt(prompt, ctx.thread.id)
					if (launchTarget.kind === 'named-runner') orbAgentFor(model, role)
					else if (!launchTarget.agentMode) orbAgentFor(model, role)
					const redirect =
						launchTarget.kind === 'native-orb'
							? nativeRedirect({
									role,
									model,
									parentThreadID: ctx.thread.id,
									prompt: childPrompt,
									scope,
									modeKey: mode.key,
									target: launchTarget,
								})
							: {
									action: 'use-native-create-thread' as const,
									role,
									model,
									parentThreadID: ctx.thread.id,
									scope: scope || undefined,
									launchTarget,
									create_thread: {
										executor: 'runner' as const,
										runner_id: launchTarget.runnerId,
										working_directory: launchTarget.workingDirectory,
										agent_mode: mode.key,
										prompt: childPrompt,
										intent: 'delegation',
									},
									next:
										'Call native create_thread next with exactly create_thread. Pstack keeps the resource claim until that tool result is paired.',
								}
					const nativeInput = redirect.create_thread as Record<string, unknown>
					if (owner) policy.expectNative(owner.resourceKey, nativeInput)
					else if (judgeReserved) policy.expectNativeJudge(ctx.thread.id, nativeInput)
					return JSON.stringify(redirect)
				}
				const executor =
					launchTarget?.kind === 'parent-project-orb' ||
					launchTarget?.kind === 'repo-independent-orb'
						? 'orb'
						: launchTarget?.kind === 'current-checkout'
							? 'local'
							: executorFrom(input.executor, await parentExecutorKind())
				const thread = await createAgentThread({
					model,
					role,
					parentThreadID: ctx.thread.id,
					executor,
				})
				if (owner) await policy.attachRunning(owner.resourceKey, thread)
				else if (judgeReserved) {
					await policy.startJudge(ctx.thread.id, thread)
					judgeStarted = true
				} else if (isStrictReadonlyRole(role)) {
					await policy.trackReadonly(thread, role, ctx.thread.id)
				}
				try {
					await thread.appendUserMessage({
						type: 'user-message',
						content: backgroundChildPrompt(prompt, ctx.thread.id),
					})
				} catch (error) {
					if (owner) {
						const detail = error instanceof Error ? error.message : String(error)
						throw new Error(
							`Child thread ${thread.id} was created but prompt delivery is uncertain; ownership remains reserved for reconciliation. ${detail}`,
							{ cause: error },
						)
					}
					if (judgeStarted) policy.failJudgeStart(ctx.thread.id)
					else if (isStrictReadonlyRole(role)) policy.untrack(thread.id)
					throw error
				}
				return JSON.stringify({
					role,
					model,
					threadID: thread.id,
					parentThreadID: ctx.thread.id,
					scope: scope || undefined,
					scopePaths: scopePaths.length > 0 ? scopePaths : undefined,
					executor,
					launchTarget,
					next:
						launchTarget?.kind === 'repo-independent-orb'
							? `${START_AGENT_NEXT} This work must not depend on a checkout.`
							: launchTarget?.kind === 'parent-project-orb'
								? `${START_AGENT_NEXT} This fresh orb inherits the parent project, not the parent executor's live filesystem. Required state must exist in the project remote or be transferred explicitly.`
								: START_AGENT_NEXT,
				})
			} catch (error) {
				if (judgeReserved && !judgeStarted) policy.cancelJudgeReservation(ctx.thread.id)
				if (owner) policy.releaseIfReserving(owner.resourceKey)
				throw error
			}
		},
	})

	amp.registerTool({
		name: 'pstack_send_to_thread',
		title: 'Report to pstack thread',
		transcriptGroup: { active: 'Reporting to parent', complete: 'Reported to parent' },
		description:
			'Send a delegate report or steering message to a known Amp thread. steer defaults to true so the parent wakes. Pass false only for a non-waking note.',
		inputSchema: {
			type: 'object',
			properties: {
				threadID: { type: 'string' },
				message: { type: 'string' },
				steer: { type: 'boolean' },
			},
			required: ['threadID', 'message'],
		},
		async execute(input) {
			const threadID = text(input.threadID, 'threadID')
			if (!threadID.startsWith('T-')) throw new Error('Invalid Amp thread ID.')
			await amp.threads.get(threadID as ThreadID).appendUserMessage(
				{ type: 'user-message', content: text(input.message, 'message') },
				{ steer: steerFrom(input.steer) },
			)
			return `Sent report to ${threadID}.`
		},
	})

	amp.registerTool({
		name: 'pstack_read_current_thread',
		title: 'Read current pstack transcript',
		transcriptGroup: { active: 'Reading thread transcript', complete: 'Read thread transcript' },
		description:
			'Read the current Amp thread transcript, including compacted history, for reflection and session handoff workflows. Tool results include toolUseID, status, and output.',
		inputSchema: {
			type: 'object',
			properties: {
				limit: { type: 'number', description: 'Maximum messages, from 1 through 200.' },
			},
			required: [],
		},
		async execute(input, ctx) {
			const limit =
				typeof input.limit === 'number'
					? Math.max(1, Math.min(Math.floor(input.limit), 200))
					: 100
			const messages: ThreadMessage[] = []
			for (let offset = 0; offset < limit; offset += 20) {
				const page = await ctx.thread.messages({
					full: true,
					from: 'end',
					offset,
					limit: Math.min(20, limit - offset),
				})
				messages.unshift(...page)
				if (page.length < Math.min(20, limit - offset)) break
			}
			return JSON.stringify({ threadID: ctx.thread.id, messages: messages.map(formatMessage) })
		},
	})

	amp.registerTool({
		name: 'pstack_configure_models',
		title: 'Configure pstack models',
		transcriptGroup: { active: 'Configuring pstack', complete: 'Configured pstack' },
		description:
			'Show, update, reset, or apply a named profile to the pstack role map. Later wins: plugin defaults, user ~/.config/amp/pstack.models.json, Amp user config from set/profile, then workspace .amp/pstack.models.json. Changes apply to the next local spawn; reload plugins before an orb spawn. cheap avoids Fable and Opus. Unknown actions fail.',
		inputSchema: {
			type: 'object',
			properties: {
				action: { type: 'string', enum: ['show', 'set', 'reset', 'profile'] },
				overrides: { type: 'object' },
				profile: {
					type: 'string',
					enum: ['balanced', 'cheap', 'builtin', 'reset'],
					description: 'Named profile for action profile.',
				},
			},
			required: ['action'],
		},
		async execute(input) {
			const action = text(input.action, 'action')
			if (action === 'reset') {
				await amp.configuration.delete(CONFIG_KEY, 'global')
				return JSON.stringify(await resolvedFrom(undefined), null, 2)
			}
			if (action === 'profile') {
				const profile = text(input.profile, 'profile')
				if (profile === 'reset') {
					await amp.configuration.delete(CONFIG_KEY, 'global')
					return JSON.stringify(await resolvedFrom(undefined), null, 2)
				}
				const next = profileModels(profile)
				await amp.configuration.update({ [CONFIG_KEY]: next }, 'global')
				return JSON.stringify(await resolvedFrom(next), null, 2)
			}
			if (action === 'set') {
				const next = { ...(await storedOverrides()), ...validateOverrides(input.overrides) }
				await amp.configuration.update({ [CONFIG_KEY]: next }, 'global')
				return JSON.stringify(await resolvedFrom(next), null, 2)
			}
			if (action === 'show') {
				return JSON.stringify(await configuredModels(), null, 2)
			}
			throw new Error('action must be show, set, reset, or profile.')
		},
	})

	amp.registerTool({
		name: 'pstack_create_wake_webhook',
		title: 'Create pstack wake webhook',
		transcriptGroup: { active: 'Creating wake webhook', complete: 'Created wake webhook' },
		description:
			'Create an orb-owned wake webhook. Registration intent and event receipts persist on the current executor; delivery is serialized and recovered from structural transcript envelopes.',
		inputSchema: {
			type: 'object',
			properties: {
				key: { type: 'string', description: 'User-facing key namespaced to the owner thread.' },
				instruction: { type: 'string', description: 'Trusted instruction prepended to each event.' },
			},
			required: ['key', 'instruction'],
		},
		async execute(input, ctx) {
			const key = text(input.key, 'key')
			const instruction = text(input.instruction, 'instruction')
			const result = await wakeWebhooks.register({
				ownerThreadID: ctx.thread.id,
				userKey: key,
				instruction,
			})
			await ctx.ui.notify(`Wake webhook URL (credential): ${result.remote.url}`)
			return JSON.stringify({
				ampKey: result.registration.ampKey,
				ownerThreadID: result.registration.ownerThreadID,
				userKey: result.registration.userKey,
				urlShownInUI: true,
			})
		},
	})

	amp.registerCommand(
		'setup-models',
		{
			title: 'Configure model profile',
			category: 'pstack',
			description:
			'Choose a pstack model profile from the command palette. Threads should use pstack_configure_models with action profile instead.',
		},
		async (ctx) => {
			const profile = await ctx.ui.select({
				title: 'Choose a pstack model profile',
				options: [
					'Balanced multi-model defaults',
					'Cheap, no Fable or Opus',
					'Built-in Amp modes',
					'Reset overrides',
				],
			})
			if (!profile) return
			if (profile === 'Reset overrides') {
				await amp.configuration.delete(CONFIG_KEY, 'global')
			} else if (profile === 'Built-in Amp modes') {
				await amp.configuration.update({ [CONFIG_KEY]: builtinProfile() }, 'global')
			} else if (profile === 'Cheap, no Fable or Opus') {
				await amp.configuration.update({ [CONFIG_KEY]: { ...CHEAP_MODELS } }, 'global')
			} else {
				await amp.configuration.update({ [CONFIG_KEY]: { ...DEFAULT_MODELS } }, 'global')
			}
			await ctx.ui.notify(`pstack profile set to ${profile}.`)
		},
	)

	if (typeof amp.on === 'function') {
		amp.on('tool.call', (event) => {
			const modified = amp.helpers?.filesModifiedByToolCall?.(event) ?? null
			const files = modified?.map((uri) => amp.helpers.filePathFromURI(uri)) ?? null
			return policy.onToolCall(event, files)
		})
		amp.on('tool.result', (event) => {
			return policy.onToolResult(event, (threadID) => {
				try {
					return amp.threads.get(threadID as ThreadID)
				} catch {
					return undefined
				}
			})
		})
		amp.on('agent.end', (_event, ctx) => {
			return policy.onAgentEnd(ctx.thread.id)
		})
	}
	amp.onDispose(async () => {
		await wakeWebhooks.close()
		for (const registration of orbAgents.values()) registration.subscription.unsubscribe()
		orbAgents.clear()
		const { discarded } = policy.dispose()
		if (discarded > 0) {
			amp.logger.log(
				`Discarding ${discarded} process-local subscriptions on plugin reload; durable owner and design state remains in the runtime journal.`,
			)
		}
		runtimeStore.close()
	})
}
