package com.pulse.backend.domain;

import com.pulse.backend.domain.WcagContrastEngine.ContrastAuditEntry;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WcagContrastEngineTest {

    @Test
    void allExpressiveLightAndDarkTokensPassWcag22LevelAA() {
        List<ContrastAuditEntry> entries = WcagContrastEngine.auditExpressiveThemePalette();
        assertFalse(entries.isEmpty());
        for (ContrastAuditEntry entry : entries) {
            assertTrue(
                    entry.passesWcagAA(),
                    () -> "Failed WCAG 2.2 AA contrast for " + entry.pairName() + ": " + entry.contrastRatio()
            );
        }
    }
}
