# `@cmp/observability` Engineering Constitution

## 1. Pure Functional Core (`ADR-007` & `RFC-0004`)
- Keep PII redaction, pseudonymization, W3C `traceparent` parsing/formatting, structured logging, RED metric recording, and SLO evaluation in `src/` as **pure, deterministic functions**.
- Never emit raw emails, OAuth/Bearer tokens, JWTs, cookies, or raw user identifiers in logs, errors, or metric attributes.
- Use strict TypeScript (`"strict": true` via `@cmp/config/tsconfig.library.json`). Never use `@ts-ignore` or `any`.

## 2. Dependency Boundaries
- This library lives under `packages/observability` and may depend only on `packages/*` (`workspace:*`).
- Never import from `apps/*` (enforced by `.dependency-cruiser.cjs` and `@cmp/config/eslint`).

## 3. Verification Gate
Before any change is considered complete, all of the following must pass:
- `pnpm --filter @cmp/observability lint`
- `pnpm --filter @cmp/observability typecheck`
- `pnpm --filter @cmp/observability build`
- `pnpm --filter @cmp/observability test`
