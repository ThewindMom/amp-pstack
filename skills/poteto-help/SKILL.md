---
name: poteto-help
description: "Only use when named. Guides users through Amp pstack setup, poteto-mode, and picking a skill, playbook, or principle. Invoke pstack:poteto-help with a question."
---

# Poteto help

Answer the user's question about pstack, hand them a prompt they can send, and link the file the answer came from. For a help question, don't start the work. The user asked how, and a pstack run spends real tokens, so let them send the prompt.

A message that asks for work, such as "use pstack to fix this bug", is not a help question. Load `pstack:poteto-mode`, do the work under it, and mention once that selecting the `poteto` agent mode keeps it on.

This file maps questions to the skills and guide pages that hold the answers. Read the file you route to before quoting it, and trust it when it disagrees with this map. Links point into the installed plugin. For files in the current workspace, use Amp file links. When the user cannot open installed files, link their public copy at `https://github.com/thewindmom/amp-pstack/blob/main/` followed by the path.

## Find out what they need

Infer the need from the message and conversation. A named situation, such as "which skill reviews a PR?", goes straight to its section. If unclear, ask one short clarifying question. Only use a multiple-choice dialog when the user explicitly asks for questions. The possible needs are setup, starting a task, picking a skill, fixing a run, and making pstack their own.

Check state only when it changes the answer:

- Read the resolved map through `pstack_configure_models` with `action: "show"` if model choices matter. A missing config file does not prove setup hasn't run; Amp user config can hold overrides.
- No `verify-*` skill or app harness means agents have no scripted way to drive the app. Mention `pstack:create-verification-skill` when asked about proving behavior.

## Get set up

1. Follow the directory-plugin installation in [guide page 1](../../docs/guide/01-setup.md). A personal plugins repository makes the plugin available across machines and orbs; a machine-local clone is optional.
2. Load [`pstack:setup-pstack`](../setup-pstack/SKILL.md). It asks for a reasoning budget, maps models to roles, and writes only changed choices. Local spawns resolve the new map immediately; reload plugins before judging changed orb modes.
3. Start a real task with `pstack:poteto-mode`, a goal, and a check that passes or fails.

Installing does not start a workflow. Routed skills run when named or when poteto-mode selects them; setup is also directly discoverable from the user's words. Read the [README](../../README.md) for installation details. Offer to word the first prompt using [`references/prompting.md`](references/prompting.md).

If cost is the worry, explain that workers and review panels spend extra tokens. Rerun setup for a smaller reasoning budget, cheaper models, or shorter panels. Each panel entry runs a seat. Amp supports concrete models and built-in aliases, not Cursor's `auto` or `inherit-parent`. Save the mode for work that needs rigor.

This is the Amp-native port. It uses native Amp threads, orbs, runners, schedules, and plugin modes rather than Cursor subagents, Custom Modes, or `/loop`.

## Start a task with poteto-mode

`pstack:poteto-mode` matches the task to a playbook, copies the steps into a checklist, and runs other skills as needed. Skipped steps stay visible as `skip: <reason>`. A good prompt states the goal and how to tell it is done, rather than prescribing a skill sequence. Read [`references/prompting.md`](references/prompting.md) before wording one. [Guide page 2](../../docs/guide/02-poteto-mode.md) has examples.

Loading the skill attaches workflow guidance to the conversation; it does not select a mode. Selecting `poteto` in Amp's mode picker keeps coordinator instructions in context each turn. It stays out of casual turns. Without the mode, name `pstack:poteto-mode` at each new task. "New task" makes it match a fresh playbook.

Workers use `pstack_start_agent` with a configured role, not a Cursor `poteto-agent` type. Read the [Amp adapter](../poteto-mode/references/amp-adapter.md) before answering executor or transfer questions.

## Pick a skill

The default is `pstack:poteto-mode`, which runs most others when needed. Name a skill directly when the user wants more or less than the playbook supplies. Read the skill before recommending it, and give one example prompt.

