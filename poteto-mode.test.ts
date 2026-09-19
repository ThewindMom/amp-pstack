import { describe, expect, test } from 'bun:test'

import potetoMode, { description } from './poteto-mode'

describe('poteto mode', () => {
	test('uses builtin medium for coordination', () => {
		const created: Array<Record<string, unknown>> = []
		const registered: Array<Record<string, unknown>> = []
		const amp = {
			createAgent(definition: Record<string, unknown>) {
				created.push(definition)
				return { definition }
			},
			registerAgentMode(definition: Record<string, unknown>) {
				registered.push(definition)
				return { unsubscribe() {} }
			},
		} as never

		potetoMode(amp)

		expect(created).toHaveLength(1)
		expect(created[0]?.extends).toBe('medium')
		expect(registered).toHaveLength(1)
		expect(registered[0]?.key).toBe('poteto')
		expect(registered[0]?.agent).toEqual(created[0])
		expect(description).toContain('builtin medium parent')
		expect(registered[0]?.description).toContain('Builtin medium')
	})

	test('keeps the skill and watcher instructions aligned with the runtime', async () => {
		const [skill, babysit, shipping, readme] = await Promise.all([
			Bun.file(new URL('skills/poteto-mode/SKILL.md', import.meta.url)).text(),
			Bun.file(new URL('skills/poteto-mode/playbooks/babysit.md', import.meta.url)).text(),
			Bun.file(new URL('skills/poteto-mode/playbooks/shipping.md', import.meta.url)).text(),
			Bun.file(new URL('README.md', import.meta.url)).text(),
		])

		expect(skill).toContain('parent is Amp builtin `medium`')
		expect(skill).toContain('Raw Grok delegates request `reasoningEffort: xhigh`')
		expect(readme).toContain('Raw `xai/grok-4.6` explicitly requests `reasoningEffort: xhigh`')
		expect(babysit).toContain('bun <loaded-skill-base>/scripts/watch-pr/watch-pr')
		expect(shipping).toContain('bun <loaded-skill-base>/scripts/watch-pr/watch-pr')
	})
})
