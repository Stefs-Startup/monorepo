import {
  AccountabilityCategory,
  BreadcrumbEntry,
  ConversationalMessage,
  HorizonWindowBarItem,
  HorizonWindowCardModel,
  PartnerSettingsDto,
  PulseDashboardResponse,
  QuickReplySpecDto,
  TaskAccountabilityStatus,
  TaskItem
} from '../models/pulse.models';
import { auditPair } from '../domain/pulse-domain.engine';

/** Fixed deterministic reference timestamp (2025-10-09T11:33:20Z) for reproducible fixtures. */
export const SEED_NOW_MS = 1_760_000_000_000;
const DAY_MS = 86_400_000;

export interface SeedUser {
  id: string;
  email: string;
  displayName: string;
  partnerTone: string;
  morningRitualTime: string;
  eveningShutdownTime: string;
}

export interface SeedTaskList {
  id: string;
  googleTaskListId: string;
  title: string;
  ownerEmail: string;
}

export interface UndoneHistoryEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  action: 'COMMIT_TODAY' | 'SHRINK_TO_5M' | 'RESCHEDULE' | 'PARK_SOMEDAY' | 'COMPLETE';
  timestampIso: string;
  deferCountBefore: number;
  deferCountAfter: number;
}

export const SEED_USERS: readonly SeedUser[] = [
  {
    id: 'user-stefan',
    email: 'stefan@pulse.local',
    displayName: 'Stefan',
    partnerTone: 'Candid & Warm',
    morningRitualTime: '08:30',
    eveningShutdownTime: '18:00'
  },
  {
    id: 'user-alex',
    email: 'alex@pulse.local',
    displayName: 'Alex',
    partnerTone: 'Direct & Minimalist',
    morningRitualTime: '09:00',
    eveningShutdownTime: '17:30'
  }
];

export const SEED_TASK_LISTS: readonly SeedTaskList[] = [
  {
    id: '@default',
    googleTaskListId: 'gtl-default',
    title: 'My Tasks',
    ownerEmail: 'stefan@pulse.local'
  },
  {
    id: 'work-list',
    googleTaskListId: 'gtl-work',
    title: 'Work',
    ownerEmail: 'stefan@pulse.local'
  },
  {
    id: 'personal-list',
    googleTaskListId: 'gtl-personal',
    title: 'Personal',
    ownerEmail: 'stefan@pulse.local'
  }
];

export const SEED_UNDONE_HISTORY: readonly UndoneHistoryEntry[] = [
  {
    id: 'hist-1',
    taskId: 'task-tax-receipts',
    taskTitle: 'Consolidate Q3 expense receipts & CPA export',
    action: 'RESCHEDULE',
    timestampIso: '2025-10-03T18:00:00Z',
    deferCountBefore: 4,
    deferCountAfter: 5
  },
  {
    id: 'hist-2',
    taskId: 'task-dentist-call',
    taskTitle: 'Call clinic to reschedule annual dental checkup',
    action: 'RESCHEDULE',
    timestampIso: '2025-10-05T18:00:00Z',
    deferCountBefore: 3,
    deferCountAfter: 4
  },
  {
    id: 'hist-3',
    taskId: 'task-arch-rfc',
    taskTitle: 'Write Spring Boot 4 + Angular 21 architecture RFC',
    action: 'RESCHEDULE',
    timestampIso: '2025-10-06T18:00:00Z',
    deferCountBefore: 1,
    deferCountAfter: 2
  }
];

export const SEED_QUICK_REPLIES: readonly QuickReplySpecDto[] = [
  {
    id: 'qr-5m',
    label: 'Too big — shrink to 5m',
    messageText: "It feels too big and vague to start right now. Let's shrink it to a 5m starter."
  },
  {
    id: 'qr-top3',
    label: "Lock into Today's Top 3",
    messageText: "I'm ready to commit and finish this today."
  }
];

