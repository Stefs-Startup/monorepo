import {
  classifyPullRequest,
  extractLinearIssueKeys,
  type PrActorCategory,
  type PullRequestSnapshot,
} from "./pr-guard-policy.js";

export const AGENT_METRICS_MARKER = "<!-- cmp-weekly-agent-metrics -->";
export const DEFAULT_METRICS_WINDOW_DAYS = 7;

export type TaskType =
  | "feat"
  | "fix"
  | "ci"
  | "docs"
  | "deps"
  | "refactor"
  | "chore"
  | "other";

export type TaskReadinessVerdict =
  | "ready"
  | "supervised"
  | "needs-scaffolding"
  | "insufficient-data";

export interface MetricsPullRequestInput extends PullRequestSnapshot {
  state: "open" | "closed";
  mergedAt?: string | null;
  closedAt?: string | null;
  changesRequestedCount?: number;
  reworkCommitCount?: number;
  filesChanged?: readonly string[];
}

export interface WorkflowRunSnapshot {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  runStartedAt?: string | null;
  updatedAt: string;
  event?: string;
}

export interface LinearIssueSnapshot {
  identifier: string;
  createdAt: string;
  completedAt?: string | null;
  labels?: readonly string[];
  state?: string;
}

export interface DurationStats {
  count: number;
  p50: number | null;
  p90: number | null;
  mean: number | null;
}

export interface ActorMetricsSummary {
  category: PrActorCategory | "all";
  total: number;
  merged: number;
  closedUnmerged: number;
  open: number;
  mergeRate: number | null;
  reworkCount: number;
  reworkRate: number | null;
}

export interface TaskTypeMetricsSummary {
  taskType: TaskType;
  total: number;
  merged: number;
  closedUnmerged: number;
  open: number;
  failedOrReworked: number;
  mergeRate: number | null;
  reworkRate: number | null;
  readiness: TaskReadinessVerdict;
  sampleIssueKeys: string[];
}

export interface VelocityMetricsInput {
  repo?: string;
  nowIso: string;
  windowDays?: number;
  pullRequests: readonly MetricsPullRequestInput[];
  workflowRuns: readonly WorkflowRunSnapshot[];
  issues?: readonly LinearIssueSnapshot[];
}

export interface VelocityMetricsReport {
  schemaVersion: number;
  repo: string;
  generatedAt: string;
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  counts: {
    pullRequestsInWindow: number;
    workflowRunsInWindow: number;
    linearIssuesLoaded: number;
  };
  leadTimeHours: DurationStats;
  prCycleTimeHours: DurationStats;
  ciDurationSeconds: DurationStats & {
    completedRuns: number;
    failedRuns: number;
    successRate: number | null;
  };
  byActor: {
    codingAgent: ActorMetricsSummary;
    human: ActorMetricsSummary;
    dependencyBot: ActorMetricsSummary;
    all: ActorMetricsSummary;
  };
  byTaskType: TaskTypeMetricsSummary[];
  recommendations: string[];
}

const MS_PER_SECOND = 1000;
const MS_PER_HOUR = MS_PER_SECOND * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;
const CONV_COMMIT_RE =
  /^(feat|fix|ci|docs|refactor|chore|build|perf|test|style)(?:\([^)]+\))?!?:\s+/i;
const REWORK_TITLE_RE = /^(?:revert\b|fixup!|squash!)/i;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Computes a linear-interpolated percentile (0..100) over finite non-negative numbers.
 */
