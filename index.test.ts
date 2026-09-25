import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
	PLUGIN_MODEL_FILE,
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
	MODEL_REASONING_EFFORT,
	NATIVE_AGENT_MODES,
	modelFamily,
	orbAgentModeFor,
	orbAgentSpecsFor,
	profileModels,
	readJsonFile,
	resolveModels,
	selectPoolModel,
	storedModelMap,
	timeoutFrom,
	validateModel,
	validateOverrides,
	workspaceRootPath,
} from './index'
import { RuntimeStore } from './runtime-store'
import { startCliRun } from './cli-backends'
import { createThreadInputMatches, exactCreateThreadInputMatches } from './workflow-parity'
import { parseWakeEnvelope, WAKE_ENVELOPE_PREFIX } from './webhook-runtime'

test('native reservation matchers distinguish expected-field subsets from exact background input', () => {
	const expected = { prompt: 'work', options: { project: 'amp/pstack' } }
	const input = { prompt: 'work', options: { project: 'amp/pstack', nativeDefault: true }, unrelated: true }

	expect(createThreadInputMatches(input, expected)).toBe(true)
	expect(exactCreateThreadInputMatches(input, expected)).toBe(false)
	expect(createThreadInputMatches({ ...input, options: { project: 'other' } }, expected)).toBe(false)
})

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
		expect(DEFAULT_MODELS.judgment).toBe('anthropic/claude-opus-5-5')
		expect(DEFAULT_MODELS['how-explainer']).toBe('anthropic/claude-opus-5-5')
		expect(DEFAULT_MODELS['comment-reviewer']).toBe('anthropic/claude-opus-5-5')
		expect(DEFAULT_MODELS['arena-runners']).toEqual([
			'anthropic/claude-opus-5-5',
			'openai/gpt-6-sol',
			'xai/grok-4.7',
		])
		expect(DEFAULT_MODELS['arena-runners']).toHaveLength(3)
		expect(DEFAULT_MODELS['reflect-tooling']).toBe('openai/gpt-6-sol')
		expect(MODEL_REASONING_EFFORT).toEqual({
			'anthropic/claude-opus-5-5': 'max',
			'openai/gpt-6-sol': 'max',
			'xai/grok-4.7': 'xhigh',
		})
		expect(JSON.stringify(DEFAULT_MODELS)).not.toContain('claude-fable')
		expect(JSON.stringify(DEFAULT_MODELS)).not.toContain('gpt-5.6-sol')
		expect(JSON.stringify(DEFAULT_MODELS)).not.toContain('builtin:')
		expect(JSON.stringify(CHEAP_MODELS)).not.toContain('claude-opus')
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
			await pstack(amp, { selectBackend: async () => 'amp' })
		} finally {
			if (previousStateFile === undefined) delete process.env.PSTACK_STATE_FILE
			else process.env.PSTACK_STATE_FILE = previousStateFile
		}

		expect(skills).toEqual([...SKILL_PATHS])
		expect(modes).toEqual([
			...orbAgentSpecsFor({ ...DEFAULT_MODELS }).map(({ role, model }) => orbAgentModeFor(role, model).key),
			...NATIVE_AGENT_MODES.map(({ key }) => key),
		])
		expect(new Set(modes).size).toBe(modes.length)
		expect(tools).toEqual([
			'pstack_run_agent',
			'pstack_run_panel',
			'pstack_start_agent',
			'pstack_stop_agent',
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

	test('drops unknown stored keys but preserves invalid known-role choices for use-time errors', () => {
		expect(
			storedModelMap({
				'bug-fix': 'openai/gpt-5.6-sol',
				mystery: 'xai/grok-4.7',
				hillclimb: 'nope',
			}),
		).toEqual({ 'bug-fix': 'openai/gpt-5.6-sol', hillclimb: 'nope' })
		expect(mergeModels({ hillclimb: 'nope' }).hillclimb).toBe('nope')
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
		).toEqual({ model: 'openai/gpt-5.6-sol', seat: 3 })
		expect(selectPoolModel(['builtin:high', 'xai/grok-4.7'], 'xai/grok-4.5')).toEqual({
			model: 'builtin:high',
			seat: 1,
		})
		expect(selectPoolModel(['builtin:high', 'xai/grok-4.7'])).toEqual({ model: 'builtin:high', seat: 1 })
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
		expect(cheap.hardest).toBe('openai/gpt-5.6-sol')
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

	test('seat layers replace whole roles without zipping effort across layers', () => {
		expect(resolveModels({
			pluginFile: { 'arena-runners': [{ model: 'openai/gpt-6-sol', effort: 'low' }, { model: 'xai/grok-4.7', effort: 'high' }] },
			userFile: { 'arena-runners': ['anthropic/claude-opus-5-5'] },
		})['arena-runners']).toEqual(['anthropic/claude-opus-5-5'])
		expect(resolveModels({
			pluginFile: { feature: { model: 'openai/gpt-6-sol', effort: 'low' } },
			stored: { feature: 'xai/grok-4.7' },
		}).feature).toBe('xai/grok-4.7')
	})

	test('validates explicit model effort pairs and leaves unknown model defaults to Amp', () => {
		expect(() => validateOverrides({ feature: { model: 'anthropic/claude-opus-5-5', effort: 'none' } })).toThrow(
			'feature: model anthropic/claude-opus-5-5 does not support effort none',
		)
		expect(() => validateOverrides({ feature: { model: 'anthropic/claude-opus-5-5', effort: 'minimal' } })).toThrow(
			'feature: model anthropic/claude-opus-5-5 does not support effort minimal',
		)
		expect(() => validateOverrides({ feature: { model: 'openai/gpt-6-sol', effort: 'minimal' } })).toThrow(
			'feature: model openai/gpt-6-sol does not support effort minimal',
		)
		expect(() => validateOverrides({ feature: { model: 'xai/grok-4.7', effort: 'max' } })).toThrow(
			'feature: model xai/grok-4.7 does not support effort max',
		)
		expect(() => validateOverrides({ feature: { model: 'xai/grok-4.7', effort: 'minimal' } })).toThrow(
			'feature: model xai/grok-4.7 does not support effort minimal',
		)
		expect(() => validateOverrides({ feature: { model: 'other/future', effort: 'turbo' } as never })).toThrow(
			'Invalid effort for feature: turbo',
		)
		expect(() => validateOverrides({ feature: { model: 'builtin:high', effort: 'high' } })).toThrow(
			'feature: builtin builtin:high cannot carry effort high',
		)
		expect(orbAgentSpecsFor({ feature: { model: 'other/future' } })).toEqual([
			{ role: 'feature', model: 'other/future', effort: undefined },
		])
		expect(validateOverrides({ feature: { model: 'other/future', effort: 'max' } })).toEqual({
			feature: { model: 'other/future', effort: 'max' },
		})
	})

	test('same model with different effort remains distinct in panels and pools', () => {
		const seats = [
			{ model: 'openai/gpt-6-sol', effort: 'low' as const },
			{ model: 'openai/gpt-6-sol', effort: 'max' as const },
		]
		expect(orbAgentSpecsFor({ 'architect-runners': seats })).toEqual([
			{ role: 'architect-runners-1', ...seats[0] },
			{ role: 'architect-runners-2', ...seats[1] },
		])
		expect(orbAgentSpecsFor({ 'arena-cross-judge': seats })).toEqual([
			{ role: 'arena-cross-judge', ...seats[0] },
			{ role: 'arena-cross-judge', ...seats[1] },
		])
		expect(orbAgentModeFor('feature', seats[0].model, seats[0].effort)).not.toEqual(
			orbAgentModeFor('feature', seats[1].model, seats[1].effort),
		)
	})

	test('missing plugin json leaves the shipped defaults', async () => {
		expect(await Bun.file(PLUGIN_MODEL_FILE).exists()).toBe(false)
		const root = await mkdtemp(join(tmpdir(), 'pstack-no-plugin-'))
		try {
			const layers = await loadFileLayers(null, join(root, 'absent-user.json'), PLUGIN_MODEL_FILE)
			expect(layers.pluginFile).toBeUndefined()
			expect(resolveModels(layers)).toEqual(DEFAULT_MODELS)
			expect(resolveModels(layers)['comment-reviewer']).toBe('anthropic/claude-opus-5-5')
			expect(resolveModels(layers)['reflect-tooling']).toBe('openai/gpt-6-sol')
		} finally {
			await rm(root, { recursive: true, force: true })
		}
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
		appendHook?: (threadID: string, content: string) => Promise<void>
		initialConfig?: Record<string, unknown>
		backends?: Parameters<typeof pstack>[1]
		executorKind?: 'local' | 'remote' | 'unknown'
		keepAliveError?: Error
		runtimeStateFile?: string
		restoredThreadStates?: Record<string, 'idle' | 'running' | 'awaiting-approval' | 'error'>
		restoredThreadMessages?: Record<string, Array<Record<string, unknown>>>
		restoredMessageError?: Record<string, Error>
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
								assistantText: `assistant:${definition.instructions}`,
								assistantMessages: undefined as string[] | undefined,
								transcriptMessages: undefined as Array<Record<string, unknown>> | undefined,
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
							cancelCount: 0,
							async cancel() {
								thread.cancelCount += 1
							},
								async messages(options: { from?: 'start' | 'end'; limit?: number; offset?: number } = {}) {
									const limit = options.limit ?? 10
									const offset = options.offset ?? 0
									if (limit > 20) throw new Error('messages limit exceeds host maximum of 20')
									const messages = thread.transcriptMessages ?? (thread.assistantMessages ?? [thread.assistantText]).map((text, index) => ({
										id: `M-${thread.id}-${index}`,
										role: 'assistant',
										content: [{ type: 'text', text }],
									}))
									if (options.from === 'start') return messages.slice(offset, offset + limit)
									const end = Math.max(0, messages.length - offset)
									return messages.slice(Math.max(0, end - limit), end)
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
						async cancel() { sent.push({ threadID, canceled: true }) },
						async messages({
							from = 'end',
							limit = 10,
							offset = 0,
						}: { from?: 'start' | 'end'; limit?: number; offset?: number } = {}) {
							if (limit > 20) throw new Error('messages limit exceeds host maximum of 20')
							const failure = options?.restoredMessageError?.[threadID]
							if (failure) throw failure
							const messages = options?.restoredThreadMessages?.[threadID] ?? []
							if (from === 'start') return messages.slice(offset, offset + limit)
							const end = Math.max(0, messages.length - offset)
							return messages.slice(Math.max(0, end - limit), end)
						},
						state: {
							subscribe(listener: (state: string) => void) {
								return { unsubscribe() {} }
							},
								async get() {
									return options?.restoredThreadStates?.[threadID] ?? 'idle'
								},
						},
						async appendUserMessage(message: { content: string }, appendOptions?: { steer?: boolean }) {
							if (options?.appendHook) await options.appendHook(threadID, message.content)
							sent.push({ threadID, content: message.content, steer: appendOptions?.steer })
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
			await pstack(amp as never, options?.backends ?? { selectBackend: async () => 'amp' })
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

	test('CLI role and mixed panel return reports; background CLI remains stoppable', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-integration-'))
		const path = process.env.PATH
		await writeFile(join(root, 'cursor-agent'), '#!/usr/bin/env bun\nconst brief = await Bun.stdin.text(); if (brief.includes("WAIT_FOREVER")) await Bun.sleep(60000); console.log(JSON.stringify({type:"result",is_error:false,result:"CLI fixture report"}));\n')
		await chmod(join(root, 'cursor-agent'), 0o755)
		process.env.PATH = `${root}:${path}`
		const amp = await loadPlugin({ backends: { selectBackend: async (model) => model === 'xai/grok-4.7' ? 'cursor-cli' : 'amp', cliOptions: { stateDir: join(root, 'runs'), launcher: 'local' } } })
		try {
			const one = JSON.parse(await tool(amp, 'pstack_run_agent').execute({ role: 'how-explorer', prompt: 'Inspect only' }, { thread: { id: 'T-parent' } }))
			expect(one.status).toBe('done')
			expect(one.text).toContain('CLI fixture report')
			expect(one.threadID).toMatch(/^cli-/)
			const panel = JSON.parse(await tool(amp, 'pstack_run_panel').execute({ panel: 'interrogate-reviewers', prompt: 'Review only' }, { thread: { id: 'T-parent' } }))
			expect(panel.map((seat: { status: string }) => seat.status)).toEqual(['done', 'done', 'done'])
			expect(panel[2].text).toContain('CLI fixture report')
			await expect(tool(amp, 'pstack_start_agent').execute({ ...implStart, prompt: 'Do not change placement' }, { thread: { id: 'T-parent' } })).rejects.toThrow('Omit executor and launchTarget')
			await expect(tool(amp, 'pstack_run_agent').execute({ role: 'how-explorer', prompt: 'Inspect only', executor: 'orb' }, { thread: { id: 'T-parent' } })).rejects.toThrow('Omit executor and launchTarget')
			const child = JSON.parse(await tool(amp, 'pstack_start_agent').execute({ ...implStart, launchTarget: undefined, prompt: 'WAIT_FOREVER' }, { thread: { id: 'T-parent' } }))
			const stopped = JSON.parse(await tool(amp, 'pstack_stop_agent').execute({ threadID: child.threadID }, { thread: { id: 'T-parent' } }))
			expect(stopped).toMatchObject({ canceled: true, state: 'error', ownershipReleased: true })
		} finally {
			await amp.dispose()
			process.env.PATH = path
			await rm(root, { recursive: true, force: true })
		}
	}, 30_000)

	test('stopping CLI candidates and judges reconciles the design before a polling tick', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-design-stop-'))
		const command = join(root, 'fake-cli')
		await writeFile(command, '#!/usr/bin/env bun\nawait Bun.stdin.text(); await Bun.sleep(60000)\n')
		await chmod(command, 0o755)
		try {
			for (const kind of ['candidate', 'judge'] as const) {
				const file = join(root, `${kind}.sqlite`)
				const stateDir = join(root, kind)
				const { id } = startCliRun({ role: kind, roleInstructions: 'Read only', brief: 'Wait', access: 'readonly', checkout: import.meta.dir, backend: 'cursor-cli', backends: { 'cursor-cli': { command } } }, { stateDir, launcher: 'local' })
				const store = new RuntimeStore(file)
				store.saveBackgroundChild(id, 'T-parent', kind === 'judge' ? 'arena-cross-judge' : 'arena-runners-1')
				store.saveDesignRun(kind === 'judge' ? {
					state: 'judging', parentThreadID: 'T-parent', panel: 'arena-runners', candidateThreadIDs: ['T-completed'], judgeThreadID: id,
				} : {
					state: 'candidates-running', parentThreadID: 'T-parent', panel: 'arena-runners', candidateThreadIDs: ['T-completed', id], pendingCandidateThreadIDs: [id], completedCandidateThreadIDs: ['T-completed'], failedCandidateThreadIDs: [],
				})
				const amp = await loadPlugin({ runtimeStateFile: file, backends: { selectBackend: async () => 'amp', cliOptions: { stateDir, launcher: 'local' } } })
				try {
					await tool(amp, 'pstack_stop_agent').execute({ threadID: id }, { thread: { id: 'T-parent' } })
					expect(store.listDesignRuns()[0]?.state).toBe('judge-required')
					expect(store.listDesignRuns()[0]?.candidateThreadIDs).toEqual(kind === 'judge' ? ['T-completed'] : ['T-completed', id])
				} finally { await amp.dispose(); store.close() }
			}
		} finally { await rm(root, { recursive: true, force: true }) }
	}, 30_000)

	test('a terminal background child restarted by a message remains stoppable by its parent', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-restarted-stop-'))
		const file = join(root, 'runtime.sqlite')
		const store = new RuntimeStore(file)
		store.saveBackgroundChild('T-restarted', 'T-parent', 'judgment')
		store.deleteBackgroundChild('T-restarted')
		store.close()
		const amp = await loadPlugin({ runtimeStateFile: file, restoredThreadStates: { 'T-restarted': 'running' } })
		try {
			expect(JSON.parse(await tool(amp, 'pstack_stop_agent').execute({ threadID: 'T-restarted' }, { thread: { id: 'T-parent' } }))).toMatchObject({ canceled: true })
			await expect(tool(amp, 'pstack_stop_agent').execute({ threadID: 'T-restarted' }, { thread: { id: 'T-other' } })).rejects.toThrow('not a paired')
		} finally {
			await amp.dispose()
			await rm(root, { recursive: true, force: true })
		}
	})

	test('reads a 450-message transcript in stable offset pages with truncation metadata', async () => {
		const amp = await loadPlugin()
		const transcript = Array.from({ length: 450 }, (_, index) => ({
			id: `M-${index}`,
			role: 'user',
			content: [{ type: 'text', text: `msg ${index}` }],
		}))
		const currentThread = {
			id: 'T-current',
			async messages(options: { from: string; offset: number; limit: number }) {
				expect(options.from).toBe('start')
				expect(options.limit).toBeLessThanOrEqual(20)
				return transcript.slice(options.offset, options.offset + options.limit)
			},
		}
		const read = async (offset: number) =>
			JSON.parse(
				await tool(amp, 'pstack_read_current_thread').execute(
					{ offset, limit: 200 },
					{ thread: currentThread },
				),
			)

		const first = await read(0)
		const second = await read(200)
		const third = await read(400)
		expect(first.messages).toHaveLength(200)
		expect(first.messages[0].id).toBe('M-0')
		expect(second.messages[0].id).toBe('M-200')
		expect(third.messages.map((message: { id: string }) => message.id)).toEqual(
			transcript.slice(400).map((message) => message.id),
		)
		expect(first).toMatchObject({ total: 450, truncated: true, offset: 0, limit: 200 })
		expect(second).toMatchObject({ total: 450, truncated: true })
		expect(third).toMatchObject({ total: 450, truncated: true })
	})

	test('stops only a durably paired owned child and releases after terminal state', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } })
		const child = amp.started[0] as {
			id: string
			cancelCount: number
			emit: (state: string) => void
		}
		child.emit('running')

		await expect(
			tool(amp, 'pstack_stop_agent').execute(
				{ threadID: child.id },
				{ thread: { id: 'T-other-parent' } },
			),
		).rejects.toThrow('different parent')
		expect(child.cancelCount).toBe(0)
		const stopped = JSON.parse(
			await tool(amp, 'pstack_stop_agent').execute(
				{ threadID: child.id },
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(stopped).toMatchObject({ canceled: true, ownershipReleased: false, state: 'running' })
		expect(child.cancelCount).toBe(1)
		await expect(
			tool(amp, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } }),
		).rejects.toThrow('Implementation resource')

		child.emit('idle')
		await expect(
			tool(amp, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } }),
		).resolves.toBeDefined()
		await expect(
			tool(amp, 'pstack_stop_agent').execute(
				{ threadID: 'T-unpaired' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('not a paired implementation child')
	})

	test('does not claim it can stop a native reservation without a child ID', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_start_agent').execute(
			{ ...implStart, launchTarget: { kind: 'native-orb', project: 'project' } },
			{ thread: { id: 'T-parent' } },
		)
		await expect(
			tool(amp, 'pstack_stop_agent').execute(
				{ threadID: 'T-unknown' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('has no paired child thread ID')
	})

	test('native Grok rechecks routing on the executing child without cancelling unrelated agents', async () => {
		let route: 'amp' | 'cursor-cli' = 'amp'
		const amp = await loadPlugin({ backends: { selectBackend: async () => route } })
		const definition = { kind: 'agent-definition', ...amp.registeredModes.find((mode) => mode.key === 'pstack-feature')!.agent }
		let cancels = 0
		const thread = { id: 'T-destination', agent: async () => ({ definition }), cancel: async () => { cancels++ } }
		try {
			await amp.emit('agent.start', { thread })
			expect(cancels).toBe(0)
			route = 'cursor-cli'
			expect(await amp.emit('agent.start', { thread })).toEqual({ message: { display: true, content: 'Stopped before inference: the SuperGrok subscription no longer wins routing. Reconcile this child before starting a Cursor CLI replacement; do not use the proxy route.' } })
			expect(cancels).toBe(1)
			for (const role of ['arena-runners-3', 'architect-runners-3', 'interrogate-reviewers-3']) {
				const seat = amp.registeredModes.find((mode) => mode.agent.model === 'xai/grok-4.7' && String(mode.agent.instructions).endsWith(`Assigned role: ${role}.`))!
				expect(seat).toBeDefined()
				Object.assign(definition, seat.agent)
				await amp.emit('agent.start', { thread })
			}
			expect(cancels).toBe(4)
			Object.assign(definition, { instructions: 'Unrelated custom Grok mode.' })
			await amp.emit('agent.start', { thread })
			expect(cancels).toBe(4)
		} finally { await amp.dispose() }
	})

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

	test('poteto-mode.ts registers a parent inheriting built-in medium', async () => {
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
			extends: 'medium',
		})
		expect(created[0]).not.toHaveProperty('model')
		expect(created[0]).not.toHaveProperty('reasoningEffort')
		expect(created[0]).not.toHaveProperty('tools')
	})

	test('code implementation roles receive the full poteto delegate wrapper', async () => {
		const amp = await loadPlugin()
		for (const [index, role] of ['hardest', 'feature', 'refactoring', 'bug-fix', 'perf-issue', 'hillclimb'].entries()) {
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
			expect(amp.created.at(-1)).toMatchObject({
				extends: 'medium',
				model: role === 'hardest' ? 'anthropic/claude-opus-5-5' : 'xai/grok-4.7',
				reasoningEffort: role === 'hardest' ? 'max' : 'xhigh',
			})
		}
		expect(CODE_IMPLEMENTATION_ROLES).toEqual(
			new Set(['hardest', 'feature', 'refactoring', 'bug-fix', 'perf-issue', 'hillclimb']),
		)
	})

	test('hardest requires scoped background ownership and rejects blocking or colliding work', async () => {
		const amp = await loadPlugin()
		await expect(
			tool(amp, 'pstack_run_agent').execute(
				{ role: 'hardest', prompt: 'implement it' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow(IMPLEMENTATION_BLOCKING_ERROR)
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'hardest', prompt: 'implement it' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('Missing scope')
		await tool(amp, 'pstack_start_agent').execute(
			{
				role: 'hardest',
				prompt: 'own it',
				scope: 'index implementation',
				scopePaths: ['index.ts'],
				launchTarget: { kind: 'current-checkout' },
			},
			{ thread: { id: 'T-hardest-parent' } },
		)
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'feature',
					prompt: 'collide',
					scope: 'same file',
					scopePaths: ['index.ts'],
					launchTarget: { kind: 'current-checkout' },
				},
				{ thread: { id: 'T-feature-parent' } },
			),
		).rejects.toThrow('conflicts with')
	})

	test('poteto roles conditionally direct principle leaf loading', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_run_agent').execute(
			{ role: 'judgment', prompt: 'review it' },
			{ thread: { id: 'T-parent' } },
		)
		expect(String(amp.created.at(-1)?.instructions)).toContain(
			'When applying a principle, load the appropriate pstack:principle-* leaf skill.',
		)

		await tool(amp, 'pstack_run_agent').execute(
			{ role: 'why-investigator', prompt: 'investigate it' },
			{ thread: { id: 'T-parent' } },
		)
		expect(String(amp.created.at(-1)?.instructions)).not.toContain('pstack:principle-*')
	})

	test('specialist and comment roles keep their narrower contracts', async () => {
		const amp = await loadPlugin()
		const specialistModels: Record<string, string> = {
			'how-explorer': 'xai/grok-4.7',
			'how-explainer': 'anthropic/claude-opus-5-5',
			'why-investigator': 'xai/grok-4.7',
			'why-synthesizer': 'anthropic/claude-opus-5-5',
			'swarm-worker': 'xai/grok-4.7',
			'reflect-tooling': 'openai/gpt-6-sol',
			'reflect-judgment': 'anthropic/claude-opus-5-5',
			'reflect-divergent': 'anthropic/claude-opus-5-5',
			'reflect-synthesizer': 'anthropic/claude-opus-5-5',
		}
		for (const [role, model] of Object.entries(specialistModels)) {
			await tool(amp, 'pstack_run_agent').execute(
				{ role, prompt: 'inspect it' },
				{ thread: { id: 'T-parent' } },
			)
			expect(String(amp.created.at(-1)?.instructions)).not.toContain(
				POTETO_DELEGATE_INSTRUCTIONS,
			)
			expect(amp.created.at(-1)).toMatchObject({
				extends: 'medium',
				model,
				reasoningEffort: MODEL_REASONING_EFFORT[model as keyof typeof MODEL_REASONING_EFFORT],
			})
		}
		await tool(amp, 'pstack_run_agent').execute(
			{ role: 'comment-reviewer', prompt: 'review comments', timeoutMs: 120_000 },
			{ thread: { id: 'T-parent' } },
		)
		expect(amp.created.at(-1)).toMatchObject({
			extends: 'medium',
			model: 'anthropic/claude-opus-5-5',
			reasoningEffort: 'max',
			tools: { include: [...REPORTING_READONLY_TOOLS] },
		})
		expect(STRICT_READONLY_TOOLS).not.toContain('shell_command')
		expect(STRICT_READONLY_TOOLS).not.toContain('Task')
		expect(STRICT_READONLY_TOOLS).not.toContain('create_thread')
		expect(
			WRITE_TOOLS.every(
				(name) => !(STRICT_READONLY_TOOLS as readonly string[]).includes(name),
			),
		).toBe(true)
		expect(String(amp.created.at(-1)?.instructions)).toContain('terminal report-only reviewer')
		expect(String(amp.created.at(-1)?.instructions)).toContain(
			'otherwise return findings as final text for delivery by the caller',
		)
		expect(String(amp.created.at(-1)?.instructions)).toContain(
			'Use Read and finder to inspect the named scope',
		)
		expect(String(amp.created.at(-1)?.instructions)).not.toContain(POTETO_DELEGATE_INSTRUCTIONS)
		expect(amp.waited.at(-1)).toMatchObject({ timeoutMs: COMMENT_REVIEWER_MIN_TIMEOUT_MS })

		await tool(amp, 'pstack_start_agent').execute(
			{ role: 'comment-reviewer', prompt: 'review comments in the background' },
			{ thread: { id: 'T-background-parent' } },
		)
		expect(amp.created.at(-1)).toMatchObject({
			tools: { include: [...REPORTING_READONLY_TOOLS] },
		})
		expect(String(amp.created.at(-1)?.instructions)).toContain(
			'Do not load skills, spawn agents, create threads, or call pstack tools.',
		)
		expect(String(amp.started.at(-1)?.prompt)).toContain(
			'When finished, use native send_thread_message',
		)
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

	test('startup registration publishes the shipped lineup at high effort', async () => {
		const amp = await loadPlugin()
		const concrete = amp.created.filter((definition) => typeof definition.model === 'string')
		const lineup = [
			'anthropic/claude-opus-5-5',
			'openai/gpt-6-sol',
			'xai/grok-4.7',
		] as const
		const expectedModels = [
			...Array(16).fill('xai/grok-4.7'),
			...Array(16).fill('anthropic/claude-opus-5-5'),
			'openai/gpt-6-sol',
			'openai/gpt-6-sol',
			...lineup,
			...lineup,
			...lineup,
			...lineup,
			...lineup,
		]
		expect(concrete.map((definition) => definition.model).sort()).toEqual([...expectedModels].sort())
		for (const definition of concrete) {
			expect(definition.extends).toBe('medium')
			expect(definition.reasoningEffort).toBe(MODEL_REASONING_EFFORT[definition.model as keyof typeof MODEL_REASONING_EFFORT])
			if (typeof definition.model !== 'string' || !lineup.includes(definition.model as (typeof lineup)[number])) {
				throw new Error(`unexpected registered model ${String(definition.model)}`)
			}
		}
		for (const panel of ['arena-runners', 'architect-runners', 'interrogate-reviewers']) {
			const seats = [1, 2, 3].map((seat) => {
				const role = `${panel}-${seat}`
				const mode = orbAgentModeFor(role, lineup[seat - 1]!)
				return amp.registeredModes.find(({ key }) => key === mode.key)?.agent.model
			})
			expect(seats).toEqual([...lineup])
		}
		const pool = lineup.map((model) => {
			const mode = orbAgentModeFor('arena-cross-judge', model)
			return amp.registeredModes.find(({ key }) => key === mode.key)?.agent.model
		})
		expect(pool).toEqual([...lineup])
		const feature = amp.registeredModes.find(
			({ key }) => key === orbAgentModeFor('feature', 'xai/grok-4.7').key,
		)
		const judgment = amp.registeredModes.find(
			({ key }) => key === orbAgentModeFor('judgment', 'anthropic/claude-opus-5-5').key,
		)
		const tooling = amp.registeredModes.find(
			({ key }) => key === orbAgentModeFor('reflect-tooling', 'openai/gpt-6-sol').key,
		)
		expect(feature?.agent).toMatchObject({ model: 'xai/grok-4.7', reasoningEffort: 'xhigh' })
		expect(judgment?.agent).toMatchObject({
			model: 'anthropic/claude-opus-5-5',
			reasoningEffort: 'max',
		})
		expect(tooling?.agent).toMatchObject({ model: 'openai/gpt-6-sol', reasoningEffort: 'max' })
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
			{
				role: 'arena-cross-judge',
				prompt: 'judge it',
				candidateThreadIDs: architect
					.map(({ threadID }: { threadID: string }) => threadID)
					.reverse(),
			},
			{ thread: { id: 'T-parent' } },
		)
		expect(String(amp.created.at(-1)?.instructions)).not.toContain(POTETO_DELEGATE_INSTRUCTIONS)
	})

	test('cross-judge selects one known different-family pool model from the parent', async () => {
		const amp = await loadPlugin({
			initialConfig: {
				[CONFIG_KEY]: {
					'architect-runners': ['builtin:high'],
					'arena-cross-judge': ['xai/grok-4.7', 'builtin:high', 'openai/gpt-5.6-sol'],
				},
			},
		})
		const panel = JSON.parse(
			await tool(amp, 'pstack_run_panel').execute(
				{ panel: 'architect-runners', prompt: 'sketch it' },
				{ thread: { id: 'T-parent' } },
			),
		)
		const startedBeforeJudge = amp.started.length
		const result = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{
					role: 'arena-cross-judge',
					prompt: 'judge it',
					candidateThreadIDs: panel.map(
						({ threadID }: { threadID: string }) => threadID,
					),
				},
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
		expect(amp.started).toHaveLength(startedBeforeJudge + 1)
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
		expect(String(amp.started[0]?.prompt)).toContain('send_thread_message')
		expect(String(tool(amp, 'pstack_start_agent').description)).toContain(
			'Continue independent parent work',
		)
		expect(amp.created).toHaveLength(amp.preloadedAgentCount + 1)
		expect(amp.registeredModes).toHaveLength(amp.preloadedModeCount)
	})

	test('start_agent surfaces blocked-report checks on the parent return and child instructions', async () => {
		const amp = await loadPlugin({ waitError: new Error('must not wait') })
		const result = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				implStart,
				{ thread: { id: 'T-parent' } },
			),
		)
		const childInstructions = String(amp.created.at(-1)?.instructions)
		expect(result.next).toContain(
			'inspect the actual child tool-call/result status and output',
		)
		expect(result.next).toContain('steer that same child instead of replacing it')
		expect(result.next).not.toContain('not attempted')
		expect(childInstructions).toContain(
			'A blocked report must name the attempted tool and its tool-call/result status and output',
		)
		expect(childInstructions).toContain('say not attempted, not unavailable')
		expect(childInstructions).not.toContain('steer that same child')
		expect(amp.started).toHaveLength(1)
		expect(amp.waited).toHaveLength(0)
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

	test('effort-only changes apply locally but require orb reload', async () => {
		const amp = await loadPlugin({ initialConfig: {
			[CONFIG_KEY]: { 'bug-fix': { model: 'openai/gpt-6-sol', effort: 'low' } },
		} })
		await tool(amp, 'pstack_configure_models').execute({
			action: 'set',
			overrides: { 'bug-fix': { model: 'openai/gpt-6-sol', effort: 'max' } },
		})
		await tool(amp, 'pstack_start_agent').execute(
			{ role: 'bug-fix', prompt: 'local effort', scope: 'local.ts', launchTarget: { kind: 'current-checkout' } },
			{ thread: { id: 'T-local-effort' } },
		)
		expect(amp.created.at(-1)).toMatchObject({ model: 'openai/gpt-6-sol', reasoningEffort: 'max' })
		await expect(tool(amp, 'pstack_start_agent').execute(
			{ role: 'bug-fix', prompt: 'orb effort', scope: 'orb.ts', launchTarget: { kind: 'repo-independent-orb' } },
			{ thread: { id: 'T-orb-effort' } },
		)).rejects.toThrow(ORB_MODE_RELOAD_ERROR)
	})

	test('invalid persisted effort fails its named role while another startup orb seat still runs', async () => {
		const amp = await loadPlugin({
			initialConfig: {
				[CONFIG_KEY]: {
					feature: { model: 'anthropic/claude-opus-5-5', effort: 'none' },
					'how-explainer': { model: 'openai/gpt-6-sol', effort: 'low' },
				},
			},
		})
		expect(amp.logs).toContain(
			'Could not register pstack role feature: Invalid effort for feature: model anthropic/claude-opus-5-5 does not support effort none.',
		)
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'feature', prompt: 'must fail', scope: 'feature.ts', launchTarget: { kind: 'current-checkout' } },
				{ thread: { id: 'T-invalid-local' } },
			),
		).rejects.toThrow('Invalid effort for feature: model anthropic/claude-opus-5-5 does not support effort none')
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'feature', prompt: 'must fail in orb', scope: 'orb.ts', launchTarget: { kind: 'repo-independent-orb' } },
				{ thread: { id: 'T-invalid-orb' } },
			),
		).rejects.toThrow('Invalid effort for feature: model anthropic/claude-opus-5-5 does not support effort none')
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'how-explainer', prompt: 'still starts', launchTarget: { kind: 'repo-independent-orb' } },
				{ thread: { id: 'T-valid-orb' } },
			),
		).resolves.toBeDefined()
		expect(amp.started.at(-1)).toMatchObject({ executor: 'orb' })
		const validMode = orbAgentModeFor('how-explainer', 'openai/gpt-6-sol', 'low')
		expect(amp.registeredModes.find(({ key }) => key === validMode.key)?.agent).toMatchObject({
			model: 'openai/gpt-6-sol',
			reasoningEffort: 'low',
		})
	})

	test('terminal background children notify once with state and last assistant text', async () => {
		for (const [role, terminal] of [
			['feature', 'idle'],
			['how-explainer', 'error'],
			['why-investigator', 'idle'],
		] as const) {
			const amp = await loadPlugin()
			await tool(amp, 'pstack_start_agent').execute(
				{
					role,
					prompt: `${role} task`,
					...(role === 'feature' ? { scope: `${role}.ts` } : {}),
				},
				{ thread: { id: `T-parent-${role}` } },
			)
			const child = amp.started[0] as { emit: (state: string) => void; assistantMessages: string[] }
			child.assistantMessages = [`${role} older text`, `${role} final text`]
			child.emit('idle')
			expect(amp.sent).toHaveLength(0)
			if (terminal === 'idle') child.emit('running')
			else child.emit('awaiting-approval')
			child.emit(terminal)
			child.emit(terminal)
			await Bun.sleep(0)
			expect(amp.sent).toEqual([{
				threadID: `T-parent-${role}`,
				content: expect.stringContaining(`Child T-child reached terminal state ${terminal}`),
				steer: true,
			}])
			expect(String(amp.sent[0]?.content)).toContain(`${role} final text`)
			expect(String(amp.sent[0]?.content)).not.toContain(`${role} older text`)
		}
	})

	test('terminal fallback reads the newest assistant text from the host-sized latest page', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_start_agent').execute(
			{ role: 'how-explainer', prompt: 'find the latest report' },
			{ thread: { id: 'T-parent' } },
		)
		const child = amp.started[0] as {
			emit: (state: string) => void
			transcriptMessages: Array<Record<string, unknown>>
		}
		child.transcriptMessages = [
			...Array.from({ length: 21 }, (_, index) => ({
				id: `M-old-${index}`,
				role: index === 20 ? 'assistant' : 'user',
				content: [{ type: 'text', text: index === 20 ? 'older assistant text' : `old user ${index}` }],
			})),
			{ id: 'M-final', role: 'assistant', content: [{ type: 'text', text: 'required final assistant text' }] },
			{ id: 'M-user', role: 'user', content: [{ type: 'text', text: 'trailing user text' }] },
			{
				id: 'M-tool',
				role: 'user',
				content: [{ type: 'tool_result', toolUseID: 'call-1', status: 'done', output: 'trailing tool text' }],
			},
		]
		child.emit('running')
		child.emit('idle')
		await Bun.sleep(0)
		expect(amp.sent).toHaveLength(1)
		expect(String(amp.sent[0]?.content)).toContain('required final assistant text')
		expect(String(amp.sent[0]?.content)).not.toContain('older assistant text')
		expect(amp.logs).toEqual([])
	})

	test('reload reconciles a previously active child already idle but ignores initial idle', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-background-state-'))
		const runtimeStateFile = join(root, 'runtime.sqlite')
		try {
			const first = await loadPlugin({ runtimeStateFile })
			await tool(first, 'pstack_start_agent').execute(
				{ role: 'how-explainer', prompt: 'active child' },
				{ thread: { id: 'T-parent-active' } },
			)
			;(first.started[0] as { emit: (state: string) => void }).emit('running')
			await tool(first, 'pstack_start_agent').execute(
				{ role: 'why-investigator', prompt: 'not started child' },
				{ thread: { id: 'T-parent-initial' } },
			)
			await first.dispose()

			const restored = await loadPlugin({
				runtimeStateFile,
				restoredThreadStates: { 'T-child': 'idle', 'T-child-2': 'idle' },
			})
			await Bun.sleep(0)
			expect(restored.sent).toHaveLength(1)
			expect(restored.sent[0]).toMatchObject({ threadID: 'T-parent-active' })
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('reload infers owner and background completion from assistant transcripts but keeps untouched idle children pending', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-gap-completion-'))
		try {
			const ownerState = join(root, 'owner.sqlite')
			const owner = await loadPlugin({ runtimeStateFile: ownerState })
			await tool(owner, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-owner-parent' } })
			await owner.dispose()
			const restoredOwner = await loadPlugin({
				runtimeStateFile: ownerState,
				restoredThreadStates: { 'T-child': 'idle' },
				restoredThreadMessages: { 'T-child': [{ role: 'assistant', content: [{ type: 'text', text: 'owner finished in gap' }] }] },
			})
			await Bun.sleep(0)
			expect(restoredOwner.sent).toEqual([expect.objectContaining({ threadID: 'T-owner-parent', steer: true })])
			await expect(tool(restoredOwner, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-new-owner' } })).resolves.toBeDefined()

			const backgroundState = join(root, 'background.sqlite')
			const background = await loadPlugin({ runtimeStateFile: backgroundState })
			await tool(background, 'pstack_start_agent').execute({ role: 'why-investigator', prompt: 'work' }, { thread: { id: 'T-background-parent' } })
			await background.dispose()
			const restoredBackground = await loadPlugin({
				runtimeStateFile: backgroundState,
				restoredThreadStates: { 'T-child': 'idle' },
				restoredThreadMessages: { 'T-child': [
					...Array.from({ length: 20 }, (_, index) => ({ role: 'user', content: [{ type: 'text', text: `later ${index}` }] })),
					{ role: 'assistant', content: [{ type: 'text', text: 'background finished in gap' }] },
				] },
			})
			await Bun.sleep(0)
			expect(restoredBackground.sent).toEqual([expect.objectContaining({ threadID: 'T-background-parent', steer: true })])

			const untouchedState = join(root, 'untouched.sqlite')
			const untouched = await loadPlugin({ runtimeStateFile: untouchedState })
			await tool(untouched, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-untouched-parent' } })
			await untouched.dispose()
			const restoredUntouched = await loadPlugin({
				runtimeStateFile: untouchedState,
				restoredThreadStates: { 'T-child': 'idle' },
				restoredMessageError: { 'T-child': new Error('transcript unavailable') },
			})
			expect(restoredUntouched.sent).toHaveLength(0)
			await expect(tool(restoredUntouched, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-other' } })).rejects.toThrow('resource')
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('reload settles completed design candidates and judges from assistant transcripts', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-design-gap-'))
		try {
			const candidateState = join(root, 'candidate.sqlite')
			const candidate = await loadPlugin({
				runtimeStateFile: candidateState,
				initialConfig: { [CONFIG_KEY]: { 'architect-runners': ['builtin:high'] } },
				waitError: new Error('gap'),
				waitState: 'running',
			})
			await tool(candidate, 'pstack_run_panel').execute({ panel: 'architect-runners', prompt: 'design' }, { thread: { id: 'T-design-parent' } })
			await candidate.dispose()
			const restoredCandidate = await loadPlugin({
				runtimeStateFile: candidateState,
				restoredThreadStates: { 'T-child': 'idle' },
				restoredThreadMessages: { 'T-child': [{ role: 'assistant', content: [{ type: 'text', text: 'candidate done' }] }] },
			})
			expect(restoredCandidate.sent).toEqual([expect.objectContaining({ threadID: 'T-design-parent', steer: true })])
			const gate = await restoredCandidate.emit('agent.end', { thread: { id: 'T-design-parent' } }) as { userMessage: string }
			expect(gate.userMessage).toContain('Call pstack_start_agent with role arena-cross-judge')

			const judgeState = join(root, 'judge.sqlite')
			const judge = await loadPlugin({ runtimeStateFile: judgeState, initialConfig: { [CONFIG_KEY]: { 'architect-runners': ['builtin:high'] } } })
			const panel = JSON.parse(await tool(judge, 'pstack_run_panel').execute({ panel: 'architect-runners', prompt: 'design' }, { thread: { id: 'T-judge-parent' } }))
			await tool(judge, 'pstack_start_agent').execute({ role: 'arena-cross-judge', prompt: 'judge', candidateThreadIDs: panel.map(({ threadID }: { threadID: string }) => threadID) }, { thread: { id: 'T-judge-parent' } })
			await judge.dispose()
			const restoredJudge = await loadPlugin({
				runtimeStateFile: judgeState,
				restoredThreadStates: { 'T-child-2': 'idle' },
				restoredThreadMessages: { 'T-child-2': [{ role: 'assistant', content: [{ type: 'text', text: 'judge done' }] }] },
			})
			expect(await restoredJudge.emit('agent.end', { thread: { id: 'T-judge-parent' } })).toBeUndefined()
			await expect(tool(restoredJudge, 'pstack_run_panel').execute({ panel: 'architect-runners', prompt: 'next design' }, { thread: { id: 'T-judge-parent' } })).resolves.toBeDefined()
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('cross-orb transcript evidence suppresses only a successful report to the actual parent across pages', async () => {
		for (const [status, fallbackExpected] of [['done', false], ['error', true]] as const) {
			const amp = await loadPlugin()
			await tool(amp, 'pstack_start_agent').execute(
				{ role: 'how-explainer', prompt: 'report from a fresh orb', launchTarget: { kind: 'repo-independent-orb' } },
				{ thread: { id: 'T-parent' } },
			)
			const child = amp.started[0] as {
				emit: (state: string) => void
				transcriptMessages: Array<Record<string, unknown>>
			}
			child.transcriptMessages = [
				{
					id: 'M-use',
					role: 'assistant',
					content: [{ type: 'tool_use', id: 'TU-cross-orb', name: 'pstack_send_to_thread', input: { threadID: 'T-parent', message: 'report' } }],
				},
				...Array.from({ length: 20 }, (_, index) => ({
					id: `M-filler-${index}`,
					role: 'user',
					content: [{ type: 'text', text: `filler ${index}` }],
				})),
				{ id: 'M-result', role: 'user', content: [{ type: 'tool_result', toolUseID: 'TU-cross-orb', status, output: 'host result' }] },
				{ id: 'M-final', role: 'assistant', content: [{ type: 'text', text: 'last child explanation' }] },
			]
			child.emit('running')
			child.emit('idle')
			await Bun.sleep(0)
			expect(amp.sent).toHaveLength(fallbackExpected ? 1 : 0)
			if (fallbackExpected) expect(String(amp.sent[0]?.content)).toContain('last child explanation')
		}
	})

	test('native message receipts suppress duplicate reports without trusting printed text or another target', async () => {
		for (const [target, status, type, expected] of [
			['T-parent', 'done', 'amp_builtin_call', 0],
			['T-other', 'done', 'amp_builtin_call', 1],
			['T-parent', 'error', 'amp_builtin_call', 1],
			['T-parent', 'done', 'text', 1],
		] as const) {
			const amp = await loadPlugin()
			await tool(amp, 'pstack_start_agent').execute({ role: 'how-explainer', prompt: 'Report through native messaging' }, { thread: { id: 'T-parent' } })
			const child = amp.started[0] as { emit(state: string): void; transcriptMessages: Array<Record<string, unknown>> }
			child.transcriptMessages = [
				{ role: 'assistant', content: [{ type: 'tool_use', id: 'TU-native', name: 'code_exec', input: { code: 'native call' } }] },
				...Array.from({ length: 20 }, () => ({ role: 'user', content: [{ type: 'text', text: 'page boundary' }] })),
				{ role: 'user', content: [{ type: 'tool_result', toolUseID: 'TU-native', status: 'done', output: JSON.stringify([{ type, toolName: 'send_thread_message', status, args: { thread: target }, result: { threadID: target } }]) }] },
			]
			child.emit('running')
			child.emit('idle')
			await Bun.sleep(0)
			expect(amp.sent).toHaveLength(expected)
			await amp.dispose()
		}
	})

	test('failed terminal fallback append returns the durable claim to pending and retries after reload', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-notification-retry-'))
		const runtimeStateFile = join(root, 'runtime.sqlite')
		try {
			const first = await loadPlugin({
				runtimeStateFile,
				appendHook: async () => { throw new Error('parent append failed') },
			})
			await tool(first, 'pstack_start_agent').execute(
				{ role: 'how-explainer', prompt: 'retry fallback' },
				{ thread: { id: 'T-parent' } },
			)
			const child = first.started[0] as { emit: (state: string) => void }
			child.emit('running')
			child.emit('idle')
			await Bun.sleep(0)
			expect(first.sent).toHaveLength(0)
			await first.dispose()

			const restored = await loadPlugin({
				runtimeStateFile,
				restoredThreadStates: { 'T-child': 'idle' },
			})
			await Bun.sleep(0)
			expect(restored.sent).toHaveLength(1)
			expect(restored.sent[0]).toMatchObject({ threadID: 'T-parent' })
		} finally {
			await rm(root, { recursive: true, force: true })
		}
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
				{ key: 'issue-report', instruction: 'triage this' },
				{
					thread: { id: 'T-owner' },
					ui: { notify: async (message: string) => notifications.push(message) },
				},
			),
		)
		expect(created).toMatchObject({
			ownerThreadID: 'T-owner',
			userKey: 'issue-report',
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
			{ key: 'issue-report', instruction: 'triage this' },
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
			tools: { include: REPORTING_READONLY_TOOLS },
		})
		expect(capabilityFor('arena-cross-judge')).toEqual({
			kind: 'strict-readonly',
			tools: { include: REPORTING_READONLY_TOOLS },
		})
		expect(STRICT_READONLY_TOOLS).toContain('Read')
		expect(STRICT_READONLY_TOOLS).toContain('read_thread')
		expect(STRICT_READONLY_TOOLS).not.toContain('send_thread_message')
		expect(REPORTING_READONLY_TOOLS).toContain('send_thread_message')
		expect(capabilityFor('interrogate-reviewers-2').tools).toEqual({
			include: STRICT_READONLY_TOOLS,
		})
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

	test('non-owner append ambiguity exposes its child ID and explicit stop reconciles it', async () => {
		const amp = await loadPlugin({ appendError: new Error('append acknowledgement lost') })
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'how-explainer', prompt: 'explain' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('Child thread T-child')
		expect(
			JSON.parse(
				await tool(amp, 'pstack_stop_agent').execute(
					{ threadID: 'T-child' },
					{ thread: { id: 'T-parent' } },
				),
			),
		).toMatchObject({ threadID: 'T-child', canceled: true, reconciled: true })
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'how-explainer', prompt: 'retry after reconciliation' },
				{ thread: { id: 'T-parent' } },
			),
		).resolves.toContain('T-child-2')
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

	test('restored active strict read-only children still reject writes', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-readonly-state-'))
		const runtimeStateFile = join(root, 'runtime.sqlite')
		try {
			const first = await loadPlugin({ runtimeStateFile })
			await tool(first, 'pstack_start_agent').execute(
				{ role: 'how-explorer', prompt: 'inspect without mutation' },
				{ thread: { id: 'T-parent' } },
			)
			;(first.started[0] as { emit: (state: string) => void }).emit('running')
			await first.dispose()

			const restored = await loadPlugin({
				runtimeStateFile,
				restoredThreadStates: { 'T-child': 'running' },
			})
			const rejected = await restored.emit('tool.call', {
				tool: 'edit_file',
				thread: { id: 'T-child' },
				input: {},
			})
			expect(rejected).toMatchObject({ action: 'reject-and-continue' })
			expect(String((rejected as { message: string }).message)).toContain('how-explorer')
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('reported strict read-only children remain guarded across reload until terminal cleanup', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-reported-readonly-state-'))
		const runtimeStateFile = join(root, 'runtime.sqlite')
		try {
			const first = await loadPlugin({ runtimeStateFile })
			await tool(first, 'pstack_start_agent').execute(
				{ role: 'how-explorer', prompt: 'report while still running' },
				{ thread: { id: 'T-parent' } },
			)
			;(first.started[0] as { emit: (state: string) => void }).emit('running')
			first.started[0]!.transcriptMessages = [
				{ role: 'assistant', content: [{ type: 'tool_use', id: 'TU-native', name: 'code_exec' }] },
				{ role: 'user', content: [{ type: 'tool_result', toolUseID: 'TU-native', status: 'done', output: JSON.stringify([{ type: 'amp_builtin_call', toolName: 'send_thread_message', status: 'done', result: { threadID: 'T-parent' } }]) }] },
			]
			await first.dispose()

			const restored = await loadPlugin({
				runtimeStateFile,
				restoredThreadStates: { 'T-child': 'running' },
			})
			const rejected = await restored.emit('tool.call', {
				tool: 'edit_file',
				thread: { id: 'T-child' },
				input: {},
			})
			expect(rejected).toMatchObject({ action: 'reject-and-continue' })
			expect(String((rejected as { message: string }).message)).toContain('how-explorer')
			await restored.dispose()

			const terminal = await loadPlugin({
				runtimeStateFile,
				restoredThreadStates: { 'T-child': 'idle' },
				restoredThreadMessages: { 'T-child': first.started[0]!.transcriptMessages as Array<Record<string, unknown>> },
			})
			await Bun.sleep(0)
			expect(terminal.sent).toHaveLength(0)
			await terminal.dispose()

			const afterCleanup = await loadPlugin({
				runtimeStateFile,
				restoredThreadStates: { 'T-child': 'idle' },
			})
			await Bun.sleep(0)
			expect(afterCleanup.sent).toHaveLength(0)
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	const writeAttempt = (amp: { emit: (event: string, payload: Record<string, unknown>) => Promise<unknown> }, threadID: string) =>
		amp.emit('tool.call', { tool: 'edit_file', thread: { id: threadID }, input: {} })

	test('blocking strict read-only agent and panel seats stay guarded after plugin reload', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-blocking-readonly-state-'))
		const runtimeStateFile = join(root, 'runtime.sqlite')
		try {
			const first = await loadPlugin({ runtimeStateFile })
			const single = JSON.parse(
				await tool(first, 'pstack_run_agent').execute(
					{ role: 'comment-reviewer', prompt: 'review it' },
					{ thread: { id: 'T-parent' } },
				),
			)
			const panel = JSON.parse(
				await tool(first, 'pstack_run_panel').execute(
					{ panel: 'interrogate-reviewers', prompt: 'challenge it' },
					{ thread: { id: 'T-parent' } },
				),
			)
			expect([single.threadID, ...panel.map(({ threadID }: { threadID: string }) => threadID)]).toEqual([
				'T-child',
				'T-child-2',
				'T-child-3',
				'T-child-4',
			])
			await first.dispose()

			const restored = await loadPlugin({
				runtimeStateFile,
				restoredThreadStates: { 'T-child': 'running', 'T-child-2': 'idle', 'T-child-3': 'running', 'T-child-4': 'error' },
			})
			await Bun.sleep(0)
			expect(restored.sent).toHaveLength(0)
			for (const [threadID, role] of [
				['T-child', 'comment-reviewer'],
				['T-child-2', 'interrogate-reviewers-1'],
				['T-child-3', 'interrogate-reviewers-2'],
				['T-child-4', 'interrogate-reviewers-3'],
			]) {
				const rejected = await writeAttempt(restored, threadID)
				expect(rejected).toEqual({
					action: 'reject-and-continue',
					message: `Strict read-only role ${role} cannot mutate files.`,
				})
			}
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('strict read-only children stay guarded after terminal state and re-steer with unchanged fallbacks', async () => {
		const amp = await loadPlugin()
		await tool(amp, 'pstack_start_agent').execute(
			{ role: 'how-explorer', prompt: 'investigate' },
			{ thread: { id: 'T-parent' } },
		)
		await tool(amp, 'pstack_run_agent').execute(
			{ role: 'comment-reviewer', prompt: 'review it' },
			{ thread: { id: 'T-review-parent' } },
		)
		const children = amp.started as Array<{ id: string; emit: (state: string) => void }>
		for (const child of children) child.emit('idle')
		for (const child of children) {
			child.emit('running')
			child.emit('idle')
		}
		await Bun.sleep(0)
		expect(amp.sent).toEqual([{
			threadID: 'T-parent',
			content: expect.stringContaining('Child T-child reached terminal state idle'),
			steer: true,
		}])
		for (const child of children) {
			child.emit('running')
			expect(await writeAttempt(amp, child.id)).toMatchObject({ action: 'reject-and-continue' })
			expect(await amp.emit('tool.call', {
				tool: 'shell_command',
				thread: { id: child.id },
				input: { command: "sed -i 's/a/b/' index.ts" },
				filesModified: ['index.ts'],
			})).toMatchObject({ action: 'reject-and-continue' })
			child.emit('error')
		}
		await Bun.sleep(0)
		expect(amp.sent).toHaveLength(1)
		for (const child of children) {
			expect(await writeAttempt(amp, child.id)).toMatchObject({ action: 'reject-and-continue' })
		}
	})

	test('report and stop clean notification tickets but keep strict read-only identity across reload', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-readonly-cleanup-state-'))
		const runtimeStateFile = join(root, 'runtime.sqlite')
		try {
			const first = await loadPlugin({ runtimeStateFile })
			await tool(first, 'pstack_start_agent').execute(
				{ role: 'how-explorer', prompt: 'report then finish' },
				{ thread: { id: 'T-parent' } },
			)
			await tool(first, 'pstack_start_agent').execute(
				{ role: 'how-explainer', prompt: 'stop me' },
				{ thread: { id: 'T-parent' } },
			)
			const reporter = first.started[0] as { emit: (state: string) => void }
			reporter.emit('running')
			first.started[0]!.transcriptMessages = [
				{ role: 'assistant', content: [{ type: 'tool_use', id: 'TU-native', name: 'code_exec' }] },
				{ role: 'user', content: [{ type: 'tool_result', toolUseID: 'TU-native', status: 'done', output: JSON.stringify([{ type: 'amp_builtin_call', toolName: 'send_thread_message', status: 'done', result: { threadID: 'T-parent' } }]) }] },
			]
			reporter.emit('idle')
			expect(
				JSON.parse(
					await tool(first, 'pstack_stop_agent').execute(
						{ threadID: 'T-child-2' },
						{ thread: { id: 'T-parent' } },
					),
				),
			).toMatchObject({ threadID: 'T-child-2', reconciled: true })
			await Bun.sleep(0)
			expect(first.sent).toEqual([])
			for (const threadID of ['T-child', 'T-child-2']) {
				expect(await writeAttempt(first, threadID)).toMatchObject({ action: 'reject-and-continue' })
			}
			await first.dispose()

			const restored = await loadPlugin({
				runtimeStateFile,
				restoredThreadStates: { 'T-child': 'running', 'T-child-2': 'running' },
			})
			await Bun.sleep(0)
			expect(restored.sent).toHaveLength(0)
			expect(await writeAttempt(restored, 'T-child')).toEqual({
				action: 'reject-and-continue',
				message: 'Strict read-only role how-explorer cannot mutate files.',
			})
			expect(await writeAttempt(restored, 'T-child-2')).toEqual({
				action: 'reject-and-continue',
				message: 'Strict read-only role how-explainer cannot mutate files.',
			})
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('non-strict children and unrelated threads stay writable after terminal state and reload', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-writable-control-state-'))
		const runtimeStateFile = join(root, 'runtime.sqlite')
		try {
			const first = await loadPlugin({ runtimeStateFile })
			await tool(first, 'pstack_start_agent').execute(
				{ role: 'judgment', prompt: 'review with tests' },
				{ thread: { id: 'T-parent' } },
			)
			await tool(first, 'pstack_start_agent').execute(
				{ role: 'why-investigator', prompt: 'dig' },
				{ thread: { id: 'T-parent' } },
			)
			await tool(first, 'pstack_run_agent').execute(
				{ role: 'swarm-worker', prompt: 'cover a slice' },
				{ thread: { id: 'T-parent' } },
			)
			const ids = ['T-child', 'T-child-2', 'T-child-3', 'T-unrelated']
			for (const child of first.started as Array<{ emit: (state: string) => void }>) {
				child.emit('running')
				child.emit('idle')
			}
			for (const threadID of ids) {
				expect(await writeAttempt(first, threadID)).toEqual({ action: 'allow' })
			}
			await first.dispose()

			const restored = await loadPlugin({ runtimeStateFile })
			for (const threadID of ids) {
				expect(await writeAttempt(restored, threadID)).toEqual({ action: 'allow' })
			}
		} finally {
			await rm(root, { recursive: true, force: true })
		}
	})

	test('blocking strict read-only append failure keeps the guard because delivery is uncertain', async () => {
		const amp = await loadPlugin({ appendError: new Error('append acknowledgement lost') })
		await expect(
			tool(amp, 'pstack_run_agent').execute(
				{ role: 'comment-reviewer', prompt: 'review it' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('append acknowledgement lost')
		expect(await writeAttempt(amp, 'T-child')).toEqual({
			action: 'reject-and-continue',
			message: 'Strict read-only role comment-reviewer cannot mutate files.',
		})
		await Bun.sleep(0)
		expect(amp.sent).toHaveLength(0)
	})

	test('native-orb rejects read-only and research agentMode overrides before reserving and keeps judgment overrides', async () => {
		const amp = await loadPlugin()
		for (const role of [
			'how-explorer',
			'how-explainer',
			'comment-reviewer',
			'why-investigator',
			'why-synthesizer',
			'reflect-tooling',
			'reflect-judgment',
			'reflect-divergent',
			'reflect-synthesizer',
		]) {
			await expect(
				tool(amp, 'pstack_start_agent').execute(
					{
						role,
						prompt: 'write /tmp/probe',
						launchTarget: { kind: 'native-orb', project: 'amp/pstack', agentMode: 'medium' },
					},
					{ thread: { id: 'T-parent' } },
				),
			).rejects.toThrow(`Read-only or research role ${role} must use its registered pstack mode on native-orb; omit agentMode.`)
		}
		const overrideInput = {
			executor: 'orb',
			agent_mode: 'medium',
			project: 'amp/pstack',
			prompt: backgroundChildPrompt('write /tmp/probe', 'T-parent'),
			intent: 'delegation',
		}
		await amp.emit('tool.call', { tool: 'create_thread', toolUseID: 'toolu-override', thread: { id: 'T-parent' }, input: overrideInput })
		await amp.emit('tool.result', {
			tool: 'create_thread',
			toolUseID: 'toolu-override',
			thread: { id: 'T-parent' },
			status: 'done',
			output: { threadID: 'T-override' },
		})
		await Bun.sleep(0)
		expect(amp.sent).toHaveLength(0)
		expect(await writeAttempt(amp, 'T-override')).toEqual({ action: 'allow' })
		await expect(
			tool(amp, 'pstack_stop_agent').execute({ threadID: 'T-override' }, { thread: { id: 'T-parent' } }),
		).rejects.toThrow('Thread T-override is not a paired implementation child.')

		const custom = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{
					role: 'judgment',
					prompt: 'review with a custom mode',
					launchTarget: { kind: 'native-orb', project: 'amp/pstack', agentMode: 'medium' },
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(custom).toMatchObject({ agentModeOverride: true, create_thread: { agent_mode: 'medium' } })
	})

	test('native paired strict read-only children stay guarded after terminal state and reload', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-native-readonly-state-'))
		const runtimeStateFile = join(root, 'runtime.sqlite')
		try {
			const completed = {
				restoredThreadStates: { 'T-native-child': 'idle' as const },
				restoredThreadMessages: {
					'T-native-child': [{ id: 'M-final', role: 'assistant', content: [{ type: 'text', text: 'done' }] }],
				},
			}
			const first = await loadPlugin({ runtimeStateFile, ...completed })
			const native = JSON.parse(
				await tool(first, 'pstack_start_agent').execute(
					{
						role: 'how-explorer',
						prompt: 'investigate remotely',
						launchTarget: { kind: 'native-orb', project: 'amp/pstack' },
					},
					{ thread: { id: 'T-native-parent' } },
				),
			)
			await first.emit('tool.call', {
				tool: 'create_thread',
				toolUseID: 'toolu-native-readonly',
				thread: { id: 'T-native-parent' },
				input: native.create_thread,
			})
			await first.emit('tool.result', {
				tool: 'create_thread',
				toolUseID: 'toolu-native-readonly',
				thread: { id: 'T-native-parent' },
				status: 'done',
				output: { threadID: 'T-native-child' },
			})
			await Bun.sleep(0)
			expect(first.sent.filter(({ threadID }) => threadID === 'T-native-parent')).toHaveLength(1)
			expect(await writeAttempt(first, 'T-native-child')).toMatchObject({ action: 'reject-and-continue' })
			await first.dispose()

			const restored = await loadPlugin({ runtimeStateFile, ...completed })
			await Bun.sleep(0)
			expect(restored.sent).toHaveLength(0)
			expect(await writeAttempt(restored, 'T-native-child')).toEqual({
				action: 'reject-and-continue',
				message: 'Strict read-only role how-explorer cannot mutate files.',
			})
		} finally {
			await rm(root, { recursive: true, force: true })
		}
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
		expect(started).toMatchObject({
			action: 'use-native-create-thread',
			launchTarget: { kind: 'named-runner', runnerId: runner.id },
			create_thread: {
				executor: 'runner',
				runner_id: runner.id,
				agent_mode: 'pstack-feature',
				intent: 'delegation',
				prompt: backgroundChildPrompt('implement on the hardware runner', 'T-parent'),
			},
		})
		expect(started.next).toContain('inspect the actual child tool-call/result status and output')
		expect(started.next).toContain('steer that same child instead of replacing it')
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
		expect(native).toMatchObject({
			action: 'use-native-create-thread',
			create_thread: {
				executor: 'orb',
				orb_size: 'a1.large',
				project: 'amp/pstack',
				agent_mode: 'pstack-feature',
				prompt: backgroundChildPrompt('sized orb', 'T-parent'),
				intent: 'delegation',
			},
		})
		expect(native.next).toContain('Arbitrary native threads bypass')
		expect(native.next).toContain('inspect the actual child tool-call/result status and output')
		expect(native.next).toContain('steer that same child instead of replacing it')
		expect(redirected.started).toHaveLength(0)
		expect(redirected.registeredModes).toHaveLength(redirected.preloadedModeCount)
		expect(redirected.registeredModes.find(({ key }) => key === 'pstack-feature')).toMatchObject({
			label: 'pstack-feature',
			active: true,
			agent: { model: 'xai/grok-4.7', reasoningEffort: 'xhigh', tools: 'all' },
		})
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

	test('native implementation reservations pair when native input adds fields', async () => {
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
		const match = await amp.emit('tool.call', {
			tool: 'create_thread',
			toolUseID: 'toolu_match',
			thread: { id: 'T-parent' },
			input: { ...native.create_thread, unrelated: true },
		})
		expect(match).toEqual({ action: 'allow' })
		await expect(
			tool(amp, 'pstack_start_agent').execute(implStart, { thread: { id: 'T-parent' } }),
		).rejects.toThrow('conflicts with')
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

	test('native implementation children persist before terminal observation and honor cross-orb reports', async () => {
		for (const reported of [false, true]) {
			const amp = await loadPlugin({
				initialConfig: { [CONFIG_KEY]: { 'interrogate-reviewers': ['builtin:high'] } },
			})
			await tool(amp, 'pstack_run_panel').execute(
				{ panel: 'interrogate-reviewers', prompt: 'provide a native child handle' },
				{ thread: { id: 'T-panel-parent' } },
			)
			const child = amp.started[0] as {
				emit(state: string): void
				transcriptMessages: Array<Record<string, unknown>>
			}
			child.transcriptMessages = reported
				? [
						{ role: 'assistant', content: [{ type: 'tool_use', id: 'TU-report', name: 'pstack_send_to_thread', input: { threadID: 'T-parent', message: 'done' } }] },
						{ role: 'user', content: [{ type: 'tool_result', toolUseID: 'TU-report', status: 'done', output: 'sent' }] },
					]
				: [{ role: 'assistant', content: [{ type: 'text', text: 'unreported native result' }] }]
			const native = JSON.parse(await tool(amp, 'pstack_start_agent').execute(
				{ role: 'feature', prompt: 'native', scope: 'index.ts', launchTarget: { kind: 'native-orb', project: 'amp/pstack' } },
				{ thread: { id: 'T-parent' } },
			))
			await amp.emit('tool.call', {
				tool: 'create_thread', toolUseID: 'TU-native-owner', thread: { id: 'T-parent' }, input: native.create_thread,
			})
			await amp.emit('tool.result', {
				tool: 'create_thread', toolUseID: 'TU-native-owner', thread: { id: 'T-parent' }, status: 'done', output: { threadID: 'T-child' },
			})
			child.emit('running')
			child.emit('idle')
			await Bun.sleep(0)
			const fallback = amp.sent.filter(({ threadID }) => threadID === 'T-parent')
			expect(fallback).toHaveLength(reported ? 0 : 1)
			if (!reported) expect(String(fallback[0]?.content)).toContain('unreported native result')
		}
	})

	test('native background redirects track only their exact paired child through terminal fallback', async () => {
		const amp = await loadPlugin({
			initialConfig: { [CONFIG_KEY]: { 'architect-runners': ['builtin:high'] } },
		})
		await tool(amp, 'pstack_run_panel').execute(
			{ panel: 'architect-runners', prompt: 'supply a native child handle' },
			{ thread: { id: 'T-panel-parent' } },
		)
		const native = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{
					role: 'how-explorer',
					prompt: 'investigate',
					launchTarget: { kind: 'native-orb', project: 'amp/pstack' },
				},
				{ thread: { id: 'T-native-parent' } },
			),
		)
		await amp.emit('tool.call', {
			tool: 'create_thread',
			toolUseID: 'toolu-unrelated',
			thread: { id: 'T-native-parent' },
			input: { ...native.create_thread, unrelated: true },
		})
		await amp.emit('tool.result', {
			tool: 'create_thread',
			toolUseID: 'toolu-unrelated',
			thread: { id: 'T-native-parent' },
			status: 'done',
			output: { threadID: 'T-child' },
		})
		await amp.emit('tool.call', {
			tool: 'create_thread',
			toolUseID: 'toolu-native-background',
			thread: { id: 'T-native-parent' },
			input: native.create_thread,
		})
		const child = amp.started[0] as {
			emit(state: string): void
			transcriptMessages: Array<Record<string, unknown>>
		}
		child.transcriptMessages = [{ id: 'M-prompt', role: 'user', content: [{ type: 'text', text: 'investigate' }] }]
		await amp.emit('tool.result', {
			tool: 'create_thread',
			toolUseID: 'toolu-native-background',
			thread: { id: 'T-native-parent' },
			status: 'done',
			output: { threadID: 'T-child' },
		})
		expect(await amp.emit('tool.call', {
			tool: 'apply_patch',
			thread: { id: 'T-child' },
			input: {},
		})).toMatchObject({ action: 'reject-and-continue' })
		child.transcriptMessages.push({ id: 'M-final', role: 'assistant', content: [{ type: 'text', text: 'done' }] })
		child.emit('running')
		child.emit('idle')
		await Bun.sleep(0)
		expect(amp.sent.filter((message) => message.threadID === 'T-native-parent')).toHaveLength(1)
		child.emit('error')
		await Bun.sleep(0)
		expect(amp.sent.filter((message) => message.threadID === 'T-native-parent')).toHaveLength(1)
	})

	test('native background create errors and unresolved results clean their reservations', async () => {
		for (const result of [
			{ status: 'error', output: 'failed' },
			{ status: 'done', output: {} },
		]) {
			const amp = await loadPlugin()
			const native = JSON.parse(
				await tool(amp, 'pstack_start_agent').execute(
					{
						role: 'how-explorer',
						prompt: 'inspect',
						launchTarget: { kind: 'native-orb', project: 'amp/pstack' },
					},
					{ thread: { id: 'T-parent' } },
				),
			)
			await amp.emit('tool.call', {
				tool: 'create_thread', toolUseID: 'toolu-native', thread: { id: 'T-parent' }, input: native.create_thread,
			})
			await amp.emit('tool.result', {
				tool: 'create_thread', toolUseID: 'toolu-native', thread: { id: 'T-parent' }, ...result,
			})
			await amp.emit('tool.call', {
				tool: 'create_thread', toolUseID: 'toolu-late', thread: { id: 'T-parent' }, input: native.create_thread,
			})
			await amp.emit('tool.result', {
				tool: 'create_thread', toolUseID: 'toolu-late', thread: { id: 'T-parent' }, status: 'done', output: { threadID: 'T-late' },
			})
			expect(amp.sent).toEqual([])
		}
	})

	test('late native create result recognizes a child that already completed from its transcript', async () => {
		const amp = await loadPlugin({
			initialConfig: { [CONFIG_KEY]: { 'architect-runners': ['builtin:high'] } },
		})
		await tool(amp, 'pstack_run_panel').execute(
			{ panel: 'architect-runners', prompt: 'provide completed child' },
			{ thread: { id: 'T-panel-parent' } },
		)
		const child = amp.started[0] as { transcriptMessages: Array<Record<string, unknown>> }
		child.transcriptMessages = [
			{ id: 'M-prompt', role: 'user', content: [{ type: 'text', text: 'work' }] },
			{ id: 'M-final', role: 'assistant', content: [{ type: 'text', text: 'already complete' }] },
		]
		const native = JSON.parse(await tool(amp, 'pstack_start_agent').execute(
			{ role: 'how-explorer', prompt: 'work', launchTarget: { kind: 'native-orb', project: 'amp/pstack' } },
			{ thread: { id: 'T-native-parent' } },
		))
		await amp.emit('tool.call', {
			tool: 'create_thread', toolUseID: 'toolu-late-result', thread: { id: 'T-native-parent' }, input: native.create_thread,
		})
		await amp.emit('tool.result', {
			tool: 'create_thread', toolUseID: 'toolu-late-result', thread: { id: 'T-native-parent' }, status: 'done', output: { threadID: 'T-child' },
		})
		await Bun.sleep(0)
		expect(amp.sent).toContainEqual(expect.objectContaining({
			threadID: 'T-native-parent',
			content: expect.stringContaining('already complete'),
		}))
	})

	test('pairs concurrent identical native background reservations by distinct tool results', async () => {
		const amp = await loadPlugin({ initialConfig: { [CONFIG_KEY]: { 'architect-runners': ['builtin:high', 'builtin:medium'] } } })
		await tool(amp, 'pstack_run_panel').execute(
			{ panel: 'architect-runners', prompt: 'provide handles' }, { thread: { id: 'T-panel-parent' } },
		)
		for (const thread of amp.started as Array<{ transcriptMessages: Array<Record<string, unknown>> }>) {
			thread.transcriptMessages = [{ id: 'M-prompt', role: 'user', content: [] }]
		}
		const start = () => tool(amp, 'pstack_start_agent').execute(
			{ role: 'how-explorer', prompt: 'identical', launchTarget: { kind: 'native-orb', project: 'amp/pstack' } },
			{ thread: { id: 'T-native-parent' } },
		)
		const [first, second] = await Promise.all([start(), start()]).then((values) => values.map((value) => JSON.parse(value)))
		for (const [toolUseID, input] of [['toolu-1', first.create_thread], ['toolu-2', second.create_thread]] as const) {
			await amp.emit('tool.call', { tool: 'create_thread', toolUseID, thread: { id: 'T-native-parent' }, input })
		}
		await amp.emit('tool.result', { tool: 'create_thread', toolUseID: 'toolu-2', thread: { id: 'T-native-parent' }, status: 'done', output: { threadID: 'T-child-2' } })
		await amp.emit('tool.result', { tool: 'create_thread', toolUseID: 'toolu-1', thread: { id: 'T-native-parent' }, status: 'done', output: { threadID: 'T-child' } })
		for (const threadID of ['T-child', 'T-child-2']) {
			expect(await amp.emit('tool.call', { tool: 'apply_patch', thread: { id: threadID }, input: {} }))
				.toMatchObject({ action: 'reject-and-continue' })
		}
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
			{
				role: 'arena-cross-judge',
				prompt: 'judge it',
				candidateThreadIDs: panel.map(({ threadID }: { threadID: string }) => threadID),
			},
			{ thread: { id: 'T-parent' } },
		)
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toBeUndefined()
		const judge = amp.started.at(-1) as { id: string; emit: (state: string) => void }
		judge.emit('running')
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toBeUndefined()
		judge.emit('idle')
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toBeUndefined()
		expect(await amp.emit('tool.call', { tool: 'apply_patch', thread: { id: judge.id }, input: {} })).toEqual({
			action: 'reject-and-continue',
			message: 'Strict read-only role arena-cross-judge cannot mutate files.',
		})
		const startedAfterJudge = amp.started.length
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'arena-cross-judge',
					prompt: 'stale queued continuation',
					candidateThreadIDs: ['T-child', 'T-child-2'],
				},
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('No design run is waiting')
		expect(amp.started).toHaveLength(startedAfterJudge)
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'arena-cross-judge', prompt: 'missing IDs' },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('requires a non-empty candidateThreadIDs')
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'arena-cross-judge',
					prompt: 'malformed IDs',
					candidateThreadIDs: ['T-child', ''],
				},
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('requires a non-empty candidateThreadIDs')
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'arena-cross-judge',
					prompt: 'duplicate IDs',
					candidateThreadIDs: ['T-child', 'T-child'],
				},
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('candidateThreadIDs must be unique')

		const nextPanel = JSON.parse(
			await tool(amp, 'pstack_run_panel').execute(
				{ panel: 'architect-runners', prompt: 'sketch the next design' },
				{ thread: { id: 'T-parent' } },
			),
		)
		const startedBeforeStaleReplay = amp.started.length
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'arena-cross-judge',
					prompt: 'replay stale A IDs while B waits',
					candidateThreadIDs: ['T-child', 'T-child-2'],
				},
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('do not match the active design run')
		expect(amp.started).toHaveLength(startedBeforeStaleReplay)
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'arena-cross-judge',
					prompt: 'judge the next design',
					candidateThreadIDs: nextPanel
						.map(({ threadID }: { threadID: string }) => threadID)
						.reverse(),
				},
				{ thread: { id: 'T-parent' } },
			),
		).resolves.toBeDefined()
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
				{
					role: 'arena-cross-judge',
					prompt: 'judge too early',
					candidateThreadIDs: ['T-child', 'T-child-2'],
				},
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('design candidates are still running')

		const first = amp.started[0] as { emit: (state: string) => void }
		first.emit('idle')
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'arena-cross-judge',
					prompt: 'still too early',
					candidateThreadIDs: ['T-child', 'T-child-2'],
				},
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
				{
					role: 'arena-cross-judge',
					prompt: 'judge completed candidates',
					candidateThreadIDs: panel.map(
						({ threadID }: { threadID: string }) => threadID,
					),
				},
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(judge.threadID).toBe('T-child-3')
	})

	test('custom arena count cycles configured seats with unique prompts and gates its complete candidate set', async () => {
		const amp = await loadPlugin({
			initialConfig: {
				[CONFIG_KEY]: {
					'arena-runners': [
						{ model: 'openai/gpt-6-sol', effort: 'low' },
						{ model: 'xai/grok-4.7', effort: 'xhigh' },
					],
				},
			},
			waitError: new Error('panel wait expired'),
			waitState: 'running',
		})
		const panel = JSON.parse(
			await tool(amp, 'pstack_run_panel').execute(
				{ panel: 'arena-runners', prompt: 'compete', count: 6 },
				{ thread: { id: 'T-parent' } },
			),
		)
		expect(panel).toHaveLength(6)
		expect(panel.map(({ label }: { label: string }) => label)).toEqual([
			'arena-runners-candidate-1',
			'arena-runners-candidate-2',
			'arena-runners-candidate-3',
			'arena-runners-candidate-4',
			'arena-runners-candidate-5',
			'arena-runners-candidate-6',
		])
		expect(panel.map(({ model, effort }: { model: string; effort: string }) => [model, effort])).toEqual([
			['openai/gpt-6-sol', 'low'],
			['xai/grok-4.7', 'xhigh'],
			['openai/gpt-6-sol', 'low'],
			['xai/grok-4.7', 'xhigh'],
			['openai/gpt-6-sol', 'low'],
			['xai/grok-4.7', 'xhigh'],
		])
		expect(amp.started.map(({ prompt }) => prompt)).toEqual(
			Array.from(
				{ length: 6 },
				(_, index) => `compete\n\nCandidate output label: arena-runners-candidate-${index + 1}`,
			),
		)
		const candidateThreadIDs = panel.map(({ threadID }: { threadID: string }) => threadID)
		for (let index = 0; index < 6; index += 1) {
			await expect(
				tool(amp, 'pstack_start_agent').execute(
					{ role: 'arena-cross-judge', prompt: 'judge', candidateThreadIDs },
					{ thread: { id: 'T-parent' } },
				),
			).rejects.toThrow('design candidates are still running')
			;(amp.started[index] as { emit: (state: string) => void }).emit('idle')
		}
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'arena-cross-judge', prompt: 'stale subset', candidateThreadIDs: candidateThreadIDs.slice(0, 2) },
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('do not match the active design run')
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{ role: 'arena-cross-judge', prompt: 'judge all six', candidateThreadIDs },
				{ thread: { id: 'T-parent' } },
			),
		).resolves.toBeDefined()
	})

	test('candidate notification retains tracked IDs omitted from the panel result', async () => {
		const amp = await loadPlugin({
			appendError: new Error('prompt append failed'),
			initialConfig: {
				[CONFIG_KEY]: { 'architect-runners': ['builtin:high', 'builtin:medium'] },
			},
		})
		const panel = JSON.parse(
			await tool(amp, 'pstack_run_panel').execute(
				{ panel: 'architect-runners', prompt: 'sketch it' },
				{ thread: { id: 'T-parent' } },
			),
		)

		expect(panel[0]).toMatchObject({ status: 'error' })
		expect(panel[0].threadID).toBeUndefined()
		expect(panel[1].threadID).toBe('T-child-2')
		expect(amp.sent.at(-1)).toEqual({
			threadID: 'T-parent',
			content:
				'Design candidates are terminal. Start the required cross-judge for architect-runners with candidateThreadIDs: ["T-child","T-child-2"]. Ignore stale judge requests whose candidate ID set differs.',
			steer: true,
		})
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
			{ role: 'arena-cross-judge', prompt: 'judge it', candidateThreadIDs: ['T-child'] },
			{ thread: { id: 'T-parent' } },
		)
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toBeUndefined()
		await expect(
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'arena-cross-judge',
					prompt: 'duplicate judge',
					candidateThreadIDs: ['T-child'],
				},
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('already reserved or running')

		const judge = amp.started.at(-1) as { emit: (state: string) => void }
		judge.emit('running')
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toBeUndefined()
		const sentBeforeFailure = amp.sent.length
		judge.emit('error')
		expect(amp.sent).toHaveLength(sentBeforeFailure + 1)
		expect(amp.sent.at(-1)).toEqual({
			threadID: 'T-parent',
			content:
				'Cross-judge T-child-2 failed. Start one replacement judge for architect-runners with the same candidateThreadIDs: ["T-child"].',
			steer: true,
		})
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toMatchObject({
			action: 'continue',
		})
		const replacement = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{
					role: 'arena-cross-judge',
					prompt: 'replacement judge',
					candidateThreadIDs: ['T-child'],
				},
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
				{
					role: 'arena-cross-judge',
					prompt: 'judge across reload',
					candidateThreadIDs: ['T-child'],
				},
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
					{
						role: 'arena-cross-judge',
						prompt: 'duplicate after reload',
						candidateThreadIDs: ['T-child'],
					},
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
					candidateThreadIDs: ['T-child'],
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
					candidateThreadIDs: ['T-child'],
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
				{
					role: 'arena-cross-judge',
					prompt: 'duplicate judge',
					candidateThreadIDs: ['T-child'],
				},
				{ thread: { id: 'T-parent' } },
			),
		).rejects.toThrow('already reserved or running')
		await amp.emit('tool.call', {
			tool: 'create_thread',
			toolUseID: 'toolu_native_judge',
			thread: { id: 'T-parent' },
			input: { ...native.create_thread, unrelated: true },
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
		expect(await amp.emit('tool.call', { tool: 'apply_patch', thread: { id: panel[0].threadID }, input: {} })).toEqual({
			action: 'reject-and-continue',
			message: 'Strict read-only role arena-cross-judge cannot mutate files.',
		})
	})

	const declaredAgentModes = async () =>
		[...(await Bun.file(join(import.meta.dir, 'index.ts')).text()).matchAll(/^\/\/ @amp-agent-mode (.+)$/gm)].map(
			([, metadata]) => JSON.parse(metadata!) as { key: string; label: string },
		)

	const settledDesignCandidates = async (amp: { tools: Map<string, TestTool> }, parentThreadID: string) =>
		(
			JSON.parse(
				await tool(amp, 'pstack_run_panel').execute(
					{ panel: 'architect-runners', prompt: 'sketch it' },
					{ thread: { id: parentThreadID } },
				),
			) as Array<{ threadID: string }>
		).map(({ threadID }) => threadID)

	const parentOn = (id: string, model: string) => ({
		thread: { id, agent: async () => ({ definition: { kind: 'agent-definition', model, instructions: '' } }) },
	})

	test('static @amp-agent-mode comments declare exactly the stable native mode table', async () => {
		const declared = await declaredAgentModes()
		expect(declared).toHaveLength(20)
		expect(declared).toEqual(NATIVE_AGENT_MODES.map(({ key, label }) => ({ key, label })))
	})

	test('native-orb and named-runner redirects use the declared stable mode of every native-eligible role', async () => {
		const expected: Record<string, string> = {
			hardest: 'pstack-hardest',
			feature: 'pstack-feature',
			refactoring: 'pstack-refactoring',
			'bug-fix': 'pstack-bug-fix',
			'perf-issue': 'pstack-perf-issue',
			hillclimb: 'pstack-hillclimb',
			judgment: 'pstack-judgment',
			'how-explorer': 'pstack-how-explorer',
			'how-explainer': 'pstack-how-explainer',
			'why-investigator': 'pstack-why-investigator',
			'why-synthesizer': 'pstack-why-synthesizer',
			'reflect-tooling': 'pstack-reflect-tooling',
			'reflect-judgment': 'pstack-reflect-judgment',
			'reflect-divergent': 'pstack-reflect-divergent',
			'reflect-synthesizer': 'pstack-reflect-synth',
			'swarm-worker': 'pstack-swarm-worker',
			'comment-reviewer': 'pstack-comment-reviewer',
			'arena-cross-judge': 'pstack-cross-judge-1',
		}
		const panels = ['arena-runners', 'architect-runners', 'interrogate-reviewers']
		expect(Object.keys(expected)).toEqual(Object.keys(DEFAULT_MODELS).filter((role) => !panels.includes(role)))
		const amp = await loadPlugin({ initialConfig: { [CONFIG_KEY]: { 'architect-runners': ['builtin:high'] } } })
		const observed: string[] = []
		for (const launchTarget of [
			{ kind: 'native-orb', project: 'amp/pstack' },
			{ kind: 'named-runner', runnerId: 'mac-mini' },
		]) {
			for (const role of Object.keys(expected)) {
				const parentThreadID = `T-${launchTarget.kind}-${role}`
				const redirect = JSON.parse(
					await tool(amp, 'pstack_start_agent').execute(
						{
							role,
							prompt: 'work',
							scope: `src/${launchTarget.kind}/${role}.ts`,
							candidateThreadIDs:
								role === 'arena-cross-judge' ? await settledDesignCandidates(amp, parentThreadID) : undefined,
							launchTarget,
						},
						{ thread: { id: parentThreadID } },
					),
				)
				observed.push(`${launchTarget.kind} ${role} ${redirect.create_thread.agent_mode}`)
			}
		}
		expect(observed).toEqual(
			['native-orb', 'named-runner'].flatMap((kind) =>
				Object.entries(expected).map(([role, key]) => `${kind} ${role} ${key}`),
			),
		)
		const declaredKeys = (await declaredAgentModes()).map(({ key }) => key)
		expect(Object.values(expected).filter((key) => !declaredKeys.includes(key))).toEqual([])
	})

	test('native judge redirect uses the stable mode of the selected pool seat', async () => {
		const amp = await loadPlugin({
			initialConfig: {
				[CONFIG_KEY]: {
					'architect-runners': ['builtin:high'],
					'arena-cross-judge': ['xai/grok-4.7', 'openai/gpt-5.6-sol', 'anthropic/claude-opus-5-5'],
				},
			},
		})
		const redirect = JSON.parse(
			await tool(amp, 'pstack_start_agent').execute(
				{
					role: 'arena-cross-judge',
					prompt: 'judge it',
					candidateThreadIDs: await settledDesignCandidates(amp, 'T-parent'),
					launchTarget: { kind: 'native-orb', project: 'amp/pstack' },
				},
				parentOn('T-parent', 'xai/grok-4.5'),
			),
		)
		expect(redirect).toMatchObject({ model: 'openai/gpt-5.6-sol', create_thread: { agent_mode: 'pstack-cross-judge-2' } })
		expect(amp.registeredModes.find(({ key }) => key === 'pstack-cross-judge-2')?.agent).toMatchObject({
			model: 'openai/gpt-5.6-sol',
		})
	})

	test('native judge redirect rejects a pool seat without a stable mode and releases the reservation', async () => {
		const amp = await loadPlugin({
			initialConfig: {
				[CONFIG_KEY]: {
					'architect-runners': ['builtin:high'],
					'arena-cross-judge': ['xai/grok-4.7', 'builtin:high', 'xai/grok-4.5', 'openai/gpt-5.6-sol'],
				},
			},
		})
		const candidateThreadIDs = await settledDesignCandidates(amp, 'T-parent')
		const startJudge = (parentModel: string) =>
			tool(amp, 'pstack_start_agent').execute(
				{
					role: 'arena-cross-judge',
					prompt: 'judge it',
					candidateThreadIDs,
					launchTarget: { kind: 'native-orb', project: 'amp/pstack' },
				},
				parentOn('T-parent', parentModel),
			)
		await expect(startJudge('xai/grok-4.5')).rejects.toThrow(
			'arena-cross-judge selected pool seat 4, but native-orb and named-runner redirects support only seats 1-3.',
		)
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toEqual({
			action: 'continue',
			userMessage:
				'Call pstack_start_agent with role arena-cross-judge and candidateThreadIDs before completing this design run. Candidate thread IDs (copy this JSON list into candidateThreadIDs): ["T-child"]. Ignore this request if those IDs belong to a stale design run. Pick, graft, synthesis quality, and verification stay with this parent.',
		})
		const retry = JSON.parse(await startJudge('openai/gpt-6-sol'))
		expect(retry.create_thread.agent_mode).toBe('pstack-cross-judge-1')
		expect(await amp.emit('agent.end', { thread: { id: 'T-parent' } })).toMatchObject({
			userMessage: expect.stringContaining('Call native create_thread next'),
		})
	})

	test('a restored judging run without a stored guard row keeps the judge read-only', async () => {
		const root = await mkdtemp(join(tmpdir(), 'pstack-judging-guard-restore-'))
		const runtimeStateFile = join(root, 'runtime.sqlite')
		try {
			const legacy = new RuntimeStore(runtimeStateFile)
			legacy.saveDesignRun({
				state: 'judging',
				parentThreadID: 'T-parent',
				panel: 'architect-runners',
				candidateThreadIDs: ['T-candidate'],
				judgeThreadID: 'T-judge',
			})
			expect(legacy.readonlyGuard('T-judge')).toBeUndefined()
			legacy.close()

			const restored = await loadPlugin({ runtimeStateFile, restoredThreadStates: { 'T-judge': 'running' } })
			expect(await writeAttempt(restored, 'T-judge')).toEqual({
				action: 'reject-and-continue',
				message: 'Strict read-only role arena-cross-judge cannot mutate files.',
			})
			expect(await writeAttempt(restored, 'T-parent')).toEqual({ action: 'allow' })
		} finally {
			await rm(root, { recursive: true, force: true })
		}
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
