---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
builtin-tools:
  - pstack_read_current_thread
  - pstack_run_agent
  - pstack_start_agent
---

# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.

## When to invoke

- The user said "reflect" or "/reflect".
- A complex task (5+ tool calls) just landed cleanly and the recipe is worth keeping.
- The agent hit dead ends, found the working path, and the path generalizes.
- The user corrected the agent's approach mid-task.
- A non-trivial workflow emerged that isn't captured anywhere.

Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## Process

### 1. Read the active transcript

Call `pstack_read_current_thread` with the largest useful limit. It reads this Amp thread directly, including compacted history. Do not search local transcript caches or unrelated threads. If the tool cannot return the full relevant exchange, write a tight digest of the visible session and label the missing range.

### 2. Spawn three reviewers in parallel

Launch three `pstack_start_agent` calls concurrently. Keep each `threadID` and join on the reports. Reviewers need the available tools for context lookups, but each prompt forbids writes; the parent applies edits.

| Lens | `model` | Prompt template |
|---|---|---|
| Judgment | `reflect-judgment` | `references/judgment-reviewer.md` |
| Tooling | `reflect-tooling` | `references/tooling-reviewer.md` |
| Divergent | `reflect-judgment` | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the transcript JSON or digest where marked. Reviewers return findings in their result text.

### 3. Synthesize

Run one `pstack_start_agent` call with role `reflect-judgment`. Join on the report. Use `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. The synthesizer returns a structured Accepted / Rejected / Backlog list.

### 4. Structural enforcement check

Sanity-check the synthesizer's Accepted list. For any item that would be enforced more reliably by a lint rule, script, metadata flag, or runtime check, move it from Accepted to Backlog. The synthesizer already applies this criterion; this is a final pass before edits land. See the **encode-lessons-in-structure** principle skill.

### 5. Apply

Before applying any Accepted edit, present the synthesizer's full Accepted/Rejected/Backlog output to the user and wait for explicit approval. The user picks which subset to apply and may redirect routings. Skill changes affect every future agent in the org; do not auto-apply.

Do not file Backlog items automatically. Offer them and wait for authorization before writing to a shared tracker.

For each approved Accepted item, follow the Routing field exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): parent does directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): load Amp's built-in `building-skills` skill and follow its draft, validation, and reload workflow.
- `tune description: <skill path>`: use `building-skills` and test the trigger wording against positive and negative prompts.
- `new skill: <kebab-name>`: use `building-skills`. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done. Skip this step if it doesn't.

### 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
