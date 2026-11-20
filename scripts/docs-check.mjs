#!/usr/bin/env node
/**
 * Minimum-Viable Docs Generator & Verifier (STE-33 / Epic 8)
 *
 * Enforces "generated or decision-only" documentation hygiene:
 *   1. Extracts `on.workflow_call.inputs` from `.github/workflows/reusable-*.yml`
 *      and syncs/verifies auto-generated input tables in `docs/ci-reusable-workflows.md`.
 *   2. Invokes `.github/scripts/discover_projects.py --all` and syncs/verifies
 *      the auto-generated discovered-projects table in `docs/ci-reusable-workflows.md`.
 *   3. Verifies internal Markdown file links across `docs/`.
 *
 * Usage:
 *   node scripts/docs-check.mjs --check   (CI gate; exits 1 on drift or broken links)
 *   node scripts/docs-check.mjs --sync    (updates generated blocks in place)
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

function unquoteYamlScalar(raw) {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isSimpleIdentifier(value) {
  if (!value) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    const isAlphaNum =
      (ch >= 48 && ch <= 57) ||
      (ch >= 65 && ch <= 90) ||
      (ch >= 97 && ch <= 122) ||
      ch === 45 ||
      ch === 95;
    if (!isAlphaNum) {
      return false;
    }
  }
  return true;
}

/**
 * Parses `on.workflow_call.inputs` from a GitHub Actions reusable workflow YAML file.
 */
export function parseWorkflowCallInputs(yamlContent) {
  const lines = yamlContent.split(/\r?\n/);
  let inWorkflowCall = false;
  let inInputs = false;
  let inputsIndent = -1;
  let currentInputName = null;
  let currentInputIndent = -1;
  const inputs = [];
  const byName = new Map();

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const indent = rawLine.length - rawLine.trimStart().length;

    if (trimmed === "workflow_call:" || trimmed.startsWith("workflow_call:")) {
      inWorkflowCall = true;
      inInputs = false;
      continue;
    }

    if (inWorkflowCall && indent === 0 && !trimmed.startsWith("on:")) {
      inWorkflowCall = false;
      inInputs = false;
      currentInputName = null;
    }

    if (!inWorkflowCall) {
      continue;
    }

    if (trimmed === "inputs:" || trimmed.startsWith("inputs:")) {
      inInputs = true;
      inputsIndent = indent;
      currentInputName = null;
      continue;
    }

    if (inInputs) {
      if (indent <= inputsIndent) {
        inInputs = false;
        currentInputName = null;
        continue;
      }

      if (currentInputIndent === -1 || indent === currentInputIndent) {
        if (trimmed.endsWith(":")) {
          const candidateKey = trimmed.slice(0, -1).trim();
          if (isSimpleIdentifier(candidateKey)) {
            currentInputIndent = indent;
            currentInputName = candidateKey;
            const record = {
              name: currentInputName,
              type: "string",
              required: false,
              default: undefined,
              description: "",
            };
            inputs.push(record);
            byName.set(currentInputName, record);
            continue;
          }
        }
      }

      if (currentInputName && indent > currentInputIndent) {
        const colonIdx = trimmed.indexOf(":");
        if (colonIdx > 0) {
          const propKey = trimmed.slice(0, colonIdx).trim();
          const propValRaw = trimmed.slice(colonIdx + 1);
          const record = byName.get(currentInputName);
          const val = unquoteYamlScalar(propValRaw);
          if (propKey === "type") {
            record.type = val || "string";
          } else if (propKey === "required") {
            record.required = val === "true";
          } else if (propKey === "default") {
            record.default = val;
          } else if (propKey === "description") {
            record.description = val;
          }
        }
      }
    }
  }

  return inputs;
}

function escapeMarkdownCell(text) {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

export function renderWorkflowInputsTable(inputs) {
  const lines = [
    "| Input | Type | Default | Description |",
    "| :--- | :--- | :--- | :--- |",
  ];
  for (const inp of inputs) {
    let defaultCell;
    if (inp.required && inp.default === undefined) {
      defaultCell = "*(required)*";
    } else if (inp.default === "" || inp.default === undefined) {
      defaultCell = '`""`';
    } else {
      defaultCell = `\`${escapeMarkdownCell(inp.default)}\``;
    }
    const desc = escapeMarkdownCell(inp.description);
    lines.push(
      `| \`${inp.name}\` | \`${escapeMarkdownCell(inp.type)}\` | ${defaultCell} | ${desc} |`,
    );
  }
  return lines.join("\n");
}

export function parseDiscoverProjectsOutput(rawOutput) {
  const rows = [];
  for (const rawLine of rawOutput.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("workflow ")) {
      continue;
    }
    const parts = line.split(/\s+/);
    if (parts.length < 2) {
      continue;
    }
    const workflow = parts[0];
    const projectPath = parts[1];
    const details = parts.slice(2).join(" ").trim();
    rows.push({
      workflow,
      path: projectPath,
      details,
    });
  }
  return rows;
}