export function createSeedTasks(nowMs: number = SEED_NOW_MS): TaskItem[] {
  return [
    {
      id: 'task-tax-receipts',
      googleTaskId: 'gtask-101',
      taskListId: '@default',
      taskListTitle: 'My Tasks',
      title: 'Consolidate Q3 expense receipts & CPA export',
      notes: 'Need to download PDF statements from two cards first',
      isCompleted: false,
      dueEpochMillis: nowMs - 4 * DAY_MS,
      completedEpochMillis: null,
      createdEpochMillis: nowMs - 14 * DAY_MS,
      updatedEpochMillis: nowMs - 6 * DAY_MS,
      deferCount: 5,
      commitment: 'NORMAL',
      energy: 'DEEP_WORK',
      blockerNote: '',
      dirtySync: false
    },
    {
      id: 'task-dentist-call',
      googleTaskId: 'gtask-102',
      taskListId: '@default',
      taskListTitle: 'My Tasks',
      title: 'Call clinic to reschedule annual dental checkup',
      notes: 'Clinic only answers between 9am and 4pm',
      isCompleted: false,
      dueEpochMillis: nowMs - 2 * DAY_MS,
      completedEpochMillis: null,
      createdEpochMillis: nowMs - 11 * DAY_MS,
      updatedEpochMillis: nowMs - 4 * DAY_MS,
      deferCount: 4,
      commitment: 'NORMAL',
      energy: 'QUICK_WIN',
      blockerNote: '',
      dirtySync: false
    },
    {
      id: 'task-arch-rfc',
      googleTaskId: 'gtask-103',
      taskListId: 'work-list',
      taskListTitle: 'Work',
      title: 'Write Spring Boot 4 + Angular 21 architecture RFC',
      notes: 'Outline pure domain boundaries and REST contract',
      isCompleted: false,
      dueEpochMillis: nowMs,
      completedEpochMillis: null,
      createdEpochMillis: nowMs - 9 * DAY_MS,
      updatedEpochMillis: nowMs - 3 * DAY_MS,
      deferCount: 2,
      commitment: 'NORMAL',
      energy: 'FOCUSED',
      blockerNote: '',
      dirtySync: false
    },
    {
      id: 'task-passport-renewal',
      googleTaskId: 'gtask-104',
      taskListId: 'personal-list',
      taskListTitle: 'Personal',
      title: 'Renew passport photo & mail DS-82 form',
      notes: 'Expires in 5 months; post office closes at 5pm',
      isCompleted: false,
      dueEpochMillis: nowMs - 6 * DAY_MS,
      completedEpochMillis: null,
      createdEpochMillis: nowMs - 18 * DAY_MS,
      updatedEpochMillis: nowMs - 9 * DAY_MS,
      deferCount: 1,
      commitment: 'NORMAL',
      energy: 'FOCUSED',
      blockerNote: 'Need compliant 2x2 photo',
      dirtySync: false
    },
    {
      id: 'task-cloud-billing',
      googleTaskId: 'gtask-105',
      taskListId: 'work-list',
      taskListTitle: 'Work',
      title: 'Audit Cloud Run preview budget alerts',
      notes: 'Verify zero-traffic preview revisions auto-expire',
      isCompleted: false,
      dueEpochMillis: nowMs - 5 * DAY_MS,
      completedEpochMillis: null,
      createdEpochMillis: nowMs - 12 * DAY_MS,
      updatedEpochMillis: nowMs - 7 * DAY_MS,
      deferCount: 0,
      commitment: 'NORMAL',
      energy: 'QUICK_WIN',
      blockerNote: '',
      dirtySync: false
    },
    {
      id: 'task-sprint-notes',
      googleTaskId: 'gtask-106',
      taskListId: 'work-list',
      taskListTitle: 'Work',
      title: 'Publish Wave 1 sprint verification notes',
      notes: 'Summarize Playwright and OpenAPI gates',
      isCompleted: false,
      dueEpochMillis: nowMs + DAY_MS,
      completedEpochMillis: null,
      createdEpochMillis: nowMs - 2 * DAY_MS,
      updatedEpochMillis: nowMs - DAY_MS,
      deferCount: 0,
      commitment: 'NORMAL',
      energy: 'QUICK_WIN',
      blockerNote: '',
      dirtySync: false
    }
  ];
}

export function createSeedSettings(userEmail: string = SEED_USERS[0].email): PartnerSettingsDto {
  const user = SEED_USERS.find((u) => u.email === userEmail) ?? SEED_USERS[0];
  return {
    partnerTone: user.partnerTone,
    aiStreamingEnabled: true,
    connectedGoogleAccount: user.email,
    lastSyncStatus: 'Synced • Google Tasks Stub v1',
    morningRitualTime: user.morningRitualTime,
    eveningShutdownTime: user.eveningShutdownTime,
    zeroPiiTelemetryEnabled: true
  };
}

