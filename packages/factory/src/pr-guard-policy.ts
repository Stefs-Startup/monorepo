export const AGENT_PR_GUARD_MARKER = "<!-- cmp-agent-pr-guard -->";
export const DEFAULT_MAX_OPEN_AGENT_PRS = 5;
export const DEFAULT_STALE_AGENT_PR_DAYS = 7;
export const GUARD_EXEMPT_LABEL = "guard-exempt";

export type PrActorCategory = "dependency-bot" | "coding-agent" | "human";

export type GuardViolationCode =
  | "duplicate_issue_pr"
  | "missing_linear_issue"
  | "invalid_agent_branch"
  | "agent_pr_cap_exceeded";

export interface PullRequestSnapshot {
  number: number;
  title: string;
  body?: string;
  headRef: string;
  authorLogin: string;
  authorIsBot?: boolean;
  labels?: readonly string[];
  commitsCoAuthors?: readonly string[];
  createdAt?: string;
  updatedAt: string;
  draft?: boolean;
}

export interface GuardViolation {
  code: GuardViolationCode;
  message: string;
  issueKey?: string;
  canonicalPrNumber?: number;
  activeAgentPrNumbers?: number[];
}

export interface PullRequestGuardOptions {
  maxOpenAgentPrs?: number;
}

export interface PullRequestGuardDecision {
  prNumber: number;
  category: PrActorCategory;
  exempt: boolean;
  issueKeys: string[];
  violations: GuardViolation[];
  shouldFail: boolean;
  shouldClose: boolean;
  commentBody: string | null;
}

export interface StaleAgentPrOptions {
  staleDays?: number;
}

export interface StaleAgentPrCandidate {
  prNumber: number;
  headRef: string;
  authorLogin: string;
  ageDays: number;
  updatedAt: string;
  commentBody: string;
}

export interface StaleAgentPrResult {
  evaluatedAt: string;
  staleDays: number;
  stalePrs: StaleAgentPrCandidate[];
  stalePrNumbers: number[];
  skippedExemptPrNumbers: number[];
}

const DEPENDENCY_BOT_LOGINS = new Set([
  "dependabot",
  "dependabot[bot]",
  "app/dependabot",
  "renovate",
  "renovate[bot]",
  "app/renovate",
]);

const CODING_AGENT_LABELS = new Set([
  "agent",
  "agent-pr",
  "automated-agent",
]);

const LINEAR_KEY_RE = /(?<![A-Z0-9])((?:STE|CMP)-\d+)(?![A-Z0-9])/gi;
const LINEAR_AGENT_BRANCH_RE =
  /^(?:[a-z0-9._-]+\/)?(?:ste|cmp)-\d+(?:[-/][a-z0-9._-]+)*$/i;
const AGENT_ATTRIBUTION_RE =
  /(?:noreply@anthropic\.com|generated with claude code|co-authored-by:.*\b(?:claude|copilot|codex|sweep|devin)\b)/i;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function hasGuardExemptLabel(pr: Pick<PullRequestSnapshot, "labels">): boolean {
  return (pr.labels ?? []).some(
    (label) => label.trim().toLowerCase() === GUARD_EXEMPT_LABEL,
  );
}

/**
 * Classifies a pull request actor into `dependency-bot`, `coding-agent`, or `human`.
 * Detects GitHub bot accounts, agent labels, and agent co-author/body attribution markers.
 */
export function classifyPullRequest(pr: PullRequestSnapshot): PrActorCategory {
  const login = pr.authorLogin.trim().toLowerCase();
  if (DEPENDENCY_BOT_LOGINS.has(login)) {
    return "dependency-bot";
  }

  if (Boolean(pr.authorIsBot) || login.endsWith("[bot]")) {
    return "coding-agent";
  }

  const hasAgentLabel = (pr.labels ?? []).some((label) =>
    CODING_AGENT_LABELS.has(label.trim().toLowerCase()),
  );
  if (hasAgentLabel) {
    return "coding-agent";
  }

  const attributionText = [
    pr.body ?? "",
    ...(pr.commitsCoAuthors ?? []),
  ].join("\n");
  if (AGENT_ATTRIBUTION_RE.test(attributionText)) {
    return "coding-agent";
  }

  return "human";
}

/**
 * Extracts deduplicated uppercase Linear issue keys (`STE-XX`, `CMP-XX`)
 * from PR branch name, title, and body in first-seen order.
 */
export function extractLinearIssueKeys(
  pr: Pick<PullRequestSnapshot, "headRef" | "title" | "body">,
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const sources = [pr.headRef, pr.title, pr.body ?? ""];

  for (const text of sources) {
    const matches = text.match(LINEAR_KEY_RE);
    if (!matches) {
      continue;
    }
    for (const raw of matches) {
      const normalized = raw.toUpperCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        ordered.push(normalized);
      }
    }
  }

  return ordered;
}

