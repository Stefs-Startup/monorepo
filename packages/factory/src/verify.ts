import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  auditThemePalette,
  createZeroPiiBreadcrumb,
  pseudonymizeIdentifier,
  scrubSensitiveText,
} from "@cmp/utils";

export interface VerifyCheckResult {
  name: string;
  passed: boolean;
  details: string;
}

export interface VerifyWorkspaceOptions {
  rootDir?: string;
  target?: string;
  json?: boolean;
}

export interface VerifyWorkspaceResult {
  passed: boolean;
  checks: VerifyCheckResult[];
}

const IGNORED_WALK_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".turbo",
  ".claude",
  "build",
  ".gradle",
]);

function findLeftoverCatalogFiles(rootDir: string): string[] {
  const found: string[] = [];

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_WALK_DIRS.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
      } else if (entry.name === "catalog-info.yaml") {
        found.push(path.relative(rootDir, path.join(dir, entry.name)));
      }
    }
  }

  walk(rootDir);
  return found;
}

function runGuardrailAndAgentsAudit(
  rootDir: string,
  target?: string,
): VerifyCheckResult {
  const appsDir = path.join(rootDir, "apps");
  if (!fs.existsSync(appsDir)) {
    return {
      name: "Guardrail & AGENTS.md Audit",
      passed: false,
      details: `Missing apps directory at ${appsDir}`,
    };
  }

  const allApps = fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();

  const normalizedTarget = target?.replace(/^@cmp\//, "");
  const appsToAudit =
    normalizedTarget && allApps.includes(normalizedTarget)
      ? [normalizedTarget]
      : allApps;

  if (appsToAudit.length === 0) {
    return {
      name: "Guardrail & AGENTS.md Audit",
      passed: false,
      details: "No target apps found under apps/.",
    };
  }

  const violations: string[] = [];
  for (const appName of appsToAudit) {
    const appPath = path.join(appsDir, appName);
    if (!fs.existsSync(path.join(appPath, "AGENTS.md"))) {
      violations.push(`apps/${appName}/AGENTS.md missing`);
    }
    if (!fs.existsSync(path.join(appPath, "README.md"))) {
      violations.push(`apps/${appName}/README.md missing`);
    }
  }

  const leftoverCatalogs = findLeftoverCatalogFiles(rootDir);
  for (const relPath of leftoverCatalogs) {
    violations.push(`Leftover catalog-info.yaml at ${relPath}`);
  }

  if (violations.length > 0) {
    return {
      name: "Guardrail & AGENTS.md Audit",
      passed: false,
      details: violations.join("; "),
    };
  }

  return {
    name: "Guardrail & AGENTS.md Audit",
    passed: true,
    details: `Verified AGENTS.md, README.md, and zero catalog-info.yaml across ${appsToAudit.map((a) => `apps/${a}`).join(", ")}`,
  };
}

function runWcagAndZeroPiiSelfTest(): VerifyCheckResult {
  const paletteAudit = auditThemePalette([
    { pairName: "light.textPrimary", fg: "#111827", bg: "#FFFFFF", minRatio: 4.5 },
    { pairName: "light.textMuted", fg: "#4B5563", bg: "#F9FAFB", minRatio: 4.5 },
    { pairName: "light.accent", fg: "#1D4ED8", bg: "#FFFFFF", minRatio: 4.5 },
    { pairName: "dark.textPrimary", fg: "#F9FAFB", bg: "#0F172A", minRatio: 4.5 },
    { pairName: "dark.textMuted", fg: "#CBD5E1", bg: "#1E293B", minRatio: 4.5 },
    { pairName: "dark.accent", fg: "#93C5FD", bg: "#0F172A", minRatio: 4.5 },
  ]);

  if (!paletteAudit.passed) {
    const failing = paletteAudit.entries
      .filter((entry) => !entry.passesWcagAA)
      .map((entry) => `${entry.pairName}=${entry.contrastRatio}`)
      .join(", ");
    return {
      name: "WCAG 2.2 AA & Zero-PII Self-Test",
      passed: false,
      details: `WCAG 2.2 AA contrast failure: ${failing}`,
    };
  }

  const rawPayload =
    "Auth failed for engineer@example.com with Bearer tok_live_98765 and ya29.oauth_secret_abc";
  const scrubbed = scrubSensitiveText(rawPayload);
  const breadcrumb = createZeroPiiBreadcrumb("verify_self_test", {
    actor: pseudonymizeIdentifier("Engineer@Example.com"),
    payload: rawPayload,
  });

  const hasRawLeak =
    scrubbed.includes("engineer@example.com") ||
    scrubbed.includes("tok_live_98765") ||
    scrubbed.includes("ya29.oauth_secret_abc") ||
    breadcrumb.summary.includes("engineer@example.com") ||
    breadcrumb.summary.includes("tok_live_98765") ||
    breadcrumb.summary.includes("ya29.oauth_secret_abc");

  const hasRedactions =
    scrubbed.includes("[REDACTED_EMAIL]") &&
    scrubbed.includes("[REDACTED_TOKEN]") &&
    breadcrumb.summary.includes("[REDACTED_EMAIL]") &&
    breadcrumb.summary.includes("[REDACTED_TOKEN]");

  const pseudoA = pseudonymizeIdentifier("  User@Example.com ");
  const pseudoB = pseudonymizeIdentifier("user@example.com");
  const pseudoOk =
    pseudoA.length === 16 &&
    pseudoA === pseudoB &&
    pseudonymizeIdentifier("   ") === "anonymous";

  if (hasRawLeak || !hasRedactions || !pseudoOk) {
    return {
      name: "WCAG 2.2 AA & Zero-PII Self-Test",
      passed: false,
      details: "Zero-PII scrubber or pseudonymization invariant failed.",
    };
  }

  return {
    name: "WCAG 2.2 AA & Zero-PII Self-Test",
    passed: true,
    details: `Audited ${paletteAudit.entries.length} light/dark token pairs (>= 4.5:1) and verified Bearer/OAuth/email Zero-PII scrubbing.`,
  };
}

function runPnpmCommand(
  args: string[],
  cwd: string,
): SpawnSyncReturns<string> {
  const env = { ...process.env, CMP_VERIFY_RUNNING: "1" };
  const direct = spawnSync("pnpm", args, {
    cwd,
    encoding: "utf8",
    env,
  });
  if (
    direct.error &&
    (direct.error as NodeJS.ErrnoException).code === "ENOENT"
  ) {
    return spawnSync("npx", ["--yes", "pnpm@9.12.3", ...args], {
      cwd,
      encoding: "utf8",
      env,
    });
  }
  return direct;
}

function runTypecheckAndTestGate(
  rootDir: string,
  target?: string,
): VerifyCheckResult {
  if (process.env.CMP_VERIFY_RUNNING === "1") {
    return {
      name: "Typecheck & Unit Test Gate",
      passed: true,
      details: "Skipped nested pnpm invocation (CMP_VERIFY_RUNNING=1).",
    };
  }

  if (!fs.existsSync(path.join(rootDir, "pnpm-workspace.yaml"))) {
    return {
      name: "Typecheck & Unit Test Gate",
      passed: true,
      details:
        "Skipped workspace pnpm commands (no pnpm-workspace.yaml in isolated rootDir).",
    };
  }

  const scopeArgs = target ? ["--filter", target] : ["-r"];
  const commands: string[][] = [
    [...scopeArgs, "typecheck"],
    [...scopeArgs, "test"],
  ];

  const summaries: string[] = [];
  for (const args of commands) {
    const result = runPnpmCommand(args, rootDir);
    if (result.error) {
      return {
        name: "Typecheck & Unit Test Gate",
        passed: false,
        details: `Failed to execute pnpm ${args.join(" ")}: ${result.error.message}`,
      };
    }
    if (result.status !== 0) {
      const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
      return {
        name: "Typecheck & Unit Test Gate",
        passed: false,
        details: `pnpm ${args.join(" ")} exited with code ${result.status}: ${output.slice(-800)}`,
      };
    }
    summaries.push(`pnpm ${args.join(" ")} (ok)`);
  }

  return {
    name: "Typecheck & Unit Test Gate",
    passed: true,
    details: summaries.join("; "),
  };
}

/**
 * Runs the deterministic Agentic Software Factory verification loop:
 * 1. Guardrail & AGENTS.md Audit
 * 2. WCAG 2.2 AA & Zero-PII Self-Test
 * 3. Typecheck & Unit Test Gate
 */
export function verifyWorkspace(
  options: VerifyWorkspaceOptions = {},
): VerifyWorkspaceResult {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const checks: VerifyCheckResult[] = [
    runGuardrailAndAgentsAudit(rootDir, options.target),
    runWcagAndZeroPiiSelfTest(),
    runTypecheckAndTestGate(rootDir, options.target),
  ];

  return {
    passed: checks.every((check) => check.passed),
    checks,
  };
}
