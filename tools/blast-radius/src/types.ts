/**
 * Canonical JSON schema for @cmp/blast-radius reports.
 * Shared contract between tools/blast-radius (CLI) and tools/blast-radius-ui (React Flow viewer).
 */

export const BLAST_RADIUS_SCHEMA_VERSION = "1.0.0" as const;

export type EcosystemKind = "gradle" | "maven" | "npm" | "pnpm";

export type EcosystemCategory = "java" | "typescript";

export type VersionBumpKind =
  | "major"
  | "minor"
  | "patch"
  | "added"
  | "removed"
  | "updated"
  | "unchanged";

export type ConfidenceTier =
  | "HIGH CONFIDENCE / AUTO-MERGE"
  | "MODERATE - VERIFY TESTS"
  | "CRITICAL PATH TOUCHED - MANUAL REVIEW";

export type GateExitCode = 0 | 10 | 20;

export type CriticalPathTag =
  | "@RestController"
  | "@Controller"
  | "@Service"
  | "@Repository"
  | "@Transactional"
  | "@SecurityFilterChain"
  | "@Configuration"
  | "@Bean"
  | "@SpringBootApplication"
  | "@ExceptionHandler"
  | "@Component"
  | "@Injectable"
  | "Signal"
  | "RxJS"
  | "DTO";

export interface SbomVulnerability {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "unknown";
  summary: string;
  url?: string;
}

export interface SbomMatchInfo {
  matched: boolean;
  componentName: string;
  purl?: string;
  sbomVersion?: string;
  licenses: string[];
  vulnerabilities: SbomVulnerability[];
}

export interface SbomAlert {
  dependencyId: string;
  dependencyName: string;
  severity: "critical" | "high" | "medium" | "low" | "unknown";
  title: string;
  purl?: string;
  id?: string;
}

export interface SbomReport {
  status: "loaded" | "not_provided" | "unavailable" | "parse_error";
  source: string | null;
  format?: "cyclonedx" | "spdx" | "github-dependency-graph" | "unknown";
  totalComponents: number;
  matchedDependencies: number;
  alerts: SbomAlert[];
  warnings: string[];
}

export interface DependencyDelta {
  /** Stable identifier, e.g. "gradle:org.springframework.boot:spring-boot-starter-webmvc" or "npm:@angular/core" */
  id: string;
  ecosystem: EcosystemKind;
  category: EcosystemCategory;
  /** Canonical dependency name, e.g. "group:artifact" for JVM or "@scope/pkg" for JS */
  name: string;
  group?: string;
  artifact?: string;
  fromVersion: string | null;
  toVersion: string | null;
  bumpKind: VersionBumpKind;
  direct: boolean;
  /** Repo-relative path to the manifest or lockfile where this delta was observed */
  sourceFile: string;
  /** Curated + inferred Java package prefixes or npm import specifiers mapped from this dependency */
  inferredPackages: string[];
  sbomCrossCheck?: SbomMatchInfo;
}

export type AstSymbolKind =
  | "import"
  | "class"
  | "record"
  | "interface"
  | "method"
  | "field"
  | "annotation"
  | "decorator"
  | "signal"
  | "rxjs"
  | "type_reference";

export interface AstSymbolTouchpoint {
  id: string;
  language: "java" | "typescript";
  ecosystem: EcosystemCategory;
  /** Repo-relative POSIX file path */
  filePath: string;
  /** 1-based line number */
  line: number;
  endLine?: number;
  column?: number;
  kind: AstSymbolKind;
  symbolName: string;
  /** Matched Java package/import or npm specifier */
  matchedImport: string;
  /** References DependencyDelta.id */
  matchedDependencyIds: string[];
  criticalPathTags: CriticalPathTag[];
  isCriticalPath: boolean;
  /** Single-line trimmed code excerpt */
  snippet?: string;
}

export interface AffectedFileSummary {
  filePath: string;
  language: "java" | "typescript";
  ecosystem: EcosystemCategory;
  /** Project directory relative to repoRoot, e.g. "apps/pulse/backend" or "apps/pulse/web" */
  project: string;
  isCriticalPath: boolean;
  isDtoOrContract: boolean;
  criticalPathTags: CriticalPathTag[];
  matchedDependencyIds: string[];
  matchedPackages: string[];
  touchpointCount: number;
  touchpoints: AstSymbolTouchpoint[];
  symbols: string[];
  riskWeight: number;
}

export interface PackageMappingEdge {
  id: string;
  dependencyId: string;
  dependencyName: string;
  ecosystem: EcosystemKind;
  category: EcosystemCategory;
  packageName: string;
  filePaths: string[];
  touchpointCount: number;
}

export interface DtoContractTouchpoint {
  filePath: string;
  line: number;
  symbolName: string;
  language: "java" | "typescript";
  kind: "record" | "class" | "interface" | "type";
  matchedDependencyIds: string[];
  reason: string;
}

export interface OpenRewriteDiffFile {
  filePath: string;
  status: "modified" | "added" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  recipesOrChanges: string[];
  excerpt?: string;
}

export interface OpenRewriteSummary {
  source: "file" | "git_diff" | "none";
  diffPath?: string;
  filesChanged: number;
  totalAdditions: number;
  totalDeletions: number;
  files: OpenRewriteDiffFile[];
  summaryLines: string[];
}

export interface ScoringBreakdown {
  dependencyDeltaCount: number;
  majorBumpCount: number;
  minorOrAddedCount: number;
  patchBumpCount: number;
  affectedFileCount: number;
  criticalPathFileCount: number;
  dtoContractCount: number;
  sbomAlertCount: number;
  openRewriteChangedFiles: number;
}

export interface ScoringSummary {
  /** Deterministic 0..100 risk/effort score */
  effortScore: number;
  confidenceTier: ConfidenceTier;
  /** Exit code when running with --gate (0, 10, or 20) */
  gateExitCode: GateExitCode;
  autoMergeEligible: boolean;
  rationale: string[];
  breakdown: ScoringBreakdown;
}

export interface BlastRadiusReport {
  schemaVersion: typeof BLAST_RADIUS_SCHEMA_VERSION;
  generatedAt: string;
  repoRoot: string;
  baseRef: string;
  headRef: string;
  ecosystemsAnalyzed: EcosystemKind[];
  dependencies: DependencyDelta[];
  packageMappings: PackageMappingEdge[];
  affectedFiles: AffectedFileSummary[];
  dtoContracts: DtoContractTouchpoint[];
  sbom: SbomReport;
  openRewrite: OpenRewriteSummary;
  scoring: ScoringSummary;
  warnings: string[];
}
