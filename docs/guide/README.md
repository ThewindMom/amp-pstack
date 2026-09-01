# amp-pstack guide

## Set up

Install the plugin and restart Amp:

```bash
git clone https://github.com/ThewindMom/amp-pstack.git ~/.config/amp/plugins/pstack
amp plugins list
```

For a project-only install, clone the repository to `.amp/plugins/pstack` instead. Amp's URL installer does not install directory plugins. Select the `poteto` mode or load `pstack:poteto-mode`. Run `pstack:setup-pstack` when you want to change model roles.

## Prompting

State the outcome and a checkable finish condition. Let poteto-mode select the playbook:

```text
Use pstack:poteto-mode. Add JSON output. Text output stays byte-identical, the JSON parses, and both forms run against the sample project.
```

Use direct skills when you need one focused behavior:

```text
Load pstack:how and explain how cancellation flows through this service.
Load pstack:interrogate and review this branch against its stated intent.
Load pstack:recall and catch me up on last week's export work.
```

## Parallel work

The plugin exposes three levels:

1. `pstack_run_agent` runs one configured role and waits for its report.
2. `pstack_run_panel` runs the same brief across a configured model panel.
3. `pstack_start_agent` creates a durable child thread that reports to its parent.

Use local execution for the current checkout. Use an orb for isolated work from the project's remote base. If the job needs a specific orb size or a plugin/custom agent mode, ask the parent Amp agent to use native `create_thread`; the plugin API cannot set `orb_size`.

Never let two writing agents share a worktree. Give each one a branch or worktree. Remember that an orb cannot see uncommitted local files.

## Long-running work

Give the run a predicate, not a duration:

```text
Use pstack:poteto-mode. Keep going until zero old parser callers remain, every parser fixture passes, and the old API is deleted. Keep a decision trail.
```

Amp-native wake mechanisms are:

- A durable child thread for independent ongoing execution.
- A schedule when the user explicitly asks to run or check again later.
- A capability webhook when an external service must wake an orb thread.
- A blocking wait in the current turn for conditions expected within minutes.

Schedules and external writes still require explicit user authorization. A request to monitor does not authorize merging, pushing, or changing production state.

## Threads as memory

`pstack:reflect` reads the current Amp transcript through `pstack_read_current_thread`. `pstack:recall` searches Amp threads with `find_thread` and reads relevant conversations with `read_thread`. `pstack:automate-me` uses the same history to draft a personal mode through Amp's `building-skills` workflow.

This is stronger than filesystem transcript mining because it uses authenticated thread metadata, compacted history, parent-child relationships, and full server-side content.

## Verification and shipping

Generate project verification skills under `.agents/skills/verify-<app>/`. Run the real application path before claiming success. Use the bundled PR watcher for GitHub status. Babysit stops at merge-ready. Shipping or merging happens only when the user explicitly requests it.

The Graphite playbooks require `gt`. Without it, use ordinary independent PRs or adapt the topology steps while preserving independent verification and explicit merge authorization.

## Benny

[`automations/benny`](../../automations/benny/) is a dormant reference workflow. On Amp, a source integration POSTs a Slack event to a pstack capability webhook. The owning orb thread uses connected Slack and tracker tools, delegates read-only analysis to child agents, and posts only when explicitly configured and authorized. It is not enabled by installing this plugin.

## What did not port exactly

- A plugin-created orb cannot select `orb_size`; native Amp thread creation can.
- Editor-specific UI, slash-command syntax, and proprietary automation editors have no direct Amp equivalent. Skills, Amp modes, threads, schedules, and webhooks replace them.
- External integrations remain dependent on the tools connected to the user's Amp workspace.
- Prompt resources in `agents/` are documentation. Runtime delegates are created by [`index.ts`](../../index.ts).
