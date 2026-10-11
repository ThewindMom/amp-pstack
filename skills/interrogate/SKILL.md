---
name: interrogate
description: "Only use when named or routed by poteto-mode. Runs independent multi-model reviewers for adversarial review, stress testing, challenges, or blind-spot searches."
builtin-tools:
  - pstack_run_panel
---

# Interrogate

Spawn one reviewer per configured model to adversarially review code changes. The adversarial signal comes from model diversity, not assigned personas. The deliverable is a synthesized verdict. Do NOT auto-apply changes.

## Step 1, Scope

Identify what to review from context:

- If the user points at specific files or a diff, use that.
- If on a feature branch, run `git diff main...HEAD` (or the appropriate base branch) for the full changeset.
- If the user's message references recent work, gather the relevant files.

Package the diff or file contents with any surrounding context files the reviewers need to understand the code.

## Step 2, Intent

Before spawning reviewers, state the intent in one clear paragraph from the user's message, commit messages, the PR description if one exists, and the code. If you're unsure about the intent, ask the user before proceeding.

## Step 3, Spawn Reviewers

Call `pstack_run_panel` once with panel `interrogate-reviewers` and the completed reviewer prompt. Follow `../poteto-mode/references/amp-adapter.md`. Reviewers are strict read-only. The plugin runs one reviewer per configured model and labels each result. If the panel is missing, use the table defaults.

| Reviewer | Default model |
|----------|---------------|
| Reviewer A | `anthropic/claude-opus-5-5` |
| Reviewer B | `openai/gpt-6-sol` |
| Reviewer C | `xai/grok-4.7` |

If Amp rejects one configured entry, that seat is a terminal dropout. Complete the remaining reviewers and note the dropout. Do not stop the panel. Do not retry that seat with another model on that call. A replacement is a persistent config write. Do it only when the user asks, through `pstack_configure_models` or **setup-pstack**, using an ID from `amp plugins show-agent-options --json`. Reload plugins before the next orb spawn. Cursor `inherit-parent` and `auto` are not Amp values.

Read `references/reviewer-prompt.md` and fill in the same template for every reviewer with the stated intent, the diff or file contents, the rubric from `references/rubric.md`, and the code-quality lens from `references/code-quality-review.md`. Inline that complete filled template in every reviewer prompt without summarizing it, so every model applies the code-quality lens. Explicitly tell these strict read-only reviewers not to load skills.

## Step 4, Synthesize

As results come back, build a unified picture. Parse every reviewer's findings. Merge findings that describe the same issue differently, and note which models raised each one. Findings two or more models raised independently are the highest signal. Read a lone model's finding, but weight it accordingly. Note disagreements. If one model flags something and another explicitly says the opposite, that is context for the verdict.

## Step 5, Lead Judgment

You are the lead reviewer, a pragmatic senior engineer, not a neutral aggregator. Read `references/lead-judgment.md` for the full framework. Put every finding in one of four buckets, with the model(s) that raised it and a one-line rationale.

- **Act on**. Real issues affecting correctness, security, or maintainability given the actual goals. They would block a real PR.
- **Consider**. Legitimate, but you're not sure they outweigh the cost of addressing them now. Worth the user's attention.
- **Noted**. Technically valid but not actionable. Context-dependent, premature optimization, or low-impact at this stage.
- **Dismissed**. Wrong, nitpicky, or missing context, with a brief reason.

## Output Format

### Intent
> [The stated intent paragraph from Step 2]

### Reviewers
- Reviewer [label]: [model name], [N findings] (one bullet per reviewer)

### Act On
[Each: description, which models raised it, why it matters.]

### Consider
[Each: description, which models raised it, the tradeoff.]

### Noted
[Brief list.]

### Dismissed
[Each with a brief rationale.]

### Agreement Map
[Where models agreed and diverged, and what that pattern tells us.]
