---
name: setup-pstack
description: "Configures the Amp models or built-in modes pstack uses for each role and multi-model panel. Use when setting up pstack, changing delegate models, or inspecting the active role map."
builtin-tools:
  - pstack_configure_models
---

# Setup pstack

Read and update pstack's role map through `pstack_configure_models`, plus optional JSON files. Skills name roles and panels. The plugin process resolves models at each invocation, so changes apply to the next local spawn. Amp snapshots custom orb modes at plugin initialization; reload plugins before an orb spawn after changing the map.

## Steps

### 1. Detect available models

Run `amp plugins show-agent-options --json` and use its model IDs. Never configure a model that the command does not list. The aliases `builtin:low`, `builtin:medium`, `builtin:high`, and `builtin:ultra` are always valid and delegate through Amp's corresponding built-in mode.

### 2. Load current state

Call `pstack_configure_models` with `action: "show"`. Treat the returned map as the current choices.

### 3. Map and confirm

Show every role with its current model, marking any ID not in the detected set as needing a choice. Ask whether to accept as-is or change specific roles. For panel roles, the value is a list and one agent runs per entry, so list length sets panel size. `arena-cross-judge` may contain one or more judge models. `swarm-worker` is the default for workers unless a race explicitly uses a panel.

### 4. Validate

Every provider/model ID must be in the detected set. Built-in aliases always pass. If a chosen model is unavailable, stop and ask again.

### 5. Update Amp configuration

Resolution order, later wins:

1. Balanced defaults in `index.ts` (Fable and Opus on judgment and panels).
2. Plugin file `pstack.models.json` next to `index.ts`. This is the live map shipped with the personal plugin. Orbs inherit it.
3. User file `~/.config/amp/pstack.models.json` on that machine.
4. Amp user config from `pstack_configure_models` `set` or `profile`.
5. Workspace file `.amp/pstack.models.json`.

The bundled plugin file is cheap plus Sol builtins and contains no Fable or Opus. Edit that file when the change should follow the plugin. Copy `.amp/pstack.models.example.json` to `~/.config/amp/pstack.models.json` only for a machine-local overlay. `{ "profile": "cheap" }` alone is valid. A JSON file is either a role map or `{ "profile": "cheap", "models": { ... } }`. Cursor `inherit-parent` is invalid here. Raw Grok and raw Sol do not carry Cursor thinking slugs.

Call `pstack_configure_models` with `action: "set"` and an `overrides` object containing only the roles the user changed. For a named profile, call `action: "profile"` with `balanced`, `cheap`, `builtin`, or `reset`. `cheap` uses Grok and GPT-5.6 Sol only. Unknown actions fail instead of showing the map. The supported defaults are:

```json
{
  "feature-refactoring": "xai/grok-4.6",
  "bug-fix": "anthropic/claude-fable-5-1",
  "perf-issue": "anthropic/claude-fable-5-1",
  "hillclimb": "anthropic/claude-fable-5-1",
  "judgment": "anthropic/claude-fable-5-1",
  "how-explorer": "xai/grok-4.6",
  "how-explainer": "anthropic/claude-fable-5-1",
  "why-investigator": "xai/grok-4.6",
  "why-synthesizer": "anthropic/claude-fable-5-1",
  "reflect-tooling": "openai/gpt-5.6-sol",
  "reflect-judgment": "anthropic/claude-fable-5-1",
  "swarm-worker": "xai/grok-4.6",
  "comment-reviewer": "anthropic/claude-fable-5-1",
  "how-critics": ["anthropic/claude-fable-5-1", "openai/gpt-5.6-sol", "xai/grok-4.6", "anthropic/claude-opus-5"],
  "arena-runners": ["anthropic/claude-fable-5-1", "openai/gpt-5.6-sol", "xai/grok-4.6", "anthropic/claude-opus-5"],
  "arena-cross-judge": ["anthropic/claude-opus-5"],
  "architect-runners": ["anthropic/claude-fable-5-1", "openai/gpt-5.6-sol", "xai/grok-4.6", "anthropic/claude-opus-5"],
  "interrogate-reviewers": ["anthropic/claude-fable-5-1", "openai/gpt-5.6-sol", "xai/grok-4.6", "anthropic/claude-opus-5"]
}
```

### 6. Confirm

Call `show` once more and report the active map. Re-running this skill updates the same global configuration. The next local or orb delegate uses the result immediately.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "Want a project-local verification skill so agents can drive the app the way a user does and prove changes work?" On yes, load `pstack:create-verification-skill`. On no, move on without pushing.
