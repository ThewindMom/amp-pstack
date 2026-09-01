### Autonomous run

**You own the exit condition. Define done, then drive to it without stopping.** For "going to bed", "run until done", or "keep working until X".

1. State the exit condition as a checkable predicate before the first iteration (tests green, repro fixed, all N PRs merged, pixel-diff zero). A vague goal stalls; a predicate lets you stop.
2. Pick the Amp wake mechanism. For independent execution, spawn an orb child thread with `pstack_start_agent` or Amp's `create_thread`; the latter is preferred when the user requested a particular orb size or agent mode. For an event from another service, create a capability webhook with `pstack_create_wake_webhook`. For periodic or delayed checks, set an Amp schedule only when the user requested ongoing or later work. When the condition should resolve in minutes, wait in the current turn instead of scheduling.
3. Each iteration makes the smallest change the evidence justifies, verifies it against the predicate, commits if it advanced, discards changes that didn't help. Belt-and-suspenders that "might help" gets reverted, not left to ride.
   Sequence the work via the **sequence-verifiable-units** principle skill, verifying each unit before the next instead of batching checks at the end.
4. Mid-run discoveries that block the predicate are yours. Address broken skills, related bugs, flaky verifiers, review noise, tooling failures, and fixable drift via poteto-mode. Keep unrelated findings out of scope. Ask only for external writes not already authorized, irreversible actions, genuine product or preference calls no experiment can settle, or a real dead end.
5. Checkpoint every iteration via the **show-me-your-work** skill, a row for what changed and whether the predicate moved. A run with no trail can't be audited or resumed.
6. Stop when the predicate is met. A plateau is not a stop, so keep going and pivot your approach to push past it. Surface a genuine dead end rather than spinning, and never relax the predicate to declare victory.

**Reply:** the exit condition, iterations run, what landed, what was discarded, final predicate state.
