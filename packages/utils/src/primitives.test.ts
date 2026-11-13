import assert from "node:assert/strict";
import test from "node:test";
import {
  auditPair,
  auditThemePalette,
  contrastRatio,
  createZeroPiiBreadcrumb,
  evaluateScarcityGate,
  hello,
  isStrictlyDescendingByScore,
  parseHexColor,
  pseudonymizeIdentifier,
  relativeLuminance,
  scrubSensitiveText,
} from "./index.js";

test("hello() returns world", () => {
  assert.equal(hello(), "world");
});

test("parseHexColor parses #RRGGBB and 0xRRGGBB and rejects invalid inputs", () => {
  assert.equal(parseHexColor("#FFFFFF"), 0xffffff);
  assert.equal(parseHexColor("#0f172a"), 0x0f172a);
  assert.equal(parseHexColor("0x1D4ED8"), 0x1d4ed8);
  assert.equal(parseHexColor("  0X000000 "), 0x000000);
  assert.throws(() => parseHexColor("#FFF"), /Invalid hex color/);
  assert.throws(() => parseHexColor("123456"), /Invalid hex color/);
  assert.throws(() => parseHexColor("#GGGGGG"), /Invalid hex color/);
});

test("relativeLuminance and contrastRatio compute accurate WCAG 2.2 values", () => {
  assert.equal(relativeLuminance(0x000000), 0);
  assert.equal(relativeLuminance(0xffffff), 1);
  assert.equal(contrastRatio(0x000000, 0xffffff), 21);
  assert.equal(contrastRatio(0xffffff, 0x000000), 21);
  assert.equal(contrastRatio(0x336699, 0x336699), 1);

  const slateOnWhite = contrastRatio(0x0f172a, 0xffffff);
  assert.ok(slateOnWhite >= 17.8 && slateOnWhite <= 17.9, `got ${slateOnWhite}`);

  assert.throws(() => relativeLuminance(-1), /Invalid 24-bit RGB/);
  assert.throws(() => relativeLuminance(0x1000000), /Invalid 24-bit RGB/);
});

test("auditPair and auditThemePalette verify WCAG 2.2 Level AA compliance", () => {
  const passingPair = auditPair("primary-text", 0x0f172a, 0xffffff);
  assert.equal(passingPair.passesWcagAA, true);
  assert.equal(passingPair.minimumRequired, 4.5);

  const failingPair = auditPair("low-contrast", 0x94a3b8, 0xffffff);
  assert.equal(failingPair.passesWcagAA, false);

  const passingTheme = auditThemePalette([
    { pairName: "light-body", fg: "#0F172A", bg: "#FFFFFF" },
    { pairName: "dark-body", fg: 0xf8fafc, bg: 0x0f172a },
    { pairName: "large-ui", fg: "#64748B", bg: "#FFFFFF", minRatio: 3.0 },
  ]);
  assert.equal(passingTheme.passed, true);
  assert.equal(passingTheme.entries.length, 3);

  const failingTheme = auditThemePalette([
    { pairName: "light-body", fg: "#0F172A", bg: "#FFFFFF" },
    { pairName: "bad-muted", fg: "#CBD5E1", bg: "#FFFFFF" },
  ]);
  assert.equal(failingTheme.passed, false);
  assert.equal(failingTheme.entries[1].passesWcagAA, false);
});

test("scrubSensitiveText redacts emails, Bearer tokens, and ya29 tokens", () => {
  const raw =
    "Sync failed for stefan@example.com with Bearer ya29.A0ARrdaM_secret123 and fallback ya29.AnotherToken_456";
  const scrubbed = scrubSensitiveText(raw);
  assert.equal(
    scrubbed,
    "Sync failed for [REDACTED_EMAIL] with [REDACTED_TOKEN] and fallback [REDACTED_TOKEN]",
  );

  const jwtLog = "Auth header: bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.xyz";
  assert.equal(scrubSensitiveText(jwtLog), "Auth header: [REDACTED_TOKEN]");
});

test("pseudonymizeIdentifier is deterministic, normalized, and handles blanks", () => {
  assert.equal(pseudonymizeIdentifier(""), "anonymous");
  assert.equal(pseudonymizeIdentifier("   \t\n "), "anonymous");

  const first = pseudonymizeIdentifier("  Stefan@Example.COM ");
  const second = pseudonymizeIdentifier("stefan@example.com");
  assert.equal(first, second);
  assert.equal(first.length, 16);
  assert.match(first, /^[0-9a-f]{16}$/);
  assert.notEqual(first, pseudonymizeIdentifier("other@example.com"));
});

test("createZeroPiiBreadcrumb scrubs event and attribute values", () => {
  const fixedNow = new Date("2026-11-13T00:00:00.000Z");
  const crumb = createZeroPiiBreadcrumb(
    "oauth_error for alice@example.com",
    {
      token: "Bearer ya29.secret_token_999",
      contact: "bob@company.org",
      slice: "onboarding",
    },
    fixedNow,
  );

  assert.equal(crumb.event, "oauth_error for [REDACTED_EMAIL]");
  assert.equal(crumb.timestampIso, "2026-11-13T00:00:00.000Z");
  assert.ok(!crumb.summary.includes("alice@example.com"));
  assert.ok(!crumb.summary.includes("bob@company.org"));
  assert.ok(!crumb.summary.includes("ya29."));
  assert.ok(crumb.summary.includes("[REDACTED_EMAIL]"));
  assert.ok(crumb.summary.includes("[REDACTED_TOKEN]"));
  assert.ok(crumb.summary.includes("slice=onboarding"));

  const simple = createZeroPiiBreadcrumb("app_boot", undefined, fixedNow);
  assert.equal(simple.summary, "app_boot");
});

test("evaluateScarcityGate enforces Top-3 capacity and unpin/swap semantics", () => {
  assert.equal(evaluateScarcityGate(["t1", "t2"], "t3"), "ALLOW_PIN");
  assert.equal(evaluateScarcityGate(["t1", "t2"], "t1"), "UNPIN");
  assert.equal(evaluateScarcityGate(["t1", "t2", "t3"], "t2"), "UNPIN");
  assert.equal(evaluateScarcityGate(["t1", "t2", "t3"], "t4"), "SWAP_REQUIRED");
  assert.equal(evaluateScarcityGate(["t1"], "t2", 1), "SWAP_REQUIRED");
});

test("isStrictlyDescendingByScore checks strict descending sortScore order", () => {
  assert.equal(isStrictlyDescendingByScore([]), true);
  assert.equal(isStrictlyDescendingByScore([{ sortScore: 42 }]), true);
  assert.equal(
    isStrictlyDescendingByScore([
      { id: "a", sortScore: 100 },
      { id: "b", sortScore: 50 },
      { id: "c", sortScore: 10 },
    ]),
    true,
  );
  assert.equal(
    isStrictlyDescendingByScore([
      { sortScore: 100 },
      { sortScore: 100 },
    ]),
    false,
  );
  assert.equal(
    isStrictlyDescendingByScore([
      { sortScore: 10 },
      { sortScore: 50 },
    ]),
    false,
  );
  assert.equal(
    isStrictlyDescendingByScore([
      { sortScore: 50 },
      { sortScore: Number.NaN },
    ]),
    false,
  );
});
