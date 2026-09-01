# Benny for Amp

Benny is a dormant reference workflow for Slack issue intake. It triages one report, then reproduces confirmed bugs and may open a bounded draft fix. Installing amp-pstack does not enable Benny.

Amp replaces the original automation runtime with an orb thread and a capability webhook:

1. Start an orb thread in the target project with the `poteto` mode.
2. In that thread, read [`FOR_AGENTS.md`](./FOR_AGENTS.md) and the setup skill.
3. Create a `benny-report` webhook with `pstack_create_wake_webhook`.
4. Configure the Slack event bridge to POST new top-level reports to that credential URL.
5. Connect Slack thread read/reply, tracker, GitHub, and app-control tools to Amp.
6. Send a harmless test report and verify that every source-channel post remains in the original thread.

Keep the webhook URL and integration tokens in a secret manager. The webhook is at-least-once, so event IDs must be deduplicated.
