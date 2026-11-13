#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeBlastRadius, type AnalyzeBlastRadiusOptions } from "./analyzer.js";
import { formatBlastRadiusMarkdown } from "./formatters/markdown.js";

function printHelp(): void {
  console.log(`Usage: blast-radius [options]

Deterministic Dependency Blast-Radius & Critical-Path CLI

Options:
  --root <dir>                 Repository root directory (default: cwd)
  --base <ref>                 Base git ref to compare against (default: main / origin/main)
  --head <ref>                 Head git ref (default: WORKING_TREE)
  --json                       Print canonical BlastRadiusReport JSON to stdout
  --out <file>                 Write JSON report to file (e.g. blast-radius-report.json)
  --markdown                   Print PR summary Markdown to stdout
  --md-out <file>              Write Markdown PR summary to file
  --gate                       Enforce exit codes: 0 (HIGH), 10 (MODERATE), 20 (CRITICAL PATH)
  --allow-moderate             With --gate, exit 0 on MODERATE - VERIFY TESTS
  --sbom <file>                Load CycloneDX, SPDX, or GitHub Dependency Graph JSON
  --fetch-sbom                 Fetch SBOM via 'gh api /repos/{owner}/{repo}/dependency-graph/sbom' (non-fatal if offline)
  --openrewrite-diff <file>    Read unified diff produced by OpenRewrite / ng update
  --gradle-base <file>         Gradle './gradlew dependencies' base text fixture
  --gradle-head <file>         Gradle './gradlew dependencies' head text fixture
  --maven-tree-base <file>     Maven 'mvn dependency:tree -DoutputType=json' base fixture
  --maven-tree-head <file>     Maven 'mvn dependency:tree -DoutputType=json' head fixture
  --pom-base <file>            Maven pom.xml base fixture
  --pom-head <file>            Maven pom.xml head fixture
  --npm-lock-base <file>       npm package-lock.json base fixture
  --npm-lock-head <file>       npm package-lock.json head fixture
  --pnpm-lock-base <file>      pnpm-lock.yaml base fixture
  --pnpm-lock-head <file>      pnpm-lock.yaml head fixture
  --quiet                      Suppress human-readable status summary on stdout
  -h, --help                   Show this help message
`);
}

function readFlagValue(
  args: string[],
  flag: string,
): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
    if (arg === flag) {
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) {
        throw new Error(`Flag ${flag} requires a value.`);
      }
      return next;
    }
  }
  return undefined;
}

const KNOWN_VALUE_FLAGS = new Set([
  "--root",
  "--base",
  "--head",
  "--out",
  "--md-out",
  "--sbom",
  "--openrewrite-diff",
  "--gradle-base",
  "--gradle-head",
  "--maven-tree-base",
  "--maven-tree-head",
  "--pom-base",
  "--pom-head",
  "--npm-lock-base",
  "--npm-lock-head",
  "--pnpm-lock-base",
  "--pnpm-lock-head",
]);

const KNOWN_BOOL_FLAGS = new Set([
  "--json",
  "--markdown",
  "--gate",
  "--allow-moderate",
  "--fetch-sbom",
  "--quiet",
  "--help",
  "-h",
]);

function validateFlags(args: string[]): void {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") continue;
    const flagName = arg.includes("=") ? arg.slice(0, arg.indexOf("=")) : arg;
    if (KNOWN_VALUE_FLAGS.has(flagName)) {
      if (!arg.includes("=")) {
        i += 1;
      }
      continue;
    }
    if (KNOWN_BOOL_FLAGS.has(flagName)) {
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
}

export function runCli(rawArgv: string[]): number {
  const argv = rawArgv[0] === "--" ? rawArgv.slice(1) : rawArgv;
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return 0;
  }

  try {
    validateFlags(argv);

    const rootDir = readFlagValue(argv, "--root") ?? process.cwd();
    const options: AnalyzeBlastRadiusOptions = {
      rootDir,
      baseRef: readFlagValue(argv, "--base"),
      headRef: readFlagValue(argv, "--head"),
      sbomFile: readFlagValue(argv, "--sbom"),
      fetchSbom: argv.includes("--fetch-sbom"),
      openRewriteDiffFile: readFlagValue(argv, "--openrewrite-diff"),
      gradleBaseFile: readFlagValue(argv, "--gradle-base"),
      gradleHeadFile: readFlagValue(argv, "--gradle-head"),
      mavenTreeBaseFile: readFlagValue(argv, "--maven-tree-base"),
      mavenTreeHeadFile: readFlagValue(argv, "--maven-tree-head"),
      pomBaseFile: readFlagValue(argv, "--pom-base"),
      pomHeadFile: readFlagValue(argv, "--pom-head"),
      npmLockBaseFile: readFlagValue(argv, "--npm-lock-base"),
      npmLockHeadFile: readFlagValue(argv, "--npm-lock-head"),
      pnpmLockBaseFile: readFlagValue(argv, "--pnpm-lock-base"),
      pnpmLockHeadFile: readFlagValue(argv, "--pnpm-lock-head"),
    };

    const report = analyzeBlastRadius(options);
    const jsonOutput = JSON.stringify(report, null, 2);
    const mdOutput = formatBlastRadiusMarkdown(report);

    const outPath = readFlagValue(argv, "--out");
    if (outPath) {
      const resolvedOut = path.resolve(rootDir, outPath);
      fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
      fs.writeFileSync(resolvedOut, `${jsonOutput}\n`, "utf8");
    }

    const mdOutPath = readFlagValue(argv, "--md-out");
    if (mdOutPath) {
      const resolvedMdOut = path.resolve(rootDir, mdOutPath);
      fs.mkdirSync(path.dirname(resolvedMdOut), { recursive: true });
      fs.writeFileSync(resolvedMdOut, `${mdOutput}\n`, "utf8");
    }

    const printJson = argv.includes("--json");
    const printMarkdown = argv.includes("--markdown");
    const quiet = argv.includes("--quiet");

    if (printJson) {
      console.log(jsonOutput);
    } else if (printMarkdown) {
      console.log(mdOutput);
    } else if (!quiet) {
      console.log(
        `[blast-radius] Tier: ${report.scoring.confidenceTier} | Effort: ${report.scoring.effortScore}/100 | Deltas: ${report.dependencies.length} | Critical Files: ${report.scoring.breakdown.criticalPathFileCount} | DTOs: ${report.dtoContracts.length}`,
      );
      if (outPath) console.log(`[blast-radius] JSON report written to ${outPath}`);
      if (mdOutPath) console.log(`[blast-radius] Markdown summary written to ${mdOutPath}`);
    }

    if (argv.includes("--gate")) {
      const exitCode = report.scoring.gateExitCode;
      if (exitCode === 10 && argv.includes("--allow-moderate")) {
        return 0;
      }
      return exitCode;
    }

    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[blast-radius] Error: ${msg}`);
    return 1;
  }
}

function realpathSafe(target: string): string {
  try {
    return fs.realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

function isMainEntrypoint(): boolean {
  if (typeof process === "undefined" || !Array.isArray(process.argv) || !process.argv[1]) {
    return false;
  }
  return realpathSafe(process.argv[1]) === realpathSafe(fileURLToPath(import.meta.url));
}

if (isMainEntrypoint()) {
  process.exitCode = runCli(process.argv.slice(2));
}
