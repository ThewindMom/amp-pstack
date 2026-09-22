import { describe, expect, test } from 'bun:test'

import potetoMode, { COORDINATOR_INSTRUCTIONS, description } from './poteto-mode'

function registerPoteto() {
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
	return { created, registered }
}

describe('poteto mode', () => {
	test('uses GPT-6 Sol at medium reasoning for coordination', () => {
		const { created, registered } = registerPoteto()

		expect(created).toHaveLength(1)
		expect(created[0]?.extends).toBe('medium')
		expect(created[0]?.model).toBe('openai/gpt-6-sol')
		expect(created[0]?.reasoningEffort).toBe('medium')
		expect(created[0]).not.toHaveProperty('tools')
		expect(registered).toHaveLength(1)
		expect(registered[0]?.key).toBe('poteto')
		expect(registered[0]?.agent).toEqual(created[0])
		expect(description).toContain('GPT-6 Sol at medium reasoning')
		expect(registered[0]?.description).toContain('GPT-6 Sol at medium reasoning')
	})

	test('keeps the skill and adapter model paragraph aligned with the runtime', async () => {
		const [skill, adapter, babysit, shipping] = await Promise.all([
			Bun.file(new URL('skills/poteto-mode/SKILL.md', import.meta.url)).text(),
			Bun.file(new URL('skills/poteto-mode/references/amp-adapter.md', import.meta.url)).text(),
			Bun.file(new URL('skills/poteto-mode/playbooks/babysit.md', import.meta.url)).text(),
			Bun.file(new URL('skills/poteto-mode/playbooks/shipping.md', import.meta.url)).text(),
		])
		const modelProse = `${skill}\n${adapter}`

		expect(modelProse).toContain('parent is Amp builtin `medium` plus **poteto-mode**, pinned to `openai/gpt-6-sol` at medium reasoning')
		expect(modelProse).toContain('Raw Grok 4.7 pstack delegates request `reasoningEffort: medium`')
		expect(babysit).toContain('bun <loaded-skill-base>/scripts/watch-pr/watch-pr')
		expect(shipping).toContain('bun <loaded-skill-base>/scripts/watch-pr/watch-pr')
	})

	test('loads the skill then the adapter from the loaded skill base', () => {
		const { created } = registerPoteto()
		expect(created[0]?.instructions).toBe(COORDINATOR_INSTRUCTIONS)
		expect(COORDINATOR_INSTRUCTIONS).toContain('load pstack:poteto-mode')
		expect(COORDINATOR_INSTRUCTIONS).toContain('Casual turn or user opts out')
		expect(COORDINATOR_INSTRUCTIONS).toContain('read references/amp-adapter.md from the loaded skill')
		expect(COORDINATOR_INSTRUCTIONS).not.toContain('skills/poteto-mode/references/amp-adapter.md')
		expect(COORDINATOR_INSTRUCTIONS).not.toContain('before acting')
	})
})
