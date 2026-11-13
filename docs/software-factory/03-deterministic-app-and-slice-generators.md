# 3. Deterministic App & Vertical Slice Generators (`@cmp/factory`)

> **Package Scope**: [`packages/factory/`](../../packages/factory/package.json) (`@cmp/factory`), CLI binary `cmp-factory`, and root scripts `pnpm gen:app` / `pnpm gen:slice`.
> **Core Principle**: Eliminate cold-start drift and placeholder boilerplate by generating complete, compiled, guardrail-wired vertical slices in a single deterministic command.

---

## 1. Core Concepts

### Why Deterministic Generation Beats Ad-Hoc LLM Boilerplate

When every new app or feature starts from an LLM typing configuration files from memory, three subtle failure modes creep into a monorepo:

1. **Cold-Start Drift**: `package.json` scripts devolve into `echo "placeholder"` stubs, `tsconfig.json` diverges from the shared base config, or `@cmp/utils` isn't linked.
2. **Forgotten Guardrails**: Accessibility contrast audits (`WCAG 2.2 AA`), Zero-PII telemetry scrubbing, and `AGENTS.md` engineering constitutions are treated as "follow-up work" and skipped under deadline pressure.
3. **Inconsistent Test Harnesses**: Some packages use missing test runners while others skip strict TypeScript compilation altogether.

A **deterministic code generator** (`generateApp` and `generateSlice` in [`packages/factory/src/generators.ts`](../../packages/factory/src/generators.ts)) removes those degrees of freedom. Both human engineers and autonomous coding agents call the exact same generator to produce a working baseline where `build`, `typecheck`, `lint`, and `test` pass immediately.

### Vertical Slice Architecture vs. Horizontal Layer Sprawl

Instead of scattering a single user capability across top-level `controllers/`, `services/`, `models/`, and `tests/` folders, `@cmp/factory` organizes every feature as a self-contained **Vertical Slice** under `apps/<app>/src/slices/<slice>/`:

```text
apps/<app>/src/slices/<slice>/
├── <slice>.contract.ts   # Typed Request/Response DTOs + Zero-PII breadcrumb builder
├── <slice>.engine.ts     # Pure functional state, reducer, & slice evaluator (ADR-007)
└── <slice>.test.ts       # Deterministic node:test unit + contract suite
```

Why this works for both humans and agents:
- **Localized Context**: Everything needed to understand, modify, or review a capability lives in one folder.
- **Built-In Invariants**: Every slice starts wired to `@cmp/utils` (`auditThemePalette`, `scrubSensitiveText`, `pseudonymizeIdentifier`, `evaluateScarcityGate`, `isStrictlyDescendingByScore`).
- **Automatic Test Discovery**: Generated app `package.json` runs `tsc -p tsconfig.json && node --test "dist/src/**/*.test.js"`, so adding a new slice immediately folds its tests into `pnpm --filter @cmp/<app> test` and `pnpm verify:slice`.

### Multi-Stack Blueprints (`web-ts`, `angular-spring`, `kmp`)

`generateApp` supports three stack profiles (`FactoryStack = "web-ts" | "angular-spring" | "kmp"`):

| Stack Flag | Target Architecture | Shared Constitution References |
| :--- | :--- | :--- |
| `--stack=web-ts` *(default)* | TypeScript Pure Functional Core + Modern Desktop Web UX | `ADR-007`, `ADR-009`, `docs/stack-best-practices/` |
| `--stack=angular-spring` | Angular 21 Signals Frontend + Spring Boot 4 / Java 21 Backend | `05_SPRING_BOOT_4_AND_JAVA_21_BEST_PRACTICES.md`, `06_ANGULAR_21_SIGNALS_AND_WEB_BEST_PRACTICES.md` |
| `--stack=kmp` | Kotlin Multiplatform (`commonMain`) + Compose Multiplatform Shared UI | `01_KOTLIN_PURE_DOMAIN_BEST_PRACTICES.md`, `02_KMP_MULTIPLATFORM_BEST_PRACTICES.md`, `03_COMPOSE_MULTIPLATFORM_AND_DESKTOP_WEB_BEST_PRACTICES.md` |

