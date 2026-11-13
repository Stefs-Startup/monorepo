import assert from "node:assert/strict";
import test from "node:test";
import { runWebSliceHealthCheck } from "./index.js";

test("runWebSliceHealthCheck passes WCAG 2.2 AA contrast and Zero-PII telemetry invariants", () => {
  const report = runWebSliceHealthCheck();

  assert.equal(report.passed, true);
  assert.equal(report.greeting, "world");

  assert.equal(report.wcagAudit.passed, true);
  assert.ok(report.wcagAudit.entries.length >= 5);
  for (const entry of report.wcagAudit.entries) {
    assert.equal(entry.passesWcagAA, true, `${entry.pairName} failed WCAG AA`);
    assert.ok(
      entry.contrastRatio >= entry.minimumRequired,
      `${entry.pairName} contrast ${entry.contrastRatio} < ${entry.minimumRequired}`,
    );
  }

  assert.equal(report.scarcityGate.allowPin, "ALLOW_PIN");
  assert.equal(report.scarcityGate.unpin, "UNPIN");
  assert.equal(report.scarcityGate.swapRequired, "SWAP_REQUIRED");

  assert.equal(
    report.telemetry.scrubbedSample,
    "Web slice sync for [REDACTED_EMAIL] with [REDACTED_TOKEN]",
  );
  assert.equal(report.telemetry.breadcrumb.event, "web_slice_health_check");
  assert.ok(!report.telemetry.breadcrumb.summary.includes("@"));
  assert.ok(!report.telemetry.breadcrumb.summary.includes("ya29."));
  assert.ok(report.telemetry.breadcrumb.summary.includes("[REDACTED_EMAIL]"));
  assert.ok(report.telemetry.breadcrumb.summary.includes("[REDACTED_TOKEN]"));
});
