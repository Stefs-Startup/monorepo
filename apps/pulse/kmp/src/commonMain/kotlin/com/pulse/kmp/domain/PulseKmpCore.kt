package com.pulse.kmp.domain

import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.daysUntil
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.Serializable
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.round

@Serializable
enum class TaskCommitmentState {
    NORMAL,
    TODAY_TOP_3,
    DEFERRED_INTENTIONALLY,
    SOMEDAY_PARKED
}

@Serializable
enum class TaskEnergyLevel(val label: String, val minutesEstimate: Int) {
    QUICK_WIN("5m Quick Win", 5),
    FOCUSED("25m Focus", 25),
    DEEP_WORK("60m+ Deep Prep", 60)
}

@Serializable
enum class AccountabilityCategory {
    HABITUALLY_DEFERRED,
    LONG_STANDING_IDLE,
    COMMITTED_TOP_3,
    ACTIVE_FLOW,
    SOMEDAY_PARKED,
    COMPLETED
}

@Serializable
data class KmpTaskItem(
    val id: String,
    val title: String,
    val notes: String = "",
    val isCompleted: Boolean = false,
    val dueEpochMillis: Long? = null,
    val createdEpochMillis: Long,
    val updatedEpochMillis: Long,
    val deferCount: Int = 0,
    val commitment: TaskCommitmentState = TaskCommitmentState.NORMAL,
    val energy: TaskEnergyLevel = TaskEnergyLevel.FOCUSED,
    val blockerNote: String = ""
) {
    fun dueLocalDate(timeZone: TimeZone = TimeZone.UTC): LocalDate? =
        dueEpochMillis?.let { Instant.fromEpochMilliseconds(it).toLocalDateTime(timeZone).date }

    fun daysOverdue(today: LocalDate, timeZone: TimeZone = TimeZone.UTC): Int {
        if (isCompleted) return 0
        val due = dueLocalDate(timeZone) ?: return 0
        return if (due < today) due.daysUntil(today) else 0
    }

    fun daysUntouched(nowMillis: Long): Long =
        max(0L, nowMillis - updatedEpochMillis) / 86_400_000L

    fun daysOld(nowMillis: Long): Long =
        max(0L, nowMillis - createdEpochMillis) / 86_400_000L
}

/**
 * ADR-007 & ADR-008: Pure KMP domain engine in commonMain (zero JVM/Android imports).
 */
object UndoneAccountabilityEngine {
    const val HABITUAL_DEFER_THRESHOLD = 3
    const val IDLE_DAYS_THRESHOLD = 5L

    fun classify(
        task: KmpTaskItem,
        today: LocalDate,
        nowMillis: Long,
        timeZone: TimeZone = TimeZone.UTC
    ): AccountabilityCategory {
        if (task.isCompleted) return AccountabilityCategory.COMPLETED
        if (task.commitment == TaskCommitmentState.SOMEDAY_PARKED) return AccountabilityCategory.SOMEDAY_PARKED
        if (task.deferCount >= HABITUAL_DEFER_THRESHOLD) return AccountabilityCategory.HABITUALLY_DEFERRED
        if (task.daysUntouched(nowMillis) >= IDLE_DAYS_THRESHOLD || task.daysOverdue(today, timeZone) >= 3) {
            return AccountabilityCategory.LONG_STANDING_IDLE
        }
        if (task.commitment == TaskCommitmentState.TODAY_TOP_3) return AccountabilityCategory.COMMITTED_TOP_3
        return AccountabilityCategory.ACTIVE_FLOW
    }
}

sealed interface PinDecision {
    data object AllowPin : PinDecision
    data object Unpin : PinDecision
    data class SwapRequired(val currentCommitments: List<KmpTaskItem>) : PinDecision
}

object ScarcityEngine {
    const val MAX_TOP_3_LIMIT = 3

    fun evaluatePinAction(currentTop3: List<KmpTaskItem>, candidate: KmpTaskItem): PinDecision {
        val alreadyPinned = candidate.commitment == TaskCommitmentState.TODAY_TOP_3 ||
            currentTop3.any { it.id == candidate.id }
        if (alreadyPinned) return PinDecision.Unpin
        if (currentTop3.size < MAX_TOP_3_LIMIT) return PinDecision.AllowPin
        return PinDecision.SwapRequired(currentTop3.take(MAX_TOP_3_LIMIT))
    }
}

@Serializable
data class HorizonBarItem(
    val rank: Int,
    val task: KmpTaskItem,
    val category: AccountabilityCategory,
    val primaryMetricValue: Long
)

