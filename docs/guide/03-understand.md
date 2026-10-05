# Understand the code before changing it

Editing code you don't understand is how subtle regressions ship. Agents fail when they misread the request or lack context. `pstack:how` explains what the code does now. `pstack:why` finds why it is shaped that way. `pstack:teach` blends both. `pstack:recall` rebuilds your recent context.

![A detective studies a machine blueprint with a magnifying glass while robots fetch case files; the evidence board behind her links clues under /how and /why.](./images/understanding.jpg)

## Start read-only

When the cause is unclear, ask for findings rather than a fix:

```text
Use pstack:poteto-mode. Investigate why jobs time out every few hours. Separate evidence from hypotheses. Don't change code yet.
```

That routes to Investigation. Start the fix as a new task once the evidence points somewhere.

## Trace behavior with `pstack:how`

```text
Load pstack:how. How do we dedupe notifications? Is there an n+1 when we look up subscribers?
```

Ask the question you actually have. [`pstack:how`](../../skills/how/SKILL.md) reads the code and answers at the level of a senior engineer onboarding you onto the subsystem, with the runtime flow, the key types, and the non-obvious parts. For a big subsystem it fans out two to four read-only explorers with `pstack_start_agent` role `how-explorer`. For a narrow question it starts one `how-explainer`. Join on the reports.

## Dig up history with `pstack:why`

```text
Load pstack:why. Why was the retry limit set to five? Does the reason still hold?
```

[`pstack:why`](../../skills/why/SKILL.md) works like a detective on a cold case. It starts from source control, then queries whatever evidence categories your tools expose, such as the issue tracker, long-form docs, team chat, observability, error tracking, and analytics, all in parallel through role `why-investigator`. The report cites everything, separates direct evidence from inference, and says "appears to" when the record is thin. A null result gets reported too, because "nobody wrote down why" is itself an answer.

The two compose naturally. "Do why first then how" is a perfectly good prompt when you suspect the history explains the mess.

## Actually understand it with `pstack:teach`

```text
Load pstack:teach. Teach me how this PR changes retries. Convince me it fixes the cause and not the symptom.
```

[`pstack:teach`](../../skills/teach/SKILL.md) is for when a summary isn't enough. It runs how and why, for a small change maybe just one of them, and weaves the findings into a plain explanation that builds up diagram by diagram. The "convince me" framing is worth stealing. It turns the explanation into an argument you can poke at instead of a tour.

It also works on the agent's decisions: `Load pstack:teach. Teach me why you used this design instead of a queue, including the trade-offs.`

## Catch yourself up with `pstack:recall`

```text
Load pstack:recall and catch me up on last week's export work.
```

[`pstack:recall`](../../skills/recall/SKILL.md) searches Amp threads with `find_thread` and reads them with `read_thread`. It also sweeps the shared record through why when the topic names a feature or bug. Cite every finding with an Amp thread link.

Load old context before new input: `Load pstack:recall. Recall yesterday's virtualized-list work, then read this bug report.`

For a mid-flight branch, use the [Session pickup playbook](../../skills/poteto-mode/playbooks/session-pickup.md): reconstruct the branch state and decisions, name the resume point, and do not redo completed work. Verify inherited claims against the original goal before continuing.

Next: [Design the change](./04-design.md).
