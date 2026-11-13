import { spawnSync } from "node:child_process";
import * as path from "node:path";

export interface GitCommandResult {
  ok: boolean;
  status: number;
  stdout: string;
  stderr: string;
}

export interface ResolvedRefs {
  baseRef: string;
  headRef: string;
  baseAvailable: boolean;
  headIsWorkingTree: boolean;
  warnings: string[];
}

const IGNORED_PATH_PREFIXES = [
  "apps/backstage/",
  ".git/",
  ".gradle/",
  "node_modules/",
  "dist/",
  "build/",
  "out-tsc/",
];

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function isIgnoredRepoPath(relPath: string): boolean {
  const posix = toPosixPath(relPath).replace(/^\.\//, "");
  if (posix === "apps/backstage" || posix.startsWith("apps/backstage/")) {
    return true;
  }
  return IGNORED_PATH_PREFIXES.some(
    (prefix) => posix.startsWith(prefix) || posix.includes(`/${prefix}`),
  );
}

export function runGit(repoRoot: string, args: string[]): GitCommandResult {
  const res = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 25 * 1024 * 1024,
  });
  return {
    ok: !res.error && res.status === 0,
    status: res.status ?? (res.error ? 1 : 0),
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? (res.error ? res.error.message : ""),
  };
}

export function gitRefExists(repoRoot: string, ref: string): boolean {
  if (!ref || ref.trim() === "") return false;
  const res = runGit(repoRoot, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  return res.ok;
}

export function isGitRepo(repoRoot: string): boolean {
  const res = runGit(repoRoot, ["rev-parse", "--is-inside-work-tree"]);
  return res.ok && res.stdout.trim() === "true";
}

/**
 * Resolves base and head refs cleanly, warning rather than crashing when a ref is missing.
 */
export function resolveBaseAndHead(
  repoRoot: string,
  requestedBase?: string,
  requestedHead?: string,
): ResolvedRefs {
  const warnings: string[] = [];
  const headRef = requestedHead?.trim() || "WORKING_TREE";
  const headIsWorkingTree = headRef === "WORKING_TREE";

  if (!isGitRepo(repoRoot)) {
    const fallbackBase = requestedBase?.trim() || "main";
    warnings.push(
      `Directory "${repoRoot}" is not a git repository; git diff base "${fallbackBase}" unavailable (using fixture/local files only).`,
    );
    return {
      baseRef: fallbackBase,
      headRef,
      baseAvailable: false,
      headIsWorkingTree,
      warnings,
    };
  }

  let baseRef = requestedBase?.trim();
  let baseAvailable = false;

  if (baseRef) {
    baseAvailable = gitRefExists(repoRoot, baseRef);
    if (!baseAvailable) {
      warnings.push(
        `Base ref "${baseRef}" was not found in git history; treating git base state as unavailable.`,
      );
    }
  } else {
    if (gitRefExists(repoRoot, "main")) {
      baseRef = "main";
      baseAvailable = true;
    } else if (gitRefExists(repoRoot, "origin/main")) {
      baseRef = "origin/main";
      baseAvailable = true;
    } else if (gitRefExists(repoRoot, "HEAD")) {
      baseRef = "HEAD";
      baseAvailable = true;
      warnings.push(
        `Neither "main" nor "origin/main" was found; falling back to "HEAD".`,
      );
    } else {
      baseRef = "main";
      baseAvailable = false;
      warnings.push(
        `No commits or base ref ("main" / "origin/main") found in repository.`,
      );
    }
  }

  if (!headIsWorkingTree && !gitRefExists(repoRoot, headRef)) {
    warnings.push(
      `Head ref "${headRef}" was not found in git history; falling back to working tree.`,
    );
    return {
      baseRef,
      headRef: "WORKING_TREE",
      baseAvailable,
      headIsWorkingTree: true,
      warnings,
    };
  }

  return {
    baseRef,
    headRef,
    baseAvailable,
    headIsWorkingTree,
    warnings,
  };
}

/**
 * Reads a file's contents at a specific git ref, or returns null if missing.
 */
export function gitShowFile(
  repoRoot: string,
  ref: string,
  relPath: string,
): string | null {
  const posixRel = toPosixPath(relPath).replace(/^\.\//, "");
  const res = runGit(repoRoot, ["show", `${ref}:${posixRel}`]);
  return res.ok ? res.stdout : null;
}

/**
 * Lists files changed between baseRef and headRef (or working tree).
 */
export function listChangedFiles(
  repoRoot: string,
  refs: ResolvedRefs,
): string[] {
  const changed = new Set<string>();

  if (refs.baseAvailable) {
    const diffArgs = refs.headIsWorkingTree
      ? ["diff", "--name-only", refs.baseRef]
      : ["diff", "--name-only", refs.baseRef, refs.headRef];
    const diffRes = runGit(repoRoot, diffArgs);
    if (diffRes.ok) {
      for (const line of diffRes.stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !isIgnoredRepoPath(trimmed)) {
          changed.add(toPosixPath(trimmed));
        }
      }
    }
  }

  if (refs.headIsWorkingTree && isGitRepo(repoRoot)) {
    const statusRes = runGit(repoRoot, ["status", "--porcelain"]);
    if (statusRes.ok) {
      for (const line of statusRes.stdout.split(/\r?\n/)) {
        if (!line || line.length < 4) continue;
        // Porcelain v1: XY <path> or XY <old> -> <new>
        const rawPath = line.slice(3).trim();
        const filePath = rawPath.includes(" -> ")
          ? rawPath.split(" -> ").pop()!.trim()
          : rawPath;
        const unquoted = filePath.replace(/^"|"$/g, "");
        if (unquoted && !isIgnoredRepoPath(unquoted)) {
          changed.add(toPosixPath(unquoted));
        }
      }
    }
  }

  return Array.from(changed).sort();
}

/**
 * Computes git unified diff text for OpenRewrite / migration summary fallback.
 */
export function getGitDiffText(
  repoRoot: string,
  refs: ResolvedRefs,
  pathFilters?: string[],
): string {
  if (!refs.baseAvailable) return "";
  const args = refs.headIsWorkingTree
    ? ["diff", "--unified=3", refs.baseRef]
    : ["diff", "--unified=3", refs.baseRef, refs.headRef];
  if (pathFilters && pathFilters.length > 0) {
    args.push("--", ...pathFilters);
  }
  const res = runGit(repoRoot, args);
  return res.ok ? res.stdout : "";
}
