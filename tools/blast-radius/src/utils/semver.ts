import type { VersionBumpKind } from "../types.js";

/**
 * Strips leading npm/Gradle/Maven range operators and whitespace from a version string.
 */
export function cleanVersion(version: string | null | undefined): string | null {
  if (!version) return null;
  const trimmed = version.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return null;
  // Strip range prefixes like ^, ~, >=, <=, =, v
  const stripped = trimmed.replace(/^(?:\^|~|>=|<=|>|<|=|v(?=\d))+/, "").trim();
  return stripped || trimmed;
}

export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Extracts leading numeric major.minor.patch segments from common JVM / JS version strings.
 */
export function parseSemverParts(version: string): SemverParts | null {
  const cleaned = cleanVersion(version);
  if (!cleaned) return null;
  // Handle workspace:/link:/file: protocols cleanly as non-numeric
  if (/^(?:workspace|link|file|git|https?):/i.test(cleaned)) {
    return null;
  }
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(cleaned);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: match[2] !== undefined ? Number(match[2]) : 0,
    patch: match[3] !== undefined ? Number(match[3]) : 0,
  };
}

/**
 * Classifies a dependency version change deterministically.
 */
export function classifyVersionBump(
  fromVersion: string | null,
  toVersion: string | null,
): VersionBumpKind {
  const fromClean = cleanVersion(fromVersion);
  const toClean = cleanVersion(toVersion);

  if (!fromClean && toClean) return "added";
  if (fromClean && !toClean) return "removed";
  if (!fromClean && !toClean) return "unchanged";
  if (fromClean === toClean || fromVersion?.trim() === toVersion?.trim()) {
    return "unchanged";
  }

  const fromParts = parseSemverParts(fromClean!);
  const toParts = parseSemverParts(toClean!);
  if (!fromParts || !toParts) {
    return "updated";
  }

  if (toParts.major !== fromParts.major) return "major";
  if (toParts.minor !== fromParts.minor) return "minor";
  if (toParts.patch !== fromParts.patch) return "patch";
  return "updated";
}

/**
 * Compares two version strings numerically (>0 if a > b, <0 if a < b, 0 if equal/incomparable).
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemverParts(a);
  const pb = parseSemverParts(b);
  if (!pa || !pb) return a.localeCompare(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  return 0;
}
