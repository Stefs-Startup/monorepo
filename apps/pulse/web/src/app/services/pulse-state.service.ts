import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ConversationalMessage,
  HorizonWindowBarItem,
  HorizonWindowCardModel,
  PartnerSettingsDto,
  PulseDashboardResponse,
  TaskAccountabilityStatus
} from '../models/pulse.models';

export type NavTab = 'HORIZON' | 'UNDONE_LOG' | 'SETTINGS';

@Injectable({ providedIn: 'root' })
export class PulseStateService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = '/api/v1/pulse';

  readonly activeTab = signal<NavTab>('HORIZON');
  readonly activeWindowIndex = signal<number>(0);
  readonly selectedTaskId = signal<string | null>('task-tax-receipts');
  readonly isChatOpen = signal<boolean>(false);
  readonly darkTheme = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly backendConnected = signal<boolean>(false);

  readonly dashboard = signal<PulseDashboardResponse>(this.buildFallbackState());

  readonly windows = computed<HorizonWindowCardModel[]>(() => this.dashboard().horizon.windows);

  readonly currentWindow = computed<HorizonWindowCardModel | null>(() => {
    const list = this.windows();
    const idx = this.activeWindowIndex();
    return list[idx] ?? list[0] ?? null;
  });

  readonly selectedTaskStatus = computed<TaskAccountabilityStatus | null>(() => {
    const id = this.selectedTaskId();
    const all = this.dashboard().allStatuses;
    if (id) {
      const match = all.find((s) => s.task.id === id && s.category !== 'COMPLETED_OR_PARKED');
      if (match) return match;
    }
    const win = this.currentWindow();
    if (win && win.items.length > 0) {
      return all.find((s) => s.task.id === win.items[0].taskId) ?? null;
    }
    return all.find((s) => s.category !== 'COMPLETED_OR_PARKED') ?? null;
  });

  readonly activeChatThread = computed<ConversationalMessage[]>(() => {
    const status = this.selectedTaskStatus();
    if (!status) return [];
    return this.dashboard().conversationThreadsByTaskId[status.task.id] ?? [];
  });

  loadState(): void {
    this.isLoading.set(true);
    this.http.get<PulseDashboardResponse>(`${this.apiBase}/state`).subscribe({
      next: (res) => {
        this.dashboard.set(res);
        this.backendConnected.set(true);
        this.ensureValidSelection(res);
        this.isLoading.set(false);
      },
      error: () => {
        this.backendConnected.set(false);
        this.isLoading.set(false);
      }
    });
  }

  selectWindow(index: number): void {
    this.activeWindowIndex.set(index);
    const win = this.windows()[index];
    if (win && win.items.length > 0) {
      this.selectedTaskId.set(win.items[0].taskId);
    }
  }

  selectTask(taskId: string): void {
    this.selectedTaskId.set(taskId);
  }

  openReflectChat(taskId?: string): void {
    if (taskId) {
      this.selectedTaskId.set(taskId);
    }
    this.isChatOpen.set(true);
  }

  closeReflectChat(): void {
    this.isChatOpen.set(false);
  }

  cycleNextStalledTask(): void {
    const open = this.dashboard().allStatuses.filter((s) => s.category !== 'COMPLETED_OR_PARKED');
    if (open.length === 0) return;
    const currentId = this.selectedTaskStatus()?.task.id;
    const idx = open.findIndex((s) => s.task.id === currentId);
    const next = open[(idx + 1) % open.length];
    this.selectedTaskId.set(next.task.id);
  }

  triageTask(taskId: string, action: string, waitingOn?: string, postponeDays?: number): void {
    this.http
      .post<PulseDashboardResponse>(`${this.apiBase}/tasks/${taskId}/triage`, {
        action,
        waitingOn,
        postponeDays
      })
      .subscribe({
        next: (res) => {
          this.dashboard.set(res);
          this.backendConnected.set(true);
          this.ensureValidSelection(res);
        }
      });
  }

  swapTop3(toRemoveTaskId: string, toAddTaskId: string): void {
    this.http
      .post<PulseDashboardResponse>(`${this.apiBase}/tasks/swap`, {
        toRemoveTaskId,
        toAddTaskId
      })
      .subscribe({
        next: (res) => {
          this.dashboard.set(res);
          this.backendConnected.set(true);
        }
      });
  }

  dismissSwapModal(): void {
    const cur = this.dashboard();
    this.dashboard.set({
      ...cur,
      swapRequired: false,
      pendingSwapCandidateTaskId: null
    });
  }

  sendChatMessage(taskId: string, message: string): void {
    if (!message.trim()) return;
    this.http
      .post<PulseDashboardResponse>(`${this.apiBase}/tasks/${taskId}/chat`, { message })
      .subscribe({
        next: (res) => {
          this.dashboard.set(res);
          this.backendConnected.set(true);
        }
      });
  }

  updateSettings(updated: PartnerSettingsDto): void {
    this.http.put<PulseDashboardResponse>(`${this.apiBase}/settings`, updated).subscribe({
      next: (res) => {
        this.dashboard.set(res);
        this.backendConnected.set(true);
      }
    });
  }

  resetDemo(): void {
    this.http.post<PulseDashboardResponse>(`${this.apiBase}/demo/reset`, {}).subscribe({
      next: (res) => {
        this.dashboard.set(res);
        this.backendConnected.set(true);
        this.ensureValidSelection(res);
      }
    });
  }

  toggleTheme(): void {
    const next = !this.darkTheme();
    this.darkTheme.set(next);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    }
  }

  private ensureValidSelection(res: PulseDashboardResponse): void {
    const currentId = this.selectedTaskId();
    const stillOpen = res.allStatuses.some(
      (s) => s.task.id === currentId && s.category !== 'COMPLETED_OR_PARKED'
    );
    if (!stillOpen) {
      const firstOpen = res.allStatuses.find((s) => s.category !== 'COMPLETED_OR_PARKED');
      this.selectedTaskId.set(firstOpen?.task.id ?? null);
    }
  }

  private buildFallbackState(): PulseDashboardResponse {
    const now = Date.now();
    const dayMs = 86_400_000;
    const sampleStatus: TaskAccountabilityStatus = {
      task: {
        id: 'task-tax-receipts',
        googleTaskId: 'gtask-101',
        taskListId: '@default',
        taskListTitle: 'My Tasks',
        title: 'Consolidate Q3 expense receipts & CPA export',
        notes: 'Need to download PDF statements from two cards first',
        isCompleted: false,
        dueEpochMillis: now - 4 * dayMs,
        completedEpochMillis: null,
        createdEpochMillis: now - 14 * dayMs,
        updatedEpochMillis: now - 6 * dayMs,
        deferCount: 5,
        commitment: 'NORMAL',
        energy: 'DEEP_WORK',
        blockerNote: '',
        dirtySync: false
      },
      category: 'HABITUALLY_DEFERRED',
      badgeLabel: 'Deferred 5× • 14d old',
      daysOld: 14,
      daysUntouched: 6,
      daysOverdue: 4
    };

    const sampleBar: HorizonWindowBarItem = {
      taskId: 'task-tax-receipts',
      title: sampleStatus.task.title,
      shortLabel: 'Consolidate Q3 expense rece…',
      primaryMetricLabel: '5× deferred',
      secondaryMetricLabel: '14d span',
      intensityFraction: 1.0,
      category: 'HABITUALLY_DEFERRED',
      deferCount: 5,
      daysOld: 14,
      daysUntouched: 6,
      daysOverdue: 4,
      sortScore: 5014
    };

    return {
      horizon: {
        windows: [
          {
            windowType: 'HABITUALLY_UNDONE',
            title: 'Habitually Undone',
            shortTabTitle: 'Habitual (1)',
            subtitle: 'Sorted descending by deferral count',
            headlineStat: 'Max 5×',
            emptyStateTitle: 'Zero Habitually Deferred Tasks',
            emptyStateBody: 'No tasks have slipped 2 or more times.',
            items: [sampleBar]
          },
          {
            windowType: 'LONG_STANDING_DRIFT',
            title: 'Long-Standing Drift',
            shortTabTitle: 'Drifting (0)',
            subtitle: 'Sorted descending by days untouched or overdue',
            headlineStat: '0 tasks',
            emptyStateTitle: 'Zero Long-Standing Drift',
            emptyStateBody: 'Nothing is sitting untouched for 5+ days.',
            items: []
          },
          {
            windowType: 'ACTIVE_FLOW',
            title: 'Committed & Active Flow',
            shortTabTitle: 'Active (0)',
            subtitle: "Today's Top 3 commitments first, then descending by age",
            headlineStat: '0/3 Top-3',
            emptyStateTitle: 'No Active Flow Tasks Yet',
            emptyStateBody: 'Sync with Google Tasks or lock in up to 3 priorities.',
            items: []
          }
        ],
        habitualDeferralCount: 1,
        longStandingCount: 0,
        committedTodayCount: 0,
        healthyBacklogCount: 0,
        averageStalledDeferrals: 5.0,
        oldestOpenDays: 14,
        clarityRatioPercent: 0
      },
      allStatuses: [sampleStatus],
      top3Commitments: [],
      habituallyUndone: [sampleStatus],
      longStandingDrift: [],
      activeBacklog: [],
      conversationThreadsByTaskId: {
        'task-tax-receipts': [
          {
            id: 'msg-1',
            role: 'PARTNER',
            text: 'You\'ve carried "Consolidate Q3 expense receipts & CPA export" across 5 times (14 days). Zero guilt—what\'s the real friction holding this back right now?',
            suggestedActionCode: null
          }
        ]
      },
      quickReplies: [
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
      ],
      settings: {
        partnerTone: 'Candid & Warm',
        aiStreamingEnabled: true,
        connectedGoogleAccount: 'stefan@pulse.local',
        lastSyncStatus: 'Spring Boot 4 REST API',
        morningRitualTime: '08:30',
        eveningShutdownTime: '18:00',
        zeroPiiTelemetryEnabled: true
      },
      breadcrumbs: [],
      wcagContrastAudit: [],
      swapRequired: false,
      pendingSwapCandidateTaskId: null,
      statusBanner: 'Connecting to Spring Boot 4 backend…'
    };
  }
}
