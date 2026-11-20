import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

import { COORDINATOR_INSTRUCTIONS } from './poteto-mode'
import port from './upstream-port.json'

const PINNED_COMMIT = '0b46ec399d55f2829e88822998f53b84944837d3'
const PINNED_VERSION = '0.15.46'
const PINNED_REPO = 'https://github.com/cursor/plugins'

function repoFile(relative: string) {
	return Bun.file(new URL(relative, import.meta.url)).text()
}

describe('upstream port provenance', () => {
	test('records the pinned cursor/plugins pstack 0.15.46 commit', () => {
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
	test('orchestrate is gone and every child brief opens with the inlined worker rules', async () => {
		const skill = await repoFile('skills/poteto-mode/SKILL.md')
		const worker = await repoFile('skills/poteto-mode/worker.md')
		expect(await Bun.file(new URL('skills/poteto-mode/playbooks/orchestrate.md', import.meta.url)).exists()).toBe(false)
		expect(skill).not.toContain('Orchestrate')
		expect(skill).toContain('open its brief with the rules in `worker.md` from this skill\'s base directory, inlined verbatim')
		expect(worker).toContain('The bar in your brief is the whole bar.')
		expect(worker).toContain('unless your brief names that exact action as authorized by the operator')
		expect(worker).toContain('When a PR is authorized, open it ready for review, never as a draft.')
	})
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
		expect(full).toContain('A full swarm runs once, at the code-ready head.')
		expect(full).toContain('Another full swarm runs only for new behavior, a redesign, or a large new diff.')
		expect(full).toContain('A rebase, a merge-conflict resolution, or a minor fix gets a single verifier at the new head, and a wording-only change gets none.')
		expect(full).toContain('every new head needs its own green CI')
		expect(full).toContain('third rebase past merge prep')
		expect(full).toContain('frozen install passes on the merge result')
		expect(full).not.toContain('short private base-branch stack')
		expect(full).toContain('two or more review lanes')
		expect(full).toContain('Only a bug a user would hit, a failed gate, or a wrong shipped doc blocks')
		expect(full).toContain('does not block unless the PR copies it or newly reaches it')
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
		expect(stack).toContain('Stack a PR only when it builds on another PR.')
		expect(stack).toContain('Each owner is the sole writer of its own branch, including its rebases.')
		expect(stack).toContain('After the handoff, nobody pushes without the operator\'s go.')
		expect(stack).not.toContain('Verify at STACK-READY')
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
		expect(swarm).toContain('respawn that worker once')
		expect(swarm).toContain('A gap does not count as a pass.')
	})

	test('why answers from the commit and PR record without spawning, and recall owns its source investigators', async () => {
		const why = await repoFile('skills/why/SKILL.md')
		const how = await repoFile('skills/how/SKILL.md')
		const recall = await repoFile('skills/recall/SKILL.md')
		expect(why).toContain('Answer from the record, not the code')
		expect(why).toContain('mark your own inferences as inferences')
		expect(why).not.toContain('pstack_start_agent')
		expect(how).toContain('Launch one strict read-only `pstack_start_agent` child with role `how-explainer`')
		expect(how).not.toContain('references/explainer-prompt.md')
		expect(recall).toContain('Launch one `pstack_start_agent` investigator per source with role `why-investigator`')
		expect(recall).not.toContain('**why** skill\'s source investigators')
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

		expect(routed).toHaveLength(57)
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
		expect(babysit).toContain('An Autopilot-full or Autopilot-stack owner babysitting its own PR is that owner.')
		expect(babysit).not.toContain('In Autopilot-stack, the root is that owner.')
		expect(opening).toContain('unless it is an Autopilot-full or Autopilot-stack owner')
		expect(opening).toContain('reports merge-ready.')
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
		expect(reflect).toContain('wait for approval before editing any skill')
		expect(reflect).not.toContain('pstack_start_agent')
	})

})