export function computePercentile(
  values: readonly number[],
  percentile: number,
): number | null {
  if (percentile < 0 || percentile > 100 || !Number.isFinite(percentile)) {
    throw new Error(`Invalid percentile: ${percentile}`);
  }
  const clean = values
    .filter((v) => Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b);
  if (clean.length === 0) {
    return null;
  }
  if (clean.length === 1) {
    return round2(clean[0]);
  }
  const rank = (percentile / 100) * (clean.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const weight = rank - low;
  const interpolated = clean[low] * (1 - weight) + clean[high] * weight;
  return round2(interpolated);
}

function summarizeDurations(values: readonly number[]): DurationStats {
  const clean = values.filter((v) => Number.isFinite(v) && v >= 0);
  if (clean.length === 0) {
    return { count: 0, p50: null, p90: null, mean: null };
  }
  const sum = clean.reduce((acc, v) => acc + v, 0);
  return {
    count: clean.length,
    p50: computePercentile(clean, 50),
    p90: computePercentile(clean, 90),
    mean: round2(sum / clean.length),
  };
}

/**
 * Classifies a PR's task type using actor hints, Conventional Commit prefixes, and branch names.
 */
export function classifyTaskType(
  pr: Pick<MetricsPullRequestInput, "title" | "labels" | "headRef">,
): TaskType {
  const headLower = pr.headRef.trim().toLowerCase();
  const titleTrimmed = pr.title.trim();
  const labelsLower = (pr.labels ?? []).map((l) => l.trim().toLowerCase());

  if (
    headLower.startsWith("dependabot/") ||
    headLower.startsWith("renovate/") ||
    labelsLower.includes("dependencies") ||
    /\(deps(?:-dev)?\)/i.test(titleTrimmed)
  ) {
    return "deps";
  }

  const commitMatch = titleTrimmed.match(CONV_COMMIT_RE);
  if (commitMatch?.[1]) {
    const raw = commitMatch[1].toLowerCase();
    if (raw === "feat" || raw === "fix" || raw === "ci" || raw === "docs" || raw === "refactor" || raw === "chore") {
      return raw;
    }
    if (raw === "perf") {
      return "refactor";
    }
    if (raw === "build" || raw === "test" || raw === "style") {
      return "chore";
    }
  }

  if (headLower.includes("/fix-") || headLower.startsWith("fix/") || labelsLower.includes("bug")) {
    return "fix";
  }
  if (headLower.includes("/feat-") || headLower.startsWith("feat/") || labelsLower.includes("feature")) {
    return "feat";
  }
  if (headLower.startsWith("ci/") || labelsLower.includes("ci")) {
    return "ci";
  }
  if (headLower.startsWith("docs/") || labelsLower.includes("documentation")) {
    return "docs";
  }

  return "other";
}

/**
 * Determines whether a PR required rework (closed unmerged, review changes requested,
 * follow-up fixup/revert commits, or revert/fixup title).
 */
export function isReworkPullRequest(pr: MetricsPullRequestInput): boolean {
  const isClosedUnmerged = pr.state === "closed" && !pr.mergedAt;
  if (isClosedUnmerged) {
    return true;
  }
  if ((pr.changesRequestedCount ?? 0) > 0) {
    return true;
  }
  if ((pr.reworkCommitCount ?? 0) > 0) {
    return true;
  }
  return REWORK_TITLE_RE.test(pr.title.trim());
}

function summarizeActorCategory(
  category: PrActorCategory | "all",
  prs: readonly MetricsPullRequestInput[],
): ActorMetricsSummary {
  let merged = 0;
  let closedUnmerged = 0;
  let open = 0;
  let reworkCount = 0;

  for (const pr of prs) {
    if (pr.mergedAt) {
      merged += 1;
    } else if (pr.state === "closed") {
      closedUnmerged += 1;
    } else {
      open += 1;
    }
    if (isReworkPullRequest(pr)) {
      reworkCount += 1;
    }
  }

  const resolved = merged + closedUnmerged;
  const total = prs.length;

  return {
    category,
    total,
    merged,
    closedUnmerged,
    open,
    mergeRate: resolved > 0 ? round3(merged / resolved) : null,
    reworkCount,
    reworkRate: total > 0 ? round3(reworkCount / total) : null,
  };
}

function evaluateReadiness(
  resolved: number,
  mergeRate: number | null,
  reworkRate: number | null,
): TaskReadinessVerdict {
  if (resolved === 0 || mergeRate === null) {
    return "insufficient-data";
  }
  if (mergeRate < 0.5) {
    return "needs-scaffolding";
  }
  if (resolved >= 3 && mergeRate >= 0.8 && (reworkRate ?? 0) <= 0.2) {
    return "ready";
  }
  return "supervised";
}

function inTimeWindow(
  isoTimestamp: string | undefined | null,
  windowStartMs: number | null,
  windowEndMs: number,
): boolean {
  if (!isoTimestamp) {
    return false;
  }
  const ms = Date.parse(isoTimestamp);
  if (Number.isNaN(ms)) {
    return false;
  }
  if (ms > windowEndMs) {
    return false;
  }
  return windowStartMs === null || ms >= windowStartMs;
}

/**
 * Computes DORA velocity, CI duration percentiles, and coding-agent merge/rework rates
 * from GitHub PR, workflow run, and optional Linear issue snapshots.
 */
export function computeVelocityAndAgentMetrics(
  input: VelocityMetricsInput,
): VelocityMetricsReport {
  const nowMs = Date.parse(input.nowIso);
  if (Number.isNaN(nowMs)) {
    throw new Error(`Invalid ISO timestamp for nowIso: '${input.nowIso}'`);
  }

  const windowDays = input.windowDays ?? DEFAULT_METRICS_WINDOW_DAYS;
  const windowStartMs = windowDays > 0 ? nowMs - windowDays * MS_PER_DAY : null;
  const windowStartIso =
    windowStartMs !== null
      ? new Date(windowStartMs).toISOString()
      : new Date(0).toISOString();
  const windowEndIso = new Date(nowMs).toISOString();

  const issueIndex = new Map<string, LinearIssueSnapshot>();
  for (const issue of input.issues ?? []) {
    issueIndex.set(issue.identifier.trim().toUpperCase(), issue);
  }

  const prsInWindow = input.pullRequests.filter((pr) =>
    inTimeWindow(
      pr.mergedAt ?? pr.closedAt ?? pr.updatedAt ?? pr.createdAt,
      windowStartMs,
      nowMs,
    ),
  );

  const runsInWindow = input.workflowRuns.filter((run) =>
    inTimeWindow(run.updatedAt ?? run.createdAt, windowStartMs, nowMs),
  );

  const cycleHours: number[] = [];
  const leadHours: number[] = [];

  for (const pr of prsInWindow) {
    if (!pr.mergedAt) {
      continue;
    }
    const mergedMs = Date.parse(pr.mergedAt);
    if (Number.isNaN(mergedMs)) {
      continue;
    }

    if (pr.createdAt) {
      const createdMs = Date.parse(pr.createdAt);
      if (!Number.isNaN(createdMs)) {
        cycleHours.push(Math.max(0, (mergedMs - createdMs) / MS_PER_HOUR));
      }
    }

    const keys = extractLinearIssueKeys(pr);
    let earliestIssueMs: number | null = null;
    for (const key of keys) {
      const matched = issueIndex.get(key);
      if (!matched) {
        continue;
      }
      const createdMs = Date.parse(matched.createdAt);
      if (Number.isNaN(createdMs)) {
        continue;
      }
      if (earliestIssueMs === null || createdMs < earliestIssueMs) {
        earliestIssueMs = createdMs;
      }
    }
    if (earliestIssueMs !== null) {
      leadHours.push(Math.max(0, (mergedMs - earliestIssueMs) / MS_PER_HOUR));
    }
  }

  const ciSeconds: number[] = [];
  let completedRuns = 0;
  let failedRuns = 0;
  let succeededRuns = 0;

  for (const run of runsInWindow) {
    if (run.status.toLowerCase() !== "completed") {
      continue;
    }
    const conclusion = (run.conclusion ?? "").toLowerCase();
    if (conclusion === "skipped" || conclusion === "cancelled") {
      continue;
    }
    completedRuns += 1;
    if (conclusion === "success") {
      succeededRuns += 1;
    } else if (
      conclusion === "failure" ||
      conclusion === "timed_out" ||
      conclusion === "startup_failure"
    ) {
      failedRuns += 1;
    }

    const startMs = Date.parse(run.runStartedAt ?? run.createdAt);
    const endMs = Date.parse(run.updatedAt);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
      ciSeconds.push(Math.max(0, (endMs - startMs) / MS_PER_SECOND));
    }
  }

  const agentPrs: MetricsPullRequestInput[] = [];
  const humanPrs: MetricsPullRequestInput[] = [];
  const botPrs: MetricsPullRequestInput[] = [];

  for (const pr of prsInWindow) {
    const actor = classifyPullRequest(pr);
    if (actor === "coding-agent") {
      agentPrs.push(pr);
    } else if (actor === "dependency-bot") {
      botPrs.push(pr);
    } else {
      humanPrs.push(pr);
    }
  }

  const taskGroups = new Map<TaskType, MetricsPullRequestInput[]>();
  for (const pr of agentPrs) {
    const taskType = classifyTaskType(pr);
    const list = taskGroups.get(taskType) ?? [];
    list.push(pr);
    taskGroups.set(taskType, list);
  }

  const byTaskType: TaskTypeMetricsSummary[] = Array.from(taskGroups.entries())
    .map(([taskType, prs]) => {
      const summary = summarizeActorCategory("coding-agent", prs);
      const resolved = summary.merged + summary.closedUnmerged;
      const issueKeys = Array.from(
        new Set(prs.flatMap((pr) => extractLinearIssueKeys(pr))),
      );
      return {
        taskType,
        total: summary.total,
        merged: summary.merged,
        closedUnmerged: summary.closedUnmerged,
        open: summary.open,
        failedOrReworked: summary.reworkCount,
        mergeRate: summary.mergeRate,
        reworkRate: summary.reworkRate,
        readiness: evaluateReadiness(resolved, summary.mergeRate, summary.reworkRate),
        sampleIssueKeys: issueKeys.slice(0, 5),
      };
    })
    .sort((a, b) => b.total - a.total || a.taskType.localeCompare(b.taskType));

  const ciStats = summarizeDurations(ciSeconds);
  const codingAgentSummary = summarizeActorCategory("coding-agent", agentPrs);
  const recommendations: string[] = [];

  if (codingAgentSummary.total === 0) {
    recommendations.push(
      "No coding-agent PRs merged or updated in this window; dispatch an agent-ready Linear issue to collect baseline data.",
    );
  }
  for (const group of byTaskType) {
    const resolved = group.merged + group.closedUnmerged;
    if (group.readiness === "needs-scaffolding" && group.mergeRate !== null) {
      recommendations.push(
        `Strengthen context packs/templates for '${group.taskType}' tasks (${Math.round(group.mergeRate * 100)}% merge rate across ${resolved} resolved agent PRs).`,
      );
    } else if (group.readiness === "ready" && group.mergeRate !== null) {
      recommendations.push(
        `Keep dispatching '${group.taskType}' tasks autonomously (${Math.round(group.mergeRate * 100)}% merge rate across ${resolved} resolved agent PRs).`,
      );
    }
  }
  if (ciStats.p90 !== null && ciStats.p90 > 600) {
    recommendations.push(
      `Investigate p90 CI duration (${ciStats.p90}s > 600s) to tighten PR feedback loops.`,
    );
  }
  if ((input.issues?.length ?? 0) === 0) {
    recommendations.push(
      "Provide LINEAR_API_KEY in CI/local runs to populate end-to-end issue-to-production lead times.",
    );
  }

  return {
    schemaVersion: 1,
    repo: input.repo ?? "Stefs-Startup/monorepo",
    generatedAt: windowEndIso,
    windowDays,
    windowStart: windowStartIso,
    windowEnd: windowEndIso,
    counts: {
      pullRequestsInWindow: prsInWindow.length,
      workflowRunsInWindow: runsInWindow.length,
      linearIssuesLoaded: input.issues?.length ?? 0,
    },
    leadTimeHours: summarizeDurations(leadHours),
    prCycleTimeHours: summarizeDurations(cycleHours),
    ciDurationSeconds: {
      ...ciStats,
      completedRuns,
      failedRuns,
      successRate:
        completedRuns > 0 ? round3(succeededRuns / completedRuns) : null,
    },
    byActor: {
      codingAgent: codingAgentSummary,
      human: summarizeActorCategory("human", humanPrs),
      dependencyBot: summarizeActorCategory("dependency-bot", botPrs),
      all: summarizeActorCategory("all", prsInWindow),
    },
    byTaskType,
    recommendations,
  };
}

