---
name: setup-pstack
description: "Configures the Amp models or built-in modes pstack uses for each role and multi-model panel, including a reasoning budget. Use when setting up pstack, changing delegate models, picking a pstack budget, or inspecting the active role map."
builtin-tools:
  - pstack_configure_models
---

# Setup pstack

Read and update pstack's role map through `pstack_configure_models`, plus optional JSON files. Skills name roles and panels. The plugin process resolves models at each invocation, so changes apply to the next local spawn. Amp snapshots custom orb modes at plugin initialization; reload plugins before an orb spawn after changing the map.

## Steps

### 1. Detect available models

Run `amp plugins show-agent-options --json`. Treat each entry's `id` and `capabilities.efforts` as the runtime capability table. Never configure a concrete model or effort that the command does not list. The aliases `builtin:low`, `builtin:medium`, `builtin:high`, and `builtin:ultra` are always valid and delegate through Amp's corresponding built-in mode; builtin aliases never carry a separate effort.

### 2. Load current state

Call `pstack_configure_models` with `action: "show"`. Treat the returned map as the current choices. The runtime already ignores unknown role keys, and `show` does not return them. Setup does not enumerate those keys and does not read raw config to find them. Do not delete a stored Fable ID that is still a current role. That may be a chosen model.

### 3. Budget, map, and confirm

**(a) Ask for a budget.** Offer these four options with these exact labels, and name the current builtin mix when the live map already uses builtins.

- `unlimited — highest supported`
- `large — xhigh reasoning`
- `medium — high reasoning`
- `small — medium reasoning`

Amp has no Cursor thinking slugs (`-thinking-max`, `-fast-xhigh`). Each seat is either a concrete string, `{ "model": "provider/model", "effort": "..." }`, or a builtin alias string. Preserve every seat's model ID and panel ordering. For concrete seats, `unlimited` selects the highest supported effort in that model's runtime capability list; `large`, `medium`, and `small` target `xhigh`, `high`, and `medium`, respectively, then cap to the highest supported effort at or below that target on `max > xhigh > high > medium > low > minimal > none`. If the capability list is empty, preserve the seat without an effort. For builtins, map `unlimited` and `large` to `builtin:ultra`, `medium` to `builtin:high`, and `small` to `builtin:medium`. Cursor `inherit-parent` and `auto` stay invalid.

**(b) Apply it.** Build the working table from the skill defaults, then overlay the live `show` map. Keep user-selected model IDs, panel lengths, and seat ordering; a budget changes only effort or the builtin alias. Represent a concrete seat with an explicit effort as `{ "model": "provider/model", "effort": "high" }`. Compute the final value for every seat before writing.

**(c) Show the roles and confirm.** Show every role `show` returned, with its model, marking any ID not in the detected set as needing a choice. Do not list retired keys. `show` already omitted them. Ask whether to accept as-is or change specific roles. Prefer a structured choice when the client supports one. Offer the detected models plus the built-in aliases. For panel roles, the value is a list and one agent runs per entry, so list length sets panel size. `arena-cross-judge` is a pool: one judge runs, preferring a known model family different from the parent and otherwise using the first entry. `swarm-worker` is the default for workers unless a race explicitly uses a panel.

### 4. Validate

Every provider/model ID must be in the detected set, and every explicit effort must appear in that model's detected capability list. Built-in aliases always pass but cannot carry an effort. If a chosen model or effort is unavailable, stop and ask again.

### 5. Update Amp configuration

Resolution order, later wins:

1. Balanced defaults in `index.ts`, with explicit per-role efforts across Opus 5.5, GPT-5.6 Luna and Sol, GPT-6 Astra, and Grok 4.7. The repo does not ship `pstack.models.json`.
2. Optional plugin file `pstack.models.json` next to `index.ts`, only if someone adds one. A missing file leaves the defaults. Orbs inherit the plugin code.
3. User file `~/.config/amp/pstack.models.json` on that machine.
4. Amp user config from `pstack_configure_models` `set` or `profile`.
5. Workspace file `.amp/pstack.models.json`.

