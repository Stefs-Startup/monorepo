import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  REQUIRED_AGENT_READY_SECTIONS,
  validateAgentReadySpec,
  type SpecValidationError,
} from "./agent-ready-spec.js";
import { runSpecValidateCli } from "./agent-ready-spec-cli.js";

const VALID_SPEC = `# STE-40: Affected-only CI

## Context

.github/scripts/discover_projects.py, .github/workflows/ci.yml, turbo.json, and scripts/check.sh.

## Constraints

- Always run full matrix on pushes to main and in merge queues.
- Keep apps/pulse Gradle isolation intact.

## Acceptance criteria

- [ ] \`python3 .github/scripts/discover_projects.py --changed-files docs/README.md\` returns zero Gradle jobs.
- [ ] Unit tests for path filtering pass under \`CI=true\` with exit code 0.

## Out of scope

- Changing \`apps/ytm-menubar\` (PARKED).
`;

test("validateAgentReadySpec accepts a complete 4-section Linear spec with verifiable criteria", () => {
  const result = validateAgentReadySpec(VALID_SPEC);
  assert.equal(result.passed, true);
  assert.deepEqual(result.sectionsPresent, [...REQUIRED_AGENT_READY_SECTIONS]);
  assert.deepEqual(result.missingSections, []);
  assert.deepEqual(result.errors, []);
  // Linear specs use STE-* instead of REQ-*; missing REQ-* must not leak as a warning
  assert.equal(
    result.criticWarnings.some((w) => w.message.includes("REQ-*")),
    false,
  );
});

test("validateAgentReadySpec flags missing, empty, and placeholder-only sections", () => {
  const missingResult = validateAgentReadySpec(`
## Context
Relevant files: packages/factory/src/index.ts

## Acceptance criteria
- [ ] \`npm test\` passes with exit code 0.
`);
  assert.equal(missingResult.passed, false);
  assert.deepEqual(missingResult.missingSections, ["Constraints", "Out of scope"]);
  assert.ok(
    missingResult.errors.some(
      (e: SpecValidationError) =>
        e.code === "missing_section" && e.section === "Constraints",
    ),
  );

  const placeholderResult = validateAgentReadySpec(`
## Context
<!-- Fill in relevant files -->
TBD

## Constraints
TODO

## Acceptance criteria
- [ ] \`npm test\` exits 0.

## Out of scope
N/A
`);
  assert.equal(placeholderResult.passed, false);
  assert.deepEqual(
    placeholderResult.errors
      .filter((e: SpecValidationError) => e.code === "placeholder_or_empty_section")
      .map((e: SpecValidationError) => e.section),
    ["Context", "Constraints", "Out of scope"],
  );
});

test("validateAgentReadySpec rejects acceptance criteria without concrete verifiable checks", () => {
  const vagueCriteriaSpec = `
## Context
apps/web/src/index.ts

## Constraints
Keep strict TypeScript enabled.

## Acceptance criteria
- [ ] Make the dashboard much nicer and cleaner for everyone.

## Out of scope
Backend database changes.
`;

  const result = validateAgentReadySpec(vagueCriteriaSpec);
  assert.equal(result.passed, false);
  assert.ok(
    result.errors.some(
      (e: SpecValidationError) => e.code === "unverifiable_acceptance_criteria",
    ),
  );
});

test("validateAgentReadySpec escalates plan-critic conflicts and surfaces qualitative/edge warnings", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-spec-critic-"));
  try {
    fs.mkdirSync(path.join(tmpDir, ".github"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".github", "ci-projects.json"),
      JSON.stringify({ exclude: ["apps/ytm-menubar"] }),
      "utf8",
    );

    const conflictSpec = `
## Context
apps/web/src/index.ts and login session auth flow.

## Constraints
Use git push --no-verify with LEFTHOOK=0 so commits stay fast.

## Acceptance criteria
- [ ] \`pnpm test\` exits 0.

## Out of scope
Mobile layouts.
`;

    const result = validateAgentReadySpec(conflictSpec, tmpDir);
    assert.equal(result.passed, false);
    assert.ok(
      result.errors.some(
        (e: SpecValidationError) => e.code === "plan_critic_conflict",
      ),
    );
    assert.ok(
      result.criticWarnings.some((w) => w.category === "underspecified_inputs"),
    );
    assert.ok(
      result.criticWarnings.some((w) => w.category === "missing_edge_cases"),
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("validateAgentReadySpec ignores headings inside code fences and accepts file paths", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-spec-file-"));
  try {
    const filePath = path.join(tmpDir, "spec.md");
    fs.writeFileSync(
      filePath,
      `${VALID_SPEC}\n\`\`\`markdown\n## Ignored Heading\n\`\`\`\n`,
      "utf8",
    );
    const result = validateAgentReadySpec("spec.md", tmpDir);
    assert.equal(result.passed, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("runSpecValidateCli validates files in text and json modes and handles errors", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-spec-cli-"));
  try {
    const validPath = path.join(tmpDir, "valid.md");
    const invalidPath = path.join(tmpDir, "invalid.md");
    fs.writeFileSync(validPath, VALID_SPEC, "utf8");
    fs.writeFileSync(invalidPath, "## Context\nOnly context.\n", "utf8");

    assert.equal(runSpecValidateCli([]), 0);
    assert.equal(runSpecValidateCli(["--help"]), 0);
    assert.equal(runSpecValidateCli(["--", "valid.md", "--root", tmpDir]), 0);
    assert.equal(runSpecValidateCli([validPath, "--json", `--root=${tmpDir}`]), 0);
    assert.equal(runSpecValidateCli([invalidPath]), 1);
    assert.equal(runSpecValidateCli([invalidPath, "--json"]), 1);
    assert.equal(runSpecValidateCli([path.join(tmpDir, "missing.md")]), 1);
    assert.equal(runSpecValidateCli(["--json"]), 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
