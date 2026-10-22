# Verify the result and open a PR

"It compiles" is not evidence. The [Prove It Works principle](../../skills/principle-prove-it-works/SKILL.md) makes the agent check the real artifact before it reports success, and your job is to make "the real artifact" checkable. This page covers stating a finish condition, generating a verification skill for your app, formally verifying a property tests rarely reach, opening the PR, and driving it to merged.

![A prototype plane flies a real test course while she times it with a stopwatch and robots film and checklist the run; the terminal reads verify: pass, evidence: captured.](./images/verification.jpg)

## State the finish condition up front

Put what done means in the first prompt, in whatever words fit:

```text
Use pstack:poteto-mode. Add JSON output to this command. Text output stays byte-identical, the JSON parses, both run against the sample project. Show me the evidence.
```

Now the agent has three checks it can run, not a mood to satisfy. When the reply comes back, it should carry the exact commands and outputs. If a check couldn't run, a good reply says "inconclusive". A confident reply without evidence is a warning sign.

Match the check to the change:

- A CLI change runs the real command.
- A UI change walks the changed flow in the running app.
- A parser or migration replays a saved input.
- A perf change compares before and after profiles.
- A storage change reads back the written value.

Ask for inspectable artifacts: the failing and passing run, a before-and-after video, a trace, or screenshots. For exact UI matching, use Visual parity against a frozen screenshot baseline rather than judging by eye.

Before you report or act on a number you measured, load [`pstack:benchmark-checklist`](../../skills/benchmark-checklist/SKILL.md). It asks what limits the number, whether both sides were tuned, and whether the run repeats, so a speedup is not a cache hit or a no-op.

Its seven checks cover the limiter, production tuning, physical plausibility, errors and output correctness, alternating-run median and range, end-to-end relevance, and whether the claimed work happened inside the timed region. The verdict is faster, slower, no measurable difference, or inconclusive.

For a small diff you don't fully trust, [`pstack:blast-radius`](../../skills/blast-radius/SKILL.md) finds what it could break elsewhere. It finds the one fact that makes the change safe and proves that fact by running code, not by arguing for it.

## Create a project verification skill

The UI bullet above hides a real requirement. The agent needs a scripted way to drive your app. If your project has one, great. If not, run:

```text
Load pstack:create-verification-skill
```

[`pstack:create-verification-skill`](../../skills/create-verification-skill/SKILL.md) interviews the repository, not you. It writes `.agents/skills/verify-<app>/`. Before handing it over, the generator proves the skill once end to end. Keep the map honest later with [`pstack:maintain-verification-skill`](../../skills/maintain-verification-skill/SKILL.md).

Treat it as committed infrastructure. If agents repeatedly make throwaway driver scripts, build a control CLI with composable commands, destructive `--dry-run`, actionable errors, rich help, and machine-readable output. An explicitly authorized hourly Amp schedule can run maintenance; creating or changing that schedule is an external write and requires approval.

The generated verification skill records Launch, Doctor, Drive, Evidence, and Cleanup, a Helpers section for any script it ships, and a feature map. Its end-to-end proof confirms evidence survives cleanup. Later agents can drive mapped user flows without repeating setup questions. Maintain verification audits each mapped feature by source and a live pass; it returns `clean`, `changed` (verification-skill corrections only), or `blocked`, and never edits product code.

## Prove a property with a formal verification skill

A verification skill proves the paths you drive. Some bugs live on paths nobody drives: two retries that overlap, a lock that expires mid-write, a state change that arrives out of order. Tests rarely reach those cases. For code where such a bug is costly, run:

```text
Load pstack:create-formal-verification-skill
```

[`pstack:create-formal-verification-skill`](../../skills/create-formal-verification-skill/SKILL.md) picks the target from the code: a promise the code makes, where a break harms users and tests rarely reach the case that breaks it. It picks the strongest target, not the easiest to verify. Name an area or a bug to start there instead:

```text
Use pstack:create-formal-verification-skill on the job lease and retry logic. A job must never run twice at once.
```

