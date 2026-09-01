# Verify the result and open a PR

"It compiles" is not evidence. The [Prove It Works principle](../../skills/principle-prove-it-works/SKILL.md) makes the agent check the real artifact before it reports success, and your job is to make "the real artifact" checkable. This page covers stating a finish condition, generating a verification skill for your app, opening the PR, and driving it to merged.

![A prototype plane flies a real test course while she times it with a stopwatch and robots film and checklist the run; the terminal reads verify: pass, evidence: captured.](./images/verification.jpg)

## State the finish condition up front

Put what done means in the first prompt, in whatever words fit:

```text
Use pstack:poteto-mode. Add JSON output to this command. Text output stays byte-identical, the JSON parses, both run against the sample project. Show me the evidence.
```

Now the agent has three checks it can run, not a mood to satisfy. When the reply comes back, it should carry the exact commands and outputs. If a check couldn't run, a good reply says "inconclusive", and you should treat a confident reply without evidence as a red flag.

Match the check to the change:

- A CLI change runs the real command.
- A UI change walks the changed flow in the running app.
- A parser or migration replays a saved input.
- A perf change compares before and after profiles.
- A storage change reads back the written value.

For a small diff you don't fully trust, [`pstack:blast-radius`](../../skills/blast-radius/SKILL.md) finds what it could break elsewhere. It picks the one fact the change is safe because of and proves it by running code instead of writing an essay about it.

## Create a project verification skill

The UI bullet above hides a real requirement. The agent needs a scripted way to drive your app. If your project has one, great. If not, run:

```text
Load pstack:create-verification-skill
```

[`pstack:create-verification-skill`](../../skills/create-verification-skill/SKILL.md) interviews the repository, not you. It writes `.agents/skills/verify-<app>/`. Before handing it over, the generator proves the skill once end to end. Keep the map honest later with [`pstack:maintain-verification-skill`](../../skills/maintain-verification-skill/SKILL.md).

## Open the PR, then babysit only when asked

Opening a PR does not start a babysit. Post the URL and keep building. Finish the phase or stack first. Run [Babysit](../../skills/poteto-mode/playbooks/babysit.md) only when you ask for merge-ready after the whole stack exists. [Shipping](../../skills/poteto-mode/playbooks/shipping.md) is a separate request. Green is not safe, and nothing merges without explicit authorization.

The bundled watcher is `skills/poteto-mode/scripts/watch-pr/watch-pr`. Trust its merge state. The Graphite playbooks require `gt`. Without it, use ordinary independent PRs and keep independent verification.

Next: [Run work while you sleep](./07-overnight.md).
