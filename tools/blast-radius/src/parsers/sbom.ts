import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type {
  DependencyDelta,
  SbomAlert,
  SbomReport,
  SbomVulnerability,
} from "../types.js";
import { safeJsonParse } from "../utils/fs-helpers.js";

interface NormalizedSbomComponent {
  name: string;
  version?: string;
  purl?: string;
  bomRef?: string;
  licenses: string[];
  vulnerabilities: SbomVulnerability[];
}

function normalizeCoordFromPurl(purl: string | undefined): string | null {
  if (!purl) return null;
  // Examples:
  // pkg:maven/org.springframework.boot/spring-boot-starter-webmvc@4.1.2
  // pkg:npm/%40angular/core@21.2.26
  // pkg:npm/@angular/core@21.2.26
  const decoded = decodeURIComponent(purl).split("?")[0].split("#")[0];
  if (decoded.startsWith("pkg:maven/")) {
    const rest = decoded.slice("pkg:maven/".length);
    const withoutVer = rest.split("@")[0];
    const parts = withoutVer.split("/");
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`.toLowerCase();
    }
  }
  if (decoded.startsWith("pkg:npm/")) {
    const rest = decoded.slice("pkg:npm/".length);
    const lastAt = rest.lastIndexOf("@");
    const pkgName = lastAt > 0 ? rest.slice(0, lastAt) : rest;
    return pkgName.toLowerCase();
  }
  return null;
}

function normalizeSeverity(
  raw: unknown,
): "critical" | "high" | "medium" | "low" | "unknown" {
  const s = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "medium" || s === "moderate") return "medium";
  if (s === "low") return "low";
  return "unknown";
}

function parseSbomJsonObject(
  raw: string,
  source: string,
): {
  ok: boolean;
  format: "cyclonedx" | "spdx" | "github-dependency-graph" | "unknown";
  components: NormalizedSbomComponent[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const parsed = safeJsonParse<Record<string, unknown>>(raw, source, warnings);
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, format: "unknown", components: [], warnings };
  }

  const components: NormalizedSbomComponent[] = [];

  // Format 1: GitHub Dependency Graph SPDX wrapper `{ sbom: { packages: [...] } }` or direct SPDX `{ spdxVersion, packages: [...] }`
  const isGhWrapper = Boolean(parsed.sbom && typeof parsed.sbom === "object");
  const spdxRoot = isGhWrapper
    ? (parsed.sbom as Record<string, unknown>)
    : parsed;

  if (Array.isArray(spdxRoot.packages)) {
    for (const pkgRaw of spdxRoot.packages) {
      if (!pkgRaw || typeof pkgRaw !== "object") continue;
      const pkg = pkgRaw as Record<string, unknown>;
      const rawName = typeof pkg.name === "string" ? pkg.name.trim() : "";
      if (!rawName) continue;
      // GitHub Dependency Graph names often look like "maven:org.springframework.boot:spring-boot-starter-webmvc" or "npm:@angular/core"
      const cleanName = rawName.replace(/^(?:maven|npm|gradle|actions):/, "");
      const version =
        typeof pkg.versionInfo === "string" ? pkg.versionInfo.trim() : undefined;

      let purl: string | undefined;
      if (Array.isArray(pkg.externalRefs)) {
        for (const ref of pkg.externalRefs) {
          if (ref && typeof ref === "object") {
            const r = ref as Record<string, unknown>;
            if (
              r.referenceType === "purl" &&
              typeof r.referenceLocator === "string"
            ) {
              purl = r.referenceLocator;
              break;
            }
          }
        }
      }

      const licenses: string[] = [];
      for (const lf of [pkg.licenseConcluded, pkg.licenseDeclared]) {
        if (typeof lf === "string" && lf && lf !== "NOASSERTION") {
          licenses.push(lf);
        }
      }

      components.push({
        name: cleanName,
        version,
        purl,
        licenses: Array.from(new Set(licenses)),
        vulnerabilities: [],
      });
    }

    return {
      ok: true,
      format: isGhWrapper ? "github-dependency-graph" : "spdx",
      components,
      warnings,
    };
  }

  // Format 2: CycloneDX (`components` + optional `vulnerabilities`)
  if (Array.isArray(parsed.components) || parsed.bomFormat === "CycloneDX") {
    const byBomRef = new Map<string, NormalizedSbomComponent>();
    const rawComponents = Array.isArray(parsed.components)
      ? parsed.components
      : [];

    for (const compRaw of rawComponents) {
      if (!compRaw || typeof compRaw !== "object") continue;
      const comp = compRaw as Record<string, unknown>;
      const group = typeof comp.group === "string" ? comp.group.trim() : "";
      const name = typeof comp.name === "string" ? comp.name.trim() : "";
      if (!name) continue;
      const fullName = group
        ? group.startsWith("@")
          ? `${group}/${name}`
          : `${group}:${name}`
        : name;
      const version =
        typeof comp.version === "string" ? comp.version.trim() : undefined;
      const purl = typeof comp.purl === "string" ? comp.purl.trim() : undefined;
      const bomRef =
        typeof comp["bom-ref"] === "string" ? comp["bom-ref"] : purl;

      const licenses: string[] = [];
      if (Array.isArray(comp.licenses)) {
        for (const licEntry of comp.licenses) {
          if (!licEntry || typeof licEntry !== "object") continue;
          const le = licEntry as Record<string, unknown>;
          const lic =
            le.license && typeof le.license === "object"
              ? (le.license as Record<string, unknown>)
              : null;
          const idOrName =
            (lic && typeof lic.id === "string" && lic.id) ||
            (lic && typeof lic.name === "string" && lic.name) ||
            (typeof le.expression === "string" && le.expression);
          if (idOrName) licenses.push(idOrName);
        }
      }

      const item: NormalizedSbomComponent = {
        name: fullName,
        version,
        purl,
        bomRef,
        licenses: Array.from(new Set(licenses)),
        vulnerabilities: [],
      };
      components.push(item);
      if (bomRef) byBomRef.set(bomRef, item);
      if (purl) byBomRef.set(purl, item);
    }

    if (Array.isArray(parsed.vulnerabilities)) {
      for (const vulnRaw of parsed.vulnerabilities) {
        if (!vulnRaw || typeof vulnRaw !== "object") continue;
        const vuln = vulnRaw as Record<string, unknown>;
        const id = typeof vuln.id === "string" ? vuln.id : "CVE-UNKNOWN";
        const summary =
          (typeof vuln.description === "string" && vuln.description) ||
          (typeof vuln.detail === "string" && vuln.detail) ||
          id;

        let severity: SbomVulnerability["severity"] = "unknown";
        if (Array.isArray(vuln.ratings) && vuln.ratings.length > 0) {
          const first = vuln.ratings[0] as Record<string, unknown>;
          severity = normalizeSeverity(first?.severity);
        }

        const affects = Array.isArray(vuln.affects) ? vuln.affects : [];
        for (const aff of affects) {
          if (!aff || typeof aff !== "object") continue;
          const ref = (aff as Record<string, unknown>).ref;
          if (typeof ref !== "string") continue;
          const target = byBomRef.get(ref);
          if (target) {
            target.vulnerabilities.push({ id, severity, summary });
          }
        }
      }
    }

    return { ok: true, format: "cyclonedx", components, warnings };
  }

  warnings.push(
    `Unrecognized SBOM JSON schema in ${source} (expected CycloneDX, SPDX, or GitHub Dependency Graph JSON).`,
  );
  return { ok: false, format: "unknown", components: [], warnings };
}

export interface LoadSbomOptions {
  repoRoot: string;
  sbomFile?: string;
  fetchSbom?: boolean;
}

/**
 * Loads SBOM JSON from a file or `gh api` (non-fatal if offline/403/missing) and cross-checks deltas.
 */
export function loadAndCrossCheckSbom(
  options: LoadSbomOptions,
  dependencies: DependencyDelta[],
): SbomReport {
  let rawSbom: string | null = null;
  let source: string | null = null;
  const warnings: string[] = [];

  if (options.sbomFile) {
    const resolved = path.isAbsolute(options.sbomFile)
      ? options.sbomFile
      : path.resolve(options.repoRoot, options.sbomFile);
    source = options.sbomFile;
    try {
      rawSbom = fs.readFileSync(resolved, "utf8");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        status: "unavailable",
        source,
        totalComponents: 0,
        matchedDependencies: 0,
        alerts: [],
        warnings: [`Could not read SBOM file "${options.sbomFile}": ${msg}`],
      };
    }
  } else if (options.fetchSbom) {
    source = "gh-dependency-graph";
    const repoRes = spawnSync(
      "gh",
      ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
      { cwd: options.repoRoot, encoding: "utf8", timeout: 5000 },
    );
    if (repoRes.error || repoRes.status !== 0 || !repoRes.stdout.trim()) {
      const errDetail = repoRes.error?.message ?? (repoRes.stderr.trim() || "gh CLI unavailable or unauthenticated");
      return {
        status: "unavailable",
        source,
        totalComponents: 0,
        matchedDependencies: 0,
        alerts: [],
        warnings: [
          `SBOM fetch via gh skipped (non-fatal): ${errDetail}`,
        ],
      };
    }

    const nwo = repoRes.stdout.trim();
    const apiRes = spawnSync(
      "gh",
      ["api", `/repos/${nwo}/dependency-graph/sbom`],
      { cwd: options.repoRoot, encoding: "utf8", timeout: 8000 },
    );
    if (apiRes.error || apiRes.status !== 0 || !apiRes.stdout.trim()) {
      const errDetail = apiRes.error?.message ?? (apiRes.stderr.trim() || `exit ${apiRes.status}`);
      return {
        status: "unavailable",
        source,
        totalComponents: 0,
        matchedDependencies: 0,
        alerts: [],
        warnings: [
          `GitHub Dependency Graph SBOM unavailable for ${nwo} (non-fatal): ${errDetail}`,
        ],
      };
    }
    rawSbom = apiRes.stdout;
  } else {
    return {
      status: "not_provided",
      source: null,
      totalComponents: 0,
      matchedDependencies: 0,
      alerts: [],
      warnings: [],
    };
  }

  const parsed = parseSbomJsonObject(rawSbom, source ?? "sbom.json");
  warnings.push(...parsed.warnings);
  if (!parsed.ok) {
    return {
      status: "parse_error",
      source,
      format: parsed.format,
      totalComponents: 0,
      matchedDependencies: 0,
      alerts: [],
      warnings,
    };
  }

  // Index SBOM components by normalized coordinate & name
  const index = new Map<string, NormalizedSbomComponent>();
  for (const comp of parsed.components) {
    index.set(comp.name.toLowerCase(), comp);
    const fromPurl = normalizeCoordFromPurl(comp.purl);
    if (fromPurl) {
      index.set(fromPurl, comp);
    }
  }

  let matchedCount = 0;
  const alerts: SbomAlert[] = [];

  for (const dep of dependencies) {
    const match = index.get(dep.name.toLowerCase());
    if (!match) continue;
    matchedCount += 1;
    dep.sbomCrossCheck = {
      matched: true,
      componentName: match.name,
      purl: match.purl,
      sbomVersion: match.version,
      licenses: match.licenses,
      vulnerabilities: match.vulnerabilities,
    };
    for (const vuln of match.vulnerabilities) {
      alerts.push({
        dependencyId: dep.id,
        dependencyName: dep.name,
        severity: vuln.severity,
        title: `${vuln.id}: ${vuln.summary}`,
        purl: match.purl,
        id: vuln.id,
      });
    }
  }

  return {
    status: "loaded",
    source,
    format: parsed.format,
    totalComponents: parsed.components.length,
    matchedDependencies: matchedCount,
    alerts,
    warnings,
  };
}