function formatMetricNumber(val: number | null, suffix: string): string {
  return val === null ? "n/a" : `${val}${suffix}`;
}

function formatPct(rate: number | null): string {
  return rate === null ? "n/a" : `${(rate * 100).toFixed(1)}%`;
}

/**
 * Formats the weekly velocity & coding-agent metrics report as Markdown for CI summaries and GitHub issues.
 */
export function formatWeeklyDigestMarkdown(
  report: VelocityMetricsReport,
): string {
  const actorRows = [
    report.byActor.codingAgent,
    report.byActor.human,
    report.byActor.dependencyBot,
    report.byActor.all,
  ].map(
    (a) =>
      `| \`${a.category}\` | ${a.total} | ${a.merged} | ${a.closedUnmerged} | ${a.open} | ${formatPct(a.mergeRate)} | ${a.reworkCount} (${formatPct(a.reworkRate)}) |`,
  );

  const taskRows =
    report.byTaskType.length > 0
      ? report.byTaskType.map(
          (t) =>
            `| \`${t.taskType}\` | ${t.total} | ${t.merged} | ${t.closedUnmerged} | ${t.failedOrReworked} | ${formatPct(t.mergeRate)} | \`${t.readiness}\` | ${t.sampleIssueKeys.join(", ") || "—"} |`,
        )
      : ["| _none_ | 0 | 0 | 0 | 0 | n/a | `insufficient-data` | — |"];

  const recs =
    report.recommendations.length > 0
      ? report.recommendations.map((r) => `- ${r}`).join("\n")
      : "- Velocity and agent metrics look healthy for the current window.";

  return [
    AGENT_METRICS_MARKER,
    `# Weekly Velocity & Agent Metrics Digest — \`${report.repo}\``,
    "",
    `- **Window:** Last **${report.windowDays} days** (\`${report.windowStart.slice(0, 10)}\` .. \`${report.windowEnd.slice(0, 10)}\`)`,
    `- **Sampled:** ${report.counts.pullRequestsInWindow} PRs, ${report.counts.workflowRunsInWindow} workflow runs, ${report.counts.linearIssuesLoaded} Linear issues`,
    "",
    "## Headline DORA & CI Metrics",
    "",
    "| Metric | Sample Count | p50 | p90 | Mean | Notes |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    `| Issue-to-Merge Lead Time | ${report.leadTimeHours.count} | ${formatMetricNumber(report.leadTimeHours.p50, "h")} | ${formatMetricNumber(report.leadTimeHours.p90, "h")} | ${formatMetricNumber(report.leadTimeHours.mean, "h")} | Matched Linear issue \`createdAt\` → PR \`mergedAt\` |`,
    `| PR Cycle Time | ${report.prCycleTimeHours.count} | ${formatMetricNumber(report.prCycleTimeHours.p50, "h")} | ${formatMetricNumber(report.prCycleTimeHours.p90, "h")} | ${formatMetricNumber(report.prCycleTimeHours.mean, "h")} | PR \`createdAt\` → PR \`mergedAt\` |`,
    `| CI Duration | ${report.ciDurationSeconds.count} | ${formatMetricNumber(report.ciDurationSeconds.p50, "s")} | ${formatMetricNumber(report.ciDurationSeconds.p90, "s")} | ${formatMetricNumber(report.ciDurationSeconds.mean, "s")} | Pass rate: ${formatPct(report.ciDurationSeconds.successRate)} (${report.ciDurationSeconds.failedRuns} failed / ${report.ciDurationSeconds.completedRuns} runs) |`,
    "",
    "## PR Outcomes by Actor",
    "",
    "| Actor Category | Total | Merged | Closed Unmerged | Open | Merge Rate | Rework (Count / Rate) |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...actorRows,
    "",
    "## Coding-Agent Outcomes by Task Type",
    "",
    "| Task Type | Total | Merged | Closed | Reworked | Merge Rate | Readiness | Issues |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...taskRows,
    "",
    "## Re-Ranking & Scaffolding Notes",
    "",
    recs,
    "",
  ].join("\n");
}
