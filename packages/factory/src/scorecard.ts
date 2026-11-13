import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { auditRequirementTraceability } from "./req-trace.js";
import { verifyWorkspace } from "./verify.js";

export interface ScorecardCapability {
  name: string;
  passed: boolean;
  score: number;
  details: string;
  [key: string]: unknown;
}

export interface ScorecardCapabilities {
  guardrailsAndAgents: ScorecardCapability;
  reqTraceability: ScorecardCapability;
  archFitness: ScorecardCapability;
  mutationTesting: ScorecardCapability;
  accessibility: ScorecardCapability;
  securityWorkflow: ScorecardCapability;
  shaPinning: ScorecardCapability;
  slsaProvenance: ScorecardCapability;
  propertyTesting: ScorecardCapability;
  agentEvals: ScorecardCapability;
}

export interface DoraGitSignals {
  available: boolean;
  totalCommitsSampled: number;
  commitsLast7Days: number;
  reworkCommits: number;
  reworkRatio: number;
}

export interface ScorecardReport {
  generatedAt: string;
  repo: string;
  overallScore: number;
  capabilities: ScorecardCapabilities;
  doraGitSignals: DoraGitSignals;
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".turbo",
  ".claude",
  "build",
  ".gradle",
  ".build",
]);

function walkMatchingFiles(
  dir: string,
  predicate: (fullPath: string, fileName: string) => boolean,
  collected: string[] = [],
): string[] {
  if (!fs.existsSync(dir)) {
    return collected;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        walkMatchingFiles(fullPath, predicate, collected);
      }
    } else if (entry.isFile() && predicate(fullPath, entry.name)) {
      collected.push(fullPath);
    }
  }
  return collected;
}

function readRepoName(rootDir: string): string {
  const pkgPath = path.join(rootDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
        name?: unknown;
      };
      if (typeof parsed.name === "string" && parsed.name.trim().length > 0) {
        return parsed.name.trim();
      }
    } catch {
      // Fall back to directory basename
    }
  }
  return path.basename(path.resolve(rootDir));
}

function listWorkflowFiles(rootDir: string): string[] {
  const workflowsDir = path.join(rootDir, ".github", "workflows");
  if (!fs.existsSync(workflowsDir)) {
    return [];
  }
  return fs
    .readdirSync(workflowsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")),
    )
    .map((entry) => path.join(workflowsDir, entry.name))
    .sort();
}

function checkGuardrailsAndAgents(rootDir: string): ScorecardCapability {
  const result = verifyWorkspace({ rootDir });
  const passedCount = result.checks.filter((c) => c.passed).length;
  const details = result.passed
    ? `All ${result.checks.length} factory verification checks passed.`
    : result.checks
        .filter((c) => !c.passed)
        .map((c) => `${c.name}: ${c.details}`)
        .join(" | ");
  return {
    name: "Guardrails & AGENTS.md",
    passed: result.passed,
    score: result.passed
      ? 100
      : Math.round((passedCount / Math.max(1, result.checks.length)) * 100),
    details,
  };
}

function checkReqTraceability(rootDir: string): ScorecardCapability {
  const result = auditRequirementTraceability(rootDir);
  const hasReqs = result.totalRequirements > 0;
  const passed = result.passed && hasReqs;
  const score = !hasReqs
    ? 0
    : Math.round((result.coveredRequirements / result.totalRequirements) * 100);
  return {
    name: "REQ-* Traceability",
    passed,
    score,
    details: result.details,
    totalRequirements: result.totalRequirements,
    coveredRequirements: result.coveredRequirements,
    uncovered: result.uncovered,
  };
}

function checkArchFitness(rootDir: string): ScorecardCapability {
  const hasDepCruiser = fs.existsSync(
    path.join(rootDir, ".dependency-cruiser.cjs"),
  );
  const archTests = walkMatchingFiles(
    path.join(rootDir, "apps"),
    (_full, name) => name === "ArchitectureTest.java",
  );
  const hasArchUnit = archTests.length > 0;
  const passed = hasDepCruiser && hasArchUnit;
  const score = (hasDepCruiser ? 50 : 0) + (hasArchUnit ? 50 : 0);
  return {
    name: "Architecture Fitness",
    passed,
    score,
    details: `dependency-cruiser=${hasDepCruiser ? "present" : "missing"}, ArchitectureTest.java=${hasArchUnit ? path.relative(rootDir, archTests[0]) : "missing"}`,
  };
}

