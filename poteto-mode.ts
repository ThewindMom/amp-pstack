// @amp-agent-mode {"key":"poteto","label":"poteto"}

import type { PluginAPI } from '@ampcode/plugin'

export const description =
	'Poteto mode for Amp: builtin high parent with Amp tools, plus pstack routing. Grok stays on code and explorer workers. Pair with the pstack directory plugin for skills and tools.'

const PSTACK_ROUTING = `For every nontrivial task, load the pstack:poteto-mode skill before acting and follow its matched playbook. Load referenced pstack skills when their trigger applies. Default long work to pstack_start_agent so the parent does not freeze; the child reports with pstack_send_to_thread. Writable roles declare scope and concrete scopePaths. Route from the actual executor: local and runner parents keep dirty or machine-bound work in current-checkout; use named-runner for an explicitly selected machine; Amp-managed orb parents use fresh parent-project-orb execution for independent work. Unknown placement requires an explicit target. Keep dependent parent-orb work in that parent or transfer its inputs first. Disjoint scopePaths may run concurrently; equal or prefix-overlapping paths have one durable owner. Continue independent parent work, then end the turn when blocked on the child. Do not call wait_for_threads to judge startup: Amp returns unknown/settled on an empty child and that is not failure. Timeout leaves the child live; terminal error requires reconciliation. Never redo or replace a live owner. Children report to the parent, not to siblings. Transfer files when either thread is an orb. Use pstack_run_agent only when this turn cannot proceed without one result. Use Amp child threads, orbs, named runners, and schedules for their native strengths.

Skill names are not delegate roles. Load pstack:how for the how workflow; spawn how-explorer or how-explainer, never role how. Those roles cannot run shell commands or tests. Use judgment for independent reviews requiring test execution, with explicit no-code-change and isolated-resource instructions; judgment is not a read-only sandbox.

Read skill files from the loaded skill. Do not call public_artifact_url except for an image or video the user asked to share. Do not call painter unless the user asked for an image. Those tools are not a send path, a file reader, or a skip button.`

export default function (amp: PluginAPI) {
	const agent = amp.createAgent({
		name: 'poteto',
		extends: 'high',
		instructions: PSTACK_ROUTING,
		display: { label: 'poteto', color: '#eab308' },
	})

	amp.registerAgentMode({
		key: 'poteto',
		label: 'poteto',
		description:
			'Builtin high with Amp tools, then pstack playbooks. Grok is for code and explorer workers, not this parent.',
		color: '#eab308',
		agent: agent.definition,
	})
}
