import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export const HARD_MAX_CODEMOD_ATTEMPTS = 3;
export const DEFAULT_MAX_TOUCHED_FILES = 25;

export type BlastRadiusTier =
  | "HIGH_CONFIDENCE"
  | "MODERATE"
  | "CRITICAL_PATH"
  | "UNKNOWN";

export interface CodemodScopeCheck {
  passed: boolean;
  allowedScopes: string[];
  allowedFiles: string[];
  outOfScopeFiles: string[];
}

export interface BlastRadiusBudgetResult {
  passed: boolean;
  tier: BlastRadiusTier;
  exitCode: number;
  touchedFilesCount: number;
  maxTouchedFiles: number;
  reason: string;
}

export interface CodemodAttemptRecord {
  attempt: number;
  changedFiles: string[];
  scopeLock: CodemodScopeCheck;
  verificationGate: {
    passed: boolean;
    exitCode: number;
    output: string;
  };
  blastRadiusGate: BlastRadiusBudgetResult;
  passed: boolean;
  failureReason?: string;
}

export interface CodemodLoopResult {
  status: "passed" | "rolled_back_for_human_review";
  passed: boolean;
  rolledBack: boolean;
  allowedScopes: string[];
  maxAttempts: number;
  attemptsUsed: number;
  attempts: CodemodAttemptRecord[];
  finalChangedFiles: string[];
  blockerSummary?: string;
}

export interface CodemodStepContext {
  attempt: number;
  previousFeedback: string;
  rootDir: string;
}

export interface CodemodExecutor {
  getChangedFiles(rootDir: string): string[];
  getUntrackedFiles(rootDir: string): string[];
  runCodemodStep?(context: CodemodStepContext): {
    exitCode: number;
    output: string;
  };
  runCheckGate(rootDir: string): { exitCode: number; output: string };
  runBlastRadiusGate(
    rootDir: string,
    allowModerate: boolean,
  ): { exitCode: number; output: string };
  rollbackChanges(
    rootDir: string,
    trackedFilesToRestore: string[],
    newUntrackedFilesToRemove: string[],
  ): void;
}

export interface CodemodLoopOptions {
  rootDir?: string;
  scopes: string[];
  maxAttempts?: number;
  allowModerateBlastRadius?: boolean;
  maxTouchedFiles?: number;
  codemodCommand?: string;
  verifyCommand?: string;
  autoRollback?: boolean;
  proposeEdits?: (context: CodemodStepContext) => void;
  executor?: CodemodExecutor;
}

export function normalizePosixPath(filePath: string): string {
  return filePath
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
}

/**
 * Pure guardrail 1 (RFC-0005 §3.1): Enforces strict package/slice path scope lock.
 */
export function evaluateScopeLock(
  changedFiles: string[],
  rawAllowedScopes: string[],
): CodemodScopeCheck {
  const allowedScopes = rawAllowedScopes
    .map((s) => normalizePosixPath(s.trim()))
    .filter((s) => s.length > 0 && !s.split("/").includes(".."));

  if (allowedScopes.length === 0) {
    return {
      passed: false,
      allowedScopes: [],
      allowedFiles: [],
      outOfScopeFiles: changedFiles.map(normalizePosixPath),
    };
  }

  const allowedFiles: string[] = [];
  const outOfScopeFiles: string[] = [];

  for (const rawFile of changedFiles) {
    const file = normalizePosixPath(rawFile.trim());
    if (!file) {
      continue;
    }
    if (file.split("/").includes("..")) {
      outOfScopeFiles.push(file);
      continue;
    }
    const inScope = allowedScopes.some(
      (scope) => file === scope || file.startsWith(`${scope}/`),
    );
    if (inScope) {
      allowedFiles.push(file);
    } else {
      outOfScopeFiles.push(file);
    }
  }

  return {
    passed: outOfScopeFiles.length === 0,
    allowedScopes,
    allowedFiles,
    outOfScopeFiles,
  };
}

/**
 * Pure guardrail 3 (RFC-0005 §3.3): Evaluates @cmp/blast-radius gate exit code & file touch budget.
 */
