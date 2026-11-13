import {
  auditThemePalette,
  createZeroPiiBreadcrumb,
  evaluateScarcityGate,
  formatWorkspaceBanner,
  hello,
  scrubSensitiveText,
  type PinDecision,
  type ThemePaletteAuditResult,
  type ZeroPiiBreadcrumb,
} from "@cmp/utils";

export const getWebAppGreeting = (): string => {
  return formatWorkspaceBanner("@cmp/web", hello());
};

export interface WebSliceHealthReport {
  passed: boolean;
  greeting: string;
  wcagAudit: ThemePaletteAuditResult;
  scarcityGate: {
    allowPin: PinDecision;
    unpin: PinDecision;
    swapRequired: PinDecision;
  };
  telemetry: {
    scrubbedSample: string;
    breadcrumb: ZeroPiiBreadcrumb;
  };
}

const DEFAULT_WEB_THEME_PAIRS = [
  { pairName: "light-surface-primary-text", fg: "#0F172A", bg: "#FFFFFF" },
  { pairName: "light-surface-secondary-text", fg: "#475569", bg: "#F8FAFC" },
  { pairName: "light-primary-action-button", fg: "#FFFFFF", bg: "#1D4ED8" },
  { pairName: "dark-surface-primary-text", fg: "#F8FAFC", bg: "#0F172A" },
  { pairName: "dark-surface-secondary-text", fg: "#CBD5E1", bg: "#1E293B" },
] as const;

/**
 * Pure functional product slice health check verifying WCAG 2.2 AA contrast,
 * Top-3 scarcity gating, and Zero-PII telemetry invariants via `@cmp/utils`.
 */
export function runWebSliceHealthCheck(): WebSliceHealthReport {
  const greeting = hello();
  const wcagAudit = auditThemePalette(DEFAULT_WEB_THEME_PAIRS);

  const scarcityGate = {
    allowPin: evaluateScarcityGate(["focus-1", "focus-2"], "focus-3", 3),
    unpin: evaluateScarcityGate(["focus-1", "focus-2"], "focus-1", 3),
    swapRequired: evaluateScarcityGate(
      ["focus-1", "focus-2", "focus-3"],
      "focus-4",
      3,
    ),
  };

  const scrubbedSample = scrubSensitiveText(
    "Web slice sync for founder@example.com with Bearer ya29.A0ARrdaM_web_secret",
  );
  const breadcrumb = createZeroPiiBreadcrumb("web_slice_health_check", {
    actor: "founder@example.com",
    token: "Bearer ya29.A0ARrdaM_web_secret",
    slice: "focus-horizon",
  });

  const zeroPiiPassed =
    !scrubbedSample.includes("founder@example.com") &&
    !scrubbedSample.includes("ya29.") &&
    !breadcrumb.summary.includes("founder@example.com") &&
    !breadcrumb.summary.includes("ya29.");

  const scarcityPassed =
    scarcityGate.allowPin === "ALLOW_PIN" &&
    scarcityGate.unpin === "UNPIN" &&
    scarcityGate.swapRequired === "SWAP_REQUIRED";

  return {
    passed: wcagAudit.passed && zeroPiiPassed && scarcityPassed,
    greeting,
    wcagAudit,
    scarcityGate,
    telemetry: {
      scrubbedSample,
      breadcrumb,
    },
  };
}