function checkMutationTesting(rootDir: string): ScorecardCapability {
  const hasStryker = fs.existsSync(path.join(rootDir, "stryker.config.mjs"));
  const gradleOrPom = walkMatchingFiles(
    path.join(rootDir, "apps"),
    (_full, name) =>
      name === "build.gradle.kts" ||
      name === "build.gradle" ||
      name === "pom.xml",
  );
  const hasPitest = gradleOrPom.some((filePath) =>
    /pitest/i.test(fs.readFileSync(filePath, "utf8")),
  );
  const passed = hasStryker && hasPitest;
  const score = (hasStryker ? 50 : 0) + (hasPitest ? 50 : 0);
  return {
    name: "Mutation Testing",
    passed,
    score,
    details: `stryker.config.mjs=${hasStryker ? "present" : "missing"}, Pitest=${hasPitest ? "configured" : "missing"}`,
  };
}

function checkAccessibility(rootDir: string): ScorecardCapability {
  const hasSpec = fs.existsSync(
    path.join(rootDir, "apps", "web", "e2e", "a11y.spec.ts"),
  );
  const hasWorkflow = fs.existsSync(
    path.join(rootDir, ".github", "workflows", "a11y.yml"),
  );
  const passed = hasSpec && hasWorkflow;
  const score = (hasSpec ? 50 : 0) + (hasWorkflow ? 50 : 0);
  return {
    name: "Accessibility (WCAG)",
    passed,
    score,
    details: `a11y.spec.ts=${hasSpec ? "present" : "missing"}, a11y.yml=${hasWorkflow ? "present" : "missing"}`,
  };
}

function checkSecurityWorkflow(rootDir: string): ScorecardCapability {
  const hasSecurityYml = fs.existsSync(
    path.join(rootDir, ".github", "workflows", "security.yml"),
  );
  const hasLefthook = fs.existsSync(path.join(rootDir, "lefthook.yml"));
  const passed = hasSecurityYml && hasLefthook;
  const score = (hasSecurityYml ? 50 : 0) + (hasLefthook ? 50 : 0);
  return {
    name: "Security & Hooks",
    passed,
    score,
    details: `security.yml=${hasSecurityYml ? "present" : "missing"}, lefthook.yml=${hasLefthook ? "present" : "missing"}`,
  };
}

function checkShaPinning(rootDir: string): ScorecardCapability {
  const workflowFiles = listWorkflowFiles(rootDir);
  if (workflowFiles.length === 0) {
    return {
      name: "Workflow SHA Pinning",
      passed: false,
      score: 0,
      details: "No workflow files found under .github/workflows/.",
      workflowsScanned: 0,
      unpinnedUses: [],
    };
  }

  const unpinnedUses: string[] = [];
  const usesLineRe = /^\s*(?:-\s*)?uses:\s*["']?([^"'\s#]+)["']?/;
  const shaPinRe = /@[0-9a-f]{40}$/i;

  for (const wfPath of workflowFiles) {
    const relPath = path.relative(rootDir, wfPath);
    const lines = fs.readFileSync(wfPath, "utf8").split(/\r?\n/);
    for (let idx = 0; idx < lines.length; idx++) {
      const match = lines[idx].match(usesLineRe);
      if (!match) {
        continue;
      }
      const ref = match[1];
      if (ref.startsWith("./") || ref.startsWith("docker://")) {
        continue;
      }
      if (!shaPinRe.test(ref)) {
        unpinnedUses.push(`${relPath}:${idx + 1}: ${ref}`);
      }
    }
  }

  const passed = unpinnedUses.length === 0;
  return {
    name: "Workflow SHA Pinning",
    passed,
    score: passed ? 100 : 0,
    details: passed
      ? `All external uses: across ${workflowFiles.length} workflow(s) are 40-char SHA pinned.`
      : `Found ${unpinnedUses.length} unpinned uses: ${unpinnedUses.slice(0, 5).join(", ")}${unpinnedUses.length > 5 ? " ..." : ""}`,
    workflowsScanned: workflowFiles.length,
    unpinnedUses,
  };
}

