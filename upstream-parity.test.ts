import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

import { COORDINATOR_INSTRUCTIONS } from './poteto-mode'
import port from './upstream-port.json'

const PINNED_COMMIT = '12d587dfb20741cafc376c42c696c5f6e2a64487'
const PINNED_VERSION = '0.15.5'
const PINNED_REPO = 'https://github.com/cursor/plugins'

function repoFile(relative: string) {
	return Bun.file(new URL(relative, import.meta.url)).text()
}

describe('upstream port provenance', () => {
	test('records the pinned cursor/plugins pstack 0.15.5 commit', () => {
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
		expect(feature).toContain('You can spawn a child even though you are one.')
		expect(feature).not.toContain('Review its diff yourself.')
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
		expect(shipping).toContain('exactly one judgment child to exactly one PR')
		expect(shipping).toContain('PR number, its exact base and head')
		expect(shipping).toContain('Shell tests are shell tests, not a claimed CLI skill run.')
		expect(shipping).toContain('CI green is not a verdict, and an approving bot review is not a verdict.')
		expect(shipping).toContain('differ only in tests, docs, or lint config')
		expect(shipping).toContain('Build it twice at the verdict SHA and once at the current head.')
		expect(shipping).toContain('Do not reuse a lane result from a dev server')
		expect(shipping).toContain('Re-verify anything else when the patch changed.')
	})

	test('autopilot rounds are keyed by exact head SHA and children by thread ID', async () => {
		const full = await repoFile('skills/poteto-mode/playbooks/autopilot-full.md')
		const stack = await repoFile('skills/poteto-mode/playbooks/autopilot-stack.md')
		expect(full).toContain('keyed by that child\'s thread ID')
		expect(full).toContain('A verification round is keyed by the exact head SHA.')
		expect(full).toContain('code-ready head SHA and at each later push that changes the PR\'s patch')
		expect(full).toContain('two or more review lanes')
		expect(full).toContain('A defect that a lane filed as a note is a finding.')
		expect(full).toContain('CI must pass on that head before the merge')
		expect(full).toContain('A stall never proves or drops the work.')
		expect(full).toContain('Record each stuck child as stuck whether or not the stop works.')
		expect(full).toContain(
			'Replace it only after that child has stopped or reached a terminal state and its ownership claim is reconciled',
		)
		expect(full).not.toContain('Whether or not a stop works, the root has the owner record')
		expect(full).not.toContain('The rebase always precedes babysit')
		expect(full).toContain('git push --force-with-lease` after an `ls-remote` check')
		expect(full).toContain('Never force-push a shared branch.')
		expect(full).toContain('That push still needs the operator\'s explicit authorization.')
		expect(stack).toContain('Probe stuck children and end the tick per Autopilot-full step 6.')
		expect(stack).toContain('children.tsv')
		expect(stack).toContain('Verify each round')
		expect(stack).toContain('keyed by that exact head SHA')
		expect(stack).not.toContain('Verify at STACK-READY')
	})

	test('audit ticks report only new tracked changes and still log a row', async () => {
		const plan = await repoFile('skills/poteto-mode/playbooks/multi-phase-plan.md')
		const prompt = plan.slice(plan.indexOf('Use this tick prompt verbatim.'))
		expect(prompt).toContain('only when the audit found a tracked change that no earlier status message reported')
		expect(prompt).toContain('Do not repeat a table, the merged list, or an unchanged blocker.')
		expect(prompt).toContain('If the audit found none, end the turn with no reply text.')
		expect(prompt).toContain("log this tick's row in your decision trail")
		expect(prompt).toContain('Record the lane as stuck whether or not the stop works.')
		expect(prompt).toContain('Replace it only after the prior owner has stopped or reached a terminal state')
		expect(prompt).not.toContain('whether or not anything changed, with the queue table')
	})

	test('persisted model overrides stay until the user changes them', async () => {
		const setup = await repoFile('skills/setup-pstack/SKILL.md')
		const guide = await repoFile('docs/guide/01-setup.md')
		for (const text of [setup, guide]) {
			expect(text).toContain('A persisted override stays until')
			expect(text).not.toContain('is stale')
			expect(text).not.toContain('Delete those role lines')
		}
	})

	test('swarm drops a result that omits the named SHA and method', async () => {
		const swarm = await repoFile('skills/swarm/SKILL.md')
		expect(swarm).toContain('each brief names the exact SHAs')
		expect(swarm).toContain('A measurement brief also names the method')
		expect(swarm).toContain('lists every issue it can prove, not only the first')
		expect(swarm).toContain('rerun that worker once')
		expect(swarm).toContain('A gap does not count as a pass.')
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
		expect(adapter).toContain('An explicit `agentMode` override replaces the registered pstack role mode')
		expect(adapter).toContain('A terminal error requires reconciliation before replacement')
		expect(adapter).toContain('Never redo or replace a live owner')
		expect(skill).toContain('Always pause without explicit authorization')
	})

	test('comment review preserves the requested diff or whole-file scope', async () => {
		const noComments = await repoFile('skills/no-comments/SKILL.md')
		const adapter = await repoFile('skills/poteto-mode/references/amp-adapter.md')
		for (const text of [noComments, adapter]) {
			expect(text).toMatch(/git refs[^\n]+(?:not sufficient|insufficient)|Do not give the reviewer only git refs/)
		}
		expect(noComments).toContain('exact scoped diff snapshot')
		expect(adapter).toContain('parent-prepared patch artifact')
		expect(noComments).toContain('base-to-current tracked changes')
		expect(noComments).toContain('relevant untracked files')
		expect(noComments).toContain('upload_thread_file')
		expect(noComments).toContain('For an explicit whole-file review, use the caller\'s named files instead')
		expect(noComments).toContain('do not substitute git refs or widen that diff audit to whole-file review')
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
		expect(ids).toContain('feature-nested-spawn-sentence')
		expect(ids).toContain('check-plan-nonblank-model')
		expect(ids).toContain('no-cursor-model-aliases')
		expect(port.intentionalDepartures.find((entry) => entry.id === 'amp-host-autonomy')?.from).toContain('**Just do it.**')
		expect(port.intentionalDepartures.find((entry) => entry.id === 'durable-threads')?.from).toContain(
			'`run_in_background: true`',
		)
		expect(port.intentionalDepartures.find((entry) => entry.id === 'runtime-mode-advisory')?.to).toContain('advisory')
		expect(port.intentionalDepartures.find((entry) => entry.id === 'feature-nested-spawn-sentence')?.from).toContain(
			'You can spawn a subagent even though you are one.',
		)
		expect(port.intentionalDepartures.find((entry) => entry.id === 'no-cursor-model-aliases')?.to).toContain(
			'only when the user asks',
		)
	})

	test('gates every upstream-disabled skill while leaving setup discoverable', async () => {
		const skillFiles = Array.fromAsync(new Bun.Glob('skills/*/SKILL.md').scan({ cwd: import.meta.dir }))
		const files = await skillFiles
		const frontmatters = await Promise.all(
			files.map(async (file) => {
				const text = await Bun.file(join(import.meta.dir, file)).text()
				return { file, frontmatter: text.split('---', 3)[1] ?? '' }
			}),
		)
		const setup = frontmatters.find(({ file }) => file === 'skills/setup-pstack/SKILL.md')
		const routed = frontmatters.filter(({ file }) => file !== 'skills/setup-pstack/SKILL.md')

		expect(routed).toHaveLength(46)
		for (const { frontmatter } of routed) {
			expect(frontmatter).toMatch(/description:(?: ["']| >-\n\s+)Only use when named/)
		}
		expect(setup?.frontmatter).not.toContain('Only use when named')
	})
})

describe('0.15.5 decision contracts', () => {
	test('autopilot owners may lease-push only their own branch', async () => {
		const babysit = await repoFile('skills/poteto-mode/playbooks/babysit.md')
		const opening = await repoFile('skills/poteto-mode/playbooks/opening-a-pr.md')
		expect(babysit).toContain('An Autopilot-full owner babysitting its own PR is that owner.')
		expect(babysit).toContain('In Autopilot-stack, the root is that owner.')
		expect(opening).toContain('unless it is an Autopilot-full or Autopilot-stack owner')
		expect(opening).toContain('reports merge-ready or STACK-READY')
		expect(opening).toContain('Creating, editing, or merging a PR still needs the operator\'s explicit authorization.')
	})

	test('decision trails are append-only and scoped to one run', async () => {
		const trail = await repoFile('skills/show-me-your-work/SKILL.md')
		expect(trail).toContain('its first row has phase `start`')
		expect(trail).toContain('Use phase `start` for nothing else.')
		expect(trail).toContain('The audit never edits or removes a row, even an invented one.')
		expect(trail).toContain('add a row that supersedes it')
		expect(trail).not.toContain('Cut invented or aspirational entries.')
	})

	test('setup does not claim to list keys that show already omits', async () => {
		const setup = await repoFile('skills/setup-pstack/SKILL.md')
		const guide = await repoFile('docs/guide/01-setup.md')
		expect(setup).toContain('The runtime already ignores unknown role keys')
		expect(setup).toContain('Setup does not enumerate those keys')
		expect(setup).toContain('Do not list retired keys.')
		expect(setup).toContain('Do not delete a stored Fable ID that is still a current role.')
		expect(setup).not.toContain('Also list each retired key')
		expect(guide).toContain('Setup does not enumerate them')
		expect(guide).not.toContain('Delete those role lines')
	})

	test('a rejected configured model is reported, not retried on that call', async () => {
		const interrogate = await repoFile('skills/interrogate/SKILL.md')
		expect(interrogate).toContain('that seat is a terminal dropout')
		expect(interrogate).toContain('Do not stop the panel.')
		expect(interrogate).toContain('only when the user asks')
		const arena = await repoFile('skills/arena/SKILL.md')
		expect(arena).toContain('Proceed with N-1 when at least one candidate completed')
		expect(arena).toContain('Do not stop the panel.')
		const swarm = await repoFile('skills/swarm/SKILL.md')
		expect(swarm).toContain('default `xai/grok-4.7`')
		expect(swarm).toContain('stop that spawn')
		expect(swarm).toContain('only when the user asks')
		const adapter = await repoFile('skills/poteto-mode/references/amp-adapter.md')
		expect(adapter).toContain('A rejected single-role spawn stops.')
		expect(adapter).toContain('A rejected panel seat is one terminal dropout.')
		expect(adapter).toContain('Do it only when the user asks')
		const reflect = await repoFile('skills/reflect/SKILL.md')
		expect(reflect).toContain('openai/gpt-6-sol')
		for (const name of ['divergent-reviewer.md', 'judgment-reviewer.md', 'tooling-reviewer.md']) {
			const reviewer = await repoFile(`skills/reflect/references/${name}`)
			expect(reviewer).toContain('List each durable learning you find.')
			expect(reviewer).not.toContain('Surface 3-5 durable learnings.')
		}
	})

	test('check-plan accepts a filled swarm model and rejects a placeholder', async () => {
		const script = new URL('skills/poteto-mode/scripts/check-plan.mjs', import.meta.url).pathname
		const dir = await mkdtemp(join(tmpdir(), 'check-plan-'))
		try {
		const lanes = Array.from({ length: 10 }, (_, i) => {
			return `- [ ] Lane ${i + 1}. Scenario. Save \`lane-${i + 1}.png\`. Pass when the lane shows the result.`
		}).join('\n')
		const plan = (live: string) => `# Port plan

Short intro.

## How to read this

One box is one unit of work. Each box names the evidence. Check a box only when its evidence exists. Open playbooks/ for the steps. Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

Store the durable objective. Read the playbook from the loaded skill. Tick every 30 minutes. A status message reports only a new tracked change.

### Spawn owners

One owner.

### PR mechanics

Ready, never draft.

### Verdict and merge

Clean verdict before merge.

### Boot recipe

Boot the lanes.

## PR 1. The change

**Depends on.** None.

**Files.**

- [ ] \`skills/example.md\`

**Build.**

- [ ] Run \`bun test\`.

**You see.**

- [ ] The live lane names a model.

**Verify, unit.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] \`example.test.ts\` gains the filled-model case. Run \`bun test\`.

**Verify, live.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked. ${live}

${lanes}

**Verify, perf.** Tests alone are not sufficient verification. A PR is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. named metric
- [ ] Probe. interleaved probe
- [ ] Baseline. trunk first
- [ ] Rule. fail above 1

**Review gate.** None. PR 1 is not review-gated.

**Merge.**

- [ ] Squash after the verdict.

## Close the program

Stop.

## Appendix A. Prototype evidence

None.
`
		const { spawnSync } = await import('node:child_process')
		const run = async (name: string, live: string) => {
			const path = `${dir}/${name}.md`
			await Bun.write(path, plan(live))
			return spawnSync('bun', [script, path], { encoding: 'utf8' })
		}
		const filled = await run('filled', 'Ten lanes on `xai/grok-4.7` at the PR head, per the boot recipe.')
		const placeholder = await run('placeholder', 'Ten lanes on `<swarm-worker model>` at the PR head, per the boot recipe.')
		const empty = await run('empty', 'Ten lanes on `` at the PR head, per the boot recipe.')
		const blank = await run('blank', 'Ten lanes on `   ` at the PR head, per the boot recipe.')
		const malformed = await run('malformed', 'Ten lanes on `<model` at the PR head, per the boot recipe.')
		expect(malformed.status).toBe(1)
		expect(malformed.stderr).toContain('with the model filled in')
		if (filled.status !== 0) throw new Error(filled.stderr || filled.stdout)
		expect(placeholder.status).not.toBe(0)
		expect(placeholder.stderr).toContain('with the model filled in')
		expect(empty.status).not.toBe(0)
		expect(empty.stderr).toContain('with the model filled in')
		expect(blank.status).not.toBe(0)
		expect(blank.stderr).toContain('with the model filled in')
		} finally {
			await rm(dir, { recursive: true, force: true })
		}
	})
})
