import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeVelocityAndAgentMetrics,
  DEFAULT_METRICS_WINDOW_DAYS,
  formatWeeklyDigestMarkdown,
  type LinearIssueSnapshot,
  type MetricsPullRequestInput,
  type WorkflowRunSnapshot,
} from "./agent-metrics.js";

export interface GitHubRestMetricsPullRequest {
  number: number;
  title: string;
  body?: string | null;
  state: "open" | "closed";
  head: {
    ref: string;
  };
  user?: {
    login?: string;
    type?: string;
  } | null;
  labels?: ReadonlyArray<string | { name?: string | null }>;
  created_at?: string;
  updated_at: string;
  closed_at?: string | null;
  merged_at?: string | null;
  draft?: boolean;
}

export interface GitHubRestWorkflowRun {
  id: number;
  name?: string | null;
  status?: string | null;
  conclusion?: string | null;
  created_at: string;
  run_started_at?: string | null;
  updated_at: string;
  event?: string;
}

/**
 * Converts a GitHub REST pull request object into `MetricsPullRequestInput`.
 */
export function toMetricsPullRequest(
  raw: GitHubRestMetricsPullRequest,
): MetricsPullRequestInput {
  const labels = (raw.labels ?? [])
    .map((entry) => (typeof entry === "string" ? entry : entry.name ?? ""))
    .filter((name) => name.length > 0);

  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? "",
    state: raw.state,
    headRef: raw.head.ref,
    authorLogin: raw.user?.login ?? "unknown",
    authorIsBot: raw.user?.type === "Bot",
    labels,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    closedAt: raw.closed_at ?? null,
    mergedAt: raw.merged_at ?? null,
    draft: Boolean(raw.draft),
  };
}

/**
 * Converts a GitHub REST workflow run object into `WorkflowRunSnapshot`.
 */
export function toWorkflowRunSnapshot(
  raw: GitHubRestWorkflowRun,
): WorkflowRunSnapshot {
  return {
    id: raw.id,
    name: raw.name ?? "workflow",
    status: raw.status ?? "unknown",
    conclusion: raw.conclusion ?? null,
    createdAt: raw.created_at,
    runStartedAt: raw.run_started_at ?? null,
    updatedAt: raw.updated_at,
    event: raw.event,
  };
}

function readFlag(args: readonly string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
    if (arg === flag && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return undefined;
}

function parseJsonArrayFile<T>(filePath: string): T[] {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Input JSON file not found: ${resolved}`);
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (Array.isArray(parsed)) {
    return parsed as T[];
  }
  throw new Error(`Expected JSON array in ${resolved}`);
}

function inferRepoSlug(): string {
  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY;
  }
  const res = spawnSync("git", ["remote", "get-url", "origin"], {
    encoding: "utf8",
  });
  if (res.status === 0 && res.stdout) {
    const match = res.stdout.trim().match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/i);
    if (match?.[1]) {
      return match[1];
    }
  }
  return "Stefs-Startup/monorepo";
}

async function fetchGitHubJson<T>(
  endpoint: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const token = env.GITHUB_TOKEN ?? env.GH_TOKEN;
  if (token) {
    const response = await fetchImpl(`https://api.github.com${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!response.ok) {
      throw new Error(
        `GitHub API request failed (${response.status}) for ${endpoint}`,
      );
    }
    return (await response.json()) as T;
  }

  const ghRes = spawnSync("gh", ["api", endpoint.replace(/^\/+/, "")], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (ghRes.error) {
    throw new Error(`gh api failed for ${endpoint}: ${ghRes.error.message}`);
  }
  if (ghRes.status !== 0) {
    throw new Error(
      `gh api failed for ${endpoint}: ${(ghRes.stderr ?? "").trim()}`,
    );
  }
  return JSON.parse(ghRes.stdout) as T;
}

async function fetchLinearIssues(
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<LinearIssueSnapshot[]> {
  if (!apiKey) {
    return [];
  }

  const query = `
    query RecentIssues {
      issues(first: 100, orderBy: updatedAt) {
        nodes {
          identifier
          createdAt
          completedAt
          state { name }
          labels { nodes { name } }
        }
      }
    }
  `;

  const response = await fetchImpl("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Linear GraphQL request failed (${response.status})`);
  }

  interface LinearNode {
    identifier: string;
    createdAt: string;
    completedAt?: string | null;
    state?: { name?: string | null } | null;
    labels?: { nodes?: Array<{ name?: string | null }> } | null;
  }

  const payload = (await response.json()) as {
    data?: { issues?: { nodes?: LinearNode[] } };
  };
  const nodes = payload.data?.issues?.nodes ?? [];
  return nodes.map((node) => ({
    identifier: node.identifier,
    createdAt: node.createdAt,
    completedAt: node.completedAt ?? null,
    state: node.state?.name ?? undefined,
    labels: (node.labels?.nodes ?? [])
      .map((l) => l.name ?? "")
      .filter(Boolean),
  }));
}

function writeOptionalOutput(filePath: string | undefined, content: string): void {
  if (!filePath) {
    return;
  }
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, "utf8");
}

