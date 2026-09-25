import { describe, expect, test } from 'bun:test'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
	test('loads the complete skill from the published root-selector layout', () => {
		const root = mkdtempSync(join(tmpdir(), 'pstack-selector-'))
		try {
			mkdirSync(join(root, 'pstack/skills/poteto-mode'), { recursive: true })
			copyFileSync(join(import.meta.dir, 'poteto-mode.ts'), join(root, 'poteto-mode.ts'))
			copyFileSync(join(import.meta.dir, 'skills/poteto-mode/SKILL.md'), join(root, 'pstack/skills/poteto-mode/SKILL.md'))
			const result = Bun.spawnSync([process.execPath, '-e', `import { COORDINATOR_INSTRUCTIONS } from './poteto-mode.ts'; console.log(COORDINATOR_INSTRUCTIONS)`], { cwd: root })
			expect(result.exitCode).toBe(0)
			expect(result.stdout.toString()).toContain(`${root}/pstack/skills/poteto-mode/`)
			expect(result.stdout.toString().trimEnd()).toBe(COORDINATOR_INSTRUCTIONS.replace(new URL('skills/poteto-mode/', import.meta.url).pathname, `${root}/pstack/skills/poteto-mode/`).trimEnd())
		} finally {
			rmSync(root, { recursive: true, force: true })
		}
	})

	test('inherits built-in medium without model, reasoning, or tool overrides', () => {
		const { created, registered } = registerPoteto()

		expect(created).toHaveLength(1)
		expect(created[0]?.extends).toBe('medium')
		expect(created[0]).not.toHaveProperty('model')
		expect(created[0]).not.toHaveProperty('reasoningEffort')
		expect(created[0]).not.toHaveProperty('tools')
		expect(registered).toHaveLength(1)
		expect(registered[0]?.key).toBe('poteto')
		expect(registered[0]?.agent).toEqual(created[0])
		expect(description).toContain('built-in medium')
		expect(registered[0]?.description).toContain('Built-in medium')
	})

	test('documents coordinator, delegate, and child-thread behavior accurately', async () => {
		const [skill, adapter, babysit, shipping] = await Promise.all([
			Bun.file(new URL('skills/poteto-mode/SKILL.md', import.meta.url)).text(),
			Bun.file(new URL('skills/poteto-mode/references/amp-adapter.md', import.meta.url)).text(),
			Bun.file(new URL('skills/poteto-mode/playbooks/babysit.md', import.meta.url)).text(),
			Bun.file(new URL('skills/poteto-mode/playbooks/shipping.md', import.meta.url)).text(),
		])
		const modelProse = `${skill}\n${adapter}`

		expect(modelProse).toContain('parent is Amp builtin `medium` plus **poteto-mode**, with no model or reasoning override')
		expect(adapter).toMatch(/Opus 5\.5 and GPT-6 Sol seats request `reasoningEffort: max`/)
		expect(adapter).toMatch(/Grok 4\.7 seats request `reasoningEffort: xhigh`/)
		expect(adapter).toContain('An explicit seat effort overrides that default.')
		expect(skill).toContain('The hardest implementation changes read `hardest`')
		expect(skill).toContain('prose and review judgment read `judgment`')
		expect(adapter).toContain('page `pstack_read_current_thread` by `offset`')
		expect(adapter).toMatch(/cancel any durably tracked child owned by the current parent/)
		expect(adapter).toMatch(/cancellation does not release that claim until Amp observes terminal `idle` or `error`/)
		expect(adapter).toMatch(/complete the returned native `create_thread` call so the plugin can pair that exact thread ID/)
		expect(adapter).toMatch(/reservation with no paired native child cannot be canceled[\s\S]*Reconcile the native create result first/)
		expect(babysit).toContain('bun <loaded-skill-base>/scripts/watch-pr/watch-pr')
		expect(shipping).toContain('bun <loaded-skill-base>/scripts/watch-pr/watch-pr')
	})

	test('persists the complete skill in mode instructions and names its resource base', async () => {
		const { created } = registerPoteto()
		expect(created[0]?.instructions).toBe(COORDINATOR_INSTRUCTIONS)
		const skill = await Bun.file(new URL('skills/poteto-mode/SKILL.md', import.meta.url)).text()
		expect(COORDINATOR_INSTRUCTIONS.endsWith(skill)).toBe(true)
		expect(COORDINATOR_INSTRUCTIONS).toContain(new URL('skills/poteto-mode/', import.meta.url).pathname)
		expect(COORDINATOR_INSTRUCTIONS).toContain('load pstack:poteto-mode')
		expect(COORDINATOR_INSTRUCTIONS).toContain('Casual turn or user opts out')
		expect(COORDINATOR_INSTRUCTIONS).toContain('read references/amp-adapter.md from the loaded skill')
		expect(COORDINATOR_INSTRUCTIONS).not.toContain('skills/poteto-mode/references/amp-adapter.md')
	})
})
