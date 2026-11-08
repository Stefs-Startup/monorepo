package com.pulse.backend.domain;

import java.util.List;

/**
 * Pure functional WCAG 2.2 Level AA color contrast & relative luminance engine (SC 1.4.3 / 1.4.11).
 * Zero framework dependencies — 100% deterministic for unit test enforcement.
 */
public final class WcagContrastEngine {

    private WcagContrastEngine() {}

    public record ContrastAuditEntry(
            String pairName,
            int foregroundRgb,
            int backgroundRgb,
            double contrastRatio,
            double minimumRequired,
            boolean passesWcagAA
    ) {}

    public static double relativeLuminance(int rgb) {
        double r = ((rgb >> 16) & 0xFF) / 255.0;
        double g = ((rgb >> 8) & 0xFF) / 255.0;
        double b = (rgb & 0xFF) / 255.0;

        double rLin = linearizeChannel(r);
        double gLin = linearizeChannel(g);
        double bLin = linearizeChannel(b);

        return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
    }

    private static double linearizeChannel(double c) {
        if (c <= 0.04045) {
            return c / 12.92;
        }
        return Math.pow((c + 0.055) / 1.055, 2.4);
    }

    public static double contrastRatio(int foregroundRgb, int backgroundRgb) {
        double l1 = relativeLuminance(foregroundRgb);
        double l2 = relativeLuminance(backgroundRgb);
        double lighter = Math.max(l1, l2);
        double darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    public static ContrastAuditEntry auditPair(
            String pairName,
            int foregroundRgb,
            int backgroundRgb,
            double minimumRequired
    ) {
        double ratio = Math.round(contrastRatio(foregroundRgb, backgroundRgb) * 100.0) / 100.0;
        return new ContrastAuditEntry(
                pairName,
                foregroundRgb,
                backgroundRgb,
                ratio,
                minimumRequired,
                ratio >= minimumRequired
        );
    }

    public static List<ContrastAuditEntry> auditExpressiveThemePalette() {
        return List.of(
                // Light Scheme pairs
                auditPair("Light onBackground / background", 0x171D19, 0xF6FBF6, 4.5),
                auditPair("Light onSurface / surface", 0x171D19, 0xF6FBF6, 4.5),
                auditPair("Light onSurfaceVariant / surfaceContainerHigh", 0x353E38, 0xE4E9E5, 4.5),
                auditPair("Light onPrimary / primary (Reflect FAB)", 0xFFFFFF, 0x14533C, 4.5),
                auditPair("Light onPrimaryContainer / primaryContainer", 0x002114, 0xA9F2D0, 4.5),
                auditPair("Light onSecondaryContainer / secondaryContainer", 0x2E1500, 0xFFDCC2, 4.5),
                auditPair("Light onTertiaryContainer / tertiaryContainer", 0x001C38, 0xD3E4FF, 4.5),
                auditPair("Light onErrorContainer / errorContainer", 0x410002, 0xFFDAD6, 4.5),
                auditPair("Light onError / error", 0xFFFFFF, 0xBA1A1A, 4.5),
                // Dark Scheme pairs
                auditPair("Dark onBackground / background", 0xDFE4DF, 0x0F1511, 4.5),
                auditPair("Dark onSurface / surface", 0xDFE4DF, 0x0F1511, 4.5),
                auditPair("Dark onSurfaceVariant / surfaceContainerHigh", 0xC8D2CA, 0x252B27, 4.5),
                auditPair("Dark onPrimary / primary (Reflect FAB)", 0x00281A, 0x8ED5B5, 4.5),
                auditPair("Dark onPrimaryContainer / primaryContainer", 0xA9F2D0, 0x005139, 4.5),
                auditPair("Dark onSecondaryContainer / secondaryContainer", 0xFFDCC2, 0x633B10, 4.5),
                auditPair("Dark onTertiaryContainer / tertiaryContainer", 0xD3E4FF, 0x194366, 4.5),
                auditPair("Dark onErrorContainer / errorContainer", 0xFFDAD6, 0x93000A, 4.5),
                auditPair("Dark onError / error", 0x560003, 0xFFB4AB, 4.5)
        );
    }
}
