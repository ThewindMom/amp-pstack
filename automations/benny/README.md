# Benny for Amp

Benny is a dormant reference workflow for Slack issue intake. It triages one report, then reproduces confirmed bugs and may open a bounded draft fix. Installing amp-pstack does not enable Benny.

Amp replaces the original automation runtime with an orb thread and a capability webhook:

1. Start an orb thread in the target project with the `poteto` mode.
2. Copy this pack into the target repository at `.amp/benny/`, including both operational skills.
3. In that thread, read `.amp/benny/FOR_AGENTS.md` and `.amp/benny/skills/setup-benny/SKILL.md`.
4. Create a `benny-report` webhook with `pstack_create_wake_webhook`.
5. Configure the Slack event bridge to POST new top-level reports to that credential URL.
6. Connect Slack thread read/reply, tracker, GitHub, and app-control tools to Amp.
7. Send a harmless test report and verify that every source-channel post remains in the original thread.

Keep the webhook URL and integration tokens in a secret manager. Amp delivers webhook events at least once. `pstack_create_wake_webhook` appends a wake message first, then records the Amp event ID. A retry that already appears in the thread is recorded and dropped. Also ignore a payload whose Slack event ID was already handled.
