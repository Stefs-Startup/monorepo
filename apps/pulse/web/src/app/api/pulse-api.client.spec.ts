import '@angular/compiler';
import { HttpClient } from '@angular/common/http';
import { Injector, runInInjectionContext } from '@angular/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { isStrictlyDescendingByScore } from '../domain/pulse-domain.engine';
import {
  isTriageActionCode,
  PulseDashboardResponse,
  TRIAGE_ACTION_CODES
} from '../models/pulse.models';
import { PulseApiClient } from './pulse-api.client';

interface RecordedCall {
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  body?: unknown;
}

describe('REQ-PULSE-003: PulseApiClient & OpenAPI 3.1 Generated Contract Suite', () => {
  async function loadGoldenFixture(): Promise<PulseDashboardResponse> {
    const fsModule = 'node:fs';
    const fs = (await import(/* @vite-ignore */ fsModule)) as {
      readFileSync(path: URL, encoding: 'utf8'): string;
    };
    const fixtureUrl = new URL('../../../../contracts/fixtures/pulse-state.golden.json', import.meta.url);
    return JSON.parse(fs.readFileSync(fixtureUrl, 'utf8')) as PulseDashboardResponse;
  }

  function createClient(fixture: PulseDashboardResponse): {
    client: PulseApiClient;
    calls: RecordedCall[];
  } {
    const calls: RecordedCall[] = [];
    const mockHttp = {
      get: vi.fn((url: string) => {
        calls.push({ method: 'GET', url });
        return of(fixture);
      }),
      post: vi.fn((url: string, body: unknown) => {
        calls.push({ method: 'POST', url, body });
        return of(fixture);
      }),
      put: vi.fn((url: string, body: unknown) => {
        calls.push({ method: 'PUT', url, body });
        return of(fixture);
      })
    } as unknown as HttpClient;

    const injector = Injector.create({
      providers: [{ provide: HttpClient, useValue: mockHttp }]
    });
    const client = runInInjectionContext(injector, () => new PulseApiClient());
    return { client, calls };
  }

  it('validates shared golden fixture against generated OpenAPI 3.1 PulseDashboardResponse contract', async () => {
    const golden = await loadGoldenFixture();

    expect(golden.horizon.windows).toHaveLength(3);
    expect(golden.wcagContrastAudit).toHaveLength(18);
    expect(golden.pendingSwapCandidateTaskId).toBeNull();

    for (const windowCard of golden.horizon.windows) {
      expect(isStrictlyDescendingByScore(windowCard.items)).toBe(true);
    }

    const taskWithNullables = golden.allStatuses.find((s) => s.task.id === 'task-garage-shelf');
    expect(taskWithNullables?.task.googleTaskId).toBeNull();
    expect(taskWithNullables?.task.dueEpochMillis).toBeNull();
    expect(taskWithNullables?.task.completedEpochMillis).toBeNull();

    const thread = golden.conversationThreadsByTaskId['task-tax-receipts'] ?? [];
    expect(thread[0]?.suggestedActionCode).toBeNull();
    expect(thread[2]?.suggestedActionCode).toBe('SHRINK_TO_5M');
  });

  it('invokes exact OpenAPI paths, HTTP verbs, and typed payloads across all 6 endpoints', async () => {
    const fixture = await loadGoldenFixture();
    const { client, calls } = createClient(fixture);

    client.getState().subscribe();
    client.triageTask('task/with space', { action: 'RESCHEDULE', postponeDays: 2, waitingOn: null }).subscribe();
    client.swapTop3({ toRemoveTaskId: 'task-top3-contract', toAddTaskId: 'task-tax-receipts' }).subscribe();
    client.sendChatMessage('task-tax-receipts', { message: 'Shrink this down' }).subscribe();
    client.updateSettings(fixture.settings).subscribe();
    client.resetDemo().subscribe();

    expect(calls).toEqual([
      { method: 'GET', url: '/api/v1/pulse/state' },
      {
        method: 'POST',
        url: '/api/v1/pulse/tasks/task%2Fwith%20space/triage',
        body: { action: 'RESCHEDULE', postponeDays: 2, waitingOn: null }
      },
      {
        method: 'POST',
        url: '/api/v1/pulse/tasks/swap',
        body: { toRemoveTaskId: 'task-top3-contract', toAddTaskId: 'task-tax-receipts' }
      },
      {
        method: 'POST',
        url: '/api/v1/pulse/tasks/task-tax-receipts/chat',
        body: { message: 'Shrink this down' }
      },
      {
        method: 'PUT',
        url: '/api/v1/pulse/settings',
        body: fixture.settings
      },
      {
        method: 'POST',
        url: '/api/v1/pulse/demo/reset',
        body: {}
      }
    ]);
  });

  it('narrows valid TriageActionCode values and rejects typos at runtime', () => {
    for (const code of TRIAGE_ACTION_CODES) {
      expect(isTriageActionCode(code)).toBe(true);
    }
    expect(isTriageActionCode('INVALID_ACTION')).toBe(false);
    expect(isTriageActionCode('')).toBe(false);
  });
});