Regardless of stack, every generated app starts with a runnable TypeScript pure functional domain engine (`src/domain/<name>-domain.engine.ts`) wired to `@cmp/utils` so the monorepo verification loop can validate its contracts uniformly.

---

## 2. How It Functions (Real Code Walkthrough)

### CLI Dispatch (`packages/factory/src/cli.ts`)

Root [`package.json`](../../package.json) exposes `gen:app` and `gen:slice` directly to `packages/factory/dist/src/cli.js`:

```json
"gen:app": "node packages/factory/dist/src/cli.js gen:app",
"gen:slice": "node packages/factory/dist/src/cli.js gen:slice"
```

Inside [`runCli`](../../packages/factory/src/cli.ts#L51-L124):
- Strips an optional leading `--` (so both `pnpm gen:app foo --stack=web-ts` and `pnpm gen:app -- foo --stack=web-ts` work cleanly).
- Parses `--stack=<value>` or `--stack <value>` (defaulting to `"web-ts"`) and optional `--root <dir>` (defaulting to `process.cwd()`).
- Delegates to `generateApp` or `generateSlice` and prints every created file path to stdout, returning exit code `0` on success or `1` on validation/runtime errors.

### App Scaffolding (`generateApp` in `packages/factory/src/generators.ts`)

[`generateApp`](../../packages/factory/src/generators.ts#L90-L421) validates the app slug against `/^[a-z][a-z0-9-]*$/`, verifies the target directory does not already exist, and writes **8 files** under `<rootDir>/apps/<name>/`:

1. **`package.json`**: Configures `@cmp/<name>` as an ESM package (`"type": "module"`), depends on `"@cmp/utils": "workspace:*"`, includes `@cmp/config`, `@types/node`, `rimraf`, and `typescript`, and sets real scripts (`build`, `test`, `lint`, `typecheck`, `clean`).
2. **`tsconfig.json` & `tsconfig.build.json`**: Extend `../../packages/config/tsconfig.base.json` with `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"rootDir": "."`, `"outDir": "dist"`, excluding `**/*.test.ts` and `**/*.spec.ts` in `tsconfig.build.json`.
3. **`AGENTS.md`**: Writes the app's Engineering Constitution covering Pure Functional Core (`ADR-007`), Automated WCAG 2.2 AA Contrast Gate, Zero-PII Telemetry Scrubber, Modern Desktop Web UX (`ADR-009`) referencing `docs/stack-best-practices/`, and vertical slice conventions.
4. **`README.md`**: Documents the selected stack and exact verification commands (`pnpm --filter @cmp/<name> test`, `pnpm verify:slice`).
5. **`src/domain/<name>-domain.engine.ts`**: Exports:
   - `DEFAULT_<NAME>_PALETTE`: Six light and dark theme pairs (`>= 4.5:1` contrast).
   - `audit<Name>Theme()`: Calls `auditThemePalette` from `@cmp/utils`.
   - `record<Name>TelemetryBreadcrumb()`: Scrubs event text with `scrubSensitiveText`, pseudonymizes actor IDs with `pseudonymizeIdentifier`, and emits a `ZeroPiiBreadcrumb`.
   - `evaluate<Name>PinGate()` & `verify<Name>ScoreOrder()`: Wrap `evaluateScarcityGate` and `isStrictlyDescendingByScore`.
   - `run<Name>DomainHealthCheck()`: Runs all checks in one deterministic call.
6. **`src/domain/<name>-domain.engine.test.ts`**: `node:test` + `node:assert/strict` suite asserting WCAG `>= 4.5:1`, Bearer/`ya29.`/email redaction, scarcity rules, and health check pass status.
7. **`src/index.ts`**: Re-exports `./domain/<name>-domain.engine.js`.

### Slice Scaffolding (`generateSlice` in `packages/factory/src/generators.ts`)

[`generateSlice`](../../packages/factory/src/generators.ts#L427-L693) validates both `app` and `slice` slugs, confirms `apps/<app>` exists, and creates **3 files** under `apps/<app>/src/slices/<slice>/`:

1. **`<slice>.contract.ts`**: Defines `<Slice>Request`, `<Slice>Response`, `<Slice>ScoreItem`, and `build<Slice>Breadcrumb()` using `@cmp/utils` Zero-PII helpers.
2. **`<slice>.engine.ts`**: Defines:
   - `<Slice>State` and `<Slice>Action` (`"TOGGLE_PIN" | "RESET"`).
   - `createInitial<Slice>State()`: Initializes state with `auditThemePalette` check.
   - `reduce<Slice>State(state, action)`: Pure state transition enforcing `evaluateScarcityGate(..., maxSlots ?? 3)`.
   - `evaluate<Slice>Slice(request)`: Evaluates WCAG contrast, scarcity decision, `isStrictlyDescendingByScore`, `scrubSensitiveText(request.note ?? "")`, and returns `{ accepted, decision, wcagPassed, rankingValid, sanitizedNote, telemetry }`.
3. **`<slice>.test.ts`**: Unit + contract tests verifying reducer transitions (`ALLOW_PIN` -> `SWAP_REQUIRED` -> `UNPIN`), WCAG 2.2 AA compliance, Zero-PII redaction, and deterministic actor pseudonymization.

---

## 3. How to Implement

### Step-by-Step: Scaffold an App and Vertical Slice

1. **Generate the application**:
   ```bash
   pnpm gen:app focus-board --stack=web-ts
   ```
2. **Generate a vertical feature slice inside it**:
   ```bash
   pnpm gen:slice focus-board daily-triage
   ```
3. **Link workspace dependencies**:
   ```bash
   pnpm install --no-frozen-lockfile
   ```
   *(Required once after `gen:app` so `apps/focus-board/node_modules` links `@cmp/utils`, `@cmp/config`, and TypeScript.)*
4. **Build, test, and verify against factory guardrails**:
   ```bash
   pnpm --filter @cmp/focus-board build
   pnpm --filter @cmp/focus-board test
   pnpm verify:slice --target=@cmp/focus-board --json
   ```

### Extending a Generated Slice

When adding domain logic to `apps/focus-board/src/slices/daily-triage/`:

1. **Add typed inputs/outputs** to `daily-triage.contract.ts` (keep PII fields out of breadcrumbs; always pass strings through `scrubSensitiveText` and IDs through `pseudonymizeIdentifier`).
2. **Keep `daily-triage.engine.ts` pure**: never import `fs`, `fetch`, DOM APIs, or framework singletons into `*.engine.ts`. Pass timestamps or clocks as parameters if needed.
3. **Add edge-case assertions** in `daily-triage.test.ts` using `node:test` and `node:assert/strict` so `pnpm --filter @cmp/focus-board test` and `pnpm verify:slice` catch regressions immediately.

### Adding a New Stack Blueprint or Template

To add a new stack option (or customize generated files) in [`packages/factory/src/generators.ts`](../../packages/factory/src/generators.ts):

1. Update `FactoryStack`, `VALID_STACKS`, and `stackDescription()` in `packages/factory/src/generators.ts`.
2. Add any stack-specific guidance or `docs/stack-best-practices/` links to the generated `AGENTS.md` template.
3. Add an isolated `os.tmpdir()` test case in [`packages/factory/src/factory.test.ts`](../../packages/factory/src/factory.test.ts) asserting all generated files exist and conform to `AGENTS.md` guardrails.
4. Rebuild and test `@cmp/factory`:
   ```bash
   pnpm --filter @cmp/factory build && pnpm --filter @cmp/factory test
   ```

---

**Next Guide**: [4. Closed-Loop Verification Harness (`pnpm verify:slice`)](./04-closed-loop-verification-harness.md)
