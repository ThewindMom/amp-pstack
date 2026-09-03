import { homedir } from 'node:os'
import { join } from 'node:path'

import type {
	Agent,
	AgentReasoningEffort,
	BuiltinAgentMode,
	PluginAgentModel,
	PluginAPI,
	ThreadID,
	ThreadMessage,
} from '@ampcode/plugin'

export const description =
	'Ports pstack to Amp with 45 workflow skills, the poteto mode, configurable multi-model delegates, background threads, transcript tools, and wake webhooks.'

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
	'feature-refactoring': 'xai/grok-4.6',
	'bug-fix': 'anthropic/claude-fable-5-1',
	'perf-issue': 'anthropic/claude-fable-5-1',
	hillclimb: 'anthropic/claude-fable-5-1',
	judgment: 'anthropic/claude-fable-5-1',
	'how-explorer': 'xai/grok-4.6',
	'how-explainer': 'anthropic/claude-fable-5-1',
	'why-investigator': 'xai/grok-4.6',
	'why-synthesizer': 'anthropic/claude-fable-5-1',
	'reflect-tooling': 'openai/gpt-5.6-sol',
	'reflect-judgment': 'anthropic/claude-fable-5-1',
	'swarm-worker': 'xai/grok-4.6',
	'comment-reviewer': 'anthropic/claude-fable-5-1',
	'how-critics': [
		'anthropic/claude-fable-5-1',
		'openai/gpt-5.6-sol',
		'xai/grok-4.6',
		'anthropic/claude-opus-5',
	],
	'arena-runners': [
		'anthropic/claude-fable-5-1',
		'openai/gpt-5.6-sol',
		'xai/grok-4.6',
		'anthropic/claude-opus-5',
	],
	'arena-cross-judge': ['anthropic/claude-opus-5'],
	'architect-runners': [
		'anthropic/claude-fable-5-1',
		'openai/gpt-5.6-sol',
		'xai/grok-4.6',
		'anthropic/claude-opus-5',
	],
	'interrogate-reviewers': [
		'anthropic/claude-fable-5-1',
		'openai/gpt-5.6-sol',
		'xai/grok-4.6',
		'anthropic/claude-opus-5',
	],
} as const

export const ROLE_ALIASES = {
	feature: 'feature-refactoring',
	refactoring: 'feature-refactoring',
} as const

export const CHEAP_MODELS = {
	'feature-refactoring': 'xai/grok-4.6',
	'bug-fix': 'openai/gpt-5.6-sol',
	'perf-issue': 'openai/gpt-5.6-sol',
	hillclimb: 'openai/gpt-5.6-sol',
	judgment: 'xai/grok-4.6',
	'how-explorer': 'xai/grok-4.6',
	'how-explainer': 'xai/grok-4.6',
	'why-investigator': 'xai/grok-4.6',
	'why-synthesizer': 'xai/grok-4.6',
	'reflect-tooling': 'openai/gpt-5.6-sol',
	'reflect-judgment': 'xai/grok-4.6',
	'swarm-worker': 'xai/grok-4.6',
	'comment-reviewer': 'xai/grok-4.6',
	'how-critics': ['xai/grok-4.6', 'openai/gpt-5.6-sol'],
	'arena-runners': ['xai/grok-4.6', 'openai/gpt-5.6-sol'],
	'arena-cross-judge': ['openai/gpt-5.6-sol'],
	'architect-runners': ['xai/grok-4.6', 'openai/gpt-5.6-sol'],
	'interrogate-reviewers': ['xai/grok-4.6', 'openai/gpt-5.6-sol'],
} as const

export const MODEL_PROFILES = ['balanced', 'cheap', 'builtin', 'reset'] as const
export type ModelProfileName = (typeof MODEL_PROFILES)[number]

export const WORKSPACE_MODEL_FILE = '.amp/pstack.models.json'
export const USER_MODEL_FILE = join(homedir(), '.config', 'amp', 'pstack.models.json')
export const PLUGIN_MODEL_FILE = join(import.meta.dir, 'pstack.models.json')

export function userModelPath(): string {
	return process.env.PSTACK_USER_MODEL_FILE ?? USER_MODEL_FILE
}

export function pluginModelPath(): string {
	return process.env.PSTACK_PLUGIN_MODEL_FILE ?? PLUGIN_MODEL_FILE
}

export const CONFIG_KEY = 'pstack.models'
export const WEBHOOK_EVENT_IDS_KEY = 'pstack.webhookEventIds'
export const MAX_WEBHOOK_EVENT_IDS = 500
export const WRITE_TOOLS = ['apply_patch', 'create_file', 'edit_file'] as const
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