describe('0.15.9 decision contracts', () => {
	test('new work goes to a fresh child unless it needs state in the old thread', async () => {
		const poteto = await repoFile('skills/poteto-mode/SKILL.md')
		const adapter = await repoFile('skills/poteto-mode/references/amp-adapter.md')
		const feature = await repoFile('skills/poteto-mode/playbooks/feature.md')
		expect(poteto).toContain('**Fresh children by default.**')
		expect(poteto).toContain('This holds for a fix round, a follow-up, a retry, and the next queue item.')
		expect(poteto).toContain(
			'A steer that narrows a running child\'s current scope, the inputs-ready release that ends the adapter\'s Files sequence, and a stop or hold order are not reuse.',
		)
		expect(poteto).toContain('An idle child\'s changed files are not that state')
		expect(adapter).toContain('Ownership claims are keyed by `scopePaths` alone, not by executor')
		expect(adapter).toContain('`download_thread_changes` recovers a finished orb owner\'s changed files')
		expect(adapter).not.toContain('Follow-up fixes on the same scope go to that live owner.')
		expect(feature).not.toContain('go to that live owner')
	})

	test('autopilot and plan ticks run hourly on an Amp schedule without a durable objective', async () => {
		const files = await Promise.all(
			['autopilot-full.md', 'autopilot-stack.md'].map((name) =>
				repoFile(`skills/poteto-mode/playbooks/${name}`),
			),
		)
		for (const body of files) {
			expect(body).toMatch(/hourly Amp schedule/)
			expect(body).not.toMatch(/30[- ]minute|durable objective|\/loop|\/goal/)
		}
		const full = files[0]
		expect(full).toContain('`set_schedule` with `RRULE:FREQ=HOURLY` and `run_mode: "existing"`')
		expect(full).toContain('check that `git merge-tree` of the head against current trunk is clean')
		expect(full).toContain('After that, the owner pushes its branch again after every verifiable unit')
		expect(full).toContain('A fresh owner, spawned with `pstack_start_agent`, picks up the next self-contained item')
	})

	test('perf numbers are vetted and fixes follow the ordered mantras', async () => {
		const perf = await repoFile('skills/poteto-mode/playbooks/perf-issue.md')
		const hillclimb = await repoFile('skills/poteto-mode/playbooks/hillclimb.md')
		const poteto = await repoFile('skills/poteto-mode/SKILL.md')
		expect(perf).toContain('1. Don\'t do it.')
		expect(perf).toContain('7. Do it cheaper.')
		expect(perf).not.toContain('Divide and conquer')
		expect(perf).toContain('role `perf-issue`')
		expect(hillclimb).toContain('Vet the harness with the **benchmark-checklist** skill')
		expect(poteto).toContain('the **benchmark-checklist** skill before you report or act on the number')
		expect(poteto).toContain('**Explain the Number** (**principle-explain-the-number**)')
	})

	test('PR bodies use headed sections and Amp keeps forge-only PR writes', async () => {
		const opening = await repoFile('skills/poteto-mode/playbooks/opening-a-pr.md')
		expect(opening).toContain('`## What changed`')
		expect(opening).toContain('Stack follow-ups by base branch')
		expect(opening).not.toContain('built-in PR tool')
	})

	test('operator defaults are reversed in plain words, not a reply token', async () => {
		const poteto = await repoFile('skills/poteto-mode/SKILL.md')
		expect(poteto).toContain('Never give a shorthand token to type back.')
		expect(poteto).not.toContain('the one word that reverses it')
	})
})

