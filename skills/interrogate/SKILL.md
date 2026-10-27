---
name: interrogate
description: "Only use when named or routed by poteto-mode. Challenges a change or design with multiple models and keeps only findings proven by a run. Use for adversarial review, stress testing, or finding blind spots."
builtin-tools:
  - pstack_run_panel
---

# Interrogate

Adversaries try to break a change or a design. A finding survives only when a run proves it. Report the findings. Do not apply fixes.

## Frame

The scope is what the user names. Otherwise it is the branch diff from its merge base with the base branch, through the working tree. State the intent with **pstack:in-your-own-words**, from the user's message, the commits, and the PR description. Ask the user when the intent is unclear.

## Fan out

Call `pstack_run_panel` once with panel `interrogate-reviewers`. Follow `../poteto-mode/references/amp-adapter.md` to supply the exact scope, including uncommitted changes, rather than assuming a fresh orb has them. Keep the configured model diversity. If Amp rejects one configured entry, that seat is a terminal dropout. Do not stop the panel. Change model configuration only when the user asks; never retry guessed models.

Amp reviewers remain strict read-only and cannot run shell commands or load skills. The parent owns execution in a disposable worktree of the exact reviewed state; this does not grant reviewers write tools or authorize product fixes. Inline the scope, intent, available run receipts, and this brief in every reviewer prompt:

> Try to break this change. You are strict read-only: do not load skills, run commands, or edit files. Return a concrete repro proposal for each suspected failure, including the exact command or script, the output the intent requires, and why the actual code may differ. Label an unrun proposal as unverified, never as a finding or observed output. Omit style, naming, structure, and risks that need a future change to matter. For a design or plan, propose a bounded prototype or probe of the current tree. No proposals is a valid result.

## Verify

Inspect each proposed command before execution. Run repros against the real code in the disposable worktree, with local test data and within the user's authorization. Do not run a proposal that writes to a shared service without approval. Rerun supplied receipts instead of trusting them. Keep a finding when the output shows the failure and the failure breaks the intent. Drop the rest. Merge findings that share a root cause. Never apply a fix as part of this review.

Skip arena Phases C, D, and E. Adversaries find different failures, so the verdict keeps every verified finding, not one adversary's list.

## Output

- **Intent**: the restatement.
- **Findings**: for each verified finding, the command, its output, how it breaks the intent, and the adversaries that found it. Say "no verified findings" when none survive.
- **Dropped**: for each adversary, the count of dropped findings and why.
- **Unverified**: blocked repros and the missing environment or permission. Do not count them as verified findings or imply that an incomplete review is clean.
