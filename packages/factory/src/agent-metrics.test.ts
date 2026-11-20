import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  AGENT_METRICS_MARKER,
  classifyTaskType,
  computePercentile,
  computeVelocityAndAgentMetrics,
  formatWeeklyDigestMarkdown,
  isReworkPullRequest,
  type LinearIssueSnapshot,
  type MetricsPullRequestInput,
  type WorkflowRunSnapshot,
} from "./agent-metrics.js";
import {
  runAgentMetricsCli,
  toMetricsPullRequest,
  toWorkflowRunSnapshot,
} from "./agent-metrics-cli.js";

test("computePercentile handles empty, single, odd, and even collections", () => {
  assert.equal(computePercentile([], 50), null);
  assert.equal(computePercentile([42], 90), 42);
  assert.equal(computePercentile([10, 20, 30, 40, 50], 50), 30);
  assert.equal(computePercentile([10, 20, 30, 40], 90), 37);
  assert.throws(() => computePercentile([1, 2], 120), /Invalid percentile/);
});

test("classifyTaskType maps dependency bots, conventional commits, branches, and fallback", () => {
  assert.equal(
    classifyTaskType({
      title: "chore(deps): bump turbo to 2.11",
      headRef: "dependabot/npm_and_yarn/turbo",
      labels: [],
    }),
    "deps",
  );
  assert.equal(
    classifyTaskType({
      title: "feat(factory): STE-55 add metrics",
      headRef: "agent/ste-55-metrics",
      labels: [],
    }),
    "feat",
  );
  assert.equal(
    classifyTaskType({
      title: "fix!: repair lockfile drift",
      headRef: "sheldoncrosss/ste-99-fix",
      labels: [],
    }),
    "fix",
  );
  assert.equal(
    classifyTaskType({
      title: "perf(core): streamline parser",
      headRef: "misc/speedup",
      labels: [],
    }),
    "refactor",
  );
  assert.equal(
    classifyTaskType({
      title: "Update documentation overview",
      headRef: "docs/update-guide",
      labels: [],
    }),
    "docs",
  );
  assert.equal(
    classifyTaskType({
      title: "Adjust ci workflow trigger",
      headRef: "ci/adjust-trigger",
      labels: [],
    }),
    "ci",
  );
  assert.equal(
    classifyTaskType({
      title: "Misc cleanup without prefix",
      headRef: "random-branch",
      labels: [],
    }),
    "other",
  );
});

test("isReworkPullRequest flags closed-unmerged, changes requested, rework commits, and revert/fixup titles", () => {
  const base: MetricsPullRequestInput = {
    number: 1,
    title: "feat: clean PR",
    state: "closed",
    headRef: "sheldoncrosss/ste-1-clean",
    authorLogin: "claude[bot]",
    authorIsBot: true,
    createdAt: "2026-11-18T10:00:00Z",
    updatedAt: "2026-11-18T12:00:00Z",
    mergedAt: "2026-11-18T12:00:00Z",
  };

  assert.equal(isReworkPullRequest(base), false);
  assert.equal(
    isReworkPullRequest({ ...base, state: "closed", mergedAt: null }),
    true,
  );
  assert.equal(isReworkPullRequest({ ...base, changesRequestedCount: 2 }), true);
  assert.equal(isReworkPullRequest({ ...base, reworkCommitCount: 1 }), true);
  assert.equal(
    isReworkPullRequest({ ...base, title: "revert: undo bad change" }),
    true,
  );
});

