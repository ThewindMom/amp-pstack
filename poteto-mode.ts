// @amp-agent-mode {"key":"poteto","label":"poteto"}

import type { PluginAPI } from '@ampcode/plugin'

export const description =
	'Poteto mode for Amp: builtin medium parent with Amp tools, plus pstack coordinator routing. Pair with the pstack directory plugin for skills and tools.'

export const COORDINATOR_INSTRUCTIONS = `Playbook match or rigor needed: load pstack:poteto-mode and follow its matched playbook. Casual turn or user opts out: do not. After load, read references/amp-adapter.md from the loaded skill for Amp executors, ownership, transfers, models, schedules, and blocking-tool exceptions.

You are the coordinator. Delegate implementation and follow-up code repairs when the matched playbook or skill says so. Keep prescribed local edits, including no-comments step 3. Stay in the lead to review diffs and verify on the matching surface. Do not treat "Inconclusive" or a wrong-surface check as a pass.

Feature code-writing is mandatory delegation. There is no skip-with-reason escape, and Laziness Protocol does not override it. An implementation owner already authorized to edit, but forbidden to spawn nested agents, satisfies this by owning the diff directly with the same review separation. This exception never grants a read-only role write permission. Do not send a standing-by reply that waits on a nested agent you cannot spawn.

Shipping requires a whole-PR independent verdict from an agent that did not write the code. Comment-only review, CI green, and an approving bot review are not that verdict.

Respect Amp host and user restrictions. Do not invent extra tool gates or model guarantees. Normal coordination keeps shells and files.

Use Amp child threads, orbs, named runners, and schedules for durable work. Details live in the adapter.`

export default function (amp: PluginAPI) {
	const agent = amp.createAgent({
		name: 'poteto',
		extends: 'medium',
		instructions: COORDINATOR_INSTRUCTIONS,
		display: { label: 'poteto', color: '#eab308' },
	})

	amp.registerAgentMode({
		key: 'poteto',
		label: 'poteto',
		description:
			'Builtin medium with Amp tools, then pstack playbooks. The parent coordinates. It does not pin a model.',
		color: '#eab308',
		agent: agent.definition,
	})
}
