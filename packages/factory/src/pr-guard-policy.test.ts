import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  AGENT_PR_GUARD_MARKER,
  classifyPullRequest,
  evaluatePullRequestGuard,
  evaluateStaleAgentPrs,
  extractLinearIssueKeys,
  formatGuardComment,
  GUARD_EXEMPT_LABEL,
  isValidLinearAgentBranch,
  type PullRequestSnapshot,
} from "./pr-guard-policy.js";
import { runPrGuardCli } from "./pr-guard-cli.js";
import {
  runGitHubPrGuard,
  toPullRequestSnapshot,
  type GitHubGuardClient,
} from "./pr-guard-github.js";

function makePr(overrides: Partial<PullRequestSnapshot> = {}): PullRequestSnapshot {
  return {
    number: 200,
    title: "feat(ci): STE-52 enforce PR guard",
    body: "Implements STE-52.",
    headRef: "sheldoncrosss/ste-52-dispatch-dedupe",
    authorLogin: "sheldoncross",
    authorIsBot: false,
    labels: [],
    commitsCoAuthors: [],
    createdAt: "2026-11-18T12:00:00Z",
    updatedAt: "2026-11-20T10:00:00Z",
    draft: false,
    ...overrides,
  };
}

test("classifyPullRequest identifies dependency bots, coding agents, and humans", () => {
  assert.equal(
    classifyPullRequest(makePr({ authorLogin: "dependabot[bot]", authorIsBot: true, headRef: "dependabot/npm/vitest-4" })),
    "dependency-bot",
  );
  assert.equal(
    classifyPullRequest(makePr({ authorLogin: "app/dependabot", authorIsBot: true })),
    "dependency-bot",
  );
  assert.equal(
    classifyPullRequest(makePr({ authorLogin: "renovate[bot]", authorIsBot: true })),
    "dependency-bot",
  );
  assert.equal(
    classifyPullRequest(makePr({ authorLogin: "app/renovate", authorIsBot: true })),
    "dependency-bot",
  );

  // Non-dependency bot accounts
  assert.equal(
    classifyPullRequest(makePr({ authorLogin: "claude[bot]", authorIsBot: true })),
    "coding-agent",
  );
  assert.equal(
    classifyPullRequest(makePr({ authorLogin: "copilot[bot]", authorIsBot: true })),
    "coding-agent",
  );
  assert.equal(
    classifyPullRequest(makePr({ authorLogin: "custom-automation", authorIsBot: true })),
    "coding-agent",
  );

  // Explicit agent labels
  for (const label of ["agent", "agent-pr", "automated-agent"]) {
    assert.equal(
      classifyPullRequest(makePr({ labels: [label] })),
      "coding-agent",
      `Expected label ${label} to classify as coding-agent`,
    );
  }

  // Co-authored-by / body attribution markers
  assert.equal(
    classifyPullRequest(
      makePr({
        commitsCoAuthors: ["Copilot <175728472+Copilot@users.noreply.github.com>"],
      }),
    ),
    "human",
  );
  assert.equal(
    classifyPullRequest(
      makePr({
        body: "Automated PR\n\nCo-authored-by: Copilot <copilot@github.com>",
      }),
    ),
    "coding-agent",
  );
  assert.equal(
    classifyPullRequest(
      makePr({
        body: "Automated PR\n\nCo-authored-by: Claude <noreply@anthropic.com>",
      }),
    ),
    "coding-agent",
  );
  assert.equal(
    classifyPullRequest(
      makePr({
        body: "Generated with Claude Code",
      }),
    ),
    "coding-agent",
  );

  // Human PR
  assert.equal(
    classifyPullRequest(makePr()),
    "human",
  );
});

test("extractLinearIssueKeys normalizes uppercase unique keys without partial matches", () => {
  const keys = extractLinearIssueKeys({
    headRef: "sheldoncrosss/ste-52-dispatch-dedupe",
    title: "feat(ci): STE-52 and cmp-18 guardrails (ste-52)",
    body: "Related to STE-51, CMP-18, NOTSTE-99, STE-520abc, STE-00.",
  });
  assert.deepEqual(keys, ["STE-52", "CMP-18", "STE-51", "STE-00"]);

  assert.deepEqual(
    extractLinearIssueKeys({
      headRef: "docs/update-readme",
      title: "docs: fix typo",
      body: "No issue reference here.",
    }),
    [],
  );
});

