# 2. Shared Guardrail Primitives (`@cmp/utils`)

> **Track 2 Scope**: Pure functional TypeScript guardrails in [`packages/utils/`](../../packages/utils/) (`@cmp/utils`) and their reference integration in [`apps/web/`](../../apps/web/) (`@cmp/web`).
> **Source Files Covered**:
> - [`packages/utils/src/wcag.ts`](../../packages/utils/src/wcag.ts)
> - [`packages/utils/src/observability.ts`](../../packages/utils/src/observability.ts)
> - [`packages/utils/src/scarcity.ts`](../../packages/utils/src/scarcity.ts)
> - [`packages/utils/src/index.ts`](../../packages/utils/src/index.ts)
> - [`packages/utils/src/primitives.test.ts`](../../packages/utils/src/primitives.test.ts)
> - [`apps/web/src/index.ts`](../../apps/web/src/index.ts) & [`apps/web/src/web.test.ts`](../../apps/web/src/web.test.ts)

---

## 1. Core Concepts

### 1.1 Pure Functional Core (`ADR-007`)

In the Agentic Software Factory, accessibility gates, privacy scrubbers, and focus-scarcity rules are never buried inside UI components, Express/Spring controllers, or browser event handlers. Instead, they live as **stateless, deterministic pure functions** inside `@cmp/utils`:

- **Zero framework or runtime lock-in**: None of the modules in `packages/utils/src/` touch the DOM, `window`, local storage, databases, or network sockets. Only `observability.ts` imports Node's built-in `node:crypto` for SHA-256 hashing.
- **Sub-second feedback loop**: Pure functions compile with `tsc` and execute directly in Node (`node --test`) in tens of milliseconds—no browser, headless Chrome, or Android emulator required.
- **Single source of truth**: Every generated app (`pnpm gen:app`) and slice (`pnpm gen:slice`) consumes `@cmp/utils` via `"@cmp/utils": "workspace:*"` instead of re-implementing contrast math or regex redaction.

### 1.2 WCAG 2.2 Level AA Contrast Mechanics (`SC 1.4.3`)

Manual color-picker spot checks do not scale when AI agents and engineers iterate quickly on light and dark themes. Under WCAG 2.2 Success Criterion **1.4.3 (Contrast Minimum)**, normal text requires a contrast ratio of at least **`4.5:1`** (and large text or UI components require at least **`3.0:1`**).

`@cmp/utils` encodes the exact W3C luminance algorithm as pure arithmetic:

1. **Hex-to-Integer Normalization**: `#RRGGBB` or `0xRRGGBB` strings are parsed into 24-bit RGB integers (`0x000000`–`0xFFFFFF`).
2. **sRGB Channel Linearization**: Each 8-bit channel $C_{8} \in [0, 255]$ is normalized to $c = C_{8} / 255$ and linearized using the WCAG 2.2 piecewise threshold **`0.04045`**:
   $$C_{\text{lin}} = \begin{cases} c / 12.92 & \text{if } c \le 0.04045 \\ \left(\dfrac{c + 0.055}{1.055}\right)^{2.4} & \text{otherwise} \end{cases}$$
3. **Relative Luminance ($L$)**: Weighted human-perception luminance across the linearized channels:
   $$L = 0.2126 \cdot R_{\text{lin}} + 0.7152 \cdot G_{\text{lin}} + 0.0722 \cdot B_{\text{lin}}$$
4. **Contrast Ratio**: Given lighter luminance $L_1 = \max(L_{\text{fg}}, L_{\text{bg}})$ and darker luminance $L_2 = \min(L_{\text{fg}}, L_{\text{bg}})$:
   $$\text{ratio} = \frac{L_1 + 0.05}{L_2 + 0.05}$$
   The ratio is rounded to 2 decimal places (`1.00` for identical colors up to `21.00` for black on white).

Because the entire theme palette is audited in unit tests (`auditThemePalette`), any low-contrast token pair fails `pnpm test` and `pnpm verify:slice` **before** a UI bundle is ever built.

### 1.3 Zero-PII Telemetry & Deterministic Pseudonymization

