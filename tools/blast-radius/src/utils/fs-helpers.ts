import * as fs from "node:fs";
import * as path from "node:path";
import { isIgnoredRepoPath, toPosixPath } from "./git.js";

const IGNORED_DIRS = new Set([
  ".git",
  ".gradle",
  ".idea",
  ".turbo",
  ".next",
  "node_modules",
  "dist",
  "build",
  "target",
  "out-tsc",
  "coverage",
]);

/**
 * Recursively finds files matching a predicate while skipping build outputs and apps/backstage.
 */
export function findRepoFiles(
  rootDir: string,
  predicate: (relPosixPath: string, fileName: string) => boolean,
): string[] {
  const results: string[] = [];

  function walk(absDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absPath = path.join(absDir, entry.name);
      const relPosix = toPosixPath(path.relative(rootDir, absPath));
      if (isIgnoredRepoPath(relPosix)) {
        continue;
      }
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        walk(absPath);
      } else if (entry.isFile()) {
        if (predicate(relPosix, entry.name)) {
          results.push(relPosix);
        }
      }
    }
  }

  walk(rootDir);
  return results.sort();
}

export function readFileSafe(absPath: string): string | null {
  try {
    return fs.readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
}

export function safeJsonParse<T>(
  raw: string,
  label: string,
  warnings: string[],
): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`Malformed JSON in ${label}: ${msg}`);
    return null;
  }
}
