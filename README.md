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

Any role can use a concrete `provider/model` or `builtin:low`, `builtin:medium`, `builtin:high`, or `builtin:ultra`.

## Orbs, modes, and sizes

The plugin agent API can choose local or orb execution and a model or built-in Amp mode. It cannot set an orb size. When size matters, the parent Amp agent should use its native `create_thread` tool with `orb_size` and the requested `agent_mode`, then give the child the same pstack brief. This is the one orchestration setting that cannot be hidden behind a deterministic plugin tool today.

Orb children start from the project's remote base and do not see local uncommitted changes. Use local execution when the current checkout matters. Do not push work only to make it visible to an orb unless the user authorized that push.

## Skills and playbooks

The primary skill is [`poteto-mode`](./skills/poteto-mode/SKILL.md). It routes investigation, bug fixes, performance work, features, refactoring, prototypes, visual parity, skill authoring and evaluation, PR babysitting and shipping, autonomous runs, project orchestration, two autopilot variants, session pickup, safe pause, planning, and worktree cleanup.

Direct skills include:

- Understanding: [`how`](./skills/how/SKILL.md), [`why`](./skills/why/SKILL.md), [`teach`](./skills/teach/SKILL.md), [`recall`](./skills/recall/SKILL.md).
- Design and review: [`architect`](./skills/architect/SKILL.md), [`arena`](./skills/arena/SKILL.md), [`swarm`](./skills/swarm/SKILL.md), [`interrogate`](./skills/interrogate/SKILL.md), [`blast-radius`](./skills/blast-radius/SKILL.md).
- Execution quality: [`tdd`](./skills/tdd/SKILL.md), [`no-comments`](./skills/no-comments/SKILL.md), [`unslop`](./skills/unslop/SKILL.md), [`technical-writing`](./skills/technical-writing/SKILL.md).
- Memory and customization: [`reflect`](./skills/reflect/SKILL.md), [`automate-me`](./skills/automate-me/SKILL.md), [`show-me-your-work`](./skills/show-me-your-work/SKILL.md).
- Verification: [`create-verification-skill`](./skills/create-verification-skill/SKILL.md), [`maintain-verification-skill`](./skills/maintain-verification-skill/SKILL.md).

See the [Amp guide](./docs/guide/README.md) for setup, operation, and limitations.

## Development

```bash
bun install
bun test
bun run test:tools
bun run typecheck:tools
amp plugins exec . session.start --data '{"thread":{"id":"T-00000000-0000-0000-0000-000000000000"}}'
```

## Attribution

This repository preserves the upstream pstack subtree's Git history. The original work is Copyright Lauren Tan and contributors and is licensed under MIT. The Amp port is also MIT licensed. See [`LICENSE`](./LICENSE).
