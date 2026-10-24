---
name: reflect
description: "Only use when named or routed by poteto-mode. Spawns three parallel reviewers over the active transcript and routes learnings to concrete skill edits for a reflect request."
builtin-tools:
  - pstack_read_current_thread
  - pstack_start_agent
  - wait_for_threads
  - read_thread
---

# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.

Invoke when the user says "reflect" or "/reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Read the active transcript

Call `pstack_read_current_thread` with the largest useful limit. It reads this Amp thread directly, including compacted history. Read its `offset`, `total`, and `truncated` fields. `truncated` means the response is a partial transcript. While `offset + messages.length < total` and the relevant range remains unread, request the next page with `offset` advanced by the number of returned messages. Do not search local transcript caches or unrelated threads. If the tool cannot return the full relevant exchange, write a tight digest of the visible session and label the missing range.

## 2. Spawn three reviewers in parallel

Launch three `pstack_start_agent` calls concurrently. Follow `../poteto-mode/references/amp-adapter.md`. Reviewers keep the available tools to look up the tickets, chat threads, and observability traces the transcript references, but each prompt forbids writes. The parent applies edits.

Each reviewer and the synthesizer name an Amp role. The plugin resolves its model. A missing role uses the default below. If Amp rejects a configured model, report it and stop that spawn. Do not retry the same role with another model on that call. A replacement is a persistent config write. Do it only when the user asks, then reload plugins before the next orb spawn.

| Lens | Role | Default model | Prompt template |
|---|---|---|---|
| Judgment | `reflect-judgment` | `anthropic/claude-opus-5-5` | `references/judgment-reviewer.md` |
| Tooling | `reflect-tooling` | `openai/gpt-6-sol` | `references/tooling-reviewer.md` |
| Divergent | `reflect-divergent` | `anthropic/claude-opus-5-5` | `references/divergent-reviewer.md` |

Pass each complete template verbatim, substituting the transcript JSON or digest where marked, without summarizing it. Explicitly tell these read-only reviewers not to load skills. Reviewers return findings in their result text.

## 3. Synthesize

Run one `pstack_start_agent` call with role `reflect-synthesizer` (default `anthropic/claude-opus-5-5`). Follow `../poteto-mode/references/amp-adapter.md`. It keeps its tools to spot-verify citations, but its prompt forbids writes. Pass `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked, and explicitly tell this read-only worker not to load skills. It returns an Accepted / Rejected / Backlog list.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. See the **encode-lessons-in-structure** principle skill.

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before applying any Accepted edit. The user picks the subset and may redirect routings. Skill changes affect every future agent in the org. Do not auto-apply.

Do not file Backlog items automatically. Offer them and wait for authorization before writing to a shared tracker.

Never edit a loaded plugin or skill cache. Load `building-skills` before preparing edits, and show the writable source repository and path before approval. If a project-local copy under `.agents/skills/` is intended instead, show that destination and scope explicitly. After approval, edit only that source or approved copy, preserving its bundled resources. Reflection approval alone does not authorize opening a PR or pushing; those require separate explicit authorization.

Follow each approved row's Routing exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): load Amp's built-in `building-skills` skill and follow its draft, validation, and reload workflow.
- `tune description: <skill path>`: use `building-skills` and test the trigger wording against positive and negative prompts.
- `new skill: <kebab-name>`: use `building-skills`. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
