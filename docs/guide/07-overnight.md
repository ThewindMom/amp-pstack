# Run work while you sleep

This is the payoff for everything before it. An agent you can trust to verify its own work is an agent you can leave alone with a hard task. What makes that safe isn't hope. It's a checkable finish condition, an isolated worktree, and a decision log you audit in the morning.

![She waves goodnight from the door while robots keep the factory running, one updating a DECISION LOG wall board under a BUILD LOOP ACTIVE sign.](./images/overnight.jpg)

## The overnight contract

A good handoff has the goal, the finish condition, permissions, and an escape hatch. It doesn't need to be long:

```text
Use pstack:poteto-mode. I'm going to bed. Migrate every caller to the new parser in a fresh worktree off <base>.
Done means zero old callers, all parser fixtures pass, old API deleted.
Keep a decision log. Don't ask me before committing local work.
Keep going until the predicate is met. If you're truly stuck after a few hours, stop and write up why.
```

Walk through what each line buys you:

- "I'm going to bed" is a session override. The agent stops asking about reversible local work and keeps going.
- "Done means..." turns the goal into checks every iteration can run.
- "Fresh worktree off `<base>`" keeps the run from colliding with anything else you have open.
- Local commits can proceed. Pushes, merges, Slack, and tracker writes still need explicit authorization.
- The [Autonomous run playbook](../../skills/poteto-mode/playbooks/autonomous-run.md) picks an Amp wake path: a child thread or orb, a schedule when you asked for later checks, or a webhook when an outside system must wake the thread.
- The escape hatch lets it stop at a genuine dead end and write up why, which beats eight hours of creative goal reinterpretation.

Because you'll review this work after stepping away, poteto-mode routes it through [`pstack:figure-it-out`](../../skills/figure-it-out/SKILL.md), which designs the run's phases before any code and wires in the decision log.

## What the loop does all night

```diagram
┌─────────────────────────┐
│ Check the finish        │
│ condition               │
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Smallest justified      │
│ change                  │
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Verify the real artifact│
└───────────┬─────────────┘
            ▼
     Progress?
        │
   ┌────┴────┐
   ▼         ▼
 Commit    Discard
   │         │
   └────┬────┘
        ▼
 Log one decision row
        │
        └── loop
```

## Scale past one agent

A standing program uses [Orchestrate](../../skills/poteto-mode/playbooks/orchestrate.md). A queue of independent PRs uses [Autopilot-full](../../skills/poteto-mode/playbooks/autopilot-full.md). Sequenced or coupled work uses [Autopilot-stack](../../skills/poteto-mode/playbooks/autopilot-stack.md), which produces a linear base-branch stack for the operator to land. Schedules and webhooks still require explicit authorization. A request to monitor does not authorize merging.

Next: [Steer with principle names](./08-principles.md).
