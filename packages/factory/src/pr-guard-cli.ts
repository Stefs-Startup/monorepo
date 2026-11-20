#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MAX_OPEN_AGENT_PRS,
  DEFAULT_STALE_AGENT_PR_DAYS,
  evaluatePullRequestGuard,
  evaluateStaleAgentPrs,
  type PullRequestSnapshot,
} from "./pr-guard-policy.js";

interface SnapshotEnvelope {
  targetPr?: PullRequestSnapshot;
  openPrs?: PullRequestSnapshot[];
}

function printUsage(): void {
  console.log(`Usage: cmp-pr-guard --mode=pr|stale --input=<json-file> [options]

Options:
  --mode=<pr|stale>         Evaluation mode (single PR guard vs stale sweep)
  --input=<path>            JSON file containing PullRequestSnapshot[] or { openPrs, targetPr? }
  --pr=<number>             Target PR number (required for --mode=pr unless targetPr is in JSON)
  --max-open=<number>       Max concurrent open coding-agent PRs (default ${DEFAULT_MAX_OPEN_AGENT_PRS})
  --fail-on-violation       Exit 1 when --mode=pr returns shouldFail=true
  --now=<iso-timestamp>     Evaluation timestamp for --mode=stale (defaults to current time)
  --stale-days=<number>     Inactivity window in days for --mode=stale (default ${DEFAULT_STALE_AGENT_PR_DAYS})
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

function parseIntegerFlag(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Flag ${name} must be a positive integer, got '${raw}'.`);
  }
  return parsed;
}

function loadSnapshot(inputPath: string): {
  openPrs: PullRequestSnapshot[];
  targetPr?: PullRequestSnapshot;
} {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Input snapshot file not found: ${resolved}`);
  }
  const parsed = JSON.parse(fs.readFileSync(resolved, "utf8")) as
    | PullRequestSnapshot[]
    | SnapshotEnvelope;

  if (Array.isArray(parsed)) {
    return { openPrs: parsed };
  }
  return {
    openPrs: parsed.openPrs ?? [],
    targetPr: parsed.targetPr,
  };
}

/**
 * Evaluates a GitHub PR snapshot JSON file in `pr` or `stale` mode and prints
 * a deterministic JSON decision to stdout for local parity and CI scripts.
 */
export function runPrGuardCli(rawArgv: readonly string[]): number {
  const argv = rawArgv[0] === "--" ? rawArgv.slice(1) : rawArgv;
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return 0;
  }

  try {
    const mode = readFlagValue(argv, "--mode");
    const inputPath = readFlagValue(argv, "--input");
    if (!mode || !inputPath) {
      console.error("Error: Both --mode and --input are required.");
      printUsage();
      return 1;
    }

    const snapshot = loadSnapshot(inputPath);

    if (mode === "pr") {
      const prRaw = readFlagValue(argv, "--pr");
      const prNumber = prRaw
        ? parseIntegerFlag(prRaw, 0, "--pr")
        : snapshot.targetPr?.number;
      if (!prNumber) {
        console.error("Error: --pr=<number> is required for --mode=pr.");
        return 1;
      }

      const targetPr =
        snapshot.targetPr && snapshot.targetPr.number === prNumber
          ? snapshot.targetPr
          : snapshot.openPrs.find((p) => p.number === prNumber);

      if (!targetPr) {
        console.error(`Error: PR #${prNumber} not found in snapshot.`);
        return 1;
      }

      const maxOpenAgentPrs = parseIntegerFlag(
        readFlagValue(argv, "--max-open"),
        DEFAULT_MAX_OPEN_AGENT_PRS,
        "--max-open",
      );
      const decision = evaluatePullRequestGuard(targetPr, snapshot.openPrs, {
        maxOpenAgentPrs,
      });
      console.log(JSON.stringify(decision, null, 2));

      if (argv.includes("--fail-on-violation") && decision.shouldFail) {
        return 1;
      }
      return 0;
    }

    if (mode === "stale") {
      const nowIso = readFlagValue(argv, "--now") ?? new Date().toISOString();
      const staleDays = parseIntegerFlag(
        readFlagValue(argv, "--stale-days"),
        DEFAULT_STALE_AGENT_PR_DAYS,
        "--stale-days",
      );
      const result = evaluateStaleAgentPrs(snapshot.openPrs, nowIso, {
        staleDays,
      });
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }

    console.error(`Error: Unknown --mode '${mode}'. Expected 'pr' or 'stale'.`);
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
  process.exitCode = runPrGuardCli(process.argv.slice(2));
}