A persisted override stays until the user changes that role. Setup does not delete it, because a stored Fable ID may be a chosen model rather than an old default. A rerun keeps any role whose model differs from the current default. Copy `.amp/pstack.models.example.json` to `~/.config/amp/pstack.models.json` only for a machine-local overlay. `{ "profile": "cheap" }` alone is valid. A JSON file is either a role map or `{ "profile": "cheap", "models": { ... } }`. Cursor `inherit-parent` is invalid here. Balanced seats carry explicit per-role effort. Bare shipped-model seats use the fallback in `MODEL_REASONING_EFFORT`; an explicit per-seat effort selected by the budget overrides it.

The `how-explorer` agent definition requires Amp's premium `fast` serving feature independently of its configured model and effort. Model setup does not add or remove that role feature.

Call `pstack_configure_models` with `action: "set"` exactly once and an `overrides` object containing every role whose final seat value differs from live `show`, including budget effort changes. Do not set the same role in multiple calls. If no role changed, do not call `set`. For a named profile, call `action: "profile"` with `balanced`, `cheap`, `builtin`, or `reset` instead. `cheap` uses Grok and GPT-5.6 Sol only. Unknown actions fail instead of showing the map. The supported defaults are:

```json
{
  "hardest": { "model": "openai/gpt-6-astra", "effort": "high" },
  "feature": { "model": "xai/grok-4.7", "effort": "xhigh" },
  "refactoring": { "model": "openai/gpt-5.6-sol", "effort": "high" },
  "bug-fix": { "model": "xai/grok-4.7", "effort": "xhigh" },
  "perf-issue": { "model": "openai/gpt-6-astra", "effort": "high" },
  "hillclimb": { "model": "xai/grok-4.7", "effort": "xhigh" },
  "judgment": { "model": "anthropic/claude-opus-5-5", "effort": "high" },
  "how-explorer": { "model": "openai/gpt-5.6-luna", "effort": "low" },
  "how-explainer": { "model": "anthropic/claude-opus-5-5", "effort": "medium" },
  "why-investigator": { "model": "xai/grok-4.7", "effort": "xhigh" },
  "why-synthesizer": { "model": "anthropic/claude-opus-5-5", "effort": "medium" },
  "reflect-tooling": { "model": "openai/gpt-5.6-sol", "effort": "high" },
  "reflect-judgment": { "model": "anthropic/claude-opus-5-5", "effort": "high" },
  "reflect-divergent": { "model": "anthropic/claude-opus-5-5", "effort": "medium" },
  "reflect-synthesizer": { "model": "anthropic/claude-opus-5-5", "effort": "high" },
  "swarm-worker": { "model": "xai/grok-4.7", "effort": "xhigh" },
  "comment-reviewer": { "model": "anthropic/claude-opus-5-5", "effort": "medium" },
  "arena-runners": [{ "model": "anthropic/claude-opus-5-5", "effort": "high" }, { "model": "openai/gpt-5.6-sol", "effort": "high" }, { "model": "xai/grok-4.7", "effort": "xhigh" }],
  "arena-cross-judge": [{ "model": "anthropic/claude-opus-5-5", "effort": "high" }, { "model": "openai/gpt-5.6-sol", "effort": "high" }, { "model": "xai/grok-4.7", "effort": "xhigh" }],
  "architect-runners": [{ "model": "anthropic/claude-opus-5-5", "effort": "high" }, { "model": "openai/gpt-6-astra", "effort": "high" }, { "model": "xai/grok-4.7", "effort": "xhigh" }],
  "interrogate-reviewers": [{ "model": "anthropic/claude-opus-5-5", "effort": "high" }, { "model": "openai/gpt-5.6-sol", "effort": "high" }, { "model": "xai/grok-4.7", "effort": "xhigh" }]
}
```

### 6. Confirm

Call `show` once more and report the active map. Re-running this skill updates the same global configuration. The next local delegate uses the result immediately; an orb or runner delegate requires a plugin reload first.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "Want a project-local verification skill so agents can drive the app the way a user does and prove changes work?" On yes, load `pstack:create-verification-skill`. On no, move on without pushing.
