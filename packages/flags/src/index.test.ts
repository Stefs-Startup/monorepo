import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createObservabilityClient,
  pseudonymizeIdentifier,
  type StructuredLogEntry,
} from "@cmp/observability";
import {
  computeDeterministicBucket,
  createFlagsClient,
} from "./index.js";

describe("@cmp/flags (STE-57)", () => {
  it("enforces emergency kill switches over overrides, allowlists, and percentage rollouts", () => {
    const client = createFlagsClient({
      overrides: { "pulse.live-stream": true },
      flags: [
        {
          key: "pulse.live-stream",
          description: "Emergency disabled feature",
          defaultEnabled: true,
          killSwitch: true,
          rolloutPercentage: 100,
        },
      ],
    });

    const res = client.evaluateFlag("pulse.live-stream", {
      userId: "alice@example.com",
    });
    assert.equal(res.enabled, false);
    assert.equal(res.reason, "KILL_SWITCH");
  });

  it("evaluates deterministic per-user percentage rollouts sticky by pseudonymized user ID", () => {
    const client = createFlagsClient({
      flags: [
        {
          key: "pulse-coach",
          description: "50% rollout feature",
          defaultEnabled: false,
          rolloutPercentage: 50,
        },
      ],
    });

    const first = client.evaluateFlag("pulse-coach", {
      userId: "Alice@Example.com",
    });
    const second = client.evaluateFlag("pulse-coach", {
      userId: "alice@example.com ",
    });

    assert.deepEqual(first, second);
    assert.equal(first.reason, "PERCENTAGE_ROLLOUT");

    let enabledCount = 0;
    for (let i = 0; i < 200; i++) {
      if (
        client.isEnabled("pulse-coach", {
          userId: `user-${i}@example.com`,
        })
      ) {
        enabledCount += 1;
      }
    }
    assert.ok(
      enabledCount >= 70 && enabledCount <= 130,
      `Expected ~50% enabled across 200 users, got ${enabledCount}`,
    );
  });

  it("supports local overrides and pseudonymized user allowlists", () => {
    const allowedDigest = pseudonymizeIdentifier("vip@example.com");
    const client = createFlagsClient({
      overrides: { "pulse.override-flag": true },
      flags: [
        {
          key: "pulse.vip-only",
          description: "Allowlist feature",
          defaultEnabled: false,
          rolloutPercentage: 0,
          allowlistPseudonymizedUsers: [allowedDigest],
        },
      ],
    });

    const vipEval = client.evaluateFlag("pulse.vip-only", {
      userId: "vip@example.com",
    });
    assert.equal(vipEval.enabled, true);
    assert.equal(vipEval.reason, "ALLOWLIST");

    const regularEval = client.evaluateFlag("pulse.vip-only", {
      userId: "other@example.com",
    });
    assert.equal(regularEval.enabled, false);
    assert.equal(regularEval.reason, "PERCENTAGE_ROLLOUT");

    const overrideEval = client.evaluateFlag("pulse.override-flag");
    assert.equal(overrideEval.enabled, true);
    assert.equal(overrideEval.reason, "LOCAL_OVERRIDE");
  });

  it("assigns deterministic experiment variants and emits zero-PII exposure and outcome logs via @cmp/observability", () => {
    const logs: StructuredLogEntry[] = [];
    const obs = createObservabilityClient({
      service: "pulse-web",
      sink: { onLog: (e) => logs.push(e) },
    });

    const client = createFlagsClient({
      observability: obs,
      experiments: [
        {
          key: "exp-micro-copy",
          description: "Test micro-starter button copy",
          controlVariant: "control",
          variants: [
            { name: "control", weight: 50 },
            { name: "action_oriented", weight: 50 },
          ],
        },
      ],
    });

    const assignment = client.assignExperiment("exp-micro-copy", {
      userId: "founder@company.com",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    });
    assert.ok(
      assignment.variant === "control" ||
        assignment.variant === "action_oriented",
    );
    assert.equal(
      assignment.bucket,
      computeDeterministicBucket("exp-micro-copy", "founder@company.com")
        .bucket,
    );

    const outcomeEntry = client.recordOutcome({
      experimentKey: "exp-micro-copy",
      variant: assignment.variant,
      metricName: "triage.completed",
      value: 1,
      userId: "founder@company.com",
      attributes: { userEmail: "founder@company.com" },
    });

    assert.ok(outcomeEntry !== null);
    assert.equal(logs.length, 2);
    assert.equal(logs[0].event, "experiment.exposure");
    assert.equal(logs[1].event, "experiment.outcome");

    const serializedLogs = JSON.stringify(logs);
    assert.equal(serializedLogs.includes("founder@company.com"), false);
    assert.ok(
      serializedLogs.includes(pseudonymizeIdentifier("founder@company.com")),
    );
  });
});
