# Make it yours

poteto-mode is one person's style. The machinery underneath, playbooks, routing, model roles, works just as well wearing yours. This page covers generating a personal mode, capturing lessons from a session, authoring a focused skill, and testing a skill change before you trust it.

## Generate your own mode with `pstack:automate-me`

```text
Load pstack:automate-me
```

You don't describe your style, because [`pstack:automate-me`](../../skills/automate-me/SKILL.md) reads it out of your history. It mines Amp threads with `find_thread` and `read_thread` for repeated preferences, then asks you which patterns are really you. It drafts `.agents/skills/<your-name>-mode/SKILL.md` through Amp's `building-skills` flow, runs the draft through [`pstack:unslop`](../../skills/unslop/SKILL.md), and waits for approval before installing.

Run it again whenever your habits drift:

```text
Load pstack:automate-me. Update my mode skill with everything since its last edit.
```

## Capture a session's lessons with `pstack:reflect`

Right after a task that taught you something, run:

```text
Load pstack:reflect. That took way too long. Capture what we learned so the next run doesn't repeat it.
```

[`pstack:reflect`](../../skills/reflect/SKILL.md) reads this thread with `pstack_read_current_thread`, including tool results. Three reviewers and a synthesizer sort proposals into Accepted, Rejected, and Backlog. Skill changes wait for your approval. Tracker writes wait too.

## Author a focused skill

When you already know the workflow you want to capture:

```text
Use pstack:poteto-mode. Write a skill for verifying database migrations in this repo.
```

Writing a skill matches the [Authoring or modifying a skill playbook](../../skills/poteto-mode/playbooks/authoring-a-skill.md), which loads Amp's `building-skills`, validates the frontmatter and links, and ships the result through Opening a PR.

## Eval a skill change before you trust it

The [Eval playbook](../../skills/poteto-mode/playbooks/eval.md) runs N candidates, then grades chain-following from each candidate's Amp thread with `read_thread`, not from self-report.

Next: [Recipes and pitfalls](./10-recipes-and-pitfalls.md).
