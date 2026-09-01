# Steer with principle names

pstack ships 21 principles as individual skills. `pstack:poteto-mode` reads their index at the start of every multi-step task, applies the ones the task triggers, and names each applied principle in its reply along with the decision it changed.

You don't invoke principles. You use their names to steer. Each name points at a complete rule the agent has already read, so one phrase redirects the work more precisely than a paragraph of instructions.

## Steering in practice

Say the agent is about to bolt a new adapter onto three existing ones:

```text
Use subtract before you add. Delete the obsolete adapters first, then design what's left.
```

Say it claims success because the build passed:

```text
Apply prove it works. Run the real import flow and show me the written records.
```

Say two parallel attempts are about to write to the same branch:

```text
Separate before serializing shared state. Give each attempt its own worktree, no locks.
```

Each phrase lands because the rule behind it is specific. The agent still has to say, in its reply, which decision the rule changed. A principle citation with no decision behind it is the tell that it name-dropped instead of applying.

## The 21, briefly

The core principles decide how much to build and when to rethink the design:

- [Laziness Protocol](../../skills/principle-laziness-protocol/SKILL.md) prefers deletion and the smallest change that solves the problem.
- [Foundational Thinking](../../skills/principle-foundational-thinking/SKILL.md) chooses the core data structures before writing logic.
- [Redesign from First Principles](../../skills/principle-redesign-from-first-principles/SKILL.md) integrates a new requirement as if it had been there from day one.
- [Subtract Before You Add](../../skills/principle-subtract-before-you-add/SKILL.md) removes dead weight before building on top of it.
- [Minimize Reader Load](../../skills/principle-minimize-reader-load/SKILL.md) collapses layers and hidden state a reader must hold in their head.
- [Outcome-Oriented Execution](../../skills/principle-outcome-oriented-execution/SKILL.md) converges rewrites on the target design instead of preserving throwaway compatibility states.
- [Experience First](../../skills/principle-experience-first/SKILL.md) chooses the user's result over implementation convenience.
- [Exhaust the Design Space](../../skills/principle-exhaust-the-design-space/SKILL.md) builds two or three competing prototypes when there's no precedent.
- [Build the Lever](../../skills/principle-build-the-lever/SKILL.md) builds the tool that does or proves the work.

Architecture:

- [Model the Domain](../../skills/principle-model-the-domain/SKILL.md)
- [Boundary Discipline](../../skills/principle-boundary-discipline/SKILL.md)
- [Type System Discipline](../../skills/principle-type-system-discipline/SKILL.md)
- [Make Operations Idempotent](../../skills/principle-make-operations-idempotent/SKILL.md)
- [Migrate Callers Then Delete Legacy APIs](../../skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md)
- [Separate Before Serializing Shared State](../../skills/principle-separate-before-serializing-shared-state/SKILL.md)

Verification:

- [Prove It Works](../../skills/principle-prove-it-works/SKILL.md)
- [Fix Root Causes](../../skills/principle-fix-root-causes/SKILL.md)
- [Sequence Work into Verifiable Units](../../skills/principle-sequence-verifiable-units/SKILL.md)

Delegation and meta:

- [Guard the Context Window](../../skills/principle-guard-the-context-window/SKILL.md)
- [Never Block on the Human](../../skills/principle-never-block-on-the-human/SKILL.md)
- [Encode Lessons in Structure](../../skills/principle-encode-lessons-in-structure/SKILL.md)

Next: [Make it yours](./09-make-it-yours.md).
