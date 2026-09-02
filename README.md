# amp-pstack

An Amp-native port of [Lauren Tan's pstack](https://github.com/cursor/plugins/tree/main/pstack). It keeps pstack's 45 skills, 23 engineering playbooks, principles, PR tooling, and dormant Benny workflow while replacing editor-specific orchestration with Amp agents, threads, orbs, schedules, and webhooks.

## Install

Install from GitHub for your Amp user:

```bash
git clone https://github.com/ThewindMom/amp-pstack.git ~/.config/amp/plugins/pstack
```

Install only in the current workspace:

```bash
mkdir -p .amp/plugins
git clone https://github.com/ThewindMom/amp-pstack.git .amp/plugins/pstack
```

Amp's URL installer is for single-file plugins; pstack is a directory plugin because it bundles skills and resources. Restart Amp after cloning, then confirm it loaded with `amp plugins list`. Update it with `git -C ~/.config/amp/plugins/pstack pull --ff-only`, or use the equivalent workspace path.

## Start

Select the `poteto` agent mode, or load `pstack:poteto-mode` in an existing thread. Then state the goal and the evidence that proves it:

```text
Use pstack:poteto-mode. The export writes duplicate rows after a retry. Reproduce it, fix the root cause, and verify the real export.
```

Configure model roles with the `pstack:setup-pstack` skill, the `pstack_configure_models` tool, or the `pstack: setup model profile` command.

## What the Amp port adds

- **Selectable mode.** `poteto` extends Amp's medium mode with pstack routing and principles.
- **45 registered skills.** Invoke them with qualified names such as `pstack:how`, `pstack:arena`, `pstack:recall`, and `pstack:reflect`.
- **Role-based agents.** `pstack_run_agent` maps feature, bug, performance, investigation, and judgment roles to configurable models.
- **Multi-model panels.** `pstack_run_panel` runs arena, architect, critique, and interrogate briefs concurrently across model families.
- **Durable child threads.** `pstack_start_agent` launches background local or orb work. Children can report to any known parent through `pstack_send_to_thread`.
- **Thread-native memory.** Reflection reads the current transcript directly. Recall and personal-mode mining use Amp's thread search and full thread reader.
- **Long-running work.** Playbooks use Amp child threads, schedules, and capability webhooks instead of editor polling commands.
- **External wakeups.** `pstack_create_wake_webhook` creates an at-least-once webhook that wakes its owning orb thread.
- **Existing tools.** The Graphite orchestration ledger and GitHub PR watcher remain executable Bun tools.

## Agent and panel defaults

| Purpose | Default |
|---|---|
| Feature and refactoring | `xai/grok-4.6` |
| Bugs, performance, hillclimbing | `openai/gpt-5.6-sol` |
| Judgment and synthesis | `anthropic/claude-fable-5` |
| Panels | Fable 5, GPT-5.6 Sol, Grok 4.6, Opus 5 |

Any role can use a concrete `provider/model` or `builtin:low`, `builtin:medium`, `builtin:high`, or `builtin:ultra`. A model ID picks the weights only. A builtin mode picks Amp's prompt, tools, default model, and thinking. `builtin:medium` is Sol at med. `builtin:high` is Sol at x-high. `builtin:ultra` is Fable 5.1. Cursor thinking slugs such as `grok-4.6-fast-xhigh` and `gpt-5.6-sol-max` do not exist in Amp. Raw `xai/grok-4.6` does not pass `reasoningEffort`; Amp lists Grok with an empty efforts array, and xAI then defaults to high. Raw `openai/gpt-5.6-sol` also has no thinking override. Cursor `inherit-parent` and `auto` are not Amp aliases.

To skip Fable and Opus, copy [`.amp/pstack.models.example.json`](./.amp/pstack.models.example.json) to `~/.config/amp/pstack.models.json` for yourself, or to `.amp/pstack.models.json` in a repo. `.amp/pstack.models.json` is gitignored. The example is the file you copy, not a file you commit as the live map.

The example is cheap plus Amp high on the old Fable roles:

```json
{
  "profile": "cheap",
  "models": {
    "arena-cross-judge": ["builtin:high"],
    "judgment": "builtin:high",
    "how-explainer": "builtin:medium",
    "why-synthesizer": "builtin:high",
    "reflect-judgment": "builtin:high",
    "comment-reviewer": "builtin:medium"
  }
}
```

Cheap puts Grok on mechanical work and Sol on specified code. Panels become two models, Grok then Sol. The overlays move judgment onto Sol at x-high. `{ "profile": "cheap" }` alone is valid and cheaper, but parks prose on Grok.

Later wins: plugin defaults, user JSON, Amp user config from `set`/`profile`, then the workspace file. A committed workspace file is project policy and beats leftover palette config. Reset clears only Amp user config. Repo and user JSON stay. The plugin process reads the files and creates delegates with the resolved map, so orb children inherit it.

A panel value is a JSON array. List length is how many agents `pstack_run_panel` runs. Cheap already uses two. Add a third ID only if you want a third seat.

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
