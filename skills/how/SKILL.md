---
name: how
description: "Only use when named or routed by poteto-mode. Explains subsystem architecture and runtime flow for code walkthroughs and placement, ownership, or layering questions; use why for motivation."
builtin-tools:
  - pstack_start_agent
  - wait_for_threads
  - read_thread
---

# How

Explore the codebase to answer "how does X work?" questions. Produce architectural explanations at the level of a senior engineer onboarding onto a subsystem, enough to build a working mental model, not so much that it reads like annotated source code.

Every spawn is a strict read-only `pstack_start_agent` child. Follow `../poteto-mode/references/amp-adapter.md`. Explorers use role `how-explorer` (default `xai/grok-4.7`), and every explainer uses role `how-explainer` (default `anthropic/claude-opus-5-5`). The plugin resolves each role's model. A missing role uses that default. If Amp rejects a configured model, report it and stop that spawn. Do not retry the same role with another model on that call. A replacement is a persistent config write. Do it only when the user asks, then reload plugins before the next orb spawn.

Build every child prompt from the complete reference file, fill every placeholder, and inline it without summary. Explicitly tell each read-only worker not to load skills. Do not write the architecture trace in the parent.

## 1. Assess complexity

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

- **Simple** (a single module, a small utility, a narrow question such as "how does function X work"): no explorers. Spawn one explainer that explores and explains in one pass, built from `references/explainer-prompt.md` with its path context set to direct exploration and without the explorer-findings section. Go to step 4.
- **Complex** (a subsystem spanning multiple files or services, a cross-cutting feature, a full architectural overview): go to step 2.

When in doubt, take the simple path.

## 2. Explore (complex only)

Decompose the question into 2 to 4 angles, each a distinct slice of the subsystem. Launch all explorers concurrently, each with `references/explorer-prompt.md` and its distinct angle filled in.

## 3. Synthesize (complex only)

Once all explorers have returned, spawn one explainer with `references/explainer-prompt.md`, its path context set to synthesis, and every explorer's findings filled in.

## 4. Present

Present the explainer's output. Light edits for clarity or context from the conversation are fine. Do not substantially rewrite it.

## Output format

The explanation uses the sections defined in `references/explainer-prompt.md`, dropping any that do not apply: Overview, Key Concepts, How It Works, Where Things Live, Gotchas.