type ModelValue = string | string[]
export type ModelMap = Record<string, ModelValue>
type Executor = 'local' | 'orb'

const BUILTIN_MODE = /^builtin:(low|medium|high|ultra)$/
const MODEL_ID = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9._-]+)*$/i
const KNOWN_ROLES = new Set(Object.keys(DEFAULT_MODELS))

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
		'If this child is an orb or the artifact is large, write the file and cite the path for download_thread_file instead of pasting it.',
	].join('\n')
}

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

export function isKnownRole(role: string): boolean {
	return KNOWN_ROLES.has(role)
}

export function resolveRole(role: string): string {
	return ROLE_ALIASES[role as keyof typeof ROLE_ALIASES] ?? role
}

export function storedModelMap(value: unknown): ModelMap {
	const raw = modelMapFrom(value)
	const result: ModelMap = {}
	for (const [role, model] of Object.entries(raw)) {
		if (!isKnownRole(role)) continue
		const values = Array.isArray(model) ? model : [model]
		if (values.every(validateModel)) result[role] = model
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
	const overrides = modelMapFrom(value)
	if (Object.keys(overrides).length === 0) {
		throw new Error('overrides must include at least one known pstack role.')
	}
	for (const [role, model] of Object.entries(overrides)) {
		if (!isKnownRole(role)) {
			throw new Error(`Unknown pstack role: ${role}.`)
		}
		const values = Array.isArray(model) ? model : [model]
		if (!values.every(validateModel)) {
			throw new Error(`Invalid model for ${role}. Use provider/model or builtin:<mode>.`)
		}
	}
	for (const key of Object.keys(value)) {
		if (!isKnownRole(key)) throw new Error(`Unknown pstack role: ${key}.`)
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

export function executorFrom(value: unknown): Executor {
	if (value === undefined || value === null || value === '') return 'local'
	if (value === 'orb' || value === 'local') return value
	throw new Error('executor must be local or orb.')
}

export function timeoutFrom(value: unknown, options?: { role?: string; floor?: number }): number {
	const parsed = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_TIMEOUT_MS
	const clamped = Math.max(MIN_TIMEOUT_MS, Math.min(parsed, MAX_TIMEOUT_MS))
	const roleFloor =
		resolveRole(options?.role ?? '') === 'comment-reviewer' ? COMMENT_REVIEWER_MIN_TIMEOUT_MS : 0
	const floor = Math.max(options?.floor ?? 0, roleFloor)
	return Math.max(floor, clamped)
}

export function formatMessage(message: ThreadMessage): Record<string, unknown> {
	const content = 'content' in message && Array.isArray(message.content) ? message.content : []
	return {
		id: message.id,
		role: message.role,
		content: content.flatMap((block) => {
			if (block.type === 'text') return [{ type: 'text', text: block.text }]
			if (block.type === 'tool_use') {
				return [{ type: 'tool_use', name: block.name, input: block.input }]
			}
			if (block.type === 'tool_result') {
				return [
					{
						type: 'tool_result',
						toolUseID: block.toolUseID,
						status: block.status,
						output: block.output,
					},
				]
			}
			return []
		}),
	}
}

export function claimedWebhookIds(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

export function claimWebhookEvent(
	seen: unknown,
	eventId: string,
): { duplicate: boolean; next: string[] } {
	const ids = claimedWebhookIds(seen)
	if (ids.includes(eventId)) return { duplicate: true, next: ids }
	const next = [...ids, eventId]
	if (next.length > MAX_WEBHOOK_EVENT_IDS) {
		next.splice(0, next.length - MAX_WEBHOOK_EVENT_IDS)
	}
	return { duplicate: false, next }
}

export function webhookEventMarker(eventId: string): string {
	return `Webhook event ID: ${eventId}`
}

export function messageMentionsWebhookEvent(message: ThreadMessage, eventId: string): boolean {
	const marker = webhookEventMarker(eventId)
	const content = 'content' in message && Array.isArray(message.content) ? message.content : []
	return content.some((block) => block.type === 'text' && block.text.includes(marker))
}

export type WebhookDeliveryPlan =
	| { action: 'skip'; reason: 'recorded' | 'already-appended'; next: string[] }
	| { action: 'append'; next: string[] }

export function planWebhookDelivery(
	seen: unknown,
	eventId: string,
	threadHasEvent: boolean,
): WebhookDeliveryPlan {
	const recorded = claimWebhookEvent(seen, eventId)
	if (recorded.duplicate) return { action: 'skip', reason: 'recorded', next: recorded.next }
	if (threadHasEvent) return { action: 'skip', reason: 'already-appended', next: recorded.next }
	return { action: 'append', next: recorded.next }
}

function toolsFor(role: string): 'all' | { exclude: readonly string[] } {
	if (role === 'comment-reviewer') return { exclude: COMMENT_REVIEWER_EXCLUDED_TOOLS }
	return 'all'
}

function instructionsFor(role: string): string {
	if (role === 'comment-reviewer') return COMMENT_REVIEWER_INSTRUCTIONS
	return `${AGENT_INSTRUCTIONS} Assigned role: ${role}.`
}

export default async function pstack(amp: PluginAPI) {
	await Promise.all(SKILL_PATHS.map((path) => amp.registerSkill({ path })))

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

	const modelFor = async (role: string): Promise<string> => {
		const resolved = resolveRole(role)
		const value = (await configuredModels())[resolved]
		if (typeof value === 'string') return value
		if (Array.isArray(value) && value.length > 0) return value[0]
		throw new Error(`Unknown pstack role: ${role}`)
	}

	const panelFor = async (panel: string): Promise<string[]> => {
		const value = (await configuredModels())[panel]
		if (Array.isArray(value) && value.length > 0) return value
		if (typeof value === 'string') return [value]
		throw new Error(`Unknown pstack panel: ${panel}`)
	}

	const reasoningFor = (model: string): AgentReasoningEffort | undefined => {
		if (model.startsWith('xai/grok-4.6')) return 'high'
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

	const runOnThread = async (input: {
		agent: Agent
		prompt: string
		parentThreadID: ThreadID
		executor: ReturnType<typeof executorFrom>
		timeoutMs: number
	}): Promise<{ threadID: string; text: string; status: 'done' | 'timeout' }> => {
		const thread = await input.agent.createThread({
			parentThreadID: input.parentThreadID,
			executor: input.executor,
		})
		await thread.appendUserMessage({ type: 'user-message', content: input.prompt })
		try {
			const reply = await thread.waitForResponse({ timeoutMs: input.timeoutMs })
			return { threadID: thread.id, text: lastAssistantText(reply), status: 'done' }
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error)
			return {
				threadID: thread.id,
				status: 'timeout',
				text: `Timed out waiting for agent response after ${input.timeoutMs}ms. Child thread ${thread.id} is still the owner of this work. Read that thread and use its report. Do not redo the delegated work in the parent. ${detail}`,
			}
		}
	}

	const agentFor = (model: string, role: string): Agent => {
		const builtin = model.match(BUILTIN_MODE)
		const resolved = resolveRole(role)
		if (builtin) {
			return amp.createAgent({
				extends: builtin[1] as BuiltinAgentMode,
				instructions: instructionsFor(resolved),
				tools: toolsFor(resolved),
				display: { label: resolved.slice(0, 24) },
			})
		}
		return amp.createAgent({
			extends: 'medium',
			model: model as PluginAgentModel,
			instructions: instructionsFor(resolved),
			tools: toolsFor(resolved),
			reasoningEffort: reasoningFor(model),
			display: { label: resolved.slice(0, 24) },
		})
	}

	amp.registerTool({
		name: 'pstack_run_agent',
		title: 'Run pstack delegate',
		transcriptGroup: { active: 'Running pstack delegate', complete: 'Ran pstack delegate' },
		description:
			'Run one configured pstack role in a child Amp thread and wait for its report. Use only when this turn has nothing else to do and needs one result, such as comment-reviewer. Prefer pstack_start_agent for feature, how, bug-fix, and other long work. Always returns threadID. On timeout the child remains the owner; read that thread instead of redoing the work. Roles include feature-refactoring, bug-fix, and comment-reviewer. feature and refactoring resolve to feature-refactoring.',
		inputSchema: {
			type: 'object',
			properties: {
				role: { type: 'string', description: 'Configured pstack role.' },
				prompt: { type: 'string', description: 'Complete standalone task brief.' },
				executor: { type: 'string', enum: ['local', 'orb'] },
				timeoutMs: { type: 'number' },
			},
			required: ['role', 'prompt'],
		},
		async execute(input, ctx) {
			const role = resolveRole(text(input.role, 'role'))
			const prompt = text(input.prompt, 'prompt')
			const model = await modelFor(role)
			const timeoutMs = timeoutFrom(input.timeoutMs, { role, floor: RUN_AGENT_MIN_TIMEOUT_MS })
			const result = await runOnThread({
				agent: agentFor(model, role),
				prompt,
				parentThreadID: ctx.thread.id,
				executor: executorFrom(input.executor),
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
			'Run the same standalone brief concurrently across every model configured for a pstack panel. Each seat is a child thread. Returns threadID even when a seat times out so the parent can read that thread instead of redoing the work.',
		inputSchema: {
			type: 'object',
			properties: {
				panel: { type: 'string', description: 'Configured pstack panel.' },
				prompt: { type: 'string', description: 'Complete standalone task brief.' },
				executor: { type: 'string', enum: ['local', 'orb'] },
				timeoutMs: { type: 'number' },
			},
			required: ['panel', 'prompt'],
		},
		async execute(input, ctx) {
			const panel = text(input.panel, 'panel')
			const prompt = text(input.prompt, 'prompt')
			const models = await panelFor(panel)
			const timeoutMs = timeoutFrom(input.timeoutMs, { floor: RUN_AGENT_MIN_TIMEOUT_MS })
			const settled = await Promise.allSettled(
				models.map(async (model, index) => {
					const result = await runOnThread({
						agent: agentFor(model, `${panel}-${index + 1}`),
						prompt,
						parentThreadID: ctx.thread.id,
						executor: executorFrom(input.executor),
						timeoutMs,
					})
					return { label: `${panel}-${index + 1}`, model, timeoutMs, ...result }
				}),
			)
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
			'Start a durable background pstack agent in a child thread and return immediately. Default for feature, how, bug-fix, and other long work. The child reports with pstack_send_to_thread (steer defaults on). Parent joins with wait_for_threads or by ending the turn. Do not redo the child\'s scope.',
		inputSchema: {
			type: 'object',
			properties: {
				role: { type: 'string' },
				prompt: { type: 'string' },
				executor: { type: 'string', enum: ['local', 'orb'] },
			},
			required: ['role', 'prompt'],
		},
		async execute(input, ctx) {
			const role = resolveRole(text(input.role, 'role'))
			const model = await modelFor(role)
			const thread = await agentFor(model, role).createThread({
				parentThreadID: ctx.thread.id,
				executor: executorFrom(input.executor),
			})
			await thread.appendUserMessage({
				type: 'user-message',
				content: backgroundChildPrompt(text(input.prompt, 'prompt'), ctx.thread.id),
			})
			return JSON.stringify({ role, model, threadID: thread.id, parentThreadID: ctx.thread.id })
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
			'Show, update, reset, or apply a named profile to the pstack role map. Later wins: plugin defaults, user ~/.config/amp/pstack.models.json, Amp user config from set/profile, then workspace .amp/pstack.models.json. cheap avoids Fable and Opus. Unknown actions fail.',
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
			'Create a durable capability webhook for the owning orb thread. Each event ID is claimed in plugin configuration before a wake message is appended, so retries do not duplicate work.',
		inputSchema: {
			type: 'object',
			properties: {
				key: { type: 'string', description: 'Stable webhook key within this thread.' },
				instruction: { type: 'string', description: 'Trusted instruction prepended to each event.' },
			},
			required: ['key', 'instruction'],
		},
		async execute(input) {
			const key = text(input.key, 'key')
			const instruction = text(input.instruction, 'instruction')
			const registration = await amp.createWebhook({
				key,
				handler: async (event, ctx) => {
					const configuration = await amp.configuration.get()
					const seen = configuration[WEBHOOK_EVENT_IDS_KEY]
					let threadHasEvent = false
					if (!claimWebhookEvent(seen, event.id).duplicate) {
						const page = await ctx.thread.messages({
							full: true,
							from: 'end',
							limit: 50,
						})
						threadHasEvent = page.some((message) =>
							messageMentionsWebhookEvent(message, event.id),
						)
					}
					const plan = planWebhookDelivery(seen, event.id, threadHasEvent)
					if (plan.action === 'skip') {
						if (plan.reason === 'already-appended') {
							await amp.configuration.update(
								{ [WEBHOOK_EVENT_IDS_KEY]: plan.next },
								'global',
							)
						}
						ctx.logger.log(`Skipping duplicate webhook event ${event.id}`)
						return
					}
					const body = new TextDecoder().decode(event.body)
					await ctx.thread.appendUserMessage({
						type: 'user-message',
						content: `${instruction}\n\n${webhookEventMarker(event.id)}. Duplicate deliveries are dropped after this append is visible in the thread.\nReceived: ${event.receivedAt}\nPayload:\n${body}`,
					})
					await amp.configuration.update({ [WEBHOOK_EVENT_IDS_KEY]: plan.next }, 'global')
				},
			})
			return `Webhook created. Treat this URL as a credential: ${registration.url}`
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
}
