# Release Readiness & Engineering Scorecard

- **Repository:** `cmp-root`
- **Overall Score:** **100/100** (10/10 capabilities passing)
- **Generated At:** `2026-11-13T16:02:57.540Z`

## Capability Checks

| Capability | Status | Score | Details |
| --- | --- | --- | --- |
| Guardrails & AGENTS.md | PASS | 100% | All 4 factory verification checks passed. |
| REQ-* Traceability | PASS | 100% | All 4 requirement(s) covered by test/code references. |
| Architecture Fitness | PASS | 100% | dependency-cruiser=present, ArchitectureTest.java=apps/pulse/backend/src/test/java/com/pulse/backend/ArchitectureTest.java |
| Mutation Testing | PASS | 100% | stryker.config.mjs=present, Pitest=configured |
| Accessibility (WCAG) | PASS | 100% | a11y.spec.ts=present, a11y.yml=present |
| Security & Hooks | PASS | 100% | security.yml=present, lefthook.yml=present |
| Workflow SHA Pinning | PASS | 100% | All external uses: across 13 workflow(s) are 40-char SHA pinned. |
| SLSA Provenance | PASS | 100% | attest-build-provenance configured in .github/workflows/security.yml |
| Property-Based Testing | PASS | 100% | Found 1 property test file(s): packages/utils/src/utils.property.test.ts |
| Agentic Golden Evals | PASS | 100% | Found 1 agent eval suite(s): packages/factory/src/evals/plan-critic.eval.test.ts |

## DORA / Git Signals

- **Commits (last 7 days):** 24
- **Commits sampled:** 33 (max 50)
- **Rework commits (`revert`/`fixup!`/`squash!`):** 0 (0.0%)

---
_Refresh locally with `pnpm scorecard -- --write` or `node packages/factory/dist/src/cli.js scorecard --write`._
