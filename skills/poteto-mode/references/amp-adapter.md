# Amp adapter

Cursor pstack backgrounds every `Task` (`run_in_background: true`). Amp's equivalent is a child thread with a durable ID, not a longer wait. Cursor tool names, `subagent_type`, `environment`, `/loop`, `/deslop`, `AskQuestion`, `cloud_base_branch`, and `control-ui` / `control-cli` are not executable here. Use the Amp column.

| Cursor | Amp |
|---|---|
| `Task` with `run_in_background: true` | `pstack_start_agent` (returns `threadID` immediately) |
| Blocking `Task` | `pstack_run_agent` or `pstack_run_panel` only when this turn cannot proceed without that result |
| `subagent_type: "poteto-agent"` | Playbook role (`feature`, `bug-fix`, `refactoring`, `perf-issue`, `hillclimb`) |
| Routed `subagent_type` / `model` | The skill's named role. The plugin resolves the model |
| `environment: "cloud"` | `parent-project-orb`, or `native-orb` when size or mode matters |
| `environment: "local"` | `current-checkout` (local or runner parent only) |
| `cloud_base_branch` | Not available. Name a remote branch that already exists |
| `AskQuestion` | Ask the user. Use structured choices when the client supports them |
| `/loop` | Durable child thread, or a schedule only when the user asked for later or ongoing work |
| `/deslop` | Inspect the diff, then **unslop** prose |
| Cursor `create-skill` | Amp **building-skills** |
| `control-ui` / `control-cli` | The repository verification skill, or an Amp browser / PTY / accessibility skill |
| Workspace `agent-transcripts/` | `pstack_read_current_thread` / `read_thread` / `find_thread` |
| Todolist | Explicit checklist |

Do not invent Amp tools, aliases, or `inherit-parent` / `auto` model values. Schedules and webhooks run only when the user explicitly authorized that wake. External writes (push, PR create/edit/comment, merge, deploy, ticket or chat writes, data deletion) pause without that authorization.

## Join

Default to `pstack_start_agent`. Writable roles require a human-readable `scope` and concrete `scopePaths`. Route from the actual executor, not the word `remote`. Local and runner parents default to `current-checkout`. An Amp-managed orb parent defaults to a fresh `parent-project-orb`. Unknown placement requires an explicit target. Use `named-runner` with `runnerId` for hardware, credentials, private networks, or machine-bound tools. Use `repo-independent-orb` only when the brief does not depend on a checkout. Use `native-orb` with a required `project` when project, orb size, or a custom mode matters.

The child exclusively owns its declared paths and reports with `pstack_send_to_thread` (steer defaults on). Continue parent work that is independent of those paths, then end the turn when blocked. Never call `wait_for_threads` to judge startup. Amp can return `unknown` or `settled` with an empty transcript while the child is still starting. That is not failure. Do not spawn a second owner for equal or prefix-overlapping paths. Disjoint paths may run concurrently.

## Blocking wait

`pstack_run_agent` and `pstack_run_panel` wait. Use them only when this turn cannot proceed without one result, such as comment-reviewer or a panel you must rank now, and every input is already reachable without a transfer (remote refs, or same-checkout local). A blocking wait starts work immediately and cannot receive parent-local files during the wait. Omit `timeoutMs`. The plugin floors waits at ten minutes. They always return `threadID`. Timeout is `status: timeout` plus that ID and leaves the child live. Terminal failure is `status: error`. Never describe it as a timeout. A timed-out panel candidate remains pending until its thread becomes terminal.

Amp forbids recursive custom-agent runner creation from a plugin tool, so blocking `pstack_run_agent` and `pstack_run_panel` reject runner executors. Use one `pstack_start_agent` named-runner redirect per seat and aggregate reports in the parent.

## Never redo

A timeout, a late report, `wait_for_threads` `unknown`, or a live child is not a signal to implement that scope in the parent or to spawn a replacement owner. Durable claims survive plugin reload on the same executor. A terminal error requires reconciliation before replacement. Never redo or replace a live owner.

## Steer

The parent may message a live child with `pstack_send_to_thread` or Amp `send_thread_message` (`steer: true`) to tighten scope, share a sibling finding, or stop a wrong path. Do not spawn a second child for the same scope. Children do not chat with siblings. They report to the parent. The parent relays.

## Files

Threads do not share a filesystem. A steer message does not move files. Only a same-machine local parent and local child share the checkout. Cite paths, do not copy. A child orb inherits the parent project, not the parent orb's live files. Two orbs do not share a disk.