function checkSlsaProvenance(rootDir: string): ScorecardCapability {
  const workflowFiles = listWorkflowFiles(rootDir);
  const matching = workflowFiles.filter((wfPath) =>
    fs.readFileSync(wfPath, "utf8").includes("attest-build-provenance"),
  );
  const passed = matching.length > 0;
  return {
    name: "SLSA Provenance",
    passed,
    score: passed ? 100 : 0,
    details: passed
      ? `attest-build-provenance configured in ${matching.map((f) => path.relative(rootDir, f)).join(", ")}`
      : "No attest-build-provenance step found in .github/workflows/.",
  };
}

function checkPropertyTesting(rootDir: string): ScorecardCapability {
  const roots = [path.join(rootDir, "apps"), path.join(rootDir, "packages")];
  const files: string[] = [];
  for (const r of roots) {
    walkMatchingFiles(
      r,
      (_full, name) => /\.property\.test\.[cm]?[jt]sx?$/i.test(name),
      files,
    );
  }
  const passed = files.length > 0;
  return {
    name: "Property-Based Testing",
    passed,
    score: passed ? 100 : 0,
    details: passed
      ? `Found ${files.length} property test file(s): ${files.map((f) => path.relative(rootDir, f)).join(", ")}`
      : "No *.property.test.* files found under apps/ or packages/.",
    files: files.map((f) => path.relative(rootDir, f)),
  };
}

function checkAgentEvals(rootDir: string): ScorecardCapability {
  const roots = [path.join(rootDir, "apps"), path.join(rootDir, "packages")];
  const files: string[] = [];
  for (const r of roots) {
    walkMatchingFiles(
      r,
      (fullPath, name) =>
        /(?:^|[\\/])evals[\\/]/i.test(fullPath) &&
        /\.eval\.test\.[cm]?[jt]sx?$/i.test(name),
      files,
    );
  }
  const passed = files.length > 0;
  return {
    name: "Agentic Golden Evals",
    passed,
    score: passed ? 100 : 0,
    details: passed
      ? `Found ${files.length} agent eval suite(s): ${files.map((f) => path.relative(rootDir, f)).join(", ")}`
      : "No evals/*.eval.test.* files found under apps/ or packages/.",
    files: files.map((f) => path.relative(rootDir, f)),
  };
}

function collectDoraGitSignals(rootDir: string): DoraGitSignals {
  const res = spawnSync(
    "git",
    ["log", "-n", "50", "--format=%H%x09%cI%x09%s"],
    {
      cwd: rootDir,
      encoding: "utf8",
    },
  );

  if (res.status !== 0 || !res.stdout) {
    return {
      available: false,
      totalCommitsSampled: 0,
      commitsLast7Days: 0,
      reworkCommits: 0,
      reworkRatio: 0,
    };
  }

  const lines = res.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let commitsLast7Days = 0;
  let reworkCommits = 0;

  for (const line of lines) {
    const [, isoDate, subject = ""] = line.split("\t");
    const ts = Date.parse(isoDate ?? "");
    if (!Number.isNaN(ts) && ts >= sevenDaysAgo) {
      commitsLast7Days += 1;
    }
    if (/^(?:revert\b|fixup!|squash!)/i.test(subject)) {
      reworkCommits += 1;
    }
  }

  const totalCommitsSampled = lines.length;
  const reworkRatio =
    totalCommitsSampled > 0
      ? Number((reworkCommits / totalCommitsSampled).toFixed(3))
      : 0;

  return {
    available: true,
    totalCommitsSampled,
    commitsLast7Days,
    reworkCommits,
    reworkRatio,
  };
}

/**
 * Generates a structured release readiness & engineering health scorecard
 * for the given repository root.
 */
