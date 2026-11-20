import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { generateApp } from "./generators.js";
import { discoverNestedSubApps, verifyWorkspace } from "./verify.js";

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-context-pack-test-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("repo monorepo passes nested Pulse sub-app AGENTS.md audit", () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(currentDir, "../../../..");
  const pulseDir = path.join(repoRoot, "apps", "pulse");
  const subApps = discoverNestedSubApps(pulseDir);
  assert.deepEqual(subApps, ["app", "backend", "kmp", "web"]);

  for (const sub of subApps) {
    const agentsPath = path.join(pulseDir, sub, "AGENTS.md");
    assert.equal(fs.existsSync(agentsPath), true, `Expected ${agentsPath} to exist`);
    const content = fs.readFileSync(agentsPath, "utf8");
    assert.match(content, /^## Build & Test$/m);
    assert.match(content, /^## Do Not Touch$/m);
    assert.match(content, /^## Common Pitfalls$/m);
  }

  const skillPath = path.join(
    repoRoot,
    ".agents",
    "skills",
    "monorepo-validation",
    "SKILL.md",
  );
  assert.equal(fs.existsSync(skillPath), true, "Expected monorepo-validation skill to exist");

  const verifyRes = verifyWorkspace({ rootDir: repoRoot, target: "pulse" });
  const agentsCheck = verifyRes.checks[0];
  assert.equal(agentsCheck?.passed, true, agentsCheck?.details);
  assert.match(agentsCheck?.details ?? "", /apps\/pulse\/app/);
  assert.match(agentsCheck?.details ?? "", /apps\/pulse\/backend/);
  assert.match(agentsCheck?.details ?? "", /apps\/pulse\/kmp/);
  assert.match(agentsCheck?.details ?? "", /apps\/pulse\/web/);
});

test("verifyWorkspace flags missing AGENTS.md in nested Gradle or npm sub-apps and ignores docs dirs", () => {
  withTempDir((tmpDir) => {
    const suiteDir = path.join(tmpDir, "apps", "suite");
    fs.mkdirSync(path.join(suiteDir, "docs"), { recursive: true });
    fs.mkdirSync(path.join(suiteDir, "api"), { recursive: true });
    fs.mkdirSync(path.join(suiteDir, "web"), { recursive: true });
    fs.mkdirSync(path.join(suiteDir, "android", "src", "main"), { recursive: true });

    fs.writeFileSync(path.join(suiteDir, "AGENTS.md"), "# Suite AGENTS\n", "utf8");
    fs.writeFileSync(path.join(suiteDir, "README.md"), "# Suite README\n", "utf8");
    fs.writeFileSync(path.join(suiteDir, "api", "gradlew"), "#!/usr/bin/env sh\n", "utf8");
    fs.writeFileSync(path.join(suiteDir, "web", "package.json"), "{}\n", "utf8");
    fs.writeFileSync(path.join(suiteDir, "web", "package-lock.json"), "{}\n", "utf8");
    fs.writeFileSync(path.join(suiteDir, "android", "build.gradle.kts"), "", "utf8");
    fs.writeFileSync(
      path.join(suiteDir, "android", "src", "main", "AndroidManifest.xml"),
      "<manifest/>\n",
      "utf8",
    );

    assert.deepEqual(discoverNestedSubApps(suiteDir), ["android", "api", "web"]);

    const failing = verifyWorkspace({ rootDir: tmpDir });
    assert.equal(failing.passed, false);
    assert.match(failing.checks[0].details, /apps\/suite\/android\/AGENTS\.md missing/);
    assert.match(failing.checks[0].details, /apps\/suite\/api\/AGENTS\.md missing/);
    assert.match(failing.checks[0].details, /apps\/suite\/web\/AGENTS\.md missing/);
    assert.doesNotMatch(failing.checks[0].details, /docs\/AGENTS\.md/);

    for (const sub of ["android", "api", "web"]) {
      fs.writeFileSync(path.join(suiteDir, sub, "AGENTS.md"), `# ${sub}\n`, "utf8");
    }

    const passing = verifyWorkspace({ rootDir: tmpDir });
    assert.equal(passing.passed, true);
  });
});

test("generateApp includes Build & Test, Do Not Touch, and Common Pitfalls in AGENTS.md", () => {
  withTempDir((tmpDir) => {
    const res = generateApp({ name: "signal-desk", stack: "web-ts", rootDir: tmpDir });
    const agents = fs.readFileSync(path.join(res.appDir, "AGENTS.md"), "utf8");
    assert.match(agents, /## Build & Test/);
    assert.match(agents, /## Do Not Touch/);
    assert.match(agents, /## Common Pitfalls/);
  });
});
