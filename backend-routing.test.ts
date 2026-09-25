import { expect, test } from 'bun:test'
import { backendPreferences, grokSubscriptionWins } from './backend-routing'

test('Grok uses native only when its active subscription strictly precedes every possible Grok route', () => {
	const sub = { type: 'model_provider_xai_grok', active: true, priority: 3 }
	const proxy = { type: 'model_provider_custom_url', active: true, priority: 8, config: { modelMapping: 'xai/grok-4.7 -> cursor/grok-4.7-high-fast' } }
	expect(grokSubscriptionWins([sub, proxy])).toBe(true)
	expect(grokSubscriptionWins([{ ...sub, active: false }, proxy])).toBe(false)
	expect(grokSubscriptionWins([sub, { ...proxy, priority: 2 }])).toBe(false)
	expect(grokSubscriptionWins([sub, { ...proxy, priority: 3 }])).toBe(false)
	expect(grokSubscriptionWins([sub, { ...proxy, priority: 1, config: { modelMapping: 'anthropic/claude-opus-5-5 -> opus' } }])).toBe(true)
	expect(grokSubscriptionWins([sub, { ...proxy, priority: 1, config: {} }])).toBe(false)
	expect(grokSubscriptionWins([sub, { ...proxy, priority: 1, config: { modelMapping: '* -> proxy' } }])).toBe(false)
	expect(grokSubscriptionWins([sub, { ...proxy, priority: 1, active: false }])).toBe(true)
	expect(grokSubscriptionWins([sub, { ...proxy, priority: 1, config: { modelMapping: 'xai/grok-4.7 # gateway' } }])).toBe(false)
	expect(grokSubscriptionWins([{ ...sub, config: { modelMapping: '-xai/*' } }, proxy])).toBe(false)
	expect(grokSubscriptionWins([sub, { ...proxy, priority: 1, config: { modelMapping: '*/*\n-xai/*' } }])).toBe(true)
	expect(grokSubscriptionWins([sub, { ...proxy, priority: 1, config: { modelMapping: '*/*\n-xai/*\nxai/grok-4.7' } }])).toBe(false)
	for (const modelMapping of [{}, '[xai/*]']) {
		expect(grokSubscriptionWins([{ ...sub, config: { modelMapping } }, proxy])).toBe(false)
		expect(grokSubscriptionWins([sub, { ...proxy, priority: 1, config: { modelMapping } }])).toBe(false)
	}
	expect(grokSubscriptionWins({})).toBe(false)
	expect(grokSubscriptionWins([sub, { active: true }])).toBe(false)
})

test('Opus defaults to Claude Code, Grok Build is opt-in, and unknown preferences fail', () => {
	expect(backendPreferences(undefined)).toEqual({ opus: 'claude-code', grokBuild: false })
	expect(backendPreferences({ opus: 'amp', grokBuild: true })).toEqual({ opus: 'amp', grokBuild: true })
	expect(() => backendPreferences({ grok: 'amp' })).toThrow('Backend preferences')
})
