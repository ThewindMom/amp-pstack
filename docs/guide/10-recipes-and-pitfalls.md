# Recipes and pitfalls

Prompts worth copying, then the mistakes everyone makes once. Swap in your own paths and finish conditions. The recipes are deliberately informal. That's how they get typed in practice, and the skills read intent fine.

![She tastes a finished dish while robots cook from a recipe box, with pinned cards reading /how, /tdd, and /loop above the counter.](./images/recipes.jpg)

## Understand an unfamiliar subsystem

```text
Load pstack:how first to understand how this initialization works. Then load pstack:why to figure out why it broke recently.
```

Mechanics first, history second. Each skill's report tells you which sources it searched, so you know what the answer is grounded in.

## Get a second opinion on a design

```text
Load pstack:arena for a second opinion on this thread and our approach.
```

Your current design becomes one candidate among several, and the synthesis tells you whether the panel found something better or confirmed what you had.

## Check independent slices in parallel

```text
Load pstack:swarm. Check every package under packages/ against its check.sh. One worker per package. One report.
```

Each worker owns one package. The parent waits for every slice and returns one `PASS`, `ISSUES`, or `BLOCKED` report instead of raw worker dumps.

## Review a branch skeptically

```text
Load pstack:interrogate on the whole branch, but skeptically. Don't change anything yet. No nitpicks unless it's an actual bug or regression in behavior.
```

## Fix a bug through a failing test

```text
Use pstack:poteto-mode. Users see stale rows after retry. Repro first. If there's a cheap local test, load pstack:tdd.
```

## Overnight migration

```text
Use pstack:poteto-mode. Going to bed. Keep going until zero old parser callers remain, every parser fixture passes, and the old API is deleted. Keep a decision trail.
```

## Pitfalls

- Naming a playbook is optional. A goal plus a check is enough.
- "It compiles" is not verification. Ask for the real artifact.
- Two writers in one worktree is shared mutable state. Split the trees.
- An orb cannot see uncommitted local files. Use local execution, or transfer only what you authorized.
- `builtin:medium` is still a pstack delegate. It is not a way to strip pstack instructions.
- Opening a PR is not a babysit. Shipping is not a babysit. Merge is explicit.
- A webhook retry is at-least-once. `pstack_create_wake_webhook` appends first, then records the Amp event ID. A crash between those steps is healed by scanning the thread. Treat Slack event IDs the same way in Benny.
- Benny is dormant until you copy `.amp/benny/` and authorize the webhook.

## What did not port exactly

- A plugin-created orb cannot select `orb_size`; native Amp thread creation can.
- Editor-specific UI and proprietary automation editors have no direct Amp equivalent. Skills, Amp modes, threads, schedules, and webhooks replace them.
- Prompt resources in `agents/` are documentation. Runtime delegates are created by [`index.ts`](../../index.ts). Comment Sicko runs as role `comment-reviewer` with write tools excluded.
