---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
builtin-tools:
  - pstack_run_agent
  - pstack_run_panel
  - pstack_start_agent
---

# Swarm

Fan out N parallel Amp agents. They may cover separate slices, race the same brief, or mix both. The parent waits, aggregates, and returns one report.

## Start

Open an explicit checklist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Set N from the user or derive it from the shape. N is total workers, not the cloud concurrency limit.
4. Use role `swarm-worker` for ordinary workers. For a model race, use a configured panel and name each arm up front.
5. Give each worker its own writable output when it writes. Use a worktree, branch, or `/tmp/swarm-<slug>/worker-<n>/`.

## Phase B: Fan out

Launch all workers concurrently with `pstack_start_agent`, role `swarm-worker`. Use `launchTarget.kind: "current-checkout"` when they need the current checkout or uncommitted state. Use `repo-independent-orb` only for committed work that needs no checkout. Use `native-orb` when project, size, or mode matters. Keep every `threadID`. Each child exclusively owns its slice. Continue independent parent work, then end the turn when the reports block further progress. Join on `pstack_send_to_thread` reports. Relay sibling findings through the parent; workers do not message each other. If this parent or a worker is an orb and the worker needs an uncommitted fixture, `upload_thread_file` it. Two orbs do not share a disk. Do not freeze the parent on `pstack_run_agent`. Never redo or replace a live child's slice. A missing report is a dropout only after you read that child and confirm it has none.

Orb size follows the **poteto-mode** Agents and threads table. Coverage slices that only read and report use `create_thread` with `a1.tiny` or `a1.small`. Live visual lanes, browsers, or CPU-heavy tests use `a1.large`. `repo-independent-orb` is enough when the project default already matches and the brief needs no checkout. A user-named size always wins.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence.

If a worker drops out, proceed with N-1 and note it. If an orb needs a non-default branch, include that branch in the brief and ensure it exists remotely before spawning; do not push merely to enable delegation without user authorization.

## Phase C: Aggregate

Read the terminal results. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

Keep a compact result table, one-line evidenced issues, and explicit gaps or dropouts.

## Phase D: Report

Return one consolidated in-chat report with the table, issue one-liners, gaps or dropouts, and the race rule when used.
