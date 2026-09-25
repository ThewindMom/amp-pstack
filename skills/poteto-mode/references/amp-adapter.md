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
| `control-ui` / `control-cli` | No direct Amp alias. Use a verification skill or tool that is actually available and matches the real surface; otherwise report the gap |
| Workspace `agent-transcripts/` | `pstack_read_current_thread` / `read_thread` / `find_thread`; page `pstack_read_current_thread` by `offset` while `offset + messages.length < total`; `truncated` says the response is a partial transcript |
| Todolist | Explicit checklist |

Do not invent Amp tools, aliases, or `inherit-parent` / `auto` model values. Schedules and webhooks run only when the user explicitly authorized that wake. External writes (push, PR create/edit/comment, merge, deploy, ticket or chat writes, data deletion) pause without that authorization.

## Join

Choose the backend before applying the native placement guidance below. Grok uses `cursor-agent --model grok-4.7-xhigh-fast` unless the active SuperGrok connection wins Amp routing. Opus defaults to Claude Code; `pstack_configure_models` accepts `action: "set", backends: { opus: "amp", grokBuild: false }`. No provider settings are changed. Grok Build is off by default.

CLI delegates run in isolated snapshot worktrees on the current executor. Omit explicit `executor` and `launchTarget` for CLI routing; explicit native placement is rejected, not replaced silently. A snapshot includes tracked edits and non-ignored untracked files. CLI workers have no Amp tools, cannot be steered, and return final text through the plugin. Their `cli-` IDs are not Amp thread IDs; use `pstack_stop_agent` to stop them. Read-only runs use CLI read-only mode and filesystem checks, with a private dependency copy linked as `node_modules`. Writer patches need parent review before applying; writers install dependencies only as directed in the brief. Orb services retain running work across plugin reload. Finished run data expires after seven days; stopped services without results become errors. Mid-task limits are reported, never replayed.

### Why a CLI adapter currently exists

Amp has built-in external Claude Code and Cursor terminal agents, with installation, new/resume commands, `$p` for the prompt, and `$m` for the chosen model. Those capabilities could replace custom installation, terminal lifecycle, and orb provisioning. They are not evidence that every CLI lifecycle must be custom.

The currently exposed native `create_thread` schema accepts `agent_mode: string` but advertises built-in, plugin, and custom modes; it exposes no model, external-agent command, or terminal-session argument. A repository-scoped `list_agent_modes` inspection returned only built-in and plugin modes, not `external-agent:<key>`. This does not prove the server rejects arbitrary external-mode strings; no unsupported launch was attempted. The plugin SDK exposes `createAgent` and built-in agent handles, but no external-agent constructor. Its documented message, state, result, and cancellation contracts concern Amp turns, not external terminal sessions.

Until an advertised external-agent launch and result/cancel contract covers these requirements, the CLI adapter supplies model selection, isolated snapshots, final-report collection, cancellation, and reviewed writer patches. The built-in external commands also bypass permissions, and Cursor's default uses `agent` rather than `cursor-agent`; those defaults do not preserve this adapter's read-only contract unchanged. Prefer a native replacement once these gaps are resolved; do not change account configuration to work around them without authorization.

Default to `pstack_start_agent`. Writable roles require a human-readable `scope` and concrete `scopePaths`. Route from the actual executor, not the word `remote`. Local and runner parents default to `current-checkout`. An Amp-managed orb parent defaults to a fresh `parent-project-orb`. Unknown placement requires an explicit target. Use `named-runner` with `runnerId` for hardware, credentials, private networks, or machine-bound tools. Use `repo-independent-orb` only when the brief does not depend on a checkout. Use `native-orb` with a required `project` when project, orb size, or a custom mode matters.

The child exclusively owns its declared paths and reports with native `send_thread_message` when available. Otherwise the plugin forwards its final text, including CLI reports. Continue parent work that is independent of those paths, then end the turn when blocked. Never call `wait_for_threads` to judge startup. Amp can return `unknown` or `settled` with an empty transcript while the child is still starting. That is not failure. Do not spawn a second owner for equal or prefix-overlapping paths. Disjoint paths may run concurrently.

## Blocking wait

`pstack_run_agent` and `pstack_run_panel` wait. Use them only when this turn cannot proceed without one result and every input is already reachable without a transfer. For a comment review, that means a same-checkout local child can already read the parent-prepared scoped patch artifact or explicitly named files; git refs alone are not sufficient because `comment-reviewer` cannot run git. A blocking wait starts work immediately and cannot receive parent-local files during the wait. Omit `timeoutMs`. The plugin floors waits at ten minutes. They always return `threadID`. Timeout is `status: timeout` plus that ID and leaves the child live. Terminal failure is `status: error`. Never describe it as a timeout. A timed-out panel candidate remains pending until its thread becomes terminal.

Amp forbids recursive custom-agent runner creation from a plugin tool, so blocking `pstack_run_agent` and `pstack_run_panel` reject runner executors. Use one `pstack_start_agent` named-runner redirect per seat and aggregate reports in the parent.

## Never redo

