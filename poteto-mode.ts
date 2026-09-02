// @amp-agent-mode {"key":"poteto","label":"poteto"}

import type { PluginAPI } from '@ampcode/plugin'

export const description =
	'Poteto mode for Amp: Grok 4.6 parent on the medium harness, with pstack playbook routing. Use for pstack work. Pair with the pstack directory plugin for skills and tools.'

const POTETO_INSTRUCTIONS = [
	'For every nontrivial task, load the pstack:poteto-mode skill before acting and follow its matched playbook.',
	'Load referenced pstack skills when their trigger applies.',
	'Use pstack agent and panel tools when model diversity or isolated context materially improves the result.',
	'Use Amp child threads and orbs for durable background work, and schedules for work that must wake later.',
].join(' ')

export default function potetoMode(amp: PluginAPI) {
	const poteto = amp.createAgent({
		extends: 'medium',
		model: 'xai/grok-4.6',
		instructions: POTETO_INSTRUCTIONS,
		tools: 'all',
		reasoningEffort: 'high',
		display: { label: 'poteto', color: '#eab308' },
	})

	amp.registerAgentMode({
		key: 'poteto',
		label: 'poteto',
		description:
			'Routes rigorous engineering work through pstack playbooks, multi-model delegates, evidence-first verification, and Amp threads or orbs.',
		color: '#eab308',
		agent: poteto.definition,
	})
}
