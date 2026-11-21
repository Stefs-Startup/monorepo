import { createHash } from "node:crypto";
import {
  pseudonymizeIdentifier,
  type StructuredLogEntry,
  type ZeroPiiObservabilityClient,
} from "@cmp/observability";

/**
 * Pure functional feature flags and experimentation engine (STE-57):
 * - Local defaults, overrides, and emergency kill switches
 * - Deterministic per-user percentage rollouts (0..100%) keyed by `(flagOrExperimentKey, pseudonymizedUserId)`
 * - Multi-variant weighted experiment bucketing
 * - Exposure (`flag.exposure`, `experiment.exposure`) and outcome (`experiment.outcome`) hooks wired through `@cmp/observability`
 */

export type FlagEvaluationReason =
  | "KILL_SWITCH"
  | "LOCAL_OVERRIDE"
  | "ALLOWLIST"
  | "PERCENTAGE_ROLLOUT"
  | "DEFAULT";

export interface FeatureFlagDefinition {
  key: string;
  description: string;
  defaultEnabled: boolean;
  /** When true, overrides every rollout/override and forces `enabled: false` (`reason: "KILL_SWITCH"`). */
  killSwitch?: boolean;
  /** Optional deterministic percentage rollout in [0, 100]. */
  rolloutPercentage?: number;
  /** Optional allowlist of pseudonymized user IDs (16-hex digests). */
  allowlistPseudonymizedUsers?: readonly string[];
}

export interface ExperimentVariant<T extends string = string> {
  name: T;
  /** Non-negative relative weight (e.g. 50 / 50). */
  weight: number;
}

export interface ExperimentDefinition<T extends string = string> {
  key: string;
  description: string;
  /** When true, forces `controlVariant` (`reason: "KILL_SWITCH"`). */
  killSwitch?: boolean;
  controlVariant: T;
  variants: readonly ExperimentVariant<T>[];
}

export interface FlagEvaluationResult {
  flagKey: string;
  enabled: boolean;
  reason: FlagEvaluationReason;
  bucket: number;
  pseudonymizedUserId: string;
}

export interface ExperimentAssignment<T extends string = string> {
  experimentKey: string;
  variant: T;
  reason: FlagEvaluationReason;
  bucket: number;
  pseudonymizedUserId: string;
}

export interface FlagEvaluationContext {
  userId?: string | null;
  defaultValue?: boolean;
  traceId?: string;
  spanId?: string;
  recordExposure?: boolean;
}

export interface ExperimentAssignmentContext {
  userId?: string | null;
  traceId?: string;
  spanId?: string;
  recordExposure?: boolean;
}

export interface ExperimentOutcomeInput {
  experimentKey: string;
  variant: string;
  metricName: string;
  value?: number;
  userId?: string | null;
  traceId?: string;
  spanId?: string;
  attributes?: Record<string, unknown>;
}

export interface FlagsClientOptions {
  flags?: readonly FeatureFlagDefinition[];
  experiments?: readonly ExperimentDefinition[];
  overrides?: Readonly<Record<string, boolean>>;
  experimentOverrides?: Readonly<Record<string, string>>;
  observability?: ZeroPiiObservabilityClient;
}

export interface FlagsClient {
  evaluateFlag(
    flagKey: string,
    context?: FlagEvaluationContext,
  ): FlagEvaluationResult;
  isEnabled(flagKey: string, context?: FlagEvaluationContext): boolean;
  assignExperiment<T extends string = string>(
    experimentKey: string,
    context?: ExperimentAssignmentContext,
  ): ExperimentAssignment<T>;
  recordOutcome(outcome: ExperimentOutcomeInput): StructuredLogEntry | null;
}

/**
 * Deterministically maps `(scopeKey, rawUserId)` into a pseudonymized user ID and an integer bucket in `[0, 99]`.
 */
