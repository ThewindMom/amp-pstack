import { describe, expect, test } from 'bun:test'

import pstack, {
	AGENT_INSTRUCTIONS,
	COMMENT_REVIEWER_EXCLUDED_TOOLS,
	CONFIG_KEY,
	DEFAULT_MODELS,
	MAX_WEBHOOK_EVENT_IDS,
	ROLE_ALIASES,
	SKILL_PATHS,
	WEBHOOK_EVENT_IDS_KEY,
	WRITE_TOOLS,
	claimWebhookEvent,
	description,
	executorFrom,
	formatMessage,
	mergeModels,
	planWebhookDelivery,
	resolveRole,
	storedModelMap,
	validateModel,
	validateOverrides,
	webhookEventMarker,
} from './index'

describe('amp-pstack plugin', () => {
	test('declares every bundled skill once', () => {
		expect(SKILL_PATHS).toHaveLength(45)
		expect(new Set(SKILL_PATHS).size).toBe(SKILL_PATHS.length)
		expect(SKILL_PATHS).toContain('skills/poteto-mode')
	})

	test('bundled skills have Amp-compatible frontmatter', async () => {
		for (const path of SKILL_PATHS) {
			const body = await Bun.file(`${path}/SKILL.md`).text()
			const expectedName = path.split('/').at(-1)
			expect(body).toStartWith('---\n')
			expect(body).toContain(`\nname: ${expectedName}\n`)
			expect(body).toMatch(/\ndescription: .+\n/)
			expect(body).not.toContain('disable-model-invocation:')
		}
	})

	test('has multi-model role and panel defaults', () => {
		expect(DEFAULT_MODELS['bug-fix']).toBe('openai/gpt-5.6-sol')
		expect(DEFAULT_MODELS['arena-runners']).toHaveLength(4)
		expect(description.length).toBeLessThanOrEqual(300)
		expect(ROLE_ALIASES.feature).toBe('feature-refactoring')
		expect(ROLE_ALIASES.refactoring).toBe('feature-refactoring')
	})

	test('registers skills, mode, tools, and setup command', async () => {
		const skills: string[] = []
		const tools: string[] = []
		const commands: string[] = []
		const modes: string[] = []
		const agent = {
			definition: { kind: 'agent-definition', model: 'test/model', instructions: '' },
		}
		const amp = {
			registerSkill: async ({ path }: { path: string }) => {
				skills.push(path)
				return { unsubscribe() {} }
			},
			createAgent: () => agent,
			getBuiltinAgent: () => agent,
			registerAgentMode: ({ key }: { key: string }) => {
				modes.push(key)
				return { unsubscribe() {} }
			},
			registerTool: ({ name }: { name: string }) => {
				tools.push(name)
				return { unsubscribe() {} }
			},
			registerCommand: (id: string) => {
				commands.push(id)
				return { unsubscribe() {}, setAvailability() {} }
			},
			configuration: { get: async () => ({}) },
		} as never

		await pstack(amp)

		expect(skills).toEqual([...SKILL_PATHS])
		expect(modes).toEqual(['poteto'])
		expect(tools).toEqual([
			'pstack_run_agent',
			'pstack_run_panel',
			'pstack_start_agent',
			'pstack_send_to_thread',
			'pstack_read_current_thread',
			'pstack_configure_models',
			'pstack_create_wake_webhook',
		])
		expect(commands).toEqual(['setup-models'])
	})
})

describe('transcript formatting', () => {
	test('keeps tool-result output and toolUseID', () => {
		const formatted = formatMessage({
			id: 'm1',
			role: 'user',
			content: [
				{ type: 'text', text: 'check the command' },
				{
					type: 'tool_result',
					toolUseID: 'call-1',
					status: 'done',
					output: 'git diff --stat\n index.ts | 12 +',
				},
			],
		} as never)

		expect(formatted).toEqual({
			id: 'm1',
			role: 'user',
			content: [
				{ type: 'text', text: 'check the command' },
				{
					type: 'tool_result',
					toolUseID: 'call-1',
					status: 'done',
					output: 'git diff --stat\n index.ts | 12 +',
				},
			],
		})
	})
})

