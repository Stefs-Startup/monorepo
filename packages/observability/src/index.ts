import { createHash, randomBytes } from "node:crypto";

/**
 * Pure functional Zero-PII production observability baseline (STE-37 / RFC-0004):
 * - Deterministic PII & secret redaction (emails, Bearer/OAuth/JWT tokens, cookies, sensitive query params & headers)
 * - SHA-256 16-hex pseudonymized user identifiers
 * - W3C `traceparent` header creation, parsing, and formatting
 * - Structured JSON logs, RED (Rate, Errors, Duration) request metrics, and error capture hooks
 * - Pure SLO availability & latency error-budget evaluator
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type ObservabilityAttributeValue = string | number | boolean;
export type ObservabilityAttributes = Record<string, ObservabilityAttributeValue>;

export interface TraceContext {
  traceId: string;
  spanId: string;
  sampled: boolean;
  traceparent: string;
}

export interface StructuredLogEntry {
  timestampIso: string;
  level: LogLevel;
  service: string;
  event: string;
  message: string;
  traceId?: string;
  spanId?: string;
  pseudonymizedUserId?: string;
  attributes: ObservabilityAttributes;
}

export interface RedMetricSample {
  timestampIso: string;
  service: string;
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
  isError: boolean;
  traceId?: string;
}

export interface ErrorReportEntry {
  timestampIso: string;
  service: string;
  errorName: string;
  message: string;
  traceId?: string;
  spanId?: string;
  pseudonymizedUserId?: string;
  attributes: ObservabilityAttributes;
}

export interface SloTargets {
  /** Target success ratio in [0, 1], e.g. 0.995 for 99.5% availability (RFC-0004). */
  targetAvailability?: number;
  /** Target latency threshold in milliseconds, e.g. 300ms (RFC-0004). */
  targetLatencyMs?: number;
  /** Target ratio of requests completing within `targetLatencyMs`, e.g. 0.995. */
  targetLatencyRatio?: number;
}

export interface SloWindowEvaluation {
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  fastRequests: number;
  availabilityRatio: number;
  latencyTargetRatio: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  targetAvailability: number;
  targetLatencyMs: number;
  targetLatencyRatio: number;
  errorBudgetRemainingRatio: number;
  passesSlo: boolean;
}

export interface ObservabilitySink {
  onLog?: (entry: StructuredLogEntry) => void;
  onMetric?: (sample: RedMetricSample) => void;
  onError?: (report: ErrorReportEntry) => void;
}

export interface LogContextInput {
  traceId?: string;
  spanId?: string;
  userId?: string;
  attributes?: Record<string, unknown>;
}

export interface RequestMetricInput {
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
  traceId?: string;
}

export interface ZeroPiiObservabilityClient {
  readonly service: string;
  log(
    level: LogLevel,
    event: string,
    message: string,
    context?: LogContextInput,
  ): StructuredLogEntry;
  recordRequestMetric(input: RequestMetricInput): RedMetricSample;
  captureError(
    error: unknown,
    context?: LogContextInput,
  ): ErrorReportEntry;
  evaluateSlo(
    samples: readonly RedMetricSample[],
    targets?: SloTargets,
  ): SloWindowEvaluation;
}

const BEARER_OR_OAUTH_TOKEN_REGEX =
  /(Bearer\s+|ya29\.)[A-Za-z0-9._\-+/=]+/gi;
