import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";
import {
  classifyVersionBump,
  diffGradleDeps,
  diffMavenDeps,
  diffNpmDeps,
  diffPnpmDeps,
  loadAndCrossCheckSbom,
  parseGradleBuildScript,
  parseGradleDependenciesText,
  parseGradleVersionCatalog,
  parseMavenTreeJson,
  parseNpmLockfile,
  parsePnpmLockfile,
  parsePomXml,
  type DependencyDelta,
} from "../src/index.js";

describe("semver classification", () => {
  it("classifies major, minor, patch, added, removed, and unchanged bumps", () => {
    assert.equal(classifyVersionBump("4.1.2", "5.0.0"), "major");
    assert.equal(classifyVersionBump("^21.2.26", "^21.3.0"), "minor");
    assert.equal(classifyVersionBump("~7.8.2", "~7.8.3"), "patch");
    assert.equal(classifyVersionBump(null, "1.3.0"), "added");
    assert.equal(classifyVersionBump("1.3.0", null), "removed");
    assert.equal(classifyVersionBump("21.2.26", "21.2.26"), "unchanged");
    assert.equal(classifyVersionBump("workspace:*", "workspace:*"), "unchanged");
  });
});

describe("Gradle parsers", () => {
  it("parses build.gradle.kts plugins and BOM-managed Spring Boot dependencies", () => {
    const baseKts = `
      plugins {
        id("org.springframework.boot") version "4.1.2"
      }
      dependencies {
        implementation("org.springframework.boot:spring-boot-starter-webmvc")
        testImplementation("com.tngtech.archunit:archunit-junit5:1.3.0")
      }
    `;
    const headKts = `
      plugins {
        id("org.springframework.boot") version "5.0.0"
      }
      dependencies {
        implementation("org.springframework.boot:spring-boot-starter-webmvc")
        implementation("com.fasterxml.jackson.core:jackson-databind:2.19.0")
        testImplementation("com.tngtech.archunit:archunit-junit5:1.3.1")
      }
    `;
    const base = parseGradleBuildScript(baseKts, "apps/pulse/backend/build.gradle.kts");
    const head = parseGradleBuildScript(headKts, "apps/pulse/backend/build.gradle.kts");
    const deltas = diffGradleDeps(base, head);

    const webmvc = deltas.find(
      (d) => d.name === "org.springframework.boot:spring-boot-starter-webmvc",
    );
    assert.ok(webmvc);
    assert.equal(webmvc.fromVersion, "4.1.2");
    assert.equal(webmvc.toVersion, "5.0.0");
    assert.equal(webmvc.bumpKind, "major");

    const jackson = deltas.find(
      (d) => d.name === "com.fasterxml.jackson.core:jackson-databind",
    );
    assert.ok(jackson);
    assert.equal(jackson.bumpKind, "added");
    assert.ok(jackson.inferredPackages.includes("com.fasterxml.jackson"));
  });

  it("parses gradle/libs.versions.toml version catalogs", () => {
    const warnings: string[] = [];
    const baseToml = `
      [versions]
      okhttp = "4.12.1"
      [libraries]
      okhttp = { group = "com.squareup.okhttp3", name = "okhttp", version.ref = "okhttp" }
    `;
    const headToml = `
      [versions]
      okhttp = "5.0.0"
      [libraries]
      okhttp = { group = "com.squareup.okhttp3", name = "okhttp", version.ref = "okhttp" }
    `;
    const deltas = diffGradleDeps(
      parseGradleVersionCatalog(baseToml, "gradle/libs.versions.toml", warnings),
      parseGradleVersionCatalog(headToml, "gradle/libs.versions.toml", warnings),
    );
    assert.equal(warnings.length, 0);
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0].name, "com.squareup.okhttp3:okhttp");
    assert.equal(deltas[0].bumpKind, "major");
  });

  it("parses ./gradlew dependencies ASCII tree output with version conflict arrows", () => {
    const warnings: string[] = [];
    const baseTxt = `
compileClasspath - Compile classpath for source set 'main'.
+--- org.springframework.boot:spring-boot-starter-webmvc:4.1.2
|    +--- org.springframework:spring-webmvc:7.0.0
|    \\--- com.fasterxml.jackson.core:jackson-databind:2.18.0 -> 2.18.1 (*)
\\--- org.slf4j:slf4j-api:2.0.16 (c)
`;
    const headTxt = `
compileClasspath - Compile classpath for source set 'main'.
+--- org.springframework.boot:spring-boot-starter-webmvc:5.0.0
|    +--- org.springframework:spring-webmvc:7.1.0
|    \\--- com.fasterxml.jackson.core:jackson-databind:2.18.0 -> 2.19.0 (*)
\\--- org.slf4j:slf4j-api:2.0.17 (c)
`;
    const base = parseGradleDependenciesText(baseTxt, "gradle-base.txt", warnings);
    const head = parseGradleDependenciesText(headTxt, "gradle-head.txt", warnings);
    const deltas = diffGradleDeps(base, head);
    assert.equal(warnings.length, 0);
    assert.equal(deltas.length, 4);

    const jackson = deltas.find(
      (d) => d.name === "com.fasterxml.jackson.core:jackson-databind",
    );
    assert.ok(jackson);
    assert.equal(jackson.direct, false);
    assert.equal(jackson.fromVersion, "2.18.1");
    assert.equal(jackson.toVersion, "2.19.0");
    assert.equal(jackson.bumpKind, "minor");
  });
});

