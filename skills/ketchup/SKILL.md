---
name: ketchup
description: "Only use when named. Catches the user up on this thread since their last message, in plain words, with enough context to decide each action item. Use for pstack:ketchup."
builtin-tools:
  - pstack_read_current_thread
---

# Ketchup

Catch the user up on everything in this thread since the last message they wrote before invoking `pstack:ketchup`. Scheduled wake-ups, notifications, and child reports are not their messages. Read [`pstack:bro`](../bro/SKILL.md) for its plain voice, and skip its restating step. Assume the user remembers their last message and nothing after it. Call each PR, branch, or agent by a name they would know, not a label invented during the work.

## Gather what changed

Keep this turn read-only. Use the visible conversation and `pstack_read_current_thread` when earlier history is needed. Follow its `offset`, `total`, and `truncated` pagination fields to read the relevant range; do not infer missing history. Collect your work since that message, child reports, and other participants' messages. In a multiplayer thread, use the invoking user's last authored message, not another person's. Check the current state of each PR, CI run, or agent touched here with available read-only tools. Say which are still running and which you could not check.

An action item is a decision or step only the user can take, such as a product choice, an approval, an irreversible action, or missing access. Include items still waiting on them even if raised before their last message. Work you can do yourself is not an action item. Do not change files, configure models, create schedules, or publish while catching them up.

## Write the reply

Open with one sentence saying how many action items there are, or that there are none. If nothing happened and nothing waits on the user, say so and stop.

Then say what happened, most important first. Give each result and what it means for the user. Skip steps that changed nothing. Name in one line any work left that you can do yourself.

Give each action item a short executive summary: the decision, why it matters now, the options and costs, your recommendation, and what happens without an answer. Say when a part is unknown rather than guessing. Link to details when available, but make the summary sufficient to decide without opening them.