const JWT_REGEX =
  /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const SENSITIVE_QUERY_PARAM_REGEX =
  /([?&](?:access_token|id_token|refresh_token|token|api_key|apikey|password|secret|client_secret|code)=)([^&#\s]+)/gi;
const SENSITIVE_KEY_REGEX =
  /^(?:authorization|cookie|set-cookie|x-api-key|api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|token|password|secret|client[-_]?secret|email|raw[-_]?email|ssn|phone)$/i;
const TRACEPARENT_REGEX =
  /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;

/**
 * Redacts Bearer/OAuth tokens, JWTs, email addresses, and sensitive query parameters from free-form text.
 */
export function scrubSensitiveText(input: string): string {
  return input
    .replace(BEARER_OR_OAUTH_TOKEN_REGEX, "[REDACTED_TOKEN]")
    .replace(JWT_REGEX, "[REDACTED_JWT]")
    .replace(SENSITIVE_QUERY_PARAM_REGEX, "$1[REDACTED_PARAM]")
    .replace(EMAIL_REGEX, "[REDACTED_EMAIL]");
}

/**
 * Scrubs HTTP headers at the telemetry boundary so `Authorization`, `Cookie`, `Set-Cookie`,
 * and API key headers are never persisted (RFC-0004 Section 3).
 */
export function scrubHeaders(
  headers: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(headers)) {
    if (rawValue === undefined) {
      continue;
    }
    const key = scrubSensitiveText(rawKey.trim());
    if (SENSITIVE_KEY_REGEX.test(key)) {
      clean[key] = "[REDACTED_HEADER]";
    } else {
      clean[key] = scrubSensitiveText(rawValue);
    }
  }
  return clean;
}

/**
 * Scrubs structured attribute bags, redacting sensitive keys and scrubbing string values.
 */
export function scrubAttributes(
  attributes?: Readonly<Record<string, unknown>>,
): ObservabilityAttributes {
  const clean: ObservabilityAttributes = {};
  if (!attributes) {
    return clean;
  }

  for (const [rawKey, rawVal] of Object.entries(attributes)) {
    if (rawVal === undefined || rawVal === null) {
      continue;
    }
    const key = scrubSensitiveText(rawKey.trim());
    if (key.length === 0) {
      continue;
    }
    if (SENSITIVE_KEY_REGEX.test(key)) {
      clean[key] = "[REDACTED]";
      continue;
    }
    if (typeof rawVal === "string") {
      clean[key] = scrubSensitiveText(rawVal);
    } else if (typeof rawVal === "number" && Number.isFinite(rawVal)) {
      clean[key] = rawVal;
    } else if (typeof rawVal === "boolean") {
      clean[key] = rawVal;
    } else {
      clean[key] = scrubSensitiveText(JSON.stringify(rawVal));
    }
  }
  return clean;
}

/**
 * Deterministically pseudonymizes a raw user identifier into a 16-character SHA-256 hex digest,
 * or returns `'anonymous'` when the input is empty or whitespace.
 */
export function pseudonymizeIdentifier(rawIdentifier?: string | null): string {
  if (!rawIdentifier) {
    return "anonymous";
  }
  const normalized = rawIdentifier.trim().toLowerCase();
  if (normalized.length === 0 || normalized === "anonymous") {
    return "anonymous";
  }
  return createHash("sha256")
    .update(normalized, "utf8")
    .digest("hex")
    .slice(0, 16);
}

function isValidHex(value: string, expectedLength: number): boolean {
  return (
    value.length === expectedLength &&
    /^[0-9a-f]+$/i.test(value) &&
    !/^0+$/.test(value)
  );
}

/**
 * Formats a W3C `traceparent` header (`00-<32-hex-traceId>-<16-hex-spanId>-<flags>`).
 */
export function formatTraceparent(
  ctx: Pick<TraceContext, "traceId" | "spanId" | "sampled">,
): string {
  const traceId = ctx.traceId.toLowerCase();
  const spanId = ctx.spanId.toLowerCase();
  if (!isValidHex(traceId, 32)) {
    throw new Error(`Invalid W3C traceId: expected 32 non-zero hex chars`);
  }
  if (!isValidHex(spanId, 16)) {
    throw new Error(`Invalid W3C spanId: expected 16 non-zero hex chars`);
  }
  const flags = ctx.sampled ? "01" : "00";
  return `00-${traceId}-${spanId}-${flags}`;
}

/**
 * Parses a W3C `traceparent` header into a structured `TraceContext`, or returns `null` if invalid.
 */
export function parseTraceparent(
  header: string | null | undefined,
): TraceContext | null {
  if (!header) {
    return null;
  }
  const match = TRACEPARENT_REGEX.exec(header.trim());
  if (!match) {
    return null;
  }
  const traceId = match[1].toLowerCase();
  const spanId = match[2].toLowerCase();
  const flagsByte = Number.parseInt(match[3], 16);
  if (!isValidHex(traceId, 32) || !isValidHex(spanId, 16)) {
    return null;
  }
  const sampled = (flagsByte & 0x01) === 0x01;
  return {
    traceId,
    spanId,
    sampled,
    traceparent: formatTraceparent({ traceId, spanId, sampled }),
  };
}

/**
 * Creates a W3C `TraceContext` for distributed trace correlation across Angular, Spring Boot, and KMP.
 */
export function createTraceContext(seed?: {
  traceId?: string;
  spanId?: string;
  sampled?: boolean;
}): TraceContext {
  const traceId = (seed?.traceId ?? randomBytes(16).toString("hex")).toLowerCase();
  const spanId = (seed?.spanId ?? randomBytes(8).toString("hex")).toLowerCase();
  const sampled = seed?.sampled ?? true;
  return {
    traceId,
    spanId,
    sampled,
    traceparent: formatTraceparent({ traceId, spanId, sampled }),
  };
}

function computePercentile(sortedValues: readonly number[], p: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1),
  );
  return Math.round(sortedValues[index] * 100) / 100;
}

/**
 * Evaluates RED request metric samples against RFC-0004 SLO availability and latency targets.
 */
