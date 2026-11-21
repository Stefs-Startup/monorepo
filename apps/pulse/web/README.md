# `apps/pulse/web` — Angular 21 Signals SPA

Web client for Pulse using Angular 21 standalone components + Signals, Vitest unit tests, Playwright E2E critical journeys, and an unprivileged Nginx edge-proxy container (`76.4 MB`).

## Local Quickstart

```bash
cd apps/pulse/web
npm ci
npm start                        # Serves http://localhost:4200 (proxies /api/* to :8080)
```

Zero real Google OAuth credentials are needed locally — `PulseStateService` and Playwright E2E tests use deterministic seed fixtures (`src/app/fixtures/pulse-seed.ts` and `FakeGoogleTasksStub`).

## Verification & E2E Tests

```bash
npm run lint && npm run typecheck
npm run build
npm test                         # Vitest unit & fixture tests
npm run test:e2e                 # Playwright E2E (onboarding, Top-3 scarcity, rescue triage)
```

To run Playwright against a live Cloud Run PR preview URL:

```bash
BASE_URL=https://pr-129---pulse-web-oise3cvata-uc.a.run.app npm run test:e2e
```

From the repo root: `./scripts/check.sh --stack angular`.

## Health Probes & Deployment

- **Liveness / Readiness:** `GET /livez` and `GET /readyz` (Nginx)
- **Generated API Client:** `src/app/api/generated/pulse-api.types.ts` (regenerated via `pnpm api:sync`)
- **PR Previews:** Touching `apps/pulse/web/**` automatically deploys a zero-traffic Cloud Run preview revision and posts the preview URL on the PR.
