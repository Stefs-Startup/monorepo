# Agent Guidelines (`apps/pulse/web`)

Angular 21 Signals web frontend for Pulse. Keep changes aligned with [../AGENTS.md](../AGENTS.md) and root `AGENTS.md`.

## Build & Test

Run inside `apps/pulse/web` (or via repo root `scripts/check.sh`):

```bash
scripts/check.sh --stack angular

# Or run directly inside apps/pulse/web:
npm ci
npm run lint
npm run typecheck
npm run build
npm test
```

## Conventions

- **Angular 21 Standalone Signals**: Components MUST declare `standalone: true`, prefer Angular Signals over imperative subscriptions, and use modern control flow (`@if`, `@for`, `@switch`).
- **Enforced Lint (`scripts/lint-angular.mjs`)**: Gate 1 bans `*ngIf` / `*ngFor` / `*ngSwitch`, bans `@ts-ignore`, and requires production bundle budgets in `angular.json`.
- **Unit & Accessibility Contracts**: Component and state tests run under Vitest 4 (`npm test`) and verify WCAG 2.2 AA contrast ratios (`>= 4.5:1`).

## Do Not Touch

- **Do NOT add `apps/pulse/web` to root `pnpm-workspace.yaml`** or replace `package-lock.json` with a pnpm lockfile — `reusable-node.yml` detects `npm` from `package-lock.json`.
- **Do NOT remove production bundle budgets** in `angular.json`.

## Common Pitfalls

- Running `pnpm` inside `apps/pulse/web` creates workspace/lockfile mismatches; always use `npm ci` / `npm run ...` here.
- Leaving `*ngIf` / `*ngFor`, omitting `standalone: true` on `.component.ts`, or adding `@ts-ignore` immediately fails `npm run lint`.