Diagnostic logs and analytics breadcrumbs are essential for debugging, but raw user emails and OAuth tokens must never leave the application boundary:

- **Token & Email Scrubbing (`scrubSensitiveText`)**:
  - Redacts `Bearer <token>` and Google OAuth `ya29.<token>` strings to `[REDACTED_TOKEN]`.
  - Redacts email addresses (`local@domain.tld`) to `[REDACTED_EMAIL]`.
  - Token redaction runs before email redaction so compound strings like `"Sync failed for stefan@example.com with Bearer ya29.secret"` deterministically become `"Sync failed for [REDACTED_EMAIL] with [REDACTED_TOKEN]"`.
- **Deterministic Pseudonymization (`pseudonymizeIdentifier`)**:
  - Normalizes raw identifiers (`trim().toLowerCase()`) and hashes them with `crypto.createHash('sha256')`, returning the first **16 hex characters** (or `'anonymous'` when the trimmed input is blank).
  - Enables privacy-safe session and actor correlation without storing raw email addresses or account IDs.
- **Structured Breadcrumbs (`createZeroPiiBreadcrumb`)**:
  - Scrubs both the `event` name and every key/value pair in `attributes` before attaching an ISO-8601 `timestampIso`.

### 1.4 Scarcity Gates & Strict Descending Ranking

To prevent priority overload in focus-driven products (such as the Top-3 commitment model in [`apps/pulse`](../../apps/pulse/)), `@cmp/utils` models finite capacity and ranking invariants with explicit types:

- **Explicit Decision Union (`PinDecision`)**: Instead of returning ambiguous booleans, `evaluateScarcityGate` returns `'ALLOW_PIN' | 'UNPIN' | 'SWAP_REQUIRED'`, forcing callers to handle capacity swaps explicitly.
- **Strict Descending Order (`isStrictlyDescendingByScore`)**: Verifies that analytical items ordered by `sortScore` have no ties (`>=`), no upward inversions, and no `NaN` values, eliminating visual jitter across renders.

---

## 2. How It Functions (Real Code Walkthrough)

All primitives are compiled to ESM (`"type": "module"` in [`packages/utils/package.json`](../../packages/utils/package.json)) and re-exported from [`packages/utils/src/index.ts`](../../packages/utils/src/index.ts):

```ts
// packages/utils/src/index.ts
export function hello(): string {
  return "world";
}

export * from "./wcag.js";
export * from "./observability.js";
export * from "./scarcity.js";
```

> **Note on `.js` extensions**: Even though the source files are `.ts`, relative re-exports use `.js` specifiers (`./wcag.js`) so the compiled `dist/src/*.js` files execute natively under Node ESM (`node --test dist/src/primitives.test.js`) without a bundler.

### 2.1 WCAG 2.2 AA Engine (`packages/utils/src/wcag.ts`)

[`packages/utils/src/wcag.ts`](../../packages/utils/src/wcag.ts) exposes six cohesive primitives:

| Symbol | Purpose |
| :--- | :--- |
| `ContrastAuditEntry` | Result record containing `pairName`, `foregroundRgb`, `backgroundRgb`, `contrastRatio`, `minimumRequired`, and `passesWcagAA`. |
| `parseHexColor(hex)` | Validates `#RRGGBB` or `0xRRGGBB` (case-insensitive) via `/^(?:#\|0[xX])([0-9a-fA-F]{6})$/` and returns the 24-bit integer, throwing on invalid input. |
| `relativeLuminance(rgb)` | Validates `[0, 0xFFFFFF]` integer bounds, linearizes R/G/B with the `0.04045` threshold, and returns `0.2126 * R + 0.7152 * G + 0.0722 * B`. |
| `contrastRatio(fg, bg)` | Computes `(max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)` rounded to 2 decimals. |
| `auditPair(name, fg, bg, min = 4.5)` | Evaluates a single pair and sets `passesWcagAA: ratio >= minimumRequired`. |
| `auditThemePalette(pairs)` | Accepts mixed `number \| string` colors and optional per-pair `minRatio` (default `4.5`), returning `{ passed, entries }` where `passed` is `true` only if every entry passes. |

