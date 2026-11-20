#!/usr/bin/env node
/**
 * Thin CLI wrapper around `turbo gen` so all generator commands work seamlessly:
 *   - `pnpm gen lib <name> [description]`              (STE-45)
 *   - `pnpm gen app web <name> [description]`          (STE-46)
 *   - `pnpm gen app service <name> [--infra]`          (STE-47)
 *   - `pnpm gen app android <name> [description]`      (STE-48)
 *   - `pnpm gen <generator> --args ...`
 *   - `pnpm gen` (interactive)
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DESCRIPTIONS = {
  lib: "Shared TypeScript library for the CMP monorepo",
  "ts-library": "Shared TypeScript library for the CMP monorepo",
  "app-web": "Angular 21 Signals web application",
  "app-service": "Spring Boot 4 / Java 21 backend service",
  "app-android": "Android Kotlin + Jetpack Compose application",
};

const APP_SUBCOMMANDS = {
  web: "app-web",
  service: "app-service",
  android: "app-android",
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TURBO_BIN = path.join(ROOT, "node_modules", ".bin", "turbo");

export function buildTurboArgs(rawArgs) {
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : [...rawArgs];
  if (args.length === 0) {
    return ["gen"];
  }

  // Normalize `pnpm gen app <web|service|android> ...` -> `pnpm gen app-<kind> ...`
  let normalized = args;
  if (args[0] === "app" && args.length >= 2 && APP_SUBCOMMANDS[args[1]]) {
    normalized = [APP_SUBCOMMANDS[args[1]], ...args.slice(2)];
  }

  if (
    normalized.length <= 1 ||
    normalized.includes("--args") ||
    normalized[0].startsWith("-")
  ) {
    return ["gen", ...normalized];
  }

  const [generatorName, ...rest] = normalized;

  // Handle `--infra` / `--no-infra` flag for `app-service`
  let includeInfra = false;
  const positionalRest = [];
  for (const token of rest) {
    if (token === "--infra" || token === "--infra=true") {
      includeInfra = true;
    } else if (token === "--no-infra" || token === "--infra=false") {
      includeInfra = false;
    } else if (token.startsWith("-")) {
      return ["gen", ...normalized];
    } else {
      positionalRest.push(token);
    }
  }

  if (positionalRest.length === 0) {
    return ["gen", generatorName];
  }

  const defaultDesc =
    DEFAULT_DESCRIPTIONS[generatorName] ??
    "Generated project for the CMP monorepo";
  const name = positionalRest[0];
  const description = positionalRest[1] ?? defaultDesc;

  if (generatorName === "app-service") {
    const infraAnswer = positionalRest[2] ?? (includeInfra ? "yes" : "no");
    return ["gen", generatorName, "--args", name, description, infraAnswer];
  }

  const answers =
    positionalRest.length === 1 ? [name, defaultDesc] : positionalRest;
  return ["gen", generatorName, "--args", ...answers];
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
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
}
