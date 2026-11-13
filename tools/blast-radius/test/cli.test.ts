import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";
import type { BlastRadiusReport } from "../src/types.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const CLI_PATH = path.resolve(REPO_ROOT, "tools/blast-radius/dist/src/cli.js");

function runBuiltCli(args: string[], envOverrides?: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...envOverrides },
  });
}

describe("blast-radius CLI end-to-end", () => {
  it("exits 0 with --gate on HIGH CONFIDENCE (patch on unrelated/dev dependency)", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "blast-cli-high-"));
    try {
      const baseLock = path.join(tmpDir, "pnpm-base.yaml");
      const headLock = path.join(tmpDir, "pnpm-head.yaml");
      fs.writeFileSync(
        baseLock,
        `lockfileVersion: '9.0'\nimporters:\n  .:\n    devDependencies:\n      rimraf:\n        specifier: ^6.1.4\n        version: 6.1.4\n`,
      );
      fs.writeFileSync(
        headLock,
        `lockfileVersion: '9.0'\nimporters:\n  .:\n    devDependencies:\n      rimraf:\n        specifier: ^6.1.4\n        version: 6.1.5\n`,
      );

      const res = runBuiltCli([
        "--root",
        REPO_ROOT,
        "--pnpm-lock-base",
        baseLock,
        "--pnpm-lock-head",
        headLock,
        "--gate",
        "--json",
      ]);
      assert.equal(res.status, 0, `stderr: ${res.stderr}`);
      const report = JSON.parse(res.stdout) as BlastRadiusReport;
      assert.equal(report.scoring.confidenceTier, "HIGH CONFIDENCE / AUTO-MERGE");
      assert.equal(report.scoring.gateExitCode, 0);
      assert.equal(report.scoring.autoMergeEligible, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("exits 10 with --gate on MODERATE and 0 when --allow-moderate is passed", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "blast-cli-mod-"));
    try {
      const baseLock = path.join(tmpDir, "npm-base.json");
      const headLock = path.join(tmpDir, "npm-head.json");
      fs.writeFileSync(
        baseLock,
        JSON.stringify({
          lockfileVersion: 3,
          packages: {
            "": { dependencies: { "@angular/forms": "21.2.26" } },
            "node_modules/@angular/forms": { version: "21.2.26" },
          },
        }),
      );
      fs.writeFileSync(
        headLock,
        JSON.stringify({
          lockfileVersion: 3,
          packages: {
            "": { dependencies: { "@angular/forms": "21.2.27" } },
            "node_modules/@angular/forms": { version: "21.2.27" },
          },
        }),
      );

      const gateRes = runBuiltCli([
        "--root",
        REPO_ROOT,
        "--npm-lock-base",
        baseLock,
        "--npm-lock-head",
        headLock,
        "--gate",
        "--json",
      ]);
      assert.equal(gateRes.status, 10, `stderr: ${gateRes.stderr}`);
      const report = JSON.parse(gateRes.stdout) as BlastRadiusReport;
      assert.equal(report.scoring.confidenceTier, "MODERATE - VERIFY TESTS");

      const allowedRes = runBuiltCli([
        "--root",
        REPO_ROOT,
        "--npm-lock-base",
        baseLock,
        "--npm-lock-head",
        headLock,
        "--gate",
        "--allow-moderate",
      ]);
      assert.equal(allowedRes.status, 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("exits 20 with --gate on CRITICAL PATH and writes JSON + Markdown artifacts", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "blast-cli-crit-"));
    try {
      const gradleBase = path.join(tmpDir, "gradle-base.txt");
      const gradleHead = path.join(tmpDir, "gradle-head.txt");
      const npmBase = path.join(tmpDir, "npm-base.json");
      const npmHead = path.join(tmpDir, "npm-head.json");
      const openRewritePatch = path.join(tmpDir, "openrewrite.diff");
      const sbomFile = path.join(tmpDir, "sbom.json");
      const jsonOut = path.join(tmpDir, "blast-radius-report.json");
      const mdOut = path.join(tmpDir, "blast-radius-summary.md");

      fs.writeFileSync(
        gradleBase,
        "compileClasspath\n+--- org.springframework.boot:spring-boot-starter-webmvc:4.1.2\n\\--- com.fasterxml.jackson.core:jackson-databind:2.18.1\n",
      );
      fs.writeFileSync(
        gradleHead,
        "compileClasspath\n+--- org.springframework.boot:spring-boot-starter-webmvc:5.0.0\n\\--- com.fasterxml.jackson.core:jackson-databind:2.19.0\n",
      );
      fs.writeFileSync(
        npmBase,
        JSON.stringify({
          lockfileVersion: 3,
          packages: {
            "": { dependencies: { "@angular/core": "21.2.26", rxjs: "7.8.2" } },
            "node_modules/@angular/core": { version: "21.2.26" },
            "node_modules/rxjs": { version: "7.8.2" },
          },
        }),
      );
      fs.writeFileSync(
        npmHead,
        JSON.stringify({
          lockfileVersion: 3,
          packages: {
            "": { dependencies: { "@angular/core": "22.0.0", rxjs: "8.0.0" } },
            "node_modules/@angular/core": { version: "22.0.0" },
            "node_modules/rxjs": { version: "8.0.0" },
          },
        }),
      );
      fs.writeFileSync(
        openRewritePatch,
        "diff --git a/apps/pulse/backend/src/main/java/com/pulse/backend/api/PulseController.java b/apps/pulse/backend/src/main/java/com/pulse/backend/api/PulseController.java\n--- a/apps/pulse/backend/src/main/java/com/pulse/backend/api/PulseController.java\n+++ b/apps/pulse/backend/src/main/java/com/pulse/backend/api/PulseController.java\n@@ -1 +1 @@\n-import old.DeprecatedApi;\n+import org.springframework.web.bind.annotation.RestController;\n",
      );
      fs.writeFileSync(
        sbomFile,
        JSON.stringify({
          sbom: {
            packages: [
              {
                name: "maven:org.springframework.boot:spring-boot-starter-webmvc",
                versionInfo: "4.1.2",
                licenseDeclared: "Apache-2.0",
              },
              {
                name: "npm:@angular/core",
                versionInfo: "21.2.26",
                licenseDeclared: "MIT",
              },
            ],
          },
        }),
      );

      const res = runBuiltCli([
        "--root",
        REPO_ROOT,
        "--gradle-base",
        gradleBase,
        "--gradle-head",
        gradleHead,
        "--npm-lock-base",
        npmBase,
        "--npm-lock-head",
        npmHead,
        "--sbom",
        sbomFile,
        "--openrewrite-diff",
        openRewritePatch,
        "--out",
        jsonOut,
        "--md-out",
        mdOut,
        "--gate",
      ]);
      assert.equal(res.status, 20, `stdout: ${res.stdout}\nstderr: ${res.stderr}`);
      assert.ok(fs.existsSync(jsonOut));
      assert.ok(fs.existsSync(mdOut));

      const report = JSON.parse(fs.readFileSync(jsonOut, "utf8")) as BlastRadiusReport;
      assert.equal(report.schemaVersion, "1.0.0");
      assert.equal(report.scoring.confidenceTier, "CRITICAL PATH TOUCHED - MANUAL REVIEW");
      assert.equal(report.scoring.gateExitCode, 20);
      assert.equal(report.sbom.status, "loaded");
      assert.equal(report.sbom.matchedDependencies, 2);
      assert.equal(report.openRewrite.filesChanged, 1);
      assert.ok(
        report.affectedFiles.some((f) => f.filePath.endsWith("PulseController.java")),
      );
      assert.ok(
        report.affectedFiles.some((f) => f.filePath.endsWith("pulse-state.service.ts")),
      );
      assert.ok(report.dtoContracts.length >= 5);

      const md = fs.readFileSync(mdOut, "utf8");
      assert.ok(md.includes("<!-- cmp-blast-radius-report -->"));
      assert.ok(md.includes("### Top Critical-Path Touchpoints"));
      assert.ok(md.includes("DTO / Contract Touchpoints"));
      assert.ok(md.includes("OpenRewrite / Migration Diffs"));
      assert.ok(md.includes("CRITICAL PATH TOUCHED - MANUAL REVIEW"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("handles missing base ref and offline SBOM failure gracefully without crashing", () => {
    const res = runBuiltCli(
      [
        "--root",
        REPO_ROOT,
        "--base",
        "nonexistent-branch-xyz-999",
        "--fetch-sbom",
        "--json",
      ],
      {
        PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
        GH_TOKEN: "",
        GITHUB_TOKEN: "",
      },
    );
    assert.equal(res.status, 0, `stderr: ${res.stderr}`);
    const report = JSON.parse(res.stdout) as BlastRadiusReport;
    assert.equal(report.sbom.status, "unavailable");
    assert.ok(
      report.warnings.some((w) => w.includes("nonexistent-branch-xyz-999")),
    );
    assert.ok(
      report.warnings.some((w) => w.includes("SBOM")),
    );
  });

  it("exits 1 on unknown CLI flag", () => {
    const res = runBuiltCli(["--not-a-real-flag"]);
    assert.equal(res.status, 1);
    assert.ok(res.stderr.includes("Unknown option"));
  });

  it("executes properly when invoked through an arbitrary symlink name", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "blast-cli-symlink-"));
    try {
      const symlinkPath = path.join(tmpDir, "blast-radius-link");
      fs.symlinkSync(CLI_PATH, symlinkPath);

      const viaNode = spawnSync(process.execPath, [symlinkPath, "--help"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      });
      assert.equal(viaNode.status, 0, `stderr: ${viaNode.stderr}`);
      assert.ok(viaNode.stdout.includes("Usage: blast-radius [options]"));

      const directExec = spawnSync(symlinkPath, ["--help"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      });
      assert.equal(directExec.status, 0, `stderr: ${directExec.stderr}`);
      assert.ok(directExec.stdout.includes("Usage: blast-radius [options]"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("supports Maven dependency:tree JSON + pom.xml fixtures end-to-end and contains zero external SaaS/telemetry calls", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "blast-cli-maven-"));
    try {
      const treeBase = path.join(tmpDir, "tree-base.json");
      const treeHead = path.join(tmpDir, "tree-head.json");
      const pomBase = path.join(tmpDir, "pom-base.xml");
      const pomHead = path.join(tmpDir, "pom-head.xml");

      fs.writeFileSync(
        treeBase,
        JSON.stringify({
          groupId: "com.pulse",
          artifactId: "pulse-backend",
          version: "0.6.0",
          children: [
            {
              groupId: "org.springframework.boot",
              artifactId: "spring-boot-starter-webmvc",
              version: "4.1.2",
            },
          ],
        }),
      );
      fs.writeFileSync(
        treeHead,
        JSON.stringify({
          groupId: "com.pulse",
          artifactId: "pulse-backend",
          version: "0.6.0",
          children: [
            {
              groupId: "org.springframework.boot",
              artifactId: "spring-boot-starter-webmvc",
              version: "5.0.0",
            },
          ],
        }),
      );
      fs.writeFileSync(
        pomBase,
        `<project><dependencies><dependency><groupId>com.fasterxml.jackson.core</groupId><artifactId>jackson-databind</artifactId><version>2.18.1</version></dependency></dependencies></project>`,
      );
      fs.writeFileSync(
        pomHead,
        `<project><dependencies><dependency><groupId>com.fasterxml.jackson.core</groupId><artifactId>jackson-databind</artifactId><version>2.19.0</version></dependency></dependencies></project>`,
      );

      const res = runBuiltCli([
        "--root",
        REPO_ROOT,
        "--maven-tree-base",
        treeBase,
        "--maven-tree-head",
        treeHead,
        "--pom-base",
        pomBase,
        "--pom-head",
        pomHead,
        "--gate",
        "--json",
      ]);
      assert.equal(res.status, 20, `stderr: ${res.stderr}`);
      const report = JSON.parse(res.stdout) as BlastRadiusReport;
      assert.ok(report.ecosystemsAnalyzed.includes("maven"));
      assert.equal(report.dependencies.length, 2);
      assert.ok(
        report.affectedFiles.some((f) => f.filePath.endsWith("PulseController.java")),
      );

      // Verify zero external SaaS/telemetry calls in tools/blast-radius/src
      const srcDir = path.join(REPO_ROOT, "tools/blast-radius/src");
      const collectTs = (d: string): string[] =>
        fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory()
            ? collectTs(path.join(d, e.name))
            : e.name.endsWith(".ts")
              ? [path.join(d, e.name)]
              : [],
        );
      for (const file of collectTs(srcDir)) {
        const text = fs.readFileSync(file, "utf8");
        assert.equal(/\bfetch\s*\(/.test(text), false, `Unexpected fetch() in ${file}`);
        assert.equal(
          /https?:\/\/(?!github\.com)/i.test(text),
          false,
          `Unexpected external URL in ${file}`,
        );
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