describe('model configuration', () => {
	test('accepts builtin modes and provider ids', () => {
		expect(validateModel('builtin:medium')).toBe(true)
		expect(validateModel('xai/grok-4.6')).toBe(true)
		expect(validateModel('fireworks-ai/accounts/fireworks/models/kimi-k3')).toBe(true)
		expect(validateModel('not-a-model')).toBe(false)
		expect(validateModel('inherit-parent')).toBe(false)
	})

	test('rejects unknown roles and invalid models on set', () => {
		expect(() => validateOverrides({ feature: 'xai/grok-4.6' })).toThrow('Unknown pstack role')
		expect(() => validateOverrides({ 'bug-fix': 'not-a-model' })).toThrow('Invalid model')
		expect(() => validateOverrides(undefined)).toThrow('Missing overrides')
		expect(validateOverrides({ 'bug-fix': 'openai/gpt-5.6-sol' })).toEqual({
			'bug-fix': 'openai/gpt-5.6-sol',
		})
	})

	test('drops unknown stored keys and invalid values, then fills defaults', () => {
		expect(
			storedModelMap({
				'bug-fix': 'openai/gpt-5.6-sol',
				mystery: 'xai/grok-4.6',
				hillclimb: 'nope',
			}),
		).toEqual({ 'bug-fix': 'openai/gpt-5.6-sol' })
		expect(mergeModels({ 'bug-fix': 'anthropic/claude-fable-5' })['bug-fix']).toBe(
			'anthropic/claude-fable-5',
		)
		expect(mergeModels({ 'bug-fix': 'anthropic/claude-fable-5' }).hillclimb).toBe(
			DEFAULT_MODELS.hillclimb,
		)
	})

	test('feature and refactoring resolve to one runtime role', () => {
		expect(resolveRole('feature')).toBe('feature-refactoring')
		expect(resolveRole('refactoring')).toBe('feature-refactoring')
		expect(resolveRole('bug-fix')).toBe('bug-fix')
	})

	test('rejects unknown executors instead of coercing them', () => {
		expect(executorFrom(undefined)).toBe('local')
		expect(executorFrom('orb')).toBe('orb')
		expect(() => executorFrom('cloud')).toThrow('executor must be local or orb')
	})
})

describe('webhook event claiming', () => {
	test('drops duplicate event ids', () => {
		const first = claimWebhookEvent([], 'evt-1')
		expect(first.duplicate).toBe(false)
		const second = claimWebhookEvent(first.next, 'evt-1')
		expect(second.duplicate).toBe(true)
		expect(second.next).toEqual(['evt-1'])
	})

	test('caps retained event ids', () => {
		const seen = Array.from({ length: MAX_WEBHOOK_EVENT_IDS }, (_, i) => `evt-${i}`)
		const claimed = claimWebhookEvent(seen, 'evt-new')
		expect(claimed.duplicate).toBe(false)
		expect(claimed.next).toHaveLength(MAX_WEBHOOK_EVENT_IDS)
		expect(claimed.next.at(0)).toBe('evt-1')
		expect(claimed.next.at(-1)).toBe('evt-new')
	})

	test('appends first, records after, and heals a crash between append and record', () => {
		expect(planWebhookDelivery([], 'evt-1', false)).toEqual({
			action: 'append',
			next: ['evt-1'],
		})
		expect(planWebhookDelivery(['evt-1'], 'evt-1', true)).toEqual({
			action: 'skip',
			reason: 'recorded',
			next: ['evt-1'],
		})
		expect(planWebhookDelivery([], 'evt-1', true)).toEqual({
			action: 'skip',
			reason: 'already-appended',
			next: ['evt-1'],
		})
	})
})

