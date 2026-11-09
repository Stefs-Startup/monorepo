package com.pulse.accountability.ui.theme

import androidx.compose.ui.graphics.toArgb
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WcagContrastEngineTest {

    @Test
    fun `pure black and white contrast ratio is 21 to 1`() {
        val ratio = WcagContrastEngine.contrastRatio(0xFF000000.toInt(), 0xFFFFFFFF.toInt())
        assertEquals(21.0, ratio, 0.05)
    }

    @Test
    fun `ExpressiveLightColors meets WCAG 2_2 AA 4_5 to 1 across all text and container pairs`() {
        val c = ExpressiveLightColors
        val pairs = listOf(
            WcagContrastEngine.auditPair("Light onBackground/background", c.onBackground.toArgb(), c.background.toArgb()),
            WcagContrastEngine.auditPair("Light onSurface/surface", c.onSurface.toArgb(), c.surface.toArgb()),
            WcagContrastEngine.auditPair("Light onSurface/surfaceContainerHigh", c.onSurface.toArgb(), c.surfaceContainerHigh.toArgb()),
            WcagContrastEngine.auditPair("Light onSurfaceVariant/surface", c.onSurfaceVariant.toArgb(), c.surface.toArgb()),
            WcagContrastEngine.auditPair("Light onSurfaceVariant/surfaceContainerHigh", c.onSurfaceVariant.toArgb(), c.surfaceContainerHigh.toArgb()),
            WcagContrastEngine.auditPair("Light onPrimary/primary", c.onPrimary.toArgb(), c.primary.toArgb()),
            WcagContrastEngine.auditPair("Light onPrimaryContainer/primaryContainer", c.onPrimaryContainer.toArgb(), c.primaryContainer.toArgb()),
            WcagContrastEngine.auditPair("Light onSecondary/secondary", c.onSecondary.toArgb(), c.secondary.toArgb()),
            WcagContrastEngine.auditPair("Light onSecondaryContainer/secondaryContainer", c.onSecondaryContainer.toArgb(), c.secondaryContainer.toArgb()),
            WcagContrastEngine.auditPair("Light onTertiary/tertiary", c.onTertiary.toArgb(), c.tertiary.toArgb()),
            WcagContrastEngine.auditPair("Light onTertiaryContainer/tertiaryContainer", c.onTertiaryContainer.toArgb(), c.tertiaryContainer.toArgb()),
            WcagContrastEngine.auditPair("Light onError/error", c.onError.toArgb(), c.error.toArgb()),
            WcagContrastEngine.auditPair("Light onErrorContainer/errorContainer", c.onErrorContainer.toArgb(), c.errorContainer.toArgb())
        )

        pairs.forEach { audit ->
            assertTrue(
                "${audit.pairName} failed WCAG 2.2 AA: ratio=${"%.2f".format(audit.contrastRatio)} (required >= ${audit.minimumRequired})",
                audit.passesWcagAA
            )
        }
    }

    @Test
    fun `ExpressiveDarkColors meets WCAG 2_2 AA 4_5 to 1 across all text and container pairs`() {
        val c = ExpressiveDarkColors
        val pairs = listOf(
            WcagContrastEngine.auditPair("Dark onBackground/background", c.onBackground.toArgb(), c.background.toArgb()),
            WcagContrastEngine.auditPair("Dark onSurface/surface", c.onSurface.toArgb(), c.surface.toArgb()),
            WcagContrastEngine.auditPair("Dark onSurface/surfaceContainerHigh", c.onSurface.toArgb(), c.surfaceContainerHigh.toArgb()),
            WcagContrastEngine.auditPair("Dark onSurfaceVariant/surface", c.onSurfaceVariant.toArgb(), c.surface.toArgb()),
            WcagContrastEngine.auditPair("Dark onSurfaceVariant/surfaceContainerHigh", c.onSurfaceVariant.toArgb(), c.surfaceContainerHigh.toArgb()),
            WcagContrastEngine.auditPair("Dark onPrimary/primary", c.onPrimary.toArgb(), c.primary.toArgb()),
            WcagContrastEngine.auditPair("Dark onPrimaryContainer/primaryContainer", c.onPrimaryContainer.toArgb(), c.primaryContainer.toArgb()),
            WcagContrastEngine.auditPair("Dark onSecondary/secondary", c.onSecondary.toArgb(), c.secondary.toArgb()),
            WcagContrastEngine.auditPair("Dark onSecondaryContainer/secondaryContainer", c.onSecondaryContainer.toArgb(), c.secondaryContainer.toArgb()),
            WcagContrastEngine.auditPair("Dark onTertiary/tertiary", c.onTertiary.toArgb(), c.tertiary.toArgb()),
            WcagContrastEngine.auditPair("Dark onTertiaryContainer/tertiaryContainer", c.onTertiaryContainer.toArgb(), c.tertiaryContainer.toArgb()),
            WcagContrastEngine.auditPair("Dark onError/error", c.onError.toArgb(), c.error.toArgb()),
            WcagContrastEngine.auditPair("Dark onErrorContainer/errorContainer", c.onErrorContainer.toArgb(), c.errorContainer.toArgb())
        )

        pairs.forEach { audit ->
            assertTrue(
                "${audit.pairName} failed WCAG 2.2 AA: ratio=${"%.2f".format(audit.contrastRatio)} (required >= ${audit.minimumRequired})",
                audit.passesWcagAA
            )
        }
    }
}
