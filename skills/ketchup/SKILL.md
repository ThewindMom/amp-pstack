---
name: ketchup
description: "Only use when named. Catches the user up on what changed in this thread since their last message, in a short reply built on real visuals, with just enough context to decide each action item. Use for pstack:ketchup."
builtin-tools:
  - pstack_read_current_thread
---

# Ketchup

Catch the user up on what changed in this thread since the last message they wrote before invoking `pstack:ketchup`. Scheduled wake-ups, notifications, and child reports are not their messages. Read [`pstack:bro`](../bro/SKILL.md) for its plain voice, and skip its restating step. Assume the user remembers their last message and nothing after it. Call each PR, branch, or agent by a name they would know, not a label invented during the work.

## Gather what changed

Keep this turn read-only. Use the visible conversation and `pstack_read_current_thread` when earlier history is needed. Follow its `offset`, `total`, and `truncated` pagination fields to read the relevant range; do not infer missing history. Collect your work since that message, child reports, and other participants' messages. In a multiplayer thread, use the invoking user's last authored message, not another person's. Check the current state of each PR, CI run, or agent touched here with available read-only tools. Check each number you will show against the facts it comes from, and say so when you correct one.

You may create visuals for the reply using evidence already available. Do not change code, start an app or job, or post anything to make them.

An action item is a decision or step only the user can take, such as a product choice, an approval, an irreversible action, or missing access. Include items still waiting on them even if raised before their last message. Work you can do yourself is not an action item. Do not change files, configure models, create schedules, or publish while catching them up, except for the reply artifacts described above.

## Write the reply

Keep the text under 250 words. Markdown tables are text, so their words count. Visuals do not count. A visual replaces the text it shows, so never give a fact in both. Leave out work that changed nothing for the user.

Open with one sentence saying how many action items there are, or that there are none. If nothing happened and nothing waits on the user, say so and stop.

Then show what happened in one visual: each PR, run, or agent touched here, with its state (done, running, failed, or not checked). Under it, give at most three one-line results that change what the user knows or must do. Keep a result's key number in its line unless the visual shows it. Then name in one line any work left that you can do yourself.

Give each action item in three lines: the decision, your recommendation and why, and what happens without an answer. Write "unknown" for a part you do not know. Link to details when available, but make the summary sufficient to decide without opening them.

Show each action item as a before and after, side by side, in a visual. For a choice, put the current state beside each option, or the options alone when there is no current state. Put the options and what each costs in the visual, not in the text. Skip the visual only for a request for access.

## Visuals

A visual is a screenshot, video, chart, or diagram. A Markdown table is not a visual, even with before and after columns.

Use existing screenshots or video when the change is visible. If a visible change has none, add it to the visual of what happened, marked "No screenshot yet." For anything else, draw from facts you have: a plain-text `diagram` block for small states, flows, and structures, or Amp's `creating-views` skill for charts and interactive views. If you cannot make a visual from available evidence, say none exists. Never invent a number or draw or generate a screen you did not capture. Link only artifacts that exist. Use Mermaid only when explicitly requested.