test("computeVelocityAndAgentMetrics computes lead time, cycle time, CI percentiles, actor & task readiness", () => {
  const issues: LinearIssueSnapshot[] = [
    { identifier: "STE-70", createdAt: "2026-11-18T00:00:00Z" },
    { identifier: "STE-71", createdAt: "2026-11-18T06:00:00Z" },
    { identifier: "STE-72", createdAt: "2026-11-19T00:00:00Z" },
  ];

  const pullRequests: MetricsPullRequestInput[] = [
    // 3 merged feat agent PRs -> feat should be 'ready' (100% merge, 0% rework)
    {
      number: 10,
      title: "feat(a): STE-70 first",
      state: "closed",
      headRef: "agent/ste-70-first",
      authorLogin: "claude[bot]",
      authorIsBot: true,
      createdAt: "2026-11-18T12:00:00Z",
      updatedAt: "2026-11-18T14:00:00Z",
      mergedAt: "2026-11-18T14:00:00Z", // cycle=2h, lead=14h
    },
    {
      number: 11,
      title: "feat(b): STE-71 second",
      state: "closed",
      headRef: "agent/ste-71-second",
      authorLogin: "claude[bot]",
      authorIsBot: true,
      createdAt: "2026-11-18T10:00:00Z",
      updatedAt: "2026-11-18T14:00:00Z",
      mergedAt: "2026-11-18T14:00:00Z", // cycle=4h, lead=8h
    },
    {
      number: 12,
      title: "feat(c): STE-72 third",
      state: "closed",
      headRef: "agent/ste-72-third",
      authorLogin: "claude[bot]",
      authorIsBot: true,
      createdAt: "2026-11-19T02:00:00Z",
      updatedAt: "2026-11-19T08:00:00Z",
      mergedAt: "2026-11-19T08:00:00Z", // cycle=6h, lead=8h
    },
    // 2 closed unmerged fix agent PRs -> fix should be 'needs-scaffolding'
    {
      number: 13,
      title: "fix(a): failing attempt 1",
      state: "closed",
      headRef: "agent/ste-73-fail-1",
      authorLogin: "copilot[bot]",
      authorIsBot: true,
      createdAt: "2026-11-19T10:00:00Z",
      updatedAt: "2026-11-19T11:00:00Z",
      closedAt: "2026-11-19T11:00:00Z",
      mergedAt: null,
    },
    {
      number: 14,
      title: "fix(b): failing attempt 2",
      state: "closed",
      headRef: "agent/ste-74-fail-2",
      authorLogin: "copilot[bot]",
      authorIsBot: true,
      createdAt: "2026-11-19T12:00:00Z",
      updatedAt: "2026-11-19T13:00:00Z",
      closedAt: "2026-11-19T13:00:00Z",
      mergedAt: null,
    },
    // Human PR + Dependabot PR + old out-of-window PR
    {
      number: 15,
      title: "chore: human polish",
      state: "closed",
      headRef: "sheldoncrosss/polish",
      authorLogin: "sheldoncross",
      authorIsBot: false,
      createdAt: "2026-11-19T00:00:00Z",
      updatedAt: "2026-11-19T10:00:00Z",
      mergedAt: "2026-11-19T10:00:00Z", // cycle=10h
    },
    {
      number: 16,
      title: "chore(deps): bump vitest",
      state: "open",
      headRef: "dependabot/npm/vitest",
      authorLogin: "dependabot[bot]",
      authorIsBot: true,
      createdAt: "2026-11-19T18:00:00Z",
      updatedAt: "2026-11-19T19:00:00Z",
    },
    {
      number: 5,
      title: "feat: stale old PR outside 7d window",
      state: "closed",
      headRef: "sheldoncrosss/ste-1-old",
      authorLogin: "claude[bot]",
      authorIsBot: true,
      createdAt: "2026-11-01T10:00:00Z",
      updatedAt: "2026-11-01T12:00:00Z",
      mergedAt: "2026-11-01T12:00:00Z",
    },
  ];

  const workflowRuns: WorkflowRunSnapshot[] = [
    {
      id: 1,
      name: "Monorepo CI",
      status: "completed",
      conclusion: "success",
      createdAt: "2026-11-19T10:00:00Z",
      runStartedAt: "2026-11-19T10:00:10Z",
      updatedAt: "2026-11-19T10:02:10Z", // 120s
    },
    {
      id: 2,
      name: "Monorepo CI",
      status: "completed",
      conclusion: "failure",
      createdAt: "2026-11-19T11:00:00Z",
      runStartedAt: "2026-11-19T11:00:00Z",
      updatedAt: "2026-11-19T11:12:00Z", // 720s -> triggers >600s p90 recommendation
    },
    {
      id: 3,
      name: "Monorepo CI",
      status: "completed",
      conclusion: "cancelled",
      createdAt: "2026-11-19T12:00:00Z",
      updatedAt: "2026-11-19T12:00:05Z", // ignored in duration/completedRuns
    },
  ];

  const report = computeVelocityAndAgentMetrics({
    repo: "Stefs-Startup/monorepo",
    nowIso: "2026-11-20T12:00:00Z",
    windowDays: 7,
    pullRequests,
    workflowRuns,
    issues,
  });

  assert.equal(report.counts.pullRequestsInWindow, 7);
  assert.equal(report.leadTimeHours.count, 3);
  assert.equal(report.leadTimeHours.p50, 8);
  assert.equal(report.prCycleTimeHours.count, 4);
  assert.equal(report.ciDurationSeconds.completedRuns, 2);
  assert.equal(report.ciDurationSeconds.failedRuns, 1);
  assert.equal(report.ciDurationSeconds.successRate, 0.5);
  assert.equal(report.byActor.codingAgent.total, 5);
  assert.equal(report.byActor.codingAgent.merged, 3);
  assert.equal(report.byActor.codingAgent.closedUnmerged, 2);
  assert.equal(report.byActor.codingAgent.mergeRate, 0.6);
  assert.equal(report.byActor.codingAgent.reworkRate, 0.4);
  assert.equal(report.byActor.human.total, 1);
  assert.equal(report.byActor.dependencyBot.open, 1);

  const featGroup = report.byTaskType.find((g) => g.taskType === "feat");
  const fixGroup = report.byTaskType.find((g) => g.taskType === "fix");
  assert.equal(featGroup?.readiness, "ready");
  assert.equal(fixGroup?.readiness, "needs-scaffolding");
  assert.ok(report.recommendations.some((r) => r.includes("Strengthen context packs")));
  assert.ok(report.recommendations.some((r) => r.includes("Keep dispatching 'feat'")));
  assert.ok(report.recommendations.some((r) => r.includes("p90 CI duration")));

  const md = formatWeeklyDigestMarkdown(report);
  assert.ok(md.startsWith(AGENT_METRICS_MARKER));
  assert.match(md, /Weekly Velocity & Agent Metrics Digest/);
  assert.match(md, /\| `feat` \| 3 \| 3 \| 0 \| 0 \| 100\.0% \| `ready`/);
  assert.match(md, /\| `fix` \| 2 \| 0 \| 2 \| 2 \| 0\.0% \| `needs-scaffolding`/);
});

