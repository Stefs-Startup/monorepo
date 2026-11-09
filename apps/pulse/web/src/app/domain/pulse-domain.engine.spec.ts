import { describe, expect, it } from 'vitest';
import {
  auditPair,
  canPinDirectlyToTop3,
  contrastRatio,
  isStrictlyDescendingByScore,
  scrubSensitiveText
} from './pulse-domain.engine';
import { HorizonWindowBarItem, TaskAccountabilityStatus } from '../models/pulse.models';

describe('Pulse Angular 21 Website — Pure Domain, Scarcity, & WCAG 2.2 AA Suite', () => {
  it('verifies Material 3 Expressive Light & Dark primary and surface tokens pass WCAG 2.2 AA (>= 4.5:1)', () => {
    const pairs = [
      auditPair('Light onBackground / background', 0x171d19, 0xf6fbf6, 4.5),
      auditPair('Light onSurface / surface', 0x171d19, 0xf6fbf6, 4.5),
      auditPair('Light onPrimary / primary (Reflect FAB)', 0xffffff, 0x14533c, 4.5),
      auditPair('Light onPrimaryContainer / primaryContainer', 0x002114, 0xa9f2d0, 4.5),
      auditPair('Light onSecondaryContainer / secondaryContainer', 0x2e1500, 0xffdcc2, 4.5),
      auditPair('Dark onBackground / background', 0xdfe4df, 0x0f1511, 4.5),
      auditPair('Dark onSurface / surface', 0xdfe4df, 0x0f1511, 4.5),
      auditPair('Dark onPrimary / primary (Reflect FAB)', 0x00281a, 0x8ed5b5, 4.5),
      auditPair('Dark onPrimaryContainer / primaryContainer', 0xa9f2d0, 0x005139, 4.5),
      auditPair('Dark onSecondaryContainer / secondaryContainer', 0xffdcc2, 0x633b10, 4.5)
    ];

    for (const entry of pairs) {
      expect(entry.passesWcagAA, `${entry.pairName} had ratio ${entry.contrastRatio}`).toBe(true);
      expect(entry.contrastRatio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('computes exact 21:1 contrast ratio for black on white and 1:1 for identical colors', () => {
    expect(contrastRatio(0x000000, 0xffffff)).toBe(21);
    expect(contrastRatio(0x14533c, 0x14533c)).toBe(1);
  });

  it('scrubs sensitive emails and OAuth bearer tokens from telemetry strings', () => {
    const raw = 'User stefan@pulse.io failed with Bearer ya29.secret_oauth_token_99';
    const scrubbed = scrubSensitiveText(raw);
    expect(scrubbed).not.toContain('stefan@pulse.io');
    expect(scrubbed).not.toContain('ya29.secret_oauth_token_99');
    expect(scrubbed).toContain('[REDACTED_EMAIL]');
    expect(scrubbed).toContain('[REDACTED_TOKEN]');
  });

  it('verifies Horizon window bar items are ordered in strict descending order (#1, #2, #3)', () => {
    const descendingBars: HorizonWindowBarItem[] = [
      {
        taskId: 't1',
        title: 'Consolidate Q3 expense receipts',
        shortLabel: 'Consolidate Q3…',
        primaryMetricLabel: '5× deferred',
        secondaryMetricLabel: '14d span',
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
        title: 'Call clinic to reschedule dental checkup',
        shortLabel: 'Call clinic…',
        primaryMetricLabel: '4× deferred',
        secondaryMetricLabel: '11d span',
        intensityFraction: 0.8,
        category: 'HABITUALLY_DEFERRED',
        deferCount: 4,
        daysOld: 11,
        daysUntouched: 4,
        daysOverdue: 2,
        sortScore: 4011
      },
      {
        taskId: 't3',
        title: 'Write Spring Boot 4 + Angular 21 RFC',
        shortLabel: 'Write Spring Boot…',
        primaryMetricLabel: '2× deferred',
        secondaryMetricLabel: '9d span',
        intensityFraction: 0.4,
        category: 'HABITUALLY_DEFERRED',
        deferCount: 2,
        daysOld: 9,
        daysUntouched: 3,
        daysOverdue: 0,
        sortScore: 2009
      }
    ];

    expect(isStrictlyDescendingByScore(descendingBars)).toBe(true);
    expect(isStrictlyDescendingByScore([...descendingBars].reverse())).toBe(false);
  });

  it('enforces the 3-slot Today Top 3 scarcity gate and detects swap requirement', () => {
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
