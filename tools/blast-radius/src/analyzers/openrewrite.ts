import * as fs from "node:fs";
import * as path from "node:path";
import type { OpenRewriteDiffFile, OpenRewriteSummary } from "../types.js";
import { getGitDiffText, isIgnoredRepoPath, type ResolvedRefs } from "../utils/git.js";

/**
 * Parses unified diff text (from OpenRewrite `--openrewrite-diff` or git diff) into structured summaries.
 */
export function parseUnifiedDiff(
  diffText: string,
  source: "file" | "git_diff",
  diffPath?: string,
): OpenRewriteSummary {
  if (!diffText.trim()) {
    return {
      source: source === "file" ? "file" : "none",
      diffPath,
      filesChanged: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      files: [],
      summaryLines: [],
    };
  }

  const files: OpenRewriteDiffFile[] = [];
  let current: OpenRewriteDiffFile | null = null;
  const excerptLines: string[] = [];

  const flushCurrent = (): void => {
    if (!current) return;
    if (isIgnoredRepoPath(current.filePath)) {
      current = null;
      return;
    }
    if (excerptLines.length > 0) {
      current.excerpt = excerptLines.slice(0, 8).join("\n");
    }
    current.recipesOrChanges = Array.from(new Set(current.recipesOrChanges));
    files.push(current);
    current = null;
    excerptLines.length = 0;
  };

  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      flushCurrent();
      const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
      const filePath = match?.[2] ?? match?.[1] ?? "unknown";
      current = {
        filePath,
        status: "modified",
        additions: 0,
        deletions: 0,
        recipesOrChanges: [],
      };
      continue;
    }

    // Handle unified diffs without `diff --git` header (e.g., `--- a/foo` / `+++ b/foo`)
    if (!current && line.startsWith("--- ")) {
      const rawOld = line.slice(4).trim().replace(/^a\//, "");
      current = {
        filePath: rawOld === "/dev/null" ? "new-file" : rawOld,
        status: rawOld === "/dev/null" ? "added" : "modified",
        additions: 0,
        deletions: 0,
        recipesOrChanges: [],
      };
      continue;
    }

    if (!current) continue;

    if (line.startsWith("new file mode")) {
      current.status = "added";
    } else if (line.startsWith("deleted file mode")) {
      current.status = "deleted";
    } else if (line.startsWith("rename to ")) {
      current.status = "renamed";
      current.filePath = line.slice("rename to ".length).trim();
    } else if (line.startsWith("+++ ")) {
      const target = line.slice(4).trim().replace(/^b\//, "");
      if (target === "/dev/null") {
        current.status = "deleted";
      } else if (target) {
        current.filePath = target;
      }
    } else if (line.startsWith("--- /dev/null")) {
      current.status = "added";
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      current.additions += 1;
      const body = line.slice(1).trim();
      if (body && excerptLines.length < 8) {
        excerptLines.push(line);
      }
      if (body.startsWith("import ")) {
        current.recipesOrChanges.push(`Updated import: ${body.replace(/;$/, "")}`);
      } else if (body.startsWith("@") && !current.filePath.endsWith(".gradle.kts")) {
        current.recipesOrChanges.push(`Updated annotation: ${body}`);
      } else if (body.includes("org.openrewrite.java.") || body.includes("ng update")) {
        current.recipesOrChanges.push("OpenRewrite / framework migration recipe");
      }
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      current.deletions += 1;
      const body = line.slice(1).trim();
      if (body && excerptLines.length < 8) {
        excerptLines.push(line);
      }
      if (body.startsWith("import ")) {
        current.recipesOrChanges.push(`Removed import: ${body.replace(/;$/, "")}`);
      }
    }
  }
  flushCurrent();

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
  const summaryLines = files.map(
    (f) =>
      `${f.filePath} (${f.status}, +${f.additions}/-${f.deletions})${f.recipesOrChanges.length > 0 ? `: ${f.recipesOrChanges.slice(0, 2).join("; ")}` : ""}`,
  );

  return {
    source: files.length > 0 ? source : source === "file" ? "file" : "none",
    diffPath,
    filesChanged: files.length,
    totalAdditions,
    totalDeletions,
    files,
    summaryLines,
  };
}

export function loadOpenRewriteSummary(
  repoRoot: string,
  refs: ResolvedRefs,
  openRewriteDiffFile: string | undefined,
  warnings: string[],
): OpenRewriteSummary {
  if (openRewriteDiffFile) {
    const resolved = path.isAbsolute(openRewriteDiffFile)
      ? openRewriteDiffFile
      : path.resolve(repoRoot, openRewriteDiffFile);
    try {
      const raw = fs.readFileSync(resolved, "utf8");
      return parseUnifiedDiff(raw, "file", openRewriteDiffFile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(
        `Could not read OpenRewrite diff "${openRewriteDiffFile}": ${msg}`,
      );
      return {
        source: "none",
        diffPath: openRewriteDiffFile,
        filesChanged: 0,
        totalAdditions: 0,
        totalDeletions: 0,
        files: [],
        summaryLines: [],
      };
    }
  }

  const gitDiff = getGitDiffText(repoRoot, refs, [
    "*.java",
    "*.kt",
    "*.kts",
    "*.ts",
    "pom.xml",
    "build.gradle.kts",
    "libs.versions.toml",
  ]);
  if (!gitDiff.trim()) {
    return {
      source: "none",
      filesChanged: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      files: [],
      summaryLines: [],
    };
  }
  return parseUnifiedDiff(gitDiff, "git_diff");
}