```ts
// Excerpt from packages/utils/src/wcag.ts
function linearizeSrgbChannel(channel255: number): number {
  const srgb = channel255 / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function auditThemePalette(
  pairs: readonly ThemePalettePairInput[],
): ThemePaletteAuditResult {
  const entries = pairs.map((pair) =>
    auditPair(
      pair.pairName,
      resolveRgbColor(pair.fg),
      resolveRgbColor(pair.bg),
      pair.minRatio ?? 4.5,
    ),
  );
  return {
    passed: entries.every((entry) => entry.passesWcagAA),
    entries,
  };
}
```

### 2.2 Zero-PII Telemetry (`packages/utils/src/observability.ts`)

[`packages/utils/src/observability.ts`](../../packages/utils/src/observability.ts) protects telemetry pipelines with three functions:

```ts
// Excerpt from packages/utils/src/observability.ts
const BEARER_OR_OAUTH_TOKEN_REGEX = /(Bearer\s+|ya29\.)[A-Za-z0-9._\-+/=]+/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function scrubSensitiveText(input: string): string {
  return input
    .replace(BEARER_OR_OAUTH_TOKEN_REGEX, "[REDACTED_TOKEN]")
    .replace(EMAIL_REGEX, "[REDACTED_EMAIL]");
}

export function pseudonymizeIdentifier(rawIdentifier: string): string {
  const normalized = rawIdentifier.trim().toLowerCase();
  if (normalized.length === 0) {
    return "anonymous";
  }
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 16);
}
```

`createZeroPiiBreadcrumb(event, attributes?, now = new Date())` injects `now` as a default parameter so callers in production get the current timestamp while unit tests can pass a fixed `Date` for exact string assertions.

### 2.3 Scarcity & Ranking Guards (`packages/utils/src/scarcity.ts`)

[`packages/utils/src/scarcity.ts`](../../packages/utils/src/scarcity.ts) provides the focus-slot gate and ranking invariant:

```ts
// Excerpt from packages/utils/src/scarcity.ts
export type PinDecision = "ALLOW_PIN" | "UNPIN" | "SWAP_REQUIRED";

export function evaluateScarcityGate(
  currentPinnedIds: readonly string[],
  candidateId: string,
  maxSlots = 3,
): PinDecision {
  if (currentPinnedIds.includes(candidateId)) {
    return "UNPIN";
  }
  if (currentPinnedIds.length < maxSlots) {
    return "ALLOW_PIN";
  }
  return "SWAP_REQUIRED";
}
```

1. If `candidateId` is already in `currentPinnedIds`, toggling it returns `'UNPIN'`.
2. Otherwise, if `currentPinnedIds.length < maxSlots` (default `3`), it returns `'ALLOW_PIN'`.
3. Once all slots are occupied, pinning a new candidate returns `'SWAP_REQUIRED'`.

`isStrictlyDescendingByScore(items)` walks `items` once ($O(n)$), returning `false` on any `NaN` score or any adjacent pair where `items[i].sortScore >= items[i - 1].sortScore` (vacuously `true` for empty or single-item arrays).

### 2.4 Reference Consumer (`apps/web/src/index.ts`)

[`apps/web/src/index.ts`](../../apps/web/src/index.ts) demonstrates how a product workspace consumes `@cmp/utils` as a pure functional slice without side effects on import:

- Defines `DEFAULT_WEB_THEME_PAIRS` covering both light (`#0F172A` on `#FFFFFF`, `#475569` on `#F8FAFC`, `#FFFFFF` on `#1D4ED8`) and dark (`#F8FAFC` on `#0F172A`, `#CBD5E1` on `#1E293B`) surface tokens.
- Exports `runWebSliceHealthCheck(): WebSliceHealthReport`, which:
  1. Audits the light and dark palette with `auditThemePalette`.
  2. Exercises all three scarcity branches (`ALLOW_PIN`, `UNPIN`, `SWAP_REQUIRED`) via `evaluateScarcityGate`.
  3. Scrubs a simulated OAuth/email payload via `scrubSensitiveText` and constructs a safe diagnostic breadcrumb via `createZeroPiiBreadcrumb`.
  4. Returns `passed: true` only when all WCAG AA, Zero-PII, and scarcity assertions hold simultaneously.
