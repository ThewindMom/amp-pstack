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

Ask the question you actually have. [`pstack:how`](../../skills/how/SKILL.md) reads the code and answers at the level of a senior engineer onboarding you onto the subsystem, with the runtime flow, the key types, and the non-obvious parts. It starts one read-only `how-explainer` child that explores the code and writes the explanation.

## Dig up history with `pstack:why`

```text
Load pstack:why. Why was the retry limit set to five? Does the reason still hold?
```

[`pstack:why`](../../skills/why/SKILL.md) answers from the record, not the code. It reads the commits and PR discussions that introduced the code and each later change, and looks at other sources when that trail is thin. The answer cites what the authors wrote, marks the agent's own inferences as inferences, and says what the record does not answer, because "nobody wrote down why" is itself an answer.

The two compose naturally. "Do why first then how" is a good prompt when you suspect the history explains the mess.

## Actually understand it with `pstack:teach`

```text
Load pstack:teach. Teach me how this PR changes retries. Convince me it fixes the cause and not the symptom.
```

[`pstack:teach`](../../skills/teach/SKILL.md) is for when a summary isn't enough. It runs how and why, for a small change maybe just one of them, and weaves the findings into a plain explanation that builds up diagram by diagram. The "convince me" framing is worth reusing. It turns the explanation into an argument you can test instead of a tour.

It also works on the agent's decisions: `Load pstack:teach. Teach me why you used this design instead of a queue, including the trade-offs.`

## Catch yourself up with `pstack:recall`

```text
Load pstack:recall and catch me up on last week's export work.
```

[`pstack:recall`](../../skills/recall/SKILL.md) searches Amp threads with `find_thread` and reads them with `read_thread`. It also sweeps the shared record through why when the topic names a feature or bug. Cite every finding with an Amp thread link.

Load old context before new input: `Load pstack:recall. Recall yesterday's virtualized-list work, then read this bug report.`

For a mid-flight branch, use the [Session pickup playbook](../../skills/poteto-mode/playbooks/session-pickup.md): reconstruct the branch state and decisions, name the resume point, and do not redo completed work. Verify inherited claims against the original goal before continuing.

Next: [Design the change](./04-design.md).
