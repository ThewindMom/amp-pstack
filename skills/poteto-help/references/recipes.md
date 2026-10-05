# Prompts worth copying

Swap in real paths, skills, and done checks. Informal wording works.

## Understand

- `Use pstack:poteto-mode. Read <thread>. Restate the underlying issue in your own words, in plain English.`
- `Use pstack:poteto-mode. Investigate why <symptom>. Give me what we know, the data you used, and your best hypotheses. Don't change code yet.`
- `Use pstack:how to understand <subsystem>, then pstack:why to find why it broke recently.`
- `Use pstack:recall for my work on <topic> last week, then read <issue>.`
- `Use pstack:teach. Why did you implement it this way instead of <alternative>? What did you trade off?`
- `Use pstack:poteto-mode. Take over this branch. Read the decision log and continue without redoing finished work.`

## Build

- Bug: `Use pstack:poteto-mode. <Symptom>. Repro first, then fix and verify.`
- App bug: `Use pstack:poteto-mode. Repro with <project verification skill>. If it repros on main, fix it and show a video as proof.`
- Cheap test: `Use pstack:poteto-mode. Repro <bug>. If there's a cheap test path, use pstack:tdd, then fix and rerun.`
- Feature: `Use pstack:poteto-mode. Add <behavior>. <Current output> stays byte-identical. Verify both.`
- Refactor: `Use pstack:poteto-mode. Move <code> into one module, zero behavior change. Record output first and prove it's unchanged.`
- Perf: `Use pstack:poteto-mode. <Operation> takes <time> on <fixture>. Trace it, fix the measured cause, and show before and after.`

## Design and plan

- `Use pstack:poteto-mode. Prototype several options for <feature>. Show screenshots or videos to compare.`
- `Use pstack:poteto-mode. We need <feature>. Use pstack:architect with checkpoint and answer open questions with prototypes. Let me review before proceeding.`
- `Use pstack:poteto-mode. Write a tutorial for <new package> first, then use pstack:teach to explain why it beats the current one.`
- `Use pstack:arena for a second opinion on this thread and approach.`
- `Use pstack:poteto-mode. Turn this settled design into small verifiable PRs, each with its own checks. Don't implement yet.`
- `Use pstack:poteto-mode. Plan migration of <library> to <target>. Small verifiable PRs. Match the original exactly, bugs included.`

## Review and ship

- `Use pstack:interrogate on the whole branch, skeptically. Don't change anything. No nitpicks unless a real bug or regression.` Read dismissals too.
- `Use pstack:swarm. Check every package under <dir> against its check script. One worker per package, one report.`
- `Use pstack:poteto-mode. Open the PR. Small ordered commits, evidence in the description.`
- `Use pstack:poteto-mode. Babysit this PR until green.` For status: `Use pstack:poteto-mode. Check PR <number>. Anything outstanding?`
- `Use pstack:poteto-mode. Land the stack.`

## Away and back

- `Use pstack:poteto-mode. I'm going to bed. <Goal> in a fresh worktree off <base>. Done means <checks>. Keep a decision log. You may commit locally; don't push. Set an hourly Amp schedule until done and clear it on completion. If truly stuck after a few hours, stop and explain why.`
- `Use pstack:show-me-your-work. Catch me up on last night's work.` Read Attention first.
- `Use pstack:poteto-mode. Full autopilot on this independent queue.`
- `Use pstack:poteto-mode. Stack these changes, don't ship. I'll land the stack.`
- `Use pstack:reflect. Capture lessons so the next run doesn't repeat them.` Approve only edits that change a future decision.
- `Use pstack:bro.` Restates the last reply plainly.
