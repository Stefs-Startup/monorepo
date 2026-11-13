import assert from "node:assert/strict";
import test from "node:test";
import {
  contrastRatio,
  pseudonymizeIdentifier,
  scrubSensitiveText,
} from "./index.js";

const CASES_PER_PROPERTY = 150;

function createPrng(seed: number) {
  let state = seed >>> 0 || 1;

  const nextUint32 = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };

  const nextInt = (min: number, maxInclusive: number): number =>
    min + (nextUint32() % (maxInclusive - min + 1));

  const nextString = (
    alphabet: string,
    minLen: number,
    maxLen: number,
  ): string => {
    const len = nextInt(minLen, maxLen);
    let out = "";
    for (let i = 0; i < len; i += 1) {
      out += alphabet[nextInt(0, alphabet.length - 1)];
    }
    return out;
  };

  const nextBool = (): boolean => (nextUint32() & 1) === 1;

  return { nextUint32, nextInt, nextString, nextBool };
}

const TOKEN_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-+/=";
const EMAIL_USER_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789._+-";
const DOMAIN_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const TLD_ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const IDENTIFIER_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-.:";
const WHITESPACE_CHARS = [" ", "\t", "\n", "\r"];

test("Property 1: scrubSensitiveText never leaks generated Bearer, ya29, or email strings", () => {
  const rng = createPrng(0x5f3759df);

  for (let i = 0; i < CASES_PER_PROPERTY; i += 1) {
    const bearerBody = rng.nextString(TOKEN_ALPHABET, 10, 32);
    const bearer = `Bearer ${bearerBody}`;
    const oauthBody = rng.nextString(TOKEN_ALPHABET, 10, 32);
    const oauth = `ya29.${oauthBody}`;
    const user = `${rng.nextString(DOMAIN_ALPHABET, 2, 6)}${rng.nextString(EMAIL_USER_ALPHABET, 2, 8)}`;
    const domain = `${rng.nextString(DOMAIN_ALPHABET, 3, 10)}`;
    const tld = rng.nextString(TLD_ALPHABET, 2, 6);
    const email = `${user}@${domain}.${tld}`;

    const raw = `case=${i} user=${email} auth=${bearer} oauth=${oauth} status=ok`;
    const scrubbed = scrubSensitiveText(raw);

    assert.ok(!scrubbed.includes(bearerBody), `Leaked bearer body in case ${i}`);
    assert.ok(!scrubbed.includes(oauthBody), `Leaked oauth body in case ${i}`);
    assert.ok(!scrubbed.includes("ya29."), `Leaked ya29 prefix in case ${i}`);
    assert.ok(!scrubbed.includes(email), `Leaked email in case ${i}`);
    assert.ok(!scrubbed.includes("@"), `Leaked @ symbol in case ${i}`);
    assert.ok(scrubbed.includes("[REDACTED_TOKEN]"));
    assert.ok(scrubbed.includes("[REDACTED_EMAIL]"));
  }
});

test("Property 2: pseudonymizeIdentifier is deterministic, case/whitespace-invariant, and 16-char hex or anonymous", () => {
  const rng = createPrng(0x12345678);
  const hex16 = /^[0-9a-f]{16}$/;

  for (let i = 0; i < CASES_PER_PROPERTY; i += 1) {
    const core = rng.nextString(IDENTIFIER_ALPHABET, 1, 40);
    const padLeft = WHITESPACE_CHARS[rng.nextInt(0, WHITESPACE_CHARS.length - 1)]!.repeat(
      rng.nextInt(0, 4),
    );
    const padRight = WHITESPACE_CHARS[rng.nextInt(0, WHITESPACE_CHARS.length - 1)]!.repeat(
      rng.nextInt(0, 4),
    );

    const p1 = pseudonymizeIdentifier(core);
    const p2 = pseudonymizeIdentifier(core);
    const pUpper = pseudonymizeIdentifier(`${padLeft}${core.toUpperCase()}${padRight}`);
    const pLower = pseudonymizeIdentifier(`${padRight}${core.toLowerCase()}${padLeft}`);

    assert.equal(p1, p2);
    assert.equal(p1, pUpper);
    assert.equal(p1, pLower);
    assert.match(p1, hex16);
  }

  for (let i = 0; i < CASES_PER_PROPERTY; i += 1) {
    const len = rng.nextInt(0, 8);
    let blank = "";
    for (let j = 0; j < len; j += 1) {
      blank += WHITESPACE_CHARS[rng.nextInt(0, WHITESPACE_CHARS.length - 1)];
    }
    assert.equal(pseudonymizeIdentifier(blank), "anonymous");
  }
});

test("Property 3: contrastRatio is symmetric, bounded in [1, 21], and reflexive at 1", () => {
  const rng = createPrng(0xdeadbeef);

  for (let i = 0; i < CASES_PER_PROPERTY; i += 1) {
    const a = rng.nextUint32() & 0xffffff;
    const b = rng.nextUint32() & 0xffffff;

    const ab = contrastRatio(a, b);
    const ba = contrastRatio(b, a);
    const aa = contrastRatio(a, a);
    const bb = contrastRatio(b, b);

    assert.equal(ab, ba, `Symmetry failed for ${a} and ${b}`);
    assert.ok(ab >= 1 && ab <= 21, `Out of bounds contrast ${ab} for ${a}, ${b}`);
    assert.equal(aa, 1, `Reflexivity failed for ${a}`);
    assert.equal(bb, 1, `Reflexivity failed for ${b}`);
  }
});
