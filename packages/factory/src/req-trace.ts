import * as fs from "node:fs";
import * as path from "node:path";

export interface RequirementTraceabilityResult {
  passed: boolean;
  totalRequirements: number;
  coveredRequirements: number;
  uncovered: string[];
  details: string;
}

const REQ_ID_PATTERN = /\bREQ-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g;

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".turbo",
  ".claude",
  "build",
  ".gradle",
  ".build",
]);

const CODE_AND_TEST_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
  ".kt",
  ".kts",
  ".java",
  ".swift",
  ".py",
  ".go",
  ".rs",
  ".spec",
  ".feature",
]);

function extractReqIds(text: string): string[] {
  const matches = text.match(REQ_ID_PATTERN);
  return matches ?? [];
}

function walkFiles(
  dir: string,
  filterFn: (filePath: string) => boolean,
  collected: string[] = [],
): string[] {
  if (!fs.existsSync(dir)) {
    return collected;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        walkFiles(path.join(dir, entry.name), filterFn, collected);
      }
    } else if (entry.isFile()) {
      const fullPath = path.join(dir, entry.name);
      if (filterFn(fullPath)) {
        collected.push(fullPath);
      }
    }
  }
  return collected;
}

function listSubdirs(parentDir: string): string[] {
  if (!fs.existsSync(parentDir)) {
    return [];
  }
  return fs
    .readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => path.join(parentDir, entry.name));
}

function collectDeclaredRequirements(rootDir: string): Set<string> {
  const declared = new Set<string>();
  const specFiles: string[] = [];

  const experimentsDir = path.join(rootDir, "docs", "experiments");
  walkFiles(
    experimentsDir,
    (filePath) => filePath.endsWith(".md") || filePath.endsWith(".mdx"),
    specFiles,
  );

  for (const appDir of listSubdirs(path.join(rootDir, "apps"))) {
    const readmePath = path.join(appDir, "README.md");
    if (fs.existsSync(readmePath)) {
      specFiles.push(readmePath);
    }
  }

  for (const filePath of specFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    for (const id of extractReqIds(content)) {
      declared.add(id);
    }
  }

  return declared;
}

function collectReferencedRequirements(rootDir: string): Set<string> {
  const referenced = new Set<string>();
  const targetDirs: string[] = [];

  for (const appDir of listSubdirs(path.join(rootDir, "apps"))) {
    for (const sub of ["src", "Tests", "e2e"]) {
      const candidate = path.join(appDir, sub);
      if (fs.existsSync(candidate)) {
        targetDirs.push(candidate);
      }
    }
    for (const nestedDir of listSubdirs(appDir)) {
      for (const sub of ["src", "Tests", "e2e"]) {
        const candidate = path.join(nestedDir, sub);
        if (fs.existsSync(candidate)) {
          targetDirs.push(candidate);
        }
      }
    }
  }

  for (const pkgDir of listSubdirs(path.join(rootDir, "packages"))) {
    const candidate = path.join(pkgDir, "src");
    if (fs.existsSync(candidate)) {
      targetDirs.push(candidate);
    }
  }

  const isCodeOrTestFile = (filePath: string): boolean =>
    CODE_AND_TEST_EXTENSIONS.has(path.extname(filePath).toLowerCase());

  for (const dir of targetDirs) {
    const files = walkFiles(dir, isCodeOrTestFile);
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf8");
      for (const id of extractReqIds(content)) {
        referenced.add(id);
      }
    }
  }

  return referenced;
}

/**
 * Audits requirement-to-code traceability by comparing declared REQ-* IDs in
 * docs/experiments/ and apps/STAR/README.md against REQ-* references in
 * apps/STAR/src, apps/STAR/Tests, packages/STAR/src, and apps/STAR/e2e.
 */
export function auditRequirementTraceability(
  rootDir: string,
): RequirementTraceabilityResult {
  const declared = collectDeclaredRequirements(rootDir);
  if (declared.size === 0) {
    return {
      passed: true,
      totalRequirements: 0,
      coveredRequirements: 0,
      uncovered: [],
      details:
        "0 requirements tracked (no REQ-* IDs declared in docs/experiments/ or apps/*/README.md).",
    };
  }

  const referenced = collectReferencedRequirements(rootDir);
  const uncovered = [...declared]
    .filter((id) => !referenced.has(id))
    .sort();
  const totalRequirements = declared.size;
  const coveredRequirements = totalRequirements - uncovered.length;
  const passed = uncovered.length === 0;

  return {
    passed,
    totalRequirements,
    coveredRequirements,
    uncovered,
    details: passed
      ? `All ${totalRequirements} requirement(s) covered by test/code references.`
      : `Uncovered requirement(s) (${uncovered.length}/${totalRequirements}): ${uncovered.join(", ")}`,
  };
}