export function classifyTaskStatus(task: TaskItem, nowMs: number = SEED_NOW_MS): TaskAccountabilityStatus {
  const daysOld = Math.max(0, Math.floor((nowMs - task.createdEpochMillis) / DAY_MS));
  const daysUntouched = Math.max(0, Math.floor((nowMs - task.updatedEpochMillis) / DAY_MS));
  const daysOverdue =
    task.dueEpochMillis !== null && task.dueEpochMillis < nowMs
      ? Math.max(0, Math.floor((nowMs - task.dueEpochMillis) / DAY_MS))
      : 0;

  let category: AccountabilityCategory;
  let badgeLabel: string;

  if (task.isCompleted || task.commitment === 'SOMEDAY_PARKED') {
    category = 'COMPLETED_OR_PARKED';
    badgeLabel = task.isCompleted ? 'Completed' : 'Parked in Someday';
  } else if (task.commitment === 'TODAY_TOP_3') {
    category = 'ACTIVE_COMMITTED';
    badgeLabel = 'Top-3 Committed';
  } else if (task.deferCount >= 2) {
    category = 'HABITUALLY_DEFERRED';
    badgeLabel = `Deferred ${task.deferCount}× • ${daysOld}d old`;
  } else if (daysUntouched >= 5 || daysOverdue >= 5) {
    category = 'LONG_STANDING_GHOSTED';
    badgeLabel = `Drifting ${daysUntouched}d idle`;
  } else {
    category = 'HEALTHY_BACKLOG';
    badgeLabel = 'Active Backlog';
  }

  return {
    task,
    category,
    badgeLabel,
    daysOld,
    daysUntouched,
    daysOverdue
  };
}

function toBarItem(
  status: TaskAccountabilityStatus,
  primaryMetricLabel: string,
  secondaryMetricLabel: string,
  sortScore: number,
  maxScore: number
): HorizonWindowBarItem {
  const title = status.task.title;
  const shortLabel = title.length > 28 ? `${title.slice(0, 27)}…` : title;
  return {
    taskId: status.task.id,
    title,
    shortLabel,
    primaryMetricLabel,
    secondaryMetricLabel,
    intensityFraction: maxScore > 0 ? Math.max(0.15, Math.min(1, sortScore / maxScore)) : 0.5,
    category: status.category,
    deferCount: status.task.deferCount,
    daysOld: status.daysOld,
    daysUntouched: status.daysUntouched,
    daysOverdue: status.daysOverdue,
    sortScore
  };
}