test("isValidLinearAgentBranch accepts Linear branches and rejects non-Linear branches", () => {
  assert.equal(isValidLinearAgentBranch("sheldoncrosss/ste-52-dispatch-dedupe"), true);
  assert.equal(isValidLinearAgentBranch("ste-52-fix"), true);
  assert.equal(isValidLinearAgentBranch("STE-101/implement-guard"), true);

  assert.equal(isValidLinearAgentBranch(""), false);
  assert.equal(isValidLinearAgentBranch("feat/something-without-issue"), false);
  assert.equal(isValidLinearAgentBranch("agent/random-cleanup"), false);
});

test("evaluatePullRequestGuard allows dependency bots and excludes them from agent cap", () => {
  const agentPrs = [1, 2, 3, 4, 5].map((n) =>
    makePr({
      number: n,
      headRef: `sheldoncrosss/ste-${50 + n}-work`,
      title: `feat: STE-${50 + n}`,
      body: `Implements STE-${50 + n}.`,
      labels: ["agent-pr"],
      createdAt: `2026-11-1${n}T10:00:00Z`,
    }),
  );
  const dependabotPr = makePr({
    number: 114,
    authorLogin: "app/dependabot",
    authorIsBot: true,
    headRef: "dependabot/github_actions/github-actions-6f3f52970f",
    title: "chore(ci)(deps): bump github-actions",
    body: "Bumps actions.",
  });

  const decision = evaluatePullRequestGuard(dependabotPr, [...agentPrs, dependabotPr]);
  assert.equal(decision.category, "dependency-bot");
  assert.equal(decision.shouldFail, false);
  assert.equal(decision.shouldClose, false);
  assert.equal(decision.commentBody, null);
  assert.deepEqual(decision.violations, []);
});

test("evaluatePullRequestGuard allows valid coding-agent PR within cap and unique issue", () => {
  const validAgentPr = makePr({
    number: 120,
    authorLogin: "claude[bot]",
    authorIsBot: true,
    headRef: "sheldoncrosss/ste-52-dispatch-dedupe",
    title: "feat(ci): STE-52 PR guard",
  });

  const decision = evaluatePullRequestGuard(validAgentPr, [validAgentPr]);
  assert.equal(decision.category, "coding-agent");
  assert.equal(decision.shouldFail, false);
  assert.equal(decision.shouldClose, false);
  assert.equal(decision.commentBody, null);
  assert.deepEqual(decision.issueKeys, ["STE-52"]);
});

test("evaluatePullRequestGuard enforces 1-PR-per-issue dedupe with canonical lowest PR number", () => {
  const canonical = makePr({
    number: 118,
    headRef: "sheldoncrosss/ste-52-dispatch-dedupe",
    title: "feat: STE-52 initial PR",
  });
  const duplicateAgent = makePr({
    number: 121,
    authorLogin: "claude[bot]",
    authorIsBot: true,
    headRef: "sheldoncrosss/ste-52-retry",
    title: "feat: STE-52 duplicate agent PR",
  });
  const duplicateHuman = makePr({
    number: 122,
    authorLogin: "sheldoncross",
    authorIsBot: false,
    headRef: "sheldoncrosss/ste-52-manual",
    title: "feat: STE-52 duplicate human PR",
  });

  // Canonical PR itself passes
  const canonicalDecision = evaluatePullRequestGuard(canonical, [canonical, duplicateAgent]);
  assert.equal(canonicalDecision.shouldFail, false);
  assert.equal(canonicalDecision.shouldClose, false);

  // Coding-agent duplicate fails and auto-closes
  const agentDecision = evaluatePullRequestGuard(duplicateAgent, [canonical, duplicateAgent]);
  assert.equal(agentDecision.shouldFail, true);
  assert.equal(agentDecision.shouldClose, true);
  assert.equal(agentDecision.violations[0]?.code, "duplicate_issue_pr");
  assert.equal(agentDecision.violations[0]?.canonicalPrNumber, 118);
  assert.ok(agentDecision.commentBody?.includes(AGENT_PR_GUARD_MARKER));
  assert.ok(agentDecision.commentBody?.includes("#118"));

  // Human duplicate fails check and comments, but does NOT auto-close
  const humanDecision = evaluatePullRequestGuard(duplicateHuman, [canonical, duplicateHuman]);
  assert.equal(humanDecision.category, "human");
  assert.equal(humanDecision.shouldFail, true);
  assert.equal(humanDecision.shouldClose, false);
  assert.equal(humanDecision.violations[0]?.code, "duplicate_issue_pr");
  assert.ok(humanDecision.commentBody?.includes("#118"));
});

