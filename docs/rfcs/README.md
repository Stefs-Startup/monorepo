# Requests for Comments (RFCs)

This directory holds **exploratory technical ideas that are not ready for implementation yet**.

Unlike [`../adr/`](../adr/) — which is an immutable log of *committed* architectural decisions — RFCs are a learning and design space for evaluating tools, patterns, and platform investments before earning their complexity in code.

---

## Lifecycle

| Status | Meaning |
|--------|---------|
| `Exploring` | Actively researching concepts, trade-offs, and fit |
| `Parked` | Understood and intentionally deferred until specific triggers are met |
| `Ready for ADR` | Triggers met; ready to formalize an ADR and implement |
| `Rejected` | Evaluated and ruled out (kept for institutional memory) |

---

## Index

| RFC | Title | Status | Revisit Trigger |
|-----|-------|--------|-----------------|
| [0001](./0001-crossplane-kubernetes-control-plane.md) | Crossplane as a Kubernetes Infrastructure Control Plane | `Parked` | Multiple real deployable services + repeated cloud/env provisioning boilerplate |
| [0002](./0002-single-command-prod-deploy-and-rollback.md) | Single-Command Production Deployment & Rollback (Before Kubernetes) | `Exploring` | Picking 1 candidate app (`apps/pulse` or `apps/gov-org-chart`) to ship live |
| [0003](./0003-contract-first-apis-and-e2e-type-safety.md) | Contract-First APIs Across Spring Boot 4, Angular 21 & KMP | `Exploring` | 5+ shared DTOs/endpoints between `apps/pulse/backend` and clients |
| [0004](./0004-zero-pii-production-observability-and-slos.md) | Zero-PII Production Observability (OpenTelemetry & SLOs) | `Exploring` | First live staging/prod service URL deployed |
| [0005](./0005-bounded-agentic-codemod-loops.md) | Bounded Agentic Code-Mod Loops (LLM + Compiler + Blast-Radius) | `Exploring` | A real Renovate PR hits a breaking change without an OpenRewrite recipe |

---

## Template

Create `docs/rfcs/NNNN-short-kebab-title.md` with:

1. **Status & Date** (`Exploring` / `Parked` / `Ready for ADR` / `Rejected`)
2. **What It Is** (plain-English mental model + key primitives)
3. **Problem It Solves** (what pain makes this worth its weight)
4. **Alternatives & Comparison** (simpler options first)
5. **Why It's Not Ready Yet / Cost of Premature Adoption**
6. **Triggers to Revisit** (concrete signals that justify picking this back up)
7. **References / Further Reading**
