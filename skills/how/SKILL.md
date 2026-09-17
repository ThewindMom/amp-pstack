---
name: how
description: "Use for \"how does X work\", code walkthroughs before changing something, and placement / ownership / layering questions (\"where should this live\", \"which package owns this\", \"is this the right layer\"). Explains subsystem architecture, runtime flow, onboarding mental models. Use why for motivation."
builtin-tools:
  - pstack_run_agent
  - pstack_start_agent
---

# How

Explore the codebase to answer "how does X work?" questions. Produce architectural explanations at the level of a senior engineer onboarding onto a subsystem, enough to build a working mental model, not so much that it reads like annotated source code.

## Step 1. Assess Complexity

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

- **Simple** (a single module, a small utility, a narrow question such as "how does function X work"): no explorers. One explainer explores and explains in a single pass. Go to Step 2b.
- **Complex** (a subsystem spanning multiple files or services, a cross-cutting feature, a full architectural overview): spawn parallel explorers first, then hand off to the explainer. Go to Step 2a.

When in doubt, take the simple path.

## Step 2a. Explore (complex questions only)

Decompose the question into 2 to 4 exploration angles, each a distinct slice of the subsystem.

Launch all explorers concurrently with `pstack_start_agent`, role `how-explorer`. Route from the parent executor first. An orb parent defaults each explorer to `parent-project-orb`. From a local parent, use `current-checkout` when the explanation needs local or uncommitted state and `parent-project-orb` for the clean project remote. If the question depends on live changes inside a parent orb, keep the inspection in that parent or transfer a bounded fixture. A fresh child orb cannot read those files. Give each explorer a distinct angle and a read-only brief. Keep each `threadID`. Each child exclusively owns its slice. Continue independent parent work, then end the turn when the reports block further progress. Do not call `wait_for_threads` to judge startup. Join on each child's `pstack_send_to_thread` report. Do not call `pstack_run_agent` for explorers. Never re-trace or replace a live child's slice in the parent. The plugin resolves the configured model.

Each explorer gets the prompt in `references/explorer-prompt.md` with its angle filled in. Then go to Step 3.

## Step 2b. Direct Explain (simple questions)

Run one `pstack_start_agent` call with role `how-explainer` and a read-only brief that explores and explains in one pass. Use the same parent-executor routing as Step 2a. Keep the `threadID`. Join on the report. Do not call `pstack_run_agent` for this step. Do not write the architecture trace in the parent unless live parent-orb files make a child inaccurate and cannot be transferred.

Build its prompt from `references/explainer-prompt.md` without the explorer-findings section. Go to Step 4.

## Step 3. Synthesize (complex questions only)

Once all explorers return, run one `pstack_start_agent` call with role `how-explainer` to synthesize their findings into one coherent explanation. Join on that report. Do not write the architecture trace in the parent.

Build its prompt from `references/explainer-prompt.md` with every explorer's findings filled in.

## Step 4. Present

Present the explainer's output to the user. Light edits for clarity or context from the conversation are fine. Do not substantially rewrite it.

## Output Format

The explanation uses the sections defined in `references/explainer-prompt.md`, dropping any that do not apply: Overview, Key Concepts, How It Works, Where Things Live, Gotchas.
