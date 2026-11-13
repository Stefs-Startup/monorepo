import * as fs from "node:fs";
import * as path from "node:path";

export type PlanIssueCategory =
  | "underspecified_inputs"
  | "missing_edge_cases"
  | "unverified_external_assumptions"
  | "conflicting_constraints";

export type PlanIssueSeverity = "low" | "medium" | "high" | "critical";

export type EscalationDecision =
  | "AUTO_PROCEED"
  | "AUTO_SPIKE"
  | "ESCALATE_HUMAN";

export interface PlanIssue {
  category: PlanIssueCategory;
  severity: PlanIssueSeverity;
  message: string;
  escalation: EscalationDecision;
}

export interface PlanAuditResult {
  passed: boolean;
  score: number;
  issues: PlanIssue[];
  escalationDecision: EscalationDecision;
}

const SEVERITY_PENALTY: Record<PlanIssueSeverity, number> = {
  low: 5,
  medium: 15,
  high: 25,
  critical: 40,
};

const VAGUE_ADJECTIVES_RE =
  /\b(fast|clean|scalable|robust|seamless|user-friendly|minimal|reasonable|appropriate|high[- ]performance|better)\b/gi;
const METRIC_UNIT_RE =
  /\b\d+(?:\.\d+)?\s*(?:ms|s|sec|seconds|min|minutes|%|mb|kb|gb|px|rps|req\/s|fps|hz|items|rows|retries|users)\b/i;

function resolvePlanContent(planPathOrContent: string, rootDir: string): string {
  const candidate = path.isAbsolute(planPathOrContent)
    ? planPathOrContent
    : path.resolve(rootDir, planPathOrContent);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return fs.readFileSync(candidate, "utf8");
  }
  return planPathOrContent;
}

function checkUnderspecifiedInputs(content: string): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const hasReqId = /\bREQ-[A-Z0-9-]+\b/i.test(content);
  const hasAcceptanceCriteria =
    /(?:acceptance criteria|\bAC-\d+\b|\bgiven\b.*\bwhen\b.*\bthen\b)/is.test(
      content,
    );

  if (!hasReqId || !hasAcceptanceCriteria) {
    const missing = [
      !hasReqId ? "REQ-* requirement IDs" : null,
      !hasAcceptanceCriteria ? "acceptance criteria" : null,
    ]
      .filter(Boolean)
      .join(" and ");
    issues.push({
      category: "underspecified_inputs",
      severity: "high",
      message: `Plan is missing ${missing}.`,
      escalation: "ESCALATE_HUMAN",
    });
  }

  const vagueTerms = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    if (METRIC_UNIT_RE.test(line)) {
      continue;
    }
    const matches = line.match(VAGUE_ADJECTIVES_RE);
    if (matches) {
      for (const m of matches) {
        vagueTerms.add(m.toLowerCase());
      }
    }
  }

  if (vagueTerms.size > 0) {
    const list = Array.from(vagueTerms).sort().join(", ");
    issues.push({
      category: "underspecified_inputs",
      severity: "medium",
      message: `Unbounded qualitative terms without measurable metrics: ${list}.`,
      escalation: "ESCALATE_HUMAN",
    });
  }

  return issues;
}

function checkMissingEdgeCases(content: string): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const mentionsStatefulOrNetwork =
    /\b(auth|session|login|sign[- ]?in|token|state|form|api|network|async|sync|persist|upload|payment)\b/i.test(
      content,
    );

  if (!mentionsStatefulOrNetwork) {
    return issues;
  }

  const mentionsErrorOrDirty =
    /\b(error|fail(?:ed|ure)?|retry|timeout|offline|dirty|invalid|fallback|rollback|4xx|5xx|unauthorized|expired|edge[- ]?case)\b/i.test(
      content,
    );
  if (!mentionsErrorOrDirty) {
    issues.push({
      category: "missing_edge_cases",
      severity: "high",
      message:
        "Plan involves stateful/network/auth flows but does not specify error, dirty, timeout, or retry edge cases.",
      escalation: "AUTO_SPIKE",
    });
  }

  const mentionsAuthOrSession =
    /\b(auth|session|login|sign[- ]?in|token|cookie|keychain)\b/i.test(content);
  const mentionsPersistence =
    /\b(persist(?:ence|ed|s)?|background|relaunch|restart|resume|refresh|expiration|revoke)\b/i.test(
      content,
    );
  if (mentionsAuthOrSession && !mentionsPersistence) {
    issues.push({
      category: "missing_edge_cases",
      severity: "medium",
      message:
        "Plan touches auth/session flows without specifying session persistence across background/relaunch or token expiration.",
      escalation: "AUTO_SPIKE",
    });
  }

  return issues;
}

