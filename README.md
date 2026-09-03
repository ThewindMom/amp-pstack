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

- **Selectable mode.** [`poteto-mode.ts`](./poteto-mode.ts) is a root-level single-file plugin so Amp's Mode Dial can list it next to Grok 4.6. It copies official `grok46`: explicit `xai/grok-4.6`, ultra prompt, ultra tools, high effort, no `extends`. pstack routing is appended to that prompt. `extends: 'ultra'` was tried and a live poteto thread still ran GPT-5.6 Sol. The `pstack/` directory plugin still owns skills and tools. Do not also register `poteto` from `index.ts`, or the key collides.
- **45 registered skills.** Invoke them with qualified names such as `pstack:how`, `pstack:arena`, `pstack:recall`, and `pstack:reflect`.
- **Role-based agents.** `pstack_run_agent` maps feature, bug, performance, investigation, and judgment roles to configurable models. `comment-reviewer` is terminal and report-only. It can run read-only git. It cannot load skills or spawn agents. Callers should omit `timeoutMs`. The plugin floors every one-shot agent and panel at ten minutes, so a 120s or 240s caller cannot kill `how-explainer` or `feature-refactoring`. Playbooks are files on the loaded skill, not `~/.config/amp/plugins/pstack`.
- **Multi-model panels.** `pstack_run_panel` runs arena, architect, critique, and interrogate briefs concurrently across model families.
- **Durable child threads.** `pstack_start_agent` launches background local or orb work. Children can report to any known parent through `pstack_send_to_thread`.
- **Thread-native memory.** Reflection reads the current transcript directly. Recall and personal-mode mining use Amp's thread search and full thread reader.
- **Long-running work.** Playbooks use Amp child threads, schedules, and capability webhooks instead of editor polling commands.
- **External wakeups.** `pstack_create_wake_webhook` creates an at-least-once webhook that wakes its owning orb thread.
- **Existing tools.** The Graphite orchestration ledger and GitHub PR watcher remain executable Bun tools.

## Agent and panel defaults

`poteto` is official `grok46` plus pstack. Same explicit Grok model, ultra prompt, and ultra tools. Playbook routing is in the prompt. It does not use medium's Sol prompt and does not `extends: 'ultra'`, which kept Sol in a live thread. Official `grok46` still does not load poteto-mode by itself.

Code in `index.ts` still has Cursor-shaped **balanced** defaults (Fable 5.1 and Opus on judgment and panels). The live map for this plugin is [`pstack.models.json`](./pstack.models.json), shipped inside the plugin directory. Orbs and other machines that load the personal plugin get that file. They do not get `~/.config/amp/pstack.models.json` unless that file also exists there.

The bundled file is cheap plus Sol builtins. No Fable. No Opus.

| Seat | Bundled map |
|---|---|
| Parent `poteto` | explicit `xai/grok-4.6` high, ultra prompt/tools |
| Feature, how-explorer, why-investigator, swarm-worker | `xai/grok-4.6` |
| Bugs, performance, hillclimb, reflect-tooling | `builtin:medium` (Sol, med) |
| Judgment, how-explainer, why-synthesizer, reflect-judgment, comment-reviewer | `builtin:high` (Sol, x-high) |
| Panels | high, medium, Grok |

Any role can use a concrete `provider/model` or `builtin:low`, `builtin:medium`, `builtin:high`, or `builtin:ultra`. A model ID picks the weights only. A builtin mode picks Amp's prompt, tools, default model, and thinking. `builtin:medium` is Sol at med. `builtin:high` is Sol at x-high. `builtin:ultra` is Fable 5.1. Cursor thinking slugs such as `grok-4.6-fast-xhigh` and `gpt-5.6-sol-max` do not exist in Amp. Raw `xai/grok-4.6` does not pass `reasoningEffort`; Amp lists Grok with an empty efforts array, and xAI then defaults to high. Raw `openai/gpt-5.6-sol` also has no thinking override. Cursor `inherit-parent` and `auto` are not Amp aliases.

Later wins:

1. Balanced defaults in `index.ts`.
2. Plugin file `pstack.models.json` next to `index.ts`. This is the live personal-plugin map.
3. User file `~/.config/amp/pstack.models.json` on that machine.
4. Amp user config from `pstack_configure_models` `set` or `profile`.
5. Workspace file `.amp/pstack.models.json` in the current repo.

A workspace file is project policy and beats leftover palette config. Reset clears only Amp user config. The plugin JSON, user JSON, and workspace JSON stay. Orb children inherit the plugin file because it travels with the plugin. They do not inherit a machine-local user JSON.

To change the map that orbs see, edit [`pstack.models.json`](./pstack.models.json), push GitHub, then copy the tree into your Amp user-plugins repo and push that too. GitHub push alone does not update personal plugins.

[`.amp/pstack.models.example.json`](./.amp/pstack.models.example.json) is a smaller cheap-plus-high sketch for a machine-local overlay. `.amp/pstack.models.json` is gitignored. `{ "profile": "cheap" }` alone is valid and cheaper, but parks prose on Grok.

A panel value is a JSON array. List length is how many agents `pstack_run_panel` runs. The bundled file uses three seats. Add another ID only if you want another seat.

## Orbs, modes, and sizes

The plugin agent API can choose local or orb execution and a model or built-in Amp mode. It cannot set an orb size. `pstack:poteto-mode` maps work to `a1.tiny` through `a1.xxlarge` and tells the parent to use native `create_thread` when that size differs from the project default. A user-named size always wins.

Orb children start from the project's remote base and do not see local uncommitted changes. Use local execution when the current checkout matters. Do not push work only to make it visible to an orb unless the user authorized that push.

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

`bun install` also installs the Graphite and PR-watcher tools under `skills/poteto-mode/scripts`. Bare `bun test`, `bun run test:tools`, and `bun run typecheck:tools` install that package if it is missing, so a fresh clone does not depend on a hidden `node_modules`. Tool typecheck uses that package's `typescript` and `bun-types`, not a global `tsc`.

`amp plugins list` shows the `setup-models` command, the seven pstack tools, and the `poteto` mode. It does not print `export const description`. That string is in `index.ts` and in `package.json`. Thread setup uses `pstack_configure_models` with `action: "profile"` or `pstack:setup-pstack`. The palette command is optional.

## Attribution

This repository preserves the upstream pstack subtree's Git history. The original work is Copyright Lauren Tan and contributors and is licensed under MIT. The Amp port is also MIT licensed. See [`LICENSE`](./LICENSE).
