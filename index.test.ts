import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

const isolatedUserFile = join(tmpdir(), `pstack-user-models-${process.pid}.json`)
const isolatedPluginFile = join(tmpdir(), `pstack-plugin-models-${process.pid}.json`)
const previousUserFile = process.env.PSTACK_USER_MODEL_FILE
const previousPluginFile = process.env.PSTACK_PLUGIN_MODEL_FILE

beforeAll(() => {
	process.env.PSTACK_USER_MODEL_FILE = isolatedUserFile
	process.env.PSTACK_PLUGIN_MODEL_FILE = isolatedPluginFile
})

afterAll(() => {
	if (previousUserFile === undefined) delete process.env.PSTACK_USER_MODEL_FILE
	else process.env.PSTACK_USER_MODEL_FILE = previousUserFile
	if (previousPluginFile === undefined) delete process.env.PSTACK_PLUGIN_MODEL_FILE
	else process.env.PSTACK_PLUGIN_MODEL_FILE = previousPluginFile
})

import pstack, {
	AGENT_INSTRUCTIONS,
	ARBITRARY_SHELL_GAP,
	CODE_IMPLEMENTATION_ROLES,
	IMPLEMENTATION_BLOCKING_ERROR,
	START_AGENT_NEXT,
	CHEAP_MODELS,
	COMMENT_REVIEWER_EXCLUDED_TOOLS,
	COMMENT_REVIEWER_MIN_TIMEOUT_MS,
	CONFIG_KEY,
	DEFAULT_MODELS,
	DEFAULT_TIMEOUT_MS,
	RUN_AGENT_MIN_TIMEOUT_MS,
	ORB_MODE_RELOAD_ERROR,
	POTETO_DELEGATE_INSTRUCTIONS,
	REPORTING_READONLY_TOOLS,
	SKILL_PATHS,
	STRICT_READONLY_TOOLS,
	WRITE_TOOLS,
	backgroundChildPrompt,
	capabilityFor,
	description,
	executorFrom,
	fileModelMap,
	formatMessage,
	loadFileLayers,
	mergeModels,
	modelFamily,
	orbAgentModeFor,
	orbAgentSpecsFor,
	profileModels,
	readJsonFile,
	resolveModels,
	selectPoolModel,
	steerFrom,
	storedModelMap,
	timeoutFrom,
	validateModel,
	validateOverrides,
	workspaceRootPath,
} from './index'
import { parseWakeEnvelope, WAKE_ENVELOPE_PREFIX } from './webhook-runtime'