A timeout, a late report, `wait_for_threads` `unknown`, or a live child is not a signal to implement that scope in the parent or to spawn a replacement owner. Durable claims survive plugin reload on the same executor. A terminal error requires reconciliation before replacement. Never redo or replace a live owner.

## Steer

The parent messages a live Amp child with native `send_thread_message` to tighten scope, share a sibling finding, or stop a wrong path. CLI workers cannot receive steering messages. Do not spawn a second child for the same scope. Children do not chat with siblings. They report to the parent. The parent relays.

Reports use native `send_thread_message`; the duplicate messaging wrapper is removed. A live orb probe found no plugin event for the native call inside `code_exec`, but its transcript result carries a structured `amp_builtin_call` receipt. Terminal recovery recognizes that receipt only for a successful send to the actual parent, across transcript pages. Restricted reviewers can return final text for the plugin to forward. Absence of a receipt keeps fallback notification enabled. Recovery still recognizes old wrapper receipts in already-running threads.

Use `pstack_stop_agent` to cancel any durably tracked child owned by the current parent, including a nonimplementation background child whose prompt append acknowledgement was uncertain. Implementation children separately hold scope ownership; cancellation does not release that claim until Amp observes terminal `idle` or `error`. Background tracking also remains until a terminal state is observed. The strict read-only guard is permanent per thread. The write hook keeps rejecting file writes from a strict read-only child after a terminal state, a re-steer, `pstack_stop_agent`, or a plugin reload on the same executor. For a `named-runner` or `native-orb` redirect, first complete the returned native `create_thread` call so the plugin can pair that exact thread ID with the reservation; then stop the paired child ID. A reservation with no paired native child cannot be canceled through this tool. Reconcile the native create result first.

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

Plugin agent tools accept `executor: local | orb | { type: "runner", id }`. `pstack_start_agent` also accepts `launchTarget.kind: "current-checkout" | "parent-project-orb" | "repo-independent-orb" | "named-runner" | "native-orb"`. `named-runner` requires `runnerId`, accepts optional absolute `workingDirectory`, and returns a guarded native `create_thread` redirect with `executor: "runner"`, `runner_id`, and `working_directory`. `current-checkout` means the current local CLI or runner. It is unavailable from an Amp-managed orb. When project, orb size, or an arbitrary mode matters, `native-orb` returns a native redirect. Both native redirects name a stable per-role mode, such as `pstack-feature`, or `pstack-cross-judge-<seat>` for `arena-cross-judge` pool seats 1 to 3. A judge redirect that selects a later seat fails; move that model into the first three seats or use `parent-project-orb`. The child orb or runner resolves the model from its own pstack configuration, so the redirect's `model` field reports only the parent's resolution. An explicit `agentMode` override replaces the registered pstack role mode, including its instructions and tool restrictions. Strict read-only and research roles reject this override on `native-orb`. Other roles should use it only when the caller accepts that different contract. Amp has no `cloudBaseBranch`. Arbitrary native threads outside pstack redirects bypass ownership guards.

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

Compact: paths, named data shape, success criteria, how to report. No file dumps. Name only verification skills and tools known to be available, and require reports to distinguish a skill run from direct shell tests. Include the parent thread ID and require a compact report through native `send_thread_message` when available, otherwise final text; CLI workers always return final text. Playbooks live with **poteto-mode**. After load, Amp names the skill base directory. Open `playbooks/<name>.md` and `references/amp-adapter.md` from that directory. Never `cat ~/.config/amp/plugins/pstack/...`.

## Models

Each run selects one backend. A startup rejection or mid-task limit is terminal, with evidence for the parent. There is no automatic retry or successor run. The parent must reconcile the result before explicitly launching replacement work.

Role-based, configurable through **setup-pstack**, `pstack_configure_models`, an optional plugin `pstack.models.json`, `.amp/pstack.models.json`, or `~/.config/amp/pstack.models.json`. The repo does not ship a plugin model file. Code delegates default to `xai/grok-4.7`. The `hardest` role and prose or judgment roles default to `anthropic/claude-opus-5-5`; configure `hardest` separately when the strongest implementation seat should differ from review and prose. Panels are Opus 5.5, GPT-6 Sol, and Grok 4.7. Bare Opus 5.5 and GPT-6 Sol seats request `reasoningEffort: max`; bare Grok 4.7 seats request `reasoningEffort: xhigh`. An explicit seat effort overrides that default. Feature and refactoring are independently configurable. A seat may be a model string or `{ "model": "provider/model", "effort": "..." }`; panels preserve each seat's model and effort. A configured `builtin:low`, `builtin:medium`, `builtin:high`, or `builtin:ultra` still runs as a pstack delegate and cannot carry a separate effort. Use `amp plugins show-agent-options --json` as the runtime source for supported concrete efforts. The standalone `grok47-xhigh` mode remains xhigh. `builtin:*` are Amp modes, not Cursor thinking slugs. `builtin:high` is GPT-6 Astra at medium effort, not GPT-6 Sol.