| The user wants to | Skill |
|---|---|
| Do non-trivial work with rigor | [`pstack:poteto-mode`](../poteto-mode/SKILL.md) |
| Know how code works or where new code belongs | [`pstack:how`](../how/SKILL.md) |
| Know why code or a number is shaped this way | [`pstack:why`](../why/SKILL.md) |
| Understand a change or subsystem plainly | [`pstack:teach`](../teach/SKILL.md) |
| Catch up on recent work | [`pstack:recall`](../recall/SKILL.md) |
| Know what a small diff could break outside itself | [`pstack:blast-radius`](../blast-radius/SKILL.md) |
| Settle types and module shape before code | [`pstack:architect`](../architect/SKILL.md) |
| Compare attempts at one brief and merge the best parts | [`pstack:arena`](../arena/SKILL.md) |
| Run parallel checks over slices or race workers | [`pstack:swarm`](../swarm/SKILL.md) |
| Have several models review and try to break a diff | [`pstack:interrogate`](../interrogate/SKILL.md) |
| Fix a bug test-first with a cheap local test | [`pstack:tdd`](../tdd/SKILL.md) |
| Apply TypeScript rules | [`pstack:typescript-best-practices`](../typescript-best-practices/SKILL.md) |
| Audit comments with an independent reviewer | [`pstack:no-comments`](../no-comments/SKILL.md) |
| Clean AI tells out of prose | [`pstack:unslop`](../unslop/SKILL.md) |
| Write docs, RFCs, READMEs, PR descriptions, or commits | [`pstack:technical-writing`](../technical-writing/SKILL.md) |
| Hear the last reply in plain words | [`pstack:bro`](../bro/SKILL.md) |
| Give agents a scripted way to drive the app | [`pstack:create-verification-skill`](../create-verification-skill/SKILL.md) |
| Bring a verification skill back in line with the app | [`pstack:maintain-verification-skill`](../maintain-verification-skill/SKILL.md) |
| Vet a performance number | [`pstack:benchmark-checklist`](../benchmark-checklist/SKILL.md) |
| Run a large or cross-cutting change | [`pstack:figure-it-out`](../figure-it-out/SKILL.md) |
| Keep and audit a decision log | [`pstack:show-me-your-work`](../show-me-your-work/SKILL.md) |
| Pick models and a reasoning budget | [`pstack:setup-pstack`](../setup-pstack/SKILL.md) |
| Turn working habits into a personal mode | [`pstack:automate-me`](../automate-me/SKILL.md) |
| Turn session lessons into approved skill edits | [`pstack:reflect`](../reflect/SKILL.md) |
| Prevent repeated mistakes in this repo | [`pstack:correct`](../correct/SKILL.md) |
| Build a page whose buttons wake an Amp thread | [`pstack:make-bot-ui`](../make-bot-ui/SKILL.md) |
| Find their way around pstack | `pstack:poteto-help` |

If a sibling skill is missing from the table, read its frontmatter and route by its description. `principle-*` skills are covered below.

Close calls:

- `how` explains mechanics; `why` explains reasons; `teach` runs one or both and explains plainly.
- `arena` gives every worker the same brief; `swarm` splits slices or races and returns one report.
- `architect` implements after design; add "with checkpoint" to review before code.
- `interrogate` reviews the diff; `blast-radius` proves the safety fact outside it.
- `recall` spans recent threads; Session pickup resumes one specific branch or thread.
- `figure-it-out` designs one rigorous run; Orchestrate spans days and PRs; Autonomous run drives one task to its finish condition.

Pstack has no `orchestrate` or planning skill. Orchestrate and Multi-phase plan are poteto-mode playbooks. Amp's `building-skills` and `building-schedules` are separate skills, not pstack workflows. Cursor's `deslop`, `control-cli`, and `control-ui` belong to `cursor-team-kit`, not this plugin.

## Playbooks and principles

Playbooks are step lists inside poteto-mode, not separately invokable skills. These phrases select them:

- "babysit this pr" or "check on pr 123": Babysit reaches merge-ready and stops. Merging needs explicit authorization.
- "land the stack": Shipping.
- "take over this branch": Session pickup.
- "pause safely": Pause safely.
- "full autopilot on this queue": Autopilot-full; "stack them, don't ship": Autopilot-stack.
- "run the eval playbook": Eval.

Without poteto-mode, another workflow may handle the same words. Read its [Playbooks section](../poteto-mode/SKILL.md) for the full map and [guide page 6](../../docs/guide/06-verify-and-ship.md) for PR workflows.

For a multi-phase plan, ask poteto-mode to run the [Multi-phase plan playbook](../poteto-mode/playbooks/multi-phase-plan.md): it writes a plan, not an implementation. Prototype or architect settles design in code first.

Principles are one-rule skills poteto-mode reads and cites. Steer with the name, as in "apply prove it works. show me the real output", or explicitly load `pstack:principle-<name>`. [Guide page 8](../../docs/guide/08-principles.md) lists them.

## Fix a run that went wrong

| Symptom | Fix |
|---|---|
| Guidance stopped applying | Select the `poteto` mode, or name the skill at each new task. |
| A question became the next step of the old task | Say "new task", or opt the turn out of the mode. |
| Model choices had no effect | Inspect the resolved map; reload plugins before changed orb modes. |
| Cost is too high | Reduce reasoning budget, model cost, or panel length. |
| A skill didn't load itself | Routed skills require named use or poteto-mode routing; it doesn't run every skill. |
| Parallel agents overwrote each other | Separate ownership paths and use worktrees or orbs; transfer unpushed inputs explicitly. |
| Overnight work moved but finished nothing | Give it pass/fail checks, not a duration. Explicitly authorize an hourly Amp schedule if needed; see [guide page 7](../../docs/guide/07-overnight.md). |
| Success rests on a green build | Ask for the real command, flow, stored value, or profile. |

For drift, use the one-line steers in [`references/prompting.md`](references/prompting.md). [Guide page 10](../../docs/guide/10-recipes-and-pitfalls.md) adds recipes and pitfalls.

## Make pstack my own

- `pstack:automate-me` drafts a personal mode from history, alongside poteto-mode.
- `pstack:reflect` turns lessons into skill edits the user approves.
- Ask poteto-mode to write a skill for a workflow; Eval tests changes blind.
- Fix a misbehaving skill in its own PR, not inside unrelated feature work.

[Guide page 9](../../docs/guide/09-make-it-yours.md) covers these. Shared or external writes still require explicit approval; full autonomy does not override Amp's permission boundaries.

## Reply

Lead with the answer. Give at most one example prompt, adapted from [`references/recipes.md`](references/recipes.md) when it fits, then link the source. Keep it short unless asked for the whole map.
