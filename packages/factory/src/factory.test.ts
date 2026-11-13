import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runCli } from "./cli.js";
import { generateApp, generateSlice } from "./generators.js";
import { auditPlan } from "./plan-critic.js";
import { auditRequirementTraceability } from "./req-trace.js";
import {
  formatScorecardMarkdown,
  formatScorecardTable,
  generateScorecard,
} from "./scorecard.js";
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
    assert.equal(passing.checks.length, 4);
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

test("auditPlan passes a well-specified plan with metrics, edge cases, and spike note", () => {
  withTempWorkspace((tmpDir) => {
    const goodPlan = `# Feature Plan
- REQ-101: Session persistence in menubar player (< 200ms restore time).
- Acceptance Criteria:
  - Given an authenticated user, when the app moves to background and relaunches, then the session persists without error.
  - On 401 unauthorized or network timeout, retry up to 3 retries and show fallback error banner.
- Verification: Spike confirmed OAuth token persistence in Keychain (ADR-001).
`;
    const result = auditPlan(goodPlan, tmpDir);
    assert.equal(result.passed, true);
    assert.equal(result.score, 100);
    assert.equal(result.issues.length, 0);
    assert.equal(result.escalationDecision, "AUTO_PROCEED");
  });
});

test("auditPlan flags underspecified inputs, missing edge cases, unverified externals, and constraint conflicts", () => {
  withTempWorkspace((tmpDir) => {
    fs.mkdirSync(path.join(tmpDir, ".github"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".github", "ci-projects.json"),
      JSON.stringify({ exclude: ["apps/backstage"] }),
      "utf8",
    );

    const underspecified = "Make the dashboard fast and scalable.";
    const res1 = auditPlan(underspecified, tmpDir);
    assert.equal(res1.passed, false);
    assert.equal(res1.escalationDecision, "ESCALATE_HUMAN");
    assert.ok(res1.issues.some((i) => i.category === "underspecified_inputs"));

    const missingEdgesAndExternal = `# Plan
- REQ-202: Add Stripe payment and OAuth login.
- Acceptance Criteria:
  - Given a user, when they submit payment, then it succeeds within 500ms.
`;
    const res2 = auditPlan(missingEdgesAndExternal, tmpDir);
    assert.equal(res2.passed, false);
    assert.equal(res2.escalationDecision, "AUTO_SPIKE");
    assert.ok(res2.issues.some((i) => i.category === "missing_edge_cases"));
    assert.ok(
      res2.issues.some((i) => i.category === "unverified_external_assumptions"),
    );

    const conflicting = `# Plan
- REQ-303: Deploy apps/backstage using --no-verify to skip Gate 1.
- Acceptance Criteria:
  - Given a push, when it runs within 10s, then it lands.
`;
    const res3 = auditPlan(conflicting, tmpDir);
    assert.equal(res3.passed, false);
    assert.equal(res3.escalationDecision, "ESCALATE_HUMAN");
    assert.ok(res3.issues.some((i) => i.category === "conflicting_constraints"));
  });
});

test("CLI plan:critic executes on plan files and returns expected exit codes", () => {
  withTempWorkspace((tmpDir) => {
    const passFile = path.join(tmpDir, "pass-plan.md");
    fs.writeFileSync(
      passFile,
      "# Plan\nREQ-1: Render within 100ms.\nAcceptance Criteria: Given input, when clicked, then handle error fallback.\n",
      "utf8",
    );
    assert.equal(
      runCli(["plan:critic", passFile, "--json", "--root", tmpDir]),
      0,
    );

    const failFile = path.join(tmpDir, "fail-plan.md");
    fs.writeFileSync(failFile, "Build a fast seamless login.\n", "utf8");
    assert.equal(
      runCli(["plan:critic", failFile, "--json", "--root", tmpDir]),
      1,
    );

    assert.equal(
      runCli(["plan:critic", "does-not-exist.md", "--root", tmpDir]),
      1,
    );
  });
});