test("GitHub REST payload mappers and CLI execute cleanly with fixture files", async () => {
  const mappedPr = toMetricsPullRequest({
    number: 99,
    title: "docs: STE-55 update guide",
    state: "closed",
    head: { ref: "sheldoncrosss/ste-55-docs" },
    user: { login: "sheldoncross", type: "User" },
    labels: [{ name: "documentation" }],
    created_at: "2026-11-19T10:00:00Z",
    updated_at: "2026-11-19T11:00:00Z",
    merged_at: "2026-11-19T11:00:00Z",
  });
  assert.equal(mappedPr.authorIsBot, false);
  assert.deepEqual(mappedPr.labels, ["documentation"]);

  const mappedRun = toWorkflowRunSnapshot({
    id: 500,
    name: "Monorepo CI",
    status: "completed",
    conclusion: "success",
    created_at: "2026-11-19T10:00:00Z",
    run_started_at: "2026-11-19T10:00:05Z",
    updated_at: "2026-11-19T10:01:05Z",
    event: "pull_request",
  });
  assert.equal(mappedRun.id, 500);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-agent-metrics-cli-"));
  try {
    const prsFile = path.join(tmpDir, "prs.json");
    const runsFile = path.join(tmpDir, "runs.json");
    const mdOut = path.join(tmpDir, "out", "digest.md");
    const jsonOut = path.join(tmpDir, "out", "report.json");
    fs.writeFileSync(prsFile, JSON.stringify([mappedPr]), "utf8");
    fs.writeFileSync(runsFile, JSON.stringify([mappedRun]), "utf8");

    assert.equal(await runAgentMetricsCli(["--help"]), 0);
    assert.equal(await runAgentMetricsCli([]), 1);
    assert.equal(
      await runAgentMetricsCli(["--prs", prsFile, "--window-days", "-1"]),
      1,
    );
    assert.equal(
      await runAgentMetricsCli([
        "--prs",
        prsFile,
        "--runs",
        runsFile,
        "--now",
        "2026-11-20T12:00:00Z",
        "--window-days",
        "7",
        "--out",
        mdOut,
        "--json-out",
        jsonOut,
        "--json",
      ]),
      0,
    );
    assert.equal(fs.existsSync(mdOut), true);
    assert.equal(fs.existsSync(jsonOut), true);
    const parsedJson = JSON.parse(fs.readFileSync(jsonOut, "utf8")) as {
      byActor: { human: { total: number } };
    };
    assert.equal(parsedJson.byActor.human.total, 1);

    // Live mode with injected fetch covering GitHub REST + Linear GraphQL + issues fixture
    const mockFetch: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/pulls")) {
        return new Response(
          JSON.stringify([
            {
              number: 201,
              title: "feat(ci): STE-55 automated metrics",
              state: "closed",
              head: { ref: "agent/ste-55-metrics" },
              user: { login: "claude[bot]", type: "Bot" },
              labels: ["agent"],
              created_at: "2026-11-19T08:00:00Z",
              updated_at: "2026-11-19T10:00:00Z",
              merged_at: "2026-11-19T10:00:00Z",
            },
          ]),
          { status: 200 },
        );
      }
      if (url.includes("/actions/runs")) {
        return new Response(JSON.stringify({ workflow_runs: [] }), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          data: {
            issues: {
              nodes: [
                {
                  identifier: "STE-55",
                  createdAt: "2026-11-19T06:00:00Z",
                  state: { name: "In Review" },
                  labels: { nodes: [{ name: "agent-ready" }] },
                },
              ],
            },
          },
        }),
        { status: 200 },
      );
    };

    const liveCode = await runAgentMetricsCli(
      ["--live", "--repo=Stefs-Startup/monorepo", "--now=2026-11-20T12:00:00Z"],
      {
        fetchImpl: mockFetch,
        env: { GITHUB_TOKEN: "test-gh-auth", LINEAR_API_KEY: "test-linear-auth" },
      },
    );
    assert.equal(liveCode, 0);

    // Error paths: missing fixture & API HTTP 500
    assert.equal(
      await runAgentMetricsCli(["--prs", path.join(tmpDir, "missing.json")]),
      1,
    );
    assert.equal(
      await runAgentMetricsCli(["--live", "--repo=Stefs-Startup/monorepo"], {
        fetchImpl: async () => new Response("error", { status: 500 }),
        env: { GITHUB_TOKEN: "test-gh-auth" },
      }),
      1,
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