test("evaluatePullRequestGuard rejects coding-agent PRs missing Linear issue or with invalid branch", () => {
  const missingIssuePr = makePr({
    number: 130,
    authorLogin: "claude[bot]",
    authorIsBot: true,
    headRef: "feat/unlinked-cleanup",
    title: "chore: cleanup without issue",
    body: "No Linear issue referenced.",
  });
  const missingDecision = evaluatePullRequestGuard(missingIssuePr, [missingIssuePr]);
  assert.equal(missingDecision.shouldFail, true);
  assert.equal(missingDecision.shouldClose, true);
  assert.deepEqual(
    missingDecision.violations.map((v) => v.code).sort(),
    ["invalid_agent_branch", "missing_linear_issue"],
  );

  const badBranchPr = makePr({
    number: 131,
    authorLogin: "sheldoncross",
    labels: ["agent-pr"],
    headRef: "agent/ad-hoc-branch",
    title: "feat: STE-52 with non-Linear branch",
    body: "Refers to STE-52.",
  });
  const badBranchDecision = evaluatePullRequestGuard(badBranchPr, [badBranchPr]);
  assert.equal(badBranchDecision.shouldFail, true);
  assert.equal(badBranchDecision.shouldClose, true);
  assert.deepEqual(badBranchDecision.violations.map((v) => v.code), ["invalid_agent_branch"]);
});

test("evaluatePullRequestGuard enforces 5 concurrent coding-agent PR cap and guard-exempt bypass", () => {
  const activeFive = [10, 20, 30, 40, 50].map((num, idx) =>
    makePr({
      number: num,
      authorLogin: "claude[bot]",
      authorIsBot: true,
      headRef: `sheldoncrosss/ste-${70 + idx}-task`,
      title: `feat: STE-${70 + idx}`,
      body: `Implements STE-${70 + idx}.`,
      createdAt: `2026-11-1${idx + 1}T10:00:00Z`,
    }),
  );

  // Re-evaluating the 5th active PR passes
  const fifthDecision = evaluatePullRequestGuard(activeFive[4]!, activeFive);
  assert.equal(fifthDecision.shouldFail, false);
  assert.equal(fifthDecision.shouldClose, false);

  // 6th coding-agent PR exceeds cap of 5
  const sixthPr = makePr({
    number: 60,
    authorLogin: "claude[bot]",
    authorIsBot: true,
    headRef: "sheldoncrosss/ste-80-excess",
    title: "feat: STE-80 sixth PR",
    body: "Implements STE-80.",
    createdAt: "2026-11-19T10:00:00Z",
  });
  const sixthDecision = evaluatePullRequestGuard(sixthPr, [...activeFive, sixthPr]);
  assert.equal(sixthDecision.shouldFail, true);
  assert.equal(sixthDecision.shouldClose, true);
  assert.equal(sixthDecision.violations[0]?.code, "agent_pr_cap_exceeded");
  assert.deepEqual(sixthDecision.violations[0]?.activeAgentPrNumbers, [10, 20, 30, 40, 50]);
  assert.ok(sixthDecision.commentBody?.includes("#10"));
  assert.ok(sixthDecision.commentBody?.includes("#50"));

  // guard-exempt PR bypasses violations and does not consume one of the 5 slots
  const exemptPr = makePr({
    number: 55,
    authorLogin: "claude[bot]",
    authorIsBot: true,
    headRef: "hotfix/manual-override",
    title: "chore: manual override",
    body: "Exempted by maintainer",
    labels: [GUARD_EXEMPT_LABEL],
  });
  const exemptDecision = evaluatePullRequestGuard(exemptPr, [...activeFive, exemptPr]);
  assert.equal(exemptDecision.exempt, true);
  assert.equal(exemptDecision.shouldFail, false);
  assert.equal(exemptDecision.shouldClose, false);
  assert.equal(exemptDecision.commentBody, null);

  // A 5th normal PR still fits when exemptPr is present
  const fifthNormalWithExempt = evaluatePullRequestGuard(activeFive[4]!, [
    ...activeFive,
    exemptPr,
  ]);
  assert.equal(fifthNormalWithExempt.shouldFail, false);
});