describe('0.15.13 help contracts', () => {
	test('help is explicitly invoked advice, while requests for work route to poteto-mode', async () => {
		const help = await repoFile('skills/poteto-help/SKILL.md')
		expect(help.split('---', 3)[1]).toContain('Only use when named.')
		expect(help).toContain("For a help question, don't start the work.")
		expect(help).toContain('is not a help question. Load `pstack:poteto-mode`, do the work under it')
		expect(help).toContain('Read the skill before recommending it')
		expect(help).toContain('Give at most one example prompt')
		expect(help).toContain('https://github.com/thewindmom/amp-pstack/blob/main/')
		expect(help).toContain('A missing config file does not prove setup hasn\'t run')
		expect(help).toContain('Only use a multiple-choice dialog when the user explicitly asks for questions')
	})

	test('bundled prompting advice preserves evidence, design, and Amp permission boundaries', async () => {
		const prompting = await repoFile('skills/poteto-help/references/prompting.md')
		const recipes = await repoFile('skills/poteto-help/references/recipes.md')
		expect(prompting).toContain('something that passes or fails')
		expect(prompting).toContain('A theory of the cause until the agent restates the problem')
		expect(prompting).toContain('Plan after design is settled')
		expect(prompting).toContain('Explicitly request an hourly Amp schedule')
		expect(prompting).toContain('shared changes still need explicit authorization')
		expect(recipes).toContain('You may commit locally; don\'t push.')
		expect(recipes).toContain('clear it on completion')
		expect(recipes).toContain('Match the original exactly, bugs included.')
		for (const text of [prompting, recipes]) {
			expect(text).not.toMatch(/\/loop|\.cursor\//)
		}
	})

	test('help links resolve in the shipped plugin and guide exposes it', async () => {
		const paths = [
			'skills/poteto-help/SKILL.md',
			'skills/poteto-help/references/prompting.md',
			'skills/poteto-help/references/recipes.md',
			'skills/ketchup/SKILL.md',
			'skills/ketchup-video/SKILL.md',
		]
		for (const path of paths) {
			const text = await repoFile(path)
			for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
				const target = match[1]
				if (/^https?:/.test(target)) continue
				expect(await Bun.file(new URL(target, new URL(path, import.meta.url))).exists()).toBe(true)
			}
		}
		expect(await repoFile('docs/guide/README.md')).toContain('pstack:poteto-help')
	})
})

describe('0.15.17 catch-up contract', () => {
	test('ketchup reads the invoking user\'s thread without taking action', async () => {
		const ketchup = await repoFile('skills/ketchup/SKILL.md')
		expect(ketchup).toContain('Keep this turn read-only.')
		expect(ketchup).toContain('Scheduled wake-ups, notifications, and child reports are not their messages.')
		expect(ketchup).toContain('use the invoking user\'s last authored message, not another person\'s')
		expect(ketchup).toContain('`offset`, `total`, and `truncated` pagination fields')
		expect(ketchup).toContain('Do not change files, configure models, create schedules, or publish')
		expect(ketchup).toContain('the reply alone must be enough to decide')
		expect(ketchup).toContain('Do not change code, start an app or job, or post anything to make them.')
		expect(ketchup).toContain('Never invent a number or draw or generate a screen you did not capture.')
		expect(ketchup).toContain('Use Mermaid only when explicitly requested.')
		expect(ketchup).toContain('Keep what happened under 100 words, not counting pictures')
		expect(ketchup).toContain('Never cut items or shrink them to stay under a word count')
		expect(ketchup).toContain('Never give a fact twice, in text or across visuals.')
		expect(ketchup).toContain('Never draw a status list, a list of action items, or boxes with nothing connecting them.')
		expect(ketchup).toContain('Embed existing screenshots and videos inline')
		expect(ketchup).toContain('give each item its own bullet, riskiest first')
		expect(ketchup).toContain('at most six boxes, with at most eight words in each')
		expect(ketchup).toContain('Check each number you will show against the facts it comes from')
		expect(ketchup).toContain('done, still running, failed, or not checked')
		expect(ketchup).toContain("Give each item's risk even when it is low")
		expect(ketchup).toContain('No screenshot yet.')
		expect(ketchup).toContain('A Markdown table is not a visual')
	})
})

