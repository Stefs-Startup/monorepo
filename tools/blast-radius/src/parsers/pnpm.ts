import { parse as parseYaml } from "yaml";
import { inferNpmPackages } from "../mappings/package-map.js";
import type { DependencyDelta } from "../types.js";
import { classifyVersionBump, compareSemver } from "../utils/semver.js";

export interface ParsedPnpmDep {
  name: string;
  version: string;
  direct: boolean;
  importers: string[];
  sourceFile: string;
}

function stripPnpmPeerSuffix(rawVersion: string): string {
  const trimmed = rawVersion.trim();
  const parenIdx = trimmed.indexOf("(");
  return parenIdx !== -1 ? trimmed.slice(0, parenIdx).trim() : trimmed;
}

function parsePnpmPackageKey(key: string): { name: string; version: string } | null {
  // v9 key format: "ts-morph@28.0.0" or "@types/node@24.12.4" or "pkg@1.0.0(peer@2.0.0)"
  // v6 key format: "/ts-morph@28.0.0" or "/@types/node@24.12.4(peer@2.0.0)"
  const normalized = stripPnpmPeerSuffix(key.replace(/^\//, ""));
  if (!normalized) return null;

  const atIdx = normalized.lastIndexOf("@");
  if (atIdx <= 0) return null;
  const name = normalized.slice(0, atIdx).trim();
  const version = normalized.slice(atIdx + 1).trim();
  if (!name || !version) return null;
  return { name, version };
}

/**
 * Parses `pnpm-lock.yaml` (v6 and v9) using `yaml`.
 */
export function parsePnpmLockfile(
  raw: string,
  sourceFile: string,
  warnings: string[],
): Map<string, ParsedPnpmDep> {
  const deps = new Map<string, ParsedPnpmDep>();
  if (!raw.trim()) return deps;

  let doc: unknown;
  try {
    doc = parseYaml(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Malformed YAML in ${sourceFile}: ${msg}`);
    return deps;
  }

  if (!doc || typeof doc !== "object") {
    warnings.push(`Invalid pnpm lockfile structure in ${sourceFile}.`);
    return deps;
  }

  const root = doc as Record<string, unknown>;

  const recordImporterDeps = (
    importerName: string,
    section: unknown,
  ): void => {
    if (!section || typeof section !== "object") return;
    for (const [pkgName, entry] of Object.entries(
      section as Record<string, unknown>,
    )) {
      let version = "";
      if (typeof entry === "string") {
        version = stripPnpmPeerSuffix(entry);
      } else if (entry && typeof entry === "object") {
        const ver = (entry as Record<string, unknown>).version;
        if (typeof ver === "string") {
          version = stripPnpmPeerSuffix(ver);
        }
      }
      if (!version || version.startsWith("link:") || version.startsWith("workspace:")) {
        continue;
      }

      const existing = deps.get(pkgName);
      if (!existing) {
        deps.set(pkgName, {
          name: pkgName,
          version,
          direct: true,
          importers: [importerName],
          sourceFile,
        });
      } else {
        existing.direct = true;
        if (!existing.importers.includes(importerName)) {
          existing.importers.push(importerName);
        }
      }
    }
  };

  if (root.importers && typeof root.importers === "object") {
    for (const [importerName, importerObj] of Object.entries(
      root.importers as Record<string, unknown>,
    )) {
      if (!importerObj || typeof importerObj !== "object") continue;
      const imp = importerObj as Record<string, unknown>;
      recordImporterDeps(importerName, imp.dependencies);
      recordImporterDeps(importerName, imp.devDependencies);
      recordImporterDeps(importerName, imp.optionalDependencies);
    }
  } else {
    // Single-importer lockfile fallback
    recordImporterDeps(".", root.dependencies);
    recordImporterDeps(".", root.devDependencies);
    recordImporterDeps(".", root.optionalDependencies);
  }

  if (root.packages && typeof root.packages === "object") {
    for (const pkgKey of Object.keys(root.packages as Record<string, unknown>)) {
      const parsedKey = parsePnpmPackageKey(pkgKey);
      if (!parsedKey) continue;
      const existing = deps.get(parsedKey.name);
      if (!existing) {
        deps.set(parsedKey.name, {
          name: parsedKey.name,
          version: parsedKey.version,
          direct: false,
          importers: [],
          sourceFile,
        });
      } else if (
        !existing.direct &&
        compareSemver(parsedKey.version, existing.version) > 0
      ) {
        existing.version = parsedKey.version;
      }
    }
  }

  return deps;
}

export function diffPnpmDeps(
  baseDeps: Map<string, ParsedPnpmDep>,
  headDeps: Map<string, ParsedPnpmDep>,
): DependencyDelta[] {
  const allNames = new Set([...baseDeps.keys(), ...headDeps.keys()]);
  const deltas: DependencyDelta[] = [];

  for (const name of Array.from(allNames).sort()) {
    const base = baseDeps.get(name);
    const head = headDeps.get(name);
    const fromVersion = base?.version ?? null;
    const toVersion = head?.version ?? null;
    const bumpKind = classifyVersionBump(fromVersion, toVersion);
    if (bumpKind === "unchanged") continue;

    const sourceFile = head?.sourceFile ?? base?.sourceFile ?? "pnpm-lock.yaml";
    const direct = head?.direct ?? base?.direct ?? false;
    const isScoped = name.startsWith("@") && name.includes("/");
    const [scope, pkg] = isScoped ? name.split("/") : [undefined, name];

    deltas.push({
      id: `pnpm:${name}`,
      ecosystem: "pnpm",
      category: "typescript",
      name,
      group: scope,
      artifact: pkg,
      fromVersion,
      toVersion,
      bumpKind,
      direct,
      sourceFile,
      inferredPackages: inferNpmPackages(name),
    });
  }

  return deltas;
}
