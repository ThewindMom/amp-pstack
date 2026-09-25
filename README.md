# amp-pstack

An Amp-native port of [Lauren Tan's pstack](https://github.com/cursor/plugins/tree/main/pstack), synchronized with upstream pstack 0.15.5. It keeps pstack's 47 skills, 23 engineering playbooks, principles, and PR tooling while replacing editor-specific orchestration with Amp agents, threads, orbs, schedules, and webhooks.

## Porting contract

The workflow source is [Cursor pstack 0.15.5 at the pinned revision](https://github.com/cursor/plugins/tree/12d587dfb20741cafc376c42c696c5f6e2a64487/pstack). Preserve its decision rules, mandatory steps, and exceptions. Translate platform mechanics without weakening the workflow.

The [Amp adapter](skills/poteto-mode/references/amp-adapter.md) owns execution details such as role-based child threads, executor selection, file transfer, ownership, and authorized schedules. Playbooks retain the instructions for what work to delegate and what evidence to require. Implementation and follow-up fixes belong to the implementation owner; comment review does not replace an independent whole-PR shipping verdict.

Amp permissions and higher-priority instructions still apply. The mode supplies instructions, not a sandbox that prevents every workflow violation. The regression tests check the port's instruction contracts and runtime wiring; they do not prove that every future agent run complies. Inspect actual delegate calls and verification evidence when evaluating behavior. Loading the skill does not establish which mode was selected in the Dial.

## Install

pstack is a directory plugin. Amp's URL installer (`amp plugins add`) only accepts a single `.ts` file, so do not use it here.

**Personal plugins (recommended).** This loads on every machine and in orbs. Clone your Amp user-plugins repo, copy this tree in as `pstack/`, and copy [`poteto-mode.ts`](./poteto-mode.ts) to the **root** of that repo (next to `pstack/`, not inside it). Amp's Mode Dial catalog only lists root-level `.ts` plugins, which is why the custom Grok mode appears and `poteto` did not.

```bash
amp clone user-plugins
rsync -a --delete --exclude .git ./ /path/to/user-plugins/pstack/
cp poteto-mode.ts /path/to/user-plugins/poteto-mode.ts
```

Then reload plugins. Open Settings → Mode Dial → Build Dial and drag **poteto** into a bay. A system clone at `~/.config/amp/plugins/pstack` beats a personal copy, so do not keep both.

**This machine only:**

```bash
git clone https://github.com/ThewindMom/amp-pstack.git ~/.config/amp/plugins/pstack
```

**One project only:**

```bash
mkdir -p .amp/plugins
git clone https://github.com/ThewindMom/amp-pstack.git .amp/plugins/pstack
```

Confirm with `amp plugins list`. A personal copy shows as `amp-global-plugin:pstack` with `scope: user`.

## Start

Select `poteto` from the mode picker after it is on your Dial. If the picker still only shows builtins and official-modes, start in `medium` and load the skill:

```text
Load pstack:poteto-mode. Then <task>.
```

Then state the goal and the evidence that proves it:

```text
Use pstack:poteto-mode. The export writes duplicate rows after a retry. Reproduce it, fix the root cause, and verify the real export.
```

Configure model roles with the `pstack:setup-pstack` skill, the `pstack_configure_models` tool, or the `pstack: setup model profile` command.

## What the Amp port adds

- **Selectable mode.** [`poteto-mode.ts`](./poteto-mode.ts) is a root-level single-file plugin so Amp's Mode Dial can list it. It `extends: 'medium'` and pins `anthropic/claude-opus-5-5` at medium reasoning. Amp medium tools stay. Grok 4.7 at xhigh effort handles most implementation and exploration delegates. The standalone `grok47-xhigh` mode is separate and does not load this skill. The official `gpt6s` mode is GPT-6 Sol at high effort and is not this parent. The `pstack/` directory plugin still owns skills and tools. Do not also register `poteto` from `index.ts`, or the key collides.
- **47 registered skills.** Invoke them with qualified names such as `pstack:how`, `pstack:arena`, `pstack:recall`, and `pstack:reflect`.
- **Role-based agents.** Cursor backgrounds every Task. Amp's unit is the thread. Default long work (`feature`, `how`, `bug-fix`, and the rest of the playbooks) uses `pstack_start_agent`. Writable starts need a human-readable `scope` and concrete `scopePaths`. Local and runner parents stay on their current executor by default; Amp-managed orb parents use a fresh child orb. The tool returns `threadID` immediately. The child exclusively owns its paths and reports with `pstack_send_to_thread` (steer defaults on). The parent keeps doing independent work and ends the turn when blocked. Never use `wait_for_threads` to judge startup. Amp can report `unknown` or `settled` on an empty child while it starts. Never redo or replace a live child. `pstack_run_agent` waits only when this turn cannot proceed without one result. Timeout preserves the live `threadID`; terminal failure returns `status: "error"`.
- **Multi-model panels.** `pstack_run_panel` waits for arena, architect, and interrogate seats. Keep it for ranking that this turn needs now. Its optional `count` accepts 1 through 20 candidates and cycles the configured seats in order.
- **Durable child threads.** `pstack_start_agent` launches on the current executor, a fresh orb, or a named runner. Children report through `pstack_send_to_thread`; the parent can steer a live child and relays between siblings. If an active child becomes terminal without reporting, pstack inspects the full child transcript and steers the parent with the terminal state and newest assistant text. Failed fallback appends remain pending for reload recovery. This is not a global exactly-once guarantee: the host has no transaction or idempotency key spanning append acknowledgement and local state, so a lost acknowledgement can still produce a duplicate fallback. Only work kept on the current executor can depend on its live checkout. Transfer files explicitly whenever either side is an orb. Two orbs do not share a disk.
- **Durable ownership.** A transactional SQLite journal outside the plugin checkout permits disjoint paths to overlap, prevents duplicate or prefix-overlapping writers, and restores live claims after plugin reload on the same persistent executor.
- **Thread-native memory.** Reflection reads the current transcript directly. `pstack_read_current_thread` returns `offset`, `total`, and `truncated`; callers page forward until `offset + messages.length` reaches `total`. Recall and personal-mode mining use Amp's thread search and full thread reader.
- **Long-running work.** Playbooks use Amp child threads, schedules, and capability webhooks instead of editor polling commands.
- **External wakeups.** `pstack_create_wake_webhook` persists registration intent, restores its handler on plugin reload, and serializes at-least-once delivery to its owning orb thread. The capability URL is shown through Amp UI, not written into the transcript.
- **Existing tools.** The legacy orchestration ledger and GitHub PR watcher remain Bun tools. The playbooks invoke the watcher through Bun because synced plugin caches do not preserve executable bits. Current PR playbooks use forge-neutral base-branch stacks and do not require Graphite.

## Agent and panel defaults

`poteto` is Amp medium tools plus Opus 5.5 at medium reasoning, then pstack playbooks. Builtin `medium` still maps to GPT-5.6 Sol on Amp's Dial, and current builtin `high` is GPT-6 Astra at medium effort, so the parent pins `anthropic/claude-opus-5-5` instead of inheriting a Dial model. The official `gpt6s` mode is GPT-6 Sol at high effort and is not this parent. The standalone `grok47-xhigh` mode still does not load poteto-mode by itself. The parent coordinates at medium effort. Shipped delegate seats use max effort for Opus 5.5 and GPT-6 Sol, and xhigh effort for Grok 4.7.

`index.ts` owns the role map and a separate effort map for `anthropic/claude-opus-5-5`, `openai/gpt-6-sol`, and `xai/grok-4.7`. There is no bundled `pstack.models.json`. A missing plugin file leaves those defaults. Orbs get them with the plugin code. They do not get `~/.config/amp/pstack.models.json` unless that file also exists there. `builtin:high` is not a stand-in for GPT-6 Sol.

| Seat | Shipped map |
|---|---|
| Parent `poteto` | `extends: medium`, model `anthropic/claude-opus-5-5`, `reasoningEffort: medium` |
| Hardest code-writing role | `anthropic/claude-opus-5-5` at max |
| Feature, refactoring, bug-fix, perf, hillclimb, how-explorer, why-investigator, swarm-worker | `xai/grok-4.7` at xhigh |
| Judgment, how-explainer, why-synthesizer, reflect-judgment, reflect-divergent, reflect-synthesizer, comment-reviewer | `anthropic/claude-opus-5-5` at max |
| Reflect-tooling | `openai/gpt-6-sol` at max |
| Panels and arena cross-judge pool | Opus 5.5 max, GPT-6 Sol max, Grok 4.7 xhigh; one cross-judge runs, preferring a known family different from the parent |

The `hardest` role is the strongest code-writing seat. It is separate from `judgment`, which reviews without owning an implementation diff.

Any role can use a concrete `provider/model` or `builtin:low`, `builtin:medium`, `builtin:high`, or `builtin:ultra`. A seat may remain a model string or use `{ "model": "provider/model", "effort": "..." }`; panel arrays preserve each seat's model, effort, and order. Configuration layers replace a whole role value rather than merging effort into an earlier string. A model ID picks the weights only. A builtin mode picks Amp's prompt, tools, default model, and thinking. Amp controls these mappings; see [Modes & Models](https://ampcode.com/modes) for current models and reasoning efforts. Cursor thinking slugs such as `grok-4.7-fast-xhigh` and `gpt-5.6-sol-max` do not exist in Amp. Bare Opus 5.5 and GPT-6 Sol seats request `reasoningEffort: max`; bare Grok 4.7 seats request `reasoningEffort: xhigh`. Other raw model IDs have no thinking override. The standalone `grok47-xhigh` mode remains xhigh. Cursor `inherit-parent` and `auto` are not Amp aliases. Do not use `builtin:high` for GPT-6 Sol. Current builtin high is GPT-6 Astra at medium effort.

Run `amp plugins show-agent-options --json` before setup. Its model IDs and `capabilities.efforts` are the runtime capability table. An explicit unsupported effort for a known shipped model is an error; pstack does not silently downgrade it. Builtin aliases cannot carry a separate effort.

Later wins:

1. Balanced defaults in `index.ts`.
2. Optional plugin file `pstack.models.json` next to `index.ts`, if someone adds one. The repo does not ship it.
3. User file `~/.config/amp/pstack.models.json` on that machine.
4. Amp user config from `pstack_configure_models` `set` or `profile`.
5. Workspace file `.amp/pstack.models.json` in the current repo.

A workspace file is project policy and beats leftover palette config. Reset clears only Amp user config. A missing plugin file adds nothing. User JSON and workspace JSON stay when present. Orb children inherit the plugin code, not a machine-local user JSON.

Every delegate resolves this stack on every spawn. Amp requires custom remote modes to be active before a tool runs, so pstack registers the current role, model, and effort map when the plugin loads and keeps those exact Agents active for the process lifetime. Local launches create an unregistered Agent from the latest configuration, so model and effort changes apply to the next local launch. Reload plugins before the next `parent-project-orb` or `repo-independent-orb` launch, including after an effort-only change, so Amp can publish the new modes. `native-orb` and `named-runner` redirects name a stable per-role mode instead, such as `pstack-feature`, and the child orb or runner resolves that mode's model from its own pstack configuration.

To change the map that orbs see, change `DEFAULT_MODELS` in `index.ts`, push GitHub, then copy the tree into your Amp user-plugins repo and push that too. GitHub push alone does not update personal plugins.

[`.amp/pstack.models.example.json`](./.amp/pstack.models.example.json) is a smaller cheap-plus-high sketch for a machine-local overlay. `.amp/pstack.models.json` is gitignored. `{ "profile": "cheap" }` alone is valid and cheaper, but parks prose on Grok.

A panel value is a JSON array. Without `count`, the list length is how many agents `pstack_run_panel` runs. The defaults use three seats. With `count`, the tool runs that many candidates and repeats configured seats in order while preserving each seat's effort.

## Orbs, modes, and sizes

`pstack_start_agent` takes a discriminated `launchTarget`. `current-checkout` stays on the current local CLI or runner. `named-runner` requires `runnerId` and returns a guarded native `create_thread` redirect with `executor: "runner"`, `runner_id`, the role's stable pstack mode, and optional absolute `workingDirectory` mapped to `working_directory`. Amp forbids a plugin tool from recursively creating its own custom agent on a runner executor, so blocking `pstack_run_agent` and `pstack_run_panel` reject named-runner destinations with guidance to use the background redirect. `parent-project-orb` and `repo-independent-orb` create fresh isolated orbs. `native-orb` remains the adapter for project, size, or custom-mode fields absent from the plugin SDK. Read-only roles (`how-explorer`, `how-explainer`, `comment-reviewer`, and `arena-cross-judge`) and research roles (`why-*` and `reflect-*`) reject a `native-orb` `agentMode` override. The override would replace the role's tool allowlist or write exclusion, and the parent's write hook cannot guard a separate orb. `arena-cross-judge` has stable modes for pool seats 1 to 3 only, so a native redirect that selects a later seat fails. Move that model into the first three seats, or use `parent-project-orb`. Amp has no `cloudBaseBranch`. Arbitrary native threads that did not originate from a pstack redirect bypass the live implementation-owner guard.

Amp reports plugin placement as `local`, `remote`, or `unknown`; `remote` does not mean orb. Pstack probes the Amp-managed-orb lease capability before choosing a default. A remote non-orb process stays on its current runner. Unknown placement fails closed and requires an explicit target.

Implementation roles require `scopePaths`. Paths identify concrete writable resources; `scope` remains the human-readable brief. Disjoint paths may run concurrently under one parent. The same logical path set cannot gain a second owner, and prefix-overlapping paths in one workspace serialize.

The current parent can call `pstack_stop_agent` for any of its durably tracked children, including a nonimplementation background child whose prompt append acknowledgement was uncertain; another parent cannot cancel it. Implementation children additionally hold scope ownership, which is released only after Amp observes terminal `idle` or `error`. Background tracking is likewise retained until a terminal state is observed. A `named-runner` or `native-orb` redirect must first be paired with the exact child returned by its native `create_thread` result; an unpaired reservation is not stoppable by child ID.

Every child orb starts from the project remote. It does not receive the parent orb's live filesystem. Keep dependent work in the parent thread, or transfer the required files before the child starts. From a local parent, use `current-checkout` for uncommitted files, local services, simulators, devices, or machine-only credentials. Use an orb for clean, independent work. Do not push only to make a file visible to an orb unless the user authorized that push.

Panel wait timeout is not candidate completion. Timed-out candidate threads remain pending until they become terminal or are explicitly reconciled. The cross-judge cannot start early. While a judge is live, the parent becomes idle; the judge's report wakes it. A failed judge restores one replacement gate instead of satisfying the design run.

## Durability and limits

The runtime journal defaults to `~/.config/amp/pstack/runtime-<account>.sqlite`; `PSTACK_STATE_FILE` overrides it for tests. It survives plugin reloads and process restarts on the same persistent executor. It does not migrate state after that executor's disk is lost.

Wake-webhook registration intent is persisted before server registration and restored when the owning orb reloads the plugin. Delivery is serialized per plugin process, recorded as pending/delivered in SQLite, and recovered from exact structural envelopes across the full paginated user transcript. Payload text is untrusted data.

Amp webhooks are orb-only and at least once. The public API has no transaction spanning thread append and receipt storage, no append idempotency key, no webhook owner-rebinding API, and no guarantee that a replacement orb inherits local disk. Pstack therefore guarantees recovery on one owning persistent executor, not global exactly-once append. Domain actions still need their own validation and idempotency.

Named runners must already be live. Amp selects a runner ID but the plugin API does not select among multiple directories served by that runner, so machine-bound workflows must verify the checkout before writing.

## Skills and playbooks

The primary skill is [`poteto-mode`](./skills/poteto-mode/SKILL.md). It routes investigation, bug fixes, performance work, features, refactoring, prototypes, visual parity, skill authoring and evaluation, PR babysitting and shipping, autonomous runs, project orchestration, two autopilot variants, session pickup, safe pause, planning, and worktree cleanup.

Direct skills include:

- Understanding: [`how`](./skills/how/SKILL.md), [`why`](./skills/why/SKILL.md), [`teach`](./skills/teach/SKILL.md), [`recall`](./skills/recall/SKILL.md).
- Design and review: [`architect`](./skills/architect/SKILL.md), [`arena`](./skills/arena/SKILL.md), [`swarm`](./skills/swarm/SKILL.md), [`interrogate`](./skills/interrogate/SKILL.md), [`blast-radius`](./skills/blast-radius/SKILL.md).
- Execution quality: [`tdd`](./skills/tdd/SKILL.md), [`no-comments`](./skills/no-comments/SKILL.md), [`unslop`](./skills/unslop/SKILL.md), [`technical-writing`](./skills/technical-writing/SKILL.md).
- Memory and customization: [`reflect`](./skills/reflect/SKILL.md), [`automate-me`](./skills/automate-me/SKILL.md), [`show-me-your-work`](./skills/show-me-your-work/SKILL.md).
- Verification: [`create-verification-skill`](./skills/create-verification-skill/SKILL.md), [`maintain-verification-skill`](./skills/maintain-verification-skill/SKILL.md).

See the [Amp guide](./docs/guide/README.md) for the ten-chapter tutorial: setup, poteto-mode, understanding, design, build, verify, overnight work, principles, making it yours, and recipes.

## Development

```bash
bun install
bun test
bun run test:tools
bun run typecheck:tools
amp plugins exec . session.start --data '{"thread":{"id":"T-00000000-0000-0000-0000-000000000000"}}'
```

`bun install` also installs the legacy orchestration and PR-watcher tools under `skills/poteto-mode/scripts`. Bare `bun test`, `bun run test:tools`, and `bun run typecheck:tools` install that package if it is missing, so a fresh clone does not depend on a hidden `node_modules`. Tool typecheck uses that package's `typescript` and `bun-types`, not a global `tsc`.

`amp plugins list` shows the `setup-models` command, the eight pstack tools, the generated `pstack-*` orb adapter modes, and the `poteto` mode. It does not print `export const description`. That string is in `index.ts` and in `package.json`. Thread setup uses `pstack_configure_models` with `action: "profile"` or `pstack:setup-pstack`. The palette command is optional.

## Attribution

This repository preserves the upstream pstack subtree's Git history. The original work is Copyright Lauren Tan and contributors and is licensed under MIT. The Amp port is also MIT licensed. See [`LICENSE`](./LICENSE).
