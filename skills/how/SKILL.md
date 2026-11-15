---
name: how
description: "Only use when named or routed by poteto-mode. Explains subsystem architecture and runtime flow for code walkthroughs and placement, ownership, or layering questions; use why for motivation."
builtin-tools:
  - pstack_start_agent
  - wait_for_threads
  - read_thread
---

# How

Explore the codebase to answer "how does X work?" questions.

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

## 1. Explain

Launch one strict read-only `pstack_start_agent` child with role `how-explainer` that explores and explains in one pass. Follow `../poteto-mode/references/amp-adapter.md`. The plugin resolves the role's model. If Amp rejects a configured model, report it and stop. A replacement is a persistent config write. Do it only when the user asks, then reload plugins before the next orb spawn. Give the child the user's question and this brief, and tell it not to load skills:

> You are writing an architectural explanation for a senior engineer. Explore the codebase and write an explanation that a senior engineer unfamiliar with this area could read and walk away with a solid mental model. They should understand the architecture well enough to start working in it confidently. You have read-only access to the codebase. Draw any diagram as a plain-text block; use Mermaid only when the user asks for it.

## 2. Present

Present the child's output. Light edits for clarity or context from the conversation are fine. Do not substantially rewrite it.
