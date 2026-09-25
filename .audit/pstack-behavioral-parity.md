# Amp pstack behavioral parity run

Definition of done: every applicable behavior at Cursor pstack 0.15.5 has an Amp implementation with a check of its observable result, or a named host constraint and an honest substitute. Tests alone do not prove child behavior. The source revision is `cursor/plugins@12d587dfb20741cafc376c42c696c5f6e2a64487`.

## Checklist

- [x] Read the Poteto principles and Amp adapter.
- [x] Frame the scope and capture the unmodified baseline. `bun test` passed 159 tests with fixture commit signing disabled for the process.
- [x] Design the workflow. Audit the source independently, then resolve runtime uncertainty with live children and an architect panel before code.
- [x] Run each unit as an experiment. Verify the result before advancing to the next unit.
  - [x] Notify a parent when an unreported background child terminates. Preserve the existing design-run notifications. A real reported child exposed a duplicate; the transcript-based fix passed a second live run.
  - [x] Check whether a no-skill read-only child can call `pstack_send_to_thread`. It can; no exposure change is needed.
  - [x] Make the strongest code-writing role own its scope rather than routing it to read-only judgment.
  - [x] Support per-seat effort and budgets without losing older model maps or reusing stale orb modes. The live orb rejected an effort-only change until plugin reload; exported child metadata then showed medium instead of max.
  - [x] Match deliberate skill activation, autonomy decisions, and bundled script commands to Amp's capabilities.
  - [x] Reconcile custom-count arena candidates, transcript paging, and child cancellation with Amp's thread lifecycle.
- [x] Log decisions and evidence in `pstack-behavioral-parity.tsv` as each unit finishes.
- [x] Rerun the full suite after the reload repairs. With process-local Git signing overrides, `bun test` passed 192 tests with 0 failures. Both plugin and tools typechecks passed, and `git diff --check` found no whitespace errors.
- [x] Obtain a final independent verdict after the last lifecycle repair. The reviewer returned PASS+NOTES on the 209,575-byte transferred code diff. Their temporary SQLite probe confirmed that a reported running child retains its row until terminal cleanup, including after reload. Real native custom mode publication cannot be verified without pushing the plugin; a builtin override did execute through the native redirect.

Amp cannot grant Cursor's external-write autonomy, inherit a Cursor Task model alias, or run Cursor-only control commands. Keep those differences explicit rather than claiming exact parity. Native custom mode creation against an unpushed checkout returned "Agent mode is invalid"; this is not evidence that a published plugin mode fails. Do not push or publish without authorization for this release.

The reload repairs scan a restored child's transcript for an assistant message before treating an idle state as completed, persist each background child's role, and retain a reported child's row until terminal cleanup. Tests cover owners, pending candidates, judges, and background children that finished while the plugin was unloaded, an untouched initial idle, and an active read-only child that reported before reload. A hosted plugin restart during an active child has not been tested. A failed or uncertain parent append can still require reconciliation; the host does not provide a transactional acknowledgement shared by both threads.

The review notes two existing guard limits. A strict read-only child started through blocking `pstack_run_agent` has no durable background row, so a plugin reload can lose its hook guard mid-call. After a child reaches terminal state, later steering into another turn does not restore that guard. Plugin-created children retain their tool allowlist, but a native-orb `agentMode` override may not. The test checks notification suppression after cleanup; the reviewer's disposable SQLite probe separately checked that the row was deleted. Hosted hook behavior, paging semantics, and mid-call result recording remain unverified.
