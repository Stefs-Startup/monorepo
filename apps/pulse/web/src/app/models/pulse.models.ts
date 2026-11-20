import type { components } from '../api/generated/pulse-api.types';

/**
 * Contract-first domain & DTO type aliases re-exported directly from the
 * OpenAPI 3.1 generated module (`../api/generated/pulse-api.types.ts`).
 *
 * Hand-editing duplicate DTO interfaces here is forbidden under RFC-0003 / ADR-0005.
 * Regenerate via `npm run api:generate` (or `bash scripts/api-contract.sh sync`).
 */
type Schemas = components['schemas'];

export type AccountabilityCategory = Schemas['AccountabilityCategory'];
export type TaskCommitmentState = Schemas['TaskCommitmentState'];
export type TaskEnergyLevel = Schemas['TaskEnergyLevel'];
export type HorizonWindowType = Schemas['HorizonWindowType'];
export type ChatRole = Schemas['ChatRole'];
export type TriageActionCode = Schemas['TriageActionCode'];

export type TaskItem = Schemas['TaskItem'];
export type TaskAccountabilityStatus = Schemas['TaskAccountabilityStatus'];
export type HorizonWindowBarItem = Schemas['HorizonWindowBarItem'];
export type HorizonWindowCardModel = Schemas['HorizonWindowCardModel'];
export type TaskHorizonAnalyticsSnapshot = Schemas['TaskHorizonAnalyticsSnapshot'];
export type ConversationalMessage = Schemas['ConversationalMessage'];
export type QuickReplySpecDto = Schemas['QuickReplySpecDto'];
export type PartnerSettingsDto = Schemas['PartnerSettingsDto'];
export type BreadcrumbEntry = Schemas['BreadcrumbEntry'];
export type ContrastAuditEntry = Schemas['ContrastAuditEntry'];
export type PulseDashboardResponse = Schemas['PulseDashboardResponse'];

export type TriageRequest = Schemas['TriageRequest'];
export type SwapTop3Request = Schemas['SwapTop3Request'];
export type ChatMessageRequest = Schemas['ChatMessageRequest'];
export type ApiErrorResponse = Schemas['ApiErrorResponse'];

export const TRIAGE_ACTION_CODES: readonly TriageActionCode[] = [
  'COMMIT_TODAY',
  'PIN_TOP_3',
  'UNPIN',
  'SHRINK_TO_5M',
  'RESCHEDULE',
  'DELEGATE',
  'PARK_SOMEDAY',
  'DROP_CONSCIOUSLY',
  'COMPLETE'
] as const;

export function isTriageActionCode(value: string): value is TriageActionCode {
  return (TRIAGE_ACTION_CODES as readonly string[]).includes(value);
}
