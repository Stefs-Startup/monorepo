#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Strips inline TOML comments outside single/double quotes and unquotes scalar strings.
 */
function parseTomlScalar(rawValue) {
  let quote = null;
  let end = rawValue.length;
  for (let i = 0; i < rawValue.length; i++) {
    const ch = rawValue[i];
    if (quote) {
      if (ch === quote && rawValue[i - 1] !== "\\") {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "#") {
      end = i;
      break;
    }
  }
  const trimmed = rawValue.slice(0, end).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parses `[tools]` and `[env]` key-value entries from a `mise.toml` manifest.
 */
export function parseMiseToml(content) {
  const tools = {};
  const env = {};
  let section = "";

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      continue;
    }
    if (section !== "tools" && section !== "env") {
      continue;
    }
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      continue;
    }
    const key = line.slice(0, eqIdx).trim();
    const val = parseTomlScalar(line.slice(eqIdx + 1));
    if (section === "tools") {
      tools[key] = val;
    } else {
      env[key] = val;
    }
  }

  return { tools, env };
}

/**
 * Extracts the leading integer major version from strings like `temurin-21`, `v20.18.0`, or `17`.
 */
export function normalizeMajorVersion(raw) {
  if (raw === undefined || raw === null) {
    return null;
  }
  const text = String(raw).trim();
  if (!text) {
    return null;
  }
  const match = text.match(/(\d+)/);
  return match ? match[1] : null;
}