describe("Maven parsers", () => {
  it("parses mvn dependency:tree -DoutputType=json output", () => {
    const warnings: string[] = [];
    const baseJson = JSON.stringify({
      groupId: "com.pulse",
      artifactId: "pulse-backend",
      version: "0.6.0",
      children: [
        {
          groupId: "org.springframework.boot",
          artifactId: "spring-boot-starter-webmvc",
          version: "4.1.2",
          children: [
            {
              groupId: "com.fasterxml.jackson.core",
              artifactId: "jackson-databind",
              version: "2.18.1",
            },
          ],
        },
      ],
    });
    const headJson = JSON.stringify({
      groupId: "com.pulse",
      artifactId: "pulse-backend",
      version: "0.6.0",
      children: [
        {
          groupId: "org.springframework.boot",
          artifactId: "spring-boot-starter-webmvc",
          version: "5.0.0",
          children: [
            {
              groupId: "com.fasterxml.jackson.core",
              artifactId: "jackson-databind",
              version: "2.19.0",
            },
          ],
        },
      ],
    });

    const deltas = diffMavenDeps(
      parseMavenTreeJson(baseJson, "maven-base.json", warnings),
      parseMavenTreeJson(headJson, "maven-head.json", warnings),
    );
    assert.equal(warnings.length, 0);
    assert.equal(deltas.length, 2);
    assert.equal(deltas[0].ecosystem, "maven");
    assert.equal(deltas[1].direct, true);
    assert.equal(deltas[0].direct, false);
  });

  it("parses pom.xml with properties and handles malformed XML cleanly", () => {
    const warnings: string[] = [];
    const basePom = `
      <project>
        <parent>
          <groupId>org.springframework.boot</groupId>
          <artifactId>spring-boot-starter-parent</artifactId>
          <version>4.1.2</version>
        </parent>
        <properties>
          <jackson.version>2.18.1</jackson.version>
        </properties>
        <dependencies>
          <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-databind</artifactId>
            <version>\${jackson.version}</version>
          </dependency>
        </dependencies>
      </project>
    `;
    const headPom = basePom.replace("4.1.2", "5.0.0").replace("2.18.1", "2.19.0");
    const deltas = diffMavenDeps(
      parsePomXml(basePom, "pom.xml", warnings),
      parsePomXml(headPom, "pom.xml", warnings),
    );
    assert.equal(warnings.length, 0);
    assert.equal(deltas.length, 2);

    const badWarnings: string[] = [];
    const badMap = parsePomXml("<project><dependencies><dependency></project>", "bad-pom.xml", badWarnings);
    assert.equal(badMap.size, 0);
    assert.ok(badWarnings.some((w) => w.includes("Malformed XML")));
  });
});

