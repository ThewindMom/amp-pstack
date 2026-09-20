import { describe, expect, test } from 'bun:test'

import { COORDINATOR_INSTRUCTIONS } from './poteto-mode'
import port from './upstream-port.json'

const PINNED_COMMIT = '032be146865d973682535de75f2287da438550bf'
const PINNED_VERSION = '0.15.2'
const PINNED_REPO = 'https://github.com/cursor/plugins'

function repoFile(relative: string) {
	return Bun.file(new URL(relative, import.meta.url)).text()
}

describe('upstream port provenance', () => {
	test('records the pinned cursor/plugins pstack 0.15.2 commit', () => {
		expect(port.upstream.repository).toBe(PINNED_REPO)
		expect(port.upstream.path).toBe('pstack')
		expect(port.upstream.commit).toBe(PINNED_COMMIT)
		expect(port.upstream.version).toBe(PINNED_VERSION)
		expect(port.upstream.tree).toBe(`${PINNED_REPO}/tree/${PINNED_COMMIT}/pstack`)
	})
})

describe('coordinator wrapper', () => {
	test('keeps the nested-spawn-forbidden ownership exception on an implementation owner', () => {
		expect(COORDINATOR_INSTRUCTIONS).toContain(
			'An implementation owner already authorized to edit, but forbidden to spawn nested agents, satisfies this by owning the diff directly with the same review separation',
		)
		expect(COORDINATOR_INSTRUCTIONS).toContain('This exception never grants a read-only role write permission')
		expect(COORDINATOR_INSTRUCTIONS).toContain('no skip-with-reason escape')
		expect(COORDINATOR_INSTRUCTIONS).toContain(
			'Shipping requires a whole-PR independent verdict from an agent that did not write the code',
		)
		expect(COORDINATOR_INSTRUCTIONS).toContain('Respect Amp host and user restrictions')
		expect(COORDINATOR_INSTRUCTIONS).toContain('Casual turn or user opts out')
		expect(COORDINATOR_INSTRUCTIONS).toContain('when the matched playbook or skill says so')
		expect(COORDINATOR_INSTRUCTIONS).toContain('no-comments step 3')
	})
})

describe('pinned upstream decision contracts', () => {
	test('feature still mandates delegation with the nested-spawn ownership exception', async () => {
		const feature = await repoFile('skills/poteto-mode/playbooks/feature.md')
		expect(feature).toContain(
			'Mandatory: no skip-with-reason escape, and Laziness Protocol does not override it (the gain is review separation, not lines saved).',
		)
		expect(feature).toMatch(
			/A (child|subagent) forbidden to spawn satisfies this by owning the diff directly with the same review separation/,
		)
		expect(feature).toContain('You own the design. Plan, review, verify.')
		expect(feature).toContain('Delegate implementation')
	})

	test('verification cannot call an inconclusive check a pass', async () => {
		const feature = await repoFile('skills/poteto-mode/playbooks/feature.md')
		const bugFix = await repoFile('skills/poteto-mode/playbooks/bug-fix.md')
		expect(feature).toContain('"Inconclusive" or wrong-surface is not a pass')
		expect(bugFix).toContain('"Inconclusive" or wrong-surface is not a pass')
	})

	test('shipping still requires an independent whole-PR verdict', async () => {
		const shipping = await repoFile('skills/poteto-mode/playbooks/shipping.md')
		expect(shipping).toContain('Safe means a verdict from an agent that did not write the code.')
		expect(shipping).toContain('CI green is not a verdict, and an approving bot review is not a verdict.')
	})

	test('why still launches one background source reader per evidence category', async () => {
		const why = await repoFile('skills/why/SKILL.md')
		expect(why).toContain('Spawn one investigator per category that has a matching MCP. Each owns exactly one tool or MCP.')
		expect(why).toContain('Always spawn. The only guaranteed source.')
		expect(why).toContain('role `why-investigator`')
		expect(why).toContain('pstack_start_agent')
	})

	test('adapter owns exclusive child ownership and background spawn policy', async () => {
		const adapter = await repoFile('skills/poteto-mode/references/amp-adapter.md')
		const skill = await repoFile('skills/poteto-mode/SKILL.md')
		expect(adapter).toContain('The child exclusively owns its declared paths')
		expect(adapter).toContain('run_in_background: true')
		expect(adapter).toContain('pstack_start_agent')
		expect(adapter).toContain('A terminal error requires reconciliation before replacement')
		expect(adapter).toContain('Never redo or replace a live owner')
		expect(skill).toContain('Always pause without explicit authorization')
	})

	test('autopilot playbooks do not git-show plugin paths from the target repo', async () => {
		for (const name of ['autopilot-full.md', 'autopilot-stack.md'] as const) {
			const text = await repoFile(`skills/poteto-mode/playbooks/${name}`)
			expect(text).not.toContain('git show origin/main:skills/poteto-mode')
		}
	})

	test('maintain-verification source wave uses one how-explorer per feature file', async () => {
		const maintain = await repoFile('skills/maintain-verification-skill/SKILL.md')
		const adapter = await repoFile('skills/poteto-mode/references/amp-adapter.md')
		expect(maintain).toMatch(/One read-only (child|subagent) per feature file/)
		expect(adapter).toContain('how-explorer` (one per feature file)')
	})
})

describe('intentional Amp departures', () => {
	test('labels host autonomy, durable threads, and advisory mode as departures from pinned clauses', () => {
		const ids = port.intentionalDepartures.map((entry) => entry.id)
		expect(ids).toContain('amp-host-autonomy')
		expect(ids).toContain('durable-threads')
		expect(ids).toContain('runtime-mode-advisory')
		expect(port.intentionalDepartures.find((entry) => entry.id === 'amp-host-autonomy')?.from).toContain('**Just do it.**')
		expect(port.intentionalDepartures.find((entry) => entry.id === 'durable-threads')?.from).toContain(
			'`run_in_background: true`',
		)
		expect(port.intentionalDepartures.find((entry) => entry.id === 'runtime-mode-advisory')?.to).toContain('advisory')
	})
})
