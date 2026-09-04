# Design before you write code

One attempt at a hard design locks in the first shape the model thought of. `pstack:architect` settles types and boundaries before implementation. `pstack:arena` runs several attempts at the same brief and merges the best parts. `pstack:interrogate` has other models try to break the result. When the job is coverage rather than design synthesis, `pstack:swarm` fans out slices or races and aggregates their results.

![Three robots draft competing bridge models at their own tables under /architect, /arena, and /interrogate panels, while a judge robot with a clipboard inspects skeptically.](./images/design.jpg)

## Settle the shape with `pstack:architect`

```text
Load pstack:architect. Design the import pipeline before writing any code. I care most about how callers use it.
```

[`pstack:architect`](../../skills/architect/SKILL.md) grounds itself first, running how over the code the design touches and why when it moves ownership or layers. Then it runs arena through panel `architect-runners` to produce competing design sketches, with the caller's usage written first in each, followed by types, signatures, and a module map.

By default it proceeds straight from the synthesized design into implementation. If you want to see the design first, say so:

```text
Load pstack:architect with checkpoint. Stop and show me before implementing.
```

## Fan out attempts with `pstack:arena`

```text
Load pstack:arena. Take my prompt to the arena verbatim. I want to compare their proposals with yours.
```

[`pstack:arena`](../../skills/arena/SKILL.md) is the general tool underneath. `pstack_run_panel` uses the caller's candidate panel, defaulting to `arena-runners`, to attempt the same design or code brief in parallel. One background `arena-cross-judge` is required after the candidate panel. It scores every candidate against a rubric while the coordinator reads each candidate end to end. The coordinator picks a base, grafts in the best ideas from the losers, and verifies the result.

## Cover slices with `pstack:swarm`

```text
Load pstack:swarm. Check every package under packages/ against its check.sh. One worker per package. One report.
```

[`pstack:swarm`](../../skills/swarm/SKILL.md) fans out role `swarm-worker`. The plugin keeps an orb parent's workers in orbs. From a local parent, use local execution for current-checkout state and orb execution for independent work from the project remote.

## Stress the result with `pstack:interrogate`

```text
Load pstack:interrogate. Review this branch against its stated intent. Don't change anything yet.
```

[`pstack:interrogate`](../../skills/interrogate/SKILL.md) runs panel `interrogate-reviewers`. The parent synthesizes. Agreement across model families is high-signal. One loud nit is not.

Next: [Build and clean the change](./05-build-and-clean.md).