Each spawn names an Amp role or panel, not a Cursor Task `model` slug. `pstack_start_agent` and `pstack_run_panel` have no per-call model argument. `modelFor` and `panelFor` resolve the configured map. A missing role uses `DEFAULT_MODELS`. Cursor `inherit-parent` and `auto` are not Amp values, so do not pass them. A rejected single-role spawn stops. Report the rejection. Do not retry that role with another model on that call. A rejected panel seat is one terminal dropout. `pstack_run_panel` settles the other seats. Arena proceeds with N-1 when at least one candidate completed, then starts the cross-judge. Interrogate completes the remaining reviewers. Do not stop the whole panel for one seat. A replacement model is a persistent config write. Do it only when the user asks, through `pstack_configure_models` or **setup-pstack**, using an ID from `amp plugins show-agent-options --json`. Reload plugins before the next orb spawn. Do not pretend a same-family fallback ran on that call. Code playbooks read `feature`, `refactoring`, `bug-fix`, `perf-issue`, and `hillclimb`. The hardest implementation changes read `hardest`. Prose and review judgment read `judgment`.

The `poteto` parent is Amp builtin `medium` plus **poteto-mode**, with no model or reasoning override. It inherits medium's model, reasoning, and tools rather than pinning a particular model. The full Poteto SKILL.md is persisted in its registered mode instructions. Reload the plugin after changing that skill. It does not copy ultra tools. Grok stays on code and explorer workers. Do not start pstack work in official `grok46`. Never call `public_artifact_url` except for an image or video the user asked to share. Never call `painter` unless the user asked for an image.

## Schedules and webhooks

For work that must wake later, use an Amp schedule only when the user requested ongoing or later work. When the condition should resolve in minutes, wait in the current turn. For an outside system that must wake an orb thread, use `pstack_create_wake_webhook` after that authorization. Amp shows the capability URL through UI rather than transcript output. Webhooks are orb-only, at least once, and recover on the same persistent executor. Validate payload domains and make downstream actions idempotent.

## Workflow pointers

### Retained custom surface

| Component | Required behavior and reason it remains |
|---|---|
| `pstack_start_agent`, `pstack_run_agent`, role configuration | Upstream role/model selection and background or blocking delegation. Native `create_thread` has no per-call model/effort parameters; the plugin builds configured agents through Amp's SDK. Threads, messages, and files remain native. |
| `pstack_run_panel` and design state | Arena/Architect require parallel candidates, dropout handling, and a read-only cross-judge after candidates finish. The gate's durable enforcement is an Amp addition, not an upstream storage format. |
| `pstack_stop_agent` | Autopilot requires stopping stale workers before replacing them. The exposed native tools have no verified cancel operation; this tool calls SDK `cancel` or stops the CLI service. |
| `pstack_read_current_thread` | Reflect inspects current-thread history and tool results, including compacted messages. Native `read_thread` is for other threads or message/selection links, not an equivalent full current-thread transcript export. |
| `pstack_configure_models` | Upstream persistent role maps and budgets, adapted to supported Amp model IDs and separate reasoning effort. |
| `pstack_create_wake_webhook` | User-requested retained generic external wake capability. It wraps Amp's native webhook API with private URL display and delivery recovery, not a separate webhook server. |
| CLI adapter | Separately requested Cursor/Claude subscription routing; the external-agent API gap is documented above. One backend, one snapshot, final report, explicit cancellation, no automatic retries. |
| Runtime journal and tool guards | Upstream asks for isolated owners and read-only reviewers. Transactional overlap claims, permanent per-thread guards, and reload recovery are extra Amp enforcement, including the user's requested read-only and stop fixes; they are not claims of full filesystem confinement. |
| Terminal report recovery | Preserves background result delivery when a worker cannot send its own report. Native receipt inspection replaces the removed messaging wrapper; acknowledgement loss can still duplicate a notification. |
| Poteto selector | Separately requested full skill instructions persisted in the mode, inheriting built-in medium without model or reasoning overrides. |

Native `send_thread_message`, thread search/read/status, file transfers, schedules, and portals need no pstack transport wrappers. Do not add duplicate tools for them. Replacing the retained launch/panel tools requires preserving role selection and workflow ordering, not merely renaming the native entrypoint.

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
| Comment review | Parent prepares a patch for a diff review, or uses caller-named files for an explicit whole-file review. `pstack_run_agent` only when a same-checkout child can read the inputs; otherwise `pstack_start_agent`, hold, upload the patch and current scoped files (or named files), release. Report a gap if a requested diff cannot be transferred; never replace it with refs or a whole-file review | `comment-reviewer` |
| Interrogate | `pstack_run_panel` | `interrogate-reviewers` |
| Arena runners | `pstack_run_panel` | caller panel, default `arena-runners` |
| Arena cross-judge | `pstack_start_agent` with the non-empty unique `candidateThreadIDs` from the candidate-ready notification or `agent.end` continuation. These authoritative lists include tracked failed children even when the panel result omits them. Ignore stale requests with another ID set; a failed-judge notification repeats the same set for retry | `arena-cross-judge` |
| Architect sketches | **arena** with `architect-runners` | then `arena-cross-judge` |

`how` is a workflow, not a role. Never pass role `how`. Never use Amp builtin `Task` for these waves.
