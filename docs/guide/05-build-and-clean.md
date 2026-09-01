# Build the change and clean the diff

The build playbooks share one discipline. Say what you observed, let the playbook demand the evidence. This page shows what to put in the prompt for each common build task, then the cleanup habit that keeps diffs reviewable.

## Prompt each build playbook with what you know

A bug prompt states the symptom and asks for a reproduction first:

```text
Use pstack:poteto-mode. This command emits two records after a retry. Repro first, then fix and verify.
```

A feature prompt states the behavior and what must not change:

```text
Use pstack:poteto-mode. Add a --json flag. Text output stays byte-identical. Verify both forms.
```

A refactoring prompt pins behavior before structure moves:

```text
Use pstack:poteto-mode. Move parsing into one module, zero behavior change. Record the current output first and prove it's unchanged after.
```

A perf prompt states the measurement, not a vibe:

```text
Use pstack:poteto-mode. Startup takes 1.8s on this fixture. Trace it, fix the measured cause, show me before and after.
```

Each of these routes to its playbook ([Bug fix](../../skills/poteto-mode/playbooks/bug-fix.md), [Feature](../../skills/poteto-mode/playbooks/feature.md), [Refactoring](../../skills/poteto-mode/playbooks/refactoring.md), [Perf issue](../../skills/poteto-mode/playbooks/perf-issue.md)). Feature and refactoring both delegate through role `feature-refactoring`. Bug fix uses `bug-fix`. Perf uses `perf-issue`. Hillclimb uses `hillclimb`.

For sustained improvement of one number, there's the [Hillclimb playbook](../../skills/poteto-mode/playbooks/hillclimb.md). Give it the metric, a target, and a floor on attempts, and it loops one hypothesis at a time with a frozen measurement harness. It keeps wins and reverts everything else.

## Write the failing test first with `pstack:tdd`

When a bug has a cheap local test path, the whole prompt can be two words after the skill name:

```text
Load pstack:tdd. Implement the failing test, then the fix.
```

Skip TDD when the test would be expensive, integration-heavy, or unclear. The Bug fix playbook already says that.

## Clean the prose and the comments

Any reply is a prose surface. `pstack:unslop` applies. Docs, RFCs, PR bodies, and commit messages also run `pstack:technical-writing`. Before review, load `pstack:no-comments`. That skill reads Comment Sicko's prompt and runs role `comment-reviewer` with write tools stripped. The parent applies accepted kills.

Next: [Verify and ship](./06-verify-and-ship.md).
