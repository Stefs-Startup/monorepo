import * as fs from "node:fs";
import * as path from "node:path";

export type FactoryStack = "web-ts" | "angular-spring" | "kmp";

export interface GenerateAppOptions {
  name: string;
  stack?: FactoryStack;
  rootDir?: string;
}

export interface GenerateAppResult {
  appDir: string;
  filesCreated: string[];
}

export interface GenerateSliceOptions {
  app: string;
  slice: string;
  rootDir?: string;
}

export interface GenerateSliceResult {
  sliceDir: string;
  filesCreated: string[];
}

const VALID_STACKS: readonly FactoryStack[] = [
  "web-ts",
  "angular-spring",
  "kmp",
];

const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

function assertValidSlug(value: string, label: string): void {
  if (!SLUG_PATTERN.test(value)) {
    throw new Error(
      `Invalid ${label} "${value}". Expected lowercase kebab-case matching /^[a-z][a-z0-9-]*$/.`,
    );
  }
}

function assertValidStack(stack: string): asserts stack is FactoryStack {
  if (!(VALID_STACKS as readonly string[]).includes(stack)) {
    throw new Error(
      `Invalid stack "${stack}". Expected one of: ${VALID_STACKS.join(", ")}.`,
    );
  }
}

function toPascalCase(slug: string): string {
  return slug
    .split("-")
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function toUpperSnakeCase(slug: string): string {
  return slug.replace(/-/g, "_").toUpperCase();
}

function stackDescription(stack: FactoryStack): string {
  switch (stack) {
    case "web-ts":
      return "TypeScript Pure Functional Core + Modern Desktop Web UX";
    case "angular-spring":
      return "Angular 21 Signals Frontend + Spring Boot 4 / Java 21 Backend";
    case "kmp":
      return "Kotlin Multiplatform (KMP) + Compose Multiplatform Shared UI";
  }
}

function writeScaffoldFile(
  filePath: string,
  content: string,
  filesCreated: string[],
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  filesCreated.push(filePath);
}

/**
 * Scaffolds a new `@cmp/<name>` application under `<rootDir>/apps/<name>/`
 * with Pure Functional Core (`ADR-007`), WCAG 2.2 AA contrast verification,
 * Zero-PII telemetry scrubbing, and Modern Desktop Web UX (`ADR-009`) guardrails.
 */
export function generateApp(options: GenerateAppOptions): GenerateAppResult {
  const { name, stack = "web-ts", rootDir = process.cwd() } = options;
  assertValidSlug(name, "app name");
  assertValidStack(stack);

  const resolvedRoot = path.resolve(rootDir);
  const appDir = path.join(resolvedRoot, "apps", name);
  if (fs.existsSync(appDir)) {
    throw new Error(`App directory already exists: ${appDir}`);
  }

  const pascal = toPascalCase(name);
  const upperSnake = toUpperSnakeCase(name);
  const filesCreated: string[] = [];

  const packageJson = {
    name: `@cmp/${name}`,
    version: "0.0.0",
    private: true,
    type: "module",
    description: `${pascal} application (${stackDescription(stack)})`,
    main: "dist/src/index.js",
    types: "dist/src/index.d.ts",
    scripts: {
      build: "tsc -p tsconfig.build.json",
      test: 'tsc -p tsconfig.json && node --test "dist/src/**/*.test.js"',
      lint: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      clean: "rimraf dist node_modules",
    },
    dependencies: {
      "@cmp/utils": "workspace:*",
    },
    devDependencies: {
      "@cmp/config": "workspace:*",
      "@types/node": "^24.12.4",
      rimraf: "^6.0.0",
      typescript: "^5.6.3",
    },
  };

  writeScaffoldFile(
    path.join(appDir, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    filesCreated,
  );

  const tsconfig = {
    extends: "../../packages/config/tsconfig.base.json",
    compilerOptions: {
      module: "NodeNext",
      moduleResolution: "NodeNext",
      types: ["node"],
      composite: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      rootDir: ".",
      outDir: "dist",
    },
    include: ["src"],
  };

  writeScaffoldFile(
    path.join(appDir, "tsconfig.json"),
    `${JSON.stringify(tsconfig, null, 2)}\n`,
    filesCreated,
  );

  const tsconfigBuild = {
    extends: "./tsconfig.json",
    exclude: ["**/*.test.ts", "**/*.spec.ts"],
  };

  writeScaffoldFile(
    path.join(appDir, "tsconfig.build.json"),
    `${JSON.stringify(tsconfigBuild, null, 2)}\n`,
    filesCreated,
  );

  const agentsMd = `# ${pascal} Engineering & Collaboration Constitution

> **Package**: \`@cmp/${name}\` | **Stack**: \`${stack}\` (${stackDescription(stack)})

## 1. Pure Functional Core First (\`ADR-007\`)
- All domain engines (\`src/domain/\`), slice reducers/evaluators (\`src/slices/\`), scarcity gates, and telemetry scrubbers MUST be pure, deterministic, stateless functions.
- Domain modules MUST have zero UI, DOM, HTTP, or framework runtime dependencies.

## 2. Automated WCAG 2.2 AA Contrast Gate
- Every foreground/background surface token pair across Light and Dark themes MUST pass deterministic contrast checks (\`>= 4.5:1\` for normal text, \`>= 3.0:1\` for large text/UI components) via \`auditThemePalette\` from \`@cmp/utils\`.
- Contrast audits run automatically in unit tests and \`pnpm verify:slice\`.

## 3. Zero-PII Telemetry Scrubber
- Never emit raw emails, OAuth tokens (\`Bearer ...\`, \`ya29....\`), or raw user identifiers in logs or analytics breadcrumbs.
- Every diagnostic event MUST pass through \`scrubSensitiveText\`, \`pseudonymizeIdentifier\`, and \`createZeroPiiBreadcrumb\` from \`@cmp/utils\`.

## 4. Modern Desktop Web UX (\`ADR-009\`)
- Follow the cross-stack engineering guides in \`docs/stack-best-practices/\`:
  - \`docs/stack-best-practices/STACK_BEST_PRACTICES.md\`
  - \`docs/stack-best-practices/03_COMPOSE_MULTIPLATFORM_AND_DESKTOP_WEB_BEST_PRACTICES.md\`
  - \`docs/stack-best-practices/04_FIREBASE_OBSERVABILITY_AND_ZERO_PII_BEST_PRACTICES.md\`
  - \`docs/stack-best-practices/06_ANGULAR_21_SIGNALS_AND_WEB_BEST_PRACTICES.md\`
- On desktop/web viewports (\`>= 840px\`), prefer calm multi-pane split workspaces, \`1px\` hairline borders, tabular numerals, clear hover/focus states, and keyboard navigation over stretched mobile boilerplate.

## 5. Vertical Slices & Verification Gate
- Generate new vertical slices with \`pnpm gen:slice ${name} <slice>\`.
- Every change must pass \`pnpm --filter @cmp/${name} test\` and \`pnpm verify:slice\`.
`;

  writeScaffoldFile(path.join(appDir, "AGENTS.md"), agentsMd, filesCreated);

  const readmeMd = `# @cmp/${name}

> Generated by \`@cmp/factory\` with stack \`${stack}\` — ${stackDescription(stack)}.

## Architecture
- \`src/domain/${name}-domain.engine.ts\`: Pure functional domain engine (\`ADR-007\`), WCAG 2.2 AA theme palette gate, Zero-PII telemetry builder, and scarcity gate powered by \`@cmp/utils\`.
- \`src/slices/<slice>/\`: Vertical feature slices scaffolded via \`pnpm gen:slice ${name} <slice>\`.
- \`AGENTS.md\`: Engineering constitution and guardrails referencing \`docs/stack-best-practices/\`.

## Commands

\`\`\`bash
# Link workspace dependencies (first time after generation)
pnpm install

# Build, typecheck, and test this app
pnpm --filter @cmp/${name} build
pnpm --filter @cmp/${name} typecheck
pnpm --filter @cmp/${name} test

# Run the factory verification gate
pnpm verify:slice --target=@cmp/${name}
pnpm verify:slice
\`\`\`
`;

  writeScaffoldFile(path.join(appDir, "README.md"), readmeMd, filesCreated);

  const domainEngine = `import {
  auditThemePalette,
  createZeroPiiBreadcrumb,
  evaluateScarcityGate,
  isStrictlyDescendingByScore,
  pseudonymizeIdentifier,
  scrubSensitiveText,
  type PinDecision,
  type ThemePaletteAuditResult,
  type ThemePalettePairInput,
  type ZeroPiiBreadcrumb,
} from "@cmp/utils";

export const ${upperSnake}_STACK = "${stack}" as const;

export const DEFAULT_${upperSnake}_PALETTE: readonly ThemePalettePairInput[] = [
  { pairName: "light.textPrimary", fg: "#111827", bg: "#FFFFFF", minRatio: 4.5 },
  { pairName: "light.textMuted", fg: "#4B5563", bg: "#F9FAFB", minRatio: 4.5 },
  { pairName: "light.accent", fg: "#1D4ED8", bg: "#FFFFFF", minRatio: 4.5 },
  { pairName: "dark.textPrimary", fg: "#F9FAFB", bg: "#0F172A", minRatio: 4.5 },
  { pairName: "dark.textMuted", fg: "#CBD5E1", bg: "#1E293B", minRatio: 4.5 },
  { pairName: "dark.accent", fg: "#93C5FD", bg: "#0F172A", minRatio: 4.5 },
];

export interface ${pascal}HealthReport {
  app: string;
  stack: string;
  wcag: ThemePaletteAuditResult;
  sampleBreadcrumb: ZeroPiiBreadcrumb;
  scarcityDecision: PinDecision;
  rankingValid: boolean;
  passed: boolean;
}

/**
 * Audits the default Light and Dark theme tokens for WCAG 2.2 Level AA compliance.
 */
export function audit${pascal}Theme(
  palette: readonly ThemePalettePairInput[] = DEFAULT_${upperSnake}_PALETTE,
): ThemePaletteAuditResult {
  return auditThemePalette(palette);
}

/**
 * Emits a Zero-PII diagnostic breadcrumb with pseudonymized actor ID and scrubbed attributes.
 */
export function record${pascal}TelemetryBreadcrumb(
  event: string,
  rawActorId: string,
  attributes: Record<string, string> = {},
): ZeroPiiBreadcrumb {
  return createZeroPiiBreadcrumb(scrubSensitiveText(event), {
    ...attributes,
    actor: pseudonymizeIdentifier(rawActorId),
  });
}

/**
 * Enforces focus scarcity slot limits (default max 3 pinned items).
 */
export function evaluate${pascal}PinGate(
  currentPinnedIds: readonly string[],
  candidateId: string,
  maxSlots = 3,
): PinDecision {
  return evaluateScarcityGate(currentPinnedIds, candidateId, maxSlots);
}

/**
 * Verifies ranked items follow strictly descending sortScore ordering.
 */
export function verify${pascal}ScoreOrder<T extends { sortScore: number }>(
  items: readonly T[],
): boolean {
  return isStrictlyDescendingByScore(items);
}

/**
 * Runs a self-contained domain health check across WCAG 2.2 AA, Zero-PII, and scarcity rules.
 */
export function run${pascal}DomainHealthCheck(): ${pascal}HealthReport {
  const wcag = audit${pascal}Theme();
  const sampleBreadcrumb = record${pascal}TelemetryBreadcrumb(
    "domain_health_check",
    "operator@example.com",
    {
      note: "Authorized Bearer secret-token-123 for operator@example.com",
    },
  );
  const scarcityDecision = evaluate${pascal}PinGate(["focus-1", "focus-2"], "focus-3");
  const rankingValid = verify${pascal}ScoreOrder([
    { id: "focus-1", sortScore: 95 },
    { id: "focus-2", sortScore: 80 },
    { id: "focus-3", sortScore: 65 },
  ]);

  const zeroPiiOk =
    !sampleBreadcrumb.summary.includes("operator@example.com") &&
    !sampleBreadcrumb.summary.includes("secret-token-123") &&
    sampleBreadcrumb.summary.includes("[REDACTED_TOKEN]") &&
    sampleBreadcrumb.summary.includes("[REDACTED_EMAIL]");

  return {
    app: "${name}",
    stack: ${upperSnake}_STACK,
    wcag,
    sampleBreadcrumb,
    scarcityDecision,
    rankingValid,
    passed:
      wcag.passed &&
      zeroPiiOk &&
      scarcityDecision === "ALLOW_PIN" &&
      rankingValid,
  };
}
`;

  writeScaffoldFile(
    path.join(appDir, "src", "domain", `${name}-domain.engine.ts`),
    domainEngine,
    filesCreated,
  );

  const domainTest = `import test from "node:test";
import assert from "node:assert/strict";
import {
  audit${pascal}Theme,
  evaluate${pascal}PinGate,
  record${pascal}TelemetryBreadcrumb,
  run${pascal}DomainHealthCheck,
  verify${pascal}ScoreOrder,
} from "./${name}-domain.engine.js";

test("${pascal} theme palette passes WCAG 2.2 AA (>= 4.5:1)", () => {
  const audit = audit${pascal}Theme();
  assert.equal(audit.passed, true);
  assert.ok(audit.entries.length >= 6);
  for (const entry of audit.entries) {
    assert.equal(entry.passesWcagAA, true, \`\${entry.pairName} failed WCAG AA\`);
    assert.ok(entry.contrastRatio >= 4.5, \`\${entry.pairName} ratio < 4.5\`);
  }
});

test("${pascal} telemetry scrubber enforces Zero-PII", () => {
  const crumb = record${pascal}TelemetryBreadcrumb(
    "sync_attempt",
    "Alice@Example.com",
    {
      detail: "Bearer tok_12345 ya29.oauth_secret alice@example.com",
    },
  );
  assert.equal(crumb.summary.includes("alice@example.com"), false);
  assert.equal(crumb.summary.includes("Alice@Example.com"), false);
  assert.equal(crumb.summary.includes("tok_12345"), false);
  assert.equal(crumb.summary.includes("ya29.oauth_secret"), false);
  assert.equal(crumb.summary.includes("[REDACTED_TOKEN]"), true);
  assert.equal(crumb.summary.includes("[REDACTED_EMAIL]"), true);
});

test("${pascal} scarcity gate and ranking guards are deterministic", () => {
  assert.equal(evaluate${pascal}PinGate(["a", "b"], "c"), "ALLOW_PIN");
  assert.equal(evaluate${pascal}PinGate(["a", "b", "c"], "b"), "UNPIN");
  assert.equal(evaluate${pascal}PinGate(["a", "b", "c"], "d"), "SWAP_REQUIRED");
  assert.equal(
    verify${pascal}ScoreOrder([{ sortScore: 10 }, { sortScore: 5 }]),
    true,
  );
  assert.equal(
    verify${pascal}ScoreOrder([{ sortScore: 5 }, { sortScore: 5 }]),
    false,
  );
});

test("${pascal} domain health check passes end-to-end", () => {
  const report = run${pascal}DomainHealthCheck();
  assert.equal(report.passed, true);
});
`;

  writeScaffoldFile(
    path.join(appDir, "src", "domain", `${name}-domain.engine.test.ts`),
    domainTest,
    filesCreated,
  );

  const indexTs = `export * from "./domain/${name}-domain.engine.js";
`;

  writeScaffoldFile(path.join(appDir, "src", "index.ts"), indexTs, filesCreated);

  return { appDir, filesCreated };
}

/**
 * Scaffolds a vertical slice under `<rootDir>/apps/<app>/src/slices/<slice>/`
 * containing a typed contract, pure functional engine, and `node:test` suite.
 */
export function generateSlice(
  options: GenerateSliceOptions,
): GenerateSliceResult {
  const { app, slice, rootDir = process.cwd() } = options;
  assertValidSlug(app, "app name");
  assertValidSlug(slice, "slice name");

  const resolvedRoot = path.resolve(rootDir);
  const appDir = path.join(resolvedRoot, "apps", app);
  if (!fs.existsSync(appDir)) {
    throw new Error(
      `Target app "${app}" does not exist at ${appDir}. Run gen:app ${app} first.`,
    );
  }

  const sliceDir = path.join(appDir, "src", "slices", slice);
  if (fs.existsSync(sliceDir)) {
    throw new Error(`Slice directory already exists: ${sliceDir}`);
  }

  const pascalSlice = toPascalCase(slice);
  const filesCreated: string[] = [];

  const contractTs = `import {
  createZeroPiiBreadcrumb,
  pseudonymizeIdentifier,
  scrubSensitiveText,
  type PinDecision,
  type ZeroPiiBreadcrumb,
} from "@cmp/utils";

export interface ${pascalSlice}ScoreItem {
  id: string;
  sortScore: number;
}

export interface ${pascalSlice}Request {
  actorId: string;
  action: "pin" | "evaluate";
  candidateId: string;
  currentPinnedIds: readonly string[];
  maxSlots?: number;
  note?: string;
  items?: readonly ${pascalSlice}ScoreItem[];
}

export interface ${pascalSlice}Response {
  slice: string;
  accepted: boolean;
  decision: PinDecision;
  wcagPassed: boolean;
  rankingValid: boolean;
  sanitizedNote: string;
  telemetry: ZeroPiiBreadcrumb;
}

/**
 * Builds a Zero-PII telemetry breadcrumb for the \`${slice}\` slice.
 */
export function build${pascalSlice}Breadcrumb(
  event: string,
  rawActorId: string,
  details: Record<string, string> = {},
): ZeroPiiBreadcrumb {
  return createZeroPiiBreadcrumb(scrubSensitiveText(event), {
    ...details,
    slice: "${slice}",
    actor: pseudonymizeIdentifier(rawActorId),
  });
}
`;

  writeScaffoldFile(
    path.join(sliceDir, `${slice}.contract.ts`),
    contractTs,
    filesCreated,
  );

  const engineTs = `import {
  auditThemePalette,
  evaluateScarcityGate,
  isStrictlyDescendingByScore,
  scrubSensitiveText,
  type PinDecision,
  type ThemePalettePairInput,
} from "@cmp/utils";
import {
  build${pascalSlice}Breadcrumb,
  type ${pascalSlice}Request,
  type ${pascalSlice}Response,
} from "./${slice}.contract.js";

export interface ${pascalSlice}State {
  slice: string;
  pinnedIds: readonly string[];
  lastDecision: PinDecision | null;
  wcagAuditPassed: boolean;
  eventCount: number;
}

export type ${pascalSlice}Action =
  | { type: "TOGGLE_PIN"; candidateId: string; maxSlots?: number }
  | { type: "RESET" };

const SLICE_SURFACE_TOKENS: readonly ThemePalettePairInput[] = [
  { pairName: "${slice}.surfaceText", fg: "#111827", bg: "#FFFFFF", minRatio: 4.5 },
  { pairName: "${slice}.darkSurfaceText", fg: "#F9FAFB", bg: "#0F172A", minRatio: 4.5 },
];

/**
 * Returns the initial pure state for the \`${slice}\` slice.
 */
export function createInitial${pascalSlice}State(): ${pascalSlice}State {
  const wcagAudit = auditThemePalette(SLICE_SURFACE_TOKENS);
  return {
    slice: "${slice}",
    pinnedIds: [],
    lastDecision: null,
    wcagAuditPassed: wcagAudit.passed,
    eventCount: 0,
  };
}

/**
 * Pure state reducer enforcing scarcity limits and WCAG audit state.
 */
export function reduce${pascalSlice}State(
  state: ${pascalSlice}State,
  action: ${pascalSlice}Action,
): ${pascalSlice}State {
  switch (action.type) {
    case "RESET":
      return createInitial${pascalSlice}State();
    case "TOGGLE_PIN": {
      const decision = evaluateScarcityGate(
        state.pinnedIds,
        action.candidateId,
        action.maxSlots ?? 3,
      );
      let nextPinned = state.pinnedIds;
      if (decision === "ALLOW_PIN") {
        nextPinned = [...state.pinnedIds, action.candidateId];
      } else if (decision === "UNPIN") {
        nextPinned = state.pinnedIds.filter((id) => id !== action.candidateId);
      }
      return {
        ...state,
        pinnedIds: nextPinned,
        lastDecision: decision,
        eventCount: state.eventCount + 1,
      };
    }
  }
}

/**
 * Pure functional slice evaluator checking WCAG 2.2 AA contrast, Zero-PII telemetry,
 * scarcity gate, and ranking invariants.
 */
export function evaluate${pascalSlice}Slice(
  request: ${pascalSlice}Request,
): ${pascalSlice}Response {
  const wcag = auditThemePalette(SLICE_SURFACE_TOKENS);
  const decision = evaluateScarcityGate(
    request.currentPinnedIds,
    request.candidateId,
    request.maxSlots ?? 3,
  );
  const rankingValid = request.items
    ? isStrictlyDescendingByScore(request.items)
    : true;
  const sanitizedNote = scrubSensitiveText(request.note ?? "");
  const telemetry = build${pascalSlice}Breadcrumb(
    \`\${request.action}_evaluated\`,
    request.actorId,
    {
      decision,
      note: sanitizedNote,
    },
  );

  return {
    slice: "${slice}",
    accepted: wcag.passed && rankingValid && decision !== "SWAP_REQUIRED",
    decision,
    wcagPassed: wcag.passed,
    rankingValid,
    sanitizedNote,
    telemetry,
  };
}
`;

  writeScaffoldFile(
    path.join(sliceDir, `${slice}.engine.ts`),
    engineTs,
    filesCreated,
  );

  const testTs = `import test from "node:test";
import assert from "node:assert/strict";
import { build${pascalSlice}Breadcrumb } from "./${slice}.contract.js";
import {
  createInitial${pascalSlice}State,
  evaluate${pascalSlice}Slice,
  reduce${pascalSlice}State,
} from "./${slice}.engine.js";

test("${pascalSlice} reducer manages pin scarcity deterministically", () => {
  let state = createInitial${pascalSlice}State();
  assert.equal(state.wcagAuditPassed, true);

  state = reduce${pascalSlice}State(state, { type: "TOGGLE_PIN", candidateId: "item-1" });
  state = reduce${pascalSlice}State(state, { type: "TOGGLE_PIN", candidateId: "item-2" });
  state = reduce${pascalSlice}State(state, { type: "TOGGLE_PIN", candidateId: "item-3" });
  assert.deepEqual(state.pinnedIds, ["item-1", "item-2", "item-3"]);
  assert.equal(state.lastDecision, "ALLOW_PIN");

  const blocked = reduce${pascalSlice}State(state, { type: "TOGGLE_PIN", candidateId: "item-4" });
  assert.equal(blocked.lastDecision, "SWAP_REQUIRED");
  assert.deepEqual(blocked.pinnedIds, ["item-1", "item-2", "item-3"]);

  const unpinned = reduce${pascalSlice}State(blocked, { type: "TOGGLE_PIN", candidateId: "item-2" });
  assert.equal(unpinned.lastDecision, "UNPIN");
  assert.deepEqual(unpinned.pinnedIds, ["item-1", "item-3"]);
});

test("${pascalSlice} evaluator enforces WCAG 2.2 AA and Zero-PII contract", () => {
  const response = evaluate${pascalSlice}Slice({
    actorId: "founder@company.io",
    action: "pin",
    candidateId: "item-3",
    currentPinnedIds: ["item-1", "item-2"],
    note: "Token Bearer abc.def.ghi from founder@company.io",
    items: [
      { id: "item-1", sortScore: 100 },
      { id: "item-2", sortScore: 50 },
    ],
  });

  assert.equal(response.accepted, true);
  assert.equal(response.decision, "ALLOW_PIN");
  assert.equal(response.wcagPassed, true);
  assert.equal(response.rankingValid, true);
  assert.equal(response.sanitizedNote.includes("abc.def.ghi"), false);
  assert.equal(response.sanitizedNote.includes("founder@company.io"), false);
  assert.equal(response.telemetry.summary.includes("founder@company.io"), false);
  assert.equal(response.telemetry.summary.includes("[REDACTED_TOKEN]"), true);
  assert.equal(response.telemetry.summary.includes("[REDACTED_EMAIL]"), true);
});

test("${pascalSlice} breadcrumb pseudonymizes actor consistently", () => {
  const a = build${pascalSlice}Breadcrumb("opened", "USER@example.com");
  const b = build${pascalSlice}Breadcrumb("opened", "user@example.com");
  assert.equal(a.summary, b.summary);
  assert.equal(a.summary.includes("example.com"), false);
});
`;

  writeScaffoldFile(
    path.join(sliceDir, `${slice}.test.ts`),
    testTs,
    filesCreated,
  );

  return { sliceDir, filesCreated };
}
