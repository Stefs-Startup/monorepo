import { describe, expect, it } from 'vitest';
import {
  auditPair,
  canPinDirectlyToTop3,
  isStrictlyDescendingByScore,
  scrubSensitiveText
} from './pulse-domain.engine';
import { HorizonWindowBarItem, TaskAccountabilityStatus } from '../models/pulse.models';

describe('Pulse Angular 21 Pure Domain & WCAG 2.2 AA Engine', () => {
  it('verifies Material 3 Expressive Light & Dark primary tokens pass WCAG 2.2 AA (>= 4.5:1)', () => {
    const lightPrimary = auditPair('Light onPrimary / primary', 0xffffff, 0x14533c, 4.5);
    const darkPrimary = auditPair('Dark onPrimary / primary', 0x00281a, 0x8ed5b5, 4.5);
    const lightSurface = auditPair('Light onSurface / surface', 0x171d19, 0xf6fbf6, 4.5);
    const darkSurface = auditPair('Dark onSurface / surface', 0xdfe4df, 0x0f1511, 4.5);

    expect(lightPrimary.passesWcagAA).toBe(true);
    expect(darkPrimary.passesWcagAA).toBe(true);
    expect(lightSurface.passesWcagAA).toBe(true);
    expect(darkSurface.passesWcagAA).toBe(true);
  });

  it('scrubs sensitive emails and OAuth bearer tokens from telemetry strings', () => {
    const raw = 'User stefan@pulse.io failed with Bearer ya29.secret_oauth_token_99';
    const scrubbed = scrubSensitiveText(raw);
    expect(scrubbed).not.toContain('stefan@pulse.io');
    expect(scrubbed).not.toContain('ya29.secret_oauth_token_99');
    expect(scrubbed).toContain('[REDACTED_EMAIL]');
    expect(scrubbed).toContain('[REDACTED_TOKEN]');
  });

  it('verifies Horizon window bar items are ordered in strict descending order', () => {
    const bars: HorizonWindowBarItem[] = [
      {
        taskId: 't1',
        title: 'Task 1',
        shortLabel: 'Task 1',
        primaryMetricLabel: '5x',
        secondaryMetricLabel: '14d',
        intensityFraction: 1,
        category: 'HABITUALLY_DEFERRED',
        deferCount: 5,
        daysOld: 14,
        daysUntouched: 6,
        daysOverdue: 4,
        sortScore: 5014
      },
      {
        taskId: 't2',
        title: 'Task 2',
        shortLabel: 'Task 2',
        primaryMetricLabel: '3x',
        secondaryMetricLabel: '9d',
        intensityFraction: 0.6,
        category: 'HABITUALLY_DEFERRED',
        deferCount: 3,
        daysOld: 9,
        daysUntouched: 3,
        daysOverdue: 1,
        sortScore: 3009
      }
    ];

    expect(isStrictlyDescendingByScore(bars)).toBe(true);
  });

  it('enforces the 3-slot Today Top 3 scarcity gate', () => {
    const makeStatus = (id: string): TaskAccountabilityStatus => ({
      task: {
        id,
        googleTaskId: id,
        taskListId: '@default',
        taskListTitle: 'My Tasks',
        title: `Task ${id}`,
        notes: '',
        isCompleted: false,
        dueEpochMillis: null,
        completedEpochMillis: null,
        createdEpochMillis: 1000,
        updatedEpochMillis: 1000,
        deferCount: 0,
        commitment: 'TODAY_TOP_3',
        energy: 'FOCUSED',
        blockerNote: '',
        dirtySync: false
      },
      category: 'ACTIVE_COMMITTED',
      badgeLabel: 'Committed Today',
      daysOld: 1,
      daysUntouched: 0,
      daysOverdue: 0
    });

    const twoPinned = [makeStatus('1'), makeStatus('2')];
    expect(canPinDirectlyToTop3(twoPinned, '3')).toBe('ALLOW_PIN');
    expect(canPinDirectlyToTop3(twoPinned, '1')).toBe('UNPIN');

    const threePinned = [...twoPinned, makeStatus('3')];
    expect(canPinDirectlyToTop3(threePinned, '4')).toBe('SWAP_REQUIRED');
  });
});