test("evaluateStaleAgentPrs closes >= 7.0d coding-agent PRs and skips <7d, humans, dependabot, and exempt", () => {
  const nowIso = "2026-11-20T12:00:00Z";
  const openPrs: PullRequestSnapshot[] = [
    // 6.9 days old coding-agent -> keep
    makePr({
      number: 301,
      authorLogin: "claude[bot]",
      authorIsBot: true,
      updatedAt: "2026-11-13T14:24:00Z",
    }),
    // Exactly 7.0 days old coding-agent -> close
    makePr({
      number: 302,
      authorLogin: "claude[bot]",
      authorIsBot: true,
      updatedAt: "2026-11-13T12:00:00Z",
    }),
    // 10 days old agent-labeled PR -> close
    makePr({
      number: 303,
      labels: ["agent-pr"],
      headRef: "sheldoncrosss/ste-52-stale-agent",
      updatedAt: "2026-11-10T12:00:00Z",
    }),
    // 30 days old dependency-bot -> skip
    makePr({
      number: 304,
      authorLogin: "dependabot[bot]",
      authorIsBot: true,
      updatedAt: "2026-10-21T12:00:00Z",
    }),
    // 30 days old human -> skip
    makePr({
      number: 305,
      authorLogin: "sheldoncross",
      updatedAt: "2026-10-21T12:00:00Z",
    }),
    // 30 days old guard-exempt coding-agent -> skip
    makePr({
      number: 306,
      authorLogin: "claude[bot]",
      authorIsBot: true,
      labels: [GUARD_EXEMPT_LABEL],
      updatedAt: "2026-10-21T12:00:00Z",
    }),
  ];

  const result = evaluateStaleAgentPrs(openPrs, nowIso);
  assert.deepEqual(result.stalePrNumbers, [302, 303]);
  assert.deepEqual(result.skippedExemptPrNumbers, [306]);
  assert.equal(result.stalePrs[0]?.commentBody.includes(AGENT_PR_GUARD_MARKER), true);
  assert.equal(result.stalePrs[0]?.ageDays, 7);

  assert.throws(() => evaluateStaleAgentPrs(openPrs, "not-a-date"), /Invalid/);
});

test("formatGuardComment renders marker, violations, and auto-close notice", () => {
  const comment = formatGuardComment({
    prNumber: 99,
    category: "coding-agent",
    issueKeys: ["STE-52"],
    shouldClose: true,
    violations: [
      {
        code: "duplicate_issue_pr",
        message: "Linear issue STE-52 already has an open canonical PR #55.",
        issueKey: "STE-52",
        canonicalPrNumber: 55,
      },
    ],
  });
  assert.ok(comment.startsWith(AGENT_PR_GUARD_MARKER));
  assert.ok(comment.includes("#55"));
  assert.ok(comment.includes("closed automatically"));
});

