import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { auditPlan, type EscalationDecision } from "../plan-critic.js";

interface GoldenPlanCase {
  id: string;
  description: string;
  plan: string;
  expectedDecision: EscalationDecision;
  expectedPassed: boolean;
  expectedCategories?: string[];
  setupRoot?: (rootDir: string) => void;
}

const GOLDEN_DATASET: GoldenPlanCase[] = [
  {
    id: "GC-01-well-specified",
    description: "Well-specified plan with REQ-*, AC, and measurable bounds",
    plan: [
      "# Plan: Focus Session Timer",
      "- Requirement: REQ-PULSE-101",
      "- Acceptance Criteria: AC-1 Given an active timer, when 25 minutes elapse, then emit a completion event within 150 ms.",
      "- Persistence & Error Handling: Persist session state to local storage across relaunch; on write failure, retry 3 times with fallback.",
    ].join("\n"),
    expectedDecision: "AUTO_PROCEED",
    expectedPassed: true,
  },
  {
    id: "GC-02-missing-req",
    description: "Missing REQ-* identifier triggers ESCALATE_HUMAN",
    plan: [
      "# Plan: Export CSV",
      "- Acceptance Criteria: AC-1 Export completes in 500 ms for 1000 rows.",
    ].join("\n"),
    expectedDecision: "ESCALATE_HUMAN",
    expectedPassed: false,
    expectedCategories: ["underspecified_inputs"],
  },
  {
    id: "GC-03-unverified-external-sdk",
    description: "Unverified external SDK (Stripe) without spike triggers AUTO_SPIKE",
    plan: [
      "# Plan: Billing Checkout",
      "- Requirement: REQ-BILL-001",
      "- Acceptance Criteria: AC-1 Charge succeeds within 800 ms.",
      "- Integration: Integrate Stripe checkout session API.",
      "- Error & Persistence: On timeout or 5xx failure, retry 2 times and persist pending order state across relaunch.",
    ].join("\n"),
    expectedDecision: "AUTO_SPIKE",
    expectedPassed: false,
    expectedCategories: ["unverified_external_assumptions"],
  },
  {
    id: "GC-04-excluded-project-conflict",
    description: "Targeting excluded project from ci-projects.json triggers ESCALATE_HUMAN",
    plan: [
      "# Plan: Backstage Plugin",
      "- Requirement: REQ-INFRA-004",
      "- Acceptance Criteria: AC-1 Render service catalog in apps/backstage within 300 ms.",
    ].join("\n"),
    expectedDecision: "ESCALATE_HUMAN",
    expectedPassed: false,
    expectedCategories: ["conflicting_constraints"],
    setupRoot: (rootDir) => {
      const ghDir = path.join(rootDir, ".github");
      fs.mkdirSync(ghDir, { recursive: true });
      fs.writeFileSync(
        path.join(ghDir, "ci-projects.json"),
        JSON.stringify({ exclude: ["apps/backstage"] }),
        "utf8",
      );
    },
  },
  {
    id: "GC-05-vague-bounds",
    description: "Vague qualitative bounds without measurable metrics trigger ESCALATE_HUMAN",
    plan: [
      "# Plan: Dashboard Refresh",
      "- Requirement: REQ-WEB-010",
      "- Acceptance Criteria: AC-1 Dashboard must be fast, scalable, and seamless.",
    ].join("\n"),
    expectedDecision: "ESCALATE_HUMAN",
    expectedPassed: false,
    expectedCategories: ["underspecified_inputs"],
  },
  {
    id: "GC-06-missing-edge-cases",
    description: "Stateful auth/network flow missing error/timeout/persistence edge cases triggers AUTO_SPIKE",
    plan: [
      "# Plan: Session Sync",
      "- Requirement: REQ-AUTH-002",
      "- Acceptance Criteria: AC-1 Sync user session token via API within 250 ms.",
    ].join("\n"),
    expectedDecision: "AUTO_SPIKE",
    expectedPassed: false,
    expectedCategories: ["missing_edge_cases"],
  },
  {
    id: "GC-07-bypass-git-hooks",
    description: "Proposing --no-verify / LEFTHOOK=0 triggers ESCALATE_HUMAN",
    plan: [
      "# Plan: Quick Hotfix",
      "- Requirement: REQ-OPS-009",
      "- Acceptance Criteria: AC-1 Land patch in 10 minutes using git push --no-verify.",
    ].join("\n"),
    expectedDecision: "ESCALATE_HUMAN",
    expectedPassed: false,
    expectedCategories: ["conflicting_constraints"],
  },
  {
    id: "GC-08-verified-external-sdk",
    description: "Verified external SDK with spike/ADR and edge cases proceeds",
    plan: [
      "# Plan: MusicKit Now Playing",
      "- Requirement: REQ-YTM-005",
      "- Acceptance Criteria: AC-1 Poll track metadata every 5 seconds with 100 ms budget.",
      "- External SDK: MusicKit integration verified in ADR-002 spike.",
      "- Edge Cases: On API timeout or invalid response, retry with fallback cache.",
    ].join("\n"),
    expectedDecision: "AUTO_PROCEED",
    expectedPassed: true,
  },
];

test("plan-critic golden dataset achieves 100% precision and recall on escalation decisions", () => {
  const decisions: EscalationDecision[] = [
    "AUTO_PROCEED",
    "AUTO_SPIKE",
    "ESCALATE_HUMAN",
  ];
  const results: Array<{
    id: string;
    expected: EscalationDecision;
    actual: EscalationDecision;
  }> = [];

  for (const gc of GOLDEN_DATASET) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-eval-"));
    try {
      gc.setupRoot?.(tmpDir);
      const audit = auditPlan(gc.plan, tmpDir);
      results.push({
        id: gc.id,
        expected: gc.expectedDecision,
        actual: audit.escalationDecision,
      });

      assert.equal(
        audit.escalationDecision,
        gc.expectedDecision,
        `${gc.id} (${gc.description}): expected ${gc.expectedDecision}, got ${audit.escalationDecision}`,
      );
      assert.equal(
        audit.passed,
        gc.expectedPassed,
        `${gc.id}: expected passed=${gc.expectedPassed}, got ${audit.passed}`,
      );

      if (gc.expectedCategories) {
        const actualCategories = new Set(audit.issues.map((i) => i.category));
        for (const cat of gc.expectedCategories) {
          assert.equal(
            actualCategories.has(cat as never),
            true,
            `${gc.id}: expected issue category "${cat}"`,
          );
        }
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  for (const decision of decisions) {
    const tp = results.filter(
      (r) => r.expected === decision && r.actual === decision,
    ).length;
    const fp = results.filter(
      (r) => r.expected !== decision && r.actual === decision,
    ).length;
    const fn = results.filter(
      (r) => r.expected === decision && r.actual !== decision,
    ).length;

    const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
    assert.equal(precision, 1, `Precision for ${decision} must be 1.0`);
    assert.equal(recall, 1, `Recall for ${decision} must be 1.0`);
  }
});
