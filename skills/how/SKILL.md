---
name: how
description: "Only use when named or routed by poteto-mode. Explains subsystem architecture and runtime flow for code walkthroughs and placement, ownership, or layering questions; use why for motivation."
builtin-tools:
  - pstack_run_agent
  - pstack_start_agent
---

# How

Explore the codebase to answer "how does X work?" questions. Produce architectural explanations at the level of a senior engineer onboarding onto a subsystem, enough to build a working mental model, not so much that it reads like annotated source code.

Each spawn below names an Amp role. The plugin resolves its model. `how-explorer` defaults to `xai/grok-4.7`. `how-explainer` defaults to `anthropic/claude-opus-5-5`. A missing role uses that default. If Amp rejects a configured model, report it and stop that spawn. Do not retry the same role with another model on that call. A replacement is a persistent config write. Do it only when the user asks, then reload plugins before the next orb spawn.

## Step 1. Assess Complexity

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

- **Simple** (a single module, a small utility, a narrow question such as "how does function X work"): no explorers. One explainer explores and explains in a single pass. Go to Step 2b.
- **Complex** (a subsystem spanning multiple files or services, a cross-cutting feature, a full architectural overview): spawn parallel explorers first, then hand off to the explainer. Go to Step 2a.

When in doubt, take the simple path.

## Step 2a. Explore (complex questions only)

Decompose the question into 2 to 4 exploration angles, each a distinct slice of the subsystem. Launch all explorers concurrently with `pstack_start_agent`, role `how-explorer` (default `xai/grok-4.7`). Follow `../poteto-mode/references/amp-adapter.md`. Give each explorer a distinct angle and a read-only brief.

Each explorer gets the prompt in `references/explorer-prompt.md` with its angle filled in. Then go to Step 3.

## Step 2b. Direct Explain (simple questions)

Run one `pstack_start_agent` call with role `how-explainer` (default `anthropic/claude-opus-5-5`) and a read-only brief that explores and explains in one pass. Follow `../poteto-mode/references/amp-adapter.md`. Do not write the architecture trace in the parent.

Build its prompt from `references/explainer-prompt.md`. Set its path context to direct exploration and omit the explorer-findings section. Go to Step 4.

## Step 3. Synthesize (complex questions only)

Once all explorers have returned, run one `pstack_start_agent` call with role `how-explainer` (default `anthropic/claude-opus-5-5`) to synthesize their findings into one explanation. Follow `../poteto-mode/references/amp-adapter.md`. Do not write the architecture trace in the parent.

Build its prompt from `references/explainer-prompt.md`. Set its path context to synthesis and fill in every explorer's findings.

## Step 4. Present

Present the explainer's output to the user. Light edits for clarity or context from the conversation are fine. Do not substantially rewrite it.

## Output Format

The explanation uses the sections defined in `references/explainer-prompt.md`, dropping any that do not apply: Overview, Key Concepts, How It Works, Where Things Live, Gotchas.
