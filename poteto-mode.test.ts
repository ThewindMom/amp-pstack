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
})
