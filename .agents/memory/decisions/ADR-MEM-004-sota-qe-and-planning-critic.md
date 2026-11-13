# ADR-MEM-004: SOTA Quality Engineering & Pre-Execution Planning Critic

- **Status**: Accepted (2026-11-13)
- **Context**: An audit of the monorepo (`#51`) and SOTA QE gap analysis (`#52`) identified six gaps across code quality/architecture fitness, real-DOM accessibility (WCAG 2.2 AA), deployable health tracking, layered DevSecOps vulnerability management, requirement-to-code traceability, and pre-execution planning verification. In addition, `scripts/check.sh` used `declare -A` (failing on macOS `/bin/bash` 3.2) and omitted the SwiftPM stack (`apps/ytm-menubar`).
- **Decision**:
  1. **Adopt Tier 1 SOTA QE Tooling in this monorepo**:
     - **Pre-Execution Planning Critic (`packages/factory` `plan:critic`)**: Static pre-flight auditing plans/specs across 4 weak-point checks (Underspecified Inputs, Missing Edge Cases, Unverified External Assumptions, Conflicting Constraints) with a deterministic escalation matrix (`AUTO_PROCEED`, `AUTO_SPIKE`, `ESCALATE_HUMAN`), codified in [`.agents/memory/process/planning-critic.md`](../process/planning-critic.md).
     - **Local Gate & Shell Portability ([`scripts/check.sh`](../../../scripts/check.sh) & [`lefthook.yml`](../../../lefthook.yml))**: Remove `declare -A` for macOS `/bin/bash` 3.2 compatibility, add `ytm-menubar` (SwiftPM) stack support, add `--gate security` (optional `gitleaks` / `osv-scanner` with `SKIP` or `CHECK_STRICT=1`), and add optional `gitleaks-staged` in `lefthook.yml`.
     - **Layered CI Security Workflow ([`.github/workflows/security.yml`](../../../.github/workflows/security.yml))**: PR + weekly schedule running Gitleaks (`fetch-depth: 0`), OSV-Scanner, Semgrep, Trivy (SARIF), and CycloneDX SBOM artifact generation.
     - **Release Readiness Scorecard ([`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml))**: Replace the placeholder `deploy` job with a `release-readiness` scorecard (`scorecard.json` + DORA summary in `$GITHUB_STEP_SUMMARY`).
  2. **Adopt the Tier 2 Enterprise Transfer Playbook** for scaling these practices to large or legacy enterprise codebases:
     - **Phase 0 — Observe-Only**: Run `plan:critic`, Gitleaks, OSV-Scanner, Semgrep, and Trivy in non-blocking / SARIF-upload mode to establish baselines without halting delivery.
     - **Phase 1 — Baseline Ratcheting**: Block only on *new* secrets, critical/high CVEs in modified dependencies, and `ESCALATE_HUMAN` plan-critic triggers; adopt progressive `AGENTS.md` + `scripts/check.sh` wrappers around existing enterprise CI (`make`, `mvn`, `nx`, `bazel`).
     - **Phase 2 — Strangler-Fig Critical Paths**: Enforce mutation testing thresholds (StrykerJS / Pitest `>= 75%`), AST/bytecode architecture fitness (`dependency-cruiser` / `ArchUnit`), `@playwright/test` + `@axe-core/playwright` WCAG 2.2 AA DOM checks, and full `REQ-*` traceability strictly on new slices and Tier-1 revenue/auth domains, leaving untouched legacy monoliths undisturbed until refactored.
- **Consequences**:
  - Agents catch underspecified specs, unverified external assumptions, and boundary conflicts *before* writing code, while autonomous `AUTO_PROCEED` / `AUTO_SPIKE` paths prevent unnecessary human interruptions.
  - Local `scripts/check.sh` runs cleanly on macOS default `/bin/bash` 3.2 and covers all active stacks.
  - CI gains layered secret/SCA/SAST/SBOM scanning and a machine-readable `release-readiness` verdict.
- **Evidence**: Board `#51` (`qe-auditor` inventory), `#52` (`qe-architect` blueprint), and `#55`–`#58` (implementation and independent verification).
