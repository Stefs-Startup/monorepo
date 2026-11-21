# `@cmp/google-auth` Engineering Constitution

## 1. Pure Functional Core & Zero-PII Guarantees (`ADR-007`)
- Keep OAuth session validation, token masking, PII scrubbing, RFC 3339 date parsing/formatting, and Google Sign-In failure diagnostics in `src/` as **pure, stateless functions**.
- Never leak raw email addresses or OAuth tokens (`ya29.*` / Bearer tokens) in diagnostic strings or telemetry attributes.
- Use strict TypeScript (`"strict": true` via `@cmp/config/tsconfig.library.json`). Never use `@ts-ignore` or `any`.

## 2. Dependency Boundaries
- This library lives under `packages/google-auth` and may depend only on `packages/*` (`workspace:*`).
- Never import from `apps/*` (enforced by `.dependency-cruiser.cjs` and `@cmp/config/eslint`).

## 3. Verification Gate
Before any change is considered complete, all of the following must pass:
- `pnpm --filter @cmp/google-auth lint`
- `pnpm --filter @cmp/google-auth typecheck`
- `pnpm --filter @cmp/google-auth build`
- `pnpm --filter @cmp/google-auth test`
