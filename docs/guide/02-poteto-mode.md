# Route work through poteto-mode

`pstack:poteto-mode` is the front door. You give it a goal, it matches one of twenty-three playbooks, copies that playbook's steps into the checklist, and calls the other skills as the steps need them. In this page you learn what a good prompt looks like, and how little of one you actually need.

![A dispatcher pulls a switch lever to route robots on rail handcars toward lit gates, under a /poteto-mode departure board listing BUG FIX, FEATURE, and INVESTIGATION.](./images/router.jpg)

## What happens to your prompt

```diagram
┌────────────┐     ┌──────────────┐     ┌────────────┐
│ Your prompt│────▶│ poteto-mode  │────▶│ Principles │
└────────────┘     └──────┬───────┘     └─────┬──────┘
                          │                   │
                          ▼                   │
                   Match the task             │
                          │                   │
          ┌───────────────┼───────────────┐   │
          ▼               ▼               ▼   ▼
   Investigation      Bug fix         Feature
          │               │               │
          ▼               ▼               ▼
   Refactoring       Perf issue     figure-it-out
                          │
                          ▼
                   Verify and report
```

The diagram shows the common routes. There are also playbooks for hillclimbing a metric, diagnosing runtime symptoms and captured traces, prototypes, visual parity, authoring and evaluating skills, autonomous runs, babysitting a PR or stack to merge-ready, shipping a verified stack, running a PR queue on autopilot, orchestrating project-scale programs, session pickup, pausing safely, multi-phase plans, and worktree cleanup. The [playbook directory](../../skills/poteto-mode/playbooks/) has the full set.

## Say the goal, not the ceremony

You don't write a spec. You say what's wrong or what you want, plus anything you already know that saves the agent time:

```text
Use pstack:poteto-mode. Users get two notifications after a retry. Repro first, then fix and verify.
```

That's a Bug fix prompt. "Repro first" is a real constraint, not politeness, and the playbook honors it. Watch the checklist fill with the Bug fix steps. A skipped step stays visible with `skip: <reason>`.

When the conversation already carries the context, the prompt shrinks to almost nothing. All of these are enough:

```text
Use pstack:poteto-mode and keep going.
Fix the root cause, then prove it on the real export.
```

## Parallel work

The plugin exposes three levels:

1. `pstack_start_agent` is the default. It creates a durable child thread and returns immediately. The child reports with `pstack_send_to_thread` and wakes the parent.
2. `pstack_run_panel` waits for the same brief across a configured model panel. Use it when this turn must rank seats now.
3. `pstack_run_agent` waits for one role. Use it only when this turn cannot proceed without that result, such as comment-reviewer.

The parent executor decides the safe default. A local parent runs implementation in `current-checkout`. An orb parent starts a fresh `parent-project-orb`, and the plugin rejects local child routing. From a local parent, choose `parent-project-orb` for clean work from the project remote. Use `repo-independent-orb` only when the brief does not depend on a checkout. When project, size, or a custom mode matters, `native-orb` requires `project` and returns a complete native `create_thread` redirect. Amp has no cloud base branch.

The parent can steer a live child with `pstack_send_to_thread`. Children report only to the parent. Do not let siblings message each other. Only a same-machine local parent and local child share the checkout, so cite paths. A child orb inherits the parent project, not the parent orb's files. If either thread is an orb, transfer files with `upload_thread_file` (4 MiB) or `download_thread_file`. Do not paste file bodies into briefs when a transfer can carry them.

Never let two writing agents share a worktree. Give each one a branch or worktree.

Next: [Understand the code](./03-understand.md).
