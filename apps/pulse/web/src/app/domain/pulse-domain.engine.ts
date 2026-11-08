import {
  ContrastAuditEntry,
  HorizonWindowBarItem,
  TaskAccountabilityStatus
} from '../models/pulse.models';

/**
 * Pure TypeScript WCAG 2.2 AA contrast verifier & Zero-PII scrubber for Angular unit tests.
 */
export function relativeLuminance(rgb: number): number {
  const r = ((rgb >> 16) & 0xff) / 255.0;
  const g = ((rgb >> 8) & 0xff) / 255.0;
  const b = (rgb & 0xff) / 255.0;

  const linearize = (c: number): number =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(foregroundRgb: number, backgroundRgb: number): number {
  const l1 = relativeLuminance(foregroundRgb);
  const l2 = relativeLuminance(backgroundRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

export function auditPair(
  pairName: string,
  foregroundRgb: number,
  backgroundRgb: number,
  minimumRequired = 4.5
): ContrastAuditEntry {
  const ratio = contrastRatio(foregroundRgb, backgroundRgb);
  return {
    pairName,
    foregroundRgb,
    backgroundRgb,
    contrastRatio: ratio,
    minimumRequired,
    passesWcagAA: ratio >= minimumRequired
  };
}

export function scrubSensitiveText(input: string): string {
  if (!input) return '';
  return input
    .replace(/(Bearer\s+|ya29\.)[A-Za-z0-9._\-]+/gi, '[REDACTED_TOKEN]')
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
}

export function isStrictlyDescendingByScore(items: HorizonWindowBarItem[]): boolean {
  for (let i = 1; i < items.length; i++) {
    if (items[i].sortScore > items[i - 1].sortScore) {
      return false;
    }
  }
  return true;
}

export function canPinDirectlyToTop3(
  currentTop3: TaskAccountabilityStatus[],
  candidateTaskId: string,
  maxSlots = 3
): 'ALLOW_PIN' | 'UNPIN' | 'SWAP_REQUIRED' {
  if (currentTop3.some((s) => s.task.id === candidateTaskId)) {
    return 'UNPIN';
  }
  return currentTop3.length < maxSlots ? 'ALLOW_PIN' : 'SWAP_REQUIRED';
}
