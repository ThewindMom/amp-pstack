---
name: setup-pstack
description: "Configures the Amp models or built-in modes pstack uses for each role and multi-model panel. Use when setting up pstack, changing delegate models, or inspecting the active role map."
builtin-tools:
  - pstack_configure_models
---

# Setup pstack

Read and update pstack's global Amp plugin configuration through `pstack_configure_models`. Skills name roles and panels; the plugin resolves their configured models at each invocation, so changes apply immediately.

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

Call `pstack_configure_models` with `action: "set"` and an `overrides` object containing only the roles the user changed. The tool stores those overrides only and fills unspecified roles from plugin defaults. For a named profile without the command palette, call `action: "profile"` with `balanced`, `builtin`, or `reset`. Unknown actions fail instead of showing the map. The supported defaults are:

```json
{
  "feature-refactoring": "xai/grok-4.6",
  "bug-fix": "openai/gpt-5.6-sol",
  "perf-issue": "openai/gpt-5.6-sol",
  "hillclimb": "openai/gpt-5.6-sol",
  "judgment": "anthropic/claude-fable-5",
  "hardest-tasks": "anthropic/claude-fable-5",
  "how-explorer": "xai/grok-4.6",
  "how-explainer": "anthropic/claude-fable-5",
  "why-investigator": "xai/grok-4.6",
  "why-synthesizer": "anthropic/claude-fable-5",
  "reflect-tooling": "openai/gpt-5.6-sol",
  "reflect-judgment": "anthropic/claude-fable-5",
  "swarm-worker": "xai/grok-4.6",
  "comment-reviewer": "anthropic/claude-fable-5",
  "how-critics": ["anthropic/claude-fable-5", "openai/gpt-5.6-sol", "xai/grok-4.6", "anthropic/claude-opus-5"],
  "arena-runners": ["anthropic/claude-fable-5", "openai/gpt-5.6-sol", "xai/grok-4.6", "anthropic/claude-opus-5"],
  "arena-cross-judge": ["anthropic/claude-opus-5"],
  "architect-runners": ["anthropic/claude-fable-5", "openai/gpt-5.6-sol", "xai/grok-4.6", "anthropic/claude-opus-5"],
  "interrogate-reviewers": ["anthropic/claude-fable-5", "openai/gpt-5.6-sol", "xai/grok-4.6", "anthropic/claude-opus-5"]
}
```

### 6. Confirm

Call `show` once more and report the active map. Re-running this skill updates the same global configuration.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "Want a project-local verification skill so agents can drive the app the way a user does and prove changes work?" On yes, load `pstack:create-verification-skill`. On no, move on without pushing.