export function computeDeterministicBucket(
  scopeKey: string,
  rawUserId?: string | null,
): { pseudonymizedUserId: string; bucket: number } {
  const pseudonymizedUserId = pseudonymizeIdentifier(rawUserId);
  const digest = createHash("sha256")
    .update(`${scopeKey.trim()}::${pseudonymizedUserId}`, "utf8")
    .digest();
  const uint32 = digest.readUInt32BE(0);
  const bucket = uint32 % 100;
  return { pseudonymizedUserId, bucket };
}

function clampPercentage(pct: number): number {
  if (!Number.isFinite(pct)) {
    return 0;
  }
  return Math.max(0, Math.min(100, pct));
}

/**
 * Pure single-flag evaluator without telemetry side effects.
 */
export function evaluateFeatureFlag(
  definition: FeatureFlagDefinition | undefined,
  flagKey: string,
  options?: {
    userId?: string | null;
    defaultValue?: boolean;
    overrides?: Readonly<Record<string, boolean>>;
  },
): FlagEvaluationResult {
  const { pseudonymizedUserId, bucket } = computeDeterministicBucket(
    flagKey,
    options?.userId,
  );

  if (definition?.killSwitch) {
    return {
      flagKey,
      enabled: false,
      reason: "KILL_SWITCH",
      bucket,
      pseudonymizedUserId,
    };
  }

  if (
    options?.overrides &&
    Object.prototype.hasOwnProperty.call(options.overrides, flagKey)
  ) {
    return {
      flagKey,
      enabled: Boolean(options.overrides[flagKey]),
      reason: "LOCAL_OVERRIDE",
      bucket,
      pseudonymizedUserId,
    };
  }

  if (
    definition?.allowlistPseudonymizedUsers &&
    definition.allowlistPseudonymizedUsers.includes(pseudonymizedUserId)
  ) {
    return {
      flagKey,
      enabled: true,
      reason: "ALLOWLIST",
      bucket,
      pseudonymizedUserId,
    };
  }

  if (definition && definition.rolloutPercentage !== undefined) {
    const pct = clampPercentage(definition.rolloutPercentage);
    const enabled = pct >= 100 ? true : pct <= 0 ? false : bucket < pct;
    return {
      flagKey,
      enabled,
      reason: "PERCENTAGE_ROLLOUT",
      bucket,
      pseudonymizedUserId,
    };
  }

  const fallback = definition?.defaultEnabled ?? options?.defaultValue ?? false;
  return {
    flagKey,
    enabled: fallback,
    reason: "DEFAULT",
    bucket,
    pseudonymizedUserId,
  };
}

/**
 * Pure multi-variant experiment allocator without telemetry side effects.
 */
export function evaluateExperimentAssignment<T extends string = string>(
  definition: ExperimentDefinition<T> | undefined,
  experimentKey: string,
  options?: {
    userId?: string | null;
    experimentOverrides?: Readonly<Record<string, string>>;
  },
): ExperimentAssignment<T> {
  const { pseudonymizedUserId, bucket } = computeDeterministicBucket(
    experimentKey,
    options?.userId,
  );
  const control = (definition?.controlVariant ?? "control") as T;

  if (definition?.killSwitch) {
    return {
      experimentKey,
      variant: control,
      reason: "KILL_SWITCH",
      bucket,
      pseudonymizedUserId,
    };
  }

  if (
    options?.experimentOverrides &&
    Object.prototype.hasOwnProperty.call(
      options.experimentOverrides,
      experimentKey,
    )
  ) {
    return {
      experimentKey,
      variant: options.experimentOverrides[experimentKey] as T,
      reason: "LOCAL_OVERRIDE",
      bucket,
      pseudonymizedUserId,
    };
  }

  const variants = definition?.variants ?? [];
  const totalWeight = variants.reduce(
    (acc, v) => acc + Math.max(0, v.weight),
    0,
  );

  if (!definition || variants.length === 0 || totalWeight <= 0) {
    return {
      experimentKey,
      variant: control,
      reason: "DEFAULT",
      bucket,
      pseudonymizedUserId,
    };
  }

  const target = (bucket / 100) * totalWeight;
  let cumulative = 0;
  for (const variant of variants) {
    const w = Math.max(0, variant.weight);
    cumulative += w;
    if (target < cumulative) {
      return {
        experimentKey,
        variant: variant.name,
        reason: "PERCENTAGE_ROLLOUT",
        bucket,
        pseudonymizedUserId,
      };
    }
  }

  return {
    experimentKey,
    variant: variants[variants.length - 1].name,
    reason: "PERCENTAGE_ROLLOUT",
    bucket,
    pseudonymizedUserId,
  };
}

