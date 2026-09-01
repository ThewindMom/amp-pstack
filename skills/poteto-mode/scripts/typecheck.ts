import { join } from "node:path";

import { installToolsIfNeeded } from "./bootstrap.ts";

installToolsIfNeeded();

const tsc = join(import.meta.dir, "node_modules", "typescript", "bin", "tsc");
const result = Bun.spawnSync(
	[process.execPath, tsc, "--project", "watch-pr/tsconfig.json", "--noEmit", "--strict"],
	{ cwd: import.meta.dir, stdout: "inherit", stderr: "inherit" },
);
process.exit(result.exitCode ?? 1);
