import assert from "node:assert/strict";
import test from "node:test";
import { runCli } from "./cli.js";
import {
  evaluateBlastRadiusBudget,
  evaluateScopeLock,
  formatCodemodReportMarkdown,
  HARD_MAX_CODEMOD_ATTEMPTS,
  runBoundedCodemodLoop,
  type CodemodExecutor,
} from "./codemod-loop.js";

test("evaluateScopeLock enforces exact package/slice prefixes and rejects traversal", () => {
  const res = evaluateScopeLock(
    [
      "packages/utils/src/index.ts",
      "packages/utils/package.json",
      "packages/utils-extra/src/index.ts",
      "apps/web/src/index.ts",
    ],
    ["packages/utils/"],
  );

  assert.equal(res.passed, false);
  assert.deepEqual(res.allowedFiles, [
    "packages/utils/src/index.ts",
    "packages/utils/package.json",
  ]);
  assert.deepEqual(res.outOfScopeFiles, [
    "packages/utils-extra/src/index.ts",
    "apps/web/src/index.ts",
  ]);

  const clean = evaluateScopeLock(
    ["packages/utils/src/index.ts", "apps/web/src/slices/auth/engine.ts"],
    ["packages/utils", "apps/web/src/slices/auth"],
  );
  assert.equal(clean.passed, true);
  assert.equal(clean.outOfScopeFiles.length, 0);
});

test("evaluateBlastRadiusBudget enforces tier and touched-file budgets", () => {
  const high = evaluateBlastRadiusBudget({
    exitCode: 0,
    touchedFilesCount: 4,
    maxTouchedFiles: 10,
  });
  assert.equal(high.passed, true);
  assert.equal(high.tier, "HIGH_CONFIDENCE");

  const moderateBlocked = evaluateBlastRadiusBudget({
    exitCode: 10,
    allowModerate: false,
    touchedFilesCount: 4,
  });
  assert.equal(moderateBlocked.passed, false);
  assert.equal(moderateBlocked.tier, "MODERATE");

  const moderateAllowed = evaluateBlastRadiusBudget({
    exitCode: 10,
    allowModerate: true,
    touchedFilesCount: 4,
  });
  assert.equal(moderateAllowed.passed, true);
  assert.equal(moderateAllowed.tier, "MODERATE");

  const critical = evaluateBlastRadiusBudget({
    exitCode: 20,
    allowModerate: true,
    touchedFilesCount: 2,
  });
  assert.equal(critical.passed, false);
  assert.equal(critical.tier, "CRITICAL_PATH");

  const overFileBudget = evaluateBlastRadiusBudget({
    exitCode: 0,
    touchedFilesCount: 30,
    maxTouchedFiles: 25,
  });
  assert.equal(overFileBudget.passed, false);
  assert.match(overFileBudget.reason, /exceeded codemod budget/);
});

test("runBoundedCodemodLoop recovers on attempt 2 using compiler feedback without rollback", () => {
  let currentFiles = ["packages/utils/src/index.ts"];
  let checkCalls = 0;
  let rollbackCalls = 0;
  const feedbacks: string[] = [];

  const executor: CodemodExecutor = {
    getChangedFiles: () => currentFiles,
    getUntrackedFiles: () => [],
    runCheckGate: () => {
      checkCalls += 1;
      if (checkCalls === 1) {
        return { exitCode: 1, output: "TS2322: Type string is not number" };
      }
      return { exitCode: 0, output: "All checks passed" };
    },
    runBlastRadiusGate: () => ({ exitCode: 0, output: "HIGH_CONFIDENCE" }),
    rollbackChanges: () => {
      rollbackCalls += 1;
    },
  };

  const result = runBoundedCodemodLoop({
    scopes: ["packages/utils"],
    maxAttempts: 3,
    proposeEdits: ({ previousFeedback }) => {
      feedbacks.push(previousFeedback);
      currentFiles = ["packages/utils/src/index.ts"];
    },
    executor,
  });

  assert.equal(result.passed, true);
  assert.equal(result.status, "passed");
  assert.equal(result.rolledBack, false);
  assert.equal(result.attemptsUsed, 2);
  assert.equal(rollbackCalls, 0);
  assert.equal(feedbacks[0], "");
  assert.match(feedbacks[1] ?? "", /TS2322/);
});

test("runBoundedCodemodLoop enforces hard cap of 3 attempts and auto-rolls back on scope or gate failure", () => {
  let workingFiles = ["packages/utils/src/index.ts", "apps/pulse/backend/Foo.java"];
  let rolledBackTracked: string[] = [];
  let rolledBackUntracked: string[] = [];

  const executor: CodemodExecutor = {
    getChangedFiles: () => workingFiles,
    getUntrackedFiles: () => ["apps/pulse/backend/Foo.java"],
    runCheckGate: () => ({ exitCode: 0, output: "ok" }),
    runBlastRadiusGate: () => ({ exitCode: 0, output: "ok" }),
    rollbackChanges: (_root, tracked, untracked) => {
      rolledBackTracked = tracked;
      rolledBackUntracked = untracked;
      workingFiles = [];
    },
  };

  const result = runBoundedCodemodLoop({
    scopes: ["packages/utils"],
    maxAttempts: 10, // should be clamped to HARD_MAX_CODEMOD_ATTEMPTS (3)
    proposeEdits: () => {
      // Continues touching out-of-scope file
    },
    executor,
  });

  assert.equal(result.maxAttempts, HARD_MAX_CODEMOD_ATTEMPTS);
  assert.equal(result.attemptsUsed, 3);
  assert.equal(result.passed, false);
  assert.equal(result.status, "rolled_back_for_human_review");
  assert.equal(result.rolledBack, true);
  assert.deepEqual(rolledBackTracked, ["packages/utils/src/index.ts"]);
  assert.deepEqual(rolledBackUntracked, ["apps/pulse/backend/Foo.java"]);
  assert.match(result.blockerSummary ?? "", /Scope lock violation/);

  const md = formatCodemodReportMarkdown(result);
  assert.match(md, /ROLLED BACK FOR HUMAN REVIEW/);
  assert.match(md, /Scope lock violation/);
});

test("runCli codemod:loop requires --scope", () => {
  const code = runCli(["codemod:loop"]);
  assert.equal(code, 1);
});
