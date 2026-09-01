# Set up pstack

In this page you install the plugin, pick which models pstack uses, and run your first task. Setup is a clone plus a short conversation.

## Install the plugin

Amp's URL installer is for single-file plugins. pstack is a directory plugin. Clone it, then restart Amp.

User install:

```bash
git clone https://github.com/ThewindMom/amp-pstack.git ~/.config/amp/plugins/pstack
```

Workspace install:

```bash
mkdir -p .amp/plugins
git clone https://github.com/ThewindMom/amp-pstack.git .amp/plugins/pstack
```

Confirm it loaded with `amp plugins list`. That listing shows the `setup-models` command, the pstack tools, and the `poteto` mode. It does not print the plugin description. Update with `git -C ~/.config/amp/plugins/pstack pull --ff-only`, or the workspace equivalent.

## Pick your models

Select the `poteto` agent mode, or load `pstack:setup-pstack`. Setup reads `amp plugins show-agent-options --json`, shows each role, and writes only the roles you change through `pstack_configure_models`. Unspecified roles keep the plugin defaults.

You can also call `pstack_configure_models` with `action: "profile"` and `balanced`, `cheap`, `builtin`, or `reset`. `cheap` uses Grok and GPT-5.6 Sol and skips Fable and Opus. For a user or repo file, copy `.amp/pstack.models.example.json` to `~/.config/amp/pstack.models.json` or `.amp/pstack.models.json`. The example overlays `builtin:high` on judgment roles. The command-palette `setup-models` action is the same profiles behind a UI prompt.

A configured `builtin:low`, `builtin:medium`, `builtin:high`, or `builtin:ultra` still runs as a pstack delegate. The plugin extends that Amp mode and keeps the pstack instructions. Feature and refactoring share the `feature-refactoring` role; the playbooks accept the aliases `feature` and `refactoring`.

## Accept the verification offer, or don't

At the end of setup, `pstack:setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`pstack:create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.agents/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can load `pstack:create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md) covers when it earns its place.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
Use pstack:poteto-mode. This command emits two records after a retry. Repro first, then fix and verify.
```

State the outcome and a checkable finish condition. Let poteto-mode select the playbook.

Next: [Route work through poteto-mode](./02-poteto-mode.md).
