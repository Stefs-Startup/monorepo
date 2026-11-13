#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateApp,
  generateSlice,
  type FactoryStack,
} from "./generators.js";
import { verifyWorkspace } from "./verify.js";

function printUsage(): void {
  console.log(`Usage: cmp-factory <command> [options]

Commands:
  gen:app <name> [--stack=web-ts|angular-spring|kmp]   Scaffold a new @cmp/<name> app
  gen:slice <app> <slice>                               Scaffold a vertical slice in apps/<app>
  verify [--target=<pkg>] [--json]                      Run factory guardrails, WCAG/Zero-PII, and test gates
`);
}

function readFlagValue(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
    if (arg === flag && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return undefined;
}

function positionalArgs(args: string[]): string[] {
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--stack" || arg === "--target" || arg === "--root") {
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }
    positionals.push(arg);
  }
  return positionals;
}

export function runCli(rawArgv: string[]): number {
  const argv = rawArgv[0] === "--" ? rawArgv.slice(1) : rawArgv;
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return 0;
  }

  try {
    if (command === "gen:app") {
      const [name] = positionalArgs(rest);
      if (!name) {
        console.error("Error: gen:app requires <name>.");
        printUsage();
        return 1;
      }
      const stack = (readFlagValue(rest, "--stack") ?? "web-ts") as FactoryStack;
      const rootDir = readFlagValue(rest, "--root");
      const result = generateApp({ name, stack, rootDir });
      console.log(`Generated app at ${result.appDir}`);
      for (const file of result.filesCreated) {
        console.log(`  + ${file}`);
      }
      return 0;
    }

    if (command === "gen:slice") {
      const [app, slice] = positionalArgs(rest);
      if (!app || !slice) {
        console.error("Error: gen:slice requires <app> <slice>.");
        printUsage();
        return 1;
      }
      const rootDir = readFlagValue(rest, "--root");
      const result = generateSlice({ app, slice, rootDir });
      console.log(`Generated slice at ${result.sliceDir}`);
      for (const file of result.filesCreated) {
        console.log(`  + ${file}`);
      }
      return 0;
    }

    if (command === "verify") {
      const target = readFlagValue(rest, "--target");
      const rootDir = readFlagValue(rest, "--root");
      const json = rest.includes("--json");
      const result = verifyWorkspace({ rootDir, target, json });

      if (json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        for (const check of result.checks) {
          const icon = check.passed ? "PASS" : "FAIL";
          console.log(`[${icon}] ${check.name}: ${check.details}`);
        }
        console.log(
          result.passed
            ? "Factory verification passed."
            : "Factory verification failed.",
        );
      }
      return result.passed ? 0 : 1;
    }

    console.error(`Unknown command: ${command}`);
    printUsage();
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    return 1;
  }
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
  process.exitCode = runCli(process.argv.slice(2));
}