export function renderDiscoveredProjectsTable(rows) {
  const lines = [
    "| Workflow | Project Path | Detected Stack & Gate Details |",
    "| :--- | :--- | :--- |",
  ];
  for (const row of rows) {
    const details =
      row.details ||
      (row.workflow === "(excluded)"
        ? "*(excluded via `.github/ci-projects.json`)*"
        : "");
    lines.push(
      `| \`${escapeMarkdownCell(row.workflow)}\` | \`${escapeMarkdownCell(row.path)}\` | ${escapeMarkdownCell(details)} |`,
    );
  }
  return lines.join("\n");
}

export function replaceGeneratedBlock(content, markerName, generatedBody) {
  const beginTag = `<!-- BEGIN AUTO-GENERATED:${markerName} -->`;
  const endTag = `<!-- END AUTO-GENERATED:${markerName} -->`;
  const beginIdx = content.indexOf(beginTag);
  const endIdx = content.indexOf(endTag);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    throw new Error(
      `Missing or malformed auto-generated marker block: ${beginTag} ... ${endTag}`,
    );
  }
  const before = content.slice(0, beginIdx + beginTag.length);
  const after = content.slice(endIdx);
  return `${before}\n${generatedBody}\n${after}`;
}

function walkMarkdownFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results.sort();
}

/**
 * Checks internal Markdown links across `docs/`.
 * Verifies every link targeting a `.md` document (and all relative links in core governance docs).
 */
export function checkDocsMarkdownLinks(rootDir) {
  const docsDir = path.join(rootDir, "docs");
  const mdFiles = walkMarkdownFiles(docsDir);
  const brokenLinks = [];
  let checkedCount = 0;

  const strictRelativeDirs = new Set([
    docsDir,
    path.join(docsDir, "adr"),
    path.join(docsDir, "rfcs"),
    path.join(docsDir, "software-factory"),
  ]);

  for (const file of mdFiles) {
    const raw = fs.readFileSync(file, "utf8");
    const stripped = raw
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`\n]+`/g, "");
    const linkRegex = /!?\[[^\]]*\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(stripped)) !== null) {
      const rawTarget = match[1].trim().split(/\s+/)[0];
      if (
        !rawTarget ||
        rawTarget.startsWith("http://") ||
        rawTarget.startsWith("https://") ||
        rawTarget.startsWith("mailto:") ||
        rawTarget.startsWith("#")
      ) {
        continue;
      }
      const cleanPath = rawTarget.split("#")[0].split("?")[0];
      if (!cleanPath) {
        continue;
      }

      if (cleanPath.startsWith("file://")) {
        checkedCount += 1;
        brokenLinks.push({
          file: path.relative(rootDir, file).split("\\").join("/"),
          target: rawTarget,
          reason: "Hardcoded file:// URI is not portable across machines or CI.",
        });
        continue;
      }

      const isMarkdownTarget = cleanPath.endsWith(".md");
      const isInStrictDir = strictRelativeDirs.has(path.dirname(file));
      if (!isMarkdownTarget && !isInStrictDir) {
        continue;
      }

      checkedCount += 1;
      const resolved = path.resolve(path.dirname(file), cleanPath);
      try {
        fs.accessSync(resolved, fs.constants.R_OK);
      } catch {
        brokenLinks.push({
          file: path.relative(rootDir, file).split("\\").join("/"),
          target: rawTarget,
          reason: `Target does not exist: ${path.relative(rootDir, resolved).split("\\").join("/")}`,
        });
      }
    }
  }

  return {
    checkedFiles: mdFiles.length,
    checkedLinks: checkedCount,
    brokenLinks,
  };
}

