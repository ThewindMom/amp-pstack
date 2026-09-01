// @amp-agent-mode {"key":"poteto","label":"poteto"}

import type {
	Agent,
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
	'bug-fix': 'openai/gpt-5.6-sol',
	'perf-issue': 'openai/gpt-5.6-sol',
	hillclimb: 'openai/gpt-5.6-sol',
	judgment: 'anthropic/claude-fable-5',
	'hardest-tasks': 'anthropic/claude-fable-5',
	'how-explorer': 'xai/grok-4.6',
	'how-explainer': 'anthropic/claude-fable-5',
	'why-investigator': 'xai/grok-4.6',
	'why-synthesizer': 'anthropic/claude-fable-5',
	'reflect-tooling': 'openai/gpt-5.6-sol',
	'reflect-judgment': 'anthropic/claude-fable-5',
	'swarm-worker': 'xai/grok-4.6',
	'comment-reviewer': 'anthropic/claude-fable-5',
	'how-critics': [
		'anthropic/claude-fable-5',
		'openai/gpt-5.6-sol',
		'xai/grok-4.6',
		'anthropic/claude-opus-5',
	],
	'arena-runners': [
		'anthropic/claude-fable-5',
		'openai/gpt-5.6-sol',
		'xai/grok-4.6',
		'anthropic/claude-opus-5',
	],
	'arena-cross-judge': ['anthropic/claude-opus-5'],
	'architect-runners': [
		'anthropic/claude-fable-5',
		'openai/gpt-5.6-sol',
		'xai/grok-4.6',
		'anthropic/claude-opus-5',
	],
	'interrogate-reviewers': [
		'anthropic/claude-fable-5',
		'openai/gpt-5.6-sol',
		'xai/grok-4.6',
		'anthropic/claude-opus-5',
	],
} as const

type ModelValue = string | string[]
type ModelMap = Record<string, ModelValue>
type Executor = 'local' | 'orb'

const CONFIG_KEY = 'pstack.models'
const BUILTIN_MODE = /^builtin:(low|medium|high|ultra)$/
const MODEL_ID = /^[a-z0-9-]+\/.+$/i

const AGENT_INSTRUCTIONS = [
	'You are a pstack delegate running in Amp.',
	'Follow the caller’s exact scope and return compact, evidenced results.',
	'Use available tools directly rather than guessing.',
	'Do not push, merge, deploy, publish, delete shared data, or perform other external writes unless the user explicitly authorized that action.',
	'When editing, verify the result and report files changed, checks run, blockers, and the next action.',
].join(' ')

