// @amp-agent-mode {"key":"pstack-hardest","label":"pstack-hardest"}
// @amp-agent-mode {"key":"pstack-feature","label":"pstack-feature"}
// @amp-agent-mode {"key":"pstack-refactoring","label":"pstack-refactoring"}
// @amp-agent-mode {"key":"pstack-bug-fix","label":"pstack-bug-fix"}
// @amp-agent-mode {"key":"pstack-perf-issue","label":"pstack-perf-issue"}
// @amp-agent-mode {"key":"pstack-hillclimb","label":"pstack-hillclimb"}
// @amp-agent-mode {"key":"pstack-judgment","label":"pstack-judgment"}
// @amp-agent-mode {"key":"pstack-how-explorer","label":"pstack-how-explorer"}
// @amp-agent-mode {"key":"pstack-how-explainer","label":"pstack-how-explainer"}
// @amp-agent-mode {"key":"pstack-why-investigator","label":"pstack-why-investigator"}
// @amp-agent-mode {"key":"pstack-why-synthesizer","label":"pstack-why-synthesizer"}
// @amp-agent-mode {"key":"pstack-reflect-tooling","label":"pstack-reflect-tooling"}
// @amp-agent-mode {"key":"pstack-reflect-judgment","label":"pstack-reflect-judgment"}
// @amp-agent-mode {"key":"pstack-reflect-divergent","label":"pstack-reflect-divergent"}
// @amp-agent-mode {"key":"pstack-reflect-synth","label":"pstack-reflect-synth"}
// @amp-agent-mode {"key":"pstack-swarm-worker","label":"pstack-swarm-worker"}
// @amp-agent-mode {"key":"pstack-comment-reviewer","label":"pstack-comment-reviewer"}
// @amp-agent-mode {"key":"pstack-cross-judge-1","label":"pstack-cross-judge-1"}
// @amp-agent-mode {"key":"pstack-cross-judge-2","label":"pstack-cross-judge-2"}
// @amp-agent-mode {"key":"pstack-cross-judge-3","label":"pstack-cross-judge-3"}

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
import {
	CODE_IMPLEMENTATION_ROLES,
	WRITE_TOOLS,
	WorkflowParityPolicy,
	capabilityFor,
	cloudBaseBranchUnsupported,
	exactCreateThreadInputMatches,
	executorForParent,
	isDesignPanel,
	isImplementationRole,
	isResearchRole,
	isStrictReadonlyRole,
	launchTargetForParent,
	nativeRedirect,
	threadIDFromCreateThreadResult,
	type DelegateExecutor,
	type ImplementationOwner,
	type ImplementationResource,
	type LaunchTarget,
	type ParentExecutorKind,
} from './workflow-parity'

export {
	ARBITRARY_SHELL_GAP,
	CODE_IMPLEMENTATION_ROLES,
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
	'Ports pstack to Amp with 47 workflow skills, the poteto mode, configurable multi-model delegates, background threads, and transcript tools.'

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
	hardest: 'anthropic/claude-opus-5-5',
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
	'anthropic/claude-opus-5-5': 'max',
	'openai/gpt-6-sol': 'max',
	'xai/grok-4.7': 'xhigh',
} as const satisfies Record<string, AgentReasoningEffort>

const ROLE_GUIDANCE = `Configured delegate role, not a skill or workflow name. Valid roles: ${Object.keys(DEFAULT_MODELS).join(', ')}. how is a workflow, not a role: use how-explorer for investigation or how-explainer for explanation. These strict read-only roles cannot run shell commands or tests. Use judgment for reviews requiring test execution; its no-code-change restriction must be stated in the brief and is not a sandbox.`

