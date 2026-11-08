package com.pulse.accountability.ui.theme

import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

data class ContrastAuditEntry(
    val pairName: String,
    val foregroundArgb: Int,
    val backgroundArgb: Int,
    val contrastRatio: Double,
    val minimumRequired: Double,
    val passesWcagAA: Boolean
)

/**
 * Pure functional WCAG 2.2 Level AA color contrast & relative luminance engine (SC 1.4.3 / 1.4.11).
 * Zero Android Context dependencies — 100% deterministic for unit test enforcement.
 */
object WcagContrastEngine {

    /**
     * Computes relative luminance L in [0.0, 1.0] per WCAG 2.2 formula:
     * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
     */
    fun relativeLuminance(argb: Int): Double {
        val r = ((argb shr 16) and 0xFF) / 255.0
        val g = ((argb shr 8) and 0xFF) / 255.0
        val b = (argb and 0xFF) / 255.0

        val rLin = linearizeChannel(r)
        val gLin = linearizeChannel(g)
        val bLin = linearizeChannel(b)

        return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin
    }

    private fun linearizeChannel(c: Double): Double {
        return if (c <= 0.04045) {
            c / 12.92
        } else {
            ((c + 0.055) / 1.055).pow(2.4)
        }
    }

    /**
     * Computes WCAG 2.2 contrast ratio (L1 + 0.05) / (L2 + 0.05) in [1.0, 21.0].
     */
    fun contrastRatio(foregroundArgb: Int, backgroundArgb: Int): Double {
        val l1 = relativeLuminance(foregroundArgb)
        val l2 = relativeLuminance(backgroundArgb)
        val lighter = max(l1, l2)
        val darker = min(l1, l2)
        return (lighter + 0.05) / (darker + 0.05)
    }

    fun auditPair(
        pairName: String,
        foregroundArgb: Int,
        backgroundArgb: Int,
        minimumRequired: Double = 4.5
    ): ContrastAuditEntry {
        val ratio = contrastRatio(foregroundArgb, backgroundArgb)
        return ContrastAuditEntry(
            pairName = pairName,
            foregroundArgb = foregroundArgb,
            backgroundArgb = backgroundArgb,
            contrastRatio = ratio,
            minimumRequired = minimumRequired,
            passesWcagAA = ratio >= minimumRequired
        )
    }
}
