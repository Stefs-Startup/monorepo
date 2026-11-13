package com.pulse.kmp.web

import com.pulse.kmp.domain.DesktopWebWorkspaceEngine
import com.pulse.kmp.domain.KmpTaskItem
import com.pulse.kmp.domain.TaskCommitmentState
import com.pulse.kmp.domain.TaskEnergyLevel
import com.pulse.kmp.domain.TaskVisualAnalyticsEngine
import com.pulse.kmp.domain.WcagContrastEngine
import kotlinx.datetime.LocalDate

fun main() {
    val today = LocalDate(2026, 11, 10)
    val nowMillis = 1_794_312_000_000L
    val sampleTasks = listOf(
        KmpTaskItem(
            id = "task-tax-receipts",
            title = "Consolidate Q3 expense receipts & CPA export",
            createdEpochMillis = nowMillis - 12 * 86_400_000L,
            updatedEpochMillis = nowMillis - 4 * 86_400_000L,
            deferCount = 5,
            energy = TaskEnergyLevel.FOCUSED
        ),
        KmpTaskItem(
            id = "task-top3-architecture",
            title = "Ship KMP + Compose Multiplatform wasmJs Web Workspace",
            createdEpochMillis = nowMillis - 2 * 86_400_000L,
            updatedEpochMillis = nowMillis,
            deferCount = 0,
            commitment = TaskCommitmentState.TODAY_TOP_3,
            energy = TaskEnergyLevel.DEEP_WORK
        )
    )
    val windows = TaskVisualAnalyticsEngine.buildDescendingHorizonWindows(sampleTasks, today, nowMillis)
    val wcagAudit = WcagContrastEngine.auditExpressiveThemePalette()
    val layout = DesktopWebWorkspaceEngine.resolveViewportLayout(1440)
    println(
        "Pulse KMP wasmJs initialized: layout=$layout, windows=${windows.size}, " +
            "wcagPassed=${wcagAudit.count { it.passesWcagAA }}/${wcagAudit.size}"
    )
}
