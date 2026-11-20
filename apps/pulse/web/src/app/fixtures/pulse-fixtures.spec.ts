import { describe, expect, it } from 'vitest';
import { FakeGoogleTasksStub } from './fake-google-tasks-stub';
import {
  SEED_NOW_MS,
  SEED_TASK_LISTS,
  SEED_UNDONE_HISTORY,
  SEED_USERS,
  buildSeedDashboardState
} from './pulse-seed';
import { isStrictlyDescendingByScore } from '../domain/pulse-domain.engine';

describe('Pulse Shared Fixtures & Fake Google Tasks Stub (STE-61)', () => {
  it('provides deterministic seed users, task lists, undone history, and 3 descending Horizon windows', () => {
    const state = buildSeedDashboardState({ nowMs: SEED_NOW_MS });

    expect(SEED_USERS.length).toBeGreaterThanOrEqual(2);
    expect(SEED_TASK_LISTS.length).toBeGreaterThanOrEqual(3);
    expect(SEED_UNDONE_HISTORY.length).toBeGreaterThanOrEqual(3);

    expect(state.horizon.windows).toHaveLength(3);
    expect(state.habituallyUndone.length).toBe(3);
    expect(state.longStandingDrift.length).toBe(2);
    expect(state.top3Commitments).toHaveLength(0);

    for (const win of state.horizon.windows) {
      expect(isStrictlyDescendingByScore(win.items)).toBe(true);
    }
  });

  it('enforces the Top-3 scarcity cap and resolves swaps via FakeGoogleTasksStub', () => {
    const stub = new FakeGoogleTasksStub();

    stub.triageTask('task-tax-receipts', 'COMMIT_TODAY');
    stub.triageTask('task-dentist-call', 'COMMIT_TODAY');
    const threeState = stub.triageTask('task-arch-rfc', 'COMMIT_TODAY');
    expect(threeState.top3Commitments).toHaveLength(3);
    expect(threeState.swapRequired).toBe(false);

    // 4th pin triggers swap dialog
    const overflowState = stub.triageTask('task-passport-renewal', 'COMMIT_TODAY');
    expect(overflowState.swapRequired).toBe(true);
    expect(overflowState.pendingSwapCandidateTaskId).toBe('task-passport-renewal');

    // Swapping replaces the removed task and clears swapRequired
    const swappedState = stub.swapTop3('task-arch-rfc', 'task-passport-renewal');
    expect(swappedState.swapRequired).toBe(false);
    expect(swappedState.pendingSwapCandidateTaskId).toBeNull();
    expect(swappedState.top3Commitments.map((s) => s.task.id)).toContain('task-passport-renewal');
    expect(swappedState.top3Commitments.map((s) => s.task.id)).not.toContain('task-arch-rfc');
  });

  it('supports rescue triage actions (shrink, reschedule, park, complete) and deterministic resetDemo', () => {
    const stub = new FakeGoogleTasksStub();

    const shrunk = stub.triageTask('task-tax-receipts', 'SHRINK_TO_5M');
    const shrunkTask = shrunk.allStatuses.find((s) => s.task.id === 'task-tax-receipts')?.task;
    expect(shrunkTask?.title).toMatch(/^5m starter:/);
    expect(shrunkTask?.energy).toBe('QUICK_WIN');

    const rescheduled = stub.triageTask('task-dentist-call', 'RESCHEDULE');
    const rescheduledTask = rescheduled.allStatuses.find((s) => s.task.id === 'task-dentist-call')?.task;
    expect(rescheduledTask?.deferCount).toBe(5);

    const parked = stub.triageTask('task-cloud-billing', 'PARK_SOMEDAY');
    expect(
      parked.allStatuses.find((s) => s.task.id === 'task-cloud-billing')?.category
    ).toBe('COMPLETED_OR_PARKED');

    const completed = stub.triageTask('task-sprint-notes', 'COMPLETE');
    expect(
      completed.allStatuses.find((s) => s.task.id === 'task-sprint-notes')?.task.isCompleted
    ).toBe(true);

    expect(stub.getUndoneHistory().length).toBeGreaterThan(SEED_UNDONE_HISTORY.length);

    const reset = stub.resetDemo();
    expect(reset.top3Commitments).toHaveLength(0);
    expect(reset.habituallyUndone).toHaveLength(3);
  });
});
