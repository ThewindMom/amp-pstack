---
name: ketchup
description: "Only use when named. Catches the user up on what changed in this thread since their last message, in a few plain sentences and small visuals, with just enough context to decide each action item. Use for pstack:ketchup."
builtin-tools:
  - pstack_read_current_thread
---

# Ketchup

Catch the user up on what changed in this thread since the last message they wrote before invoking `pstack:ketchup`. Scheduled wake-ups, notifications, and child reports are not their messages. Assume the user remembers their last message and nothing after it.

Read [`pstack:bro`](../bro/SKILL.md) for its voice, not its task: plain words, short sentences, no jargon, like one person catching up another. Say what changed for the user, not how you did it. Say "the tests pass", not "CI is green". Leave out hashes, file paths, commands, build numbers, and test counts unless the user needs one to act. Call each PR, branch, or agent by a name the user would know, not a label invented during the work. If a fact needs context to make sense, give the context or leave it out.

## Gather what changed

Keep this turn read-only. Use the visible conversation and `pstack_read_current_thread` when earlier history is needed. Follow its `offset`, `total`, and `truncated` pagination fields to read the relevant range; do not infer missing history. Collect your work since that message, child reports, and other participants' messages. In a multiplayer thread, use the invoking user's last authored message, not another person's. Check the current state of each PR, CI run, or agent touched here with available read-only tools. Check each number you will show against the facts it comes from, and say so when you correct one.

You may create visuals for the reply using evidence already available. Do not change code, start an app or job, or post anything to make them.

An action item is a decision or step only the user can take, such as a product choice, an approval, an irreversible action, or missing access. Include items still waiting on them even if raised before their last message. Work you can do yourself is not an action item. Do not change files, configure models, create schedules, or publish while catching them up, except for the reply artifacts described above.

Never make up a call to fill the reply. A step the user did not ask for and the work does not need is not an action item, unless it is irreversible and waiting on the user: give it one action line, no visual, and skip what happens if the user does not answer.

## Write the reply

Keep the whole reply well under 150 words, counting the words inside visuals and tables. Never give a fact in both the text and a visual. Leave out work that changed nothing for the user. When words run short, cut from what happened before you cut from the action items.

Open with one sentence saying how many things need the user, or that nothing does. If nothing happened and nothing waits on the user, say so and stop.

Then show what happened in one visual of at most four boxes. Give each thing the user asked for a box that says what came of it and whether it is done, still running, failed, or not checked. Write each box the way you would say it out loud: "Search was slow from a missing index", not "Search review: done". Name any bug found and fixed on the way. Each box must stay true when read alone. Never mark something done that still waits on the user. Under the visual, give at most three short lines that change what the user knows or must do. Then name in one line any work left that you can do yourself.

Give each action item two lines, or one for an unasked irreversible step: the decision with your recommendation and why, then what happens if the user does not answer. Ask the call the user owns, such as merge, approve, or pick. A step you would take first goes in your recommendation. So does anything that must happen first, and anything that cannot be undone. Write "unknown" for a part you do not know. Link to details when available, but make the summary sufficient to decide without opening them.

Show each action item as a before and after, side by side, in a visual. For a choice, put the current state beside each option, or the options alone when there is no current state. Put every option the work weighed in the visual, each with what it gets the user and what it costs. Keep them out of the text. Skip the visual only for access requests and unasked irreversible steps.

## Visuals

A visual is a screenshot, video, chart, or diagram. A Markdown table is not a visual, even with before and after columns.

Keep each visual small enough to read at a glance: at most six boxes, with at most eight words in each, not counting "No screenshot yet." Write labels as plain words a person would say, not tags like "Tests: pass". Group small items into one box. A fact that needs a sentence belongs in the text, or nowhere.

Use existing screenshots or video when the change is visible. If a visible change has none, mark its box "No screenshot yet," and say in a line under the visual what changed on screen. For anything else, draw from facts you have: a plain-text `diagram` block for small states, flows, and structures, or Amp's `creating-views` skill for charts and interactive views. If you cannot make a visual from available evidence, say none exists. Never invent a number or draw or generate a screen you did not capture. Link only artifacts that exist. Use Mermaid only when explicitly requested.