Uncommitted fixtures, screenshots, dumps, store files, and anything the brief cannot point at in git must reach the owner before that owner writes code. `upload_thread_file` needs an existing child thread and an existing destination parent directory. It cannot precede spawn.

Sequence when the child needs live files the parent holds:

1. Create the owner with `pstack_start_agent` and a brief that forbids writes until inputs are ready. Name the destination directories the parent will fill.
2. Wait until that child exists, then `upload_thread_file` into those existing directories (4 MiB).
3. Steer the owner to implement.

Child to parent: child writes, cites the path, parent `download_thread_file`. Need a URL: `thread_file_url` (expires). Do not paste a file body into a brief when a transfer can carry it. Do not push only to make an orb see a file unless the user authorized that push.

Live files in a parent orb are not a reason for the parent to implement. If a transfer cannot carry the inputs, persist them to a path the brief can name, then spawn, or keep coordinating in the parent until a transfer can. Direct parent implementation is not the fallback.

## Who writes the code

This section binds implementation delegation when a playbook or skill prescribes it (Feature, Bug fix, Refactoring, Perf issue, Hillclimb, and follow-up fixes on those scopes). It does not override other skills that tell the current agent to edit: **no-comments** trivial accepted fixes, **reflect** parent prose edits after approval, and similar prescribed local edits stay with that skill.

When implementation is prescribed, the parent coordinates, reproduces, and reviews. The child writes the implementation. Follow-up fixes on the same scope go to that live owner. After the owner is terminal, a fresh owner may take remaining work. Do not open a second live owner for equal or prefix-overlapping paths.

Mandatory feature delegation has no skip-with-reason escape. Laziness Protocol does not override it. The gain is review separation, not lines saved. You can spawn a child even though you are one. "The app is small" and "a child cannot spawn one" are both wrong.

**Nested-spawn-forbidden exception.** Applies only when implementation is prescribed, and only to an implementation owner already authorized to edit whose role or allowlist forbids further delegation. That owner writes the prescribed implementation itself, with the same review separation. No "standing by" reply that waits on a nested agent. Coordinating, reproducing, and reviewing do not satisfy this. Strict read-only roles, `comment-reviewer`, `how-explorer`, `how-explainer`, `why-investigator`, `why-synthesizer`, `judgment`, and other no-write seats cannot own an implementation diff. The exception never grants write authority those roles lack, never overrides host rules, and never cancels a skill that already assigned a local edit. Plugin tools are not agents.

## Launch targets

Plugin agent tools accept `executor: local | orb | { type: "runner", id }`. `pstack_start_agent` also accepts `launchTarget.kind: "current-checkout" | "parent-project-orb" | "repo-independent-orb" | "named-runner" | "native-orb"`. `named-runner` requires `runnerId`, accepts optional absolute `workingDirectory`, and returns a guarded native `create_thread` redirect with `executor: "runner"`, `runner_id`, and `working_directory`. `current-checkout` means the current local CLI or runner. It is unavailable from an Amp-managed orb. When project, orb size, or an arbitrary mode matters, `native-orb` returns a native redirect. Amp has no `cloudBaseBranch`. Arbitrary native threads outside pstack redirects bypass ownership guards.

## Size

Pick size from this table unless the user named one. The user-named size always wins. Changing a project default does not resize a running orb. From a local parent, keep dirty or machine-bound work on `current-checkout` and send clean independent work to an orb. From an orb parent, spawn the child first, then transfer inputs it needs, then release it to implement. Start small when unsure. A later thread can be larger. Never resize in place.

| Work | Size | How to spawn |
|---|---|---|
| Read-only local inspection | n/a | `pstack_start_agent` with `launchTarget.kind: "current-checkout"` |
| Read-only fan-out that needs a tiny orb | `a1.tiny` | `launchTarget.kind: "native-orb"`, then the returned `create_thread` |
| Small scripts, focused edits, light checks, recall/reflect miners | `a1.small` | `native-orb` `create_thread`, or `repo-independent-orb` if the project default is already small and the brief needs no checkout |
| Ordinary feature, bug, refactor, or hillclimb on the current checkout | n/a | `pstack_start_agent` with `launchTarget.kind: "current-checkout"` |
| Named machine, simulator, device, private network, or machine-only credentials | runner capacity | `pstack_start_agent` with `launchTarget.kind: "named-runner"` and `runnerId` |
| Clean work from the parent project remote | project default (`a1.small` or `a1.medium`) | `pstack_start_agent` with `launchTarget.kind: "parent-project-orb"` |
| Work that needs no checkout | project default (`a1.small` or `a1.medium`) | `pstack_start_agent` with `launchTarget.kind: "repo-independent-orb"` |
| Moderate builds, local services, test suites | `a1.medium` | `native-orb` when the default is smaller |
| Monorepos, several services, browsers, CPU-heavy tests, live visual lanes | `a1.large` | `native-orb` |
| Unusually large builds and wide parallel workloads | `a1.xxlarge` | `native-orb` |
| User named a size or mode | that size or mode | `native-orb` only |

