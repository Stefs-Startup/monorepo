# 4. Closed-Loop Verification Harness (`pnpm verify:slice`)

> **Package Scope**: [`packages/factory/src/verify.ts`](../../packages/factory/src/verify.ts), [`packages/factory/src/cli.ts`](../../packages/factory/src/cli.ts), and root script `pnpm verify:slice`.
> **Core Principle**: Compress architectural audits, WCAG/Zero-PII invariants, typechecking, and unit tests into one fast, machine-readable gate for both humans and AI agents.

---

## 1. Core Concepts

### Why Feedback Loop Latency Governs Velocity

In an agentic monorepo, code generation is cheap—**verification latency** is the real bottleneck. If an engineer or AI agent has to remember five separate commands (checking `AGENTS.md` existence, hunting for leftover `catalog-info.yaml` files, verifying contrast ratios, running `tsc`, and executing `node --test`), checks get skipped or interpreted inconsistently.

A **closed-loop verification harness** collapses all repository guardrails into a single deterministic command:

```bash
pnpm verify:slice
```

When run with `--json`, `pnpm verify:slice --json` emits a structured JSON report (`{ "passed": boolean, "checks": [...] }`) and exits with `0` (all gates passed) or `1` (at least one gate failed). An agent can run it after every edit, parse the exact failing gate and `details` string, fix the root cause, and re-verify without guesswork.

### The Three Deterministic Gates

`verifyWorkspace` executes three ordered checks on every run:

| Gate | What It Verifies | Failure Catches |
| :--- | :--- | :--- |
| **1. Guardrail & `AGENTS.md` Audit** | Every app under `apps/` (`apps/web`, `apps/pulse`, and any generated `apps/*`) has `AGENTS.md` and `README.md`, and zero `catalog-info.yaml` files remain in the workspace. | Unconstitutional apps, missing docs-as-code, or reintroduced Backstage catalog YAML bloat. |
| **2. WCAG 2.2 AA & Zero-PII Self-Test** | Audits standard Light/Dark token pairs via `@cmp/utils` `auditThemePalette` (`>= 4.5:1`) and verifies `scrubSensitiveText`, `pseudonymizeIdentifier`, and `createZeroPiiBreadcrumb` redact `Bearer` tokens, `ya29.` tokens, and emails. | Broken contrast math or regressions in PII/secret redaction in `@cmp/utils`. |
| **3. Typecheck & Unit Test Gate** | Runs `pnpm --filter <target> typecheck` and `pnpm --filter <target> test` (or `pnpm -r typecheck` and `pnpm -r test` across the full workspace). | Type errors, broken module imports, or failing unit/contract tests in any package. |

---

## 2. How It Functions (Real Code Walkthrough)

### Entrypoint Wiring (`package.json` -> `cli.ts` -> `verifyWorkspace`)

