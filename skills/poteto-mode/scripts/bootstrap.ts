import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const scriptsDirectory = import.meta.dir;
const nodeModulesDirectory = join(scriptsDirectory, "node_modules");
const commanderPackagePath = join(
  nodeModulesDirectory,
  "commander",
  "package.json",
);
const bunTypesPath = join(nodeModulesDirectory, "bun-types", "package.json");
const typescriptPath = join(nodeModulesDirectory, "typescript", "package.json");
const installKeyPath = join(
  nodeModulesDirectory,
  ".poteto-mode-tools-install-key",
);

function currentInstallKey(): string {
  return createHash("sha256")
    .update(readFileSync(join(scriptsDirectory, "package.json")))
    .update("\0")
    .update(readFileSync(join(scriptsDirectory, "bun.lock")))
    .digest("hex");
}

function toolsInstalled(installKey: string): boolean {
  return (
    existsSync(commanderPackagePath) &&
    existsSync(bunTypesPath) &&
    existsSync(typescriptPath) &&
    existsSync(installKeyPath) &&
    readFileSync(installKeyPath, "utf8").trim() === installKey
  );
}

export function installToolsIfNeeded(): boolean {
  const installKey = currentInstallKey();
  if (toolsInstalled(installKey)) return false;

  const result = Bun.spawnSync(
    [process.execPath, "install", "--frozen-lockfile"],
    { cwd: scriptsDirectory },
  );
  if (result.exitCode !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(
      `bun install --frozen-lockfile exited with status ${result.exitCode}`,
    );
  }
  if (!existsSync(commanderPackagePath)) {
    throw new Error(
      "bun install --frozen-lockfile completed without installing commander",
    );
  }
  if (!existsSync(bunTypesPath) || !existsSync(typescriptPath)) {
    throw new Error(
      "bun install --frozen-lockfile completed without installing bun-types and typescript",
    );
  }

  writeFileSync(installKeyPath, `${installKey}\n`);
  return true;
}

export function ensureDependenciesInstalled(): void {
  if (!installToolsIfNeeded()) return;

  const restarted = Bun.spawnSync([process.execPath, ...process.argv.slice(1)], {
    cwd: process.cwd(),
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exit(restarted.exitCode ?? 1);
}