function readOptionalText(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function matchSingle(text, regex) {
  const match = text.match(regex);
  return match?.[1]?.trim() ?? null;
}

function extractWorkflowJavaVersions(workflowText) {
  const matches = [...workflowText.matchAll(/java-version:\s*["']?(\d+)["']?/g)];
  return Array.from(new Set(matches.map((m) => m[1])));
}

/**
 * Reads expected toolchain pins from `mise.toml`, Node manifests, Gradle build scripts,
 * `.github/scripts/discover_projects.py`, and CI stack workflows.
 */
export function extractRepoToolchainPins(rootDir) {
  const miseContent = readOptionalText(path.join(rootDir, "mise.toml"));
  const { tools: miseTools, env: miseEnv } = parseMiseToml(miseContent);

  const nvmrc = readOptionalText(path.join(rootDir, ".nvmrc")).trim();
  const nodeVersionFile = readOptionalText(path.join(rootDir, ".node-version")).trim();

  let packageManagerPnpm = null;
  const pkgText = readOptionalText(path.join(rootDir, "package.json"));
  if (pkgText) {
    const pkgJson = JSON.parse(pkgText);
    const pm = typeof pkgJson.packageManager === "string" ? pkgJson.packageManager : "";
    const pmMatch = pm.match(/^pnpm@(.+)$/);
    packageManagerPnpm = pmMatch ? pmMatch[1] : null;
  }

  const backendGradle = readOptionalText(
    path.join(rootDir, "apps/pulse/backend/build.gradle.kts"),
  );
  const kmpGradle = readOptionalText(
    path.join(rootDir, "apps/pulse/kmp/build.gradle.kts"),
  );
  const appGradle = readOptionalText(
    path.join(rootDir, "apps/pulse/app/build.gradle.kts"),
  );
  const jvmServiceConvention = readOptionalText(
    path.join(rootDir, "build-logic/src/main/kotlin/stefs.jvm-service.gradle.kts"),
  );
  const kotlinLibConvention = readOptionalText(
    path.join(rootDir, "build-logic/src/main/kotlin/stefs.kotlin-lib.gradle.kts"),
  );
  const androidAppConvention = readOptionalText(
    path.join(rootDir, "build-logic/src/main/kotlin/stefs.android-app.gradle.kts"),
  );
  const discoverPy = readOptionalText(
    path.join(rootDir, ".github/scripts/discover_projects.py"),
  );

  const workflowFiles = [
    ".github/workflows/ci-stack-android-kotlin.yml",
    ".github/workflows/ci-stack-kmp-multiplatform.yml",
    ".github/workflows/ci-stack-springboot-java.yml",
  ];
  const ciJavaVersions = {};
  for (const rel of workflowFiles) {
    ciJavaVersions[rel] = extractWorkflowJavaVersions(
      readOptionalText(path.join(rootDir, rel)),
    );
  }

  return {
    miseTools,
    miseEnv,
    nvmrc: nvmrc || null,
    nodeVersionFile: nodeVersionFile || null,
    packageManagerPnpm,
    backendJavaVersion:
      matchSingle(backendGradle, /JavaLanguageVersion\.of\((\d+)\)/) ??
      (backendGradle.includes("stefs.jvm-service")
        ? matchSingle(jvmServiceConvention, /JavaLanguageVersion\.of\((\d+)\)/)
        : null),
    kmpJvmToolchain:
      matchSingle(kmpGradle, /jvmToolchain\((\d+)\)/) ??
      (kmpGradle.includes("stefs.kotlin-lib")
        ? matchSingle(kotlinLibConvention, /jvmToolchain\((\d+)\)/)
        : null),
    androidCompileSdk:
      matchSingle(appGradle, /compileSdk\s*=\s*(\d+)/) ??
      (appGradle.includes("stefs.android-app")
        ? matchSingle(androidAppConvention, /compileSdk\s*=\s*(\d+)/)
        : null),
    discoverDefaultNode: matchSingle(
      discoverPy,
      /DEFAULT_NODE\s*=\s*["'](\d+)["']/,
    ),
    discoverDefaultJava: matchSingle(
      discoverPy,
      /DEFAULT_JAVA\s*=\s*["'](\d+)["']/,
    ),
    ciJavaVersions,
  };
}

/**
 * Evaluates parity between `mise.toml` pins and all repo/CI configuration sources.
 */
export function evaluateToolchainParity(rootDir = process.cwd()) {
  const pins = extractRepoToolchainPins(rootDir);
  const checks = [];

  const addCheck = (name, expected, actual, source) => {
    const passed = Boolean(expected && actual && expected === actual);
    checks.push({
      name,
      expected: expected ?? null,
      actual: actual ?? null,
      passed,
      source,
    });
  };

  const miseNodeMajor = normalizeMajorVersion(pins.miseTools.node);
  const misePnpm = pins.miseTools.pnpm?.trim() || null;
  const miseJavaMajor = normalizeMajorVersion(pins.miseTools.java);
  const miseKmpToolchain = normalizeMajorVersion(pins.miseEnv.KMP_JVM_TOOLCHAIN);
  const miseAndroidSdk = normalizeMajorVersion(pins.miseEnv.ANDROID_COMPILE_SDK);

  addCheck(
    "Node version (.nvmrc)",
    miseNodeMajor,
    normalizeMajorVersion(pins.nvmrc),
    ".nvmrc",
  );
  addCheck(
    "Node version (.node-version)",
    miseNodeMajor,
    normalizeMajorVersion(pins.nodeVersionFile),
    ".node-version",
  );
  addCheck(
    "Node version (discover_projects.py DEFAULT_NODE)",
    miseNodeMajor,
    pins.discoverDefaultNode,
    ".github/scripts/discover_projects.py",
  );
  addCheck(
    "pnpm version (package.json packageManager)",
    misePnpm,
    pins.packageManagerPnpm,
    "package.json",
  );
  addCheck(
    "Java 21 (apps/pulse/backend)",
    miseJavaMajor,
    pins.backendJavaVersion,
    "apps/pulse/backend/build.gradle.kts",
  );
  addCheck(
    "Java 21 (discover_projects.py DEFAULT_JAVA)",
    miseJavaMajor,
    pins.discoverDefaultJava,
    ".github/scripts/discover_projects.py",
  );
  addCheck(
    "KMP JVM toolchain (apps/pulse/kmp)",
    miseKmpToolchain,
    pins.kmpJvmToolchain,
    "apps/pulse/kmp/build.gradle.kts",
  );
  addCheck(
    "Android compileSdk (apps/pulse/app)",
    miseAndroidSdk,
    pins.androidCompileSdk,
    "apps/pulse/app/build.gradle.kts",
  );

  for (const [relPath, versions] of Object.entries(pins.ciJavaVersions)) {
    const actual = versions.length === 1 ? versions[0] : versions.join(",");
    addCheck(`CI Java version (${path.basename(relPath)})`, miseJavaMajor, actual || null, relPath);
  }

  const mismatches = checks
    .filter((c) => !c.passed)
    .map(
      (c) =>
        `${c.name} [${c.source}]: mise.toml expects '${c.expected ?? "unset"}', found '${c.actual ?? "missing"}'`,
    );

  return {
    passed: mismatches.length === 0,
    checks,
    mismatches,
  };
}

function readFlagValue(args, flag) {
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

/**
 * CLI entrypoint checking `mise.toml` parity against repo and CI pins.
 */
export function runToolchainParityCli(rawArgv) {
  const argv = rawArgv[0] === "--" ? rawArgv.slice(1) : rawArgv;
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(
      "Usage: node scripts/check-toolchain-parity.mjs [--root=<dir>] [--json]",
    );
    return 0;
  }

  const rootDir = path.resolve(readFlagValue(argv, "--root") ?? process.cwd());
  const json = argv.includes("--json");
  const report = evaluateToolchainParity(rootDir);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.passed) {
    console.log(
      `PASS toolchain parity: ${report.checks.length}/${report.checks.length} pins match mise.toml.`,
    );
  } else {
    console.error("FAIL toolchain parity:");
    for (const mismatch of report.mismatches) {
      console.error(`  - ${mismatch}`);
    }
  }

  return report.passed ? 0 : 1;
}

function isExecutedDirectly() {
  if (!process.argv[1]) {
    return false;
  }
  try {
    return (
      fs.realpathSync(path.resolve(process.argv[1])) ===
      fs.realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isExecutedDirectly()) {
  process.exitCode = runToolchainParityCli(process.argv.slice(2));
}