Root [`package.json`](../../package.json#L20) maps `verify:slice` to the factory CLI:

```json
"verify:slice": "node packages/factory/dist/src/cli.js verify"
```

[`runCli`](../../packages/factory/src/cli.ts#L94-L114) parses optional `--target=<pkg>` (or `--target <pkg>`), `--root <dir>`, and `--json` flags, calls [`verifyWorkspace`](../../packages/factory/src/verify.ts#L272-L286), prints either formatted JSON or `[PASS]`/`[FAIL]` lines, and sets `process.exitCode = result.passed ? 0 : 1`.

### Gate 1: Guardrail & `AGENTS.md` Audit

[`runGuardrailAndAgentsAudit`](../../packages/factory/src/verify.ts#L58-L120):
1. Scans `<rootDir>/apps/` for non-hidden directories (such as `apps/web`, `apps/pulse`, and any generated `apps/*`).
2. When `--target` matches an app slug (stripping a leading `@cmp/` prefix if present), scopes the app file check to that app; otherwise audits all apps under `apps/`.
3. Asserts both `AGENTS.md` and `README.md` exist in each audited app directory.
4. Calls [`findLeftoverCatalogFiles`](../../packages/factory/src/verify.ts#L38-L56) to recursively walk `<rootDir>` (skipping `node_modules`, `.git`, `dist`, `.turbo`, `.claude`, `build`, `.gradle`) and flags any remaining `catalog-info.yaml` file.

### Gate 2: WCAG 2.2 AA & Zero-PII Self-Test

[`runWcagAndZeroPiiSelfTest`](../../packages/factory/src/verify.ts#L122-L186):
1. Calls `auditThemePalette` from `@cmp/utils` on six standard Light and Dark surface/text token pairs (`#111827`/`#FFFFFF`, `#4B5563`/`#F9FAFB`, `#1D4ED8`/`#FFFFFF`, `#F9FAFB`/`#0F172A`, `#CBD5E1`/`#1E293B`, `#93C5FD`/`#0F172A`), requiring `minRatio: 4.5` on every entry.
2. Feeds a synthetic payload containing an email (`engineer@example.com`), a `Bearer` token, and a `ya29.` OAuth token into `scrubSensitiveText` and `createZeroPiiBreadcrumb`, asserting all raw secrets are absent and `[REDACTED_EMAIL]` / `[REDACTED_TOKEN]` markers are present.
3. Asserts `pseudonymizeIdentifier` normalizes casing/whitespace deterministically into a 16-character SHA-256 hex digest and returns `"anonymous"` for blank input.

### Gate 3: Typecheck & Unit Test Gate + Recursion Guard

[`runTypecheckAndTestGate`](../../packages/factory/src/verify.ts#L211-L264) runs `pnpm` via [`runPnpmCommand`](../../packages/factory/src/verify.ts#L188-L209):

1. **Recursion Guard (`CMP_VERIFY_RUNNING=1`)**:
   - Because `pnpm -r test` executes `@cmp/factory`'s own test suite ([`factory.test.ts`](../../packages/factory/src/factory.test.ts)), any nested `verifyWorkspace` call made inside tests must not re-spawn `pnpm -r test` infinitely.
   - `runPnpmCommand` injects `CMP_VERIFY_RUNNING: "1"` into the child process environment; if `CMP_VERIFY_RUNNING === "1"` is already set, Gate 3 skips spawning nested `pnpm` commands and reports why.
2. **Isolated Temp-Workspace Support**:
   - When `verifyWorkspace` is invoked against an isolated temp directory (such as in `factory.test.ts`) that has no `pnpm-workspace.yaml`, Gate 3 skips workspace-wide `pnpm -r` commands while Gates 1 and 2 still execute in full.
3. **Executable Fallback**:
   - Invokes `pnpm` directly via `spawnSync`, and if `pnpm` is not on `PATH` (`ENOENT`), falls back to `npx --yes pnpm@9.12.3` with the exact same arguments.
4. **Scoped vs. Full Workspace Execution**:
   - With `--target=<pkg>`: executes `pnpm --filter <pkg> typecheck` then `pnpm --filter <pkg> test`.
   - Without `--target`: executes `pnpm -r typecheck` then `pnpm -r test`.

---

## 3. How to Implement

### Daily Usage Modes

1. **Human pre-PR check (full workspace)**:
   ```bash
   pnpm verify:slice
   ```
   Example output:
   ```text
   [PASS] Guardrail & AGENTS.md Audit: Verified AGENTS.md, README.md, and zero catalog-info.yaml across apps/pulse, apps/web
   [PASS] WCAG 2.2 AA & Zero-PII Self-Test: Audited 6 light/dark token pairs (>= 4.5:1) and verified Bearer/OAuth/email Zero-PII scrubbing.
   [PASS] Typecheck & Unit Test Gate: pnpm -r typecheck (ok); pnpm -r test (ok)
   Factory verification passed.
   ```

2. **Scoped slice/package check (fast inner loop while developing a single app)**:
   ```bash
   pnpm verify:slice --target=@cmp/web
   ```

3. **Machine-readable JSON mode (for AI agents and CI pipelines)**:
   ```bash
   pnpm verify:slice --json
   ```
   Outputs:
   ```json
   {
     "passed": true,
     "checks": [
       {
         "name": "Guardrail & AGENTS.md Audit",
         "passed": true,
         "details": "Verified AGENTS.md, README.md, and zero catalog-info.yaml across apps/pulse, apps/web"
       },
       {
         "name": "WCAG 2.2 AA & Zero-PII Self-Test",
         "passed": true,
         "details": "Audited 6 light/dark token pairs (>= 4.5:1) and verified Bearer/OAuth/email Zero-PII scrubbing."
       },
       {
         "name": "Typecheck & Unit Test Gate",
         "passed": true,
         "details": "pnpm -r typecheck (ok); pnpm -r test (ok)"
       }
     ]
   }
   ```

### Registering a New Custom Verification Check

To add a new architectural guardrail (for example, checking that no file under `src/` imports forbidden runtime APIs or verifying a new workspace invariant):

1. Add a pure check function returning `VerifyCheckResult` (`{ name: string; passed: boolean; details: string }`) in [`packages/factory/src/verify.ts`](../../packages/factory/src/verify.ts).
2. Append its result to the `checks` array inside [`verifyWorkspace`](../../packages/factory/src/verify.ts#L272-L286).
3. Add both a positive and negative assertion in [`packages/factory/src/factory.test.ts`](../../packages/factory/src/factory.test.ts) using an isolated `os.tmpdir()` workspace.
4. Rebuild and verify:
   ```bash
   pnpm --filter @cmp/factory build
   pnpm --filter @cmp/factory test
   pnpm verify:slice --json
   ```

---

**Previous Guide**: [3. Deterministic App & Vertical Slice Generators (`@cmp/factory`)](./03-deterministic-app-and-slice-generators.md)