export const CHEAP_MODELS = {
	hardest: 'openai/gpt-5.6-sol',
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
export const MAX_PANEL_COUNT = 20

export type Seat = Readonly<{ model: string; effort?: AgentReasoningEffort }>
type SeatInput = string | Seat
type ModelValue = SeatInput | readonly SeatInput[]
export type ModelMap = Record<string, ModelValue>

export type ResolvedAgentSpec = Readonly<{
	role: string
	model: string
	effort?: AgentReasoningEffort
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

export const MAX_NATIVE_JUDGE_SEATS = 3

export type NativeAgentMode = Readonly<{
	role: keyof typeof DEFAULT_MODELS
	seat?: number
	key: string
	label: string
}>

export const NATIVE_AGENT_MODES: readonly NativeAgentMode[] = [
	{ role: 'hardest', key: 'pstack-hardest', label: 'pstack-hardest' },
	{ role: 'feature', key: 'pstack-feature', label: 'pstack-feature' },
	{ role: 'refactoring', key: 'pstack-refactoring', label: 'pstack-refactoring' },
	{ role: 'bug-fix', key: 'pstack-bug-fix', label: 'pstack-bug-fix' },
	{ role: 'perf-issue', key: 'pstack-perf-issue', label: 'pstack-perf-issue' },
	{ role: 'hillclimb', key: 'pstack-hillclimb', label: 'pstack-hillclimb' },
	{ role: 'judgment', key: 'pstack-judgment', label: 'pstack-judgment' },
	{ role: 'how-explorer', key: 'pstack-how-explorer', label: 'pstack-how-explorer' },
	{ role: 'how-explainer', key: 'pstack-how-explainer', label: 'pstack-how-explainer' },
	{ role: 'why-investigator', key: 'pstack-why-investigator', label: 'pstack-why-investigator' },
	{ role: 'why-synthesizer', key: 'pstack-why-synthesizer', label: 'pstack-why-synthesizer' },
	{ role: 'reflect-tooling', key: 'pstack-reflect-tooling', label: 'pstack-reflect-tooling' },
	{ role: 'reflect-judgment', key: 'pstack-reflect-judgment', label: 'pstack-reflect-judgment' },
	{ role: 'reflect-divergent', key: 'pstack-reflect-divergent', label: 'pstack-reflect-divergent' },
	{ role: 'reflect-synthesizer', key: 'pstack-reflect-synth', label: 'pstack-reflect-synth' },
	{ role: 'swarm-worker', key: 'pstack-swarm-worker', label: 'pstack-swarm-worker' },
	{ role: 'comment-reviewer', key: 'pstack-comment-reviewer', label: 'pstack-comment-reviewer' },
	...Array.from({ length: MAX_NATIVE_JUDGE_SEATS }, (_, index) => ({
		role: 'arena-cross-judge' as const,
		seat: index + 1,
		key: `pstack-cross-judge-${index + 1}`,
		label: `pstack-cross-judge-${index + 1}`,
	})),
]

const NATIVE_AGENT_MODE_DESCRIPTION =
	'pstack delegate mode used by pstack_start_agent native redirects (native-orb and named-runner). The child resolves the model from its own pstack configuration.'

export function nativeAgentModeFor(role: string, seat?: number): NativeAgentMode {
	const mode = NATIVE_AGENT_MODES.find((entry) => entry.role === role && entry.seat === seat)
	if (mode) return mode
	if (POOL_ROLES.has(role)) {
		throw new Error(
			`arena-cross-judge selected pool seat ${seat}, but native-orb and named-runner redirects support only seats 1-${MAX_NATIVE_JUDGE_SEATS}. Move that model into the first ${MAX_NATIVE_JUDGE_SEATS} arena-cross-judge seats, or use launchTarget parent-project-orb.`,
		)
	}
	throw new Error(`pstack role ${role} has no stable native agent mode.`)
}

export const ORB_MODE_RELOAD_ERROR =
	'Orb agents use the role/model map captured when pstack loaded. Reload plugins, then retry this orb launch. Local launches use configuration changes immediately.'

export function orbAgentModeFor(role: string, model: string, effort?: AgentReasoningEffort): { key: string; label: string } {
	const hasher = new Bun.CryptoHasher('sha256')
	hasher.update(JSON.stringify([role, model, effort ?? MODEL_REASONING_EFFORT[model as keyof typeof MODEL_REASONING_EFFORT]]))
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

export function orbAgentSpecsFor(
	models: ModelMap,
	onInvalid?: (role: string, message: string) => void,
): ResolvedAgentSpec[] {
	return Object.entries(models).flatMap(([role, value]) => {
		const seats = Array.isArray(value) ? value : [value]
		const invalid = seats.find((seat) => !isSeatInput(seat) || seatError(role, seat) !== undefined)
		if (invalid !== undefined) {
			const message = isSeatInput(invalid)
				? seatError(role, invalid)!
				: `Invalid model seat for ${role}. Use a model string or { model, effort }.`
			onInvalid?.(role, message)
			return []
		}
		if (PANEL_ROLES.has(role)) {
			return seats.map((seat, index) => ({ role: `${role}-${index + 1}`, ...resolveSeat(seat) }))
		}
		if (POOL_ROLES.has(role)) {
			const unique = new Map(seats.map((seat) => {
				const resolved = resolveSeat(seat)
				return [JSON.stringify([resolved.model, resolved.effort]), resolved]
			}))
			return [...unique.values()].map((seat) => ({ role, ...seat }))
		}
		if (isSeatInput(value)) return [{ role, ...resolveSeat(value) }]
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
	'A blocked report must name the attempted tool and its tool-call/result status and output. If no call was attempted, say not attempted, not unavailable.',
].join(' ')

export function backgroundChildPrompt(prompt: string, parentThreadID: string, reporting: 'message' | 'final-text' = 'message'): string {
	return [
		prompt,
		'',
		`Parent thread: ${parentThreadID}.`,
		reporting === 'final-text'
			? 'When finished, return a compact report as final text. Do not call send_thread_message; the caller will read the child thread.'
			: 'When finished, use native send_thread_message to send that parent a compact report. If unavailable, return the report as final text; the plugin forwards it.',
		'Report outcome, evidence, blockers, and next action. No file dumps.',
		'Do not spawn another agent for this same scope.',
		'Do not message sibling threads. The parent may steer you mid-run.',
		'If either this child or the parent is an orb, or the artifact is large, write the file and cite the path for download_thread_file instead of pasting it.',
	].join('\n')
}

const BLOCKED_REPORT_PARENT_GUIDANCE =
	'Before treating a blocked report as terminal, inspect the actual child tool-call/result status and output; when the result contradicts the claim, steer that same child instead of replacing it.'

export const START_AGENT_NEXT =
	`The child exclusively owns the delegated scope. Continue only work that is independent of that scope; end this turn when the child blocks further progress. Do not call wait_for_threads to judge startup. Amp reports unknown/settled with an empty transcript while the child is still starting; that is not failure. Do not spawn Task or a second pstack_start_agent for this scope. Never redo or replace a live child. ${BLOCKED_REPORT_PARENT_GUIDANCE} Use native send_thread_message for reports and steering unless reporting final-text was selected; the plugin forwards unreported final text. If you must check later, read_thread; zero messages means not started yet, not dead.`

const COMMENT_REVIEWER_INSTRUCTIONS = [
	AGENT_INSTRUCTIONS,
	'Assigned role: comment-reviewer.',
	'You are a terminal report-only reviewer.',
	'Do not load skills, spawn agents, create threads, or call pstack tools.',
	'Use native send_thread_message only when available and the task prompt asks for a parent report; otherwise return findings as final text for delivery by the caller.',
	'Use Read and finder to inspect the named scope; do not use git or shell commands.',
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
		if (isSeatInput(candidate)) result[role] = candidate
		if (
			Array.isArray(candidate) &&
			candidate.length > 0 &&
			candidate.every(isSeatInput)
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

export function selectPoolModel(
	models: readonly SeatInput[],
	parentModel?: string,
): Omit<ResolvedAgentSpec, 'role'> & { seat: number } {
	if (models.length === 0) throw new Error('A pstack model pool cannot be empty.')
	const seats = models.map(resolveSeat)
	const parentFamily = parentModel ? modelFamily(parentModel) : undefined
	if (parentFamily) {
		const differentFamily = seats.findIndex(({ model }) => {
			const family = modelFamily(model)
			return family !== undefined && family !== parentFamily
		})
		if (differentFamily >= 0) return { ...seats[differentFamily]!, seat: differentFamily + 1 }
	}
	return { ...seats[0]!, seat: 1 }
}

export function isKnownRole(role: string): boolean {
	return KNOWN_ROLES.has(role)
}

const EFFORTS = new Set<AgentReasoningEffort>(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
const KNOWN_EFFORTS: Record<string, ReadonlySet<AgentReasoningEffort>> = {
	'anthropic/claude-opus-5-5': new Set(['low', 'medium', 'high', 'xhigh', 'max']),
	'openai/gpt-6-sol': new Set(['none', 'low', 'medium', 'high', 'xhigh', 'max']),
	'xai/grok-4.7': new Set(['low', 'medium', 'high', 'xhigh']),
}

function isSeatInput(value: unknown): value is SeatInput {
	return typeof value === 'string' || (isRecord(value) && typeof value.model === 'string' &&
		(value.effort === undefined || typeof value.effort === 'string'))
}

function seatError(role: string, seat: SeatInput): string | undefined {
	const { model, effort } = typeof seat === 'string' ? { model: seat, effort: undefined } : seat
	if (!validateModel(model)) return `Invalid model for ${role}: ${model}. Use provider/model or builtin:<mode>.`
	if (model.startsWith('builtin:') && effort !== undefined) return `Invalid effort for ${role}: builtin ${model} cannot carry effort ${effort}.`
	if (effort !== undefined && !EFFORTS.has(effort)) {
		return `Invalid effort for ${role}: ${effort}. Use none, minimal, low, medium, high, xhigh, or max.`
	}
	if (effort !== undefined && KNOWN_EFFORTS[model] && !KNOWN_EFFORTS[model].has(effort)) {
		return `Invalid effort for ${role}: model ${model} does not support effort ${effort}.`
	}
	return undefined
}

function resolveSeat(value: SeatInput): Omit<ResolvedAgentSpec, 'role'> {
	const seat = typeof value === 'string' ? { model: value } : value
	if (seat.model.startsWith('builtin:')) return { model: seat.model }
	return { model: seat.model, effort: seat.effort ?? MODEL_REASONING_EFFORT[seat.model as keyof typeof MODEL_REASONING_EFFORT] }
}

function isValidRoleModel(role: string, value: unknown): value is ModelValue {
	if (isSeatInput(value)) return seatError(role, value) === undefined
	return (
		(PANEL_ROLES.has(role) || POOL_ROLES.has(role)) &&
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((seat) => isSeatInput(seat) && seatError(role, seat) === undefined)
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
		if (isSeatInput(model)) result[role] = model
		else if (
			(PANEL_ROLES.has(role) || POOL_ROLES.has(role)) &&
			Array.isArray(model) &&
			model.length > 0 &&
			model.every(isSeatInput)
		) result[role] = model
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
			const invalid = Array.isArray(model) ? model.find((seat) => !isSeatInput(seat) || seatError(role, seat)) : model
			if (isSeatInput(invalid)) throw new Error(seatError(role, invalid))
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
	return `${AGENT_INSTRUCTIONS} Assigned role: ${role}.`
}

export default async function pstack(amp: PluginAPI) {
	const runtimeStore = new RuntimeStore(
		runtimeStatePath(amp.system.ampURL, amp.system.user?.id ?? null),
	)
	const notificationsInFlight = new Set<Promise<void>>()
	const terminalTranscript = async (threadID: string, parentThreadID: string) => {
		const successfulResults = new Set<string>()
		const reports = new Map<string, string>()
		const codeExecCalls = new Set<string>()
		const nativeReceipts = new Set<string>()
		let lastAssistantText = ''
		let offset = 0
		while (true) {
			const messages = await amp.threads.get(threadID as ThreadID).messages({
				full: true,
				from: 'end',
				limit: 20,
				offset,
			})
			for (const message of [...messages].reverse()) {
				if (!('content' in message) || !Array.isArray(message.content)) continue
				for (const block of message.content) {
					if (block.type === 'tool_result' && block.status === 'done') {
						successfulResults.add(block.toolUseID)
						if (typeof block.output === 'string') {
							try {
								const output: unknown = JSON.parse(block.output)
								if (Array.isArray(output) && output.some((receipt) => isRecord(receipt) &&
									receipt.type === 'amp_builtin_call' && receipt.toolName === 'send_thread_message' && receipt.status === 'done' &&
									isRecord(receipt.result) && receipt.result.threadID === parentThreadID)) nativeReceipts.add(block.toolUseID)
							} catch { /* Ordinary tool output is not a native call receipt. */ }
						}
					} else if (block.type === 'tool_use' && block.name === 'code_exec') {
						codeExecCalls.add(block.id)
					} else if (
						block.type === 'tool_use' &&
						block.name === 'pstack_send_to_thread' &&
						typeof block.id === 'string' &&
						isRecord(block.input) &&
						typeof block.input.threadID === 'string'
					) {
						reports.set(block.id, block.input.threadID)
					}
				}
				if (!lastAssistantText && message.role === 'assistant') {
					lastAssistantText = message.content
						.filter((block) => block.type === 'text')
						.map((block) => block.text)
						.join('\n')
				}
			}
			if (messages.length < 20) break
			offset += messages.length
		}
		return {
			lastAssistantText,
			reportedToParent: [...reports].some(
				([toolUseID, target]) => target === parentThreadID && successfulResults.has(toolUseID),
			) || [...nativeReceipts].some((id) => codeExecCalls.has(id)),
		}
	}
	const notifyUnreportedChild = async (
		threadID: string,
		parentThreadID: string,
		state: 'idle' | 'error',
	): Promise<void> => {
		if (!runtimeStore.claimBackgroundNotification(threadID)) {
			return
		}
		let lastAssistantText = ''
		try {
			const transcript = await terminalTranscript(threadID, parentThreadID)
			lastAssistantText = transcript.lastAssistantText
			if (transcript.reportedToParent) {
				runtimeStore.deleteBackgroundChild(threadID)
				return
			}
		} catch (error) {
			amp.logger.log(`Could not read terminal child ${threadID}: ${String(error)}`)
		}
		const message = `Child ${threadID} reached terminal state ${state} without a successful parent report receipt. Last assistant text: ${lastAssistantText || '(none)'}`
		let notified = false
		await amp.threads
			.get(parentThreadID as ThreadID)
			.appendUserMessage({ type: 'user-message', content: message }, { steer: true })
			.then(() => {
				notified = true
			})
			.catch((error: unknown) => {
				amp.logger.log(`Could not notify parent ${parentThreadID}: ${String(error)}`)
			})
		if (notified) runtimeStore.deleteBackgroundChild(threadID)
		else runtimeStore.releaseBackgroundNotification(threadID)
	}
	const policy = new WorkflowParityPolicy(
		runtimeStore,
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
		(threadID, parentThreadID, state) => {
			const pending = notifyUnreportedChild(threadID, parentThreadID, state)
				.catch((error) => amp.logger.log(`Terminal notification failed for ${threadID}: ${String(error)}`))
				.finally(() => notificationsInFlight.delete(pending))
			notificationsInFlight.add(pending)
		},
		(threadID) => runtimeStore.markBackgroundActive(threadID),
	)
	const restoredOwnerThreadIDs = new Set(
		runtimeStore.listOwners().flatMap((owner) => owner.state === 'running' ? [owner.threadID] : []),
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
		await policy.restoreDesign(
			run,
			(threadID) => {
				try {
					return amp.threads.get(threadID as ThreadID)
				} catch {
					return undefined
				}
			},
			(message) => amp.logger.log(message),
		)
	}
	for (const child of runtimeStore.listBackgroundChildren()) {
		if (restoredOwnerThreadIDs.has(child.threadID)) continue
		if (child.notified) runtimeStore.releaseBackgroundNotification(child.threadID)
		if (policy.child(child.threadID)) continue
		try {
			const thread = amp.threads.get(child.threadID as ThreadID)
			if (isStrictReadonlyRole(child.role)) {
				await policy.trackReadonly(thread, child.role, child.parentThreadID, true, child.active)
			} else {
				await policy.trackBackground(thread, child.role, child.parentThreadID, child.active, true)
			}
		} catch (error) {
			amp.logger.log(`Could not reattach background child ${child.threadID}: ${String(error)}`)
		}
	}
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

	const modelFor = async (
		role: string,
		parentThread?: Pick<PluginThread, 'agent'>,
	): Promise<Omit<ResolvedAgentSpec, 'role'> & { seat?: number }> => {
		const value = (await configuredModels())[role]
		const seats = Array.isArray(value) ? value : value === undefined ? [] : [value]
		const invalid = seats.find((seat) => !isSeatInput(seat) || seatError(role, seat) !== undefined)
		if (invalid !== undefined) {
			throw new Error(isSeatInput(invalid) ? seatError(role, invalid) : `Invalid model seat for ${role}.`)
		}
		if (POOL_ROLES.has(role) && value !== undefined) {
			const pool = Array.isArray(value) ? value : [value]
			let parentModel: string | undefined
			try {
				const parentAgent = await parentThread?.agent()
				if (parentAgent?.definition.kind === 'agent-definition') {
					parentModel = parentAgent.definition.model
				}
			} catch {}
			return selectPoolModel(pool, parentModel)
		}
		if (!PANEL_ROLES.has(role) && isSeatInput(value)) return resolveSeat(value)
		throw new Error(`Unknown pstack role: ${role}. ${ROLE_GUIDANCE}`)
	}

	const panelFor = async (panel: string): Promise<Array<Omit<ResolvedAgentSpec, 'role'>>> => {
		if (!PANEL_ROLES.has(panel)) throw new Error(`Unknown pstack panel: ${panel}`)
		const value = (await configuredModels())[panel]
		const seats = Array.isArray(value) ? value : value === undefined ? [] : [value]
		const invalid = seats.find((seat) => !isSeatInput(seat) || seatError(panel, seat) !== undefined)
		if (invalid !== undefined) {
			throw new Error(isSeatInput(invalid) ? seatError(panel, invalid) : `Invalid model seat for ${panel}.`)
		}
		if (Array.isArray(value) && value.length > 0) return value.map(resolveSeat)
		if (isSeatInput(value)) return [resolveSeat(value)]
		throw new Error(`Unknown pstack panel: ${panel}`)
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

	const agentFor = (model: string, role: string, effort?: AgentReasoningEffort): Agent => {
		const builtin = model.match(BUILTIN_MODE)
		if (builtin) {
			return amp.createAgent({
				extends: builtin[1] as BuiltinAgentMode,
				instructions: instructionsFor(role),
				tools: toolsFor(role),
				display: { label: role.slice(0, 24) },
			})
		}
		const definition = {
			extends: 'medium' as const,
			model: model as PluginAgentModel,
			instructions: instructionsFor(role),
			tools: toolsFor(role),
			display: { label: role.slice(0, 24) },
		}
		return amp.createAgent(effort === undefined ? definition : { ...definition, reasoningEffort: effort })
	}

	type RegisteredOrbAgent = { agent: Agent; subscription: Subscription }
	const orbAgents = new Map<string, RegisteredOrbAgent>()

	const orbAgentIdentity = (model: string, role: string, effort?: AgentReasoningEffort): string => {
		return JSON.stringify([role, model, effort])
	}

	const registerOrbAgent = (model: string, role: string, effort?: AgentReasoningEffort): Agent => {
		const identity = orbAgentIdentity(model, role, effort)
		const registered = orbAgents.get(identity)
		if (registered) return registered.agent
		const agent = agentFor(model, role, effort)
		const mode = orbAgentModeFor(role, model, effort)
		const subscription = amp.registerAgentMode({ ...mode, agent: agent.definition })
		orbAgents.set(identity, { agent, subscription })
		return agent
	}

	const orbAgentFor = (model: string, role: string, effort?: AgentReasoningEffort): Agent => {
		const registered = orbAgents.get(orbAgentIdentity(model, role, effort))
		if (!registered) throw new Error(ORB_MODE_RELOAD_ERROR)
		return registered.agent
	}

	const startupModels = await configuredModels().catch(async (error: unknown) => {
		amp.logger.log(
			`Could not read Amp configuration while registering orb modes; using file layers: ${String(error)}`,
		)
		return resolvedFrom(undefined)
	})
	const startupSpecs = orbAgentSpecsFor(startupModels, (role, message) => {
		amp.logger.log(`Could not register pstack role ${role}: ${message}`)
	})
	for (const spec of startupSpecs) {
		try {
			registerOrbAgent(spec.model, spec.role, spec.effort)
		} catch (error) {
			amp.logger.log(`Could not register pstack seat ${spec.role}/${spec.model}: ${String(error)}`)
		}
	}

	const nativeModes: Subscription[] = []
	for (const mode of NATIVE_AGENT_MODES) {
		try {
			const configured = startupModels[mode.role]
			const valid = isValidRoleModel(mode.role, configured)
			if (!valid) {
				amp.logger.log(`Stable pstack mode ${mode.key} uses the default ${mode.role} seat because the configured seat is invalid.`)
			}
			const value = valid ? configured : DEFAULT_MODELS[mode.role]
			const pool = Array.isArray(value) ? value : [value]
			const { model, effort } = resolveSeat(pool[(mode.seat ?? 1) - 1] ?? pool[0]!)
			nativeModes.push(amp.registerAgentMode({
				key: mode.key,
				label: mode.label,
				description: NATIVE_AGENT_MODE_DESCRIPTION,
				agent: agentFor(model, mode.role, effort).definition,
			}))
		} catch (error) {
			amp.logger.log(`Could not register stable pstack mode ${mode.key}: ${String(error)}`)
		}
	}

	const createAgentThread = async (input: {
		model: string
		effort?: AgentReasoningEffort
		role: string
		prompt: string
		parentThreadID: ThreadID
		executor: DelegateExecutor
	}): Promise<PluginThread> => {
		const agent =
			input.executor === 'orb' || typeof input.executor === 'object'
				? orbAgentFor(input.model, input.role, input.effort)
				: agentFor(input.model, input.role, input.effort)
		return agent.createThread({ parentThreadID: input.parentThreadID, executor: input.executor })
	}

	const runOnThread = async (input: {
		model: string
		effort?: AgentReasoningEffort
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
		name: 'pstack_run_panel',
		title: 'Run pstack panel',
		transcriptGroup: { active: 'Running pstack panel', complete: 'Ran pstack panel' },
		description:
			'Run the same standalone brief concurrently across configured seats of a pstack panel. count optionally cycles those seats in configured order, preserving each seat model and effort. Each candidate has a distinct label and child thread. Local parents default to local; orb parents default to orb and reject executor local because it cannot target the parent orb filesystem. Returns threadID even when a seat times out so the parent can read that thread instead of redoing the work.',
		inputSchema: {
			type: 'object',
			properties: {
				panel: { type: 'string', description: 'Configured pstack panel.' },
				prompt: { type: 'string', description: 'Complete standalone task brief.' },
				count: {
					type: 'integer',
					minimum: 1,
					maximum: MAX_PANEL_COUNT,
					description: `Optional candidate count (1-${MAX_PANEL_COUNT}); configured seats repeat in order.`,
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
				timeoutMs: { type: 'number' },
			},
			required: ['panel', 'prompt'],
		},
		async execute(input, ctx) {
			const panel = text(input.panel, 'panel')
			const prompt = text(input.prompt, 'prompt')
			if (
				input.count !== undefined &&
				(!Number.isInteger(input.count) || Number(input.count) < 1 || Number(input.count) > MAX_PANEL_COUNT)
			) {
				throw new Error(`count must be a positive integer no greater than ${MAX_PANEL_COUNT}.`)
			}
			const configuredSeats = await panelFor(panel)
			const count = input.count === undefined ? configuredSeats.length : Number(input.count)
			const models = Array.from({ length: count }, (_, index) => configuredSeats[index % configuredSeats.length]!)
			const timeoutMs = timeoutFrom(input.timeoutMs, { floor: DEFAULT_TIMEOUT_MS })
			const executor = executorFrom(input.executor, await parentExecutorKind())
			if (typeof executor === 'object') {
				throw new Error(
					'Named runner panels cannot use blocking pstack_run_panel because Amp forbids recursive plugin-agent runner creation. Start runner seats with pstack_start_agent named-runner redirects and aggregate their reports in the parent.',
				)
			}
			if (isDesignPanel(panel)) policy.beginDesign(ctx.thread.id, panel)
			const settled = await Promise.allSettled(
				models.map(async ({ model, effort }, index) => {
					const seatNumber = (index % configuredSeats.length) + 1
					const role = `${panel}-${seatNumber}`
					const label = input.count === undefined ? role : `${panel}-candidate-${index + 1}`
					const candidatePrompt =
						input.count === undefined ? prompt : `${prompt}\n\nCandidate output label: ${label}`
					const result = await runOnThread({
						model,
						effort,
						role,
						prompt: candidatePrompt,
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
					return { label, model, effort, timeoutMs, ...result }
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
			'Start a durable background pstack agent in a child thread and return immediately. Use hardest for the strongest implementation model; all implementation roles require a non-empty scope. Local parents default implementation to current-checkout; orb parents and explicit executor orb use a fresh parent-project-orb. current-checkout is rejected from an orb parent because it cannot share that orb filesystem. repo-independent-orb is for work that does not depend on a checkout. native-orb requires a project and redirects to Amp create_thread for project, orb size, or custom mode. The child exclusively owns its delegated scope and reports with native send_thread_message or final text forwarded by the plugin. Continue independent parent work, then end the turn when blocked on the child. Never use wait_for_threads to judge startup, redo the scope, or replace a live child.',
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
				candidateThreadIDs: {
					type: 'array',
					items: { type: 'string' },
					description:
						'Required for arena-cross-judge: the non-empty unique candidate thread ID set returned by the active design panel.',
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
				reporting: {
					type: 'string',
					enum: ['message', 'final-text'],
					description: 'message asks the child to report to the parent; final-text leaves the report in the child for native read/wait workflows.',
				},
			},
			required: ['role', 'prompt'],
		},
		async execute(input, ctx) {
			const role = text(input.role, 'role')
			const prompt = text(input.prompt, 'prompt')
			const reporting = input.reporting === undefined ? 'message' : text(input.reporting, 'reporting')
			if (reporting !== 'message' && reporting !== 'final-text') throw new Error('reporting must be message or final-text.')
			const candidateThreadIDs = (() => {
				if (role !== 'arena-cross-judge') return []
				if (
					!Array.isArray(input.candidateThreadIDs) ||
					input.candidateThreadIDs.length === 0 ||
					input.candidateThreadIDs.some(
						(value) => typeof value !== 'string' || value.trim().length === 0,
					)
				) {
					throw new Error(
						'arena-cross-judge requires a non-empty candidateThreadIDs array of non-empty strings.',
					)
				}
				const ids = input.candidateThreadIDs.map((value) => String(value).trim())
				if (new Set(ids).size !== ids.length) {
					throw new Error('arena-cross-judge candidateThreadIDs must be unique.')
				}
				return ids
			})()
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
			if (
				launchTarget?.kind === 'native-orb' &&
				launchTarget.agentMode &&
				(isStrictReadonlyRole(role) || isResearchRole(role))
			) {
				throw new Error(
					`Read-only or research role ${role} must use its registered pstack mode on native-orb; omit agentMode. An agentMode override replaces the role tool allowlist or write exclusion, and the parent write hook cannot guard a separate orb.`,
				)
			}
			const judgeReserved =
				role === 'arena-cross-judge'
					? policy.reserveJudge(ctx.thread.id, candidateThreadIDs)
					: false
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
				const { model, effort, seat } = await modelFor(role, ctx.thread)
				if (launchTarget?.kind === 'native-orb' || launchTarget?.kind === 'named-runner') {
					const modeKey = nativeAgentModeFor(role, seat).key
					const childPrompt = backgroundChildPrompt(prompt, ctx.thread.id, reporting)
					const redirectBase =
						launchTarget.kind === 'native-orb'
							? nativeRedirect({
									role,
									model,
									parentThreadID: ctx.thread.id,
									prompt: childPrompt,
									scope,
									modeKey,
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
										agent_mode: modeKey,
										prompt: childPrompt,
										intent: 'delegation',
									},
									next:
										'Call native create_thread next with exactly create_thread. Pstack keeps the resource claim until that tool result is paired.',
								}
					const redirect = {
						...redirectBase,
						next: `${redirectBase.next} ${BLOCKED_REPORT_PARENT_GUIDANCE}`,
					}
					const nativeInput = redirectBase.create_thread as Record<string, unknown>
					if (owner) policy.expectNative(owner.resourceKey, nativeInput)
					else if (judgeReserved) policy.expectNativeJudge(ctx.thread.id, nativeInput)
					else runtimeStore.saveNativeBackgroundReservation({
						parentThreadID: ctx.thread.id,
						role,
						expectedNative: nativeInput,
					})
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
					effort,
					role,
					prompt,
					parentThreadID: ctx.thread.id,
					executor,
				})
				if (!judgeReserved) runtimeStore.saveBackgroundChild(thread.id, ctx.thread.id, role)
				if (owner) await policy.attachRunning(owner.resourceKey, thread)
				else if (judgeReserved) {
					await policy.startJudge(ctx.thread.id, thread)
					judgeStarted = true
				} else if (isStrictReadonlyRole(role)) {
					await policy.trackReadonly(thread, role, ctx.thread.id)
				} else {
					await policy.trackBackground(thread, role, ctx.thread.id)
				}
				try {
					await thread.appendUserMessage({
						type: 'user-message',
						content: backgroundChildPrompt(prompt, ctx.thread.id, reporting),
					})
				} catch (error) {
					if (owner) {
						const detail = error instanceof Error ? error.message : String(error)
						throw new Error(
							`Child thread ${thread.id} was created but prompt delivery is uncertain; ownership remains reserved for reconciliation. ${detail}`,
							{ cause: error },
						)
					}
					const detail = error instanceof Error ? error.message : String(error)
					throw new Error(
						judgeStarted
							? `Judge thread ${thread.id} was created but prompt delivery is uncertain. It remains tracked; do not start a replacement unless it reaches a terminal state. ${detail}`
							: `Child thread ${thread.id} was created but prompt delivery is uncertain. It remains tracked; reconcile that exact child ID with pstack_stop_agent before retrying. ${detail}`,
						{ cause: error },
					)
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
		name: 'pstack_stop_agent',
		title: 'Stop owned pstack agent',
		transcriptGroup: { active: 'Stopping child agent', complete: 'Requested child stop' },
		description:
			'Cancel a tracked pstack child owned by the current parent. Implementation ownership remains claimed until the child reaches idle or error. This also reconciles a non-owner child whose prompt append acknowledgement failed.',
		inputSchema: {
			type: 'object',
			properties: { threadID: { type: 'string' } },
			required: ['threadID'],
		},
		async execute(input, ctx) {
			const threadID = text(input.threadID, 'threadID')
			if (!threadID.startsWith('T-')) throw new Error('Invalid Amp thread ID.')
			const owners = runtimeStore.listOwners()
			const owner = owners.find(
				(candidate) => candidate.state === 'running' && candidate.threadID === threadID,
			)
			if (!owner) {
				const background = runtimeStore.childParent(threadID)
				if (background?.parentThreadID === ctx.thread.id) {
					const child = amp.threads.get(threadID as ThreadID)
					await child.cancel()
					const state = await child.state.get()
					if (state === 'idle' || state === 'error') {
						runtimeStore.deleteBackgroundChild(threadID)
						policy.releaseObserved(threadID, state)
					}
					return JSON.stringify({
						threadID,
						state,
						canceled: true,
						reconciled: state === 'idle' || state === 'error',
					})
				}
				const reservation = owners.find(
					(candidate) => candidate.state === 'reserving' && candidate.parentThreadID === ctx.thread.id,
				)
				if (reservation) {
					throw new Error(
						`Implementation reservation ${reservation.resourceKey} has no paired child thread ID yet and cannot be canceled through this tool. Reconcile the native create_thread result first.`,
					)
				}
				throw new Error(`Thread ${threadID} is not a paired implementation child.`)
			}
			if (owner.parentThreadID !== ctx.thread.id) {
				throw new Error(`Thread ${threadID} is owned by a different parent.`)
			}
			const child = amp.threads.get(threadID as ThreadID)
			await child.cancel()
			const state = await child.state.get()
			if (state === 'idle' || state === 'error') {
				runtimeStore.deleteBackgroundChild(threadID)
				policy.releaseObserved(threadID, state)
				return JSON.stringify({ threadID, state, canceled: true, ownershipReleased: true })
			}
			return JSON.stringify({
				threadID,
				state,
				canceled: true,
				ownershipReleased: false,
				next: 'Cancellation is asynchronous. The ownership claim remains until the observed child state is idle or error.',
			})
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
				offset: { type: 'number', description: 'Zero-based offset from the oldest message.' },
				limit: { type: 'number', description: 'Maximum messages, from 1 through 200.' },
			},
			required: [],
		},
		async execute(input, ctx) {
			const requestedOffset =
				typeof input.offset === 'number' && Number.isFinite(input.offset)
					? Math.max(0, Math.floor(input.offset))
					: 0
			const limit =
				typeof input.limit === 'number' && Number.isFinite(input.limit)
					? Math.max(1, Math.min(Math.floor(input.limit), 200))
					: 100
			const messages: ThreadMessage[] = []
			let total = 0
			for (let offset = 0; ; offset += 20) {
				const page = await ctx.thread.messages({
					full: true,
					from: 'start',
					offset,
					limit: 20,
				})
				for (let index = 0; index < page.length; index += 1) {
					const position = offset + index
					if (position >= requestedOffset && position < requestedOffset + limit) {
						messages.push(page[index])
					}
				}
				total += page.length
				if (page.length < 20) break
			}
			return JSON.stringify({
				threadID: ctx.thread.id,
				offset: requestedOffset,
				limit,
				total,
				truncated: requestedOffset > 0 || requestedOffset + messages.length < total,
				messages: messages.map(formatMessage),
			})
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
			if (event.tool === 'create_thread' && event.toolUseID) {
				const reservation = runtimeStore.listNativeBackgroundReservations().find(
					(candidate) =>
						candidate.parentThreadID === event.thread.id &&
						!candidate.toolUseID &&
						exactCreateThreadInputMatches(event.input, candidate.expectedNative),
				)
				if (reservation) runtimeStore.setNativeBackgroundToolUse(reservation.reservationID, event.toolUseID)
			}
			const modified = amp.helpers?.filesModifiedByToolCall?.(event) ?? null
			const files = modified?.map((uri) => amp.helpers.filePathFromURI(uri)) ?? null
			return policy.onToolCall(event, files)
		})
		amp.on('tool.result', async (event) => {
			if (event.tool === 'create_thread' && event.toolUseID) {
				const reservation = runtimeStore.listNativeBackgroundReservations().find(
					(candidate) => candidate.parentThreadID === event.thread.id && candidate.toolUseID === event.toolUseID,
				)
				if (reservation) {
					runtimeStore.deleteNativeBackgroundReservation(reservation.reservationID)
					if (!event.status || event.status === 'done') {
						const threadID = threadIDFromCreateThreadResult(event.output)
						let thread
						try {
							thread = threadID ? amp.threads.get(threadID as ThreadID) : undefined
						} catch {
							thread = undefined
						}
						if (thread?.state?.subscribe) {
							runtimeStore.saveBackgroundChild(thread.id, reservation.parentThreadID, reservation.role)
							if (isStrictReadonlyRole(reservation.role)) {
								await policy.trackReadonly(thread, reservation.role, reservation.parentThreadID, true)
							} else {
								await policy.trackBackground(thread, reservation.role, reservation.parentThreadID, false, true)
							}
						}
					}
				}
			}
			return policy.onToolResult(
				event,
				(threadID) => {
					try {
						return amp.threads.get(threadID as ThreadID)
					} catch {
						return undefined
					}
				},
				(threadID, parentThreadID, role) => runtimeStore.saveBackgroundChild(threadID, parentThreadID, role),
			)
		})
		amp.on('agent.end', (_event, ctx) => {
			return policy.onAgentEnd(ctx.thread.id)
		})
	}
	amp.onDispose(async () => {
		for (const registration of orbAgents.values()) registration.subscription.unsubscribe()
		orbAgents.clear()
		for (const subscription of nativeModes.splice(0)) subscription.unsubscribe()
		const { discarded } = policy.dispose()
		await Promise.allSettled([...notificationsInFlight])
		if (discarded > 0) {
			amp.logger.log(
				`Discarding ${discarded} process-local subscriptions on plugin reload; durable owner and design state remains in the runtime journal.`,
			)
		}
		runtimeStore.close()
	})
}
