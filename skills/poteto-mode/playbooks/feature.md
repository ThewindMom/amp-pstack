### Feature

**You own the design. Plan, review, verify.** Delegate implementation; stay in the lead.

1. `how` over the affected subsystem.
2. `architect` for parallel design exploration. Skipping stays as `architect skipped: <reason>`; do not fold the design decision silently into implementation.
3. Write the throughput checkpoint as four todo items. A dimension that genuinely does not apply (single file, no fan-out) keeps its item with `n/a: <reason>` rather than being dropped:
   - **Blocking first steps.** Gates run before fan-out.
   - **Independent workstreams.** Disjoint files, services, or layers parallelize. Shared writes serialize.
   - **Shared mutable state.** Default to splitting the target (the **separate-before-serializing-shared-state** principle skill). Serialize only for real invariants.
   - **Smallest safe decomposition.** If one worker is best, name why.
4. Delegate code-writing with `pstack_start_agent`, role `feature-refactoring` (alias `feature`), a non-empty `scope`, and concrete `scopePaths`. Route from the actual executor: local and runner parents use `current-checkout` for live machine state; use `named-runner` for an explicitly selected machine; an Amp-managed orb parent uses a fresh `parent-project-orb` for independent work. Unknown placement requires an explicit target. Use `native-orb` when project, size, or mode matters. Keep dependent work in a parent orb or transfer its files before spawning. Keep the `threadID`. The child exclusively owns its declared paths. Disjoint paths may fan out; equal or prefix-overlapping paths serialize. Continue parent work that is independent, then end the turn when blocked. Join when the child steers this parent. Never redo or replace a live owner. If either side is an orb, transfer uncommitted inputs explicitly. Do not call `pstack_run_agent` for this step. Give a specific scope (file paths, named data shape and its organizing structure per **principle-model-the-domain**, and success criteria); review its diff yourself. When the implementation admits multiple valid shapes, delegate via the **arena** skill instead so runners surface alternatives and the cross-judge guards the pick. Comments per **Comments**. Surgical edits, re-ground against upstream-derived files, port shared-primitive improvements to all consumers, and verify each.
5. Verify on the matching surface. "Inconclusive" or wrong-surface is not a pass; flag it.
6. Rebase into small, ordered commits; stack follow-ups.
   Use the **sequence-verifiable-units** principle skill, building, verifying, and committing each small unit before the next.
7. If the design is contested, `interrogate` before shipping.
8. Run **Opening a PR**.

Code-coupled work (one feature, one migration) goes to a single owner with the checkpoint inline; that owner fans out internally after the blocking phase. Parent-level fan-out is for slices that produce independent artifacts (audits, cross-subsystem investigations, competing experiments). Rewrite the checkpoint at phase boundaries; spawn a fresh owner rather than chaining interrupts.

**Reply:** what you built, what you chose and why, the throughput checkpoint, open decisions. Tables for design alternatives.