## Briefs

Compact: paths, named data shape, success criteria, how to report. No file dumps. Include the parent thread ID and require `pstack_send_to_thread` with a compact report. Playbooks live with **poteto-mode**. After load, Amp names the skill base directory. Open `playbooks/<name>.md` and `references/amp-adapter.md` from that directory. Never `cat ~/.config/amp/plugins/pstack/...`.

## Models

Role-based, configurable through **setup-pstack**, `pstack_configure_models`, plugin `pstack.models.json`, `.amp/pstack.models.json`, or `~/.config/amp/pstack.models.json`. Code delegates default to `xai/grok-4.6`. Hardest changes, prose, and judgment default to `anthropic/claude-fable-5-1`. Panels are Fable 5.1, Sol, Grok, and Opus 5. The bundled plugin JSON may drop Fable and Opus (cheap). Feature and refactoring are independently configurable. A configured `builtin:low`, `builtin:medium`, `builtin:high`, or `builtin:ultra` still runs as a pstack delegate. Raw Grok delegates request `reasoningEffort: xhigh`. `builtin:*` are Amp modes, not Cursor thinking slugs.

The `poteto` parent is Amp builtin `high` plus **poteto-mode**. Amp selects its model and reasoning effort. It does not pin Grok or copy ultra tools. Grok stays on code and explorer workers. Do not start pstack work in official `grok46`. Never call `public_artifact_url` except for an image or video the user asked to share. Never call `painter` unless the user asked for an image.

## Schedules and webhooks

For work that must wake later, use an Amp schedule only when the user requested ongoing or later work. When the condition should resolve in minutes, wait in the current turn. For an outside system that must wake an orb thread, use `pstack_create_wake_webhook` after that authorization. Amp shows the capability URL through UI rather than transcript output. Webhooks are orb-only, at least once, and recover on the same persistent executor. Validate payload domains and make downstream actions idempotent.

## Workflow pointers

| Workflow | Tool | Role |
|---|---|---|
| Feature, including follow-up fixes | `pstack_start_agent` | `feature` |
| Bug fix implementation | `pstack_start_agent` | `bug-fix` |
| Refactoring edits | `pstack_start_agent` | `refactoring` |
| Perf implementation | `pstack_start_agent` | `perf-issue` |
| Hillclimb attempt | `pstack_start_agent` | `hillclimb` |
| How explorers | `pstack_start_agent` | `how-explorer` |
| How explainer / synthesis | `pstack_start_agent` | `how-explainer` |
| Maintain-verification source wave | `pstack_start_agent` | `how-explorer` (one per feature file) |
| Why investigators | `pstack_start_agent` | `why-investigator` |
| Why synthesizer | `pstack_start_agent` | `why-synthesizer` |
| Swarm workers | `pstack_start_agent` | `swarm-worker` |
| Recall / automate-me miners | `pstack_start_agent` | `how-explorer` |
| Reflect reviewers / synthesizer | `pstack_start_agent` | `reflect-*` |
| Shipping per-PR verdict | `pstack_start_agent` | `judgment` (whole-PR `PASS` / `PASS+NOTES` / `FAIL`, not comments-only) |
| Comment review | `pstack_run_agent` when inputs are already reachable; else `pstack_start_agent`, hold, upload, release | `comment-reviewer` |
| Interrogate | `pstack_run_panel` | `interrogate-reviewers` |
| Arena runners | `pstack_run_panel` | caller panel, default `arena-runners` |
| Arena cross-judge | `pstack_start_agent` | `arena-cross-judge` |
| Architect sketches | **arena** with `architect-runners` | then `arena-cross-judge` |

`how` is a workflow, not a role. Never pass role `how`. Never use Amp builtin `Task` for these waves.
