# RFC-0005: Bounded Agentic Code-Mod Loops (LLM + Compiler + Blast-Radius)

- **Status:** `Exploring`
- **Date:** 2026-11-19
- **Author:** Stefan + Antigravity
- **Related:** `renovate/`, `tools/blast-radius/`, `packages/factory/`, `.github/workflows/blast-radius.yml`

---

## 1. What It Is (Mental Model)

Combining **deterministic tools** (Renovate + OpenRewrite + compiler + Blast-Radius AST gate) with a **bounded AI coding agent loop** for migrations that have no off-the-shelf OpenRewrite recipe (e.g., migrating internal libraries across Spring Boot, Angular, TypeScript, and Swift).

**Core principle:** *The LLM proposes edits; deterministic tools (`tsc`, `gradle test`, `dependency-cruiser`, `blast-radius`) decide what is true.*

---

## 2. Deterministic Code-Mods vs. Agentic Loops

| Dimension | OpenRewrite / `ng update` | Bounded Agentic Code-Mod |
|---|---|---|
| **Best For** | Standard framework upgrades (Spring 3 -> 4, JUnit 4 -> 5, Angular migrations) | Custom internal SDKs, cross-language API changes, glue code |
| **Determinism** | 100% AST-exact & repeatable across 100 repos | Probabilistic — **must** be gated by compiler + tests + AST checks |
| **Setup Cost** | Requires authoring & publishing Java AST recipes | Zero recipe authoring; uses repo context + `AGENTS.md` + compiler feedback |
| **Failure Mode** | Fails cleanly if pattern doesn't match | Can hallucinate or touch unrelated files unless strictly scoped |

---

## 3. Guardrails for a Safe Agentic Migration Loop

1. **Scope Lock:** Agent can only modify files in the target package/slice (enforced via `git diff --name-only` check).
2. **Closed-Loop Verification:** Every candidate patch must pass `scripts/check.sh --changed` (lint, typecheck, build, unit/architecture tests).
3. **Blast-Radius Gate:** `pnpm blast-radius --gate` computes critical-path touchpoints (`@Transactional`, `@SecurityFilterChain`, routing, DTOs) and posts a human-readable scorecard PR comment.
4. **Hard Retry Cap:** Max 3 compiler-feedback iterations per PR; if still red, open a draft PR / report exact blocker for human review rather than looping forever.

---

## 4. Why This Matters for Becoming a Builder

Most developers use AI agents either interactively (chatting file-by-file) or naively ("fix everything"). Learning to design **bounded, verifiable agent loops** — where deterministic gates (`blast-radius`, ArchUnit, `tsc`, `scripts/check.sh`) wrap probabilistic LLM edits — is the core skill behind modern software factories.

---

## 5. Triggers to Promote to an ADR

- [ ] A real Renovate PR fails compilation due to an **internal library or non-recipe breaking change** that OpenRewrite doesn't cover.
- [ ] Prototype a reusable GitHub Action / CLI step that runs a bounded 3-attempt fix loop and hands the resulting diff straight to `blast-radius --gate` + `ci.yml` scorecards.