function printHelp(): void {
  console.log(`Usage: cmp-agent-metrics [options]

Options:
  --live                 Fetch live PRs & workflow runs from GitHub (+ Linear if LINEAR_API_KEY set)
  --repo=<owner/repo>    GitHub repository slug (defaults to GITHUB_REPOSITORY or origin remote)
  --prs=<path>           JSON file with pull request snapshots (MetricsPullRequestInput[])
  --runs=<path>          JSON file with workflow run snapshots (WorkflowRunSnapshot[])
  --issues=<path>        JSON file with Linear issue snapshots (LinearIssueSnapshot[])
  --window-days=<n>      Rolling evaluation window in days (default ${DEFAULT_METRICS_WINDOW_DAYS}; 0 = all time)
  --now=<iso>            Evaluation ISO timestamp (default current UTC time)
  --json                 Print JSON report to stdout instead of Markdown digest
  --out=<path>           Write Markdown digest to file
  --json-out=<path>      Write JSON report to file
`);
}

export interface AgentMetricsCliDeps {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}

/**
 * CLI entrypoint computing velocity & coding-agent metrics from fixtures or live GitHub/Linear APIs.
 */
export async function runAgentMetricsCli(
  rawArgv: readonly string[],
  deps: AgentMetricsCliDeps = {},
): Promise<number> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const env = deps.env ?? process.env;
  const argv = rawArgv[0] === "--" ? rawArgv.slice(1) : rawArgv;
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return 0;
  }

  const live = argv.includes("--live");
  const prsFlag = readFlag(argv, "--prs");
  const runsFlag = readFlag(argv, "--runs");
  const issuesFlag = readFlag(argv, "--issues");

  if (!live && !prsFlag && !runsFlag) {
    console.error("Error: Provide --live or fixture inputs (--prs / --runs).");
    printHelp();
    return 1;
  }

  const windowRaw = readFlag(argv, "--window-days");
  const windowDays = windowRaw
    ? Number.parseInt(windowRaw, 10)
    : DEFAULT_METRICS_WINDOW_DAYS;
  if (!Number.isFinite(windowDays) || windowDays < 0) {
    console.error(`Error: Invalid --window-days '${windowRaw}'. Expected >= 0.`);
    return 1;
  }

  const repo = readFlag(argv, "--repo") ?? inferRepoSlug();
  const nowIso = readFlag(argv, "--now") ?? new Date().toISOString();

  try {
    let pullRequests: MetricsPullRequestInput[] = [];
    let workflowRuns: WorkflowRunSnapshot[] = [];
    let issues: LinearIssueSnapshot[] = issuesFlag
      ? parseJsonArrayFile<LinearIssueSnapshot>(issuesFlag)
      : [];

    if (live) {
      const [rawPrs, rawRunsPayload, liveIssues] = await Promise.all([
        fetchGitHubJson<GitHubRestMetricsPullRequest[]>(
          `/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100`,
          env,
          fetchImpl,
        ),
        fetchGitHubJson<{ workflow_runs?: GitHubRestWorkflowRun[] }>(
          `/repos/${repo}/actions/runs?per_page=100`,
          env,
          fetchImpl,
        ),
        issuesFlag ? Promise.resolve(issues) : fetchLinearIssues(env.LINEAR_API_KEY, fetchImpl),
      ]);
      pullRequests = rawPrs.map(toMetricsPullRequest);
      workflowRuns = (rawRunsPayload.workflow_runs ?? []).map(
        toWorkflowRunSnapshot,
      );
      issues = liveIssues;
    } else {
      pullRequests = prsFlag
        ? parseJsonArrayFile<MetricsPullRequestInput>(prsFlag)
        : [];
      workflowRuns = runsFlag
        ? parseJsonArrayFile<WorkflowRunSnapshot>(runsFlag)
        : [];
    }

    const report = computeVelocityAndAgentMetrics({
      repo,
      nowIso,
      windowDays,
      pullRequests,
      workflowRuns,
      issues,
    });
    const markdown = formatWeeklyDigestMarkdown(report);
    const jsonOutput = JSON.stringify(report, null, 2);

    writeOptionalOutput(readFlag(argv, "--out"), markdown);
    writeOptionalOutput(readFlag(argv, "--json-out"), `${jsonOutput}\n`);

    if (argv.includes("--json")) {
      console.log(jsonOutput);
    } else {
      console.log(markdown);
    }
    return 0;
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }
}

function isExecutedDirectly(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  try {
    return (
      fs.realpathSync(path.resolve(process.argv[1])) ===
      fs.realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isExecutedDirectly()) {
  runAgentMetricsCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
