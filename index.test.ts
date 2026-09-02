import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

const isolatedUserFile = join(tmpdir(), `pstack-user-models-${process.pid}.json`)
const previousUserFile = process.env.PSTACK_USER_MODEL_FILE

beforeAll(() => {
	process.env.PSTACK_USER_MODEL_FILE = isolatedUserFile
})

afterAll(() => {
	if (previousUserFile === undefined) delete process.env.PSTACK_USER_MODEL_FILE
	else process.env.PSTACK_USER_MODEL_FILE = previousUserFile
})

import pstack, {
	AGENT_INSTRUCTIONS,
	CHEAP_MODELS,
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
	fileModelMap,
	formatMessage,
	loadFileLayers,
	mergeModels,
	planWebhookDelivery,
	profileModels,
	readJsonFile,
	resolveModels,
	resolveRole,
	storedModelMap,
	validateModel,
	validateOverrides,
	webhookEventMarker,
	workspaceRootPath,
} from './index'

describe('amp-pstack plugin', () => {
	test('declares every bundled skill once', () => {
		expect(SKILL_PATHS).toHaveLength(45)
		expect(new Set(SKILL_PATHS).size).toBe(SKILL_PATHS.length)
		expect(SKILL_PATHS).toContain('skills/poteto-mode')
		expect(description).toContain('Ports pstack to Amp')
		expect(description.length).toBeLessThanOrEqual(300)
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
		expect(DEFAULT_MODELS['bug-fix']).toBe('anthropic/claude-fable-5-1')
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

	test('cheap profile has no Fable or Opus', () => {
		const cheap = profileModels('cheap')
		expect(cheap.judgment).toBe('xai/grok-4.6')
		expect(JSON.stringify(cheap)).not.toContain('claude-fable')
		expect(JSON.stringify(cheap)).not.toContain('claude-opus')
		expect(profileModels('balanced').judgment).toBe(DEFAULT_MODELS.judgment)
		expect(() => profileModels('deluxe')).toThrow('profile must be balanced, cheap, builtin, or reset')
	})

	test('workspace json accepts a models wrapper or a bare role map', () => {
		expect(fileModelMap({ models: { 'bug-fix': 'xai/grok-4.6' } })).toEqual({
			'bug-fix': 'xai/grok-4.6',
		})
		expect(fileModelMap({ 'bug-fix': 'xai/grok-4.6' })).toEqual({ 'bug-fix': 'xai/grok-4.6' })
		expect(fileModelMap({ models: { mystery: 'xai/grok-4.6' } })).toEqual({})
	})

	test('workspace json profile expands then overlays models', () => {
		expect(fileModelMap({ profile: 'cheap' }).judgment).toBe('xai/grok-4.6')
		expect(
			fileModelMap({
				profile: 'cheap',
				models: { judgment: 'openai/gpt-5.6-sol' },
			}).judgment,
		).toBe('openai/gpt-5.6-sol')
		expect(Object.keys(CHEAP_MODELS).sort()).toEqual(Object.keys(DEFAULT_MODELS).sort())
	})

	test('resolveModels applies defaults, user file, stored overrides, then workspace file', () => {
		expect(
			resolveModels({
				userFile: { profile: 'cheap' },
				stored: { hillclimb: 'builtin:high', judgment: 'anthropic/claude-fable-5' },
				workspaceFile: { 'bug-fix': 'xai/grok-4.6' },
			}),
		).toMatchObject({
			judgment: 'anthropic/claude-fable-5',
			'bug-fix': 'xai/grok-4.6',
			hillclimb: 'builtin:high',
			'feature-refactoring': 'xai/grok-4.6',
		})
		expect(
			resolveModels({
				stored: { judgment: 'anthropic/claude-fable-5' },
				workspaceFile: { profile: 'cheap' },
			}).judgment,
		).toBe('xai/grok-4.6')
	})

	test('example json is a cheap profile without Fable or Opus', async () => {
		const example = JSON.parse(await Bun.file('.amp/pstack.models.example.json').text())
		const mapped = fileModelMap(example)
		expect(mapped.judgment).toBe('builtin:high')
		expect(mapped['feature-refactoring']).toBe('xai/grok-4.6')
		expect(mapped['how-critics']).toEqual(['xai/grok-4.6', 'openai/gpt-5.6-sol'])
		expect(JSON.stringify(mapped)).not.toContain('claude-fable')
		expect(JSON.stringify(mapped)).not.toContain('claude-opus')
	})

	test('readJsonFile returns undefined for missing or invalid files', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-json-'))
		try {
			expect(await readJsonFile(join(root, 'missing.json'))).toBeUndefined()
			await writeFile(join(root, 'bad.json'), '{')
			expect(await readJsonFile(join(root, 'bad.json'))).toBeUndefined()
			await writeFile(join(root, 'ok.json'), '{"bug-fix":"xai/grok-4.6"}')
			expect(await readJsonFile(join(root, 'ok.json'))).toEqual({ 'bug-fix': 'xai/grok-4.6' })
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('loadFileLayers reads workspace json from the Amp workspace root', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-workspace-'))
		try {
			await mkdir(join(root, '.amp'))
			await writeFile(
				join(root, '.amp', 'pstack.models.json'),
				JSON.stringify({ profile: 'cheap' }),
			)
			const layers = await loadFileLayers(root, join(root, 'user.json'))
			expect(fileModelMap(layers.workspaceFile).judgment).toBe('xai/grok-4.6')
			expect((await loadFileLayers(null, join(root, 'user.json'))).workspaceFile).toBeUndefined()
			expect(workspaceRootPath({ system: { workspaceRoot: null } } as never)).toBeNull()
			expect(
				workspaceRootPath({
					system: { workspaceRoot: 'file:///tmp/project' },
					helpers: { filePathFromURI: (uri: string) => uri.replace('file://', '') },
				} as never),
			).toBe('/tmp/project')
		} finally {
			await rm(root, { recursive: true, force: true })
		}
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
			system: { workspaceRoot: null },
			helpers: { filePathFromURI: (uri: string) => uri },
		} as never & {
			tools: Map<string, { execute: Function }>
			created: Array<Record<string, unknown>>
			config: Record<string, unknown>
			webhookHandler?: (event: unknown, ctx: unknown) => Promise<void>
			system: { workspaceRoot: string | null }
			helpers: { filePathFromURI: (uri: string) => string }
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
			'action must be show, set, reset, or profile',
		)
		const profiled = await tool(amp, 'pstack_configure_models').execute({
			action: 'profile',
			profile: 'cheap',
		})
		expect(JSON.parse(profiled).judgment).toBe('xai/grok-4.6')
		expect(JSON.parse(profiled)['arena-cross-judge']).toEqual(['openai/gpt-5.6-sol'])
		await tool(amp, 'pstack_configure_models').execute({ action: 'reset' })
	})

	test('configure set returns the written overlay without rereading Amp config', async () => {
		const amp = await loadPlugin()
		amp.configuration.get = async () => ({})
		const updated = JSON.parse(
			await tool(amp, 'pstack_configure_models').execute({
				action: 'set',
				overrides: { 'feature-refactoring': 'builtin:low' },
			}),
		)
		expect(updated['feature-refactoring']).toBe('builtin:low')
		expect(amp.config[CONFIG_KEY]).toEqual({ 'feature-refactoring': 'builtin:low' })
	})

	test('configure show lets workspace json beat stored Amp config', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-show-'))
		try {
			await mkdir(join(root, '.amp'))
			await writeFile(
				join(root, '.amp', 'pstack.models.json'),
				JSON.stringify({ profile: 'cheap', models: { hillclimb: 'builtin:low' } }),
			)
			const amp = await loadPlugin()
			amp.config[CONFIG_KEY] = { judgment: 'anthropic/claude-fable-5' }
			amp.system.workspaceRoot = root
			amp.helpers.filePathFromURI = () => root
			const shown = JSON.parse(await tool(amp, 'pstack_configure_models').execute({ action: 'show' }))
			expect(shown.judgment).toBe('xai/grok-4.6')
			expect(shown.hillclimb).toBe('builtin:low')
			expect(JSON.stringify(shown)).not.toContain('claude-fable')
		} finally {
			await rm(root, { recursive: true, force: true })
		}
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
