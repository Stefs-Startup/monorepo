#!/usr/bin/env node
/**
 * Thin CLI wrapper around `turbo gen` so both:
 *   - `pnpm gen lib <name> [description]`
 *   - `pnpm gen lib --args <name> [description]`
 *   - `pnpm gen` (interactive)
 * work seamlessly without positional-arg errors from Turborepo's CLI parser.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DESCRIPTION = "Shared TypeScript library for the CMP monorepo";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TURBO_BIN = path.join(ROOT, "node_modules", ".bin", "turbo");

function buildTurboArgs(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
  if (args.length <= 1 || args.includes("--args") || args[0].startsWith("-")) {
    return ["gen", ...args];
  }

  const [generatorName, ...rest] = args;
  const hasFlags = rest.some((arg) => arg.startsWith("-"));
  if (hasFlags) {
    return ["gen", ...args];
  }

  const answers =
    rest.length === 1 && (generatorName === "lib" || generatorName === "ts-library")
      ? [rest[0], DEFAULT_DESCRIPTION]
      : rest;

  return ["gen", generatorName, "--args", ...answers];
}

const turboArgs = buildTurboArgs(process.argv.slice(2));
const result = spawnSync(TURBO_BIN, turboArgs, {
  cwd: ROOT,
  stdio: "inherit",
});

if (result.error) {
  console.error(`Failed to run turbo gen: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
