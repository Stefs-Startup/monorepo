import {
  BreadcrumbEntry,
  ConversationalMessage,
  PartnerSettingsDto,
  PulseDashboardResponse,
  TaskItem
} from '../models/pulse.models';
import {
  SEED_NOW_MS,
  SEED_TASK_LISTS,
  SEED_UNDONE_HISTORY,
  SEED_USERS,
  SeedTaskList,
  SeedUser,
  UndoneHistoryEntry,
  buildDashboardFromTasks,
  createSeedSettings,
  createSeedTasks
} from './pulse-seed';

const DAY_MS = 86_400_000;

export type TriageActionCode =
  | 'COMMIT_TODAY'
  | 'SHRINK_TO_5M'
  | 'RESCHEDULE'
  | 'PARK_SOMEDAY'
  | 'COMPLETE';

/**
 * Deterministic in-memory fake Google Tasks + Pulse API stub.
 * Requires zero real Google credentials and powers unit tests, local fallback runs,
 * and Playwright E2E route interception.
 */
export class FakeGoogleTasksStub {
  private readonly nowMs: number;
  private tasks: TaskItem[];
  private settings: PartnerSettingsDto;
  private breadcrumbs: BreadcrumbEntry[];
  private undoneHistory: UndoneHistoryEntry[];
  private threadsByTaskId: Record<string, ConversationalMessage[]>;
  private swapRequired = false;
  private pendingSwapCandidateTaskId: string | null = null;
  private statusBanner = 'Ready • 3 Horizon Windows ranked in strict descending order';

  constructor(options?: { nowMs?: number; userEmail?: string }) {
    this.nowMs = options?.nowMs ?? SEED_NOW_MS;
    this.tasks = createSeedTasks(this.nowMs);
    this.settings = createSeedSettings(options?.userEmail);
    this.breadcrumbs = [
      {
        timestampIso: new Date(this.nowMs).toISOString(),
        event: 'STUB_INIT',
        summary: `Initialized fake Google Tasks stub for ${this.settings.connectedGoogleAccount}`
      }
    ];
    this.undoneHistory = [...SEED_UNDONE_HISTORY];
    this.threadsByTaskId = {
      'task-tax-receipts': [
        {
          id: 'msg-1',
          role: 'PARTNER',
          text: 'You\'ve carried "Consolidate Q3 expense receipts & CPA export" across 5 times (14 days). Zero guilt—what\'s the real friction holding this back right now?',
          suggestedActionCode: null
        }
      ]
    };
  }

  listUsers(): readonly SeedUser[] {
    return SEED_USERS;
  }

  listTaskLists(): readonly SeedTaskList[] {
    return SEED_TASK_LISTS;
  }

  listTasks(taskListId?: string): readonly TaskItem[] {
    if (!taskListId) return this.tasks;
    return this.tasks.filter((t) => t.taskListId === taskListId);
  }

  getUndoneHistory(): readonly UndoneHistoryEntry[] {
    return this.undoneHistory;
  }

  getState(): PulseDashboardResponse {
    return buildDashboardFromTasks({
      tasks: this.tasks.map((t) => ({ ...t })),
      settings: { ...this.settings },
      breadcrumbs: [...this.breadcrumbs],
      threadsByTaskId: { ...this.threadsByTaskId },
      swapRequired: this.swapRequired,
      pendingSwapCandidateTaskId: this.pendingSwapCandidateTaskId,
      statusBanner: this.statusBanner,
      nowMs: this.nowMs
    });
  }

  triageTask(
    taskId: string,
    action: string,
    waitingOn?: string,
    postponeDays: number = 1
  ): PulseDashboardResponse {
    const idx = this.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) {
      throw new Error(`Unknown taskId: ${taskId}`);
    }

    const current = this.tasks[idx];
    const deferBefore = current.deferCount;
    let updated: TaskItem = { ...current, updatedEpochMillis: this.nowMs };