describe('0.15.35 statechart and catch-up contracts', () => {
	test('requires real-code reproduction and safe tool execution before handing off model claims', async () => {
		const statechart = await repoFile('skills/statechart/SKILL.md')
		expect(statechart).toContain('bash <loaded-skill-base>/scripts/statechart.sh SPEC.tla')
		expect(statechart).toContain('Inspect view modules before running them; they execute code.')
		expect(statechart).toContain('output directory must be new or empty')
		expect(statechart).toContain('When the model describes code, replay each bug path against the real code')
		expect(statechart).toContain('If a bug does not reproduce, assume the model is wrong')
		expect(statechart).toContain('Tie each variable, action, and guard to the code it models, with file and line references.')
		expect(statechart).toContain('For a design with no code yet, the TLC trace is the evidence')
		expect(statechart).toContain('A rule that is not checked can hold or break.')
		expect(statechart).toContain('budget of 500 states')
		expect(statechart).toContain('unless the user explicitly requests Mermaid syntax')
		expect(statechart).toContain('`--png` commands are no longer supported')
	})

	test('video catch-up only writes evidence-based reply artifacts', async () => {
		const video = await repoFile('skills/ketchup-video/SKILL.md')
		expect(video).toContain('Only use when named.')
		expect(video).toContain('Scheduled wake-ups, notifications, and child reports are not their messages.')
		expect(video).toContain('Writing and rendering the reply video is the one exception to its read-only rule.')
		expect(video).toContain('Do not change product code, configure models, create schedules, or publish.')
		expect(video).toContain('Never invent a number, and never draw a screen you did not capture.')
		expect(video).toContain('Look at one frame from each slide at chat size')
		expect(video).toContain('at least one second for each three words')
		expect(video).toContain('A slide adds its subtitle')
		expect(video).toContain('not counting the motion into or out of it')
		expect(video).toContain('check that its subtitle is readable and covers nothing')
	})

	test('interrogate retains only executed failures without widening reviewer permissions', async () => {
		const interrogate = await repoFile('skills/interrogate/SKILL.md')
		expect(interrogate).toContain('reviewers remain strict read-only and cannot run shell commands or load skills')
		expect(interrogate).toContain('Rerun supplied receipts instead of trusting them.')
		expect(interrogate).toContain('Never apply a fix as part of this review.')
		expect(interrogate).toContain('Do not count them as verified findings or imply that an incomplete review is clean.')
	})

	test('reflection edits the approved source, and formal checks discover the current statechart skill', async () => {
		const reflect = await repoFile('skills/reflect/SKILL.md')
		expect(reflect).toContain('Never edit a loaded plugin or skill cache.')
		expect(reflect).toContain('show the writable source repository and path before approval')
		expect(reflect).toContain('Reflection approval alone does not authorize opening a PR or pushing')
		const formal = await repoFile('skills/create-formal-verification-skill/SKILL.md')
		expect(formal).toContain('Refer to `pstack:statechart` by name.')
		expect(formal).toContain('copy none of them into the generated skill or its scripts')
	})
})

describe('0.15.46 statechart Windows contract', () => {
	test('names a native Windows command from the loaded skill base and ships the shell-free kill helpers', async () => {
		const statechart = await repoFile('skills/statechart/SKILL.md')
		expect(statechart).toContain('On native Windows, where the POSIX launcher cannot run, run `bun <loaded-skill-base>/scripts/statechart.ts`')
		expect(statechart).toContain('`node --disable-warning=ExperimentalWarning <loaded-skill-base>/scripts/statechart.ts`')
		expect(await Bun.file(new URL('skills/statechart/scripts/kill.ts', import.meta.url)).exists()).toBe(true)
		expect(await Bun.file(new URL('skills/statechart/scripts/janitor.ts', import.meta.url)).exists()).toBe(true)
	})
})

