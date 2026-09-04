// @amp-agent-mode {"key":"poteto","label":"poteto"}

import type { PluginAPI } from '@ampcode/plugin'

export const description =
	'Poteto mode for Amp: builtin medium (Sol) parent with Amp tools, plus pstack routing. Grok stays on code and explorer workers. Pair with the pstack directory plugin for skills and tools.'

const PSTACK_ROUTING = `For every nontrivial task, load the pstack:poteto-mode skill before acting and follow its matched playbook. Load referenced pstack skills when their trigger applies. Default long work to pstack_start_agent so the parent does not freeze; the child reports with pstack_send_to_thread. Route from the parent executor first: local parents keep dirty or machine-bound work in current-checkout and may send clean independent work to parent-project-orb; orb parents default children to fresh parent-project-orb execution and cannot route a child into the parent orb's live filesystem. Keep dependent parent-orb work in that parent or transfer/persist its inputs first. The child exclusively owns its delegated scope. Continue parent work that is independent of that scope, then end the turn when blocked on the child. Do not call wait_for_threads to judge startup: Amp returns unknown/settled on an empty child and that is not failure. Steer a live child instead of spawning Task or a second owner for the same scope. Never redo or replace a live child. Children report to the parent, not to siblings. Transfer files with upload_thread_file / download_thread_file when either thread is an orb, or the artifact is too large to paste. Two orbs do not share a disk. Use pstack_run_agent only when this turn cannot proceed without one result. Use Amp child threads and orbs for durable background work, and schedules for work that must wake later.

Read skill files from the loaded skill. Do not call public_artifact_url except for an image or video the user asked to share. Do not call painter unless the user asked for an image. Those tools are not a send path, a file reader, or a skip button.`

export default function (amp: PluginAPI) {
	if (!amp.experimental) {
		amp.logger.log('Experimental plugin API is not available.')
		return
	}

	const agent = amp.experimental.createAgent({
		name: 'poteto',
		extends: 'medium',
		instructions: PSTACK_ROUTING,
		display: { label: 'poteto', color: '#eab308' },
	})

	amp.experimental.registerAgentMode({
		key: 'poteto',
		label: 'poteto',
		description:
			'Builtin medium (Sol) with Amp tools, then pstack playbooks. Grok is for code and explorer workers, not this parent.',
		color: '#eab308',
		agent: agent.definition,
	})
}
