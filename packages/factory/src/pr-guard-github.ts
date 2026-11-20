import {
  AGENT_PR_GUARD_MARKER,
  evaluatePullRequestGuard,
  evaluateStaleAgentPrs,
  type PullRequestGuardDecision,
  type PullRequestSnapshot,
  type StaleAgentPrResult,
} from "./pr-guard-policy.js";

export interface GitHubRestPullRequest {
  number: number;
  title: string;
  body?: string | null;
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
  draft?: boolean;
}

export interface GitHubGuardClient {
  upsertStickyComment(
    prNumber: number,
    marker: string,
    body: string,
  ): Promise<void>;
  closePullRequest(prNumber: number): Promise<void>;
  log?(message: string): void;
}

export interface RunGitHubPrGuardInput {
  mode: "pr" | "stale";
  openPrs: readonly PullRequestSnapshot[];
  targetPrNumber?: number;
  nowIso?: string;
  dryRun?: boolean;
  maxOpenAgentPrs?: number;
  staleDays?: number;
  client: GitHubGuardClient;
}

export interface RunGitHubPrGuardResult {
  mode: "pr" | "stale";
  dryRun: boolean;
  failed: boolean;
  commentedPrNumbers: number[];
  closedPrNumbers: number[];
  prDecision?: PullRequestGuardDecision;
  staleResult?: StaleAgentPrResult;
}

/**
 * Converts a GitHub REST API pull request object into the pure policy `PullRequestSnapshot`.
 */
export function toPullRequestSnapshot(
  ghPr: GitHubRestPullRequest,
): PullRequestSnapshot {
  const labels = (ghPr.labels ?? [])
    .map((entry) => (typeof entry === "string" ? entry : entry.name ?? ""))
    .filter((name) => name.length > 0);

  return {
    number: ghPr.number,
    title: ghPr.title,
    body: ghPr.body ?? "",
    headRef: ghPr.head.ref,
    authorLogin: ghPr.user?.login ?? "unknown",
    authorIsBot: ghPr.user?.type === "Bot",
    labels,
    createdAt: ghPr.created_at,
    updatedAt: ghPr.updated_at,
    draft: Boolean(ghPr.draft),
  };
}

/**
 * Executes the PR guard policy against open GitHub pull requests in either
 * single-PR (`pr`) or scheduled stale sweep (`stale`) mode.
 */
export async function runGitHubPrGuard(
  input: RunGitHubPrGuardInput,
): Promise<RunGitHubPrGuardResult> {
  const dryRun = Boolean(input.dryRun);
  const log = input.client.log ?? (() => {});
  const commentedPrNumbers: number[] = [];
  const closedPrNumbers: number[] = [];

  if (input.mode === "pr") {
    if (!input.targetPrNumber) {
      throw new Error("targetPrNumber is required when mode is 'pr'.");
    }
    const targetPr = input.openPrs.find(
      (pr) => pr.number === input.targetPrNumber,
    );
    if (!targetPr) {
      throw new Error(
        `Target PR #${input.targetPrNumber} was not found among open PRs.`,
      );
    }

    const decision = evaluatePullRequestGuard(targetPr, input.openPrs, {
      maxOpenAgentPrs: input.maxOpenAgentPrs,
    });

    if (decision.commentBody) {
      if (dryRun) {
        log(
          `[DRY-RUN] Would comment on PR #${decision.prNumber} (shouldClose=${decision.shouldClose}).`,
        );
      } else {
        await input.client.upsertStickyComment(
          decision.prNumber,
          AGENT_PR_GUARD_MARKER,
          decision.commentBody,
        );
        commentedPrNumbers.push(decision.prNumber);
        if (decision.shouldClose) {
          await input.client.closePullRequest(decision.prNumber);
          closedPrNumbers.push(decision.prNumber);
        }
      }
    }

    return {
      mode: "pr",
      dryRun,
      failed: decision.shouldFail,
      commentedPrNumbers,
      closedPrNumbers,
      prDecision: decision,
    };
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const staleResult = evaluateStaleAgentPrs(input.openPrs, nowIso, {
    staleDays: input.staleDays,
  });

  for (const candidate of staleResult.stalePrs) {
    if (dryRun) {
      log(
        `[DRY-RUN] Would close stale coding-agent PR #${candidate.prNumber} (age=${candidate.ageDays}d).`,
      );
      continue;
    }
    await input.client.upsertStickyComment(
      candidate.prNumber,
      AGENT_PR_GUARD_MARKER,
      candidate.commentBody,
    );
    commentedPrNumbers.push(candidate.prNumber);
    await input.client.closePullRequest(candidate.prNumber);
    closedPrNumbers.push(candidate.prNumber);
  }

  return {
    mode: "stale",
    dryRun,
    failed: false,
    commentedPrNumbers,
    closedPrNumbers,
    staleResult,
  };
}