describe('0.15.42 sharpen contract', () => {
	test('rewrites the prompt without executing the task or deciding user choices', async () => {
		const sharpen = await repoFile('skills/sharpen/SKILL.md')
		expect(sharpen).toContain('Only use when named.')
		expect(sharpen).toContain('a deeper version of this task, not a bigger one')
		expect(sharpen).toContain('top professional in this field')
		expect(sharpen).toContain('Name the rawest material')
		expect(sharpen).toContain('Name the specific methods and tools')
		expect(sharpen).toContain('other than you or me, would show the result is right')
		expect(sharpen).toContain('Then rewrite my prompt to ask for exactly that.')
		expect(sharpen).toContain('prototype any choice an experiment can settle')
		expect(sharpen).toContain('Leave product or preference choices that no experiment can settle for me to make.')
		expect(sharpen).toContain('do not execute the task')
		expect(sharpen).toContain('Explicit user constraints and Amp permission boundaries still apply.')
		expect(sharpen).not.toContain('then do the work')
	})
})

describe('0.15.26 formal verification contract', () => {
	test('requires falsifiable scoped proof without fixing product findings', async () => {
		const formal = await repoFile('skills/create-formal-verification-skill/SKILL.md')
		expect(formal).toContain("Load Amp's `building-skills`")
		expect(formal).toContain('`.agents/skills/verify-<area>/`')
		expect(formal).toContain('Show each property failing on a broken variant')
		expect(formal).toContain('do not change product code unless the user asks')
		expect(formal).toContain('A pass covers the model or the bound, not the whole system.')
		expect(formal).toContain('If the skill misses the break or a step does not run, fix the skill or the verification, not the scratch change.')
		expect(formal).toContain('test the real code with generated inputs, not a hand model of the function')
		expect(formal).toContain('move the sync commit forward only after it confirms')
	})

	test('maintenance distinguishes stale models from bugs and preserves blocked sync points', async () => {
		const maintain = await repoFile('skills/maintain-formal-verification-skill/SKILL.md')
		expect(maintain).toContain("Load Amp's `building-skills`")
		expect(maintain).toContain('Never edit product code during a run, unless the user asks you to.')
		expect(maintain).toContain('do not weaken the property or the model to make it pass')
		expect(maintain).toContain('Change a property only for a promise that changed on purpose.')
		expect(maintain).toContain('Do not move the sync commit for a blocked check')
		expect(maintain).toContain('the old pass was on a stale description')
		const setup = await repoFile('skills/setup-pstack/SKILL.md')
		expect(setup).toContain('### 8. Offer a formal verification skill (optional)')
		expect(setup).toContain('On yes, load `pstack:create-formal-verification-skill`. On no, move on without pushing.')
	})
})

describe('0.15.15 help and model contracts', () => {
	test('setup is a once-per-thread offer, not an automatic configuration write', async () => {
		const help = await repoFile('skills/poteto-help/SKILL.md')
		expect(help).toContain('if setup is not already known to be complete')
		expect(help).toContain('Ask at most once per thread.')
		expect(help).toContain('If the need is also unclear, combine the clarifications.')
		expect(help).toContain('Now: give them `pstack:setup-pstack` to invoke, and answer their question too.')
		expect(help).toContain('Later: answer their question and say unconfigured roles keep the plugin defaults.')
		expect(help).toContain('The resolved map does not reveal whether setup previously ran')
		expect(help).toContain('Do not start setup or write model configuration from a help question.')
	})

	test('records the tuned-model departure without claiming large matches every Amp default', async () => {
		const departure = port.intentionalDepartures.find(({ id }) => id === 'amp-tuned-role-defaults')
		expect(departure?.from).toContain('drops Sol')
		expect(departure?.to).toContain('three-family panels, and per-role efforts')
		const guide = await repoFile('docs/guide/01-setup.md')
		expect(guide).toContain('different efforts by role, not one global budget')
		expect(guide).toContain('persisted overrides still pin the previous choice')
		const setup = await repoFile('skills/setup-pstack/SKILL.md')
		expect(setup).toContain('`unlimited` selects the highest supported effort')
		expect(setup).toContain('Keep user-selected model IDs, panel lengths, and seat ordering')
	})
})