    switch (action as TriageActionCode) {
      case 'COMMIT_TODAY': {
        if (current.commitment === 'TODAY_TOP_3') {
          updated.commitment = 'NORMAL';
          this.swapRequired = false;
          this.pendingSwapCandidateTaskId = null;
          this.statusBanner = `Unpinned "${current.title}" from Today's Top 3`;
        } else {
          const currentTop3 = this.tasks.filter(
            (t) => t.commitment === 'TODAY_TOP_3' && !t.isCompleted
          );
          if (currentTop3.length >= 3) {
            this.swapRequired = true;
            this.pendingSwapCandidateTaskId = taskId;
            this.statusBanner = 'Top-3 Scarcity Gate: swap an existing commitment to lock in a new priority';
            return this.getState();
          }
          updated.commitment = 'TODAY_TOP_3';
          this.swapRequired = false;
          this.pendingSwapCandidateTaskId = null;
          this.statusBanner = `Locked "${current.title}" into Today's Top 3`;
        }
        break;
      }
      case 'SHRINK_TO_5M': {
        if (!current.title.startsWith('5m starter:')) {
          updated.title = `5m starter: ${current.title}`;
        }
        updated.energy = 'QUICK_WIN';
        updated.blockerNote = waitingOn ?? current.blockerNote;
        this.statusBanner = `Shrunk "${current.title}" to a 5m starter`;
        break;
      }
      case 'RESCHEDULE': {
        updated.deferCount = current.deferCount + 1;
        updated.commitment = 'DEFERRED_INTENTIONALLY';
        updated.dueEpochMillis = this.nowMs + postponeDays * DAY_MS;
        this.statusBanner = `Rescheduled "${current.title}" to tomorrow`;
        break;
      }
      case 'PARK_SOMEDAY': {
        updated.commitment = 'SOMEDAY_PARKED';
        this.statusBanner = `Parked "${current.title}" in Someday`;
        break;
      }
      case 'COMPLETE': {
        updated.isCompleted = true;
        updated.completedEpochMillis = this.nowMs;
        updated.commitment = 'NORMAL';
        this.statusBanner = `Completed "${current.title}"`;
        break;
      }
      default:
        throw new Error(`Unsupported triage action: ${action}`);
    }

    this.tasks[idx] = updated;
    this.undoneHistory.push({
      id: `hist-${this.undoneHistory.length + 1}`,
      taskId: updated.id,
      taskTitle: updated.title,
      action: action as TriageActionCode,
      timestampIso: new Date(this.nowMs).toISOString(),
      deferCountBefore: deferBefore,
      deferCountAfter: updated.deferCount
    });
    this.breadcrumbs.push({
      timestampIso: new Date(this.nowMs).toISOString(),
      event: `TRIAGE_${action}`,
      summary: `Applied ${action} on task ${updated.id}`
    });

    return this.getState();
  }

  swapTop3(toRemoveTaskId: string, toAddTaskId: string): PulseDashboardResponse {
    const removeIdx = this.tasks.findIndex((t) => t.id === toRemoveTaskId);
    const addIdx = this.tasks.findIndex((t) => t.id === toAddTaskId);
    if (removeIdx === -1 || addIdx === -1) {
      throw new Error(`Invalid swap task IDs: remove=${toRemoveTaskId}, add=${toAddTaskId}`);
    }

    this.tasks[removeIdx] = {
      ...this.tasks[removeIdx],
      commitment: 'NORMAL',
      updatedEpochMillis: this.nowMs
    };
    this.tasks[addIdx] = {
      ...this.tasks[addIdx],
      commitment: 'TODAY_TOP_3',
      updatedEpochMillis: this.nowMs
    };
    this.swapRequired = false;
    this.pendingSwapCandidateTaskId = null;
    this.statusBanner = `Swapped Top-3: "${this.tasks[addIdx].title}" replaced "${this.tasks[removeIdx].title}"`;
    this.breadcrumbs.push({
      timestampIso: new Date(this.nowMs).toISOString(),
      event: 'SWAP_TOP_3',
      summary: `Swapped ${toRemoveTaskId} -> ${toAddTaskId}`
    });

    return this.getState();
  }

  sendChatMessage(taskId: string, message: string): PulseDashboardResponse {
    const existing = this.threadsByTaskId[taskId] ?? [];
    const nextUserMsg: ConversationalMessage = {
      id: `msg-${existing.length + 1}`,
      role: 'USER',
      text: message,
      suggestedActionCode: null
    };
    const nextPartnerMsg: ConversationalMessage = {
      id: `msg-${existing.length + 2}`,
      role: 'PARTNER',
      text: 'Got it — let us keep momentum with a concrete 5m starter or lock it into Top 3.',
      suggestedActionCode: 'SHRINK_TO_5M'
    };
    this.threadsByTaskId[taskId] = [...existing, nextUserMsg, nextPartnerMsg];
    return this.getState();
  }

  updateSettings(updated: PartnerSettingsDto): PulseDashboardResponse {
    this.settings = { ...updated };
    this.statusBanner = `Settings saved • Tone: ${this.settings.partnerTone}`;
    this.breadcrumbs.push({
      timestampIso: new Date(this.nowMs).toISOString(),
      event: 'SETTINGS_UPDATED',
      summary: `Updated settings (tone=${this.settings.partnerTone})`
    });
    return this.getState();
  }

  resetDemo(): PulseDashboardResponse {
    this.tasks = createSeedTasks(this.nowMs);
    this.settings = createSeedSettings();
    this.undoneHistory = [...SEED_UNDONE_HISTORY];
    this.swapRequired = false;
    this.pendingSwapCandidateTaskId = null;
    this.statusBanner = 'Demo seed reset • 3 Horizon Windows ready';
    this.breadcrumbs.push({
      timestampIso: new Date(this.nowMs).toISOString(),
      event: 'DEMO_RESET',
      summary: 'Reset tasks and settings to deterministic seed state'
    });
    return this.getState();
  }
}
