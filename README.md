# amp-pstack

An Amp-native port of [Lauren Tan's pstack](https://github.com/cursor/plugins/tree/main/pstack). It keeps pstack's 45 skills, 23 engineering playbooks, principles, PR tooling, and dormant Benny workflow while replacing editor-specific orchestration with Amp agents, threads, orbs, schedules, and webhooks.

## Install

pstack is a directory plugin. Amp's URL installer (`amp plugins add`) only accepts a single `.ts` file, so do not use it here.

**Personal plugins (recommended).** This loads on every machine and in orbs. Clone your Amp user-plugins repo, copy this tree in as `pstack/`, and copy [`poteto-mode.ts`](./poteto-mode.ts) to the **root** of that repo (next to `pstack/`, not inside it). Amp's Mode Dial catalog only lists root-level `.ts` plugins, which is why `Grok 4.6` appears and `poteto` did not.

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

- **Selectable mode.** [`poteto-mode.ts`](./poteto-mode.ts) is a root-level single-file plugin so Amp's Mode Dial can list it. It `extends: 'high'`: Amp's high-mode parent, Amp tools, pstack routing. It does not pin Grok and does not copy ultra tools (`painter`, `public_artifact_url`). Grok stays on feature/how/swarm workers. Official `grok46` is a different mode and does not load this skill. The `pstack/` directory plugin still owns skills and tools. Do not also register `poteto` from `index.ts`, or the key collides.
- **45 registered skills.** Invoke them with qualified names such as `pstack:how`, `pstack:arena`, `pstack:recall`, and `pstack:reflect`.
- **Role-based agents.** Cursor backgrounds every Task. Amp's unit is the thread. Default long work (`feature`, `how`, `bug-fix`, and the rest of the playbooks) uses `pstack_start_agent`. Implementation starts need a non-empty `scope`. A local parent defaults to `current-checkout`. An orb parent defaults to a fresh child orb that inherits the parent project. It returns `threadID` immediately. The child exclusively owns its delegated scope and reports with `pstack_send_to_thread` (steer defaults on). The parent keeps doing independent work and ends the turn when the child blocks further progress. Never use `wait_for_threads` to judge startup. Amp can report `unknown` or `settled` on an empty child while it starts. Never redo or replace a live child. `pstack_run_agent` waits. Use it only when this turn cannot proceed without one result, such as comment-reviewer. Timeout still returns `threadID`. Read the child. Callers omit `timeoutMs`. The wait floor is ten minutes.
- **Multi-model panels.** `pstack_run_panel` waits for arena, architect, critique, and interrogate seats. Keep it for ranking that this turn needs now.
- **Durable child threads.** `pstack_start_agent` launches background local or orb work. Children report through `pstack_send_to_thread`. The parent can steer a live child with the same tool. Children do not talk to siblings; the parent relays. Only same-machine local parent and local child share the checkout. If either thread is an orb, transfer files with `upload_thread_file` / `download_thread_file` (4 MiB), same as local-parent / orb-child. Two orbs do not share a disk. Need a URL: `thread_file_url`.
- **Thread-native memory.** Reflection reads the current transcript directly. Recall and personal-mode mining use Amp's thread search and full thread reader.
- **Long-running work.** Playbooks use Amp child threads, schedules, and capability webhooks instead of editor polling commands.
- **External wakeups.** `pstack_create_wake_webhook` creates an at-least-once webhook that wakes its owning orb thread.
- **Existing tools.** The legacy orchestration ledger and GitHub PR watcher remain executable Bun tools. Current PR playbooks use forge-neutral base-branch stacks and do not require Graphite.

## Agent and panel defaults

`poteto` is builtin high plus pstack. Amp selects the parent model and reasoning effort; pstack supplies playbook routing. Official `grok46` still does not load poteto-mode by itself. High is the coordinator. Grok is the worker.

Code in `index.ts` still has Cursor-shaped **balanced** defaults (Fable 5.1 and Opus on judgment and panels). The live map for this plugin is [`pstack.models.json`](./pstack.models.json), shipped inside the plugin directory. Orbs and other machines that load the personal plugin get that file. They do not get `~/.config/amp/pstack.models.json` unless that file also exists there.

The bundled file uses high for coding fixes, medium for tooling reflection, and distinct high/medium/Grok panel seats. No direct Fable or Opus assignments.

| Seat | Bundled map |
|---|---|
| Parent `poteto` | `extends: high` (Amp-selected model and reasoning effort) |
| Feature, how-explorer, why-investigator, swarm-worker | `xai/grok-4.6` |
| Bugs, performance, hillclimb | `builtin:high` |
| reflect-tooling | `builtin:medium` |
| Judgment, how-explainer, why-synthesizer, reflect-judgment, comment-reviewer | `builtin:high` |
| Panels | high, medium, Grok |

Any role can use a concrete `provider/model` or `builtin:low`, `builtin:medium`, `builtin:high`, or `builtin:ultra`. A model ID picks the weights only. A builtin mode picks Amp's prompt, tools, default model, and thinking. Amp controls these mappings; see [Modes & Models](https://ampcode.com/modes) for current models and reasoning efforts. Cursor thinking slugs such as `grok-4.6-fast-xhigh` and `gpt-5.6-sol-max` do not exist in Amp. Raw `xai/grok-4.6` does not pass `reasoningEffort`; Amp lists Grok with an empty efforts array, and xAI then defaults to high. Raw `openai/gpt-5.6-sol` also has no thinking override. Cursor `inherit-parent` and `auto` are not Amp aliases.

Later wins:

1. Balanced defaults in `index.ts`.
2. Plugin file `pstack.models.json` next to `index.ts`. This is the live personal-plugin map.
3. User file `~/.config/amp/pstack.models.json` on that machine.
4. Amp user config from `pstack_configure_models` `set` or `profile`.
5. Workspace file `.amp/pstack.models.json` in the current repo.

A workspace file is project policy and beats leftover palette config. Reset clears only Amp user config. The plugin JSON, user JSON, and workspace JSON stay. Orb children inherit the plugin file because it travels with the plugin. They do not inherit a machine-local user JSON.

Every delegate resolves this stack on every spawn. Amp requires custom orb modes to be active before a tool runs, so pstack registers the current role/model map when the plugin loads and keeps those exact Agents active for the process lifetime. Local launches still create an unregistered Agent from the latest configuration. After changing the map, local launches use it immediately; reload plugins before the next orb launch so Amp can publish the new modes.

To change the map that orbs see, edit [`pstack.models.json`](./pstack.models.json), push GitHub, then copy the tree into your Amp user-plugins repo and push that too. GitHub push alone does not update personal plugins.

[`.amp/pstack.models.example.json`](./.amp/pstack.models.example.json) is a smaller cheap-plus-high sketch for a machine-local overlay. `.amp/pstack.models.json` is gitignored. `{ "profile": "cheap" }` alone is valid and cheaper, but parks prose on Grok.

A panel value is a JSON array. List length is how many agents `pstack_run_panel` runs. The bundled file uses three seats. Add another ID only if you want another seat.

## Orbs, modes, and sizes

`pstack_start_agent` takes a discriminated `launchTarget`. The plugin reads `amp.system.executor.kind` before it routes. A local parent defaults implementation to `current-checkout`. An orb parent defaults every plugin child to `parent-project-orb`; the child gets a fresh orb under the parent project. The plugin rejects `current-checkout` and `executor: "local"` from an orb parent because neither can target the parent orb's filesystem. A local parent can choose `parent-project-orb` for clean work from the project remote. `repo-independent-orb` is for work that does not depend on a checkout. `native-orb` requires `project` and returns a complete native `create_thread` redirect for project, orb size, or custom mode. It keeps the registered pstack mode key unless `agentMode` is set; that explicit override also gives up the pstack role's model, instructions, and tool policy. A required `arena-cross-judge` cannot override that mode. Amp has no `cloudBaseBranch`. Arbitrary native threads bypass the live implementation-owner guard.

Every child orb starts from the project remote. It does not receive the parent orb's live filesystem. Keep dependent work in the parent thread, or transfer the required files before the child starts. From a local parent, use `current-checkout` for uncommitted files, local services, simulators, devices, or machine-only credentials. Use an orb for clean, independent work. Do not push only to make a file visible to an orb unless the user authorized that push.

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

`amp plugins list` shows the `setup-models` command, the seven pstack tools, the generated `pstack-*` orb adapter modes, and the `poteto` mode. It does not print `export const description`. That string is in `index.ts` and in `package.json`. Thread setup uses `pstack_configure_models` with `action: "profile"` or `pstack:setup-pstack`. The palette command is optional.

## Attribution

This repository preserves the upstream pstack subtree's Git history. The original work is Copyright Lauren Tan and contributors and is licensed under MIT. The Amp port is also MIT licensed. See [`LICENSE`](./LICENSE).