@Serializable
data class HorizonWindow(
    val windowIndex: Int,
    val title: String,
    val items: List<HorizonBarItem>
)

object TaskVisualAnalyticsEngine {
    fun buildDescendingHorizonWindows(
        tasks: List<KmpTaskItem>,
        today: LocalDate,
        nowMillis: Long
    ): List<HorizonWindow> {
        val openTasks = tasks.filter { !it.isCompleted && it.commitment != TaskCommitmentState.SOMEDAY_PARKED }
        val classified = openTasks.map { task ->
            task to UndoneAccountabilityEngine.classify(task, today, nowMillis)
        }

        val habitual = classified
            .filter { it.second == AccountabilityCategory.HABITUALLY_DEFERRED }
            .sortedWith(
                compareByDescending<Pair<KmpTaskItem, AccountabilityCategory>> { it.first.deferCount }
                    .thenByDescending { it.first.daysUntouched(nowMillis) }
                    .thenBy { it.first.title }
            )
            .mapIndexed { idx, (task, cat) ->
                HorizonBarItem(idx + 1, task, cat, task.deferCount.toLong())
            }

        val idle = classified
            .filter { it.second == AccountabilityCategory.LONG_STANDING_IDLE }
            .sortedWith(
                compareByDescending<Pair<KmpTaskItem, AccountabilityCategory>> {
                    max(it.first.daysUntouched(nowMillis), it.first.daysOverdue(today).toLong())
                }.thenBy { it.first.title }
            )
            .mapIndexed { idx, (task, cat) ->
                HorizonBarItem(
                    idx + 1,
                    task,
                    cat,
                    max(task.daysUntouched(nowMillis), task.daysOverdue(today).toLong())
                )
            }

        val active = classified
            .filter {
                it.second == AccountabilityCategory.COMMITTED_TOP_3 ||
                    it.second == AccountabilityCategory.ACTIVE_FLOW
            }
            .sortedWith(
                compareByDescending<Pair<KmpTaskItem, AccountabilityCategory>> {
                    if (it.first.commitment == TaskCommitmentState.TODAY_TOP_3) 1 else 0
                }.thenByDescending { it.first.energy.minutesEstimate }
                    .thenBy { it.first.title }
            )
            .mapIndexed { idx, (task, cat) ->
                HorizonBarItem(idx + 1, task, cat, task.energy.minutesEstimate.toLong())
            }

        return listOf(
            HorizonWindow(0, "Habitually Undone", habitual),
            HorizonWindow(1, "Long-Standing Drift", idle),
            HorizonWindow(2, "Committed & Active Flow", active)
        )
    }
}

/**
 * Pure WCAG 2.2 Level AA contrast verifier in commonMain.
 */
object WcagContrastEngine {
    data class ContrastAuditEntry(
        val pairName: String,
        val contrastRatio: Double,
        val minimumRequired: Double,
        val passesWcagAA: Boolean
    )

    fun relativeLuminance(rgb: Int): Double {
        val r = ((rgb shr 16) and 0xFF) / 255.0
        val g = ((rgb shr 8) and 0xFF) / 255.0
        val b = (rgb and 0xFF) / 255.0
        return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
    }

    private fun linearize(c: Double): Double =
        if (c <= 0.04045) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)

    fun contrastRatio(fgRgb: Int, bgRgb: Int): Double {
        val l1 = relativeLuminance(fgRgb)
        val l2 = relativeLuminance(bgRgb)
        return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
    }

    fun auditExpressiveThemePalette(): List<ContrastAuditEntry> {
        val pairs = listOf(
            Triple("Light onBackground / background", 0x171D19, 0xF6FBF6),
            Triple("Light onSurface / surface", 0x171D19, 0xF6FBF6),
            Triple("Light onSurfaceVariant / surfaceContainerHigh", 0x353E38, 0xE4E9E5),
            Triple("Light onPrimary / primary", 0xFFFFFF, 0x14533C),
            Triple("Light onPrimaryContainer / primaryContainer", 0x002114, 0xA9F2D0),
            Triple("Light onSecondaryContainer / secondaryContainer", 0x2E1500, 0xFFDCC2),
            Triple("Light onTertiaryContainer / tertiaryContainer", 0x001C38, 0xD3E4FF),
            Triple("Light onErrorContainer / errorContainer", 0x410002, 0xFFDAD6),
            Triple("Light onError / error", 0xFFFFFF, 0xBA1A1A),
            Triple("Dark onBackground / background", 0xDFE4DF, 0x0F1511),
            Triple("Dark onSurface / surface", 0xDFE4DF, 0x0F1511),
            Triple("Dark onSurfaceVariant / surfaceContainerHigh", 0xC8D2CA, 0x252B27),
            Triple("Dark onPrimary / primary", 0x00281A, 0x8ED5B5),
            Triple("Dark onPrimaryContainer / primaryContainer", 0xA9F2D0, 0x005139),
            Triple("Dark onSecondaryContainer / secondaryContainer", 0xFFDCC2, 0x633B10),
            Triple("Dark onTertiaryContainer / tertiaryContainer", 0xD3E4FF, 0x194366),
            Triple("Dark onErrorContainer / errorContainer", 0xFFDAD6, 0x93000A),
            Triple("Dark onError / error", 0x560003, 0xFFB4AB)
        )
        return pairs.map { (name, fg, bg) ->
            val ratio = round(contrastRatio(fg, bg) * 100.0) / 100.0
            ContrastAuditEntry(name, ratio, 4.5, ratio >= 4.5)
        }
    }
}

