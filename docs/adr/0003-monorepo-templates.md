# ADR-0003: Monorepo Templates

**Status:** Accepted
**Date:** 2026-03-15
**Deciders:** Company of One

---

## Context

To speed up creation of new applications and shared packages, we need standard templates. This ensures all new projects in the monorepo follow the conventions documented in `docs/monorepo-conventions.md`.

## Decision

We will use simple scaffolding directories (`apps/template` and `packages/template`) as starting points for new projects.

## Rationale

Copy-pasting an existing scaffold is faster than manually creating `package.json`, `tsconfig.json`, and initial source files.

## Consequences

- All new projects should be duplicated from these templates.
- Updates to build scripts or TypeScript configurations must be applied to both the templates and existing projects.