test("auditRequirementTraceability passes cleanly when 0 REQ-* IDs are declared", () => {
  withTempWorkspace((tmpDir) => {
    generateApp({ name: "zero-req", stack: "web-ts", rootDir: tmpDir });
    const res = auditRequirementTraceability(tmpDir);
    assert.equal(res.passed, true);
    assert.equal(res.totalRequirements, 0);
    assert.equal(res.coveredRequirements, 0);
    assert.deepEqual(res.uncovered, []);
  });
});

test("auditRequirementTraceability passes when all declared REQ-* IDs are covered in tests/code", () => {
  withTempWorkspace((tmpDir) => {
    generateApp({ name: "web-app", stack: "web-ts", rootDir: tmpDir });
    fs.mkdirSync(path.join(tmpDir, "docs", "experiments"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "docs", "experiments", "01-spec.md"),
      "# Spec\n- REQ-EXP-01: Must render fast.\n- REQ-EXP-02: Must be accessible.\n- REQ-EXP-03: Must log metrics.\n",
      "utf8",
    );
    fs.appendFileSync(
      path.join(tmpDir, "apps", "web-app", "README.md"),
      "\n- REQ-APP-01: App smoke test.\n",
      "utf8",
    );

    fs.mkdirSync(path.join(tmpDir, "apps", "web-app", "Tests"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(tmpDir, "apps", "web-app", "Tests", "AppTests.swift"),
      "// Covers REQ-EXP-01\n",
      "utf8",
    );
    fs.mkdirSync(path.join(tmpDir, "apps", "web-app", "e2e"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(tmpDir, "apps", "web-app", "e2e", "a11y.spec.ts"),
      "// Covers REQ-EXP-02\n",
      "utf8",
    );
    fs.mkdirSync(path.join(tmpDir, "packages", "shared", "src"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(tmpDir, "packages", "shared", "src", "metrics.test.ts"),
      "// Covers REQ-EXP-03\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(tmpDir, "apps", "web-app", "src", "app.test.ts"),
      "// Covers REQ-APP-01\n",
      "utf8",
    );

    const res = auditRequirementTraceability(tmpDir);
    assert.equal(res.passed, true);
    assert.equal(res.totalRequirements, 4);
    assert.equal(res.coveredRequirements, 4);
    assert.deepEqual(res.uncovered, []);
  });
});

test("auditRequirementTraceability and verifyWorkspace Gate 4 fail and list uncovered REQ-* IDs", () => {
  withTempWorkspace((tmpDir) => {
    generateApp({ name: "traced-app", stack: "web-ts", rootDir: tmpDir });
    fs.mkdirSync(path.join(tmpDir, "docs", "experiments"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "docs", "experiments", "spec.md"),
      "- REQ-COVERED-1: Covered\n- REQ-MISSING-2: Uncovered\n",
      "utf8",
    );
    fs.appendFileSync(
      path.join(tmpDir, "apps", "traced-app", "README.md"),
      "\n- REQ-MISSING-3: Also uncovered\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(tmpDir, "apps", "traced-app", "src", "covered.test.ts"),
      "// REQ-COVERED-1\n",
      "utf8",
    );

    const traceRes = auditRequirementTraceability(tmpDir);
    assert.equal(traceRes.passed, false);
    assert.equal(traceRes.totalRequirements, 3);
    assert.equal(traceRes.coveredRequirements, 1);
    assert.deepEqual(traceRes.uncovered, ["REQ-MISSING-2", "REQ-MISSING-3"]);
    assert.match(traceRes.details, /REQ-MISSING-2/);
    assert.match(traceRes.details, /REQ-MISSING-3/);

    const verifyRes = verifyWorkspace({ rootDir: tmpDir });
    assert.equal(verifyRes.passed, false);
    assert.equal(verifyRes.checks.length, 4);
    assert.equal(verifyRes.checks[3].name, "Requirement-to-Code Traceability");
    assert.equal(verifyRes.checks[3].passed, false);
    assert.match(verifyRes.checks[3].details, /REQ-MISSING-2/);
    assert.match(verifyRes.checks[3].details, /REQ-MISSING-3/);
  });
});

test("generateScorecard evaluates all 10 capabilities, flags unpinned SHA uses, and formats outputs", () => {
  withTempWorkspace((tmpDir) => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "sample-monorepo" }),
      "utf8",
    );
    generateApp({ name: "alpha", stack: "web-ts", rootDir: tmpDir });
    generateApp({ name: "web", stack: "web-ts", rootDir: tmpDir });
    fs.appendFileSync(
      path.join(tmpDir, "apps", "alpha", "README.md"),
      "\n- REQ-ALPHA-1: Core check\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(tmpDir, "apps", "alpha", "src", "alpha.property.test.ts"),
      "// REQ-ALPHA-1\n",
      "utf8",
    );
    fs.mkdirSync(path.join(tmpDir, "packages", "core", "src", "evals"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(
        tmpDir,
        "packages",
        "core",
        "src",
        "evals",
        "critic.eval.test.ts",
      ),
      "// eval\n",
      "utf8",
    );

    fs.writeFileSync(path.join(tmpDir, ".dependency-cruiser.cjs"), "module.exports = {};\n", "utf8");
    fs.mkdirSync(path.join(tmpDir, "apps", "alpha", "src", "test"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(tmpDir, "apps", "alpha", "src", "test", "ArchitectureTest.java"),
      "class ArchitectureTest {}\n",
      "utf8",
    );
    fs.writeFileSync(path.join(tmpDir, "stryker.config.mjs"), "export default {};\n", "utf8");
    fs.writeFileSync(
      path.join(tmpDir, "apps", "alpha", "build.gradle.kts"),
      'plugins { id("info.solidsoft.pitest") }\n',
      "utf8",
    );
    fs.mkdirSync(path.join(tmpDir, "apps", "web", "e2e"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "apps", "web", "e2e", "a11y.spec.ts"), "// a11y\n", "utf8");
    fs.writeFileSync(path.join(tmpDir, "lefthook.yml"), "pre-push:\n", "utf8");

    const wfDir = path.join(tmpDir, ".github", "workflows");
    fs.mkdirSync(wfDir, { recursive: true });
    fs.writeFileSync(path.join(wfDir, "a11y.yml"), "name: a11y\n", "utf8");
    fs.writeFileSync(
      path.join(wfDir, "security.yml"),
      [
        "jobs:",
        "  sec:",
        "    steps:",
        "      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
        "      - uses: actions/attest-build-provenance@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        "      - uses: actions/upload-artifact@v7",
      ].join("\n"),
      "utf8",
    );

    const withUnpinned = generateScorecard(tmpDir);
    assert.equal(withUnpinned.repo, "sample-monorepo");
    assert.equal(withUnpinned.capabilities.shaPinning.passed, false);
    assert.equal(
      (withUnpinned.capabilities.shaPinning.unpinnedUses as string[]).length,
      1,
    );
    assert.equal(withUnpinned.overallScore, 90);

    // Fix the unpinned workflow action
    fs.writeFileSync(
      path.join(wfDir, "security.yml"),
      [
        "jobs:",
        "  sec:",
        "    steps:",
        "      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
        "      - uses: actions/attest-build-provenance@a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        "      - uses: ./.github/workflows/reusable-node.yml",
      ].join("\n"),
      "utf8",
    );

    const passing = generateScorecard(tmpDir);
    assert.equal(passing.capabilities.shaPinning.passed, true);
    assert.equal(passing.overallScore, 100);

    const table = formatScorecardTable(passing);
    assert.match(table, /Overall Score: 100\/100/);
    assert.match(table, /Workflow SHA Pinning/);

    const md = formatScorecardMarkdown(passing);
    assert.match(md, /# Release Readiness & Engineering Scorecard/);
    assert.match(md, /\*\*100\/100\*\*/);

    const exitCode = runCli(["scorecard", "--write", "--json", "--root", tmpDir]);
    assert.equal(exitCode, 0);
    assert.equal(fs.existsSync(path.join(tmpDir, "docs", "scorecard.md")), true);
    assert.equal(fs.existsSync(path.join(tmpDir, ".turbo", "scorecard.json")), true);
  });
});