/**
 * Validates that a coding-agent branch follows Linear issue branch naming (`STE-XX` / `CMP-XX`).
 */
export function isValidLinearAgentBranch(headRef: string): boolean {
  const trimmed = headRef.trim();
  if (!trimmed) {
    return false;
  }
  return LINEAR_AGENT_BRANCH_RE.test(trimmed);
}

/**
 * Renders the sticky idempotent PR comment explaining guard policy findings.
 */
export function formatGuardComment(
  decision: Pick<
    PullRequestGuardDecision,
    "prNumber" | "category" | "issueKeys" | "violations" | "shouldClose"
  >,
): string {
  const lines: string[] = [
    AGENT_PR_GUARD_MARKER,
    `### Agent Delivery Guardrails — PR #${decision.prNumber}`,
    "",
    `- **Actor classification:** \`${decision.category}\``,
    `- **Linear issue keys:** ${decision.issueKeys.length > 0 ? decision.issueKeys.map((k) => `\`${k}\``).join(", ") : "_none detected_"}`,
    "",
    "**Policy violations:**",
  ];

  for (const violation of decision.violations) {
    lines.push(`- \`${violation.code}\`: ${violation.message}`);
  }

  lines.push("");
  if (decision.shouldClose) {
    lines.push(
      `This \`coding-agent\` PR was **closed automatically** to enforce one issue → one branch → one PR (apply the \`${GUARD_EXEMPT_LABEL}\` label and reopen if an override is intentional).`,
    );
  } else {
    lines.push(
      `Check failed for visibility; PR remains open. Coordinate on the canonical PR or apply \`${GUARD_EXEMPT_LABEL}\` if intentional.`,
    );
  }

  return lines.join("\n");
}

/**
 * Renders the sticky comment posted before closing a stale coding-agent PR.
 */
export function formatStaleCloseComment(
  candidate: Pick<StaleAgentPrCandidate, "prNumber" | "ageDays" | "updatedAt">,
  staleDays: number = DEFAULT_STALE_AGENT_PR_DAYS,
): string {
  return [
    AGENT_PR_GUARD_MARKER,
    `### Stale Coding-Agent PR Closed (#${candidate.prNumber})`,
    "",
    `This automated coding-agent PR has had no activity for **${candidate.ageDays} days** (last updated \`${candidate.updatedAt}\`, policy threshold: **${staleDays} days**) and has been **closed automatically**.`,
    "",
    `If this work is still needed, reopen the PR or re-dispatch from the \`agent-ready\` Linear issue (apply \`${GUARD_EXEMPT_LABEL}\` to keep open indefinitely).`,
  ].join("\n");
}

function mergeOpenPrs(
  targetPr: PullRequestSnapshot,
  openPrs: readonly PullRequestSnapshot[],
): PullRequestSnapshot[] {
  const byNumber = new Map<number, PullRequestSnapshot>();
  for (const pr of openPrs) {
    byNumber.set(pr.number, pr);
  }
  byNumber.set(targetPr.number, targetPr);
  return Array.from(byNumber.values()).sort((a, b) => a.number - b.number);
}

function comparePrAgeAsc(a: PullRequestSnapshot, b: PullRequestSnapshot): number {
  const aMs = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
  const bMs = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;
  if (!Number.isNaN(aMs) && !Number.isNaN(bMs) && aMs !== bMs) {
    return aMs - bMs;
  }
  return a.number - b.number;
}

/**
 * Evaluates a target pull request against all currently open PRs for:
 * 1) One Linear issue -> one open PR deduplication (canonical = lowest PR number)
 * 2) Coding-agent Linear issue + branch naming discipline
 * 3) Concurrent coding-agent open PR cap (default 5, excluding dependency bots & guard-exempt)
 */
