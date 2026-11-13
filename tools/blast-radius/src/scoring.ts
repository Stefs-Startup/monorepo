import type {
  AffectedFileSummary,
  ConfidenceTier,
  CriticalPathTag,
  DependencyDelta,
  DtoContractTouchpoint,
  GateExitCode,
  OpenRewriteSummary,
  SbomReport,
  ScoringSummary,
} from "./types.js";

const HIGH_SEVERITY_TAGS = new Set<CriticalPathTag>([
  "@SecurityFilterChain",
  "@Transactional",
  "@RestController",
  "@Controller",
  "@Service",
  "@Repository",
  "@Injectable",
  "Signal",
  "RxJS",
  "DTO",
]);

const BOUNDARY_TAGS = new Set<CriticalPathTag>([
  "@SecurityFilterChain",
  "@Transactional",
  "@RestController",
  "@Controller",
  "DTO",
]);

export interface ComputeScoringInput {
  dependencies: DependencyDelta[];
  affectedFiles: AffectedFileSummary[];
  dtoContracts: DtoContractTouchpoint[];
  sbom: SbomReport;
  openRewrite: OpenRewriteSummary;
}

function isTestFilePath(filePath: string): boolean {
  return /\.(?:spec|test)\.[cm]?[jt]sx?$/i.test(filePath) || filePath.includes("/src/test/");
}

function isBuildOrTestOnlyCoord(dep: DependencyDelta): boolean {
  const lower = dep.name.toLowerCase();
  if (dep.ecosystem === "gradle" || dep.ecosystem === "maven") {
    return (
      lower.includes(".gradle.plugin") ||
      lower.includes("pitest") ||
      lower.includes("openrewrite") ||
      lower.includes("archunit") ||
      lower.includes("junit") ||
      lower.includes("mockwebserver") ||
      lower.includes("mockito") ||
      lower.includes("assertj")
    );
  }
  return (
    lower === "typescript" ||
    lower === "rimraf" ||
    lower === "vitest" ||
    lower === "eslint" ||
    lower === "prettier" ||
    lower === "turbo" ||
    lower === "lefthook" ||
    lower.startsWith("@types/") ||
    lower.startsWith("@testing-library/") ||
    lower === "jsdom" ||
    lower.includes("vite") ||
    lower.includes("esbuild") ||
    lower.includes("rollup")
  );
}

/**
 * Computes deterministic effort score (0..100), Confidence Tier, and Gate Exit Code.
 */
