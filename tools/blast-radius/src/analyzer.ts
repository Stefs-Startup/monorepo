import * as fs from "node:fs";
import * as path from "node:path";
import { analyzeJavaBlastRadius } from "./analyzers/java-ast.js";
import { loadOpenRewriteSummary } from "./analyzers/openrewrite.js";
import { analyzeTypeScriptBlastRadius } from "./analyzers/ts-ast.js";
import {
  diffGradleDeps,
  parseGradleBuildScript,
  parseGradleDependenciesText,
  parseGradleVersionCatalog,
  type ParsedGradleDep,
} from "./parsers/gradle.js";
import {
  diffMavenDeps,
  parseMavenTreeJson,
  parsePomXml,
  type ParsedMavenDep,
} from "./parsers/maven.js";
import { diffNpmDeps, parseNpmLockfile, type ParsedNpmDep } from "./parsers/npm.js";
import { diffPnpmDeps, parsePnpmLockfile, type ParsedPnpmDep } from "./parsers/pnpm.js";
import { loadAndCrossCheckSbom } from "./parsers/sbom.js";
import { computeScoringSummary } from "./scoring.js";
import {
  BLAST_RADIUS_SCHEMA_VERSION,
  type BlastRadiusReport,
  type DependencyDelta,
  type EcosystemKind,
} from "./types.js";
import { findRepoFiles, readFileSafe } from "./utils/fs-helpers.js";
import {
  gitShowFile,
  listChangedFiles,
  resolveBaseAndHead,
  toPosixPath,
  type ResolvedRefs,
} from "./utils/git.js";

export interface AnalyzeBlastRadiusOptions {
  rootDir?: string;
  baseRef?: string;
  headRef?: string;
  sbomFile?: string;
  fetchSbom?: boolean;
  openRewriteDiffFile?: string;
  gradleBaseFile?: string;
  gradleHeadFile?: string;
  mavenTreeBaseFile?: string;
  mavenTreeHeadFile?: string;
  pomBaseFile?: string;
  pomHeadFile?: string;
  npmLockBaseFile?: string;
  npmLockHeadFile?: string;
  pnpmLockBaseFile?: string;
  pnpmLockHeadFile?: string;
}