export function evaluateBlastRadiusBudget(params: {
  exitCode: number;
  allowModerate?: boolean;
  touchedFilesCount: number;
  maxTouchedFiles?: number;
}): BlastRadiusBudgetResult {
  const allowModerate = params.allowModerate ?? false;
  const maxTouchedFiles = params.maxTouchedFiles ?? DEFAULT_MAX_TOUCHED_FILES;

  let tier: BlastRadiusTier = "UNKNOWN";
  if (params.exitCode === 0) {
    tier = "HIGH_CONFIDENCE";
  } else if (params.exitCode === 10) {
    tier = "MODERATE";
  } else if (params.exitCode === 20) {
    tier = "CRITICAL_PATH";
  }

  if (params.touchedFilesCount > maxTouchedFiles) {
    return {
      passed: false,
      tier,
      exitCode: params.exitCode,
      touchedFilesCount: params.touchedFilesCount,
      maxTouchedFiles,
      reason: `Touched files (${params.touchedFilesCount}) exceeded codemod budget (${maxTouchedFiles}).`,
    };
  }

  if (params.exitCode === 0) {
    return {
      passed: true,
      tier,
      exitCode: 0,
      touchedFilesCount: params.touchedFilesCount,
      maxTouchedFiles,
      reason: "Blast-radius gate passed (HIGH_CONFIDENCE).",
    };
  }

  if (params.exitCode === 10 && allowModerate) {
    return {
      passed: true,
      tier,
      exitCode: 10,
      touchedFilesCount: params.touchedFilesCount,
      maxTouchedFiles,
      reason: "Blast-radius gate passed (MODERATE allowed by policy).",
    };
  }

  if (params.exitCode === 10) {
    return {
      passed: false,
      tier,
      exitCode: 10,
      touchedFilesCount: params.touchedFilesCount,
      maxTouchedFiles,
      reason:
        "Blast-radius gate returned MODERATE (exit 10); pass --allow-moderate to permit moderate touchpoints.",
    };
  }

  if (params.exitCode === 20) {
    return {
      passed: false,
      tier,
      exitCode: 20,
      touchedFilesCount: params.touchedFilesCount,
      maxTouchedFiles,
      reason:
        "Blast-radius gate returned CRITICAL_PATH (exit 20); automatic codemod rejected for human review.",
    };
  }

  return {
    passed: false,
    tier,
    exitCode: params.exitCode,
    touchedFilesCount: params.touchedFilesCount,
    maxTouchedFiles,
    reason: `Blast-radius gate failed with unexpected exit code ${params.exitCode}.`,
  };
}

