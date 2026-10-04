# amp-pstack

Run `.agents/setup`, then `bun run test`, `bun run typecheck:plugin`, and `bun run typecheck:tools`. CI runs the same commands in `.github/workflows/check.yml`.

## Rules and what enforces them

| Rule | Enforced by |
| --- | --- |
| Skill and agent prose runs bundled scripts as `bun\|bash <loaded-skill-base>/scripts/...` and never names `.cursor/` paths. | `skill-paths.test.ts` |
| A fresh clone installs, tests, and typechecks with no manual step. | `.agents/setup`, `preload.ts`, `.github/workflows/check.yml` |
| A parent never redoes or replaces a live child. It reads the returned `threadID` and stops a child only once it is terminal. | `pstack_start_agent` and `pstack_stop_agent` in `index.ts`, covered by `index.test.ts` |
| Ported text matches the pinned upstream unless `upstream-port.json` lists the departure. | `upstream-parity.test.ts` pins named contracts only. Unpinned drift is a judgment call for the port reviewer. |
| After editing plugin code or model maps, reload plugins before judging behavior from a live thread. | Nothing. Judgment call. |