function checkUnverifiedExternalAssumptions(content: string): PlanIssue[] {
  const externalMatches = content.match(
    /\b(oauth|oidc|saml|firebase|stripe|supabase|auth0|musickit|youtube|spotify|openai|gemini|anthropic|twilio|sendgrid|webhook|third[- ]party\s+(?:sdk|api|service)|external\s+(?:api|sdk|auth))\b/gi,
  );
  if (!externalMatches) {
    return [];
  }

  const hasVerificationNote =
    /\b(spike|verif(?:y|ied|ication)|poc|proof[- ]of[- ]concept|tested|confirmed|benchmark(?:ed)?|adr-\d+)\b/i.test(
      content,
    );
  if (hasVerificationNote) {
    return [];
  }

  const deps = Array.from(
    new Set(externalMatches.map((m) => m.toLowerCase())),
  )
    .sort()
    .join(", ");
  return [
    {
      category: "unverified_external_assumptions",
      severity: "high",
      message: `External SDK/API/auth assumptions (${deps}) lack a spike or verification note.`,
      escalation: "AUTO_SPIKE",
    },
  ];
}

function readExcludedProjects(rootDir: string): string[] {
  const ciProjectsPath = path.join(rootDir, ".github", "ci-projects.json");
  if (!fs.existsSync(ciProjectsPath)) {
    return [];
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(ciProjectsPath, "utf8")) as {
      exclude?: unknown;
    };
    return Array.isArray(parsed.exclude)
      ? parsed.exclude.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function checkConflictingConstraints(
  content: string,
  rootDir: string,
): PlanIssue[] {
  const issues: PlanIssue[] = [];

  for (const excluded of readExcludedProjects(rootDir)) {
    if (content.includes(excluded)) {
      const acknowledgesExclusion =
        /\b(exclud(?:e|ed)|experimental|out[- ]of[- ]scope|do not (?:touch|modify|include))\b/i.test(
          content,
        );
      if (!acknowledgesExclusion) {
        issues.push({
          category: "conflicting_constraints",
          severity: "critical",
          message: `Plan targets excluded project "${excluded}" from .github/ci-projects.json without acknowledging its exclusion.`,
          escalation: "ESCALATE_HUMAN",
        });
      }
    }
  }

  if (/(--no-verify|LEFTHOOK=0|skip\s+gate\s*1|bypass\s+ci\s+gate)/i.test(content)) {
    issues.push({
      category: "conflicting_constraints",
      severity: "critical",
      message:
        "Plan proposes bypassing git hooks or Gate 1 CI validation, violating AGENTS.md.",
      escalation: "ESCALATE_HUMAN",
    });
  }

  return issues;
}

function resolveEscalationDecision(issues: PlanIssue[]): EscalationDecision {
  if (issues.some((i) => i.escalation === "ESCALATE_HUMAN")) {
    return "ESCALATE_HUMAN";
  }
  if (issues.some((i) => i.escalation === "AUTO_SPIKE")) {
    return "AUTO_SPIKE";
  }
  return "AUTO_PROCEED";
}

/**
 * Audits a plan file or markdown string for underspecified inputs, missing edge
 * cases, unverified external assumptions, and repo constraint conflicts.
 */
export function auditPlan(
  planPathOrContent: string,
  rootDir = process.cwd(),
): PlanAuditResult {
  const content = resolvePlanContent(planPathOrContent, rootDir);
  const issues: PlanIssue[] = [
    ...checkUnderspecifiedInputs(content),
    ...checkMissingEdgeCases(content),
    ...checkUnverifiedExternalAssumptions(content),
    ...checkConflictingConstraints(content, rootDir),
  ];

  const penalty = issues.reduce(
    (sum, issue) => sum + SEVERITY_PENALTY[issue.severity],
    0,
  );
  const score = Math.max(0, 100 - penalty);
  const escalationDecision = resolveEscalationDecision(issues);
  const passed = escalationDecision === "AUTO_PROCEED" && score >= 80;

  return {
    passed,
    score,
    issues,
    escalationDecision,
  };
}
