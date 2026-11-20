import * as fs from "node:fs";
import * as path from "node:path";
import { auditPlan, type PlanIssue } from "./plan-critic.js";

export const REQUIRED_AGENT_READY_SECTIONS = [
  "Context",
  "Constraints",
  "Acceptance criteria",
  "Out of scope",
] as const;

export type AgentReadySectionName =
  (typeof REQUIRED_AGENT_READY_SECTIONS)[number];

export type SpecValidationErrorCode =
  | "missing_section"
  | "placeholder_or_empty_section"
  | "unverifiable_acceptance_criteria"
  | "plan_critic_conflict";

export interface SpecValidationError {
  code: SpecValidationErrorCode;
  section?: AgentReadySectionName;
  message: string;
}

export interface AgentReadySpecResult {
  passed: boolean;
  sectionsPresent: AgentReadySectionName[];
  missingSections: AgentReadySectionName[];
  errors: SpecValidationError[];
  criticWarnings: PlanIssue[];
}

const HEADING_RE = /^#{2,3}\s+(.+?)\s*$/;
const FENCE_RE = /^```/;
const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const HR_LINE_RE = /^\s*[-*_]{3,}\s*$/;
const EMPTY_BULLET_RE = /^\s*(?:[-*]|\d+\.)\s*(?:\[[ xX]\]\s*)?$/;
const PLACEHOLDER_ONLY_RE =
  /^(?:tbd|todo|fixme|n\/a|placeholder|\.{2,}|<[^>\n]{1,80}>)$/i;
const BULLET_LINE_RE = /^\s*(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s*)?(.+)$/;
const VERIFIABLE_CRITERIA_RE =
  /(`[^`]+`|\b(?:test|tests|spec|specs|assert|exit\s+code|exit\s+[01]|return(?:s|ing)?|pass(?:es|ing)?|fail(?:s|ing)?|run|check|verify|verified|validat(?:e|ed|es)|green|ci|stdout|stderr|json|http\s+\d{3}|\d+(?:\.\d+)?%|\d+\s*(?:ms|s|sec|seconds|days))\b)/i;

const SECTION_LOOKUP = new Map<string, AgentReadySectionName>(
  REQUIRED_AGENT_READY_SECTIONS.map((name) => [name.toLowerCase(), name]),
);

function resolveMarkdownContent(
  markdownOrPath: string,
  rootDir: string,
): string {
  if (!markdownOrPath.includes("\n")) {
    const candidate = path.isAbsolute(markdownOrPath)
      ? markdownOrPath
      : path.resolve(rootDir, markdownOrPath);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return fs.readFileSync(candidate, "utf8");
    }
  }
  return markdownOrPath;
}

function normalizeHeadingName(rawHeading: string): string {
  return rawHeading.replace(/[:\s#]+$/g, "").trim().toLowerCase();
}

function parseSections(
  markdown: string,
): Map<AgentReadySectionName, string> {
  const sections = new Map<AgentReadySectionName, string>();
  let activeSection: AgentReadySectionName | null = null;
  let buffer: string[] = [];
  let inCodeFence = false;

  const flush = (): void => {
    if (activeSection) {
      const existing = sections.get(activeSection);
      const nextBody = buffer.join("\n").trim();
      sections.set(
        activeSection,
        existing ? `${existing}\n${nextBody}`.trim() : nextBody,
      );
    }
    buffer = [];
  };

  for (const line of markdown.split(/\r?\n/)) {
    if (FENCE_RE.test(line.trim())) {
      inCodeFence = !inCodeFence;
      if (activeSection) {
        buffer.push(line);
      }
      continue;
    }

    if (!inCodeFence) {
      const headingMatch = line.match(HEADING_RE);
      if (headingMatch?.[1]) {
        flush();
        const canonical = SECTION_LOOKUP.get(
          normalizeHeadingName(headingMatch[1]),
        );
        activeSection = canonical ?? null;
        continue;
      }
    }

    if (activeSection) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

function stripBoilerplate(rawBody: string): string {
  const withoutComments = rawBody.replace(HTML_COMMENT_RE, "");
  const meaningfulLines = withoutComments
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !HR_LINE_RE.test(line) &&
        !EMPTY_BULLET_RE.test(line),
    );
  return meaningfulLines.join("\n").trim();
}

function hasVerifiableAcceptanceCriterion(rawBody: string): boolean {
  const cleaned = stripBoilerplate(rawBody);
  if (!cleaned) {
    return false;
  }

  const lines = cleaned.split(/\r?\n/);
  const bulletTexts = lines
    .map((line) => line.match(BULLET_LINE_RE)?.[1]?.trim())
    .filter((item): item is string => Boolean(item && item.length > 0));

  const candidates = bulletTexts.length > 0 ? bulletTexts : lines;
  return candidates.some(
    (entry) =>
      !PLACEHOLDER_ONLY_RE.test(entry) && VERIFIABLE_CRITERIA_RE.test(entry),
  );
}

/**
 * Validates a Markdown issue specification against the 4-section Linear
 * `agent-ready` format (`Context`, `Constraints`, `Acceptance criteria`,
 * `Out of scope`) and integrates constraint/edge checks from `auditPlan`.
 */
export function validateAgentReadySpec(
  markdownOrPath: string,
  rootDir: string = process.cwd(),
): AgentReadySpecResult {
  const markdown = resolveMarkdownContent(markdownOrPath, rootDir);
  const parsed = parseSections(markdown);

  const sectionsPresent: AgentReadySectionName[] = [];
  const missingSections: AgentReadySectionName[] = [];
  const errors: SpecValidationError[] = [];

  for (const section of REQUIRED_AGENT_READY_SECTIONS) {
    const rawBody = parsed.get(section);
    if (rawBody === undefined) {
      missingSections.push(section);
      errors.push({
        code: "missing_section",
        section,
        message: `Missing required section '## ${section}'.`,
      });
      continue;
    }

    sectionsPresent.push(section);
    const cleaned = stripBoilerplate(rawBody);
    if (!cleaned || PLACEHOLDER_ONLY_RE.test(cleaned)) {
      errors.push({
        code: "placeholder_or_empty_section",
        section,
        message: `Section '## ${section}' is empty or contains only placeholder text.`,
      });
      continue;
    }

    if (
      section === "Acceptance criteria" &&
      !hasVerifiableAcceptanceCriterion(rawBody)
    ) {
      errors.push({
        code: "unverifiable_acceptance_criteria",
        section,
        message:
          "Section '## Acceptance criteria' must include at least one bullet verifiable by a concrete test or command.",
      });
    }
  }

  const criticReport = auditPlan(markdown, rootDir);
  const criticWarnings: PlanIssue[] = [];
  const hasAcceptanceSection = parsed.has("Acceptance criteria");

  for (const issue of criticReport.issues) {
    if (issue.category === "conflicting_constraints") {
      errors.push({
        code: "plan_critic_conflict",
        section: "Constraints",
        message: issue.message,
      });
      continue;
    }

    if (
      hasAcceptanceSection &&
      issue.category === "underspecified_inputs" &&
      issue.message.includes("REQ-*")
    ) {
      continue;
    }

    criticWarnings.push(issue);
  }

  return {
    passed: errors.length === 0,
    sectionsPresent,
    missingSections,
    errors,
    criticWarnings,
  };
}