export function evaluatePullRequestGuard(
  targetPr: PullRequestSnapshot,
  openPrs: readonly PullRequestSnapshot[],
  options: PullRequestGuardOptions = {},
): PullRequestGuardDecision {
  const maxOpenAgentPrs = options.maxOpenAgentPrs ?? DEFAULT_MAX_OPEN_AGENT_PRS;
  const category = classifyPullRequest(targetPr);
  const exempt = hasGuardExemptLabel(targetPr);
  const issueKeys = extractLinearIssueKeys(targetPr);

  if (category === "dependency-bot" || exempt) {
    return {
      prNumber: targetPr.number,
      category,
      exempt,
      issueKeys,
      violations: [],
      shouldFail: false,
      shouldClose: false,
      commentBody: null,
    };
  }

  const allOpenNonBotPrs = mergeOpenPrs(targetPr, openPrs).filter(
    (pr) => classifyPullRequest(pr) !== "dependency-bot",
  );

  const violations: GuardViolation[] = [];

  for (const issueKey of issueKeys) {
    const claimers = allOpenNonBotPrs.filter((pr) =>
      extractLinearIssueKeys(pr).includes(issueKey),
    );
    const canonical = claimers[0];
    if (canonical && canonical.number < targetPr.number) {
      violations.push({
        code: "duplicate_issue_pr",
        message: `Linear issue ${issueKey} already has an open canonical PR #${canonical.number}.`,
        issueKey,
        canonicalPrNumber: canonical.number,
      });
    }
  }

  if (category === "coding-agent") {
    if (issueKeys.length === 0) {
      violations.push({
        code: "missing_linear_issue",
        message:
          "Coding-agent PR must reference a Linear issue key (e.g. STE-52) in its branch, title, or body.",
      });
    }

    if (!isValidLinearAgentBranch(targetPr.headRef)) {
      violations.push({
        code: "invalid_agent_branch",
        message: `Branch '${targetPr.headRef}' must follow Linear branch naming (e.g. <user>/ste-52-slug).`,
      });
    }

    const activeAgentPrs = allOpenNonBotPrs
      .filter(
        (pr) =>
          classifyPullRequest(pr) === "coding-agent" && !hasGuardExemptLabel(pr),
      )
      .sort(comparePrAgeAsc);

    const allowedSlots = activeAgentPrs.slice(0, maxOpenAgentPrs);
    const withinCap = allowedSlots.some((pr) => pr.number === targetPr.number);
    if (!withinCap) {
      const activeNumbers = allowedSlots.map((pr) => pr.number);
      violations.push({
        code: "agent_pr_cap_exceeded",
        message: `Open coding-agent PR cap (${maxOpenAgentPrs}) reached by PRs ${activeNumbers.map((n) => `#${n}`).join(", ")}.`,
        activeAgentPrNumbers: activeNumbers,
      });
    }
  }

  const shouldFail = violations.length > 0;
  const shouldClose = shouldFail && category === "coding-agent";
  const commentBody = shouldFail
    ? formatGuardComment({
        prNumber: targetPr.number,
        category,
        issueKeys,
        violations,
        shouldClose,
      })
    : null;

  return {
    prNumber: targetPr.number,
    category,
    exempt,
    issueKeys,
    violations,
    shouldFail,
    shouldClose,
    commentBody,
  };
}

/**
 * Finds open coding-agent PRs inactive for >= `staleDays` (default 7).
 * Skips dependency bots, human PRs, and PRs carrying `guard-exempt`.
 */
export function evaluateStaleAgentPrs(
  openPrs: readonly PullRequestSnapshot[],
  nowIso: string,
  options: StaleAgentPrOptions = {},
): StaleAgentPrResult {
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(nowMs)) {
    throw new Error(`Invalid ISO timestamp for stale evaluation: '${nowIso}'`);
  }

  const staleDays = options.staleDays ?? DEFAULT_STALE_AGENT_PR_DAYS;
  const stalePrs: StaleAgentPrCandidate[] = [];
  const skippedExemptPrNumbers: number[] = [];

  const sorted = [...openPrs].sort((a, b) => a.number - b.number);
  for (const pr of sorted) {
    if (classifyPullRequest(pr) !== "coding-agent") {
      continue;
    }

    if (hasGuardExemptLabel(pr)) {
      skippedExemptPrNumbers.push(pr.number);
      continue;
    }

    const updatedMs = Date.parse(pr.updatedAt);
    if (Number.isNaN(updatedMs)) {
      throw new Error(
        `Invalid updatedAt timestamp on PR #${pr.number}: '${pr.updatedAt}'`,
      );
    }

    const rawAgeDays = (nowMs - updatedMs) / MS_PER_DAY;
    if (rawAgeDays < staleDays) {
      continue;
    }

    const ageDays = Math.floor(rawAgeDays * 10) / 10;
    const commentBody = formatStaleCloseComment(
      {
        prNumber: pr.number,
        ageDays,
        updatedAt: pr.updatedAt,
      },
      staleDays,
    );

    stalePrs.push({
      prNumber: pr.number,
      headRef: pr.headRef,
      authorLogin: pr.authorLogin,
      ageDays,
      updatedAt: pr.updatedAt,
      commentBody,
    });
  }

  return {
    evaluatedAt: new Date(nowMs).toISOString(),
    staleDays,
    stalePrs,
    stalePrNumbers: stalePrs.map((p) => p.prNumber),
    skippedExemptPrNumbers,
  };
}