test("runPrGuardCli executes --mode=pr and --mode=stale against JSON snapshots", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-pr-guard-cli-"));
  try {
    const snapshotPath = path.join(tmpDir, "prs.json");
    const openPrs: PullRequestSnapshot[] = [
      makePr({
        number: 10,
        headRef: "sheldoncrosss/ste-52-canonical",
        updatedAt: "2026-11-19T12:00:00Z",
      }),
      makePr({
        number: 11,
        authorLogin: "claude[bot]",
        authorIsBot: true,
        headRef: "sheldoncrosss/ste-52-dup",
        updatedAt: "2026-11-10T12:00:00Z",
      }),
    ];
    fs.writeFileSync(snapshotPath, JSON.stringify({ openPrs }), "utf8");

    // Help and empty args return 0
    assert.equal(runPrGuardCli([]), 0);
    assert.equal(runPrGuardCli(["--help"]), 0);

    // Without --fail-on-violation returns 0
    assert.equal(
      runPrGuardCli(["--mode=pr", `--input=${snapshotPath}`, "--pr=11"]),
      0,
    );
    // Space-separated flags work and clean PR returns 0 even with --fail-on-violation
    assert.equal(
      runPrGuardCli([
        "--mode",
        "pr",
        "--input",
        snapshotPath,
        "--pr",
        "10",
        "--max-open",
        "5",
        "--fail-on-violation",
      ]),
      0,
    );
    // With --fail-on-violation returns 1 because PR #11 duplicates PR #10
    assert.equal(
      runPrGuardCli(["--mode=pr", `--input=${snapshotPath}`, "--pr=11", "--fail-on-violation"]),
      1,
    );
    // Stale mode returns 0
    assert.equal(
      runPrGuardCli(["--mode=stale", `--input=${snapshotPath}`, "--now=2026-11-20T12:00:00Z", "--stale-days=7"]),
      0,
    );

    // Array-root JSON + targetPr in envelope
    const arraySnapshotPath = path.join(tmpDir, "prs-array.json");
    fs.writeFileSync(arraySnapshotPath, JSON.stringify(openPrs), "utf8");
    assert.equal(
      runPrGuardCli(["--mode=stale", `--input=${arraySnapshotPath}`]),
      0,
    );
    const targetEnvelopePath = path.join(tmpDir, "prs-target.json");
    fs.writeFileSync(
      targetEnvelopePath,
      JSON.stringify({ targetPr: openPrs[0], openPrs }),
      "utf8",
    );
    assert.equal(runPrGuardCli(["--mode=pr", `--input=${targetEnvelopePath}`]), 0);

    // Error branches return 1
    assert.equal(runPrGuardCli(["--mode=pr"]), 1);
    assert.equal(runPrGuardCli(["--mode=pr", `--input=${snapshotPath}`]), 1);
    assert.equal(runPrGuardCli(["--mode=pr", `--input=${snapshotPath}`, "--pr=999"]), 1);
    assert.equal(runPrGuardCli(["--mode=pr", `--input=${snapshotPath}`, "--pr=10", "--max-open=0"]), 1);
    assert.equal(runPrGuardCli(["--mode=pr", `--input=${path.join(tmpDir, "missing.json")}`, "--pr=10"]), 1);
    assert.equal(runPrGuardCli(["--mode=unknown", `--input=${snapshotPath}`]), 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

function makeMockClient(): {
  client: GitHubGuardClient;
  comments: Array<{ prNumber: number; marker: string; body: string }>;
  closed: number[];
  logs: string[];
} {
  const comments: Array<{ prNumber: number; marker: string; body: string }> = [];
  const closed: number[] = [];
  const logs: string[] = [];
  const client: GitHubGuardClient = {
    async upsertStickyComment(prNumber: number, marker: string, body: string): Promise<void> {
      comments.push({ prNumber, marker, body });
    },
    async closePullRequest(prNumber: number): Promise<void> {
      closed.push(prNumber);
    },
    log(message: string): void {
      logs.push(message);
    },
  };
  return { client, comments, closed, logs };
}

test("toPullRequestSnapshot converts GitHub REST payloads into PullRequestSnapshot", () => {
  const snap = toPullRequestSnapshot({
    number: 114,
    title: "chore(ci)(deps): bump github-actions",
    body: null,
    head: { ref: "dependabot/github_actions/6f3f52" },
    user: { login: "app/dependabot", type: "Bot" },
    labels: [{ name: "dependencies" }, "ci"],
    created_at: "2026-11-16T14:23:44Z",
    updated_at: "2026-11-16T14:23:44Z",
    draft: false,
  });

  assert.equal(snap.number, 114);
  assert.equal(snap.body, "");
  assert.equal(snap.headRef, "dependabot/github_actions/6f3f52");
  assert.equal(snap.authorLogin, "app/dependabot");
  assert.equal(snap.authorIsBot, true);
  assert.deepEqual(snap.labels, ["dependencies", "ci"]);

  const fallbackUser = toPullRequestSnapshot({
    number: 115,
    title: "feat: STE-52 fallback",
    head: { ref: "sheldoncrosss/ste-52-test" },
    user: null,
    updated_at: "2026-11-20T10:00:00Z",
  });
  assert.equal(fallbackUser.authorLogin, "unknown");
  assert.equal(fallbackUser.authorIsBot, false);
  assert.deepEqual(fallbackUser.labels, []);
});

test("runGitHubPrGuard handles pr mode across coding-agent duplicates, human duplicates, exempt, and dry-run", async () => {
  const canonical = makePr({
    number: 50,
    headRef: "sheldoncrosss/ste-52-main",
    title: "feat: STE-52 canonical",
    body: "Implements STE-52",
  });
  const dupAgent = makePr({
    number: 51,
    authorLogin: "claude[bot]",
    authorIsBot: true,
    headRef: "sheldoncrosss/ste-52-agent-dup",
    title: "feat: STE-52 agent dup",
    body: "Implements STE-52",
  });
  const dupHuman = makePr({
    number: 52,
    authorLogin: "sheldoncross",
    authorIsBot: false,
    headRef: "sheldoncrosss/ste-52-human-dup",
    title: "feat: STE-52 human dup",
    body: "Implements STE-52",
  });

  // Coding-agent duplicate comments + closes + fails
  const agentMock = makeMockClient();
  const agentRes = await runGitHubPrGuard({
    mode: "pr",
    openPrs: [canonical, dupAgent],
    targetPrNumber: 51,
    dryRun: false,
    client: agentMock.client,
  });
  assert.equal(agentRes.failed, true);
  assert.deepEqual(agentRes.commentedPrNumbers, [51]);
  assert.deepEqual(agentRes.closedPrNumbers, [51]);
  assert.equal(agentMock.comments[0]?.marker, AGENT_PR_GUARD_MARKER);
  assert.ok(agentMock.comments[0]?.body.includes("#50"));

  // Dry-run records failure decision without commenting or closing
  const dryMock = makeMockClient();
  const dryRes = await runGitHubPrGuard({
    mode: "pr",
    openPrs: [canonical, dupAgent],
    targetPrNumber: 51,
    dryRun: true,
    client: dryMock.client,
  });
  assert.equal(dryRes.dryRun, true);
  assert.equal(dryRes.failed, true);
  assert.equal(dryRes.prDecision?.shouldClose, true);
  assert.deepEqual(dryMock.comments, []);
  assert.deepEqual(dryMock.closed, []);
  assert.ok(dryMock.logs.some((line) => line.includes("DRY-RUN")));

  // Human duplicate comments + fails without closing
  const humanMock = makeMockClient();
  const humanRes = await runGitHubPrGuard({
    mode: "pr",
    openPrs: [canonical, dupHuman],
    targetPrNumber: 52,
    client: humanMock.client,
  });
  assert.equal(humanRes.failed, true);
  assert.deepEqual(humanRes.commentedPrNumbers, [52]);
  assert.deepEqual(humanRes.closedPrNumbers, []);

  // Clean canonical PR performs zero actions
  const cleanMock = makeMockClient();
  const cleanRes = await runGitHubPrGuard({
    mode: "pr",
    openPrs: [canonical],
    targetPrNumber: 50,
    client: cleanMock.client,
  });
  assert.equal(cleanRes.failed, false);
  assert.deepEqual(cleanMock.comments, []);
  assert.deepEqual(cleanMock.closed, []);

  // Missing target PR throws descriptive error
  await assert.rejects(
    () =>
      runGitHubPrGuard({
        mode: "pr",
        openPrs: [canonical],
        targetPrNumber: 999,
        client: cleanMock.client,
      }),
    /PR #999/,
  );
  await assert.rejects(
    () =>
      runGitHubPrGuard({
        mode: "pr",
        openPrs: [canonical],
        client: cleanMock.client,
      }),
    /targetPrNumber/,
  );
});

test("runGitHubPrGuard handles stale mode with live close and dry-run skip", async () => {
  const openPrs: PullRequestSnapshot[] = [
    makePr({
      number: 71,
      authorLogin: "claude[bot]",
      authorIsBot: true,
      updatedAt: "2026-11-10T12:00:00Z",
    }),
    makePr({
      number: 72,
      authorLogin: "dependabot[bot]",
      authorIsBot: true,
      updatedAt: "2026-10-01T12:00:00Z",
    }),
    makePr({
      number: 73,
      authorLogin: "claude[bot]",
      authorIsBot: true,
      labels: [GUARD_EXEMPT_LABEL],
      updatedAt: "2026-10-01T12:00:00Z",
    }),
  ];

  // Dry-run reports stale PRs without calling comment/close
  const dryMock = makeMockClient();
  const dryRes = await runGitHubPrGuard({
    mode: "stale",
    openPrs,
    nowIso: "2026-11-20T12:00:00Z",
    dryRun: true,
    client: dryMock.client,
  });
  assert.equal(dryRes.failed, false);
  assert.deepEqual(dryRes.staleResult?.stalePrNumbers, [71]);
  assert.deepEqual(dryRes.closedPrNumbers, []);
  assert.deepEqual(dryMock.comments, []);
  assert.deepEqual(dryMock.closed, []);

  // Live run comments + closes PR #71
  const liveMock = makeMockClient();
  const liveRes = await runGitHubPrGuard({
    mode: "stale",
    openPrs,
    nowIso: "2026-11-20T12:00:00Z",
    dryRun: false,
    client: liveMock.client,
  });
  assert.equal(liveRes.failed, false);
  assert.deepEqual(liveRes.commentedPrNumbers, [71]);
  assert.deepEqual(liveRes.closedPrNumbers, [71]);
  assert.equal(liveMock.comments[0]?.marker, AGENT_PR_GUARD_MARKER);
});