describe("npm & pnpm lockfile parsers", () => {
  it("parses package-lock.json v3 and handles malformed JSON", () => {
    const warnings: string[] = [];
    const baseLock = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { dependencies: { "@angular/core": "21.2.26", rxjs: "~7.8.2" } },
        "node_modules/@angular/core": { version: "21.2.26" },
        "node_modules/rxjs": { version: "7.8.2" },
        "node_modules/tslib": { version: "2.8.1" },
      },
    });
    const headLock = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { dependencies: { "@angular/core": "22.0.0", rxjs: "~8.0.0" } },
        "node_modules/@angular/core": { version: "22.0.0" },
        "node_modules/rxjs": { version: "8.0.0" },
        "node_modules/tslib": { version: "2.8.2" },
      },
    });
    const deltas = diffNpmDeps(
      parseNpmLockfile(baseLock, "apps/pulse/web/package-lock.json", warnings),
      parseNpmLockfile(headLock, "apps/pulse/web/package-lock.json", warnings),
    );
    assert.equal(warnings.length, 0);
    assert.equal(deltas.length, 3);
    assert.equal(deltas.find((d) => d.name === "@angular/core")?.direct, true);
    assert.equal(deltas.find((d) => d.name === "tslib")?.direct, false);

    const badWarnings: string[] = [];
    parseNpmLockfile("{not valid json", "broken-lock.json", badWarnings);
    assert.ok(badWarnings.some((w) => w.includes("Malformed JSON")));
  });

  it("parses pnpm-lock.yaml v9 and preserves highest version across duplicate transitive entries", () => {
    const warnings: string[] = [];
    const baseYaml = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      rimraf:
        specifier: ^6.1.4
        version: 6.1.4
packages:
  lru-cache@11.2.7: {}
  rimraf@6.1.4: {}
`;
    const headYaml = `
lockfileVersion: '9.0'
importers:
  .:
    devDependencies:
      rimraf:
        specifier: ^6.1.4
        version: 6.1.5
packages:
  lru-cache@10.4.3: {}
  lru-cache@11.2.7: {}
  rimraf@6.1.5: {}
`;
    const deltas = diffPnpmDeps(
      parsePnpmLockfile(baseYaml, "pnpm-lock.yaml", warnings),
      parsePnpmLockfile(headYaml, "pnpm-lock.yaml", warnings),
    );
    assert.equal(warnings.length, 0);
    assert.equal(deltas.length, 1);
    assert.equal(deltas[0].name, "rimraf");
    assert.equal(deltas[0].bumpKind, "patch");

    const badWarnings: string[] = [];
    parsePnpmLockfile("importers:\n  bad: [1, 2", "broken-pnpm.yaml", badWarnings);
    assert.ok(badWarnings.some((w) => w.includes("Malformed YAML")));
  });
});

describe("SBOM cross-check", () => {
  it("cross-checks CycloneDX vulnerabilities and handles missing/offline SBOM non-fatally", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "blast-sbom-"));
    try {
      const sbomPath = path.join(tmpDir, "cdx.json");
      fs.writeFileSync(
        sbomPath,
        JSON.stringify({
          bomFormat: "CycloneDX",
          components: [
            {
              "bom-ref": "pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.18.1",
              group: "com.fasterxml.jackson.core",
              name: "jackson-databind",
              version: "2.18.1",
              purl: "pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.18.1",
              licenses: [{ license: { id: "Apache-2.0" } }],
            },
          ],
          vulnerabilities: [
            {
              id: "CVE-2025-9999",
              description: "Deserialization gadget issue",
              ratings: [{ severity: "high" }],
              affects: [
                { ref: "pkg:maven/com.fasterxml.jackson.core/jackson-databind@2.18.1" },
              ],
            },
          ],
        }),
      );

      const deps: DependencyDelta[] = [
        {
          id: "gradle:com.fasterxml.jackson.core:jackson-databind",
          ecosystem: "gradle",
          category: "java",
          name: "com.fasterxml.jackson.core:jackson-databind",
          fromVersion: "2.18.1",
          toVersion: "2.19.0",
          bumpKind: "minor",
          direct: true,
          sourceFile: "build.gradle.kts",
          inferredPackages: ["com.fasterxml.jackson"],
        },
      ];

      const report = loadAndCrossCheckSbom({ repoRoot: tmpDir, sbomFile: sbomPath }, deps);
      assert.equal(report.status, "loaded");
      assert.equal(report.matchedDependencies, 1);
      assert.equal(report.alerts.length, 1);
      assert.equal(report.alerts[0].severity, "high");
      assert.equal(deps[0].sbomCrossCheck?.licenses[0], "Apache-2.0");

      const missing = loadAndCrossCheckSbom(
        { repoRoot: tmpDir, sbomFile: "does-not-exist.json" },
        deps,
      );
      assert.equal(missing.status, "unavailable");
      assert.ok(missing.warnings.length > 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
