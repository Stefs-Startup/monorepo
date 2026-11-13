import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";
import {
  analyzeJavaBlastRadius,
  analyzeTypeScriptBlastRadius,
  computeScoringSummary,
  formatBlastRadiusMarkdown,
  parseUnifiedDiff,
  type DependencyDelta,
} from "../src/index.js";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");

describe("Java AST analyzer on real apps/pulse/backend", () => {
  it("maps spring-boot-starter-webmvc + jackson-databind to real controllers, services, config, and DTO records", () => {
    const warnings: string[] = [];
    const javaDeps: DependencyDelta[] = [
      {
        id: "gradle:org.springframework.boot:spring-boot-starter-webmvc",
        ecosystem: "gradle",
        category: "java",
        name: "org.springframework.boot:spring-boot-starter-webmvc",
        group: "org.springframework.boot",
        artifact: "spring-boot-starter-webmvc",
        fromVersion: "4.1.2",
        toVersion: "5.0.0",
        bumpKind: "major",
        direct: true,
        sourceFile: "apps/pulse/backend/build.gradle.kts",
        inferredPackages: [
          "org.springframework.web",
          "org.springframework.http",
          "org.springframework.boot",
          "org.springframework.context",
          "org.springframework.stereotype",
        ],
      },
      {
        id: "gradle:com.fasterxml.jackson.core:jackson-databind",
        ecosystem: "gradle",
        category: "java",
        name: "com.fasterxml.jackson.core:jackson-databind",
        group: "com.fasterxml.jackson.core",
        artifact: "jackson-databind",
        fromVersion: "2.18.1",
        toVersion: "2.19.0",
        bumpKind: "minor",
        direct: false,
        sourceFile: "apps/pulse/backend/build.gradle.kts",
        inferredPackages: ["com.fasterxml.jackson", "tools.jackson"],
      },
    ];

    const res = analyzeJavaBlastRadius(REPO_ROOT, javaDeps, warnings);
    assert.equal(warnings.length, 0);

    const controller = res.affectedFiles.find((f) =>
      f.filePath.endsWith("PulseController.java"),
    );
    assert.ok(controller, "PulseController.java must be detected");
    assert.equal(controller.isCriticalPath, true);
    assert.ok(controller.criticalPathTags.includes("@RestController"));
    assert.ok(controller.criticalPathTags.includes("@ExceptionHandler"));
    assert.ok(
      controller.touchpoints.some((t) => t.symbolName === "@RestController" && t.line === 25),
    );

    const service = res.affectedFiles.find((f) =>
      f.filePath.endsWith("PulseAccountabilityService.java"),
    );
    assert.ok(service, "PulseAccountabilityService.java must be detected");
    assert.ok(service.criticalPathTags.includes("@Service"));

    const corsConfig = res.affectedFiles.find((f) =>
      f.filePath.endsWith("WebCorsConfig.java"),
    );
    assert.ok(corsConfig, "WebCorsConfig.java must be detected");
    assert.ok(corsConfig.criticalPathTags.includes("@Configuration"));

    const dtos = res.affectedFiles.find((f) =>
      f.filePath.endsWith("PulseDtos.java"),
    );
    assert.ok(dtos, "PulseDtos.java must be detected via DTO propagation & Jackson");
    assert.equal(dtos.isDtoOrContract, true);
    assert.ok(dtos.criticalPathTags.includes("DTO"));

    assert.ok(
      res.dtoContracts.some(
        (d) => d.symbolName === "PulseDashboardResponse" && d.line === 33,
      ),
    );
    assert.ok(
      res.dtoContracts.some((d) => d.symbolName === "TriageRequest" && d.line === 50),
    );
  });

  it("detects @Controller, @Repository, @Transactional, @SecurityFilterChain, and @Bean in synthetic Java files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "blast-java-syn-"));
    try {
      const javaDir = path.join(tmpDir, "src/main/java/com/acme");
      fs.mkdirSync(javaDir, { recursive: true });
      fs.writeFileSync(
        path.join(javaDir, "SecurityConfig.java"),
        `package com.acme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.web.SecurityFilterChain;
@Configuration
public class SecurityConfig {
  @Bean
  SecurityFilterChain securityFilterChain() { return null; }
}
`,
      );
      fs.writeFileSync(
        path.join(javaDir, "OrderRepository.java"),
        `package com.acme;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
@Repository
public class OrderRepository {
  @Transactional
  public void saveOrder() {}
}
`,
      );

      const warnings: string[] = [];
      const deps: DependencyDelta[] = [
        {
          id: "maven:org.springframework.security:spring-security-config",
          ecosystem: "maven",
          category: "java",
          name: "org.springframework.security:spring-security-config",
          fromVersion: "6.4.0",
          toVersion: "7.0.0",
          bumpKind: "major",
          direct: true,
          sourceFile: "pom.xml",
          inferredPackages: ["org.springframework.security", "org.springframework.context"],
        },
        {
          id: "maven:org.springframework:spring-tx",
          ecosystem: "maven",
          category: "java",
          name: "org.springframework:spring-tx",
          fromVersion: "6.2.0",
          toVersion: "6.2.1",
          bumpKind: "patch",
          direct: true,
          sourceFile: "pom.xml",
          inferredPackages: ["org.springframework.transaction"],
        },
      ];

      const res = analyzeJavaBlastRadius(tmpDir, deps, warnings);
      assert.equal(warnings.length, 0);
      const sec = res.affectedFiles.find((f) => f.filePath.endsWith("SecurityConfig.java"));
      assert.ok(sec);
      assert.ok(sec.criticalPathTags.includes("@SecurityFilterChain"));
      assert.ok(sec.criticalPathTags.includes("@Bean"));
      assert.ok(sec.criticalPathTags.includes("@Configuration"));

      const repo = res.affectedFiles.find((f) => f.filePath.endsWith("OrderRepository.java"));
      assert.ok(repo);
      assert.ok(repo.criticalPathTags.includes("@Repository"));
      assert.ok(repo.criticalPathTags.includes("@Transactional"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("Angular / TypeScript AST analyzer on real apps/pulse/web", () => {
  it("maps @angular/core and rxjs to @Component, @Injectable, Signal, RxJS, and models DTOs", () => {
    const warnings: string[] = [];
    const tsDeps: DependencyDelta[] = [
      {
        id: "npm:@angular/core",
        ecosystem: "npm",
        category: "typescript",
        name: "@angular/core",
        group: "@angular",
        artifact: "core",
        fromVersion: "21.2.26",
        toVersion: "22.0.0",
        bumpKind: "major",
        direct: true,
        sourceFile: "apps/pulse/web/package-lock.json",
        inferredPackages: ["@angular/core", "@angular/core/rxjs-interop"],
      },
      {
        id: "npm:rxjs",
        ecosystem: "npm",
        category: "typescript",
        name: "rxjs",
        artifact: "rxjs",
        fromVersion: "7.8.2",
        toVersion: "8.0.0",
        bumpKind: "major",
        direct: true,
        sourceFile: "apps/pulse/web/package-lock.json",
        inferredPackages: ["rxjs", "rxjs/operators"],
      },
    ];

    const res = analyzeTypeScriptBlastRadius(REPO_ROOT, tsDeps, warnings);
    assert.equal(warnings.length, 0);

    const stateSvc = res.affectedFiles.find((f) =>
      f.filePath.endsWith("pulse-state.service.ts"),
    );
    assert.ok(stateSvc, "pulse-state.service.ts must be detected");
    assert.equal(stateSvc.isCriticalPath, true);
    assert.ok(stateSvc.criticalPathTags.includes("@Injectable"));
    assert.ok(stateSvc.criticalPathTags.includes("Signal"));
    assert.ok(stateSvc.criticalPathTags.includes("RxJS"));

    const appCmp = res.affectedFiles.find((f) =>
      f.filePath.endsWith("app.component.ts"),
    );
    assert.ok(appCmp);
    assert.ok(appCmp.criticalPathTags.includes("@Component"));
    assert.ok(appCmp.criticalPathTags.includes("Signal"));

    const models = res.affectedFiles.find((f) =>
      f.filePath.endsWith("pulse.models.ts"),
    );
    assert.ok(models, "pulse.models.ts DTO file must be propagated");
    assert.equal(models.isDtoOrContract, true);
    assert.ok(
      res.dtoContracts.some((d) => d.symbolName === "PulseDashboardResponse"),
    );
  });

  it("scores a patch bump on @angular/forms as MODERATE - VERIFY TESTS", () => {
    const warnings: string[] = [];
    const tsDeps: DependencyDelta[] = [
      {
        id: "npm:@angular/forms",
        ecosystem: "npm",
        category: "typescript",
        name: "@angular/forms",
        group: "@angular",
        artifact: "forms",
        fromVersion: "21.2.26",
        toVersion: "21.2.27",
        bumpKind: "patch",
        direct: true,
        sourceFile: "apps/pulse/web/package-lock.json",
        inferredPackages: ["@angular/forms"],
      },
    ];

    const res = analyzeTypeScriptBlastRadius(REPO_ROOT, tsDeps, warnings);
    assert.equal(res.affectedFiles.length, 2);
    assert.equal(res.dtoContracts.length, 0);

    const scoring = computeScoringSummary({
      dependencies: tsDeps,
      affectedFiles: res.affectedFiles,
      dtoContracts: res.dtoContracts,
      sbom: {
        status: "not_provided",
        source: null,
        totalComponents: 0,
        matchedDependencies: 0,
        alerts: [],
        warnings: [],
      },
      openRewrite: {
        source: "none",
        filesChanged: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        files: [],
        summaryLines: [],
      },
    });
    assert.equal(scoring.confidenceTier, "MODERATE - VERIFY TESTS");
    assert.equal(scoring.gateExitCode, 10);
  });
});

describe("OpenRewrite diff parser & Markdown formatter", () => {
  it("parses unified diffs and emits valid Markdown PR comment markers", () => {
    const diff = `diff --git a/apps/pulse/backend/src/main/java/com/pulse/backend/api/PulseController.java b/apps/pulse/backend/src/main/java/com/pulse/backend/api/PulseController.java
--- a/apps/pulse/backend/src/main/java/com/pulse/backend/api/PulseController.java
+++ b/apps/pulse/backend/src/main/java/com/pulse/backend/api/PulseController.java
@@ -18,1 +18,1 @@
-import org.springframework.web.bind.annotation.RequestMapping;
+import org.springframework.web.bind.annotation.RestController;
`;
    const openRewrite = parseUnifiedDiff(diff, "file", "rewrite.patch");
    assert.equal(openRewrite.filesChanged, 1);
    assert.equal(openRewrite.totalAdditions, 1);
    assert.equal(openRewrite.totalDeletions, 1);

    const md = formatBlastRadiusMarkdown({
      schemaVersion: "1.0.0",
      generatedAt: "2026-11-13T12:00:00.000Z",
      repoRoot: "monorepo",
      baseRef: "main",
      headRef: "HEAD",
      ecosystemsAnalyzed: ["gradle"],
      dependencies: [],
      packageMappings: [],
      affectedFiles: [],
      dtoContracts: [],
      sbom: {
        status: "not_provided",
        source: null,
        totalComponents: 0,
        matchedDependencies: 0,
        alerts: [],
        warnings: [],
      },
      openRewrite,
      scoring: computeScoringSummary({
        dependencies: [],
        affectedFiles: [],
        dtoContracts: [],
        sbom: {
          status: "not_provided",
          source: null,
          totalComponents: 0,
          matchedDependencies: 0,
          alerts: [],
          warnings: [],
        },
        openRewrite,
      }),
      warnings: [],
    });

    assert.ok(md.startsWith("<!-- cmp-blast-radius-report -->"));
    assert.ok(md.includes("HIGH CONFIDENCE / AUTO-MERGE"));
    assert.ok(md.includes("OpenRewrite / Migration Diffs"));
  });
});
