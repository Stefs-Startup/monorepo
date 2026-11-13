import { inferNpmPackages } from "../mappings/package-map.js";
import type { DependencyDelta } from "../types.js";
import { safeJsonParse } from "../utils/fs-helpers.js";
import { classifyVersionBump, compareSemver } from "../utils/semver.js";

export interface ParsedNpmDep {
  name: string;
  version: string;
  direct: boolean;
  sourceFile: string;
}

interface PackageLockEntry {
  name?: unknown;
  version?: unknown;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
}

interface PackageLockJson {
  lockfileVersion?: unknown;
  packages?: Record<string, PackageLockEntry>;
  dependencies?: Record<string, { version?: unknown; dependencies?: Record<string, unknown> }>;
}

function extractNpmPackageNameFromKey(lockKey: string): string | null {
  if (!lockKey) return null;
  const idx = lockKey.lastIndexOf("node_modules/");
  if (idx === -1) return null;
  const pkgName = lockKey.slice(idx + "node_modules/".length).trim();
  return pkgName || null;
}

/**
 * Parses npm `package-lock.json` (lockfileVersion 1, 2, or 3).
 */
export function parseNpmLockfile(
  raw: string,
  sourceFile: string,
  warnings: string[],
): Map<string, ParsedNpmDep> {
  const deps = new Map<string, ParsedNpmDep>();
  if (!raw.trim()) return deps;

  const parsed = safeJsonParse<PackageLockJson>(raw, sourceFile, warnings);
  if (!parsed || typeof parsed !== "object") {
    return deps;
  }

  const directNames = new Set<string>();
  const packages = parsed.packages;
  if (packages && typeof packages === "object") {
    const rootEntry = packages[""];
    if (rootEntry && typeof rootEntry === "object") {
      for (const field of [
        rootEntry.dependencies,
        rootEntry.devDependencies,
        rootEntry.optionalDependencies,
        rootEntry.peerDependencies,
      ]) {
        if (field && typeof field === "object") {
          for (const key of Object.keys(field)) {
            directNames.add(key);
          }
        }
      }
    }

    for (const [lockKey, entry] of Object.entries(packages)) {
      if (lockKey === "" || !entry || typeof entry !== "object") continue;
      const pkgName =
        extractNpmPackageNameFromKey(lockKey) ??
        (typeof entry.name === "string" ? entry.name : null);
      const version =
        typeof entry.version === "string" ? entry.version.trim() : "";
      if (!pkgName || !version) continue;

      const isTopLevel = !lockKey.includes("node_modules/", "node_modules/".length);
      const direct = isTopLevel && directNames.has(pkgName);
      const existing = deps.get(pkgName);
      if (
        !existing ||
        (isTopLevel && !existing.direct) ||
        (!existing.direct && !isTopLevel && compareSemver(version, existing.version) > 0)
      ) {
        deps.set(pkgName, {
          name: pkgName,
          version,
          direct,
          sourceFile,
        });
      }
    }
    return deps;
  }

  // Lockfile v1 fallback
  if (parsed.dependencies && typeof parsed.dependencies === "object") {
    for (const [name, info] of Object.entries(parsed.dependencies)) {
      if (!info || typeof info !== "object") continue;
      const version = typeof info.version === "string" ? info.version.trim() : "";
      if (!version) continue;
      deps.set(name, {
        name,
        version,
        direct: true,
        sourceFile,
      });
    }
  }

  return deps;
}

export function diffNpmDeps(
  baseDeps: Map<string, ParsedNpmDep>,
  headDeps: Map<string, ParsedNpmDep>,
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

    const sourceFile = head?.sourceFile ?? base?.sourceFile ?? "package-lock.json";
    const direct = head?.direct ?? base?.direct ?? false;
    const isScoped = name.startsWith("@") && name.includes("/");
    const [scope, pkg] = isScoped ? name.split("/") : [undefined, name];

    deltas.push({
      id: `npm:${name}`,
      ecosystem: "npm",
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