- Paired with [`apps/web/AGENTS.md`](../../apps/web/AGENTS.md), which codifies the Pure Functional Core (`ADR-007`), WCAG 2.2 AA gate, Zero-PII telemetry rule, and Modern Desktop Web UX (`ADR-009`) for the package.

---

## 3. How to Implement

### 3.1 Wire `@cmp/utils` into a Workspace Package

1. **Declare dependencies and ESM scripts** in your package's `package.json`:

   ```json
   {
     "type": "module",
     "main": "dist/src/index.js",
     "types": "dist/src/index.d.ts",
     "scripts": {
       "build": "tsc -p tsconfig.build.json",
       "lint": "tsc --noEmit",
       "test": "tsc -p tsconfig.json && node --test dist/src/slice.test.js",
       "typecheck": "tsc --noEmit"
     },
     "dependencies": {
       "@cmp/utils": "workspace:*"
     },
     "devDependencies": {
       "@cmp/config": "workspace:*",
       "@types/node": "^24.12.4",
       "typescript": "^5.6.3"
     }
   }
   ```

2. **Configure `tsconfig.json` and `tsconfig.build.json`** so `src/*.ts` compiles cleanly to `dist/src/*.js` with Node types enabled (`"rootDir": "."`, `"types": ["node"]`), while `tsconfig.build.json` excludes `**/*.test.ts` and `**/*.spec.ts` from production artifacts.

### 3.2 Add a WCAG 2.2 AA Theme Gate Test

Define every foreground/background pair for both light and dark modes and assert `audit.passed === true` inside a `node:test` file:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { auditThemePalette } from "@cmp/utils";

test("theme palette meets WCAG 2.2 Level AA contrast", () => {
  const result = auditThemePalette([
    { pairName: "light-body", fg: "#0F172A", bg: "#FFFFFF" },
    { pairName: "dark-body", fg: "#F8FAFC", bg: "#0F172A" },
    { pairName: "large-icon", fg: "#64748B", bg: "#FFFFFF", minRatio: 3.0 },
  ]);

  assert.equal(result.passed, true);
  for (const entry of result.entries) {
    assert.equal(
      entry.passesWcagAA,
      true,
      `${entry.pairName} ratio ${entry.contrastRatio} < ${entry.minimumRequired}`,
    );
  }
});
```

### 3.3 Enforce Zero-PII Before Any Telemetry Sink

Always wrap raw error messages, user identifiers, and diagnostic metadata before writing to logs or analytics SDKs:

```ts
import {
  createZeroPiiBreadcrumb,
  pseudonymizeIdentifier,
  scrubSensitiveText,
} from "@cmp/utils";

export function buildSafeSyncBreadcrumb(userEmail: string, rawError: string) {
  return createZeroPiiBreadcrumb("sync_attempt", {
    actorId: pseudonymizeIdentifier(userEmail),
    detail: scrubSensitiveText(rawError),
  });
}
```

### 3.4 Guard Focus Capacity and Ranking Order

Use `evaluateScarcityGate` in state transitions and `isStrictlyDescendingByScore` in analytical view-model selectors:

```ts
import { evaluateScarcityGate, isStrictlyDescendingByScore } from "@cmp/utils";

const decision = evaluateScarcityGate(pinnedIds, candidateId, 3);
if (decision === "SWAP_REQUIRED") {
  // Prompt user to replace one of the 3 active commitments
}

const ordered = [...items].sort((a, b) => b.sortScore - a.sortScore);
if (!isStrictlyDescendingByScore(ordered)) {
  throw new Error("Analytical items must have strictly descending sortScore values.");
}
```

### 3.5 Run the Verification Loop

```bash
pnpm --filter @cmp/utils test
pnpm --filter @cmp/web test
pnpm verify:slice --json
```
