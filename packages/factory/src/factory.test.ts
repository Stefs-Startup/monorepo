import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runCli } from "./cli.js";
import { generateApp, generateSlice } from "./generators.js";
import { verifyWorkspace } from "./verify.js";

function withTempWorkspace(fn: (rootDir: string) => void): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-factory-test-"));
  try {
    fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test("generateApp scaffolds all required files and AGENTS.md guardrails", () => {
  withTempWorkspace((tmpDir) => {
    const result = generateApp({
      name: "horizon-ops",
      stack: "angular-spring",
      rootDir: tmpDir,
    });

    assert.equal(result.appDir, path.join(tmpDir, "apps", "horizon-ops"));
    assert.equal(result.filesCreated.length, 8);

    const expectedRelativeFiles = [
      "package.json",
      "tsconfig.json",
      "tsconfig.build.json",
      "AGENTS.md",
      "README.md",
      path.join("src", "domain", "horizon-ops-domain.engine.ts"),
      path.join("src", "domain", "horizon-ops-domain.engine.test.ts"),
      path.join("src", "index.ts"),
    ];

    for (const rel of expectedRelativeFiles) {
      const fullPath = path.join(result.appDir, rel);
      assert.equal(fs.existsSync(fullPath), true, `Expected ${rel} to exist`);
    }

    const pkg = JSON.parse(
      fs.readFileSync(path.join(result.appDir, "package.json"), "utf8"),
    ) as {
      name: string;
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    assert.equal(pkg.name, "@cmp/horizon-ops");
    assert.equal(pkg.dependencies["@cmp/utils"], "workspace:*");
    assert.ok(pkg.scripts.build);
    assert.ok(pkg.scripts.test);
    assert.ok(pkg.scripts.lint);
    assert.ok(pkg.scripts.typecheck);
    assert.ok(pkg.scripts.clean);

    const agents = fs.readFileSync(
      path.join(result.appDir, "AGENTS.md"),
      "utf8",
    );
    assert.match(agents, /ADR-007/);
    assert.match(agents, /WCAG 2\.2 AA/);
    assert.match(agents, /Zero-PII/);
    assert.match(agents, /ADR-009/);
    assert.match(agents, /docs\/stack-best-practices\//);
    assert.match(agents, /angular-spring/);

    const readme = fs.readFileSync(
      path.join(result.appDir, "README.md"),
      "utf8",
    );
    assert.match(readme, /pnpm --filter @cmp\/horizon-ops test/);
    assert.match(readme, /pnpm verify:slice/);
  });
});

test("generateSlice scaffolds contract, engine, and tests inside app", () => {
  withTempWorkspace((tmpDir) => {
    generateApp({ name: "pulse-lite", stack: "kmp", rootDir: tmpDir });

    const sliceResult = generateSlice({
      app: "pulse-lite",
      slice: "focus-triage",
      rootDir: tmpDir,
    });

    assert.equal(
      sliceResult.sliceDir,
      path.join(tmpDir, "apps", "pulse-lite", "src", "slices", "focus-triage"),
    );
    assert.equal(sliceResult.filesCreated.length, 3);

    for (const file of [
      "focus-triage.contract.ts",
      "focus-triage.engine.ts",
      "focus-triage.test.ts",
    ]) {
      assert.equal(
        fs.existsSync(path.join(sliceResult.sliceDir, file)),
        true,
        `Expected ${file} to exist`,
      );
    }

    assert.throws(() => {
      generateSlice({
        app: "missing-app",
        slice: "focus-triage",
        rootDir: tmpDir,
      });
    }, /does not exist/);
  });
});

test("verifyWorkspace validates guardrails, WCAG/Zero-PII self-test, and detects violations", () => {
  withTempWorkspace((tmpDir) => {
    generateApp({ name: "clean-app", stack: "web-ts", rootDir: tmpDir });
    generateSlice({ app: "clean-app", slice: "daily-checkin", rootDir: tmpDir });

    const passing = verifyWorkspace({ rootDir: tmpDir });
    assert.equal(passing.passed, true);
    assert.equal(passing.checks.length, 3);
    assert.equal(
      passing.checks.every((check) => check.passed),
      true,
    );

    // Introduce a leftover catalog-info.yaml violation
    const catalogPath = path.join(tmpDir, "apps", "clean-app", "catalog-info.yaml");
    fs.writeFileSync(catalogPath, "apiVersion: backstage.io/v1alpha1\n", "utf8");
    const withCatalog = verifyWorkspace({ rootDir: tmpDir });
    assert.equal(withCatalog.passed, false);
    assert.match(withCatalog.checks[0].details, /catalog-info\.yaml/);

    fs.rmSync(catalogPath);

    // Remove AGENTS.md to verify guardrail catches missing constitution
    fs.rmSync(path.join(tmpDir, "apps", "clean-app", "AGENTS.md"));
    const withoutAgents = verifyWorkspace({ rootDir: tmpDir });
    assert.equal(withoutAgents.passed, false);
    assert.match(withoutAgents.checks[0].details, /AGENTS\.md missing/);
  });
});

test("CLI executes gen:app, gen:slice, and verify --json in temp workspace", () => {
  withTempWorkspace((tmpDir) => {
    assert.equal(
      runCli(["gen:app", "cli-smoke", "--stack=web-ts", "--root", tmpDir]),
      0,
    );
    assert.equal(
      runCli(["gen:slice", "cli-smoke", "welcome-flow", "--root", tmpDir]),
      0,
    );
    assert.equal(
      runCli(["verify", "--json", "--root", tmpDir]),
      0,
    );
    assert.equal(runCli(["unknown:cmd"]), 1);
  });
});
