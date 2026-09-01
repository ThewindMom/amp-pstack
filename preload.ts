import { readFileSync } from "node:fs";

import { installToolsIfNeeded } from "./skills/poteto-mode/scripts/bootstrap.ts";

if (process.env.PSTACK_TOOLS_READY === "1") {
	installToolsIfNeeded();
} else {
	installToolsIfNeeded();
	const command = readFileSync("/proc/self/cmdline", "utf8")
		.split("\0")
		.filter(Boolean);
	if (command[1] === "test") {
		const restarted = Bun.spawnSync([process.execPath, ...command.slice(1)], {
			cwd: process.cwd(),
			env: { ...process.env, PSTACK_TOOLS_READY: "1" },
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
		});
		process.exit(restarted.exitCode ?? 1);
	}
}