export function generateScorecard(rootDir = process.cwd()): ScorecardReport {
  const capabilities: ScorecardCapabilities = {
    guardrailsAndAgents: checkGuardrailsAndAgents(rootDir),
    reqTraceability: checkReqTraceability(rootDir),
    archFitness: checkArchFitness(rootDir),
    mutationTesting: checkMutationTesting(rootDir),
    accessibility: checkAccessibility(rootDir),
    securityWorkflow: checkSecurityWorkflow(rootDir),
    shaPinning: checkShaPinning(rootDir),
    slsaProvenance: checkSlsaProvenance(rootDir),
    propertyTesting: checkPropertyTesting(rootDir),
    agentEvals: checkAgentEvals(rootDir),
  };

  const capList = Object.values(capabilities) as ScorecardCapability[];
  const overallScore = Math.round(
    capList.reduce((sum, cap) => sum + cap.score, 0) / capList.length,
  );

  return {
    generatedAt: new Date().toISOString(),
    repo: readRepoName(rootDir),
    overallScore,
    capabilities,
    doraGitSignals: collectDoraGitSignals(rootDir),
  };
}

/**
 * Formats a scorecard report as a crisp terminal table.
 */
export function formatScorecardTable(scorecard: ScorecardReport): string {
  const capList = Object.values(scorecard.capabilities) as ScorecardCapability[];
  const nameWidth = Math.max(
    10,
    ...capList.map((c) => c.name.length),
  );
  const lines: string[] = [
    `CMP Engineering Scorecard — ${scorecard.repo}`,
    `Generated: ${scorecard.generatedAt} | Overall Score: ${scorecard.overallScore}/100`,
    "",
    `${"Capability".padEnd(nameWidth)}  Status  Score  Details`,
    `${"-".repeat(nameWidth)}  ------  -----  -------`,
  ];

  for (const cap of capList) {
    const status = cap.passed ? "PASS  " : "FAIL  ";
    const scoreStr = `${String(cap.score).padStart(3)}% `;
    lines.push(
      `${cap.name.padEnd(nameWidth)}  ${status}  ${scoreStr}  ${cap.details}`,
    );
  }

  lines.push("");
  if (scorecard.doraGitSignals.available) {
    const d = scorecard.doraGitSignals;
    lines.push(
      `DORA Git Signals (last ${d.totalCommitsSampled} commits): ${d.commitsLast7Days} commits/7d | rework=${d.reworkCommits} (${(d.reworkRatio * 100).toFixed(1)}%)`,
    );
  } else {
    lines.push("DORA Git Signals: unavailable (not a git repository)");
  }

  return lines.join("\n");
}

/**
 * Formats a scorecard report as Markdown for docs/scorecard.md and sticky PR comments.
 */
export function formatScorecardMarkdown(scorecard: ScorecardReport): string {
  const capList = Object.values(scorecard.capabilities) as ScorecardCapability[];
  const passedCount = capList.filter((c) => c.passed).length;
  const d = scorecard.doraGitSignals;

  const rows = capList
    .map((cap) => {
      const status = cap.passed ? "PASS" : "FAIL";
      const escapedDetails = cap.details.replace(/\|/g, "\\|");
      return `| ${cap.name} | ${status} | ${cap.score}% | ${escapedDetails} |`;
    })
    .join("\n");

  const doraSection = d.available
    ? [
        `- **Commits (last 7 days):** ${d.commitsLast7Days}`,
        `- **Commits sampled:** ${d.totalCommitsSampled} (max 50)`,
        `- **Rework commits (\`revert\`/\`fixup!\`/\`squash!\`):** ${d.reworkCommits} (${(d.reworkRatio * 100).toFixed(1)}%)`,
      ].join("\n")
    : "- Git history unavailable in this workspace.";

  return [
    "# Release Readiness & Engineering Scorecard",
    "",
    `- **Repository:** \`${scorecard.repo}\``,
    `- **Overall Score:** **${scorecard.overallScore}/100** (${passedCount}/${capList.length} capabilities passing)`,
    `- **Generated At:** \`${scorecard.generatedAt}\``,
    "",
    "## Capability Checks",
    "",
    "| Capability | Status | Score | Details |",
    "| --- | --- | --- | --- |",
    rows,
    "",
    "## DORA / Git Signals",
    "",
    doraSection,
    "",
    "---",
    "_Refresh locally with `pnpm scorecard -- --write` or `node packages/factory/dist/src/cli.js scorecard --write`._",
    "",
  ].join("\n");
}