describe('runtime tool behavior', () => {
	const tool = (amp: { tools: Map<string, { execute: Function }> }, name: string) => {
		const found = amp.tools.get(name)
		if (!found) throw new Error(`missing ${name}`)
		return found
	}

	async function loadPlugin() {
		const created: Array<Record<string, unknown>> = []
		const config: Record<string, unknown> = {}
		const tools = new Map<string, { execute: Function }>()
		let webhookHandler: ((event: unknown, ctx: unknown) => Promise<void>) | undefined
		const amp = {
			tools,
			created,
			config,
			get webhookHandler() {
				return webhookHandler
			},
			registerSkill: async () => ({ unsubscribe() {} }),
			createAgent: (definition: Record<string, unknown>) => {
				created.push(definition)
				return {
					definition,
					async run(prompt: string) {
						return { threadID: 'T-child', text: `ran:${prompt}` }
					},
					async createThread() {
						return {
							id: 'T-child',
							async appendUserMessage() {},
						}
					},
				}
			},
			getBuiltinAgent() {
				throw new Error('builtin agents must not be used for pstack delegates')
			},
			registerAgentMode: () => ({ unsubscribe() {} }),
			registerTool: (definition: { name: string; execute: Function }) => {
				tools.set(definition.name, definition)
				return { unsubscribe() {} }
			},
			registerCommand: () => ({ unsubscribe() {}, setAvailability() {} }),
			configuration: {
				get: async () => ({ ...config }),
				update: async (partial: Record<string, unknown>) => {
					Object.assign(config, partial)
				},
				delete: async (key: string) => {
					delete config[key]
				},
			},
			createWebhook: async ({ handler }: { handler: (event: unknown, ctx: unknown) => Promise<void> }) => {
				webhookHandler = handler
				return { url: 'https://example.test/hook' }
			},
			logger: { log() {} },
		} as never & {
			tools: Map<string, { execute: Function }>
			created: Array<Record<string, unknown>>
			config: Record<string, unknown>
			webhookHandler?: (event: unknown, ctx: unknown) => Promise<void>
		}
		await pstack(amp)
		return amp
	}

	test('builtin roles extend the mode with pstack instructions', async () => {
		const amp = await loadPlugin()
		amp.config[CONFIG_KEY] = { 'bug-fix': 'builtin:high' }
		await tool(amp, 'pstack_run_agent').execute(
			{ role: 'bug-fix', prompt: 'fix it' },
			{ thread: { id: 'T-parent' } },
		)
		expect(amp.created.at(-1)).toMatchObject({
			extends: 'high',
			instructions: `${AGENT_INSTRUCTIONS} Assigned role: bug-fix.`,
			tools: 'all',
		})
	})

	test('feature alias uses the shared role and comment-reviewer cannot write', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_run_agent').execute(
			{ role: 'feature', prompt: 'implement it' },
			{ thread: { id: 'T-parent' } },
		)
		expect(amp.created.at(-1)).toMatchObject({
			model: DEFAULT_MODELS['feature-refactoring'],
			instructions: `${AGENT_INSTRUCTIONS} Assigned role: feature-refactoring.`,
		})
		await tool(amp, 'pstack_run_agent').execute(
			{ role: 'comment-reviewer', prompt: 'review comments' },
			{ thread: { id: 'T-parent' } },
		)
		expect(amp.created.at(-1)).toMatchObject({
			tools: { exclude: [...COMMENT_REVIEWER_EXCLUDED_TOOLS] },
		})
		expect(COMMENT_REVIEWER_EXCLUDED_TOOLS).toContain('shell_command')
		expect(COMMENT_REVIEWER_EXCLUDED_TOOLS).toContain('Task')
		expect(WRITE_TOOLS.every((name) => COMMENT_REVIEWER_EXCLUDED_TOOLS.includes(name))).toBe(true)
		expect(String(amp.created.at(-1)?.instructions)).toContain('report-only')
	})

	test('configure set stores overrides only and unknown actions fail', async () => {
		const amp = await loadPlugin()
		const shown = await tool(amp, 'pstack_configure_models').execute({ action: 'show' })
		expect(JSON.parse(shown)['bug-fix']).toBe(DEFAULT_MODELS['bug-fix'])
		const updated = await tool(amp, 'pstack_configure_models').execute({
			action: 'set',
			overrides: { 'bug-fix': 'anthropic/claude-fable-5' },
		})
		expect(JSON.parse(updated)['bug-fix']).toBe('anthropic/claude-fable-5')
		expect(JSON.parse(updated).hillclimb).toBe(DEFAULT_MODELS.hillclimb)
		expect(amp.config[CONFIG_KEY]).toEqual({ 'bug-fix': 'anthropic/claude-fable-5' })
		await expect(tool(amp, 'pstack_configure_models').execute({ action: 'delete' })).rejects.toThrow(
			'action must be show, set, or reset',
		)
	})

	test('webhook handler appends first, then records the event id', async () => {
		const amp = await loadPlugin()
		const appended: string[] = []
		const created = await tool(amp, 'pstack_create_wake_webhook').execute({
			key: 'benny-report',
			instruction: 'triage this',
		})
		expect(created).toContain('https://example.test/hook')
		const handler = amp.webhookHandler
		if (!handler) throw new Error('handler not captured')
		const threadMessages: Array<{ content: Array<{ type: string; text?: string }> }> = []
		const ctx = {
			logger: { log() {} },
			thread: {
				messages: async () => threadMessages,
				appendUserMessage: async ({ content }: { content: string }) => {
					appended.push(content)
					threadMessages.push({ content: [{ type: 'text', text: content }] })
				},
			},
		}
		const event = {
			id: 'evt-9',
			receivedAt: 'now',
			body: new TextEncoder().encode('{"ok":true}'),
		}
		await handler(event, ctx)
		await handler(event, ctx)
		expect(appended).toHaveLength(1)
		expect(appended[0]).toContain(webhookEventMarker('evt-9'))
		expect(amp.config[WEBHOOK_EVENT_IDS_KEY]).toEqual(['evt-9'])
	})

	test('webhook handler records an id already visible in the thread', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_create_wake_webhook').execute({
			key: 'benny-report',
			instruction: 'triage this',
		})
		const handler = amp.webhookHandler
		if (!handler) throw new Error('handler not captured')
		const appended: string[] = []
		const ctx = {
			logger: { log() {} },
			thread: {
				messages: async () => [
					{
						id: 'm1',
						role: 'user',
						content: [{ type: 'text', text: webhookEventMarker('evt-9') }],
					},
				],
				appendUserMessage: async ({ content }: { content: string }) => {
					appended.push(content)
				},
			},
		}
		await handler(
			{ id: 'evt-9', receivedAt: 'now', body: new TextEncoder().encode('{}') },
			ctx,
		)
		expect(appended).toHaveLength(0)
		expect(amp.config[WEBHOOK_EVENT_IDS_KEY]).toEqual(['evt-9'])
	})
})
