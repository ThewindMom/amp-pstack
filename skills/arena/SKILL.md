---
name: arena
description: "Only use when named or routed by poteto-mode. Spawns N parallel candidates, picks a base, and grafts the strongest parts for arena requests or non-trivial artifacts that need competing attempts."
builtin-tools:
  - pstack_run_panel
  - pstack_start_agent
  - wait_for_threads
  - read_thread
---

# Arena

Fan out N parallel attempts at the same task. Read every candidate end to end. Pick the strongest as the base. Graft the best ideas from the others into it. Verify the synthesized result.

## Start

Open an explicit checklist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Cross-judge
4. Pick
5. Graft
6. Verify

## Phase A: Frame

The N candidates will receive the same prompt, so the prompt is the contract.

1. State the artifact each candidate is producing.
2. Derive the rubric. State what success looks like for *this* task, then turn it into 3-6 concrete gradeable criteria. Concrete: `Adds a --dry-run flag that skips writes`. Vague: `code is correct`. The rubric is the picker's tool in Phase D; candidates only see the task.
3. Pick the runners. Accept a runner panel from the caller and default to `arena-runners`. `pstack_run_panel` resolves the selected panel's configured model list. A missing panel uses `DEFAULT_MODELS`: one each on `anthropic/claude-opus-5-5`, `openai/gpt-6-sol`, and `xai/grok-4.7`. If Amp rejects one configured entry, that seat is a terminal dropout. Proceed with N-1 when at least one candidate completed, then start the cross-judge. Do not stop the panel. Do not retry that seat with another model on that call. A replacement is a persistent config write. Do it only when the user asks, then reload plugins before the next orb spawn. Cursor `inherit-parent` and `auto` are not Amp values. Spawn more when the arena covers multiple design directions. For a custom count, including a repeated-model generation run, pass `count` to `pstack_run_panel`; it cycles configured seats in order and accepts 1 through 20 candidates.
4. Assign output paths. Each candidate writes to its own location (a git worktree where possible, otherwise `/tmp/arena-<slug>/candidate-<n>/`). N candidates writing to the same path is shared mutable state and fails the **separate-before-serializing-shared-state** principle skill test.

## Phase B: Fan out

Call `pstack_run_panel` once with the selected runner panel, the optional custom `count`, and a complete shared brief. Each agent receives a unique role label. Tell candidates to return the artifact in their response or write only to a path derived from that unique label.

When candidates must run in orbs, size them from `../poteto-mode/references/amp-adapter.md`. Design sketches and cross-judges are `a1.tiny` or `a1.small` unless the project default is already that small. Implementation bakeoffs that build or drive the app follow the feature/bug row. Plugin panels cannot set `orb_size`.

Each rationale names the alternatives the candidate considered and what it rejected.

If a candidate returns `status: timeout`, its seat remains pending and the runtime keeps the judge gate closed. Read its `threadID`; proceed with N-1 only after an explicit evidenced dropout or terminal failure. Do not redo a timed-out candidate in the parent.

## Phase C: Cross-judge

After all Phase B candidates are terminal and at least one completed, start one background agent with `pstack_start_agent`, role `arena-cross-judge`, and `candidateThreadIDs` set to the non-empty unique list in the candidate-ready notification or `agent.end` continuation. Those are the authoritative sources and include every tracked candidate, including failed children whose IDs may be missing from the panel result. The plugin compares this as a set with the active run, so order does not matter. Ignore a stale notification or continuation whose IDs belong to another run. The candidate-ready notification includes the copyable list, so the parent can start the judge before `agent.end`. The plugin chooses one model from the configured pool, preferring a known family different from the parent. A missing pool uses `DEFAULT_MODELS`. If Amp rejects that single-role spawn, report it and stop. A replacement is a persistent config write and needs the user's request. Follow `../poteto-mode/references/amp-adapter.md`. If the parent ends before starting the judge, Amp may queue a continuation; the tool rejects it once that run is finished. Once the judge is live, the parent idles and the judge's steered report wakes it. A failed judge restores one replacement gate; its notification repeats the same candidate ID set for an immediate retry. It never satisfies the design run. The judge sees the rubric and completed candidates by label, scores each criterion, and recommends a base with rationale. Never start it while candidates are still producing output.

## Phase D: Pick a base

Read every candidate end to end before picking.

Score each candidate against the rubric criterion by criterion, not on holistic feel. Compare against the cross-judge. Agreement on the base confirms the pick. Disagreement means one of you is biased or the rubric was ambiguous. Read both rationales before deciding.

Pick the base on which candidate a future maintainer can extend most easily without breaking invariants. Prefer the cleaner boundary or smaller API when two feel tied, per the Laziness Protocol.

Record the pick and the reason in a short synthesis note alongside the base artifact, including the cross-judge's verdict.

## Phase E: Graft

Walk each losing candidate once more and identify what is worth porting into the base. The signal is usually one or two things per candidate, not most of it.

Fold each graft in by hand, per the **redesign-from-first-principles** principle skill. Don't paste mechanically. The result has to remain coherent under one mental model.

Record what was grafted, from which candidate, and what was rejected and why.

When N candidates converge on the same shape, that is a strong agreement signal. Note the convergence in the record and ship the consensus shape. No graft is needed. When N candidates wildly diverge, Phase A was under-specified. Reframe and re-run rather than averaging the divergence.

## Phase F: Verify

The synthesized artifact has to hold up under the same scrutiny as any other output, per the **prove-it-works** principle skill.

If verification surfaces a problem the arena did not catch, either Phase A was wrong (re-frame and re-run) or one candidate caught it and you missed the graft (go back to Phase E). Don't paper over.

## Outputs

One synthesized artifact. One short synthesis note alongside, naming the base, the grafts (with source candidate), the rejections, the dropouts if any, and the verification result.
