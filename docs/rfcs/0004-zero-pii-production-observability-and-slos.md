# RFC-0004: Zero-PII Production Observability (OpenTelemetry & SLOs)

- **Status:** `Exploring`
- **Date:** 2026-11-19
- **Author:** Stefan + Antigravity
- **Related:** `packages/utils/`, `docs/stack-best-practices/`, `apps/pulse/`

---

## 1. What It Is (Mental Model)

Answering *"what broke, for how many users, and which exact SQL/HTTP call was slow?"* in **under 30 seconds** in production — using **OpenTelemetry (OTel)** traces, structured JSON logs, and simple **SLOs**, while strictly preserving the repo's **Zero-PII** rule (never logging emails, tokens, or raw user payloads).

---

## 2. The Three Pillars + SLOs (Without Vendor Lock-In)

| Signal | What It Answers | Spring Boot 4 / Angular 21 Reality |
|---|---|---|
| **Structured Logs** | *What happened inside this request?* | JSON logs with `traceId`, `spanId`, pseudonymized user ID, and zero PII |
| **Metrics (RED)** | *Is the service healthy right now?* | **R**ate (req/s), **E**rrors (5xx %), **D**uration (p50/p95/p99 latency) via Micrometer -> OTel |
| **Distributed Traces** | *Where did the 800ms go?* | W3C `traceparent` header from Angular `HttpClient` -> Spring Boot -> Postgres |
| **SLOs & Error Budgets** | *Should we ship features or fix reliability?* | e.g., "99.5% of `/api/**` requests succeed in <300ms over 28 days" |

---

## 3. Why Zero-PII Observability Matters Here

This repo already enforces Zero-PII primitives in `@cmp/utils` (`scrubSensitiveText`, `pseudonymizeIdentifier`, `createZeroPiiBreadcrumb`). Extending that discipline to backend telemetry teaches a critical production habit:
- Correlate user sessions using **deterministic HMAC/pseudonymized IDs**, never email/IP/JWTs.
- Scrub headers (`Authorization`, `Cookie`) and query params at the OTel collector/logger boundary so leaks are impossible by construction.

---

## 4. Alternatives (Keep It Lightweight First)

| Stage | Setup | Cost / Complexity |
|---|---|---|
| **Local Dev** | Spring Boot Actuator + Micrometer + JSON console logs | Free, built-in |
| **First Live App** | OpenTelemetry SDK -> Grafana Cloud free tier / Honeycomb / Cloud Trace | Minutes to wire; zero infra to host |
| **Self-Hosted Stack** | Grafana + Tempo + Loki + Prometheus | Only if compliance or volume demands it |

---

## 5. Triggers to Promote to an ADR

- [ ] First service is deployed to a staging/prod URL (RFC-0002).
- [ ] You need to debug a slow endpoint or failed background job without SSHing into a server.
- [ ] Wire `traceparent` propagation between Angular `HttpClient` and Spring Boot 4 Micrometer Tracing.