export function buildDashboardFromTasks(params: {
  tasks: TaskItem[];
  settings: PartnerSettingsDto;
  breadcrumbs?: BreadcrumbEntry[];
  threadsByTaskId?: Record<string, ConversationalMessage[]>;
  swapRequired?: boolean;
  pendingSwapCandidateTaskId?: string | null;
  statusBanner?: string;
  nowMs?: number;
}): PulseDashboardResponse {
  const nowMs = params.nowMs ?? SEED_NOW_MS;
  const allStatuses = params.tasks.map((t) => classifyTaskStatus(t, nowMs));

  const top3Commitments = allStatuses.filter((s) => s.task.commitment === 'TODAY_TOP_3' && !s.task.isCompleted);
  const habituallyUndone = allStatuses
    .filter((s) => s.category === 'HABITUALLY_DEFERRED')
    .sort((a, b) => b.task.deferCount * 1000 + b.daysOld - (a.task.deferCount * 1000 + a.daysOld));
  const longStandingDrift = allStatuses
    .filter((s) => s.category === 'LONG_STANDING_GHOSTED')
    .sort((a, b) => b.daysUntouched * 100 + b.daysOverdue - (a.daysUntouched * 100 + a.daysOverdue));
  const activeBacklog = allStatuses.filter(
    (s) => s.category === 'ACTIVE_COMMITTED' || s.category === 'HEALTHY_BACKLOG'
  );

  const maxHabitualScore = habituallyUndone[0]
    ? habituallyUndone[0].task.deferCount * 1000 + habituallyUndone[0].daysOld
    : 1;
  const habitualItems = habituallyUndone.map((s) =>
    toBarItem(
      s,
      `${s.task.deferCount}× deferred`,
      `${s.daysOld}d span`,
      s.task.deferCount * 1000 + s.daysOld,
      maxHabitualScore
    )
  );

  const maxDriftScore = longStandingDrift[0]
    ? longStandingDrift[0].daysUntouched * 100 + longStandingDrift[0].daysOverdue
    : 1;
  const driftItems = longStandingDrift.map((s) =>
    toBarItem(
      s,
      `${s.daysUntouched}d idle`,
      `${s.daysOverdue}d overdue`,
      s.daysUntouched * 100 + s.daysOverdue,
      maxDriftScore
    )
  );

  const sortedActive = [...activeBacklog].sort((a, b) => {
    const aPin = a.task.commitment === 'TODAY_TOP_3' ? 1 : 0;
    const bPin = b.task.commitment === 'TODAY_TOP_3' ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;
    return b.daysOld - a.daysOld;
  });
  const maxActiveScore = sortedActive[0]
    ? (sortedActive[0].task.commitment === 'TODAY_TOP_3' ? 1000 : 0) + sortedActive[0].daysOld + 1
    : 1;
  const activeItems = sortedActive.map((s) => {
    const score = (s.task.commitment === 'TODAY_TOP_3' ? 1000 : 0) + s.daysOld + 1;
    return toBarItem(
      s,
      s.task.commitment === 'TODAY_TOP_3' ? 'Top-3 Locked' : 'Backlog',
      `${s.daysOld}d old`,
      score,
      maxActiveScore
    );
  });

  const windows: HorizonWindowCardModel[] = [
    {
      windowType: 'HABITUALLY_UNDONE',
      title: 'Habitually Undone',
      shortTabTitle: `Habitual (${habitualItems.length})`,
      subtitle: 'Sorted descending by deferral count',
      headlineStat: habituallyUndone[0] ? `Max ${habituallyUndone[0].task.deferCount}×` : '0 tasks',
      emptyStateTitle: 'Zero Habitually Deferred Tasks',
      emptyStateBody: 'No tasks have slipped 2 or more times.',
      items: habitualItems
    },
    {
      windowType: 'LONG_STANDING_DRIFT',
      title: 'Long-Standing Drift',
      shortTabTitle: `Drifting (${driftItems.length})`,
      subtitle: 'Sorted descending by days untouched or overdue',
      headlineStat: `${driftItems.length} tasks`,
      emptyStateTitle: 'Zero Long-Standing Drift',
      emptyStateBody: 'Nothing is sitting untouched for 5+ days.',
      items: driftItems
    },
    {
      windowType: 'ACTIVE_FLOW',
      title: 'Committed & Active Flow',
      shortTabTitle: `Active (${activeItems.length})`,
      subtitle: "Today's Top 3 commitments first, then descending by age",
      headlineStat: `${top3Commitments.length}/3 Top-3`,
      emptyStateTitle: 'No Active Flow Tasks Yet',
      emptyStateBody: 'Sync with Google Tasks or lock in up to 3 priorities.',
      items: activeItems
    }
  ];

  const openStatuses = allStatuses.filter((s) => s.category !== 'COMPLETED_OR_PARKED');
  const avgDeferrals =
    openStatuses.length > 0
      ? Math.round((openStatuses.reduce((acc, s) => acc + s.task.deferCount, 0) / openStatuses.length) * 10) / 10
      : 0;
  const oldestOpenDays = openStatuses.reduce((max, s) => Math.max(max, s.daysOld), 0);

  const defaultThreads: Record<string, ConversationalMessage[]> = params.threadsByTaskId ?? {
    'task-tax-receipts': [
      {
        id: 'msg-1',
        role: 'PARTNER',
        text: 'You\'ve carried "Consolidate Q3 expense receipts & CPA export" across 5 times (14 days). Zero guilt—what\'s the real friction holding this back right now?',
        suggestedActionCode: null
      }
    ]
  };

  return {
    horizon: {
      windows,
      habitualDeferralCount: habitualItems.length,
      longStandingCount: driftItems.length,
      committedTodayCount: top3Commitments.length,
      healthyBacklogCount: activeBacklog.filter((s) => s.category === 'HEALTHY_BACKLOG').length,
      averageStalledDeferrals: avgDeferrals,
      oldestOpenDays,
      clarityRatioPercent: openStatuses.length > 0 ? Math.round((top3Commitments.length / 3) * 100) : 100
    },
    allStatuses,
    top3Commitments,
    habituallyUndone,
    longStandingDrift,
    activeBacklog,
    conversationThreadsByTaskId: defaultThreads,
    quickReplies: [...SEED_QUICK_REPLIES],
    settings: params.settings,
    breadcrumbs: params.breadcrumbs ?? [
      {
        timestampIso: new Date(nowMs).toISOString(),
        event: 'SEED_LOADED',
        summary: `Loaded ${params.tasks.length} deterministic seed tasks across ${SEED_TASK_LISTS.length} lists`
      }
    ],
    wcagContrastAudit: [
      auditPair('Primary Text / Surface', 0x1a1c1e, 0xf8f9fb),
      auditPair('Primary Container', 0x0b3954, 0xd4e8f7)
    ],
    swapRequired: params.swapRequired ?? false,
    pendingSwapCandidateTaskId: params.pendingSwapCandidateTaskId ?? null,
    statusBanner: params.statusBanner ?? 'Ready • 3 Horizon Windows ranked in strict descending order'
  };
}

export function buildSeedDashboardState(options?: {
  nowMs?: number;
  userEmail?: string;
}): PulseDashboardResponse {
  const nowMs = options?.nowMs ?? SEED_NOW_MS;
  return buildDashboardFromTasks({
    tasks: createSeedTasks(nowMs),
    settings: createSeedSettings(options?.userEmail),
    nowMs
  });
}