const POTETO_INSTRUCTIONS = [
	'For every nontrivial task, load the pstack:poteto-mode skill before acting and follow its matched playbook.',
	'Load referenced pstack skills when their trigger applies.',
	'Use pstack agent and panel tools when model diversity or isolated context materially improves the result.',
	'Use Amp child threads and orbs for durable background work, and schedules for work that must wake later.',
].join(' ')

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function modelMapFrom(value: unknown): ModelMap {
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

function validateModel(value: string): boolean {
	return BUILTIN_MODE.test(value) || MODEL_ID.test(value)
}

function validateOverrides(value: unknown): ModelMap {
	const overrides = modelMapFrom(value)
	for (const [role, model] of Object.entries(overrides)) {
		const values = Array.isArray(model) ? model : [model]
		if (!values.every(validateModel)) {
			throw new Error(`Invalid model for ${role}. Use provider/model or builtin:<mode>.`)
		}
	}
	return overrides
}

function text(value: unknown, name: string): string {
	if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${name}.`)
	return value.trim()
}

function executorFrom(value: unknown): Executor {
	return value === 'orb' ? 'orb' : 'local'
}

function timeoutFrom(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return 10 * 60 * 1000
	return Math.max(30_000, Math.min(value, 60 * 60 * 1000))
}

function formatMessage(message: ThreadMessage): Record<string, unknown> {
	return {
		id: message.id,
		role: message.role,
		content: message.content.flatMap((block) => {
			if (block.type === 'text') return [{ type: 'text', text: block.text }]
			if (block.type === 'tool_use') {
				return [{ type: 'tool_use', name: block.name, input: block.input }]
			}
			if (block.type === 'tool_result') {
				return [{ type: 'tool_result', status: block.status }]
			}
			return []
		}),
	}
}

export default async function pstack(amp: PluginAPI) {
	await Promise.all(SKILL_PATHS.map((path) => amp.registerSkill({ path })))

	const configuredModels = async (): Promise<ModelMap> => {
		const configuration = await amp.configuration.get()
		return {
			...DEFAULT_MODELS,
			...modelMapFrom(configuration[CONFIG_KEY]),
		}
	}

	const modelFor = async (role: string): Promise<string> => {
		const value = (await configuredModels())[role]
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

	const agentFor = (model: string, role: string): Agent => {
		const builtin = model.match(BUILTIN_MODE)
		if (builtin) return amp.getBuiltinAgent(builtin[1] as 'low' | 'medium' | 'high' | 'ultra')
		return amp.createAgent({
			extends: 'medium',
			model: model as PluginAgentModel,
			instructions: `${AGENT_INSTRUCTIONS} Assigned role: ${role}.`,
			tools: 'all',
			display: { label: role.slice(0, 24) },
		})
	}

	const poteto = amp.createAgent({
		extends: 'medium',
		instructions: POTETO_INSTRUCTIONS,
		tools: 'all',
		display: { label: 'poteto', color: '#eab308' },
	})

	amp.registerAgentMode({
		key: 'poteto',
		label: 'poteto',
		description:
			'Routes rigorous engineering work through pstack playbooks, multi-model delegates, evidence-first verification, and Amp threads or orbs.',
		color: '#eab308',
		agent: poteto.definition,
	})

	amp.registerTool({
		name: 'pstack_run_agent',
		title: 'Run pstack delegate',
		transcriptGroup: { active: 'Running pstack delegate', complete: 'Ran pstack delegate' },
		description:
			'Run one configured pstack role in an isolated agent thread and return its final report. Use local execution for the current checkout and orb execution for independent remote work.',
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
			const role = text(input.role, 'role')
			const prompt = text(input.prompt, 'prompt')
			const model = await modelFor(role)
			const result = await agentFor(model, role).run(prompt, {
				parentThreadID: ctx.thread.id,
				executor: executorFrom(input.executor),
				timeoutMs: timeoutFrom(input.timeoutMs),
			})
			return JSON.stringify({ role, model, threadID: result.threadID, text: result.text })
		},
	})

	amp.registerTool({
		name: 'pstack_run_panel',
		title: 'Run pstack panel',
		transcriptGroup: { active: 'Running pstack panel', complete: 'Ran pstack panel' },
		description:
			'Run the same standalone brief concurrently across every model configured for a pstack panel. Returns one labeled result per model for parent synthesis.',
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
			const settled = await Promise.allSettled(
				models.map(async (model, index) => {
					const result = await agentFor(model, `${panel}-${index + 1}`).run(prompt, {
						parentThreadID: ctx.thread.id,
						executor: executorFrom(input.executor),
						timeoutMs: timeoutFrom(input.timeoutMs),
					})
					return { label: `${panel}-${index + 1}`, model, ...result }
				}),
			)
			return JSON.stringify(
				settled.map((result, index) =>
					result.status === 'fulfilled'
						? { status: 'done', ...result.value }
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
			'Start a durable background pstack agent in a child thread. The agent must report back with pstack_send_to_thread when the parent needs its result.',
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
			const role = text(input.role, 'role')
			const model = await modelFor(role)
			const thread = await agentFor(model, role).createThread({
				parentThreadID: ctx.thread.id,
				executor: executorFrom(input.executor),
			})
			await thread.appendUserMessage({
				type: 'user-message',
				content: `${text(input.prompt, 'prompt')}\n\nParent thread: ${ctx.thread.id}. When finished, call pstack_send_to_thread with that thread ID and your compact report.`,
			})
			return JSON.stringify({ role, model, threadID: thread.id, parentThreadID: ctx.thread.id })
		},
	})

	amp.registerTool({
		name: 'pstack_send_to_thread',
		title: 'Report to pstack thread',
		transcriptGroup: { active: 'Reporting to parent', complete: 'Reported to parent' },
		description: 'Send a delegate report or steering message to a known Amp thread.',
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
				{ steer: input.steer === true },
			)
			return `Sent report to ${threadID}.`
		},
	})

	amp.registerTool({
		name: 'pstack_read_current_thread',
		title: 'Read current pstack transcript',
		transcriptGroup: { active: 'Reading thread transcript', complete: 'Read thread transcript' },
		description:
			'Read the current Amp thread transcript, including compacted history, for reflection and session handoff workflows.',
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
			'Show, update, or reset the global pstack role and panel model map. Values are provider/model, builtin:<mode>, or arrays for panels.',
		inputSchema: {
			type: 'object',
			properties: {
				action: { type: 'string', enum: ['show', 'set', 'reset'] },
				overrides: { type: 'object' },
			},
			required: ['action'],
		},
		async execute(input) {
			const action = text(input.action, 'action')
			if (action === 'reset') {
				await amp.configuration.delete(CONFIG_KEY, 'global')
				return JSON.stringify(DEFAULT_MODELS, null, 2)
			}
			if (action === 'set') {
				const current = await configuredModels()
				const next = { ...current, ...validateOverrides(input.overrides) }
				await amp.configuration.update({ [CONFIG_KEY]: next }, 'global')
				return JSON.stringify(next, null, 2)
			}
			return JSON.stringify(await configuredModels(), null, 2)
		},
	})

	amp.registerTool({
		name: 'pstack_create_wake_webhook',
		title: 'Create pstack wake webhook',
		transcriptGroup: { active: 'Creating wake webhook', complete: 'Created wake webhook' },
		description:
			'Create a durable capability webhook for the owning orb thread. Each delivery appends an idempotency-keyed user message that wakes the thread.',
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
					const body = new TextDecoder().decode(event.body)
					await ctx.thread.appendUserMessage({
						type: 'user-message',
						content: `${instruction}\n\nWebhook event ID: ${event.id}. Deliveries are at least once; ignore this event if its ID was already handled.\nReceived: ${event.receivedAt}\nPayload:\n${body}`,
					})
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
			description: 'Choose a pstack model profile. Fine-grained overrides use pstack:setup-pstack.',
		},
		async (ctx) => {
			const profile = await ctx.ui.select({
				title: 'Choose a pstack model profile',
				options: ['Balanced multi-model defaults', 'Built-in Amp modes', 'Reset overrides'],
			})
			if (!profile) return
			if (profile === 'Reset overrides') {
				await amp.configuration.delete(CONFIG_KEY, 'global')
			} else if (profile === 'Built-in Amp modes') {
				const builtins = Object.fromEntries(
					Object.keys(DEFAULT_MODELS).map((role) => [
						role,
						Array.isArray(DEFAULT_MODELS[role as keyof typeof DEFAULT_MODELS])
							? ['builtin:high', 'builtin:medium', 'builtin:low']
							: 'builtin:medium',
					]),
				)
				await amp.configuration.update({ [CONFIG_KEY]: builtins }, 'global')
			} else {
				await amp.configuration.update({ [CONFIG_KEY]: DEFAULT_MODELS }, 'global')
			}
			await ctx.ui.notify(`pstack profile set to ${profile}.`)
		},
	)
}