export function computeScoringSummary(
  input: ComputeScoringInput,
): ScoringSummary {
  const { dependencies, affectedFiles, dtoContracts, sbom, openRewrite } = input;
  const rationale: string[] = [];

  const majorBumpCount = dependencies.filter((d) => d.bumpKind === "major").length;
  const minorOrAddedCount = dependencies.filter(
    (d) => d.bumpKind === "minor" || d.bumpKind === "added" || d.bumpKind === "removed",
  ).length;
  const patchBumpCount = dependencies.filter(
    (d) => d.bumpKind === "patch" || d.bumpKind === "updated",
  ).length;

  const prodAffectedFiles = affectedFiles.filter((f) => !isTestFilePath(f.filePath));
  const criticalFiles = prodAffectedFiles.filter((f) => f.isCriticalPath);
  const nonCriticalProdFiles = prodAffectedFiles.filter((f) => !f.isCriticalPath);

  if (dependencies.length === 0) {
    rationale.push("No dependency version changes detected between base and head.");
    return {
      effortScore: 0,
      confidenceTier: "HIGH CONFIDENCE / AUTO-MERGE",
      gateExitCode: 0,
      autoMergeEligible: true,
      rationale,
      breakdown: {
        dependencyDeltaCount: 0,
        majorBumpCount: 0,
        minorOrAddedCount: 0,
        patchBumpCount: 0,
        affectedFileCount: 0,
        criticalPathFileCount: 0,
        dtoContractCount: 0,
        sbomAlertCount: sbom.alerts.length,
        openRewriteChangedFiles: openRewrite.filesChanged,
      },
    };
  }

  let score = 0;

  // Dependency bump contribution (bounded so lockfile churn with 0 prod AST hits stays low)
  const affectedProdDepIds = new Set(
    prodAffectedFiles.flatMap((f) => f.matchedDependencyIds),
  );
  let directRuntimeScore = 0;
  let auxDepScore = 0;
  for (const dep of dependencies) {
    const isAux = !dep.direct || isBuildOrTestOnlyCoord(dep);
    const hitProdCode = affectedProdDepIds.has(dep.id);
    if (dep.bumpKind === "major") {
      if (isAux) auxDepScore += 4;
      else directRuntimeScore += 18;
    } else if (
      dep.bumpKind === "minor" ||
      dep.bumpKind === "added" ||
      dep.bumpKind === "removed"
    ) {
      if (isAux) auxDepScore += 0.5;
      else if (dep.bumpKind === "added" && !hitProdCode) auxDepScore += 1;
      else directRuntimeScore += 6;
    } else {
      if (isAux) auxDepScore += 0.25;
      else directRuntimeScore += 2;
    }
  }
  score += Math.min(36, Math.round(directRuntimeScore)) + Math.min(8, Math.round(auxDepScore));

  // AST touchpoint contribution
  score += Math.min(20, nonCriticalProdFiles.length * 6);
  score += Math.min(45, criticalFiles.length * 14);
  score += Math.min(20, dtoContracts.length * 4);

  const hasSecurityOrTx = criticalFiles.some(
    (f) =>
      f.criticalPathTags.includes("@SecurityFilterChain") ||
      f.criticalPathTags.includes("@Transactional"),
  );
  if (hasSecurityOrTx) {
    score += 18;
  }

  const highSbomAlerts = sbom.alerts.filter(
    (a) => a.severity === "critical" || a.severity === "high",
  );
  const otherSbomAlerts = sbom.alerts.filter(
    (a) => a.severity !== "critical" && a.severity !== "high",
  );
  if (highSbomAlerts.length > 0) {
    score += Math.min(35, highSbomAlerts.length * 25);
  }
  if (otherSbomAlerts.length > 0) {
    score += Math.min(15, otherSbomAlerts.length * 8);
  }

  const openRewriteCodeFiles = openRewrite.files.filter(
    (f) =>
      f.filePath.endsWith(".java") ||
      f.filePath.endsWith(".kt") ||
      (f.filePath.endsWith(".ts") && !isTestFilePath(f.filePath)),
  );
  if (openRewriteCodeFiles.length > 0 && prodAffectedFiles.length > 0) {
    score += Math.min(12, openRewriteCodeFiles.length * 3);
  }

  const effortScore = Math.min(100, Math.round(score));

  // Map affected files back to whether a major/added/removed bump touched them
  const depById = new Map(dependencies.map((d) => [d.id, d]));
  const criticalFileHasMajorOrAddedBump = criticalFiles.some((file) =>
    file.matchedDependencyIds.some((id) => {
      const dep = depById.get(id);
      return (
        dep?.bumpKind === "major" ||
        dep?.bumpKind === "added" ||
        dep?.bumpKind === "removed"
      );
    }),
  );

  const hasHighSeverityTag = criticalFiles.some((f) =>
    f.criticalPathTags.some((t) => HIGH_SEVERITY_TAGS.has(t)),
  );
  const hasBoundaryTag = criticalFiles.some((f) =>
    f.criticalPathTags.some((t) => BOUNDARY_TAGS.has(t)),
  );
  const hasDirectRuntimeMajor = dependencies.some(
    (d) => d.direct && !isBuildOrTestOnlyCoord(d) && d.bumpKind === "major",
  );

  let confidenceTier: ConfidenceTier;
  let gateExitCode: GateExitCode;

  if (
    highSbomAlerts.length > 0 ||
    (hasHighSeverityTag && (criticalFileHasMajorOrAddedBump || hasBoundaryTag)) ||
    (criticalFiles.length > 0 && effortScore >= 55) ||
    effortScore >= 65
  ) {
    confidenceTier = "CRITICAL PATH TOUCHED - MANUAL REVIEW";
    gateExitCode = 20;
  } else if (
    prodAffectedFiles.length > 0 ||
    otherSbomAlerts.length > 0 ||
    hasDirectRuntimeMajor ||
    effortScore >= 25
  ) {
    confidenceTier = "MODERATE - VERIFY TESTS";
    gateExitCode = 10;
  } else {
    confidenceTier = "HIGH CONFIDENCE / AUTO-MERGE";
    gateExitCode = 0;
  }

  if (highSbomAlerts.length > 0) {
    rationale.push(
      `${highSbomAlerts.length} high/critical SBOM vulnerability alert(s) matched changed dependencies.`,
    );
  }
  if (criticalFiles.length > 0) {
    const allTags = Array.from(
      new Set(criticalFiles.flatMap((f) => f.criticalPathTags)),
    );
    rationale.push(
      `${criticalFiles.length} critical-path file(s) touched (${allTags.join(", ")}).`,
    );
  }
  if (dtoContracts.length > 0) {
    rationale.push(
      `${dtoContracts.length} DTO/contract symbol(s) intersect changed dependency call paths.`,
    );
  }
  if (majorBumpCount > 0) {
    rationale.push(`${majorBumpCount} major version bump(s) detected.`);
  }
  if (affectedFiles.length === 0 && sbom.alerts.length === 0) {
    rationale.push(
      "Zero production AST symbol touchpoints or SBOM alerts detected for changed dependencies.",
    );
  }
  if (openRewrite.filesChanged > 0) {
    rationale.push(
      `OpenRewrite / migration diff touches ${openRewrite.filesChanged} file(s) (+${openRewrite.totalAdditions}/-${openRewrite.totalDeletions}).`,
    );
  }

  return {
    effortScore,
    confidenceTier,
    gateExitCode,
    autoMergeEligible: gateExitCode === 0,
    rationale,
    breakdown: {
      dependencyDeltaCount: dependencies.length,
      majorBumpCount,
      minorOrAddedCount,
      patchBumpCount,
      affectedFileCount: affectedFiles.length,
      criticalPathFileCount: criticalFiles.length,
      dtoContractCount: dtoContracts.length,
      sbomAlertCount: sbom.alerts.length,
      openRewriteChangedFiles: openRewrite.filesChanged,
    },
  };
}
