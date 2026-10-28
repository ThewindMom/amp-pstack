# Run work while you sleep

This is the payoff for everything before it. An agent you can trust to verify its own work is an agent you can leave alone with a hard task. What makes that safe isn't hope. It's a checkable finish condition, an isolated worktree, and a decision log you audit in the morning.

![She waves goodnight from the door while robots keep the factory running, one updating a DECISION LOG wall board under a BUILD LOOP ACTIVE sign.](./images/overnight.jpg)

## Earn trust before autonomy

Before leaving a run alone, make sure you have seen the task done, the agent has the verification tools and signals you would use, every stage stops on failed proof, and repeated transcript failures have become tools or checks. Until all four hold, run it while you watch.

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

To stop deliberately, ask it to pause safely. The Pause safely playbook finishes or backs out the current step, commits a local checkpoint, and writes a resume note for Session pickup.

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

Each iteration makes one justified change, checks it, and records one decision row. Discard non-progress and pivot when the metric plateaus. In the morning, use `pstack:show-me-your-work` to review the trail and Attention items.

For a quick status instead of an audit, run [`pstack:ketchup`](../../skills/ketchup/SKILL.md) in the thread that ran the work. It reads only and explains what changed since your last message, using the screenshots and small diagrams the work produced. It lists each decision waiting on you with its recommendation, evidence, and risk, so you can decide from the reply alone.

Use Orchestrate for multi-day programs. Its coordinator decides which agent does each piece of work, checks what each one produces, and never writes code. It uses native threads, project notes, and PR/CI event subscriptions instead of bookkeeping scripts or polling. Each PR has one branch owner and a different-family verifier; only that owner may push, rebase, retarget, or merge, within explicit authorization. Work one agent can finish in a session belongs in the overnight contract above.

A standing program uses [Orchestrate](../../skills/poteto-mode/playbooks/orchestrate.md). A queue of independent PRs uses [Autopilot-full](../../skills/poteto-mode/playbooks/autopilot-full.md). Each PR gets one owner. A swarm checks the code-ready head SHA. A later rebase or minor fix gets one fresh verifier; wording-only changes need no verifier rerun, while every new head still needs green CI. Only new behavior or a large new diff calls the full swarm again. Demonstrated user bugs, failed gates, and newly wrong shipped docs block; unrelated base defects do not unless copied or newly reached. A clean verdict does not grant merge permission.

[Autopilot-stack](../../skills/poteto-mode/playbooks/autopilot-stack.md) runs the same process without merging and hands verified PRs to the operator. Only dependent PRs stack; independent work stays independent. Each owner rebases its own branch. Nobody pushes after handoff without the operator's go. Schedules and webhooks still require explicit authorization. A request to monitor does not authorize merging.

An explicitly authorized hourly Amp schedule can wake a thread to check a predicate. Every stage must be able to stop and hand over evidence. Scheduling does not authorize pushes, tracker or chat writes, PR creation, or merging; each external-write class still needs explicit approval.

Next: [Steer with principle names](./08-principles.md).