function readFixtureFile(
  repoRoot: string,
  filePath: string | undefined,
  label: string,
  warnings: string[],
): string | null {
  if (!filePath) return null;
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(repoRoot, filePath);
  try {
    return fs.readFileSync(resolved, "utf8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Could not read ${label} "${filePath}": ${msg}`);
    return null;
  }
}

function readAtRefs(
  repoRoot: string,
  relPath: string,
  refs: ResolvedRefs,
): { baseRaw: string | null; headRaw: string | null } {
  const baseRaw = refs.baseAvailable
    ? gitShowFile(repoRoot, refs.baseRef, relPath)
    : null;
  const headRaw = refs.headIsWorkingTree
    ? readFileSafe(path.join(repoRoot, relPath))
    : gitShowFile(repoRoot, refs.headRef, relPath);
  return { baseRaw, headRaw };
}

function mergeGradleDepMaps(
  target: Map<string, ParsedGradleDep>,
  source: Map<string, ParsedGradleDep>,
): void {
  for (const [coord, dep] of source.entries()) {
    const existing = target.get(coord);
    if (!existing || (dep.direct && !existing.direct)) {
      target.set(coord, dep);
    }
  }
}

function extractRepoGradleDeltas(
  repoRoot: string,
  refs: ResolvedRefs,
  changedFiles: string[],
  warnings: string[],
): { analyzed: boolean; deltas: DependencyDelta[] } {
  const gradleFilesOnDisk = findRepoFiles(
    repoRoot,
    (rel, name) =>
      name === "build.gradle.kts" ||
      name === "build.gradle" ||
      name === "libs.versions.toml" ||
      rel.endsWith(".versions.toml"),
  );
  const changedGradle = changedFiles.filter(
    (f) =>
      f.endsWith("build.gradle.kts") ||
      f.endsWith("build.gradle") ||
      f.endsWith(".versions.toml"),
  );
  const candidateFiles = Array.from(
    new Set([...gradleFilesOnDisk, ...changedGradle]),
  ).sort();

  if (candidateFiles.length === 0) {
    return { analyzed: false, deltas: [] };
  }

  const deltas: DependencyDelta[] = [];
  for (const relPath of candidateFiles) {
    if (!changedGradle.includes(relPath) && !refs.baseAvailable) {
      continue;
    }
    const { baseRaw, headRaw } = readAtRefs(repoRoot, relPath, refs);
    if (baseRaw === null && headRaw === null) continue;
    if (baseRaw === headRaw) continue;

    // If base ref wasn't available, only report when file doesn't match anything? Wait:
    // If baseRef is missing, we shouldn't claim every existing file in repo is "added".
    if (!refs.baseAvailable) continue;

    const baseMap = new Map<string, ParsedGradleDep>();
    const headMap = new Map<string, ParsedGradleDep>();

    if (relPath.endsWith(".toml")) {
      if (baseRaw) {
        mergeGradleDepMaps(
          baseMap,
          parseGradleVersionCatalog(baseRaw, relPath, warnings),
        );
      }
      if (headRaw) {
        mergeGradleDepMaps(
          headMap,
          parseGradleVersionCatalog(headRaw, relPath, warnings),
        );
      }
    } else {
      if (baseRaw) {
        mergeGradleDepMaps(baseMap, parseGradleBuildScript(baseRaw, relPath));
      }
      if (headRaw) {
        mergeGradleDepMaps(headMap, parseGradleBuildScript(headRaw, relPath));
      }
    }

    deltas.push(...diffGradleDeps(baseMap, headMap));
  }

  return { analyzed: true, deltas };
}

function extractRepoMavenDeltas(
  repoRoot: string,
  refs: ResolvedRefs,
  changedFiles: string[],
  warnings: string[],
): { analyzed: boolean; deltas: DependencyDelta[] } {
  const pomFilesOnDisk = findRepoFiles(repoRoot, (_rel, name) => name === "pom.xml");
  const changedPoms = changedFiles.filter((f) => path.posix.basename(f) === "pom.xml");
  const candidateFiles = Array.from(
    new Set([...pomFilesOnDisk, ...changedPoms]),
  ).sort();

  if (candidateFiles.length === 0) {
    return { analyzed: false, deltas: [] };
  }

  const deltas: DependencyDelta[] = [];
  for (const relPath of candidateFiles) {
    if (!refs.baseAvailable) continue;
    const { baseRaw, headRaw } = readAtRefs(repoRoot, relPath, refs);
    if (baseRaw === headRaw) continue;
    const baseMap = baseRaw
      ? parsePomXml(baseRaw, relPath, warnings)
      : new Map<string, ParsedMavenDep>();
    const headMap = headRaw
      ? parsePomXml(headRaw, relPath, warnings)
      : new Map<string, ParsedMavenDep>();
    deltas.push(...diffMavenDeps(baseMap, headMap));
  }

  return { analyzed: true, deltas };
}

function extractRepoNpmDeltas(
  repoRoot: string,
  refs: ResolvedRefs,
  changedFiles: string[],
  warnings: string[],
): { analyzed: boolean; deltas: DependencyDelta[] } {
  const lockFilesOnDisk = findRepoFiles(
    repoRoot,
    (_rel, name) => name === "package-lock.json",
  );
  const changedLocks = changedFiles.filter(
    (f) => path.posix.basename(f) === "package-lock.json",
  );
  const candidateFiles = Array.from(
    new Set([...lockFilesOnDisk, ...changedLocks]),
  ).sort();

  if (candidateFiles.length === 0) {
    return { analyzed: false, deltas: [] };
  }

  const deltas: DependencyDelta[] = [];
  for (const relPath of candidateFiles) {
    if (!refs.baseAvailable) continue;
    const { baseRaw, headRaw } = readAtRefs(repoRoot, relPath, refs);
    if (baseRaw === headRaw) continue;
    const baseMap = baseRaw
      ? parseNpmLockfile(baseRaw, relPath, warnings)
      : new Map<string, ParsedNpmDep>();
    const headMap = headRaw
      ? parseNpmLockfile(headRaw, relPath, warnings)
      : new Map<string, ParsedNpmDep>();
    deltas.push(...diffNpmDeps(baseMap, headMap));
  }

  return { analyzed: true, deltas };
}

function extractRepoPnpmDeltas(
  repoRoot: string,
  refs: ResolvedRefs,
  changedFiles: string[],
  warnings: string[],
): { analyzed: boolean; deltas: DependencyDelta[] } {
  const lockFilesOnDisk = findRepoFiles(
    repoRoot,
    (_rel, name) => name === "pnpm-lock.yaml",
  );
  const changedLocks = changedFiles.filter(
    (f) => path.posix.basename(f) === "pnpm-lock.yaml",
  );
  const candidateFiles = Array.from(
    new Set([...lockFilesOnDisk, ...changedLocks]),
  ).sort();

  if (candidateFiles.length === 0) {
    return { analyzed: false, deltas: [] };
  }

  const deltas: DependencyDelta[] = [];
  for (const relPath of candidateFiles) {
    if (!refs.baseAvailable) continue;
    const { baseRaw, headRaw } = readAtRefs(repoRoot, relPath, refs);
    if (baseRaw === headRaw) continue;
    const baseMap = baseRaw
      ? parsePnpmLockfile(baseRaw, relPath, warnings)
      : new Map<string, ParsedPnpmDep>();
    const headMap = headRaw
      ? parsePnpmLockfile(headRaw, relPath, warnings)
      : new Map<string, ParsedPnpmDep>();
    deltas.push(...diffPnpmDeps(baseMap, headMap));
  }

  return { analyzed: true, deltas };
}

function deduplicateDeltas(deltas: DependencyDelta[]): DependencyDelta[] {
  const map = new Map<string, DependencyDelta>();
  for (const delta of deltas) {
    const key = `${delta.id}::${delta.sourceFile}`;
    const existing = map.get(key);
    if (!existing || (delta.direct && !existing.direct)) {
      map.set(key, delta);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Executes the full deterministic dependency blast-radius and critical-path analysis.
 */
export function analyzeBlastRadius(
  options: AnalyzeBlastRadiusOptions = {},
): BlastRadiusReport {
  const repoRoot = path.resolve(options.rootDir ?? process.cwd());
  const hasGradleFixture = Boolean(options.gradleBaseFile || options.gradleHeadFile);
  const hasMavenTreeFixture = Boolean(
    options.mavenTreeBaseFile || options.mavenTreeHeadFile,
  );
  const hasPomFixture = Boolean(options.pomBaseFile || options.pomHeadFile);
  const hasNpmFixture = Boolean(options.npmLockBaseFile || options.npmLockHeadFile);
  const hasPnpmFixture = Boolean(
    options.pnpmLockBaseFile || options.pnpmLockHeadFile,
  );
  const hasAnyFixture =
    hasGradleFixture ||
    hasMavenTreeFixture ||
    hasPomFixture ||
    hasNpmFixture ||
    hasPnpmFixture;
  const fixtureOnlyMode = hasAnyFixture && !options.baseRef;

  const refs: ResolvedRefs = fixtureOnlyMode
    ? {
        baseRef: "fixture",
        headRef: options.headRef?.trim() || "fixture",
        baseAvailable: false,
        headIsWorkingTree: false,
        warnings: [],
      }
    : resolveBaseAndHead(repoRoot, options.baseRef, options.headRef);
  const warnings = [...refs.warnings];
  const changedFiles = fixtureOnlyMode ? [] : listChangedFiles(repoRoot, refs);

  const ecosystemsAnalyzed = new Set<EcosystemKind>();
  const allDeltas: DependencyDelta[] = [];

  // 1. Gradle (fixture overrides OR repo build.gradle.kts + libs.versions.toml)
  if (hasGradleFixture) {
    ecosystemsAnalyzed.add("gradle");
    const baseRaw = readFixtureFile(
      repoRoot,
      options.gradleBaseFile,
      "gradle base fixture",
      warnings,
    );
    const headRaw = readFixtureFile(
      repoRoot,
      options.gradleHeadFile,
      "gradle head fixture",
      warnings,
    );
    const baseLabel = options.gradleBaseFile ?? "gradle-base.txt";
    const headLabel = options.gradleHeadFile ?? "gradle-head.txt";
    const baseMap = baseRaw
      ? parseGradleDependenciesText(baseRaw, baseLabel, warnings)
      : new Map<string, ParsedGradleDep>();
    const headMap = headRaw
      ? parseGradleDependenciesText(headRaw, headLabel, warnings)
      : new Map<string, ParsedGradleDep>();
    allDeltas.push(...diffGradleDeps(baseMap, headMap));
  } else if (!fixtureOnlyMode) {
    const gradleRes = extractRepoGradleDeltas(repoRoot, refs, changedFiles, warnings);
    if (gradleRes.analyzed) {
      ecosystemsAnalyzed.add("gradle");
      allDeltas.push(...gradleRes.deltas);
    }
  }

  // 2. Maven (mvn dependency:tree -DoutputType=json fixture, pom.xml fixture, or repo pom.xml)
  if (hasMavenTreeFixture) {
    ecosystemsAnalyzed.add("maven");
    const baseRaw = readFixtureFile(
      repoRoot,
      options.mavenTreeBaseFile,
      "maven tree base fixture",
      warnings,
    );
    const headRaw = readFixtureFile(
      repoRoot,
      options.mavenTreeHeadFile,
      "maven tree head fixture",
      warnings,
    );
    const baseMap = baseRaw
      ? parseMavenTreeJson(baseRaw, options.mavenTreeBaseFile ?? "maven-base.json", warnings)
      : new Map<string, ParsedMavenDep>();
    const headMap = headRaw
      ? parseMavenTreeJson(headRaw, options.mavenTreeHeadFile ?? "maven-head.json", warnings)
      : new Map<string, ParsedMavenDep>();
    allDeltas.push(...diffMavenDeps(baseMap, headMap));
  }
  if (hasPomFixture) {
    ecosystemsAnalyzed.add("maven");
    const baseRaw = readFixtureFile(
      repoRoot,
      options.pomBaseFile,
      "pom.xml base fixture",
      warnings,
    );
    const headRaw = readFixtureFile(
      repoRoot,
      options.pomHeadFile,
      "pom.xml head fixture",
      warnings,
    );
    const baseMap = baseRaw
      ? parsePomXml(baseRaw, options.pomBaseFile ?? "pom.xml", warnings)
      : new Map<string, ParsedMavenDep>();
    const headMap = headRaw
      ? parsePomXml(headRaw, options.pomHeadFile ?? "pom.xml", warnings)
      : new Map<string, ParsedMavenDep>();
    allDeltas.push(...diffMavenDeps(baseMap, headMap));
  } else if (!hasMavenTreeFixture && !fixtureOnlyMode) {
    const mavenRes = extractRepoMavenDeltas(repoRoot, refs, changedFiles, warnings);
    if (mavenRes.analyzed) {
      ecosystemsAnalyzed.add("maven");
      allDeltas.push(...mavenRes.deltas);
    }
  }

  // 3. npm (`package-lock.json` fixture overrides or repo)
  if (hasNpmFixture) {
    ecosystemsAnalyzed.add("npm");
    const baseRaw = readFixtureFile(
      repoRoot,
      options.npmLockBaseFile,
      "npm lock base fixture",
      warnings,
    );
    const headRaw = readFixtureFile(
      repoRoot,
      options.npmLockHeadFile,
      "npm lock head fixture",
      warnings,
    );
    const baseMap = baseRaw
      ? parseNpmLockfile(
          baseRaw,
          options.npmLockBaseFile ?? "package-lock.json",
          warnings,
        )
      : new Map<string, ParsedNpmDep>();
    const headMap = headRaw
      ? parseNpmLockfile(
          headRaw,
          options.npmLockHeadFile ?? "package-lock.json",
          warnings,
        )
      : new Map<string, ParsedNpmDep>();
    // Use relative lockfile scope if the fixture file sits inside a project dir, else "."
    const deltas = diffNpmDeps(baseMap, headMap).map((d) => ({
      ...d,
      sourceFile: toPosixPath(d.sourceFile).startsWith("apps/")
        ? d.sourceFile
        : "package-lock.json",
    }));
    allDeltas.push(...deltas);
  } else if (!fixtureOnlyMode) {
    const npmRes = extractRepoNpmDeltas(repoRoot, refs, changedFiles, warnings);
    if (npmRes.analyzed) {
      ecosystemsAnalyzed.add("npm");
      allDeltas.push(...npmRes.deltas);
    }
  }

  // 4. pnpm (`pnpm-lock.yaml` fixture overrides or repo)
  if (hasPnpmFixture) {
    ecosystemsAnalyzed.add("pnpm");
    const baseRaw = readFixtureFile(
      repoRoot,
      options.pnpmLockBaseFile,
      "pnpm lock base fixture",
      warnings,
    );
    const headRaw = readFixtureFile(
      repoRoot,
      options.pnpmLockHeadFile,
      "pnpm lock head fixture",
      warnings,
    );
    const baseMap = baseRaw
      ? parsePnpmLockfile(
          baseRaw,
          options.pnpmLockBaseFile ?? "pnpm-lock.yaml",
          warnings,
        )
      : new Map<string, ParsedPnpmDep>();
    const headMap = headRaw
      ? parsePnpmLockfile(
          headRaw,
          options.pnpmLockHeadFile ?? "pnpm-lock.yaml",
          warnings,
        )
      : new Map<string, ParsedPnpmDep>();
    const deltas = diffPnpmDeps(baseMap, headMap).map((d) => ({
      ...d,
      sourceFile: "pnpm-lock.yaml",
    }));
    allDeltas.push(...deltas);
  } else if (!fixtureOnlyMode) {
    const pnpmRes = extractRepoPnpmDeltas(repoRoot, refs, changedFiles, warnings);
    if (pnpmRes.analyzed) {
      ecosystemsAnalyzed.add("pnpm");
      allDeltas.push(...pnpmRes.deltas);
    }
  }

  const dependencies = deduplicateDeltas(allDeltas);

  // 5. SBOM Cross-Check
  const sbom = loadAndCrossCheckSbom(
    {
      repoRoot,
      sbomFile: options.sbomFile,
      fetchSbom: options.fetchSbom,
    },
    dependencies,
  );
  warnings.push(...sbom.warnings);

  // 6. AST Critical-Path Mapping
  const javaDeps = dependencies.filter((d) => d.category === "java");
  const tsDeps = dependencies.filter((d) => d.category === "typescript");

  const javaAst = analyzeJavaBlastRadius(repoRoot, javaDeps, warnings);
  const tsAst = analyzeTypeScriptBlastRadius(repoRoot, tsDeps, warnings);

  const affectedFiles = [...javaAst.affectedFiles, ...tsAst.affectedFiles].sort(
    (a, b) => a.filePath.localeCompare(b.filePath),
  );
  const packageMappings = [
    ...javaAst.packageMappings,
    ...tsAst.packageMappings,
  ].sort((a, b) => a.id.localeCompare(b.id));
  const dtoContracts = [...javaAst.dtoContracts, ...tsAst.dtoContracts].sort(
    (a, b) =>
      a.filePath === b.filePath
        ? a.line - b.line
        : a.filePath.localeCompare(b.filePath),
  );

  // 7. OpenRewrite / Migration Diff Summary
  const openRewrite = loadOpenRewriteSummary(
    repoRoot,
    refs,
    options.openRewriteDiffFile,
    warnings,
  );

  // 8. Scoring & Gate Exit Code
  const scoring = computeScoringSummary({
    dependencies,
    affectedFiles,
    dtoContracts,
    sbom,
    openRewrite,
  });

  return {
    schemaVersion: BLAST_RADIUS_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    repoRoot: path.basename(repoRoot) || ".",
    baseRef: refs.baseRef,
    headRef: refs.headRef,
    ecosystemsAnalyzed: Array.from(ecosystemsAnalyzed).sort(),
    dependencies,
    packageMappings,
    affectedFiles,
    dtoContracts,
    sbom,
    openRewrite,
    scoring,
    warnings: Array.from(new Set(warnings)),
  };
}
