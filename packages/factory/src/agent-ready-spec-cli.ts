#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgentReadySpec } from "./agent-ready-spec.js";

function printUsage(): void {
  console.log(`Usage: cmp-spec-validate <markdown-file> [--json] [--root=<dir>]

Validates a Linear agent-ready issue specification against:
  - ## Context
  - ## Constraints
  - ## Acceptance criteria (must include verifiable tests/commands)
  - ## Out of scope
`);
}

function readFlagValue(args: readonly string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
    if (arg === flag && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return undefined;
}

function extractPositionalFile(args: readonly string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg === "--root") {
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }
    return arg;
  }
  return undefined;
}

/**
 * Validates an agent-ready Markdown spec file and reports pass/fail status
 * in human-readable text or JSON.
 */
export function runSpecValidateCli(rawArgv: readonly string[]): number {
  const argv = rawArgv[0] === "--" ? rawArgv.slice(1) : rawArgv;
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return 0;
  }

  const fileArg = extractPositionalFile(argv);
  if (!fileArg) {
    console.error("Error: <markdown-file> path is required.");
    printUsage();
    return 1;
  }

  const rootDir = readFlagValue(argv, "--root") ?? process.cwd();
  const resolvedFile = path.isAbsolute(fileArg)
    ? fileArg
    : path.resolve(rootDir, fileArg);
  if (!fs.existsSync(resolvedFile)) {
    console.error(`Error: Spec file not found: ${resolvedFile}`);
    return 1;
  }

  const json = argv.includes("--json");
  const result = validateAgentReadySpec(resolvedFile, rootDir);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Agent-Ready Spec: ${result.passed ? "PASS" : "FAIL"}`);
    for (const err of result.errors) {
      console.log(`  [ERROR] (${err.code}): ${err.message}`);
    }
    for (const warning of result.criticWarnings) {
      console.log(
        `  [WARN] (${warning.category} -> ${warning.escalation}): ${warning.message}`,
      );
    }
  }

  return result.passed ? 0 : 1;
}

function isExecutedDirectly(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  try {
    const invoked = fs.realpathSync(path.resolve(process.argv[1]));
    const current = fs.realpathSync(fileURLToPath(import.meta.url));
    return invoked === current;
  } catch {
    return false;
  }
}

if (isExecutedDirectly()) {
  process.exitCode = runSpecValidateCli(process.argv.slice(2));
}
