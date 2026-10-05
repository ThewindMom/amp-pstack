# Word the prompt

A prompt states the intent and the check for done. The playbook supplies the steps, so a few plain sentences beat a spec.

## Put in

- The goal: what is wrong or wanted.
- The done check: something that passes or fails, not "make it better" or a duration.
- The proof: real command output, a video of the flow, a stored value, or before and after measurements.
- Known evidence: a symptom, repro step, log, or link.
- Real constraints: "repro first", "don't change any code yet", "zero behavior change", or "let me review before proceeding".

## Leave out

- The how: leave room for a better solution.
- A skill sequence: a handwritten order drops or reorders playbook steps. Name a skill only to override a choice.
- A theory of the cause until the agent restates the problem: a guess narrows the search.

## Load the context first

- For a noisy report, ask for a plain-English restatement before any work. Catch a misreading before code exists.
- In a fresh thread, use `pstack:recall` for earlier work on the topic.
- Before unfamiliar code, use `pstack:how` for mechanics and `pstack:why` for reasons.
- Ask `pstack:teach` to make the case for a choice: "convince me it fixes the cause and not the symptom". A case is easier to check than a summary.

## Design before the plan

- Don't take the first design. Compare prototypes, with screenshots or videos for UI.
- Let prototypes answer open questions. Adversarial review of an abstract plan can invent risks that never happen.
- For a shared package or API, ask for a README or tutorial first, then work back to code. The doc becomes the target.
- Plan after design is settled. Each step ends in a check.

## Follow up short

- "do it", "continue", and "keep going until done" are whole prompts once the thread holds the task.
- Say "new task" when the subject changes so the mode doesn't continue the old playbook.

## Before stepping away

- Say "I'm going to bed" or "I'm stepping away" and pre-answer reversible decisions.
- Write done as checks each iteration can run. Explicitly request an hourly Amp schedule if recurring wakeups are needed; load `building-schedules` to manage it.
- Ask for a fresh worktree off a named base.
- Authorize committing if wanted. Pushing, PR writes, deployment, and other shared changes still need explicit authorization for that action.
- Ask for a decision log to audit later.
- Give an exit: "if you're truly stuck after a few hours, stop and write up why".

## Steer in one line

- "I said the goal is to repro. I did not ask for a fix yet."
- "Apply prove it works. Show me the real output, not the build log."
- A principle name works because the agent read the rule. Its reply names the decision the rule changed.
