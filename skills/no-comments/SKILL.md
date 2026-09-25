---
name: no-comments
description: "Only use when named or routed by poteto-mode. Spawns Comment Sicko, fixes accepted findings, and offers structural encodings when auditing comments and claimed constraints."
builtin-tools:
  - pstack_run_agent
  - pstack_start_agent
  - pstack_send_to_thread
---

# No comments

Spawn Comment Sicko. Act on accepted findings.

Defer to Comment Sicko's fresh perspective.

## Scope

Use the caller's files or diff. Otherwise use the current diff against the base branch, default `main`, including the working tree.

## Steps

1. In the parent, resolve the requested scope. For a diff review, prepare an exact scoped diff snapshot: include base-to-current tracked changes (so committed and working-tree changes are represented) plus relevant untracked files, write it as a readable patch artifact, and record the scoped file paths. For an explicit whole-file review, use the caller's named files instead. Do not give the reviewer only git refs: the strict read-only role cannot run git or compute the diff, and a whole-file review cannot recover deleted comments from a diff.

   Spawn Comment Sicko independently. Follow `../poteto-mode/references/amp-adapter.md`. Do not run the comment audit in the parent. Pass the patch artifact path and scoped file paths for a diff review, or the named file paths for an explicit whole-file review, plus the path `../../agents/comment-sicko.md`. Do not paste the rules file. Do not ask it to edit. The reviewer uses `Read` and `finder` for inspection, and `pstack_send_to_thread` only to report from a background child; no shell, file writes, spawn tools, MCP, or other pstack tools.

   Use blocking `pstack_run_agent` with role `comment-reviewer`, omit `executor`, and pass no `timeoutMs` only for a same-checkout local child that can already read the patch artifact or named files. A blocking wait starts work immediately and cannot receive files during the wait.

   For a fresh-orb background child, use `pstack_start_agent` with role `comment-reviewer`. Brief it to hold and write nothing until inputs are ready. After the child exists, transfer the patch artifact and current scoped files (including untracked files, excluding deleted files), or the unavailable named files for a whole-file review, with `upload_thread_file`. Use `overwrite: true` for tracked files at their workspace-relative paths; for paths whose destination directory does not exist, upload under a distinct name in an existing directory and tell the child which original path it represents. Steer it with the accessible paths to run the audit and report. Join on that report. On timeout, read that child. If a requested diff cannot be made reachable, report the review gap; do not substitute git refs or widen that diff audit to whole-file review.
2. Inspect its report and diff. Reject application-code edits, scope escapes, exception-protected deletions, misstated `MUST KILL` reasons, and flags that treat kept intentional code as guilty. Reshape flags on our-code surprises stay actionable. Do not restore those comments. A keep survives only with proof it is about something we cannot change. Audit missed scoped lint and TypeScript suppressions. Correctness or safety suppressions stay actionable `MUST KILL`s. Restore deletions only with exact exceptions and scoped proof. Before accepting thin `IMPORTANT` or `do not remove` kills or keeps, load **how** or **why** on their symbol. If a kill is ambiguous, do not restore. If a keep is refuted or still ambiguous, delete it. Revert and rerun one rejected report with the failure named. Reject a second, report it open, and fail this skill.
3. Fix trivial accepted flags directly by deleting a dead path, dropping a parameter, or using the real API. If any fix needs a shape, load **architect** once for the accepted set and surrounding code. Stop at the sketch. Architect shapes. Step 4 implements.
4. Implement the smallest root-cause fix in scope. Remove every named workaround. If the root cause is out of scope, land the smallest in-scope fix and report the rest open. The **principle-fix-root-causes** and **principle-redesign-from-first-principles** skills guide intent only. Neither authorizes widening the fence nor fixing instances outside it. Never bolt on symptom guards.
5. Constraint comments say `do not remove`, `do not change wording`, or `talk to X before changing`. Leave keeps about things we cannot change. Offer the cheapest in-scope type, runtime, test, or CI lint. Wait for interactive approval. Unattended and eval require caller pre-approval. If approved, encode then delete. Otherwise delete, report the constraint open, and sketch out-of-scope work.
6. Report the deletion count, restored comments, reruns, architect sketch, fixes, encoding offers, encodings, unenforced constraints, and other open work.
