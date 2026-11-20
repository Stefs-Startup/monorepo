import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  evaluateToolchainParity,
  extractRepoToolchainPins,
  normalizeMajorVersion,
  parseMiseToml,
  runToolchainParityCli,
} from "./check-toolchain-parity.mjs";

function writeRepoFixture(rootDir, overrides = {}) {
  const files = {
    "mise.toml": [
      "# Toolchain pins",
      "[tools]",
      'node = "20"',
      'pnpm = "9.12.3"',
      'java = "temurin-21"',
      "",
      "[env]",
      'ANDROID_COMPILE_SDK = "35"',
      'KMP_JVM_TOOLCHAIN = "17"',
      "",
      "[tasks.bootstrap]",
      'run = "./scripts/bootstrap.sh"',
    ].join("\n"),
    ".nvmrc": "20\n",
    ".node-version": "20\n",
    "package.json": JSON.stringify({
      name: "fixture-root",
      packageManager: "pnpm@9.12.3",
    }),
    "apps/pulse/backend/build.gradle.kts":
      "java {\n  toolchain {\n    languageVersion = JavaLanguageVersion.of(21)\n  }\n}\n",
    "apps/pulse/kmp/build.gradle.kts": "kotlin {\n  jvmToolchain(17)\n}\n",
    "apps/pulse/app/build.gradle.kts": "android {\n  compileSdk = 35\n}\n",
    ".github/scripts/discover_projects.py":
      'DEFAULT_JAVA = "21"\nDEFAULT_NODE = "20"\n',
    ".github/workflows/ci-stack-android-kotlin.yml":
      'steps:\n  - uses: actions/setup-java@abc\n    with:\n      java-version: "21"\n',
    ".github/workflows/ci-stack-kmp-multiplatform.yml":
      'steps:\n  - uses: actions/setup-java@abc\n    with:\n      java-version: "21"\n',
    ".github/workflows/ci-stack-springboot-java.yml":
      'steps:\n  - uses: actions/setup-java@abc\n    with:\n      java-version: "21"\n',
    ...overrides,
  };

  for (const [relPath, content] of Object.entries(files)) {
    const absPath = path.join(rootDir, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, "utf8");
  }
}

function withTempFixture(overrides, fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-toolchain-parity-"));
  try {
    writeRepoFixture(tmpDir, overrides);
    fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test("parseMiseToml parses [tools] and [env] sections while ignoring comments and tasks", () => {
  const parsed = parseMiseToml(`
# Header comment
[tools]
node = "20" # inline comment
pnpm = '9.12.3'
java = "temurin-21"
unquoted = 35
line_without_equals

[env]
ANDROID_COMPILE_SDK = "35"
KMP_JVM_TOOLCHAIN = "17"
HASH_VAL = "val#1\\"escaped"

[tasks.bootstrap]
run = "./scripts/bootstrap.sh"
`);

  assert.deepEqual(parsed.tools, {
    node: "20",
    pnpm: "9.12.3",
    java: "temurin-21",
    unquoted: "35",
  });
  assert.deepEqual(parsed.env, {
    ANDROID_COMPILE_SDK: "35",
    KMP_JVM_TOOLCHAIN: "17",
    HASH_VAL: 'val#1\\"escaped',
  });
});

test("normalizeMajorVersion extracts major numbers from semver and vendor strings", () => {
  assert.equal(normalizeMajorVersion("temurin-21"), "21");
  assert.equal(normalizeMajorVersion("v20.18.0"), "20");
  assert.equal(normalizeMajorVersion("17"), "17");
  assert.equal(normalizeMajorVersion(""), null);
  assert.equal(normalizeMajorVersion(null), null);
  assert.equal(normalizeMajorVersion(undefined), null);
  assert.equal(normalizeMajorVersion("latest"), null);
});

test("evaluateToolchainParity passes when mise.toml matches all repo and CI pins", () => {
  withTempFixture({}, (tmpDir) => {
    const pins = extractRepoToolchainPins(tmpDir);
    assert.equal(pins.miseTools.node, "20");
    assert.equal(pins.packageManagerPnpm, "9.12.3");

    const report = evaluateToolchainParity(tmpDir);
    assert.equal(report.passed, true);
    assert.deepEqual(report.mismatches, []);
    assert.ok(report.checks.length >= 9);
    assert.ok(report.checks.every((c) => c.passed));
  });
});

test("evaluateToolchainParity flags drift in Node, pnpm, Java, KMP, Android SDK, and CI workflows", () => {
  withTempFixture(
    {
      ".nvmrc": "22\n",
      "package.json": JSON.stringify({ packageManager: "pnpm@10.0.0" }),
      "apps/pulse/backend/build.gradle.kts":
        "languageVersion = JavaLanguageVersion.of(17)\n",
      "apps/pulse/kmp/build.gradle.kts": "jvmToolchain(21)\n",
      "apps/pulse/app/build.gradle.kts": "compileSdk = 36\n",
      ".github/workflows/ci-stack-springboot-java.yml": 'java-version: "17"\n',
    },
    (tmpDir) => {
      const report = evaluateToolchainParity(tmpDir);
      assert.equal(report.passed, false);
      assert.ok(report.mismatches.some((m) => m.includes(".nvmrc")));
      assert.ok(report.mismatches.some((m) => m.includes("packageManager")));
      assert.ok(report.mismatches.some((m) => m.includes("backend")));
      assert.ok(report.mismatches.some((m) => m.includes("kmp")));
      assert.ok(report.mismatches.some((m) => m.includes("compileSdk")));
      assert.ok(report.mismatches.some((m) => m.includes("ci-stack-springboot-java.yml")));
    },
  );
});

test("evaluateToolchainParity passes against the live monorepo root", () => {
  const report = evaluateToolchainParity(process.cwd());
  assert.equal(report.passed, true, report.mismatches.join("\n"));
});

test("evaluateToolchainParity handles missing manifests and multi-version CI drift", () => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-empty-parity-"));
  try {
    const emptyReport = evaluateToolchainParity(emptyDir);
    assert.equal(emptyReport.passed, false);
    assert.ok(emptyReport.mismatches.some((m) => m.includes("unset")));
    assert.ok(emptyReport.mismatches.some((m) => m.includes("missing")));
  } finally {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }

  withTempFixture(
    {
      "package.json": JSON.stringify({ name: "no-pm" }),
      ".github/workflows/ci-stack-springboot-java.yml":
        'java-version: "17"\njava-version: "21"\n',
    },
    (tmpDir) => {
      const report = evaluateToolchainParity(tmpDir);
      assert.equal(report.passed, false);
      assert.ok(report.mismatches.some((m) => m.includes("17,21")));
    },
  );
});

test("runToolchainParityCli handles --json, --help, pass, and drift failure exit codes", () => {
  withTempFixture({}, (tmpDir) => {
    assert.equal(runToolchainParityCli(["--help"]), 0);
    assert.equal(runToolchainParityCli(["--", `--root=${tmpDir}`, "--json"]), 0);
    assert.equal(runToolchainParityCli(["--root", tmpDir]), 0);
    assert.equal(runToolchainParityCli([]), 0);
  });

  withTempFixture({ ".nvmrc": "22\n" }, (tmpDir) => {
    assert.equal(runToolchainParityCli([`--root=${tmpDir}`]), 1);
    assert.equal(runToolchainParityCli([`--root=${tmpDir}`, "--json"]), 1);
  });
});
