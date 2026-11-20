import { Injectable, computed, inject, signal } from '@angular/core';
import { PulseApiClient } from '../api/pulse-api.client';
import {
  ConversationalMessage,
  HorizonWindowCardModel,
  PartnerSettingsDto,
  PulseDashboardResponse,
  TaskAccountabilityStatus,
  TriageActionCode
} from '../models/pulse.models';
import { buildSeedDashboardState } from '../fixtures/pulse-seed';

export type NavTab = 'HORIZON' | 'UNDONE_LOG' | 'SETTINGS';

@Injectable({ providedIn: 'root' })
export class PulseStateService {
  private readonly api = inject(PulseApiClient);

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
    this.api.getState().subscribe({
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

  triageTask(
    taskId: string,
    action: TriageActionCode,
    waitingOn?: string | null,
    postponeDays?: number | null
  ): void {
    this.api
      .triageTask(taskId, {
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
    this.api
      .swapTop3({
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
    this.api.sendChatMessage(taskId, { message }).subscribe({
      next: (res) => {
        this.dashboard.set(res);
        this.backendConnected.set(true);
      }
    });
  }

  updateSettings(updated: PartnerSettingsDto): void {
    this.api.updateSettings(updated).subscribe({
      next: (res) => {
        this.dashboard.set(res);
        this.backendConnected.set(true);
      }
    });
  }

  resetDemo(): void {
    this.api.resetDemo().subscribe({
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
    return buildSeedDashboardState();
  }
}