export function runDocsCheck(options = {}) {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const mode = options.mode ?? "check";
  const docPath = path.join(rootDir, "docs", "ci-reusable-workflows.md");

  let originalDoc;
  try {
    originalDoc = fs.readFileSync(docPath, "utf8");
  } catch {
    throw new Error(`Missing required documentation file: ${docPath}`);
  }
  let nextDoc = originalDoc;

  // 1. Sync reusable workflow input tables for workflows marked in docs/ci-reusable-workflows.md
  const inputMarkerRegex =
    /<!-- BEGIN AUTO-GENERATED:inputs:([A-Za-z0-9_.-]+\.yml) -->/g;
  const workflowFiles = [];
  let markerMatch;
  while ((markerMatch = inputMarkerRegex.exec(originalDoc)) !== null) {
    workflowFiles.push(markerMatch[1]);
  }

  for (const wfFile of workflowFiles) {
    const wfPath = path.join(rootDir, ".github", "workflows", wfFile);
    let yamlContent;
    try {
      yamlContent = fs.readFileSync(wfPath, "utf8");
    } catch {
      throw new Error(`Referenced reusable workflow not found: ${wfPath}`);
    }
    const inputs = parseWorkflowCallInputs(yamlContent);
    const table = renderWorkflowInputsTable(inputs);
    nextDoc = replaceGeneratedBlock(nextDoc, `inputs:${wfFile}`, table);
  }

  // 2. Sync discovered projects table from .github/scripts/discover_projects.py
  if (originalDoc.includes("<!-- BEGIN AUTO-GENERATED:discovered-projects -->")) {
    let discoverStdout = options.discoverProjectsOutput;
    if (discoverStdout === undefined) {
      const discoverScript = path.join(
        rootDir,
        ".github",
        "scripts",
        "discover_projects.py",
      );
      const res = spawnSync("python3", ["-I", discoverScript, "--all"], {
        cwd: rootDir,
        encoding: "utf8",
      });
      if (res.status !== 0) {
        throw new Error(
          `discover_projects.py failed (exit ${res.status}): ${res.stderr || res.stdout}`,
        );
      }
      discoverStdout = res.stdout;
    }
    const rows = parseDiscoverProjectsOutput(discoverStdout);
    const table = renderDiscoveredProjectsTable(rows);
    nextDoc = replaceGeneratedBlock(nextDoc, "discovered-projects", table);
  }

  const drifted = nextDoc !== originalDoc;
  if (mode === "sync" && drifted) {
    fs.writeFileSync(docPath, nextDoc, "utf8");
  }

  // 3. Check internal Markdown links across docs/
  const linkReport = checkDocsMarkdownLinks(rootDir);
  const passed =
    (mode === "sync" ? true : !drifted) && linkReport.brokenLinks.length === 0;

  return {
    mode,
    passed,
    drifted,
    synced: mode === "sync" && drifted,
    workflowsChecked: workflowFiles,
    checkedFiles: linkReport.checkedFiles,
    checkedLinks: linkReport.checkedLinks,
    brokenLinks: linkReport.brokenLinks,
  };
}

function readFlagValue(args, flag) {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith(`${flag}=`)) {
      return args[i].slice(flag.length + 1);
    }
    if (args[i] === flag && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return undefined;
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(path.resolve(process.argv[1])) ===
    fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  const args = process.argv.slice(2);
  const mode =
    args.includes("--sync") || args.includes("--write") ? "sync" : "check";
  const rootDir = readFlagValue(args, "--root") ?? process.cwd();
  const json = args.includes("--json");

  try {
    const result = runDocsCheck({ rootDir, mode });
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (result.synced) {
        console.log(
          "Updated auto-generated tables in docs/ci-reusable-workflows.md.",
        );
      }
      if (result.drifted && mode === "check") {
        console.error(
          "FAIL: docs/ci-reusable-workflows.md is out of sync with .github/workflows/reusable-*.yml or discover_projects.py.",
        );
        console.error("Run `pnpm docs:sync` to regenerate the tables.");
      }
      if (result.brokenLinks.length > 0) {
        console.error(
          `FAIL: Found ${result.brokenLinks.length} broken internal Markdown link(s) in docs/:`,
        );
        for (const b of result.brokenLinks) {
          console.error(`  - ${b.file} -> ${b.target} (${b.reason})`);
        }
      }
      if (result.passed) {
        console.log(
          `PASS: Minimum-Viable Docs verified (${result.workflowsChecked.length} reusable workflows, ${result.checkedFiles} Markdown files, ${result.checkedLinks} internal links).`,
        );
      }
    }
    process.exitCode = result.passed ? 0 : 1;
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exitCode = 1;
  }
}