export function evaluateSloWindow(
  samples: readonly RedMetricSample[],
  targets?: SloTargets,
): SloWindowEvaluation {
  const targetAvailability = targets?.targetAvailability ?? 0.995;
  const targetLatencyMs = targets?.targetLatencyMs ?? 300;
  const targetLatencyRatio = targets?.targetLatencyRatio ?? 0.995;

  const totalRequests = samples.length;
  if (totalRequests === 0) {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      errorRequests: 0,
      fastRequests: 0,
      availabilityRatio: 1,
      latencyTargetRatio: 1,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      targetAvailability,
      targetLatencyMs,
      targetLatencyRatio,
      errorBudgetRemainingRatio: 1,
      passesSlo: true,
    };
  }

  let successfulRequests = 0;
  let fastRequests = 0;
  const durations: number[] = [];

  for (const sample of samples) {
    const isErr = sample.isError || sample.statusCode >= 500;
    if (!isErr) {
      successfulRequests += 1;
    }
    if (sample.durationMs <= targetLatencyMs) {
      fastRequests += 1;
    }
    durations.push(Math.max(0, sample.durationMs));
  }

  durations.sort((a, b) => a - b);
  const errorRequests = totalRequests - successfulRequests;
  const availabilityRatio = successfulRequests / totalRequests;
  const latencyTargetRatio = fastRequests / totalRequests;

  const allowedErrorRatio = Math.max(1e-9, 1 - targetAvailability);
  const actualErrorRatio = errorRequests / totalRequests;
  const errorBudgetRemainingRatio = Math.max(
    0,
    Math.min(1, 1 - actualErrorRatio / allowedErrorRatio),
  );

  const passesSlo =
    availabilityRatio >= targetAvailability &&
    latencyTargetRatio >= targetLatencyRatio;

  return {
    totalRequests,
    successfulRequests,
    errorRequests,
    fastRequests,
    availabilityRatio: Math.round(availabilityRatio * 10000) / 10000,
    latencyTargetRatio: Math.round(latencyTargetRatio * 10000) / 10000,
    p50LatencyMs: computePercentile(durations, 50),
    p95LatencyMs: computePercentile(durations, 95),
    p99LatencyMs: computePercentile(durations, 99),
    targetAvailability,
    targetLatencyMs,
    targetLatencyRatio,
    errorBudgetRemainingRatio:
      Math.round(errorBudgetRemainingRatio * 10000) / 10000,
    passesSlo,
  };
}

/**
 * Creates a Zero-PII observability client for structured logs, RED metrics, and error capture.
 */
export function createObservabilityClient(options: {
  service: string;
  sink?: ObservabilitySink;
  now?: () => Date;
}): ZeroPiiObservabilityClient {
  const service = scrubSensitiveText(options.service.trim() || "cmp-service");
  const sink = options.sink;
  const nowFn = options.now ?? (() => new Date());

  return {
    service,
    log(
      level: LogLevel,
      event: string,
      message: string,
      context?: LogContextInput,
    ): StructuredLogEntry {
      const entry: StructuredLogEntry = {
        timestampIso: nowFn().toISOString(),
        level,
        service,
        event: scrubSensitiveText(event.trim() || "app.log"),
        message: scrubSensitiveText(message),
        ...(context?.traceId ? { traceId: scrubSensitiveText(context.traceId) } : {}),
        ...(context?.spanId ? { spanId: scrubSensitiveText(context.spanId) } : {}),
        ...(context?.userId
          ? { pseudonymizedUserId: pseudonymizeIdentifier(context.userId) }
          : {}),
        attributes: scrubAttributes(context?.attributes),
      };
      sink?.onLog?.(entry);
      return entry;
    },

    recordRequestMetric(input: RequestMetricInput): RedMetricSample {
      const sanitizedRoute = scrubSensitiveText(input.route.trim() || "/");
      const method = input.method.trim().toUpperCase() || "GET";
      const statusCode = Math.trunc(input.statusCode);
      const durationMs = Math.max(0, Math.round(input.durationMs * 100) / 100);
      const sample: RedMetricSample = {
        timestampIso: nowFn().toISOString(),
        service,
        route: sanitizedRoute,
        method,
        statusCode,
        durationMs,
        isError: statusCode >= 500,
        ...(input.traceId ? { traceId: scrubSensitiveText(input.traceId) } : {}),
      };
      sink?.onMetric?.(sample);
      return sample;
    },

    captureError(
      error: unknown,
      context?: LogContextInput,
    ): ErrorReportEntry {
      const errName =
        error instanceof Error && error.name ? error.name : "Error";
      const rawMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : JSON.stringify(error);
      const report: ErrorReportEntry = {
        timestampIso: nowFn().toISOString(),
        service,
        errorName: scrubSensitiveText(errName),
        message: scrubSensitiveText(rawMessage),
        ...(context?.traceId ? { traceId: scrubSensitiveText(context.traceId) } : {}),
        ...(context?.spanId ? { spanId: scrubSensitiveText(context.spanId) } : {}),
        ...(context?.userId
          ? { pseudonymizedUserId: pseudonymizeIdentifier(context.userId) }
          : {}),
        attributes: scrubAttributes(context?.attributes),
      };
      sink?.onError?.(report);
      return report;
    },

    evaluateSlo(
      samples: readonly RedMetricSample[],
      targets?: SloTargets,
    ): SloWindowEvaluation {
      return evaluateSloWindow(samples, targets);
    },
  };
}
