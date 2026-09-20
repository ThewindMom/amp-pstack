---
name: no-comments
description: "Spawn Comment Sicko, fix accepted findings, and offer encodings for claimed constraints."
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

1. Spawn Comment Sicko independently. Follow `../poteto-mode/references/amp-adapter.md`. Do not run the comment audit in the parent. Pass the checkout or git refs plus the path `../../agents/comment-sicko.md`. Do not paste the rules file. Do not ask it to edit. The reviewer is strict read-only: no shell, file writes, spawn tools, MCP, or unknown plugin tools.

   Use blocking `pstack_run_agent` with role `comment-reviewer`, omit `executor`, and pass no `timeoutMs`, only when every input is already reachable without a transfer: remote git refs, or a same-checkout local parent and local child. A blocking wait starts work immediately and cannot receive parent-local files during the wait. Persisting a diff in the parent orb does not make it readable to a fresh child.

   When the review needs live files only this parent orb holds, use `pstack_start_agent` with role `comment-reviewer`. Brief it to hold and write nothing until inputs are ready. After the child exists, `upload_thread_file` into existing destination directories, then steer it to run the audit and report. Join on that report. On timeout, read that child.
2. Inspect its report and diff. Reject application-code edits, scope escapes, exception-protected deletions, misstated `MUST KILL` reasons, and flags that treat kept intentional code as guilty. Reshape flags on our-code surprises stay actionable. Do not restore those comments. A keep survives only with proof it is about something we cannot change. Audit missed scoped lint and TypeScript suppressions. Correctness or safety suppressions stay actionable `MUST KILL`s. Restore deletions only with exact exceptions and scoped proof. Before accepting thin `IMPORTANT` or `do not remove` kills or keeps, load **how** or **why** on their symbol. If a kill is ambiguous, do not restore. If a keep is refuted or still ambiguous, delete it. Revert and rerun one rejected report with the failure named. Reject a second, report it open, and fail this skill.
3. Fix trivial accepted flags directly by deleting a dead path, dropping a parameter, or using the real API. If any fix needs a shape, load **architect** once for the accepted set and surrounding code. Stop at the sketch. Architect shapes. Step 4 implements.
4. Implement the smallest root-cause fix in scope. Remove every named workaround. If the root cause is out of scope, land the smallest in-scope fix and report the rest open. The **principle-fix-root-causes** and **principle-redesign-from-first-principles** skills guide intent only. Neither authorizes widening the fence nor fixing instances outside it. Never bolt on symptom guards.
5. Constraint comments say `do not remove`, `do not change wording`, or `talk to X before changing`. Leave keeps about things we cannot change. Offer the cheapest in-scope type, runtime, test, or CI lint. Wait for interactive approval. Unattended and eval require caller pre-approval. If approved, encode then delete. Otherwise delete, report the constraint open, and sketch out-of-scope work.
6. Report the deletion count, restored comments, reruns, architect sketch, fixes, encoding offers, encodings, unenforced constraints, and other open work.