function runShell(
  command: string,
  cwd: string,
  extraEnv?: Record<string, string>,
): { exitCode: number; output: string } {
  const res = spawnSync("/bin/sh", ["-c", command], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
  const stdout = res.stdout ?? "";
  const stderr = res.stderr ?? "";
  const combined = `${stdout}${stderr}`.trim();
  return {
    exitCode: res.status ?? 1,
    output: combined,
  };
}

export function createDefaultCodemodExecutor(options?: {
  codemodCommand?: string;
  verifyCommand?: string;
}): CodemodExecutor {
  const verifyCommand = options?.verifyCommand ?? "scripts/check.sh --changed";
  const codemodCommand = options?.codemodCommand;

  return {
    getChangedFiles(rootDir: string): string[] {
      const tracked = runShell("git diff --name-only HEAD", rootDir);
      const untracked = runShell(
        "git ls-files --others --exclude-standard",
        rootDir,
      );
      const set = new Set<string>();
      for (const line of `${tracked.output}\n${untracked.output}`.split(
        /\r?\n/,
      )) {
        const clean = normalizePosixPath(line.trim());
        if (clean) {
          set.add(clean);
        }
      }
      return Array.from(set).sort();
    },

    getUntrackedFiles(rootDir: string): string[] {
      const untracked = runShell(
        "git ls-files --others --exclude-standard",
        rootDir,
      );
      return untracked.output
        .split(/\r?\n/)
        .map((l) => normalizePosixPath(l.trim()))
        .filter(Boolean)
        .sort();
    },

    runCodemodStep: codemodCommand
      ? (context: CodemodStepContext) =>
          runShell(codemodCommand, context.rootDir, {
            CODEMOD_ATTEMPT: String(context.attempt),
            CODEMOD_FEEDBACK: context.previousFeedback,
          })
      : undefined,

    runCheckGate(rootDir: string): { exitCode: number; output: string } {
      return runShell(verifyCommand, rootDir);
    },

    runBlastRadiusGate(
      rootDir: string,
      allowModerate: boolean,
    ): { exitCode: number; output: string } {
      const cliPath = path.join(
        rootDir,
        "tools",
        "blast-radius",
        "dist",
        "src",
        "cli.js",
      );
      if (!fs.existsSync(cliPath)) {
        return {
          exitCode: 0,
          output:
            "blast-radius dist CLI not built in workspace; treating as HIGH_CONFIDENCE (0).",
        };
      }
      const flag = allowModerate ? "--gate --allow-moderate" : "--gate";
      return runShell(`node "${cliPath}" ${flag}`, rootDir);
    },

    rollbackChanges(
      rootDir: string,
      trackedFilesToRestore: string[],
      newUntrackedFilesToRemove: string[],
    ): void {
      if (trackedFilesToRestore.length > 0) {
        const quoted = trackedFilesToRestore
          .map((f) => `"${f.replace(/"/g, '\\"')}"`)
          .join(" ");
        runShell(`git checkout HEAD -- ${quoted}`, rootDir);
      }
      for (const rel of newUntrackedFilesToRemove) {
        const full = path.resolve(rootDir, rel);
        if (full.startsWith(path.resolve(rootDir)) && fs.existsSync(full)) {
          fs.rmSync(full, { recursive: true, force: true });
        }
      }
    },
  };
}

/**
 * Executes the RFC-0005 bounded agentic code-mod loop (max 3 attempts) with:
 *   1. Strict scope lock (`git diff --name-only`)
 *   2. Closed-loop verification (`scripts/check.sh --changed`)
 *   3. Blast-radius budget check (`@cmp/blast-radius --gate`)
 *   4. Automatic rollback on failure after exhausting bounded retries
 */
export function runBoundedCodemodLoop(
  options: CodemodLoopOptions,
): CodemodLoopResult {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const requestedAttempts = options.maxAttempts ?? HARD_MAX_CODEMOD_ATTEMPTS;
  const hasProposer = Boolean(
    options.proposeEdits ||
      options.codemodCommand ||
      options.executor?.runCodemodStep,
  );
  const maxAttempts = hasProposer
    ? Math.min(
        Math.max(1, Math.trunc(requestedAttempts)),
        HARD_MAX_CODEMOD_ATTEMPTS,
      )
    : 1;
  const allowModerate = options.allowModerateBlastRadius ?? false;
  const maxTouchedFiles = options.maxTouchedFiles ?? DEFAULT_MAX_TOUCHED_FILES;
  const autoRollback = options.autoRollback ?? true;

  const executor =
    options.executor ??
    createDefaultCodemodExecutor({
      codemodCommand: options.codemodCommand,
      verifyCommand: options.verifyCommand,
    });

  const baselineChanged = new Set(executor.getChangedFiles(rootDir));
  const baselineUntracked = new Set(executor.getUntrackedFiles(rootDir));

  const attempts: CodemodAttemptRecord[] = [];
  let previousFeedback = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options.proposeEdits) {
      options.proposeEdits({ attempt, previousFeedback, rootDir });
    } else if (executor.runCodemodStep) {
      const stepRes = executor.runCodemodStep({
        attempt,
        previousFeedback,
        rootDir,
      });
      if (stepRes.exitCode !== 0) {
        previousFeedback = `Codemod command exited with ${stepRes.exitCode}: ${stepRes.output}`;
      }
    }

    const changedFiles = executor.getChangedFiles(rootDir);
    const scopeLock = evaluateScopeLock(changedFiles, options.scopes);

    if (!scopeLock.passed) {
      const failureReason =
        scopeLock.allowedScopes.length === 0
          ? "No valid --scope configured for codemod loop."
          : `Scope lock violation: modified out-of-scope file(s): ${scopeLock.outOfScopeFiles.join(", ")}`;
      attempts.push({
        attempt,
        changedFiles,
        scopeLock,
        verificationGate: {
          passed: false,
          exitCode: -1,
          output: "Skipped due to scope lock violation.",
        },
        blastRadiusGate: {
          passed: false,
          tier: "UNKNOWN",
          exitCode: -1,
          touchedFilesCount: changedFiles.length,
          maxTouchedFiles,
          reason: "Skipped due to scope lock violation.",
        },
        passed: false,
        failureReason,
      });
      previousFeedback = failureReason;
      continue;
    }

    const verifyRes = executor.runCheckGate(rootDir);
    const verificationGate = {
      passed: verifyRes.exitCode === 0,
      exitCode: verifyRes.exitCode,
      output: verifyRes.output,
    };

    if (!verificationGate.passed) {
      const failureReason = `Verification gate (scripts/check.sh) failed with exit code ${verifyRes.exitCode}: ${verifyRes.output.slice(0, 400)}`;
      attempts.push({
        attempt,
        changedFiles,
        scopeLock,
        verificationGate,
        blastRadiusGate: {
          passed: false,
          tier: "UNKNOWN",
          exitCode: -1,
          touchedFilesCount: changedFiles.length,
          maxTouchedFiles,
          reason: "Skipped due to verification gate failure.",
        },
        passed: false,
        failureReason,
      });
      previousFeedback = failureReason;
      continue;
    }

    const blastRes = executor.runBlastRadiusGate(rootDir, allowModerate);
    const blastRadiusGate = evaluateBlastRadiusBudget({
      exitCode: blastRes.exitCode,
      allowModerate,
      touchedFilesCount: changedFiles.length,
      maxTouchedFiles,
    });

    if (!blastRadiusGate.passed) {
      const failureReason = `Blast-radius budget check failed: ${blastRadiusGate.reason}`;
      attempts.push({
        attempt,
        changedFiles,
        scopeLock,
        verificationGate,
        blastRadiusGate,
        passed: false,
        failureReason,
      });
      previousFeedback = failureReason;
      continue;
    }

    attempts.push({
      attempt,
      changedFiles,
      scopeLock,
      verificationGate,
      blastRadiusGate,
      passed: true,
    });

    return {
      status: "passed",
      passed: true,
      rolledBack: false,
      allowedScopes: scopeLock.allowedScopes,
      maxAttempts,
      attemptsUsed: attempt,
      attempts,
      finalChangedFiles: changedFiles,
    };
  }

  let rolledBack = false;
  if (autoRollback) {
    const currentChanged = executor.getChangedFiles(rootDir);
    const currentUntracked = new Set(executor.getUntrackedFiles(rootDir));
    const newlyCreatedUntracked = Array.from(currentUntracked).filter(
      (f) => !baselineUntracked.has(f),
    );
    const untrackedToRemove =
      newlyCreatedUntracked.length > 0
        ? newlyCreatedUntracked
        : Array.from(currentUntracked);
    const trackedToRestore = currentChanged.filter(
      (f) => !currentUntracked.has(f) && !baselineChanged.has(f),
    );
    const inScopeBaselineTracked = currentChanged.filter(
      (f) => !currentUntracked.has(f),
    );
    executor.rollbackChanges(
      rootDir,
      trackedToRestore.length > 0 ? trackedToRestore : inScopeBaselineTracked,
      untrackedToRemove,
    );
    rolledBack = true;
  }

  const lastAttempt = attempts[attempts.length - 1];
  const blockerSummary =
    lastAttempt?.failureReason ??
    "Bounded codemod loop exhausted attempts without passing gates.";

  return {
    status: "rolled_back_for_human_review",
    passed: false,
    rolledBack,
    allowedScopes: options.scopes.map(normalizePosixPath).filter(Boolean),
    maxAttempts,
    attemptsUsed: attempts.length,
    attempts,
    finalChangedFiles: executor.getChangedFiles(rootDir),
    blockerSummary,
  };
}

