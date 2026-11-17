### Opening a PR

Invoked at the end of every other playbook.

Work from a git worktree off trunk, and keep unrelated work out of it. Only same-checkout local Amp children inherit that checkout. Orbs need committed inputs or explicit transfers. Never reset or overwrite another actor's work. Rebase into small, landable commits. Before commit, inspect the diff for generated boilerplate, needless wrappers, narration, and scope creep, then apply **unslop** to prose. Run **no-comments** before review.

Title: `type(scope): subject`, naming a real symbol when one carries the change. Body: a one-minute briefing under 40 lines with these `##` headings in order, dropping empty ones: `## Why`, `## What changed`, `## Scope`, `## Tradeoffs` (only rejected alternatives a reviewer would otherwise ask about), `## Blast Radius`, `## Verification`. Put evidence logs and long tables in a linked artifact.

Stack follow-ups by base branch: each child PR targets its parent branch. Default to `gh`, or `origin pr` when Origin's CLI resolves the repository. Never require Graphite (`gt`). Open PRs ready with `gh pr create` without `--draft`, or `origin pr create --status open`, unless the user explicitly asks for a draft. Creating or editing a PR requires explicit user authorization. Opening a PR does not start a babysit.

A child that opens a PR posts the URL and returns to the parent without babysitting, unless it is an Autopilot-full or Autopilot-stack owner. That owner's brief assigns the babysit loop. It starts the loop after its code-ready report and reports merge-ready. Creating, editing, or merging a PR still needs the operator's explicit authorization.