/**
 * Creates a feature flags and experimentation client wired to `@cmp/observability` for zero-PII exposure and outcome tracking.
 */
export function createFlagsClient(options?: FlagsClientOptions): FlagsClient {
  const flagMap = new Map<string, FeatureFlagDefinition>();
  for (const flag of options?.flags ?? []) {
    flagMap.set(flag.key, flag);
  }

  const expMap = new Map<string, ExperimentDefinition>();
  for (const exp of options?.experiments ?? []) {
    expMap.set(exp.key, exp);
  }

  const overrides = options?.overrides;
  const experimentOverrides = options?.experimentOverrides;
  const obs = options?.observability;

  return {
    evaluateFlag(
      flagKey: string,
      context?: FlagEvaluationContext,
    ): FlagEvaluationResult {
      const result = evaluateFeatureFlag(flagMap.get(flagKey), flagKey, {
        userId: context?.userId,
        defaultValue: context?.defaultValue,
        overrides,
      });

      if (obs && (context?.recordExposure ?? true)) {
        obs.log(
          "info",
          "flag.exposure",
          `Evaluated feature flag ${result.flagKey}=${String(result.enabled)}`,
          {
            traceId: context?.traceId,
            spanId: context?.spanId,
            userId: context?.userId ?? undefined,
            attributes: {
              flagKey: result.flagKey,
              enabled: result.enabled,
              reason: result.reason,
              bucket: result.bucket,
            },
          },
        );
      }
      return result;
    },

    isEnabled(flagKey: string, context?: FlagEvaluationContext): boolean {
      return this.evaluateFlag(flagKey, context).enabled;
    },

    assignExperiment<T extends string = string>(
      experimentKey: string,
      context?: ExperimentAssignmentContext,
    ): ExperimentAssignment<T> {
      const def = expMap.get(experimentKey) as
        | ExperimentDefinition<T>
        | undefined;
      const assignment = evaluateExperimentAssignment<T>(def, experimentKey, {
        userId: context?.userId,
        experimentOverrides,
      });

      if (obs && (context?.recordExposure ?? true)) {
        obs.log(
          "info",
          "experiment.exposure",
          `Assigned experiment ${assignment.experimentKey}=${assignment.variant}`,
          {
            traceId: context?.traceId,
            spanId: context?.spanId,
            userId: context?.userId ?? undefined,
            attributes: {
              experimentKey: assignment.experimentKey,
              variant: assignment.variant,
              reason: assignment.reason,
              bucket: assignment.bucket,
            },
          },
        );
      }
      return assignment;
    },

    recordOutcome(outcome: ExperimentOutcomeInput): StructuredLogEntry | null {
      if (!obs) {
        return null;
      }
      return obs.log(
        "info",
        "experiment.outcome",
        `Recorded experiment outcome ${outcome.experimentKey}:${outcome.metricName}`,
        {
          traceId: outcome.traceId,
          spanId: outcome.spanId,
          userId: outcome.userId ?? undefined,
          attributes: {
            ...outcome.attributes,
            experimentKey: outcome.experimentKey,
            variant: outcome.variant,
            metricName: outcome.metricName,
            ...(outcome.value !== undefined ? { value: outcome.value } : {}),
          },
        },
      );
    },
  };
}
