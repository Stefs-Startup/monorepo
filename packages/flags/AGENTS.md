# `@cmp/flags` Engineering Constitution

## 1. Pure Functional Core (`ADR-007` & `STE-57`)
- Keep feature flag evaluation, kill switches, deterministic per-user percentage rollouts, and multi-variant experiment assignment in `src/` as **pure, deterministic functions**.
- Route all exposure and outcome telemetry exclusively through `@cmp/observability` so user identifiers are deterministically pseudonymized and free of PII.
- Use strict TypeScript (`"strict": true` via `@cmp/config/tsconfig.library.json`). Never use `@ts-ignore` or `any`.

## 2. Dependency Boundaries
- This library lives under `packages/flags` and may depend only on `packages/*` (`workspace:*`).
- Never import from `apps/*` (enforced by `.dependency-cruiser.cjs` and `@cmp/config/eslint`).

## 3. Verification Gate
Before any change is considered complete, all of the following must pass:
- `pnpm --filter @cmp/flags lint`
- `pnpm --filter @cmp/flags typecheck`
- `pnpm --filter @cmp/flags build`
- `pnpm --filter @cmp/flags test`
