# RFC-0002: Single-Command Production Deployment & Rollback (Before Kubernetes)

- **Status:** `Exploring`
- **Date:** 2026-11-19
- **Author:** Stefan + Antigravity
- **Related:** [RFC-0001](./0001-crossplane-kubernetes-control-plane.md), `apps/pulse/backend/`, `apps/pulse/web/`

---

## 1. What It Is (Mental Model)

Taking one real slice (e.g., `apps/pulse/backend` + `apps/pulse/web`) from **passing CI on `main`** to a **live, public HTTPS URL** with automated health checks, secrets injection, and 1-command rollback — using managed serverless containers (Cloud Run / Fly.io) rather than managing Kubernetes or Crossplane.

The goal is to close the **"last mile" loop** of shipping software:
`Code -> CI -> Container Image -> Staging URL -> Smoke Test -> Prod URL -> Rollback Drill`.

---

## 2. Core Concepts to Learn

| Concept | What It Means in Practice | Why Builders Need It |
|---|---|---|
| **Multi-Stage / Distroless Containers** | Build with Gradle/Node in stage 1; copy only the JAR/static assets into a minimal runtime image | Fast cold starts, tiny attack surface, reproducible deploys |
| **12-Factor Config & Secrets** | Same image runs in local, staging, and prod; only env vars & secret mounts change | Eliminates "works on my machine" and hardcoded credentials |
| **Liveness vs. Readiness Probes** | `/actuator/health/liveness` (is process wedged?) vs. `/actuator/health/readiness` (is DB/startup ready for traffic?) | Prevents routing user traffic to half-booted Spring Boot instances |
| **Traffic Splitting & Instant Rollback** | Keep previous immutable revision warm; shift 10% -> 100% traffic, or revert in <10s | Makes shipping daily low-stress instead of an event |
| **Database Migrations on Boot vs. Pre-Deploy** | Expand-and-contract schema changes (Flyway/Liquibase) so old & new app revisions coexist during rollout | Prevents downtime during rolling deploys |

---

## 3. Alternatives & Progression

| Option | Ops Overhead | Best For |
|---|---|---|
| **Cloud Run / Fly.io / Railway** | Near zero | First 1–5 real services; scale-to-zero saves money when idle |
| **Managed PaaS + Managed Postgres** (Neon / Supabase / Cloud SQL) | Low | Full-stack apps needing persistent state without DBA toil |
| **GKE / EKS + Argo CD + Crossplane** | High | Multi-team orgs with dedicated platform engineers |

---

## 4. Why This Is the #1 Next Step

Right now this monorepo has strong CI gates, Renovate, and Blast-Radius analysis — **but zero live production URLs**. Shipping even one small end-to-end app forces you to confront real-world constraints (CORS, TLS, cold starts, connection pooling, secret rotation, rollback) that local `pnpm dev` hides.

---

## 5. Triggers to Promote to an ADR

- [ ] Pick one concrete candidate app (`apps/pulse` or `apps/gov-org-chart`) to ship to a live staging URL.
- [ ] Containerize it cleanly and verify `docker run` locally against a local Postgres container.
- [ ] Run one intentional **bad-deploy + rollback drill** so rollback is muscle memory before real users arrive.