/**
 * Pure Zero-PII scrubber and deterministic FNV-1a 64-bit pseudonymizer in commonMain.
 */
object PulseObservability {
    private val EMAIL_REGEX = Regex("[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}")
    private val BEARER_TOKEN_REGEX = Regex("(Bearer\\s+|ya29\\.)[A-Za-z0-9._\\-]+", RegexOption.IGNORE_CASE)

    fun scrubSensitiveText(input: String): String =
        input
            .replace(BEARER_TOKEN_REGEX, "[REDACTED_TOKEN]")
            .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")

    fun pseudonymizeIdentifier(raw: String): String {
        val normalized = raw.trim().lowercase()
        if (normalized.isEmpty()) return "anonymous"
        var hash = -0x340d631b7bdddcdbL
        for (ch in normalized) {
            hash = hash xor ch.code.toLong()
            hash *= 0x100000001b3L
        }
        return hash.toULong().toString(16).padStart(16, '0')
    }
}

/**
 * ADR-009: Responsive Desktop Web (>= 840dp) vs Mobile (< 600dp) layout & keyboard shortcut model.
 */
enum class WorkspaceViewportLayout {
    MOBILE_SINGLE_COLUMN_STACK,
    TABLET_ADAPTIVE,
    DESKTOP_MULTI_PANE_SPLIT_WORKSPACE
}

sealed interface DesktopShortcutCommand {
    data class SwitchHorizonWindow(val windowIndex: Int) : DesktopShortcutCommand
    data object SelectNextBar : DesktopShortcutCommand
    data object SelectPreviousBar : DesktopShortcutCommand
    data object ToggleTop3Pin : DesktopShortcutCommand
    data object ShrinkTo5mStarter : DesktopShortcutCommand
    data object MarkTaskDone : DesktopShortcutCommand
    data object DismissModal : DesktopShortcutCommand
}

object DesktopWebWorkspaceEngine {
    const val DESKTOP_SPLIT_MIN_WIDTH_DP = 840
    const val MOBILE_MAX_WIDTH_DP = 600

    fun resolveViewportLayout(widthDp: Int): WorkspaceViewportLayout = when {
        widthDp >= DESKTOP_SPLIT_MIN_WIDTH_DP -> WorkspaceViewportLayout.DESKTOP_MULTI_PANE_SPLIT_WORKSPACE
        widthDp < MOBILE_MAX_WIDTH_DP -> WorkspaceViewportLayout.MOBILE_SINGLE_COLUMN_STACK
        else -> WorkspaceViewportLayout.TABLET_ADAPTIVE
    }

    fun mapShortcutKey(key: String): DesktopShortcutCommand? = when (key) {
        "1" -> DesktopShortcutCommand.SwitchHorizonWindow(0)
        "2" -> DesktopShortcutCommand.SwitchHorizonWindow(1)
        "3" -> DesktopShortcutCommand.SwitchHorizonWindow(2)
        "ArrowDown", "j", "J" -> DesktopShortcutCommand.SelectNextBar
        "ArrowUp", "k", "K" -> DesktopShortcutCommand.SelectPreviousBar
        "p", "P" -> DesktopShortcutCommand.ToggleTop3Pin
        "s", "S" -> DesktopShortcutCommand.ShrinkTo5mStarter
        "d", "D" -> DesktopShortcutCommand.MarkTaskDone
        "Escape" -> DesktopShortcutCommand.DismissModal
        else -> null
    }
}
