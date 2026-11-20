import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import {
  parseDiscoverProjectsOutput,
  parseWorkflowCallInputs,
  renderWorkflowInputsTable,
  runDocsCheck,
} from "./docs-check.mjs";

test("parseWorkflowCallInputs extracts types, defaults, and descriptions from reusable workflow YAML", () => {
  const sampleYaml = `
name: Reusable · Sample
on:
  workflow_call:
    inputs:
      working-directory:
        description: Project directory.
        type: string
        default: "."
      pr-number:
        description: "Pull request number"
        type: number
        required: true
      timeout-minutes:
        type: number
        default: 25
jobs:
  build:
    runs-on: ubuntu-latest
`;
  const inputs = parseWorkflowCallInputs(sampleYaml);
  assert.equal(inputs.length, 3);
  assert.deepEqual(inputs[0], {
    name: "working-directory",
    type: "string",
    required: false,
    default: ".",
    description: "Project directory.",
  });
  assert.equal(inputs[1].required, true);
  const table = renderWorkflowInputsTable(inputs);
  assert.match(table, /\| `working-directory` \| `string` \| `\.` \| Project directory\. \|/);
  assert.match(table, /\| `pr-number` \| `number` \| \*\(required\)\* \| Pull request number \|/);
});

test("runDocsCheck detects drift in check mode, repairs in sync mode, and catches broken Markdown links", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-docs-check-"));
  try {
    fs.mkdirSync(path.join(tmpDir, ".github", "workflows"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "docs"), { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, ".github", "workflows", "reusable-node.yml"),
      [
        "name: Reusable Node",
        "on:",
        "  workflow_call:",
        "    inputs:",
        "      working-directory:",
        "        description: Project directory.",
        "        type: string",
        '        default: "."',
      ].join("\n"),
      "utf8",
    );

    fs.writeFileSync(
      path.join(tmpDir, "docs", "ci-reusable-workflows.md"),
      [
        "# CI Reusable Workflows",
        "",
        "See [README](./README.md).",
        "",
        "<!-- BEGIN AUTO-GENERATED:inputs:reusable-node.yml -->",
        "STALE TABLE",
        "<!-- END AUTO-GENERATED:inputs:reusable-node.yml -->",
        "",
        "<!-- BEGIN AUTO-GENERATED:discovered-projects -->",
        "STALE PROJECTS",
        "<!-- END AUTO-GENERATED:discovered-projects -->",
      ].join("\n"),
      "utf8",
    );

    fs.writeFileSync(
      path.join(tmpDir, "docs", "README.md"),
      "# Docs Index\n\nLink to [CI](./ci-reusable-workflows.md).\n",
      "utf8",
    );

    const discoverOutput = [
      "workflow         path                   details",
      "reusable-node    .                      pnpm, Node 20",
    ].join("\n");

    const rows = parseDiscoverProjectsOutput(discoverOutput);
    assert.equal(rows.length, 1);

    // 1. Check mode fails on stale tables
    const driftRes = runDocsCheck({
      rootDir: tmpDir,
      mode: "check",
      discoverProjectsOutput: discoverOutput,
    });
    assert.equal(driftRes.passed, false);
    assert.equal(driftRes.drifted, true);

    // 2. Sync mode updates tables in place and passes
    const syncRes = runDocsCheck({
      rootDir: tmpDir,
      mode: "sync",
      discoverProjectsOutput: discoverOutput,
    });
    assert.equal(syncRes.passed, true);
    assert.equal(syncRes.synced, true);

    // 3. Subsequent check mode passes with zero drift
    const cleanRes = runDocsCheck({
      rootDir: tmpDir,
      mode: "check",
      discoverProjectsOutput: discoverOutput,
    });
    assert.equal(cleanRes.passed, true);
    assert.equal(cleanRes.drifted, false);

    // 4. Broken Markdown link is caught
    fs.writeFileSync(
      path.join(tmpDir, "docs", "README.md"),
      "# Docs Index\n\nBroken [link](./does-not-exist.md).\n",
      "utf8",
    );
    const brokenRes = runDocsCheck({
      rootDir: tmpDir,
      mode: "check",
      discoverProjectsOutput: discoverOutput,
    });
    assert.equal(brokenRes.passed, false);
    assert.equal(brokenRes.brokenLinks.length, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
