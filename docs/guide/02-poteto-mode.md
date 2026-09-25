# Route work through poteto-mode

`pstack:poteto-mode` is the front door. You give it a goal, it matches one of twenty-three playbooks, copies that playbook's steps into the checklist, and calls the other skills as the steps need them. In this page you learn what a good prompt looks like, and how little of one you actually need.

![A dispatcher pulls a switch lever to route robots on rail handcars toward lit gates, under a /poteto-mode departure board listing BUG FIX, FEATURE, and INVESTIGATION.](./images/router.jpg)

## What happens to your prompt

```diagram
┌─────────────┐     ┌─────────────┐     ┌────────────┐
│ Your prompt │────▶│ poteto-mode │────▶│ Principles │
└─────────────┘     └─────────────┘     └─────┬──────┘
                                            ▼
                                    ┌────────────────┐
                                    │ Match the task │
                                    └───────┬────────┘
          ┌─────────────────────────────────┘
          ├── Read-only question ──▶ Investigation ──┐
          ├── Defect ─────────────▶ Bug fix ─────────┤
          ├── New behavior ───────▶ Feature ─────────┤
          ├── Structure only ─────▶ Refactoring ─────┤
          ├── Measured slowness ──▶ Perf issue ──────┤
          └── Large/no match ─────▶ figure-it-out ───┤
                                                    ▼
                                           Verify and report
```

The diagram shows the common routes. There are also playbooks for hillclimbing a metric, diagnosing runtime symptoms and captured traces, prototypes, visual parity, authoring and evaluating skills, autonomous runs, babysitting a PR or stack to merge-ready, shipping a verified stack, running a PR queue on autopilot, orchestrating project-scale programs, session pickup, pausing safely, multi-phase plans, and worktree cleanup. The [playbook directory](../../skills/poteto-mode/playbooks/) has the full set.

## Say the goal, not the ceremony

You don't write a spec. You say what's wrong or what you want, plus anything you already know that saves the agent time:

```text
Use pstack:poteto-mode. Users get two notifications after a retry. Repro first, then fix and verify.
```

That's a Bug fix prompt. "Repro first" is a real constraint, not politeness, and the playbook requires it. Watch the checklist fill with the Bug fix steps. A permitted skip stays visible with `skip: <reason>`. This does not make mandatory implementation delegation optional.

When the conversation already carries the context, the prompt shrinks to almost nothing. All of these are enough:

```text
Use pstack:poteto-mode and keep going.
Fix the root cause, then prove it on the real export.
```

Selecting **poteto** in Amp's mode picker keeps the full skill instructions in the mode. Loading the skill in another mode gives it to that conversation without changing the selected mode.

Poteto coordinates; workers execute. Delegated tasks receive completed templates inline rather than loading `pstack:poteto-mode`, `pstack:how`, or `pstack:arena`. Writable and research workers load only explicitly applicable qualified execution skills. Strict read-only workers cannot load skills and receive their full role contract in their mode instructions.

## Switch tasks explicitly

When changing subjects in a long thread, say `new task` so the coordinator re-matches the playbook instead of continuing the old one:

```text
New task. Figure out why the cache entry survives logout. Don't change any code yet.
```

The last sentence pins this task to Investigation. To resume earlier work instead, name the thread and ask for session pickup; see [Understand the code](./03-understand.md).

## Parallel work

The plugin exposes two launch levels:

1. `pstack_start_agent` is the default. It creates a durable child thread and returns immediately. The child reports with native `send_thread_message`, or the plugin forwards its final text and wakes the parent.
2. `pstack_run_panel` waits for the same brief across a configured model panel. Use it when this turn must rank seats now.

For one role, always start with `pstack_start_agent`. Only when the parent truly cannot proceed without its result, use native `wait_for_threads`, then native `read_thread`. Never wait as a startup probe, and never request a reply while also waiting for it.

The parent executor decides the safe default. A local parent runs implementation in `current-checkout`. An orb parent starts a fresh `parent-project-orb`, and the plugin rejects local child routing. From a local parent, choose `parent-project-orb` for clean work from the project remote. Use `repo-independent-orb` only when the brief does not depend on a checkout. When project, size, or a custom mode matters, `native-orb` requires `project` and returns a complete native `create_thread` redirect. Amp has no cloud base branch.

The parent can steer a live Amp child with native `send_thread_message`. Children report only to the parent; do not let siblings message each other. Only a same-machine parent and child share the checkout, so cite paths. A child orb inherits the parent project, not the parent orb's files. If either thread is an orb, transfer files with `upload_thread_file` (4 MiB) or `download_thread_file`. Do not paste file bodies into briefs when a transfer can carry them.

Every worker is a native Amp thread. Amp owns inference routing, and model access and billing follow the user's connected providers. Pstack does not invoke subscription CLIs, bridge subscriptions, or change provider settings. If a start fails or a run hits a limit, report and reconcile it; never retry automatically or silently switch models.

Independent writers need disjoint owned paths or separate worktrees. Never assign overlapping paths to live writers. A local parent and child can share the current checkout when their write scopes are disjoint; a child orb has a separate checkout and needs explicit file transfer for unpushed work.

The [Amp adapter](../../skills/poteto-mode/references/amp-adapter.md) defines these execution mechanics. The playbook still owns the workflow. Parents plan, reproduce, review, and verify; implementation owners write the code and its follow-up fixes. Before shipping, require an independent verdict on the whole PR. A comment-only review is not that verdict.

## Leave it running

State an observable stopping condition and the approvals already granted:

```text
I'm stepping away. Keep going until the migration check reports zero old callers. Log your decisions. Do not push.
```

Work reviewed later routes through `pstack:figure-it-out` and keeps a `pstack:show-me-your-work` decision log. [Run work while you sleep](./07-overnight.md) covers the overnight contract.

Do not enumerate skills unless overriding a particular choice. The playbook supplies their order. For disk cleanup, ask the [Worktree cleanup playbook](../../skills/poteto-mode/playbooks/worktree-cleanup.md) to classify worktrees first; live threads and uncommitted work prevent automatic deletion.

Next: [Understand the code](./03-understand.md).
