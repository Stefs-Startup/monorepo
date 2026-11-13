import { createHash } from "node:crypto";

/**
 * Pure functional Zero-PII telemetry and pseudonymization utilities.
 */

export interface ZeroPiiBreadcrumb {
  event: string;
  summary: string;
  timestampIso: string;
}

const BEARER_OR_OAUTH_TOKEN_REGEX =
  /(Bearer\s+|ya29\.)[A-Za-z0-9._\-+/=]+/gi;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Redacts `Bearer <token>`, `ya29.<token>`, and email addresses from telemetry text.
 */
export function scrubSensitiveText(input: string): string {
  return input
    .replace(BEARER_OR_OAUTH_TOKEN_REGEX, "[REDACTED_TOKEN]")
    .replace(EMAIL_REGEX, "[REDACTED_EMAIL]");
}

/**
 * Deterministically pseudonymizes a raw identifier into a 16-character SHA-256 hex digest,
 * or returns `'anonymous'` when the trimmed input is blank.
 */
export function pseudonymizeIdentifier(rawIdentifier: string): string {
  const normalized = rawIdentifier.trim().toLowerCase();
  if (normalized.length === 0) {
    return "anonymous";
  }
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 16);
}

/**
 * Builds a structured Zero-PII diagnostic breadcrumb with scrubbed event name and attributes.
 */
export function createZeroPiiBreadcrumb(
  event: string,
  attributes?: Record<string, string>,
  now: Date = new Date(),
): ZeroPiiBreadcrumb {
  const scrubbedEvent = scrubSensitiveText(event);
  const entries = attributes ? Object.entries(attributes) : [];

  const summary =
    entries.length === 0
      ? scrubbedEvent
      : `${scrubbedEvent} | ${entries
          .map(
            ([key, value]) =>
              `${scrubSensitiveText(key)}=${scrubSensitiveText(value)}`,
          )
          .join(", ")}`;

  return {
    event: scrubbedEvent,
    summary,
    timestampIso: now.toISOString(),
  };
}
