import { describe, expect, test } from 'bun:test'

import pstack, { DEFAULT_MODELS, SKILL_PATHS, description } from './index'

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