describe('amp-pstack plugin', () => {
	test('declares every bundled skill once', () => {
		expect(SKILL_PATHS).toHaveLength(47)
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

	test('forge-neutral playbooks preserve regression lanes and explicit write approval', async () => {
		const files = await Promise.all(
			[
				'autopilot-full.md',
				'autopilot-stack.md',
				'babysit.md',
				'opening-a-pr.md',
				'shipping.md',
			].map((name) => Bun.file(`skills/poteto-mode/playbooks/${name}`).text()),
		)
		for (const body of files) {
			expect(body).toContain('GitHub CLI (`gh`) is the default')
			expect(body).toContain('Origin')
		}
		expect(files.join('\n')).not.toContain('Graphite registration')
		expect(files.join('\n')).not.toContain('lets Graphite drain')
		expect(files[0]).toContain('within about 15 minutes')
		expect(files[1]).toContain('within about 15 minutes')
		expect(files[0]).toContain('Regression lane against trunk')
		expect(files[1]).toContain('base-branch stack')
		expect(files[3]).toContain('requires explicit user authorization')
		expect(files[4]).toContain('Every merge or auto-merge arm requires')
	})

	test('has multi-model role and panel defaults', () => {
		expect(DEFAULT_MODELS['bug-fix']).toBe('xai/grok-4.7')
		expect(DEFAULT_MODELS['perf-issue']).toBe('xai/grok-4.7')
		expect(DEFAULT_MODELS.hillclimb).toBe('xai/grok-4.7')
		expect(DEFAULT_MODELS.judgment).toBe('anthropic/claude-fable-5-1')
		expect(DEFAULT_MODELS['arena-runners']).toHaveLength(4)
		expect(DEFAULT_MODELS.feature).toBe('xai/grok-4.7')
		expect(DEFAULT_MODELS.refactoring).toBe('xai/grok-4.7')
		expect(description.length).toBeLessThanOrEqual(300)
	})

	test('registers skills, startup orb modes, tools, and setup command', async () => {
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
			logger: { log() {} },
			system: {
				ampURL: new URL('https://ampcode.test'),
				user: null,
				workspaceRoot: null,
				executor: {
					kind: 'local',
					async keepAlive() {
						return { unsubscribe() {} }
					},
				},
			},
			helpers: { filePathFromURI: (uri: string) => uri },
			threads: {
				get() {
					throw new Error('No restored threads expected.')
				},
			},
			onDispose: () => ({ unsubscribe() {} }),
		} as never

		const previousStateFile = process.env.PSTACK_STATE_FILE
		process.env.PSTACK_STATE_FILE = ':memory:'
		try {
			await pstack(amp)
		} finally {
			if (previousStateFile === undefined) delete process.env.PSTACK_STATE_FILE
			else process.env.PSTACK_STATE_FILE = previousStateFile
		}

		expect(skills).toEqual([...SKILL_PATHS])
		expect(modes).toEqual(
			orbAgentSpecsFor({ ...DEFAULT_MODELS }).map(({ role, model }) =>
				orbAgentModeFor(role, model).key,
			),
		)
		expect(new Set(modes).size).toBe(modes.length)
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
		expect(validateModel('xai/grok-4.7')).toBe(true)
		expect(validateModel('fireworks-ai/accounts/fireworks/models/kimi-k3')).toBe(true)
		expect(validateModel('not-a-model')).toBe(false)
		expect(validateModel('inherit-parent')).toBe(false)
	})

	test('rejects unknown roles and invalid models on set', () => {
		expect(validateOverrides({ feature: 'xai/grok-4.7' })).toEqual({ feature: 'xai/grok-4.7' })
		expect(() => validateOverrides({ 'feature-refactoring': 'xai/grok-4.7' })).toThrow(
			'replaced by separate feature and refactoring roles',
		)
		expect(() => validateOverrides({ 'bug-fix': 'not-a-model' })).toThrow('Invalid model')
		expect(() =>
			validateOverrides({ 'bug-fix': 'xai/grok-4.7', mystery: [] }),
		).toThrow('Unknown pstack role')
		expect(() => validateOverrides({ feature: ['xai/grok-4.7'] })).toThrow('Invalid model')
		expect(() => validateOverrides({ 'arena-runners': [] })).toThrow('Invalid model')
		expect(() => validateOverrides(undefined)).toThrow('Missing overrides')
		expect(validateOverrides({ 'bug-fix': 'openai/gpt-5.6-sol' })).toEqual({
			'bug-fix': 'openai/gpt-5.6-sol',
		})
	})

	test('drops unknown stored keys and invalid values, then fills defaults', () => {
		expect(
			storedModelMap({
				'bug-fix': 'openai/gpt-5.6-sol',
				mystery: 'xai/grok-4.7',
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

	test('legacy feature-refactoring config migrates without overriding canonical keys', () => {
		expect(storedModelMap({ 'feature-refactoring': 'builtin:high' })).toEqual({
			feature: 'builtin:high',
			refactoring: 'builtin:high',
		})
		expect(
			storedModelMap({
				refactoring: 'xai/grok-4.7',
				'feature-refactoring': ['builtin:medium', 'builtin:low'],
			}),
		).toEqual({ feature: 'builtin:medium', refactoring: 'xai/grok-4.7' })
	})

	test('orb agent mode names are deterministic, distinct, and Amp-safe', () => {
		const feature = orbAgentModeFor('feature', 'xai/grok-4.7')
		expect(orbAgentModeFor('feature', 'xai/grok-4.7')).toEqual(feature)
		expect(orbAgentModeFor('feature', 'builtin:high')).not.toEqual(feature)
		expect(orbAgentModeFor('architect-runners-1', 'builtin:high')).not.toEqual(
			orbAgentModeFor('architect-runners-2', 'builtin:high'),
		)
		expect(orbAgentModeFor('architect-runners-1', 'builtin:high').label).toStartWith('architect-1-')
		for (const value of Object.values(feature)) {
			expect(value).toMatch(/^[a-z0-9-]+$/)
			expect(value.length).toBeGreaterThan(0)
			expect(value.length).toBeLessThanOrEqual(24)
		}
		expect(feature.key).not.toBe('poteto')
	})

	test('orb startup specs include singular roles, every panel seat, and every unique pool model', () => {
		expect(
			orbAgentSpecsFor({
				'bug-fix': 'builtin:high',
				'interrogate-reviewers': ['builtin:high', 'builtin:medium'],
				'arena-cross-judge': ['builtin:high', 'builtin:medium', 'builtin:high'],
			}),
		).toEqual([
			{ role: 'bug-fix', model: 'builtin:high' },
			{ role: 'interrogate-reviewers-1', model: 'builtin:high' },
			{ role: 'interrogate-reviewers-2', model: 'builtin:medium' },
			{ role: 'arena-cross-judge', model: 'builtin:high' },
			{ role: 'arena-cross-judge', model: 'builtin:medium' },
		])
	})

	test('cross-judge pools prefer a known different family and otherwise preserve order', () => {
		expect(modelFamily('anthropic/claude-opus-5')).toBe('claude')
		expect(modelFamily('openai/gpt-5.6-sol')).toBe('gpt')
		expect(modelFamily('xai/grok-4.7')).toBe('grok')
		expect(modelFamily('builtin:high')).toBeUndefined()
		expect(
			selectPoolModel(
				['xai/grok-4.7', 'builtin:high', 'openai/gpt-5.6-sol', 'anthropic/claude-opus-5'],
				'xai/grok-4.5',
			),
		).toBe('openai/gpt-5.6-sol')
		expect(selectPoolModel(['builtin:high', 'xai/grok-4.7'], 'xai/grok-4.5')).toBe(
			'builtin:high',
		)
		expect(selectPoolModel(['builtin:high', 'xai/grok-4.7'])).toBe('builtin:high')
		expect(() => selectPoolModel([])).toThrow('cannot be empty')
	})

	test('rejects unknown executors instead of coercing them', () => {
		expect(executorFrom(undefined, 'local')).toBe('local')
		expect(executorFrom('orb', 'local')).toBe('orb')
		expect(executorFrom({ type: 'runner', id: 'mac-mini' }, 'local')).toEqual({
			type: 'runner',
			id: 'mac-mini',
		})
		expect(() => executorFrom('cloud', 'local')).toThrow('executor must be local, orb')
		expect(() => executorFrom(undefined, 'unknown')).toThrow('explicit execution target')
	})

	test('one-shot delegates cannot undercut the ten-minute floor', () => {
		expect(timeoutFrom(undefined)).toBe(DEFAULT_TIMEOUT_MS)
		expect(timeoutFrom(120_000)).toBe(120_000)
		expect(timeoutFrom(120_000, { role: 'comment-reviewer' })).toBe(COMMENT_REVIEWER_MIN_TIMEOUT_MS)
		expect(timeoutFrom(undefined, { role: 'comment-reviewer' })).toBe(COMMENT_REVIEWER_MIN_TIMEOUT_MS)
		expect(timeoutFrom(20 * 60 * 1000, { role: 'comment-reviewer' })).toBe(20 * 60 * 1000)
		expect(timeoutFrom(120_000, { role: 'how-explainer', floor: RUN_AGENT_MIN_TIMEOUT_MS })).toBe(
			RUN_AGENT_MIN_TIMEOUT_MS,
		)
		expect(timeoutFrom(240_000, { role: 'feature', floor: RUN_AGENT_MIN_TIMEOUT_MS })).toBe(
			RUN_AGENT_MIN_TIMEOUT_MS,
		)
		expect(timeoutFrom(20 * 60 * 1000, { floor: RUN_AGENT_MIN_TIMEOUT_MS })).toBe(20 * 60 * 1000)
	})

	test('cheap profile has no Fable or Opus', () => {
		const cheap = profileModels('cheap')
		expect(cheap.judgment).toBe('xai/grok-4.7')
		expect(JSON.stringify(cheap)).not.toContain('claude-fable')
		expect(JSON.stringify(cheap)).not.toContain('claude-opus')
		expect(profileModels('balanced').judgment).toBe(DEFAULT_MODELS.judgment)
		expect(() => profileModels('deluxe')).toThrow('profile must be balanced, cheap, builtin, or reset')
	})

	test('workspace json accepts a models wrapper or a bare role map', () => {
		expect(fileModelMap({ models: { 'bug-fix': 'xai/grok-4.7' } })).toEqual({
			'bug-fix': 'xai/grok-4.7',
		})
		expect(fileModelMap({ 'bug-fix': 'xai/grok-4.7' })).toEqual({ 'bug-fix': 'xai/grok-4.7' })
		expect(fileModelMap({ models: { mystery: 'xai/grok-4.7' } })).toEqual({})
	})

	test('workspace json profile expands then overlays models', () => {
		expect(fileModelMap({ profile: 'cheap' }).judgment).toBe('xai/grok-4.7')
		expect(
			fileModelMap({
				profile: 'cheap',
				models: { judgment: 'openai/gpt-5.6-sol' },
			}).judgment,
		).toBe('openai/gpt-5.6-sol')
		expect(Object.keys(CHEAP_MODELS).sort()).toEqual(Object.keys(DEFAULT_MODELS).sort())
	})

	test('resolveModels applies defaults, plugin file, user file, stored overrides, then workspace file', () => {
		expect(
			resolveModels({
				pluginFile: { profile: 'cheap', models: { judgment: 'builtin:high' } },
				userFile: { profile: 'cheap' },
				stored: { hillclimb: 'builtin:high', judgment: 'anthropic/claude-fable-5' },
				workspaceFile: { 'bug-fix': 'xai/grok-4.7' },
			}),
		).toMatchObject({
			judgment: 'anthropic/claude-fable-5',
			'bug-fix': 'xai/grok-4.7',
			hillclimb: 'builtin:high',
			feature: 'xai/grok-4.7',
			refactoring: 'xai/grok-4.7',
			'comment-reviewer': 'xai/grok-4.7',
		})
		expect(
			resolveModels({
				pluginFile: { profile: 'cheap', models: { judgment: 'builtin:high' } },
			}).judgment,
		).toBe('builtin:high')
		expect(
			resolveModels({
				stored: { judgment: 'anthropic/claude-fable-5' },
				workspaceFile: { profile: 'cheap' },
			}).judgment,
		).toBe('xai/grok-4.7')
	})

	test('bundled plugin json uses Grok for code, high for judgment, and medium for tooling', async () => {
		const bundled = JSON.parse(await Bun.file('pstack.models.json').text())
		const mapped = fileModelMap(bundled)
		expect(mapped.feature).toBe('xai/grok-4.7')
		expect(mapped.refactoring).toBe('xai/grok-4.7')
		expect(mapped['bug-fix']).toBe('xai/grok-4.7')
		expect(mapped['perf-issue']).toBe('xai/grok-4.7')
		expect(mapped.hillclimb).toBe('xai/grok-4.7')
		expect(mapped['reflect-tooling']).toBe('builtin:medium')
		expect(mapped.judgment).toBe('builtin:high')
		expect(mapped['how-explainer']).toBe('builtin:high')
		expect(mapped['why-synthesizer']).toBe('builtin:high')
		expect(mapped['reflect-judgment']).toBe('builtin:high')
		expect(mapped['reflect-divergent']).toBe('builtin:high')
		expect(mapped['reflect-synthesizer']).toBe('builtin:high')
		expect(mapped['comment-reviewer']).toBe('builtin:medium')
		expect(mapped['arena-cross-judge']).toEqual([
			'builtin:high',
			'builtin:medium',
			'xai/grok-4.7',
		])
		expect(mapped['interrogate-reviewers']).toEqual([
			'builtin:high',
			'builtin:medium',
			'xai/grok-4.7',
		])
		expect(JSON.stringify(mapped)).not.toContain('claude-fable')
		expect(JSON.stringify(mapped)).not.toContain('claude-opus')
	})

	test('example json is a cheap profile without Fable or Opus', async () => {
		const example = JSON.parse(await Bun.file('.amp/pstack.models.example.json').text())
		const mapped = fileModelMap(example)
		expect(mapped.judgment).toBe('builtin:high')
		expect(mapped.feature).toBe('xai/grok-4.7')
		expect(mapped.refactoring).toBe('xai/grok-4.7')
		expect(mapped['interrogate-reviewers']).toEqual([
			'xai/grok-4.7',
			'openai/gpt-5.6-sol',
		])
		expect(JSON.stringify(mapped)).not.toContain('claude-fable')
		expect(JSON.stringify(mapped)).not.toContain('claude-opus')
	})

	test('readJsonFile returns undefined for missing or invalid files', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-json-'))
		try {
			expect(await readJsonFile(join(root, 'missing.json'))).toBeUndefined()
			await writeFile(join(root, 'bad.json'), '{')
			expect(await readJsonFile(join(root, 'bad.json'))).toBeUndefined()
			await writeFile(join(root, 'ok.json'), '{"bug-fix":"xai/grok-4.7"}')
			expect(await readJsonFile(join(root, 'ok.json'))).toEqual({ 'bug-fix': 'xai/grok-4.7' })
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
			const layers = await loadFileLayers(root, join(root, 'user.json'), join(root, 'plugin.json'))
			expect(fileModelMap(layers.workspaceFile).judgment).toBe('xai/grok-4.7')
			expect(layers.pluginFile).toBeUndefined()
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

describe('runtime tool behavior', () => {
	type TestTool = { description: string; execute: Function }
	type TestMode = {
		key: string
		label: string | undefined
		agent: Record<string, unknown>
		active: boolean
	}

	const tool = (amp: { tools: Map<string, TestTool> }, name: string) => {
		const found = amp.tools.get(name)
		if (!found) throw new Error(`missing ${name}`)
		return found
	}

	async function loadPlugin(options?: {
		createError?: Error
		waitError?: Error
		waitState?: 'idle' | 'running' | 'awaiting-approval' | 'error'
		appendError?: Error
		initialConfig?: Record<string, unknown>
		executorKind?: 'local' | 'remote' | 'unknown'
		keepAliveError?: Error
		runtimeStateFile?: string
		filesModifiedByToolCall?: (event: Record<string, unknown>) => string[] | null
	}) {
		const created: Array<Record<string, unknown>> = []
		const initializedAgents: Array<Record<string, unknown>> = []
		const runs: Array<Record<string, unknown>> = []
		const waited: Array<Record<string, unknown>> = []
		const started: Array<Record<string, unknown>> = []
		const sent: Array<Record<string, unknown>> = []
		const registeredModes: TestMode[] = []
		const publishedModes: TestMode[] = []
		const pendingOrbSelections: Array<{ key: string; agent: Record<string, unknown> }> = []
		const config: Record<string, unknown> = { ...options?.initialConfig }
		const tools = new Map<string, TestTool>()
		let webhookHandler: ((event: unknown, ctx: unknown) => Promise<void>) | undefined
		const webhookHandlers = new Map<
			string,
			(event: unknown, ctx: unknown) => Promise<void>
		>()
		const eventHandlers = new Map<string, Array<(event: any, ctx?: any) => unknown>>()
		const disposeHandlers: Array<() => void | Promise<void>> = []
		const logs: string[] = []
		const amp = {
			tools,
			created,
			initializedAgents,
			runs,
			waited,
			started,
			sent,
			registeredModes,
			publishedModes,
			preloadedAgentCount: 0,
			preloadedModeCount: 0,
			config,
			flushOrbSelections() {
				for (const selection of pendingOrbSelections.splice(0)) {
					const activeMatches = registeredModes.filter(
						({ active, agent, key }) =>
							active && agent === selection.agent && key.toLowerCase() === selection.key.toLowerCase(),
					)
					const publishedMatches = publishedModes.filter(
						({ agent, key }) =>
							agent === selection.agent && key.toLowerCase() === selection.key.toLowerCase(),
					)
					if (activeMatches.length !== 1 || publishedMatches.length !== 1) {
						throw new Error(
							`Selected agent mode key must have exactly one active registration: ${selection.key}`,
						)
					}
				}
			},
			get webhookHandler() {
				return webhookHandler
			},
			webhookHandlers,
			registerSkill: async () => ({ unsubscribe() {} }),
			createAgent: (definition: Record<string, unknown>) => {
				created.push(definition)
				return {
					definition,
					async run(prompt: string, options?: Record<string, unknown>) {
						runs.push({ prompt, ...options })
						return { threadID: 'T-child', text: `ran:${prompt}` }
					},
					async createThread(createOptions?: Record<string, unknown>) {
							if (
								createOptions?.executor === 'orb' ||
								(typeof createOptions?.executor === 'object' &&
									createOptions.executor !== null &&
									'type' in createOptions.executor &&
									createOptions.executor.type === 'runner')
							) {
								const matches = registeredModes.filter(({ active, agent }) => active && agent === definition)
								const mode = matches[0]
								if (!mode || matches.length !== 1) {
									throw new Error('Orb custom agents must be registered as an active agent mode')
								}
								const published = publishedModes.filter(
									({ key, agent }) => key.toLowerCase() === mode.key.toLowerCase() && agent === definition,
								)
								if (published.length !== 1) {
									throw new Error(
										`Selected agent mode key must have exactly one active registration: ${mode.key}`,
									)
								}
								pendingOrbSelections.push({ key: mode.key, agent: definition })
							}
							if (options?.createError) throw options.createError
							const listeners: Array<(state: string) => void> = []
							let currentState = 'idle'
							const thread = {
							id: started.length === 0 ? 'T-child' : `T-child-${started.length + 1}`,
							parentThreadID: createOptions?.parentThreadID,
							executor: createOptions?.executor,
							prompt: '',
							timeoutMs: undefined as number | undefined,
							stateListeners: listeners,
							state: {
								subscribe(listener: (state: string) => void) {
									listeners.push(listener)
									return {
										unsubscribe() {
											const index = listeners.indexOf(listener)
											if (index >= 0) listeners.splice(index, 1)
										},
									}
								},
									async get() {
										return currentState
									},
							},
							emit(state: string) {
									currentState = state
								for (const listener of [...listeners]) listener(state)
							},
							async appendUserMessage({ content }: { content: string }) {
								if (options?.appendError && !amp.appendErrorUsed) {
									amp.appendErrorUsed = true
									throw options.appendError
								}
								thread.prompt = content
							},
							async waitForResponse({ timeoutMs }: { timeoutMs?: number } = {}) {
								thread.timeoutMs = timeoutMs
								waited.push(thread)
								if (options?.waitState) thread.emit(options.waitState)
								if (options?.waitError) throw options.waitError
								return { content: [{ type: 'text', text: `ran:${thread.prompt}` }] }
							},
						}
						started.push(thread)
						return thread
					},
				}
			},
			getBuiltinAgent() {
				throw new Error('builtin agents must not be used for pstack delegates')
			},
			registerAgentMode: ({
				key,
				label,
				agent,
			}: {
				key: string
				label?: string
				agent: Record<string, unknown>
			}) => {
				const duplicate = registeredModes.find(
					(mode) =>
						mode.active &&
						(mode.key.toLowerCase() === key.toLowerCase() ||
							mode.label?.toLowerCase() === label?.toLowerCase()),
				)
				if (duplicate) throw new Error(`Duplicate active agent mode: ${key}`)
				const registration = { key, label, agent, active: true }
				registeredModes.push(registration)
				initializedAgents.push(agent)
				return {
					unsubscribe() {
						registration.active = false
					},
				}
			},
			registerTool: (definition: { name: string } & TestTool) => {
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
			createWebhook: async ({
				key,
				handler,
			}: {
				key: string
				handler: (event: unknown, ctx: unknown) => Promise<void>
			}) => {
				webhookHandler = handler
				webhookHandlers.set(key, handler)
				return { url: `https://example.test/hook/${key}` }
			},
			logger: {
				log(message: string) {
					logs.push(message)
				},
			},
			system: {
				ampURL: new URL('https://ampcode.test'),
				user: null,
				workspaceRoot: null,
				executor: {
					kind: options?.executorKind ?? 'local',
					async keepAlive() {
						if (options?.keepAliveError) throw options.keepAliveError
						return { unsubscribe() {} }
					},
				},
			},
			helpers: {
				filePathFromURI: (uri: string) => uri,
				filesModifiedByToolCall: (event: Record<string, unknown>) => {
					if (options?.filesModifiedByToolCall) return options.filesModifiedByToolCall(event)
					return Array.isArray(event.filesModified) ? (event.filesModified as string[]) : null
				},
			},
			on(event: string, handler: (event: any, ctx?: any) => unknown) {
				const list = eventHandlers.get(event) ?? []
				list.push(handler)
				eventHandlers.set(event, list)
				return { unsubscribe() {} }
			},
			onDispose(handler: () => void | Promise<void>) {
				disposeHandlers.push(handler)
				return { unsubscribe() {} }
			},
			async emit(event: string, payload: Record<string, unknown>) {
				const list = eventHandlers.get(event) ?? []
				let last: unknown
				const thread = (payload.thread as { id: string } | undefined) ?? { id: String(payload.threadID ?? '') }
				for (const handler of list) last = await handler(payload, { thread })
				return last
			},
			async dispose() {
				await Promise.all(disposeHandlers.map((handler) => handler()))
			},
			threads: {
				get(threadID: string) {
					const existing = started.find((thread) => thread.id === threadID)
					if (existing) return existing
					return {
						id: threadID,
						state: {
							subscribe(listener: (state: string) => void) {
								return { unsubscribe() {} }
							},
								async get() {
									return 'idle'
								},
						},
						async appendUserMessage(message: { content: string }, options?: { steer?: boolean }) {
							sent.push({ threadID, content: message.content, steer: options?.steer })
						},
					}
				},
			},
		} as unknown as {
			tools: Map<string, TestTool>
			created: Array<Record<string, unknown>>
			initializedAgents: Array<Record<string, unknown>>
			runs: Array<Record<string, unknown>>
			waited: Array<Record<string, unknown>>
			started: Array<Record<string, unknown>>
			sent: Array<Record<string, unknown>>
			registeredModes: TestMode[]
			publishedModes: TestMode[]
			preloadedAgentCount: number
			preloadedModeCount: number
			config: Record<string, unknown>
			configuration: {
				get: () => Promise<Record<string, unknown>>
				update: (patch: Record<string, unknown>, target: string) => Promise<void>
				delete: (key: string, target: string) => Promise<void>
			}
			appendErrorUsed: boolean
			flushOrbSelections: () => void
			webhookHandler?: (event: unknown, ctx: unknown) => Promise<void>
			webhookHandlers: Map<string, (event: unknown, ctx: unknown) => Promise<void>>
			system: {
				ampURL: URL
				user: null
				workspaceRoot: string | null
				executor: {
					kind: 'local' | 'remote' | 'unknown'
					keepAlive: () => Promise<{ unsubscribe(): void }>
				}
			}
			helpers: {
				filePathFromURI: (uri: string) => string
				filesModifiedByToolCall: (event: Record<string, unknown>) => string[] | null
			}
			emit: (event: string, payload: Record<string, unknown>) => Promise<unknown>
			dispose: () => Promise<void>
			logs: string[]
		}
		Object.assign(amp, { logs, appendErrorUsed: false })
		const previousStateFile = process.env.PSTACK_STATE_FILE
		process.env.PSTACK_STATE_FILE = options?.runtimeStateFile ?? ':memory:'
		try {
			await pstack(amp as never)
		} finally {
			if (previousStateFile === undefined) delete process.env.PSTACK_STATE_FILE
			else process.env.PSTACK_STATE_FILE = previousStateFile
		}
		amp.preloadedAgentCount = created.length
		amp.preloadedModeCount = registeredModes.length
		publishedModes.push(...registeredModes)
		return amp
	}

	const implStart = {
		role: 'feature',
		prompt: 'implement fixture',
		scope: 'index.ts WorkflowParityPolicy',
		scopePaths: ['index.ts'],
		launchTarget: { kind: 'current-checkout' as const },
	}

	test('builtin roles extend the mode with pstack instructions', async () => {
		const amp = await loadPlugin()
		amp.config[CONFIG_KEY] = { 'bug-fix': 'builtin:high' }
		await tool(amp, 'pstack_start_agent').execute(
			{ role: 'bug-fix', prompt: 'fix it', scope: 'src/bug.ts', launchTarget: { kind: 'current-checkout' } },
			{ thread: { id: 'T-parent' } },
		)
		expect(amp.created.at(-1)).toMatchObject({
			extends: 'high',
			instructions: `${AGENT_INSTRUCTIONS} ${POTETO_DELEGATE_INSTRUCTIONS} Assigned role: bug-fix.`,
			tools: 'all',
		})
		expect(amp.created.at(-1)).not.toHaveProperty('reasoningEffort')
	})

	test('unknown workflow roles give actionable guidance without spawning', async () => {
		const amp = await loadPlugin()
		for (const name of ['pstack_start_agent', 'pstack_run_agent']) {
			await expect(
				tool(amp, name).execute(
					{ role: 'how', prompt: 'review and run tests' },
					{ thread: { id: 'T-parent' } },
				),
			).rejects.toThrow('how is a workflow, not a role: use how-explorer')
		}
		expect(amp.started).toHaveLength(0)
	})

	test('poteto-mode.ts registers a builtin high parent without a model pin', async () => {
		const created: Array<Record<string, unknown>> = []
		const modes: string[] = []
		const amp = {
			createAgent: (definition: Record<string, unknown>) => {
				created.push(definition)
				return { definition }
			},
			registerAgentMode: ({ key }: { key: string }) => {
				modes.push(key)
				return { unsubscribe() {} }
			},
		} as never
		const { default: potetoMode } = await import('./poteto-mode')
		potetoMode(amp)
		expect(modes).toEqual(['poteto'])
		expect(created[0]).toMatchObject({
			name: 'poteto',
			extends: 'high',
		})
		expect(created[0]).not.toHaveProperty('model')
		expect(created[0]).not.toHaveProperty('tools')
	})

	test('code implementation roles receive the full poteto delegate wrapper', async () => {
		const amp = await loadPlugin()
		for (const [index, role] of ['feature', 'refactoring', 'bug-fix', 'perf-issue', 'hillclimb'].entries()) {
			await tool(amp, 'pstack_start_agent').execute(
				{
					role,
					prompt: 'implement it',
					scope: `scope-${role}`,
					launchTarget: { kind: 'current-checkout' },
				},
				{ thread: { id: `T-parent-${index}` } },
			)
			expect(String(amp.created.at(-1)?.instructions)).toContain(POTETO_DELEGATE_INSTRUCTIONS)
			expect(amp.created.at(-1)?.reasoningEffort).toBe('medium')
		}
		expect(CODE_IMPLEMENTATION_ROLES).toEqual(
			new Set(['feature', 'refactoring', 'bug-fix', 'perf-issue', 'hillclimb']),
		)
	})

	test('specialist and comment roles keep their narrower contracts', async () => {
		const amp = await loadPlugin()
		for (const role of [
			'how-explorer',
			'how-explainer',
			'why-investigator',
			'why-synthesizer',
			'swarm-worker',
			'reflect-tooling',
			'reflect-judgment',
			'reflect-divergent',
			'reflect-synthesizer',
		]) {
			await tool(amp, 'pstack_run_agent').execute(
				{ role, prompt: 'inspect it' },
				{ thread: { id: 'T-parent' } },
			)
			expect(String(amp.created.at(-1)?.instructions)).not.toContain(
				POTETO_DELEGATE_INSTRUCTIONS,
			)
		}
		await tool(amp, 'pstack_run_agent').execute(
			{ role: 'comment-reviewer', prompt: 'review comments', timeoutMs: 120_000 },
			{ thread: { id: 'T-parent' } },
		)
		expect(amp.created.at(-1)).toMatchObject({
			tools: { include: [...STRICT_READONLY_TOOLS] },
		})
		expect(STRICT_READONLY_TOOLS).not.toContain('shell_command')
		expect(STRICT_READONLY_TOOLS).not.toContain('Task')
		expect(STRICT_READONLY_TOOLS).not.toContain('create_thread')
		expect(
			WRITE_TOOLS.every(
				(name) => !(STRICT_READONLY_TOOLS as readonly string[]).includes(name),
			),
		).toBe(true)
		expect(COMMENT_REVIEWER_EXCLUDED_TOOLS).toContain('Task')
		expect(String(amp.created.at(-1)?.instructions)).toContain('terminal report-only reviewer')
		expect(String(amp.created.at(-1)?.instructions)).not.toContain(POTETO_DELEGATE_INSTRUCTIONS)
		expect(amp.waited.at(-1)).toMatchObject({ timeoutMs: COMMENT_REVIEWER_MIN_TIMEOUT_MS })
		const explained = JSON.parse(
			await tool(amp, 'pstack_run_agent').execute(
				{ role: 'how-explainer', prompt: 'explain it', timeoutMs: 120_000 },
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(explained).toMatchObject({
			status: 'done',
			threadID: amp.started.at(-1)?.id,
			timeoutMs: RUN_AGENT_MIN_TIMEOUT_MS,
		})
		expect(amp.waited.at(-1)).toMatchObject({ timeoutMs: RUN_AGENT_MIN_TIMEOUT_MS })
		await expect(
			tool(amp, 'pstack_run_agent').execute(
				{ role: 'feature', prompt: 'implement it', timeoutMs: 240_000 },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow(IMPLEMENTATION_BLOCKING_ERROR)
	})

	test('panel delegates have distinct threads and preserve poteto wrapper boundaries', async () => {
		const amp = await loadPlugin()
		amp.config[CONFIG_KEY] = {
			'architect-runners': ['builtin:high', 'builtin:medium'],
			'interrogate-reviewers': ['builtin:high', 'builtin:medium'],
		}
		const firstCreated = amp.created.length
		const architect = JSON.parse(
			await tool(amp, 'pstack_run_panel').execute(
				{ panel: 'architect-runners', prompt: 'sketch it' },
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(architect.map(({ label }: { label: string }) => label)).toEqual([
			'architect-runners-1',
			'architect-runners-2',
		])
		expect(architect.map(({ threadID }: { threadID: string }) => threadID)).toEqual([
			'T-child',
			'T-child-2',
		])
		for (const definition of amp.created.slice(firstCreated, firstCreated + 2)) {
			expect(String(definition.instructions)).toContain(POTETO_DELEGATE_INSTRUCTIONS)
		}

		const secondCreated = amp.created.length
		await tool(amp, 'pstack_run_panel').execute(
			{ panel: 'interrogate-reviewers', prompt: 'interrogate it' },
			{ thread: { id: 'T-parent' } },
		)
		for (const definition of amp.created.slice(secondCreated, secondCreated + 2)) {
			expect(String(definition.instructions)).not.toContain(POTETO_DELEGATE_INSTRUCTIONS)
		}

		await tool(amp, 'pstack_start_agent').execute(
			{ role: 'arena-cross-judge', prompt: 'judge it' },
			{ thread: { id: 'T-parent' } },
		)
		expect(String(amp.created.at(-1)?.instructions)).not.toContain(POTETO_DELEGATE_INSTRUCTIONS)
	})

	test('cross-judge selects one known different-family pool model from the parent', async () => {
		const amp = await loadPlugin({
			initialConfig: {
				[CONFIG_KEY]: {
					'arena-cross-judge': ['xai/grok-4.7', 'builtin:high', 'openai/gpt-5.6-sol'],
				},
			},
		})
		const result = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{ role: 'arena-cross-judge', prompt: 'judge it' },
				{
					thread: {
						id: 'T-parent',
						agent: async () => ({
							definition: {
								kind: 'agent-definition',
								model: 'xai/grok-4.5',
								instructions: '',
							},
						}),
					},
				},
			),
		)
		expect(result.model).toBe('openai/gpt-5.6-sol')
		expect(amp.started).toHaveLength(1)
		expect(amp.created.at(-1)).toMatchObject({ model: 'openai/gpt-5.6-sol' })
		await expect(
			tool(amp, 'pstack_run_panel').execute(
				{ panel: 'arena-cross-judge', prompt: 'run all judges' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('Unknown pstack panel')
	})

	test('run_agent timeout keeps the child thread as owner', async () => {
		const amp = await loadPlugin({
			waitError: new Error('wait expired'),
			waitState: 'running',
		})
		const result = JSON.parse(
			await tool(amp, 'pstack_run_agent').execute(
				{ role: 'how-explainer', prompt: 'explain fixture' },
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(result.status).toBe('timeout')
		expect(result.threadID).toBe('T-child')
		expect(result.text).toContain('Child thread T-child is still the owner')
		expect(result.text).toContain('Do not redo the delegated work')
	})

	test('reports terminal child errors without calling them timeouts', async () => {
		const terminal = await loadPlugin({
			waitError: new Error('authentication failed'),
			waitState: 'error',
		})
		const failed = JSON.parse(
			await tool(terminal, 'pstack_run_agent').execute(
				{ role: 'how-explainer', prompt: 'explain fixture' },
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(failed).toMatchObject({
			status: 'error',
			threadID: 'T-child',
		})
		expect(failed.text).toContain('authentication failed')
		expect(failed.text).not.toContain('Timed out')
		expect(failed.text).not.toContain('still the owner')

		const unclassified = await loadPlugin({
			waitError: new Error('transport closed'),
			waitState: 'idle',
		})
		const unknownFailure = JSON.parse(
			await tool(unclassified, 'pstack_run_agent').execute(
				{ role: 'how-explainer', prompt: 'explain fixture' },
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(unknownFailure).toMatchObject({
			status: 'error',
			threadID: 'T-child',
		})
		expect(unknownFailure.text).toContain('transport closed')
		expect(unknownFailure.text).not.toContain('Timed out')
	})

	test('steer defaults on and can be declined', () => {
		expect(steerFrom(undefined)).toBe(true)
		expect(steerFrom(true)).toBe(true)
		expect(steerFrom(false)).toBe(false)
	})

	test('start_agent returns immediately and tells the child to report', async () => {
		const amp = await loadPlugin({ waitError: new Error('must not wait') })
		const result = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				implStart,
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(result).toMatchObject({
			role: 'feature',
			model: DEFAULT_MODELS.feature,
			threadID: 'T-child',
			parentThreadID: 'T-parent',
			scope: implStart.scope,
			executor: 'local',
			launchTarget: { kind: 'current-checkout' },
			next: START_AGENT_NEXT,
		})
		expect(result.next).toContain('Do not call wait_for_threads')
		expect(result.next).toContain('Continue only work that is independent')
		expect(result.next).toContain('Never redo or replace a live child')
		expect(amp.waited).toHaveLength(0)
		expect(amp.started).toHaveLength(1)
		expect(amp.started[0]?.prompt).toBe(
			backgroundChildPrompt('implement fixture', 'T-parent'),
		)
		expect(String(amp.started[0]?.prompt)).toContain('pstack_send_to_thread')
		expect(String(tool(amp, 'pstack_start_agent').description)).toContain(
			'Continue independent parent work',
		)
		expect(amp.created).toHaveLength(amp.preloadedAgentCount + 1)
		expect(amp.registeredModes).toHaveLength(amp.preloadedModeCount)
	})

	test('orb starts use and retain the exact agent published during plugin initialization', async () => {
		const amp = await loadPlugin()
		expect(amp.registeredModes.length).toBeGreaterThan(0)
		expect(amp.publishedModes).toEqual(amp.registeredModes)
		const expectedMode = orbAgentModeFor(
			'feature',
			DEFAULT_MODELS.feature,
		)
		const result = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'implement fixture',
					scope: 'index.ts',
					launchTarget: { kind: 'repo-independent-orb' },
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		const registration = amp.registeredModes.find(({ key }) => key === expectedMode.key)
		expect(result.threadID).toBe('T-child')
		expect(amp.started[0]).toMatchObject({ executor: 'orb' })
		expect(amp.created).toHaveLength(amp.preloadedAgentCount)
		expect(amp.registeredModes).toHaveLength(amp.preloadedModeCount)
		if (!registration) throw new Error('expected registered mode')
		expect(amp.initializedAgents).toContain(registration.agent)
		expect(registration?.active).toBe(true)
		expect(() => amp.flushOrbSelections()).not.toThrow()
	})

	test('blocking and panel orb launches use distinct startup-registered seats', async () => {
		const models = {
			'bug-fix': 'builtin:high',
			'interrogate-reviewers': ['builtin:high', 'builtin:high'],
		}
		const amp = await loadPlugin({ initialConfig: { [CONFIG_KEY]: models } })
		await tool(amp, 'pstack_start_agent').execute(
			{
				role: 'bug-fix',
				prompt: 'fix it',
				scope: 'src/bug.ts',
				launchTarget: { kind: 'repo-independent-orb' },
			},
			{ thread: { id: 'T-parent' } },
		)
		await tool(amp, 'pstack_run_panel').execute(
			{ panel: 'interrogate-reviewers', prompt: 'interrogate it', executor: 'orb' },
			{ thread: { id: 'T-parent' } },
		)
		const launchedModes = [
			orbAgentModeFor('bug-fix', 'builtin:high'),
			orbAgentModeFor('interrogate-reviewers-1', 'builtin:high'),
			orbAgentModeFor('interrogate-reviewers-2', 'builtin:high'),
		].map(({ key }) => amp.registeredModes.find((mode) => mode.key === key))
		expect(launchedModes.every(Boolean)).toBe(true)
		expect(launchedModes.every((mode) => amp.publishedModes.includes(mode as TestMode))).toBe(true)
		expect(new Set(amp.registeredModes.map(({ key }) => key)).size).toBe(
			amp.registeredModes.length,
		)
		expect(new Set(amp.registeredModes.map(({ label }) => label)).size).toBe(
			amp.registeredModes.length,
		)
		expect(amp.registeredModes.every(({ key }) => key.length <= 24)).toBe(true)
		expect(amp.registeredModes.every(({ label }) => label !== 'pstack delegate')).toBe(true)
		expect(amp.registeredModes.every(({ active }) => active)).toBe(true)
		expect(amp.registeredModes.every(({ agent }) => amp.initializedAgents.includes(agent))).toBe(true)
		expect(amp.created).toHaveLength(amp.preloadedAgentCount)
		expect(amp.started.every(({ executor }) => executor === 'orb')).toBe(true)
		expect(() => amp.flushOrbSelections()).not.toThrow()
	})

	test('orb registration remains active when child creation fails', async () => {
		const amp = await loadPlugin({ createError: new Error('create failed') })
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'implement fixture',
					scope: 'index.ts',
					launchTarget: { kind: 'repo-independent-orb' },
				},
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('create failed')
		expect(amp.started).toHaveLength(0)
		const expected = orbAgentModeFor('feature', DEFAULT_MODELS.feature)
		const registration = amp.registeredModes.find(({ key }) => key === expected.key)
		expect(registration?.active).toBe(true)
		expect(amp.publishedModes).toContain(registration as TestMode)
	})

	test('concurrent same-spec orb starts reuse one registered agent', async () => {
		const amp = await loadPlugin()
		const results = await Promise.all(
			['first', 'second'].map((prompt) =>
				tool(amp, 'pstack_start_agent').execute(
					{
						role: 'feature',
						prompt,
						scope: `scope-${prompt}`,
						launchTarget: { kind: 'repo-independent-orb' },
					},
					{ thread: { id: `T-parent-${prompt}` } },
				),
			),
		)
		expect(new Set(results.map((result) => JSON.parse(result).threadID)).size).toBe(2)
		expect(amp.created).toHaveLength(amp.preloadedAgentCount)
		expect(amp.registeredModes).toHaveLength(amp.preloadedModeCount)
		expect(amp.started).toHaveLength(2)
		expect(() => amp.flushOrbSelections()).not.toThrow()
	})

	test('model changes apply locally and require reload before orb use', async () => {
		const amp = await loadPlugin()
		const firstMode = orbAgentModeFor('bug-fix', DEFAULT_MODELS['bug-fix'])
		const firstRegistration = amp.registeredModes.find(({ key }) => key === firstMode.key)
		await tool(amp, 'pstack_start_agent').execute(
			{
				role: 'bug-fix',
				prompt: 'use model A',
				scope: 'src/bug-a.ts',
				launchTarget: { kind: 'repo-independent-orb' },
			},
			{ thread: { id: 'T-parent-a' } },
		)
		await tool(amp, 'pstack_configure_models').execute({
			action: 'set',
			overrides: { 'bug-fix': 'builtin:high' },
		})
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'bug-fix',
					prompt: 'use builtin',
					scope: 'src/bug-b.ts',
					launchTarget: { kind: 'repo-independent-orb' },
				},
				{ thread: { id: 'T-parent-b' } },
			),
		).rejects.toThrow(ORB_MODE_RELOAD_ERROR)
		expect(amp.registeredModes).toHaveLength(amp.preloadedModeCount)

		const local = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{
					role: 'bug-fix',
					prompt: 'use builtin locally',
					scope: 'src/bug-local.ts',
					launchTarget: { kind: 'current-checkout' },
				},
				{ thread: { id: 'T-parent-local' } },
			),
		)
		expect(local.model).toBe('builtin:high')
		expect(amp.created.at(-1)).toMatchObject({ extends: 'high' })
		expect(amp.registeredModes.every(({ active }) => active)).toBe(true)

		await tool(amp, 'pstack_configure_models').execute({
			action: 'set',
			overrides: { 'bug-fix': DEFAULT_MODELS['bug-fix'] },
		})
		await tool(amp, 'pstack_start_agent').execute(
			{
				role: 'bug-fix',
				prompt: 'use model A again',
				scope: 'src/bug-c.ts',
				launchTarget: { kind: 'repo-independent-orb' },
			},
			{ thread: { id: 'T-parent-c' } },
		)
		expect(amp.registeredModes).toHaveLength(amp.preloadedModeCount)
		expect(amp.initializedAgents.filter((agent) => agent === firstRegistration?.agent)).toHaveLength(1)
		expect(() => amp.flushOrbSelections()).not.toThrow()
	})

	test('send_to_thread steers the parent unless steer is false', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_send_to_thread').execute({
			threadID: 'T-parent',
			message: 'done',
		})
		await tool(amp, 'pstack_send_to_thread').execute({
			threadID: 'T-parent',
			message: 'note',
			steer: false,
		})
		expect(amp.sent).toEqual([
			{ threadID: 'T-parent', content: 'done', steer: true },
			{ threadID: 'T-parent', content: 'note', steer: false },
		])
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
		expect(JSON.parse(profiled).judgment).toBe('xai/grok-4.7')
		expect(JSON.parse(profiled)['arena-cross-judge']).toEqual([
			'xai/grok-4.7',
			'openai/gpt-5.6-sol',
		])
		await tool(amp, 'pstack_configure_models').execute({ action: 'reset' })
	})

	test('configure set returns the written overlay without rereading Amp config', async () => {
		const amp = await loadPlugin()
		amp.configuration.get = async () => ({})
		const updated = JSON.parse(
			await tool(amp, 'pstack_configure_models').execute({
				action: 'set',
				overrides: { feature: 'builtin:low', refactoring: 'builtin:high' },
			}),
		)
		expect(updated.feature).toBe('builtin:low')
		expect(updated.refactoring).toBe('builtin:high')
		expect(amp.config[CONFIG_KEY]).toEqual({ feature: 'builtin:low', refactoring: 'builtin:high' })
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
			expect(shown.judgment).toBe('xai/grok-4.7')
			expect(shown.hillclimb).toBe('builtin:low')
			expect(JSON.stringify(shown)).not.toContain('claude-fable')
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('webhook handler appends one structural envelope and keeps the URL out of transcript output', async () => {
		const amp = await loadPlugin()
		const appended: string[] = []
		const notifications: string[] = []
		const created = JSON.parse(
			await tool(amp, 'pstack_create_wake_webhook').execute(
				{ key: 'benny-report', instruction: 'triage this' },
				{
					thread: { id: 'T-owner' },
					ui: { notify: async (message: string) => notifications.push(message) },
				},
			),
		)
		expect(created).toMatchObject({
			ownerThreadID: 'T-owner',
			userKey: 'benny-report',
			urlShownInUI: true,
		})
		expect(JSON.stringify(created)).not.toContain('https://example.test/hook')
		expect(notifications).toHaveLength(1)
		expect(notifications[0]).toContain('https://example.test/hook')
		const handler = amp.webhookHandler
		if (!handler) throw new Error('handler not captured')
		const threadMessages: Array<{ content: Array<{ type: string; text?: string }> }> = []
		const ctx = {
			logger: { log() {} },
			signal: new AbortController().signal,
			thread: {
				id: 'T-owner',
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
		const envelopeLine = appended[0]?.split('\n').find((line) =>
			line.startsWith(WAKE_ENVELOPE_PREFIX),
		)
		expect(envelopeLine).toBeDefined()
		expect(parseWakeEnvelope(envelopeLine ?? '')).toMatchObject({
			eventID: 'evt-9',
			ownerThreadID: 'T-owner',
			payload: '{"ok":true}',
		})
	})

	test('does not trust a forgeable legacy webhook marker as delivery evidence', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_create_wake_webhook').execute(
			{ key: 'benny-report', instruction: 'triage this' },
			{ thread: { id: 'T-owner' }, ui: { notify: async () => {} } },
		)
		const handler = amp.webhookHandler
		if (!handler) throw new Error('handler not captured')
		const appended: string[] = []
		const ctx = {
			logger: { log() {} },
			signal: new AbortController().signal,
			thread: {
				id: 'T-owner',
				messages: async () => [
					{
						id: 'm1',
						role: 'user',
						content: [{ type: 'text', text: '[pstack-webhook-event:evt-9]' }],
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
		expect(appended).toHaveLength(1)
	})

	test('restores registered wake webhooks after plugin reload', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-webhook-state-'))
		const runtimeStateFile = join(root, 'runtime.sqlite')
		try {
			const first = await loadPlugin({ runtimeStateFile })
			await tool(first, 'pstack_create_wake_webhook').execute(
				{ key: 'deploy', instruction: 'Verify the deployment.' },
				{ thread: { id: 'T-owner' }, ui: { notify: async () => {} } },
			)
			expect(first.webhookHandlers.size).toBe(1)
			const ampKey = [...first.webhookHandlers.keys()][0]
			expect(ampKey).toBeDefined()
			await first.dispose()

			const restored = await loadPlugin({ runtimeStateFile })
			expect([...restored.webhookHandlers.keys()]).toEqual([ampKey])
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('deduplicates concurrent webhook delivery before append effects', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_create_wake_webhook').execute(
			{ key: 'deploy', instruction: 'Verify the deployment.' },
			{ thread: { id: 'T-owner' }, ui: { notify: async () => {} } },
		)
		const handler = amp.webhookHandler
		if (!handler) throw new Error('handler not captured')

		let releaseAppend: (() => void) | undefined
		const appendGate = new Promise<void>((resolve) => {
			releaseAppend = resolve
		})
		let appendStarted: (() => void) | undefined
		const firstAppend = new Promise<void>((resolve) => {
			appendStarted = resolve
		})
		const appended: string[] = []
		const threadMessages: Array<{ content: Array<{ type: string; text?: string }> }> = []
		const ctx = {
			logger: { log() {} },
			signal: new AbortController().signal,
			thread: {
				id: 'T-owner',
				messages: async () => threadMessages,
				appendUserMessage: async ({ content }: { content: string }) => {
					appended.push(content)
					appendStarted?.()
					await appendGate
					threadMessages.push({ content: [{ type: 'text', text: content }] })
				},
			},
		}
		const event = {
			id: 'evt-race',
			receivedAt: 'now',
			body: new TextEncoder().encode('{"status":"ready"}'),
		}

		const first = handler(event, ctx)
		await firstAppend
		const duplicate = handler(event, ctx)
		for (let turn = 0; turn < 6; turn += 1) await Promise.resolve()
		const attemptsBeforeRelease = appended.length
		releaseAppend?.()
		await Promise.all([first, duplicate])

		expect(attemptsBeforeRelease).toBe(1)
		expect(appended).toHaveLength(1)
	})

	test('recovers an appended webhook event beyond the first transcript page', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_create_wake_webhook').execute(
			{ key: 'deploy', instruction: 'Verify the deployment.' },
			{ thread: { id: 'T-owner' }, ui: { notify: async () => {} } },
		)
		const handler = amp.webhookHandler
		if (!handler) throw new Error('handler not captured')
		const messages: Array<{
			id: string
			role: 'user'
			content: Array<{ type: 'text'; text: string }>
		}> = []
		const firstContext = {
			logger: { log() {} },
			signal: new AbortController().signal,
			thread: {
				id: 'T-owner',
				messages: async () => messages,
				appendUserMessage: async ({ content }: { content: string }) => {
					messages.push({
						id: 'delivered',
						role: 'user',
						content: [{ type: 'text', text: content }],
					})
					throw new Error('append acknowledgement lost')
				},
			},
		}
		const event = {
			id: 'evt-crash-window',
			receivedAt: 'now',
			body: new TextEncoder().encode('{"status":"ready"}'),
		}
		await expect(handler(event, firstContext)).rejects.toThrow('append acknowledgement lost')
		for (let index = 0; index < 25; index += 1) {
			messages.push({
				id: `later-${index}`,
				role: 'user',
				content: [{ type: 'text', text: `later message ${index}` }],
			})
		}
		const duplicateAppends: string[] = []
		const recoveryContext = {
			logger: { log() {} },
			signal: new AbortController().signal,
			thread: {
				id: 'T-owner',
				messages: async ({
					from = 'end',
					offset = 0,
					limit = 10,
				}: {
					from?: 'start' | 'end'
					offset?: number
					limit?: number
				}) => {
					const size = Math.min(limit, 20)
					if (from === 'start') return messages.slice(offset, offset + size)
					const end = Math.max(0, messages.length - offset)
					return messages.slice(Math.max(0, end - size), end)
				},
				appendUserMessage: async ({ content }: { content: string }) => {
					duplicateAppends.push(content)
				},
			},
		}

		await handler(event, recoveryContext)

		expect(duplicateAppends).toHaveLength(0)
	})

	test('strict read-only roles use an allowlist, research keeps MCP, writers keep all tools', async () => {
		expect(capabilityFor('how-explorer')).toEqual({
			kind: 'strict-readonly',
			tools: { include: REPORTING_READONLY_TOOLS },
		})
		expect(capabilityFor('interrogate-reviewers-2')).toEqual({
			kind: 'strict-readonly',
			tools: { include: STRICT_READONLY_TOOLS },
		})
		expect(capabilityFor('comment-reviewer')).toEqual({
			kind: 'strict-readonly',
			tools: { include: STRICT_READONLY_TOOLS },
		})
		expect(capabilityFor('arena-cross-judge')).toEqual({
			kind: 'strict-readonly',
			tools: { include: REPORTING_READONLY_TOOLS },
		})
		expect(STRICT_READONLY_TOOLS).toContain('Read')
		expect(STRICT_READONLY_TOOLS).toContain('read_thread')
		expect(STRICT_READONLY_TOOLS).not.toContain('pstack_send_to_thread')
		expect(REPORTING_READONLY_TOOLS).toContain('pstack_send_to_thread')
		expect(STRICT_READONLY_TOOLS).not.toContain('shell_command')
		expect(STRICT_READONLY_TOOLS).not.toContain('mcp__linear__list')
		expect(capabilityFor('why-investigator')).toEqual({
			kind: 'research',
			tools: { exclude: [...WRITE_TOOLS] },
		})
		expect(capabilityFor('reflect-judgment').kind).toBe('research')
		expect(capabilityFor('reflect-divergent').kind).toBe('research')
		expect(capabilityFor('reflect-synthesizer').kind).toBe('research')
		expect(capabilityFor('feature')).toEqual({ kind: 'implementation', tools: 'all' })
		expect(capabilityFor('refactoring')).toEqual({ kind: 'implementation', tools: 'all' })
		expect(capabilityFor('architect-runners-1')).toEqual({ kind: 'implementation', tools: 'all' })
		const amp = await loadPlugin()
		await tool(amp, 'pstack_run_agent').execute(
			{ role: 'how-explorer', prompt: 'inspect it' },
			{ thread: { id: 'T-parent' } },
		)
		expect(amp.created.at(-1)).toMatchObject({ tools: { include: [...REPORTING_READONLY_TOOLS] } })
		await tool(amp, 'pstack_run_agent').execute(
			{ role: 'why-investigator', prompt: 'research it' },
			{ thread: { id: 'T-parent' } },
		)
		expect(amp.created.at(-1)).toMatchObject({ tools: { exclude: [...WRITE_TOOLS] } })
	})

	test('blocking implementation starts and empty implementation scopes are rejected', async () => {
		const amp = await loadPlugin()
		await expect(
			tool(amp, 'pstack_run_agent').execute(
				{ role: 'feature', prompt: 'implement it' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow(IMPLEMENTATION_BLOCKING_ERROR)
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'bug-fix', prompt: 'fix it', launchTarget: { kind: 'current-checkout' } },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('Missing scope')
	})

	test('one implementation owner wins concurrent starts and names the existing owner', async () => {
		const amp = await loadPlugin()
		const first = tool(amp, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } })
		const second = tool(amp, 'pstack_start_agent').execute(
			{
				role: 'bug-fix',
					prompt: 'other work',
					scope: 'other.ts',
					scopePaths: ['index.ts'],
					launchTarget: { kind: 'current-checkout' },
			},
			{ thread: { id: 'T-parent' } },
		)
		const settled = await Promise.allSettled([first, second])
		expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
		const rejected = settled.find((result) => result.status === 'rejected')
		expect(rejected?.status).toBe('rejected')
		if (rejected?.status !== 'rejected') throw new Error('expected a rejection')
		expect(String(rejected.reason)).toContain('Implementation resource')
		expect(String(rejected.reason)).toContain('scope')
	})

	test('allows independent implementation scopes under one parent', async () => {
		const amp = await loadPlugin()
		const first = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'implement alpha',
					scope: 'alpha',
					scopePaths: ['src/alpha.ts'],
					launchTarget: { kind: 'current-checkout' },
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		const second = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{
					role: 'bug-fix',
					prompt: 'implement beta',
					scope: 'beta',
					scopePaths: ['src/beta.ts'],
					launchTarget: { kind: 'current-checkout' },
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(first.threadID).toBe('T-child')
		expect(second.threadID).toBe('T-child-2')
	})

	test('rejects overlapping implementation scopes across parents', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_start_agent').execute(
			{
				role: 'feature',
				prompt: 'own the source tree',
				scope: 'source tree',
				scopePaths: ['src'],
				launchTarget: { kind: 'current-checkout' },
			},
			{ thread: { id: 'T-parent-a' } },
		)
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'bug-fix',
					prompt: 'overlap the source tree',
					scope: 'source file',
					scopePaths: ['src/alpha.ts'],
					launchTarget: { kind: 'current-checkout' },
				},
				{ thread: { id: 'T-parent-b' } },
			),
		).rejects.toThrow('resource')
	})

	test('allows parent writes outside child owned paths', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_start_agent').execute(
			{
				role: 'feature',
				prompt: 'own one source file',
				scope: 'alpha',
				scopePaths: ['src/alpha.ts'],
				launchTarget: { kind: 'current-checkout' },
			},
			{ thread: { id: 'T-parent' } },
		)
		const unrelated = await amp.emit('tool.call', {
			tool: 'edit_file',
			thread: { id: 'T-parent' },
			input: {},
			filesModified: ['file:///workspace/docs/readme.md'],
		})
		expect(unrelated).toEqual({ action: 'allow' })

		const overlapping = await amp.emit('tool.call', {
			tool: 'edit_file',
			thread: { id: 'T-parent' },
			input: {},
			filesModified: ['file:///workspace/src/alpha.ts'],
		})
		expect(overlapping).toMatchObject({ action: 'reject-and-continue' })
	})

	test('restores live workflow ownership after plugin reload', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-runtime-state-'))
		const runtimeStateFile = join(root, 'runtime.sqlite')
		try {
			const first = await loadPlugin({ runtimeStateFile })
			await tool(first, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'own alpha across reload',
					scope: 'alpha',
					scopePaths: ['src/alpha.ts'],
					launchTarget: { kind: 'current-checkout' },
				},
				{ thread: { id: 'T-parent' } },
			)
			await first.dispose()

			const restored = await loadPlugin({ runtimeStateFile })
			await expect(
				tool(restored, 'pstack_start_agent').execute(
					{
						role: 'bug-fix',
						prompt: 'duplicate alpha after reload',
						scope: 'alpha replacement',
						scopePaths: ['src/alpha.ts'],
						launchTarget: { kind: 'current-checkout' },
					},
					{ thread: { id: 'T-parent-2' } },
				),
			).rejects.toThrow('resource')
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('create failure releases ownership while ambiguous append failure retains it', async () => {
		const created = await loadPlugin({ createError: new Error('create failed') })
		await expect(
			tool(created, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } }),
		).rejects.toThrow('create failed')
		await expect(
			tool(created, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } }),
		).rejects.toThrow('create failed')

		const appended = await loadPlugin({ appendError: new Error('append failed') })
		await expect(
			tool(appended, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } }),
		).rejects.toThrow('append failed')
		await expect(
			tool(appended, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } }),
		).rejects.toThrow('Implementation resource')
		expect(appended.started).toHaveLength(1)
	})

	test('child state ignores initial idle, retains ownership on timeout, and releases after running', async () => {
		const amp = await loadPlugin({ waitError: new Error('wait expired') })
		await tool(amp, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } })
		const child = amp.started[0] as { emit: (state: string) => void }
		child.emit('idle')
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'bug-fix',
					prompt: 'second',
					scope: 'other.ts',
					scopePaths: ['index.ts'],
					launchTarget: { kind: 'current-checkout' },
				},
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('Implementation resource')

		const timeout = await loadPlugin({
			waitError: new Error('wait expired'),
			waitState: 'running',
		})
		const timed = JSON.parse(
			await tool(timeout, 'pstack_run_agent').execute(
				{ role: 'how-explainer', prompt: 'explain it' },
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(timed.status).toBe('timeout')
		await expect(
			tool(timeout, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } }),
		).resolves.toBeDefined()

		const released = await loadPlugin()
		await tool(released, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } })
		const running = released.started[0] as { emit: (state: string) => void }
		running.emit('running')
		running.emit('idle')
		const again = JSON.parse(
			await tool(released, 'pstack_start_agent').execute(
				{
					role: 'bug-fix',
					prompt: 'next',
					scope: 'other.ts',
					launchTarget: { kind: 'current-checkout' },
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(again.role).toBe('bug-fix')

		const errored = await loadPlugin()
		await tool(errored, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } })
		const errChild = errored.started[0] as { emit: (state: string) => void }
		errChild.emit('awaiting-approval')
		errChild.emit('error')
		const afterError = JSON.parse(
			await tool(errored, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } }),
		)
		expect(afterError.threadID).toBe('T-child-2')
	})

	test('parent writes and helper-recognized mutations are rejected while an owner is live', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } })
		const write = await amp.emit('tool.call', {
			tool: 'apply_patch',
			thread: { id: 'T-parent' },
			input: {},
		})
		expect(write).toMatchObject({ action: 'reject-and-continue' })
		expect(String((write as { message: string }).message)).toContain('T-child')
		const mutation = await amp.emit('tool.call', {
			tool: 'shell_command',
			thread: { id: 'T-parent' },
			input: { command: "sed -i 's/a/b/' file.ts" },
			filesModified: ['file://index.ts'],
		})
		expect(mutation).toMatchObject({ action: 'reject-and-continue' })
		const shell = await amp.emit('tool.call', {
			tool: 'shell_command',
			thread: { id: 'T-parent' },
			input: { command: 'echo hi' },
		})
		expect(shell).toEqual({ action: 'allow' })
		expect(ARBITRARY_SHELL_GAP).toContain('Arbitrary shell_command is not classified as a write')
	})

	test('strict read-only children reject writes if invoked', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_start_agent').execute(
			{ role: 'how-explorer', prompt: 'read it' },
			{ thread: { id: 'T-parent' } },
		)
		const rejected = await amp.emit('tool.call', {
			tool: 'edit_file',
			thread: { id: 'T-child' },
			input: {},
		})
		expect(rejected).toMatchObject({ action: 'reject-and-continue' })
	})

	test('remote parents keep plugin children in orbs and reject local routing', async () => {
		const background = await loadPlugin({ executorKind: 'remote' })
		const implementation = JSON.parse(
			await tool(background, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'implement from the parent project base',
					scope: 'index.ts routing',
				},
				{ thread: { id: 'T-remote-parent' } },
			),
		)
		expect(implementation).toMatchObject({
			executor: 'orb',
			launchTarget: { kind: 'parent-project-orb' },
		})
		expect(background.started[0]).toMatchObject({ executor: 'orb' })
		background.flushOrbSelections()
		await expect(
			tool(background, 'pstack_start_agent').execute(
				{
					role: 'bug-fix',
					prompt: 'incorrectly request the orb checkout as local',
					scope: 'src/bug.ts',
					launchTarget: { kind: 'current-checkout' },
				},
				{ thread: { id: 'T-other-remote-parent' } },
			),
		).rejects.toThrow('current-checkout is unavailable when the parent runs in an orb')
		await expect(
			tool(background, 'pstack_start_agent').execute(
				{
					role: 'how-explorer',
					prompt: 'contradictory explicit routing',
					executor: 'local',
					launchTarget: { kind: 'repo-independent-orb' },
				},
				{ thread: { id: 'T-other-remote-parent' } },
			),
		).rejects.toThrow('executor local is unavailable when the parent runs in an Amp-managed orb')

		const blocking = await loadPlugin({ executorKind: 'remote' })
		await tool(blocking, 'pstack_run_agent').execute(
			{ role: 'how-explainer', prompt: 'explain it' },
			{ thread: { id: 'T-remote-parent' } },
		)
		expect(blocking.started[0]).toMatchObject({ executor: 'orb' })
		blocking.flushOrbSelections()
		await expect(
			tool(blocking, 'pstack_run_agent').execute(
				{ role: 'how-explainer', prompt: 'wrong executor', executor: 'local' },
				{ thread: { id: 'T-remote-parent' } },
			),
		).rejects.toThrow('executor local is unavailable when the parent runs in an Amp-managed orb')

		const panel = await loadPlugin({ executorKind: 'remote' })
		await tool(panel, 'pstack_run_panel').execute(
			{ panel: 'interrogate-reviewers', prompt: 'review it' },
			{ thread: { id: 'T-remote-parent' } },
		)
		expect(panel.started).not.toHaveLength(0)
		expect(panel.started.every((thread) => thread.executor === 'orb')).toBe(true)
		panel.flushOrbSelections()
		await expect(
			tool(panel, 'pstack_run_panel').execute(
				{ panel: 'interrogate-reviewers', prompt: 'wrong executor', executor: 'local' },
				{ thread: { id: 'T-remote-parent' } },
			),
		).rejects.toThrow('executor local is unavailable when the parent runs in an Amp-managed orb')
	})

	test('routes named runners through native create_thread and rejects blocking recursion', async () => {
		const runner = { type: 'runner', id: 'mac-mini' }

		const background = await loadPlugin()
		const started = JSON.parse(
			await tool(background, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'implement on the hardware runner',
					scope: 'src/hardware.ts',
					launchTarget: { kind: 'named-runner', runnerId: runner.id },
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		const expectedMode = orbAgentModeFor(
			'feature',
			DEFAULT_MODELS.feature,
		)
		expect(started).toMatchObject({
			action: 'use-native-create-thread',
			launchTarget: { kind: 'named-runner', runnerId: runner.id },
			create_thread: {
				executor: 'runner',
				runner_id: runner.id,
				agent_mode: expectedMode.key,
				intent: 'delegation',
				prompt: backgroundChildPrompt('implement on the hardware runner', 'T-parent'),
			},
		})
		expect(background.started).toHaveLength(0)

		const blocking = await loadPlugin()
		await expect(
			tool(blocking, 'pstack_run_agent').execute(
				{ role: 'how-explainer', prompt: 'explain on the runner', executor: runner },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('pstack_start_agent')

		const panel = await loadPlugin()
		await expect(
			tool(panel, 'pstack_run_panel').execute(
				{ panel: 'arena-runners', prompt: 'review on the runner', executor: runner },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('pstack_start_agent')

		await expect(
			tool(blocking, 'pstack_run_agent').execute(
				{ role: 'how-explainer', prompt: 'bad runner', executor: { type: 'runner', id: ' ' } },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('runner executor requires a non-empty id')
	})

	test('distinguishes remote runners from Amp orbs', async () => {
		const runnerParent = await loadPlugin({
			executorKind: 'remote',
			keepAliveError: new Error('not an Amp-managed orb'),
		})
		const runnerChild = JSON.parse(
			await tool(runnerParent, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'stay on the current runner checkout',
					scope: 'src/runner.ts',
				},
				{ thread: { id: 'T-runner-parent' } },
			),
		)
		expect(runnerChild).toMatchObject({
			executor: 'local',
			launchTarget: { kind: 'current-checkout' },
		})
		expect(runnerParent.started[0]).toMatchObject({ executor: 'local' })

		const orbParent = await loadPlugin({ executorKind: 'remote' })
		const orbChild = JSON.parse(
			await tool(orbParent, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'use a fresh child orb',
					scope: 'src/orb.ts',
				},
				{ thread: { id: 'T-orb-parent' } },
			),
		)
		expect(orbChild).toMatchObject({
			executor: 'orb',
			launchTarget: { kind: 'parent-project-orb' },
		})
		expect(orbParent.started[0]).toMatchObject({ executor: 'orb' })
		orbParent.flushOrbSelections()

		const unknownParent = await loadPlugin({ executorKind: 'unknown' })
		await expect(
			tool(unknownParent, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'ambiguous placement',
					scope: 'src/unknown.ts',
				},
				{ thread: { id: 'T-unknown-parent' } },
			),
		).rejects.toThrow('explicit execution target')
	})

	test('local parents retain current-checkout and honor an explicit orb request', async () => {
		const local = await loadPlugin({ executorKind: 'local' })
		const implementation = JSON.parse(
			await tool(local, 'pstack_start_agent').execute(
				{ role: 'feature', prompt: 'local work', scope: 'index.ts routing' },
				{ thread: { id: 'T-local-parent' } },
			),
		)
		expect(implementation).toMatchObject({
			executor: 'local',
			launchTarget: { kind: 'current-checkout' },
		})

		const orb = await loadPlugin({ executorKind: 'local' })
		const explicit = JSON.parse(
			await tool(orb, 'pstack_start_agent').execute(
				{
					role: 'bug-fix',
					prompt: 'clean remote-base work',
					scope: 'src/bug.ts',
					executor: 'orb',
				},
				{ thread: { id: 'T-local-parent' } },
			),
		)
		expect(explicit).toMatchObject({
			executor: 'orb',
			launchTarget: { kind: 'parent-project-orb' },
		})
		expect(orb.started[0]).toMatchObject({ executor: 'orb' })
		orb.flushOrbSelections()
	})

	test('current-checkout is local, repo-independent-orb is explicit, native redirect and unsupported base branch are honest', async () => {
		const amp = await loadPlugin()
		const local = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'local work',
					scope: 'index.ts',
					executor: 'orb',
					launchTarget: { kind: 'current-checkout' },
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(local.executor).toBe('local')
		expect(amp.started[0]).toMatchObject({ executor: 'local' })

		const other = await loadPlugin()
		const orb = JSON.parse(
			await tool(other, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'independent',
					scope: 'index.ts',
					launchTarget: { kind: 'repo-independent-orb' },
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(orb.executor).toBe('orb')
		expect(orb.next).toContain('must not depend on a checkout')
		expect(other.started[0]).toMatchObject({ executor: 'orb' })

		const redirected = await loadPlugin()
		const native = JSON.parse(
			await tool(redirected, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'sized orb',
					scope: 'index.ts',
					launchTarget: { kind: 'native-orb', orbSize: 'a1.large', project: 'amp/pstack' },
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		const expectedMode = orbAgentModeFor(
			'feature',
			DEFAULT_MODELS.feature,
		)
		expect(native).toMatchObject({
			action: 'use-native-create-thread',
			create_thread: {
				executor: 'orb',
				orb_size: 'a1.large',
				project: 'amp/pstack',
				agent_mode: expectedMode.key,
				prompt: backgroundChildPrompt('sized orb', 'T-parent'),
				intent: 'delegation',
			},
		})
		expect(native.next).toContain('Arbitrary native threads bypass')
		expect(redirected.started).toHaveLength(0)
		expect(redirected.registeredModes).toHaveLength(redirected.preloadedModeCount)
		expect(
			redirected.registeredModes.find(({ key }) => key === expectedMode.key)?.active,
		).toBe(true)
		await expect(
			tool(redirected, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } }),
		).rejects.toThrow('conflicts with')

		const unsupported = JSON.parse(
			await tool(await loadPlugin(), 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'branch',
					scope: 'index.ts',
					cloudBaseBranch: 'origin/main',
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(unsupported).toMatchObject({
			action: 'unsupported',
			field: 'cloudBaseBranch',
			branch: 'origin/main',
		})
		await expect(
			tool(await loadPlugin(), 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'missing project',
					scope: 'index.ts',
					launchTarget: { kind: 'native-orb', orbSize: 'a1.small' },
				},
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('native-orb launchTarget requires a project')

		const overridden = await loadPlugin()
		const custom = JSON.parse(
			await tool(overridden, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'custom mode',
					scope: 'index.ts',
					launchTarget: {
						kind: 'native-orb',
						project: 'amp/pstack',
						agentMode: 'custom-reviewer',
					},
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(custom.create_thread.agent_mode).toBe('custom-reviewer')
		expect(custom.agentModeOverride).toBe(true)
		expect(overridden.registeredModes).toHaveLength(overridden.preloadedModeCount)
	})

	test('exact matching native create_thread pairs while unrelated native calls bypass it', async () => {
		const amp = await loadPlugin()
		const native = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'native',
					scope: 'index.ts',
					launchTarget: { kind: 'native-orb', orbSize: 'a1.medium', project: 'amp/pstack' },
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		const mismatch = await amp.emit('tool.call', {
			tool: 'create_thread',
			toolUseID: 'toolu_other',
			thread: { id: 'T-parent' },
			input: { executor: 'orb', agent_mode: 'something-else' },
		})
		expect(mismatch).toEqual({ action: 'allow' })
		await expect(
			tool(amp, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } }),
		).rejects.toThrow('conflicts with')
		await amp.emit('tool.call', {
			tool: 'create_thread',
			toolUseID: 'toolu_match',
			thread: { id: 'T-parent' },
			input: native.create_thread,
		})
		await amp.emit('tool.result', {
			tool: 'create_thread',
			toolUseID: 'toolu_match',
			thread: { id: 'T-parent' },
			status: 'done',
			output: [{ type: 'text', text: '{"threadID":"T-native"}' }],
		})
		await expect(
			tool(amp, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } }),
		).rejects.toThrow('T-native')
	})

	test('design panels require arena-cross-judge and clear after the judge is terminal', async () => {
		const amp = await loadPlugin({
			initialConfig: { [CONFIG_KEY]: { 'architect-runners': ['builtin:high', 'builtin:medium'] } },
		})
		const panel = JSON.parse(
			await tool(amp, 'pstack_run_panel').execute(
				{ panel: 'architect-runners', prompt: 'sketch it' },
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(panel).toHaveLength(2)
		const continued = await amp.emit('agent.end', { thread: { id: 'T-parent' } })
		expect(continued).toMatchObject({ action: 'continue' })
		expect(String((continued as { userMessage: string }).userMessage)).toContain('arena-cross-judge')
		expect(String((continued as { userMessage: string }).userMessage)).toContain('T-child')
		await expect(
			tool(amp, 'pstack_run_panel').execute(
				{ panel: 'arena-runners', prompt: 'replace it' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('A design run is already live')
		await tool(amp, 'pstack_start_agent').execute(
			{ role: 'arena-cross-judge', prompt: 'judge it' },
			{ thread: { id: 'T-parent' } },
		)
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toBeUndefined()
		const judge = amp.started.at(-1) as { emit: (state: string) => void }
		judge.emit('running')
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toBeUndefined()
		judge.emit('idle')
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toBeUndefined()
	})

	test('keeps timed-out design candidates pending until every child is terminal', async () => {
		const amp = await loadPlugin({
			initialConfig: {
				[CONFIG_KEY]: {
					'architect-runners': ['builtin:high', 'builtin:medium'],
				},
			},
			waitError: new Error('panel wait expired'),
			waitState: 'running',
		})
		const panel = JSON.parse(
			await tool(amp, 'pstack_run_panel').execute(
				{ panel: 'architect-runners', prompt: 'sketch it' },
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(panel.map(({ status }: { status: string }) => status)).toEqual([
			'timeout',
			'timeout',
		])
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toBeUndefined()
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'arena-cross-judge', prompt: 'judge too early' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('design candidates are still running')

		const first = amp.started[0] as { emit: (state: string) => void }
		first.emit('idle')
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'arena-cross-judge', prompt: 'still too early' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('design candidates are still running')

		const second = amp.started[1] as { emit: (state: string) => void }
		second.emit('idle')
		expect(amp.sent).toHaveLength(1)
		expect(amp.sent[0]).toMatchObject({
			threadID: 'T-parent',
			steer: true,
		})
		const judge = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{ role: 'arena-cross-judge', prompt: 'judge completed candidates' },
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(judge.threadID).toBe('T-child-3')
	})

	test('idles while a cross-judge runs and recovers a failed judge', async () => {
		const amp = await loadPlugin({
			initialConfig: { [CONFIG_KEY]: { 'architect-runners': ['builtin:high'] } },
		})
		await tool(amp, 'pstack_run_panel').execute(
			{ panel: 'architect-runners', prompt: 'sketch it' },
			{ thread: { id: 'T-parent' } },
		)
		await tool(amp, 'pstack_start_agent').execute(
			{ role: 'arena-cross-judge', prompt: 'judge it' },
			{ thread: { id: 'T-parent' } },
		)
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toBeUndefined()
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'arena-cross-judge', prompt: 'duplicate judge' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('already reserved or running')

		const judge = amp.started.at(-1) as { emit: (state: string) => void }
		judge.emit('running')
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toBeUndefined()
		const sentBeforeFailure = amp.sent.length
		judge.emit('error')
		expect(amp.sent).toHaveLength(sentBeforeFailure + 1)
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toMatchObject({
			action: 'continue',
		})
		const replacement = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{ role: 'arena-cross-judge', prompt: 'replacement judge' },
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(replacement.threadID).toBe('T-child-3')
	})

	test('restores missing and live cross-judge gates after plugin reload', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-design-state-'))
		try {
			const requiredState = join(root, 'required.sqlite')
			const required = await loadPlugin({
				runtimeStateFile: requiredState,
				initialConfig: { [CONFIG_KEY]: { 'architect-runners': ['builtin:high'] } },
			})
			await tool(required, 'pstack_run_panel').execute(
				{ panel: 'architect-runners', prompt: 'sketch required' },
				{ thread: { id: 'T-required-parent' } },
			)
			await required.dispose()

			const restoredRequired = await loadPlugin({ runtimeStateFile: requiredState })
			expect(
				await restoredRequired.emit('agent.end', {
					thread: { id: 'T-required-parent' },
				}),
			).toMatchObject({ action: 'continue' })

			const judgingState = join(root, 'judging.sqlite')
			const judging = await loadPlugin({
				runtimeStateFile: judgingState,
				initialConfig: { [CONFIG_KEY]: { 'architect-runners': ['builtin:high'] } },
			})
			await tool(judging, 'pstack_run_panel').execute(
				{ panel: 'architect-runners', prompt: 'sketch judging' },
				{ thread: { id: 'T-judging-parent' } },
			)
			await tool(judging, 'pstack_start_agent').execute(
				{ role: 'arena-cross-judge', prompt: 'judge across reload' },
				{ thread: { id: 'T-judging-parent' } },
			)
			await judging.dispose()

			const restoredJudging = await loadPlugin({ runtimeStateFile: judgingState })
			expect(
				await restoredJudging.emit('agent.end', {
					thread: { id: 'T-judging-parent' },
				}),
			).toBeUndefined()
			await expect(
				tool(restoredJudging, 'pstack_start_agent').execute(
					{ role: 'arena-cross-judge', prompt: 'duplicate after reload' },
					{ thread: { id: 'T-judging-parent' } },
				),
			).rejects.toThrow('already reserved or running')
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('native cross-judge redirect is paired and keeps the parent gated until terminal', async () => {
		const amp = await loadPlugin({
			initialConfig: { [CONFIG_KEY]: { 'architect-runners': ['builtin:high'] } },
		})
		const panel = JSON.parse(
			await tool(amp, 'pstack_run_panel').execute(
				{ panel: 'architect-runners', prompt: 'sketch it' },
				{ thread: { id: 'T-parent' } },
			),
		)
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'arena-cross-judge',
					prompt: 'wrong mode',
					launchTarget: {
						kind: 'native-orb',
						project: 'amp/pstack',
						agentMode: 'custom-reviewer',
					},
				},
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('must use its registered pstack mode')
		const native = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{
					role: 'arena-cross-judge',
					prompt: 'judge it',
					launchTarget: { kind: 'native-orb', project: 'amp/pstack', orbSize: 'a1.small' },
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(native.action).toBe('use-native-create-thread')
		expect(amp.registeredModes).toHaveLength(amp.preloadedModeCount)
		const awaitingCall = await amp.emit('agent.end', { thread: { id: 'T-parent' } })
		expect(String((awaitingCall as { userMessage: string }).userMessage)).toContain(
			'Call native create_thread next',
		)
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'arena-cross-judge', prompt: 'duplicate judge' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('already reserved or running')
		await amp.emit('tool.call', {
			tool: 'create_thread',
			toolUseID: 'toolu_native_judge',
			thread: { id: 'T-parent' },
			input: native.create_thread,
		})
		const awaitingResult = await amp.emit('agent.end', { thread: { id: 'T-parent' } })
		expect(String((awaitingResult as { userMessage: string }).userMessage)).toContain(
			'toolu_native_judge',
		)
		await amp.emit('tool.result', {
			tool: 'create_thread',
			toolUseID: 'toolu_native_judge',
			thread: { id: 'T-parent' },
			status: 'done',
			output: { threadID: panel[0].threadID },
		})
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toBeUndefined()
		const judge = amp.started[0] as { emit: (state: string) => void }
		judge.emit('running')
		judge.emit('idle')
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toBeUndefined()
	})

	test('plugin dispose clears process resources without reopening the disposed instance', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } })
		await tool(amp, 'pstack_run_agent').execute(
			{ role: 'comment-reviewer', prompt: 'review it', executor: 'orb' },
			{ thread: { id: 'T-review-parent' } },
		)
		expect(amp.registeredModes).toHaveLength(amp.preloadedModeCount)
		await amp.dispose()
		expect(amp.logs.some((line) => line.includes('Discarding'))).toBe(true)
		expect(amp.registeredModes.every(({ active }) => !active)).toBe(true)
	})
})
