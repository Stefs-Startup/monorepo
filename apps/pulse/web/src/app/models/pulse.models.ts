export type AccountabilityCategory =
  | 'HABITUALLY_DEFERRED'
  | 'LONG_STANDING_GHOSTED'
  | 'ACTIVE_COMMITTED'
  | 'HEALTHY_BACKLOG'
  | 'COMPLETED_OR_PARKED';

export type TaskCommitmentState =
  | 'NORMAL'
  | 'TODAY_TOP_3'
  | 'DEFERRED_INTENTIONALLY'
  | 'SOMEDAY_PARKED';

export type TaskEnergyLevel = 'QUICK_WIN' | 'FOCUSED' | 'DEEP_WORK';

export type HorizonWindowType =
  | 'HABITUALLY_UNDONE'
  | 'LONG_STANDING_DRIFT'
  | 'ACTIVE_FLOW';

export interface TaskItem {
  id: string;
  googleTaskId: string | null;
  taskListId: string;
  taskListTitle: string;
  title: string;
  notes: string;
  isCompleted: boolean;
  dueEpochMillis: number | null;
  completedEpochMillis: number | null;
  createdEpochMillis: number;
  updatedEpochMillis: number;
  deferCount: number;
  commitment: TaskCommitmentState;
  energy: TaskEnergyLevel;
  blockerNote: string;
  dirtySync: boolean;
}

export interface TaskAccountabilityStatus {
  task: TaskItem;
  category: AccountabilityCategory;
  badgeLabel: string;
  daysOld: number;
  daysUntouched: number;
  daysOverdue: number;
}

export interface HorizonWindowBarItem {
  taskId: string;
  title: string;
  shortLabel: string;
  primaryMetricLabel: string;
  secondaryMetricLabel: string;
  intensityFraction: number;
  category: AccountabilityCategory;
  deferCount: number;
  daysOld: number;
  daysUntouched: number;
  daysOverdue: number;
  sortScore: number;
}

export interface HorizonWindowCardModel {
  windowType: HorizonWindowType;
  title: string;
  shortTabTitle: string;
  subtitle: string;
  headlineStat: string;
  emptyStateTitle: string;
  emptyStateBody: string;
  items: HorizonWindowBarItem[];
}

export interface TaskHorizonAnalyticsSnapshot {
  windows: HorizonWindowCardModel[];
  habitualDeferralCount: number;
  longStandingCount: number;
  committedTodayCount: number;
  healthyBacklogCount: number;
  averageStalledDeferrals: number;
  oldestOpenDays: number;
  clarityRatioPercent: number;
}

export interface ConversationalMessage {
  id: string;
  role: 'PARTNER' | 'USER';
  text: string;
  suggestedActionCode: string | null;
}

export interface QuickReplySpecDto {
  id: string;
  label: string;
  messageText: string;
}

export interface PartnerSettingsDto {
  partnerTone: string;
  aiStreamingEnabled: boolean;
  connectedGoogleAccount: string;
  lastSyncStatus: string;
  morningRitualTime: string;
  eveningShutdownTime: string;
  zeroPiiTelemetryEnabled: boolean;
}

export interface BreadcrumbEntry {
  timestampIso: string;
  event: string;
  summary: string;
}

export interface ContrastAuditEntry {
  pairName: string;
  foregroundRgb: number;
  backgroundRgb: number;
  contrastRatio: number;
  minimumRequired: number;
  passesWcagAA: boolean;
}

export interface PulseDashboardResponse {
  horizon: TaskHorizonAnalyticsSnapshot;
  allStatuses: TaskAccountabilityStatus[];
  top3Commitments: TaskAccountabilityStatus[];
  habituallyUndone: TaskAccountabilityStatus[];
  longStandingDrift: TaskAccountabilityStatus[];
  activeBacklog: TaskAccountabilityStatus[];
  conversationThreadsByTaskId: Record<string, ConversationalMessage[]>;
  quickReplies: QuickReplySpecDto[];
  settings: PartnerSettingsDto;
  breadcrumbs: BreadcrumbEntry[];
  wcagContrastAudit: ContrastAuditEntry[];
  swapRequired: boolean;
  pendingSwapCandidateTaskId: string | null;
  statusBanner: string;
}
