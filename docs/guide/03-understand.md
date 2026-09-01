# Understand the code before changing it

Editing code you don't understand is how subtle regressions ship. pstack gives you four ways in. `pstack:how` explains what the code does now. `pstack:why` digs up the reasons it's shaped that way. `pstack:teach` blends both into one explanation. `pstack:recall` rebuilds your own recent context on a topic.

![A detective studies a machine blueprint with a magnifying glass while robots fetch case files; the evidence board behind her links clues under /how and /why.](./images/understanding.jpg)

## Trace behavior with `pstack:how`

```text
Load pstack:how. How do we dedupe notifications? Is there an n+1 when we look up subscribers?
```

Ask the question you actually have. [`pstack:how`](../../skills/how/SKILL.md) reads the code and answers at the level of a senior engineer onboarding you onto the subsystem, with the runtime flow, the key types, and the non-obvious parts. For a big subsystem it fans out two to four read-only explorers with `pstack_run_agent` role `how-explorer`. For a narrow question it runs one `how-explainer`. Critique mode then runs panel `how-critics`.

```text
Load pstack:how. Explain the sync service, then critique its ownership boundaries.
```

The explanation comes first, so the critique stays grounded in how the thing really works.

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

## Catch yourself up with `pstack:recall`

```text
Load pstack:recall and catch me up on last week's export work.
```

[`pstack:recall`](../../skills/recall/SKILL.md) searches Amp threads with `find_thread` and reads them with `read_thread`. It also sweeps the shared record through why when the topic names a feature or bug. Cite every finding with an Amp thread link.

Next: [Design the change](./04-design.md).
