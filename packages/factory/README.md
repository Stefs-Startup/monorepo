# @cmp/factory

Agentic Software Factory CLI, vertical-slice code generators, and workspace verification harness for the `@cmp` monorepo.

## CLI Commands

Run via root pnpm scripts or the `cmp-factory` binary:

### 1. Generate an Application (`gen:app`)

Scaffolds `apps/<name>/` with a Pure Functional Core domain engine (`ADR-007`), WCAG 2.2 AA palette audit, Zero-PII telemetry helpers, `AGENTS.md` Engineering Constitution (`ADR-009`), `README.md`, TypeScript config, and `node:test` unit tests.

```bash
pnpm gen:app <name> [--stack=web-ts|angular-spring|kmp]
```

Examples:

```bash
pnpm gen:app demo-product --stack=web-ts
pnpm gen:app portal-admin --stack=angular-spring
pnpm gen:app mobile-companion --stack=kmp
```

### 2. Generate a Vertical Slice (`gen:slice`)

Scaffolds `apps/<app>/src/slices/<slice>/` with `<slice>.contract.ts`, `<slice>.engine.ts`, and `<slice>.test.ts`.

```bash
pnpm gen:slice <app> <slice>
```

Example:

```bash
pnpm gen:slice demo-product onboarding-ritual
```

### 3. Verify Workspace & Slices (`verify`)

Runs the deterministic three-gate factory verification loop:
1. **Guardrail & `AGENTS.md` Audit**: Confirms target apps (`apps/web`, `apps/pulse`, and any generated `apps/*`) include `AGENTS.md` and `README.md`, and zero `catalog-info.yaml` files remain.
2. **WCAG 2.2 AA & Zero-PII Self-Test**: Audits light/dark surface contrast ratios (`>= 4.5:1`) and validates `Bearer` / `ya29.` token and email redaction via `@cmp/utils`.
3. **Typecheck & Unit Test Gate**: Runs `pnpm --filter <target> typecheck` & `pnpm --filter <target> test` (or `pnpm -r typecheck` & `pnpm -r test`).

```bash
pnpm verify:slice [--target=<pkg>] [--json]
```

## Programmatic API

Import from `@cmp/factory`:

- `generateApp(options: { name: string; stack?: 'web-ts' | 'angular-spring' | 'kmp'; rootDir?: string }): { appDir: string; filesCreated: string[] }`
- `generateSlice(options: { app: string; slice: string; rootDir?: string }): { sliceDir: string; filesCreated: string[] }`
- `verifyWorkspace(options?: { rootDir?: string; target?: string; json?: boolean }): { passed: boolean; checks: Array<{ name: string; passed: boolean; details: string }> }`
