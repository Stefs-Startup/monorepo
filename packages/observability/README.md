# `@cmp/observability`

Zero-PII production observability baseline (`STE-37` / [`RFC-0004`](../../docs/rfcs/0004-zero-pii-production-observability-and-slos.md)): deterministic PII redaction, pseudonymized user IDs, W3C `traceparent` propagation, structured JSON logging, RED metrics, error hooks, and SLO error-budget evaluation.

## Usage

```ts
import {
  createObservabilityClient,
  createTraceContext,
  evaluateSloWindow,
} from "@cmp/observability";

const obs = createObservabilityClient({ service: "pulse-web" });
const trace = createTraceContext();

obs.log("info", "task.triage", "Triaged task for user@example.com", {
  traceId: trace.traceId,
  spanId: trace.spanId,
  userId: "user@example.com",
  attributes: { action: "PIN_TOP_3" },
});
```

## Development

```bash
pnpm --filter @cmp/observability lint
pnpm --filter @cmp/observability typecheck
pnpm --filter @cmp/observability build
pnpm --filter @cmp/observability test
```