The question picks the tool. Whether events can happen in a bad order suits a model checker over a small model of the design, and TLA+ is the default for that in any language. Whether the code behaves for every input suits a verifier that runs on the code. If no verifier runs on your language, the agent says so and tests the real code with generated inputs, not a hand-written model of the function. A property that must hold at every size can need a proof. The agent tells you which tool it chose and why.

It verifies one property and shows that property failing on a broken variant of the code, because a check you've never seen fail proves nothing. When the current code already breaks the property, you get the counterexample as a short sequence of steps in your code's terms. The property stays as stated, so the finding stays a finding. Product code doesn't change unless you ask.

It writes a project-local skill under `.agents/skills/verify-<area>/` that tells the next agent whether a change touches the verified code, how to run the check with one command, and how to tell a real bug from a modeling error. Before handing it over, the generator follows that skill once on an isolated scratch change that breaks the property, and the check must catch it. The handoff says what was verified, with which tool and bounds, what the check found, and what it doesn't cover. A pass covers the model or the bound, not the whole system.

The skill also records which code each check covers and the commit where the check last matched it. Merges and refactors that skip the skill can leave the check passing on a description of code that's gone. After them, run [`pstack:maintain-formal-verification-skill`](../../skills/maintain-formal-verification-skill/SKILL.md). It updates the verification from the code, reruns it, shows that each updated check can still fail, and tells you whether each failure is drift in the verification or a bug in the code.

## Show the behavior as a statechart

A counterexample in model terms may not help the PM or designer who owns the behavior. To show what the user sees, run:

```text
Use pstack:statechart. Show what the user sees when they edit a note offline.
```

[`pstack:statechart`](../../skills/statechart/SKILL.md) generates charts from a TLA+ model. The reader's rules, such as "you never see Synced while offline", become invariants. Each bug TLC finds is a numbered path in the reader's words, and states are marked working, still wrong, or fixed by an open PR. Before handing off, the agent reproduces each bug path against real code. A model result alone is not proof of product behavior.

The reverse direction turns an agreed chart into a TLA+ skeleton. TLC checks the chart's rules before code exists; adding code guards exposes differences for the reader to decide. When a spec already exists, the skill compares a model of the code against the unchanged spec and shows paths where either breaks a rule.

The tools use Mermaid source files and can render PNGs. Java 11+, `TLA2TOOLS`, and Node.js are required; PNG rendering uses Mermaid CLI through `npx`. Work on disposable input copies and dedicated output directories, because regeneration replaces tool-owned output. Share inspected PNGs and source attachments; use Mermaid syntax inline only when explicitly requested.

## Open the PR, then babysit only when asked

Before an approved PR action, use isolated worktrees, small ordered commits, cleaned prose, and evidence. Babysit resolves conflicts, review threads, then CI in one push wave. It stops at merge-ready; merging still requires explicit authorization.

Opening a PR does not start a babysit. Post the URL and keep building. Finish the phase or stack first. Run [Babysit](../../skills/poteto-mode/playbooks/babysit.md) only when you ask for merge-ready after the whole stack exists. An Autopilot-full or Autopilot-stack owner is the exception. Its brief already assigned the babysit loop, so it starts that loop after the code-ready report. [Shipping](../../skills/poteto-mode/playbooks/shipping.md) is a separate request. Green is not safe, and nothing merges without explicit authorization.

The bundled watcher is `skills/poteto-mode/scripts/watch-pr/watch-pr`. Run it through Bun because synced plugin caches do not preserve executable bits. It covers GitHub. Resolve the forge once, use `gh` by default or Origin when its CLI can resolve the repository, and keep independent verification. Graphite is not required.

The [Shipping playbook](../../skills/poteto-mode/playbooks/shipping.md) verifies each PR independently before it arms anything. One fresh agent per PR proves the behavior live, and the agent that judges a change is never the one that wrote it. Shipping then lands only the contiguous verified run from the bottom, one PR at a time through the resolved forge. A verified PR above an unverified one waits because merging it would pull the gap underneath.

Next: [Run work while you sleep](./07-overnight.md).
