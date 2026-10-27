### Autopilot-stack

Run the Autopilot-full playbook, but do not merge.

Use Autopilot-full's isolated owners, explicit external-write permissions, durable `children.tsv`, and terminal-before-replacement rules. Each hourly Amp schedule tick re-reads both playbooks from the loaded skill path or pinned plugin source, not the target repo's trunk. Arm `RRULE:FREQ=HOURLY` only on the operator's request for the ongoing run. Clear the schedule at handoff or stop. Probe stuck children and end the tick per Autopilot-full step 6.

1. **In place of step 5, stop at verified.** Stop when each PR is verified and green at its current head, then hand the PRs to the operator. Verify each round keyed by that exact head SHA, as in Autopilot-full step 4. After the handoff, nobody pushes without the operator's go. Every schedule tick prompt names this file, so each tick sees the no-merge rule. No owner merges, arms auto-merge, or closes a PR.
2. **Stack a PR only when it builds on another PR.** This is the one exception to step 3. Base the PR on the other PR's branch in place of trunk, per **Size and stacks** in `playbooks/opening-a-pr.md`. In place of step 2's rebase onto trunk, each PR rebases onto its parent PR's branch, and the stack root rebases onto trunk. A new head on the lower PR restacks the PRs above it, and a PR whose `git patch-id` the restack leaves unchanged keeps its verdict.

Each owner is the sole writer of its own branch, including its rebases. The root coordinates parent tips and restack order, never writes into a live owner's branch, and requires green CI on every new head. Unrelated PRs remain independent; do not manufacture one linear stack. Shared pushes and PR writes still need explicit authorization.

**Reply:** list each PR with its verdict, in place of what merged.
