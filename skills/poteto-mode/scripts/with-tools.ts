import { join } from "node:path";

import { installToolsIfNeeded } from "./bootstrap.ts";

installToolsIfNeeded();

const args = process.argv.slice(2);
if (args.length === 0) {
	throw new Error("Usage: bun with-tools.ts <bun-args...>");
}

const result = Bun.spawnSync([process.execPath, ...args], {
	cwd: join(import.meta.dir, "../../.."),
	stdin: "inherit",
	stdout: "inherit",
	stderr: "inherit",
});
process.exit(result.exitCode ?? 1);
