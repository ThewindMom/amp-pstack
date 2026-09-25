# Set up pstack

In this page you install the plugin, pick which models pstack uses, and run your first task. Setup is a clone plus a short conversation.

## Install the plugin

Amp's URL installer is for single-file plugins. pstack is a directory plugin. The recommended install is your Amp personal plugins repo, so orbs and other machines see it.

```bash
amp clone user-plugins
rsync -a --delete --exclude .git ./ /path/to/user-plugins/pstack/
cp poteto-mode.ts /path/to/user-plugins/poteto-mode.ts
```

A machine-only clone at `~/.config/amp/plugins/pstack` is optional and beats the personal copy. Do not keep both. Playbooks are files on the loaded skill. After `pstack:poteto-mode` loads, Amp names that skill's base directory. Never `cat ~/.config/amp/plugins/pstack/skills/...` on a personal-plugin install; that path is absent.

Confirm it loaded with `amp plugins list`. A personal copy shows as `amp-global-plugin:pstack`. `poteto-mode.ts` at the user-plugins root registers the `poteto` Dial mode.

## Pick your models

Select the `poteto` agent mode, or load `pstack:setup-pstack`. Setup reads `amp plugins show-agent-options --json`, asks for a reasoning budget, shows each role, and writes only changed roles through `pstack_configure_models`. Unspecified roles keep the plugin defaults. The runtime ignores unknown role keys. Setup does not enumerate them, because `show` already omits them. It does not delete a stored model that is still a current role. The budget changes concrete seat efforts and `builtin:*` aliases without changing model IDs or panel order. It does not parse Cursor thinking slugs.

You can also call `pstack_configure_models` with `action: "profile"` and `balanced`, `cheap`, `builtin`, or `reset`. `cheap` uses Grok and GPT-5.6 Sol and skips Fable and Opus. Balanced defaults use Opus 5.5 and GPT-6 Sol at max effort, and Grok 4.7 at xhigh. A persisted override stays until you change that role. Setup does not delete it, because a stored Fable ID may be a model you chose. A rerun keeps the selected model IDs while applying the requested budget to efforts. For a user or repo file, copy `.amp/pstack.models.example.json` to `~/.config/amp/pstack.models.json` or `.amp/pstack.models.json`. The example overlays `builtin:high` only on judgment. The command-palette `setup-models` action is the same profiles behind a UI prompt. The repo does not ship `pstack.models.json`. A missing plugin file leaves the `index.ts` defaults.

The next local delegate resolves the changed map immediately. Reload plugins before using a changed model or effort in a `parent-project-orb` or `repo-independent-orb` child, because Amp publishes those custom agent definitions when the plugin loads. `native-orb` and `named-runner` redirects select a stable per-role mode instead, and the child orb or runner resolves that mode's model from its own pstack configuration.

A configured `builtin:low`, `builtin:medium`, `builtin:high`, or `builtin:ultra` still runs as a pstack delegate. The plugin extends that Amp mode and keeps the pstack instructions. Feature and refactoring are independently configurable roles. Cursor `inherit-parent` is not an Amp value. Bare Opus 5.5 and GPT-6 Sol seats request max effort, and bare Grok 4.7 seats request xhigh. Explicit per-seat effort overrides the model default. The standalone `grok47-xhigh` mode remains xhigh. Do not use `builtin:high` for GPT-6 Sol. Current builtin high is GPT-6 Astra at medium effort.

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