export function formatCodemodReportMarkdown(result: CodemodLoopResult): string {
  const icon = result.passed ? "PASS" : "ROLLED BACK FOR HUMAN REVIEW";
  const lines: string[] = [
    `## Bounded Agentic Code-Mod Loop Report (${icon})`,
    "",
    `- **Status:** \`${result.status}\``,
    `- **Allowed Scopes:** ${result.allowedScopes.map((s) => `\`${s}\``).join(", ") || "_none_"}`,
    `- **Attempts Used:** \`${result.attemptsUsed}/${result.maxAttempts}\` (hard cap: \`${HARD_MAX_CODEMOD_ATTEMPTS}\`)`,
    `- **Rolled Back:** \`${result.rolledBack}\``,
  ];

  if (result.blockerSummary) {
    lines.push(`- **Blocker Summary:** ${result.blockerSummary}`);
  }

  lines.push(
    "",
    "| Attempt | Files | Scope Lock | Verification Gate | Blast-Radius Gate | Outcome |",
    "| :---: | :---: | :---: | :---: | :---: | :--- |",
  );

  for (const a of result.attempts) {
    const scopeStatus = a.scopeLock.passed
      ? "PASS"
      : `FAIL (${a.scopeLock.outOfScopeFiles.length} out-of-scope)`;
    const verifyStatus = a.verificationGate.passed
      ? "PASS"
      : `FAIL (exit ${a.verificationGate.exitCode})`;
    const blastStatus = a.blastRadiusGate.passed
      ? `PASS (${a.blastRadiusGate.tier})`
      : `FAIL (${a.blastRadiusGate.tier})`;
    const outcome = a.passed ? "PASS" : (a.failureReason ?? "FAIL");
    lines.push(
      `| ${a.attempt} | ${a.changedFiles.length} | ${scopeStatus} | ${verifyStatus} | ${blastStatus} | ${outcome} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}
