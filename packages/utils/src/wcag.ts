/**
 * Pure functional WCAG 2.2 Level AA color contrast utilities.
 */

export interface ContrastAuditEntry {
  pairName: string;
  foregroundRgb: number;
  backgroundRgb: number;
  contrastRatio: number;
  minimumRequired: number;
  passesWcagAA: boolean;
}

export interface ThemePalettePairInput {
  pairName: string;
  fg: number | string;
  bg: number | string;
  minRatio?: number;
}

export interface ThemePaletteAuditResult {
  passed: boolean;
  entries: ContrastAuditEntry[];
}

const HEX_COLOR_PATTERN = /^(?:#|0[xX])([0-9a-fA-F]{6})$/;

/**
 * Parses a `#RRGGBB` or `0xRRGGBB` hex color string into a 24-bit integer.
 */
export function parseHexColor(hex: string): number {
  const match = HEX_COLOR_PATTERN.exec(hex.trim());
  if (!match) {
    throw new Error(
      `Invalid hex color "${hex}". Expected #RRGGBB or 0xRRGGBB format.`,
    );
  }
  return Number.parseInt(match[1], 16);
}

function linearizeSrgbChannel(channel255: number): number {
  const srgb = channel255 / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/**
 * Computes WCAG 2.2 relative luminance for a 24-bit `0xRRGGBB` integer.
 */
export function relativeLuminance(rgb: number): number {
  if (!Number.isInteger(rgb) || rgb < 0 || rgb > 0xffffff) {
    throw new Error(
      `Invalid 24-bit RGB color "${rgb}". Expected integer between 0x000000 and 0xFFFFFF.`,
    );
  }
  const r = linearizeSrgbChannel((rgb >>> 16) & 0xff);
  const g = linearizeSrgbChannel((rgb >>> 8) & 0xff);
  const b = linearizeSrgbChannel(rgb & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Computes WCAG 2.2 contrast ratio between two 24-bit RGB colors, rounded to 2 decimal places.
 */
export function contrastRatio(
  foregroundRgb: number,
  backgroundRgb: number,
): number {
  const l1 = relativeLuminance(foregroundRgb);
  const l2 = relativeLuminance(backgroundRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const rawRatio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(rawRatio * 100) / 100;
}

/**
 * Audits a single foreground/background RGB pair against a minimum WCAG contrast threshold.
 */
export function auditPair(
  pairName: string,
  foregroundRgb: number,
  backgroundRgb: number,
  minimumRequired = 4.5,
): ContrastAuditEntry {
  const ratio = contrastRatio(foregroundRgb, backgroundRgb);
  return {
    pairName,
    foregroundRgb,
    backgroundRgb,
    contrastRatio: ratio,
    minimumRequired,
    passesWcagAA: ratio >= minimumRequired,
  };
}

function resolveRgbColor(color: number | string): number {
  return typeof color === "string" ? parseHexColor(color) : color;
}

/**
 * Audits an entire theme palette of color pairs against WCAG 2.2 AA contrast thresholds.
 */
export function auditThemePalette(
  pairs: readonly ThemePalettePairInput[],
): ThemePaletteAuditResult {
  const entries = pairs.map((pair) =>
    auditPair(
      pair.pairName,
      resolveRgbColor(pair.fg),
      resolveRgbColor(pair.bg),
      pair.minRatio ?? 4.5,
    ),
  );
  return {
    passed: entries.every((entry) => entry.passesWcagAA),
    entries,
  };
}
