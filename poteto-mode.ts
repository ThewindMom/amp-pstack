// @amp-agent-mode {"key":"poteto","label":"poteto"}

import { existsSync, readFileSync } from 'node:fs'
import type { PluginAPI } from '@ampcode/plugin'

export const description =
	'Poteto mode for Amp: GPT-6 Sol at medium reasoning with Amp medium tools and the full persistent pstack instructions. Pair with the pstack directory plugin for skills and tools.'

const skillBase = new URL(existsSync(new URL('skills/poteto-mode/SKILL.md', import.meta.url))
	? 'skills/poteto-mode/' : 'pstack/skills/poteto-mode/', import.meta.url)

export const COORDINATOR_INSTRUCTIONS = `Playbook match or rigor needed: load pstack:poteto-mode and follow its matched playbook. Casual turn or user opts out: do not. After load, read references/amp-adapter.md from the loaded skill for Amp executors, ownership, transfers, models, schedules, and blocking-tool exceptions.

You are the coordinator. Delegate implementation and follow-up code repairs when the matched playbook or skill says so. Keep prescribed local edits, including no-comments step 3. Stay in the lead to review diffs and verify on the matching surface. Do not treat "Inconclusive" or a wrong-surface check as a pass.

Feature code-writing is mandatory delegation. There is no skip-with-reason escape, and Laziness Protocol does not override it. An implementation owner already authorized to edit, but forbidden to spawn nested agents, satisfies this by owning the diff directly with the same review separation. This exception never grants a read-only role write permission. Do not send a standing-by reply that waits on a nested agent you cannot spawn.

Shipping requires a whole-PR independent verdict from an agent that did not write the code. Comment-only review, CI green, and an approving bot review are not that verdict.

Respect Amp host and user restrictions. Do not invent extra tool gates or model guarantees. Normal coordination keeps shells and files.

Use Amp child threads, orbs, named runners, and schedules for durable work. Details live in the adapter.

The full Poteto skill below is part of this mode's persistent instructions. Its resource base is ${skillBase.pathname}. Read playbooks and references from that directory.

${readFileSync(new URL('SKILL.md', skillBase), 'utf8')}`

export default function (amp: PluginAPI) {
	const agent = amp.createAgent({
		name: 'poteto',
		extends: 'medium',
		model: 'openai/gpt-6-sol',
		reasoningEffort: 'medium',
		instructions: COORDINATOR_INSTRUCTIONS,
		display: { label: 'poteto', color: '#eab308' },
	})

	amp.registerAgentMode({
		key: 'poteto',
		label: 'poteto',
		description:
			'GPT-6 Sol at medium reasoning with Amp medium tools and full persistent pstack instructions. The parent coordinates.',
		color: '#eab308',
		agent: agent.definition,
	})
}
