import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createObservabilityClient,
  createTraceContext,
  evaluateSloWindow,
  formatTraceparent,
  parseTraceparent,
  pseudonymizeIdentifier,
  scrubAttributes,
  scrubHeaders,
  scrubSensitiveText,
  type ErrorReportEntry,
  type RedMetricSample,
  type StructuredLogEntry,
} from "./index.js";

describe("@cmp/observability (STE-37 / RFC-0004)", () => {
  it("redacts emails, Bearer/OAuth tokens, JWTs, and sensitive query parameters", () => {
    const fakeJwt = [
      "eyJhbGciOiJIUzI1NiJ9",
      "eyJzdWIiOiIxMjM0NTY3ODkwIn0",
      "c2lnbmF0dXJl123",
    ].join(".");
    const fakeOauth = ["ya29", "a0AfH6SMB_secret"].join(".");
    const raw = `User alice.smith@example.com called /api/v1/pulse?access_token=sec123&mode=fast with Bearer ${fakeJwt} and ${fakeOauth}`;
    const scrubbed = scrubSensitiveText(raw);

    assert.equal(scrubbed.includes("alice.smith@example.com"), false);
    assert.equal(scrubbed.includes("sec123"), false);
    assert.equal(scrubbed.includes(fakeOauth), false);
    assert.ok(scrubbed.includes("[REDACTED_EMAIL]"));
    assert.ok(scrubbed.includes("access_token=[REDACTED_PARAM]"));
    assert.ok(scrubbed.includes("[REDACTED_TOKEN]"));
  });

  it("scrubs sensitive HTTP headers and attribute bags at the telemetry boundary", () => {
    const headers = scrubHeaders({
      Authorization: "Bearer super-secret-token",
      Cookie: "session=xyz",
      "X-Trace-User": "bob@company.org",
      Accept: "application/json",
    });

    assert.equal(headers.Authorization, "[REDACTED_HEADER]");
    assert.equal(headers.Cookie, "[REDACTED_HEADER]");
    assert.equal(headers["X-Trace-User"], "[REDACTED_EMAIL]");
    assert.equal(headers.Accept, "application/json");

    const attrs = scrubAttributes({
      email: "bob@company.org",
      token: "abc",
      taskId: "task-tax-receipts",
      note: "Contact carol@company.org",
      durationMs: 42,
      cached: true,
    });
    assert.equal(attrs.email, "[REDACTED]");
    assert.equal(attrs.token, "[REDACTED]");
    assert.equal(attrs.taskId, "task-tax-receipts");
    assert.equal(attrs.note, "Contact [REDACTED_EMAIL]");
    assert.equal(attrs.durationMs, 42);
    assert.equal(attrs.cached, true);
  });

  it("deterministically pseudonymizes user identifiers into 16-hex digests", () => {
    assert.equal(pseudonymizeIdentifier(""), "anonymous");
    assert.equal(pseudonymizeIdentifier("   "), "anonymous");
    assert.equal(pseudonymizeIdentifier(null), "anonymous");

    const idA = pseudonymizeIdentifier("Alice@Example.com ");
    const idB = pseudonymizeIdentifier("alice@example.com");
    assert.equal(idA, idB);
    assert.match(idA, /^[0-9a-f]{16}$/);
  });

  it("creates, formats, and parses W3C traceparent headers", () => {
    const generated = createTraceContext({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      sampled: true,
    });
    assert.equal(
      generated.traceparent,
      "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    );

    const parsed = parseTraceparent(generated.traceparent);
    assert.deepEqual(parsed, generated);
    assert.equal(parseTraceparent("invalid-header"), null);
    assert.equal(
      parseTraceparent(
        "00-00000000000000000000000000000000-00f067aa0ba902b7-01",
      ),
      null,
    );
    assert.throws(() =>
      formatTraceparent({ traceId: "short", spanId: "00f067aa0ba902b7", sampled: false }),
    );
  });

  it("emits scrubbed structured logs, RED metrics, and error reports through sinks", () => {
    const logs: StructuredLogEntry[] = [];
    const metrics: RedMetricSample[] = [];
    const errors: ErrorReportEntry[] = [];
    const fixedDate = new Date("2026-11-20T12:00:00.000Z");

    const client = createObservabilityClient({
      service: "pulse-backend",
      now: () => fixedDate,
      sink: {
        onLog: (e) => logs.push(e),
        onMetric: (m) => metrics.push(m),
        onError: (err) => errors.push(err),
      },
    });

    const logEntry = client.log(
      "info",
      "pulse.triage",
      "Triaged by user@example.com",
      {
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        spanId: "00f067aa0ba902b7",
        userId: "user@example.com",
        attributes: { action: "PIN_TOP_3", secret: "do-not-leak" },
      },
    );

    assert.equal(logs.length, 1);
    assert.equal(logEntry.message, "Triaged by [REDACTED_EMAIL]");
    assert.equal(
      logEntry.pseudonymizedUserId,
      pseudonymizeIdentifier("user@example.com"),
    );
    assert.equal(logEntry.attributes.secret, "[REDACTED]");

    const sample = client.recordRequestMetric({
      route: "/api/v1/pulse/state?token=secret123",
      method: "get",
      statusCode: 200,
      durationMs: 84.3,
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    });
    assert.equal(metrics.length, 1);
    assert.equal(sample.route, "/api/v1/pulse/state?token=[REDACTED_PARAM]");
    assert.equal(sample.isError, false);

    const errReport = client.captureError(
      new Error("OAuth failed for user@example.com with Bearer secretToken99"),
      { userId: "user@example.com" },
    );
    assert.equal(errors.length, 1);
    assert.equal(
      errReport.message,
      "OAuth failed for [REDACTED_EMAIL] with [REDACTED_TOKEN]",
    );
  });

  it("evaluates RFC-0004 SLO availability, latency percentiles, and remaining error budget", () => {
    const samples: RedMetricSample[] = Array.from({ length: 200 }, (_, i) => ({
      timestampIso: "2026-11-20T12:00:00.000Z",
      service: "pulse-backend",
      route: "/api/v1/pulse/state",
      method: "GET",
      statusCode: i === 0 ? 503 : 200,
      durationMs: i === 0 ? 450 : 120,
      isError: i === 0,
    }));

    const passingEval = evaluateSloWindow(samples, {
      targetAvailability: 0.995,
      targetLatencyMs: 300,
      targetLatencyRatio: 0.995,
    });
    assert.equal(passingEval.totalRequests, 200);
    assert.equal(passingEval.availabilityRatio, 0.995);
    assert.equal(passingEval.latencyTargetRatio, 0.995);
    assert.equal(passingEval.passesSlo, true);
    assert.equal(passingEval.errorBudgetRemainingRatio, 0);
  });
});
