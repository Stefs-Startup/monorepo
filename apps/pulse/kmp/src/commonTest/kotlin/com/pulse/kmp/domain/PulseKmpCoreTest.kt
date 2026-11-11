package com.pulse.kmp.domain

import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class PulseKmpCoreTest {

    private val today = LocalDate(2026, 11, 10)
    private val nowMillis = 1_794_312_000_000L

    @Test
    fun buildsThreeDescendingHorizonWindowsInCommonMain() {
        val tasks = listOf(
            KmpTaskItem(
                id = "t-1",
                title = "Consolidate Q3 expense receipts",
                createdEpochMillis = nowMillis - 12 * 86_400_000L,
                updatedEpochMillis = nowMillis - 3 * 86_400_000L,
                deferCount = 5
            ),
            KmpTaskItem(
                id = "t-2",
                title = "Schedule annual dental checkup",
                createdEpochMillis = nowMillis - 9 * 86_400_000L,
                updatedEpochMillis = nowMillis - 2 * 86_400_000L,
                deferCount = 3
            ),
            KmpTaskItem(
                id = "t-3",
                title = "Audit AWS S3 lifecycle policy",
                createdEpochMillis = nowMillis - 14 * 86_400_000L,
                updatedEpochMillis = nowMillis - 8 * 86_400_000L,
                deferCount = 0
            ),
            KmpTaskItem(
                id = "t-4",
                title = "Finalize KMP wasmJs CI pipeline",
                createdEpochMillis = nowMillis - 1 * 86_400_000L,
                updatedEpochMillis = nowMillis,
                commitment = TaskCommitmentState.TODAY_TOP_3,
                energy = TaskEnergyLevel.DEEP_WORK
            )
        )

        val windows = TaskVisualAnalyticsEngine.buildDescendingHorizonWindows(tasks, today, nowMillis)
        assertEquals(3, windows.size)
        assertEquals("Habitually Undone", windows[0].title)
        assertEquals(2, windows[0].items.size)
        assertEquals("t-1", windows[0].items[0].task.id)
        assertEquals(1, windows[0].items[0].rank)
        assertEquals("t-2", windows[0].items[1].task.id)
        assertEquals(2, windows[0].items[1].rank)
        assertTrue(windows[0].items[0].primaryMetricValue >= windows[0].items[1].primaryMetricValue)

        assertEquals("Long-Standing Drift", windows[1].title)
        assertEquals(1, windows[1].items.size)
        assertEquals("t-3", windows[1].items[0].task.id)

        assertEquals("Committed & Active Flow", windows[2].title)
        assertEquals(1, windows[2].items.size)
        assertEquals("t-4", windows[2].items[0].task.id)
    }

    @Test
    fun enforcesThreeSlotScarcityGateAndSwapRequirement() {
        val top3 = (1..3).map { idx ->
            KmpTaskItem(
                id = "top-$idx",
                title = "Committed #$idx",
                createdEpochMillis = nowMillis,
                updatedEpochMillis = nowMillis,
                commitment = TaskCommitmentState.TODAY_TOP_3
            )
        }
        val candidate = KmpTaskItem(
            id = "cand-4",
            title = "Candidate #4",
            createdEpochMillis = nowMillis,
            updatedEpochMillis = nowMillis
        )

        assertIs<PinDecision.AllowPin>(ScarcityEngine.evaluatePinAction(top3.take(2), candidate))
        assertIs<PinDecision.Unpin>(ScarcityEngine.evaluatePinAction(top3, top3.first()))
        val swap = assertIs<PinDecision.SwapRequired>(ScarcityEngine.evaluatePinAction(top3, candidate))
        assertEquals(3, swap.currentCommitments.size)
    }

    @Test
    fun passesAll18ExpressiveThemeWcag22AAContrastPairs() {
        val entries = WcagContrastEngine.auditExpressiveThemePalette()
        assertEquals(18, entries.size)
        entries.forEach { entry ->
            assertTrue(
                entry.passesWcagAA,
                "${entry.pairName} failed WCAG 2.2 AA contrast: ${entry.contrastRatio}:1"
            )
        }
    }

    @Test
    fun scrubsEmailsAndBearerTokensWithZeroPiiLeakage() {
        val raw = "Sync failed for stefan@gmail.com with header Bearer ya29.A0ARrdaM_secretToken123"
        val scrubbed = PulseObservability.scrubSensitiveText(raw)
        assertEquals("Sync failed for [REDACTED_EMAIL] with header [REDACTED_TOKEN]", scrubbed)
        assertEquals(16, PulseObservability.pseudonymizeIdentifier("stefan@gmail.com").length)
    }

    @Test
    fun resolvesModernDesktopWebMultiPaneLayoutAndKeyboardShortcutsPerAdr009() {
        assertEquals(
            WorkspaceViewportLayout.MOBILE_SINGLE_COLUMN_STACK,
            DesktopWebWorkspaceEngine.resolveViewportLayout(412)
        )
        assertEquals(
            WorkspaceViewportLayout.DESKTOP_MULTI_PANE_SPLIT_WORKSPACE,
            DesktopWebWorkspaceEngine.resolveViewportLayout(1280)
        )
        assertEquals(
            DesktopShortcutCommand.SwitchHorizonWindow(1),
            DesktopWebWorkspaceEngine.mapShortcutKey("2")
        )
        assertEquals(
            DesktopShortcutCommand.ToggleTop3Pin,
            DesktopWebWorkspaceEngine.mapShortcutKey("P")
        )
    }
}
