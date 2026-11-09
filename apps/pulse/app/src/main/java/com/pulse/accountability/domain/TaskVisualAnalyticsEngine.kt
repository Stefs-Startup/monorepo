package com.pulse.accountability.domain

import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.sqrt

enum class HorizonWindowType(
    val title: String,
    val shortTabTitle: String,
    val subtitle: String
) {
    HABITUALLY_UNDONE(
        title = "Habitually Undone",
        shortTabTitle = "Habitual",
        subtitle = "Sorted descending by deferral count"
    ),
    LONG_STANDING_DRIFT(
        title = "Long-Standing Drift",
        shortTabTitle = "Drifting",
        subtitle = "Sorted descending by days untouched or overdue"
    ),
    ACTIVE_FLOW(
        title = "Committed & Active Flow",
        shortTabTitle = "Active",
        subtitle = "Today's Top 3 commitments first, then descending by age"
    )
}

data class HorizonWindowBarItem(
    val taskId: String,
    val title: String,
    val shortLabel: String,
    val primaryMetricLabel: String,
    val secondaryMetricLabel: String,
    val intensityFraction: Float,
    val category: AccountabilityCategory,
    val deferCount: Int,
    val daysOld: Long,
    val daysUntouched: Long,
    val daysOverdue: Long,
    val sortScore: Long
)

data class HorizonWindowCardModel(
    val windowType: HorizonWindowType,
    val title: String,
    val shortTabTitle: String,
    val subtitle: String,
    val headlineStat: String,
    val emptyStateTitle: String,
    val emptyStateBody: String,
    val items: List<HorizonWindowBarItem>
)

data class TaskVisualNode(
    val taskId: String,
    val title: String,
    val shortLabel: String,
    val badgeText: String,
    val category: AccountabilityCategory,
    val xNormalized: Float,
    val yNormalized: Float,
    val radiusMultiplier: Float,
    val deferCount: Int,
    val daysOld: Long,
    val daysUntouched: Long,
    val daysOverdue: Long
)

data class TaskHorizonAnalyticsSnapshot(
    val windows: List<HorizonWindowCardModel>,
    val nodes: List<TaskVisualNode>,
    val habitualDeferralCount: Int,
    val longStandingCount: Int,
    val committedTodayCount: Int,
    val healthyBacklogCount: Int,
    val averageStalledDeferrals: Double,
    val oldestOpenDays: Long,
    val clarityRatioPercent: Int
)

/**
 * Pure, stateless analytical engine that partitions open tasks into 3 swipeable
 * Horizon Window Cards (each sorted in strict descending order of friction/age)
 * alongside summary metrics.
 */
object TaskVisualAnalyticsEngine {

    private const val MAX_HORIZON_DAYS = 14f
    private const val MAX_DEFERRAL_AXIS = 5f
    private const val MIN_NODE_SEPARATION = 0.22f

    fun buildHorizonSnapshot(
        statuses: List<TaskAccountabilityStatus>
    ): TaskHorizonAnalyticsSnapshot {
        val openStatuses = statuses.filter {
            it.category != AccountabilityCategory.COMPLETED_OR_PARKED
        }

        if (openStatuses.isEmpty()) {
            return TaskHorizonAnalyticsSnapshot(
                windows = buildWindows(emptyList()),
                nodes = emptyList(),
                habitualDeferralCount = 0,
                longStandingCount = 0,
                committedTodayCount = 0,
                healthyBacklogCount = 0,
                averageStalledDeferrals = 0.0,
                oldestOpenDays = 0L,
                clarityRatioPercent = 100
            )
        }

        val habitual = openStatuses.count { it.category == AccountabilityCategory.HABITUALLY_DEFERRED }
        val longStanding = openStatuses.count { it.category == AccountabilityCategory.LONG_STANDING_GHOSTED }
        val committed = openStatuses.count { it.category == AccountabilityCategory.ACTIVE_COMMITTED }
        val healthy = openStatuses.count { it.category == AccountabilityCategory.HEALTHY_BACKLOG }

        val stalledList = openStatuses.filter {
            it.category == AccountabilityCategory.HABITUALLY_DEFERRED ||
                it.category == AccountabilityCategory.LONG_STANDING_GHOSTED
        }

        val avgDeferrals = if (stalledList.isEmpty()) {
            0.0
        } else {
            val raw = stalledList.map { it.task.deferCount }.average()
            (raw * 10.0).roundToInt() / 10.0
        }

        val oldestDays = openStatuses.maxOfOrNull {
            maxOf(it.daysOld, it.daysUntouched, it.daysOverdue, it.task.deferCount * 2L)
        } ?: 0L
        val clearCount = committed + healthy
        val clarityPercent = ((clearCount.toDouble() / openStatuses.size.toDouble()) * 100.0)
            .roundToInt()
            .coerceIn(0, 100)

        val windows = buildWindows(openStatuses)

        val initialNodes = openStatuses.map { status ->
            val effectiveAgeDays = maxOf(
                status.daysOld,
                status.daysUntouched,
                status.daysOverdue,
                status.task.deferCount * 2L
            )
            val rawX = (effectiveAgeDays.coerceIn(0L, 14L).toFloat() / MAX_HORIZON_DAYS)
                .coerceIn(0.14f, 0.86f)

            val overdueBoost = if (status.daysOverdue > 0) 0.85f else 0f
            val untouchedBoost = if (status.daysUntouched >= 5 && status.task.deferCount < 2) 0.75f else 0f
            val effectiveFriction = (status.task.deferCount.toFloat() + overdueBoost + untouchedBoost)
                .coerceIn(0f, MAX_DEFERRAL_AXIS)
            val rawY = (effectiveFriction / MAX_DEFERRAL_AXIS).coerceIn(0.18f, 0.82f)

            val radiusMultiplier = when (status.category) {
                AccountabilityCategory.HABITUALLY_DEFERRED ->
                    (1.22f + (status.task.deferCount.coerceAtMost(6) * 0.08f)).coerceAtMost(1.65f)
                AccountabilityCategory.LONG_STANDING_GHOSTED -> 1.20f
                AccountabilityCategory.ACTIVE_COMMITTED -> 1.12f
                else -> 0.95f
            }

            val badge = when {
                status.task.deferCount >= 2 -> "${status.task.deferCount}×"
                status.daysOverdue > 0 -> "${status.daysOverdue}d late"
                status.daysUntouched >= 5 -> "${status.daysUntouched}d idle"
                status.category == AccountabilityCategory.ACTIVE_COMMITTED -> "Top 3"
                else -> "${effectiveAgeDays}d"
            }

            TaskVisualNode(
                taskId = status.task.id,
                title = status.task.title,
                shortLabel = truncateLabel(status.task.title, maxChars = 15),
                badgeText = badge,
                category = status.category,
                xNormalized = rawX,
                yNormalized = rawY,
                radiusMultiplier = radiusMultiplier,
                deferCount = status.task.deferCount,
                daysOld = status.daysOld,
                daysUntouched = status.daysUntouched,
                daysOverdue = status.daysOverdue
            )
        }

        val separatedNodes = resolveNodeCollisions(initialNodes)

        return TaskHorizonAnalyticsSnapshot(
            windows = windows,
            nodes = separatedNodes,
            habitualDeferralCount = habitual,
            longStandingCount = longStanding,
            committedTodayCount = committed,
            healthyBacklogCount = healthy,
            averageStalledDeferrals = avgDeferrals,
            oldestOpenDays = oldestDays,
            clarityRatioPercent = clarityPercent
        )
    }

    /**
     * Pure builder for the 3 swipeable Horizon Window Cards, each ordered strictly
     * in descending order of its window metric.
     */
    internal fun buildWindows(
        openStatuses: List<TaskAccountabilityStatus>
    ): List<HorizonWindowCardModel> {
        // Window 1: Habitually Undone (deferCount >= 2), descending by deferCount then age
        val habitualStatuses = openStatuses
            .filter { it.category == AccountabilityCategory.HABITUALLY_DEFERRED }
            .sortedWith(
                compareByDescending<TaskAccountabilityStatus> { it.task.deferCount }
                    .thenByDescending { maxOf(it.daysOverdue, it.daysUntouched, it.daysOld) }
                    .thenBy { it.task.title }
            )
        val maxHabitualDefer = habitualStatuses.maxOfOrNull { it.task.deferCount }?.coerceAtLeast(2) ?: 4
        val habitualItems = habitualStatuses.map { status ->
            val age = maxOf(status.daysOld, status.daysUntouched, status.task.deferCount * 2L)
            val fraction = (status.task.deferCount.toFloat() / maxHabitualDefer.toFloat())
                .coerceIn(0.28f, 1.0f)
            HorizonWindowBarItem(
                taskId = status.task.id,
                title = status.task.title,
                shortLabel = truncateLabel(status.task.title, maxChars = 28),
                primaryMetricLabel = "${status.task.deferCount}× deferred",
                secondaryMetricLabel = "${age}d span",
                intensityFraction = fraction,
                category = status.category,
                deferCount = status.task.deferCount,
                daysOld = status.daysOld,
                daysUntouched = status.daysUntouched,
                daysOverdue = status.daysOverdue,
                sortScore = status.task.deferCount * 1000L + age
            )
        }

        // Window 2: Long-Standing Drift (5d+ untouched or overdue), descending by drift days
        val driftStatuses = openStatuses
            .filter { it.category == AccountabilityCategory.LONG_STANDING_GHOSTED }
            .sortedWith(
                compareByDescending<TaskAccountabilityStatus> {
                    maxOf(it.daysOverdue, it.daysUntouched, it.daysOld)
                }
                    .thenByDescending { it.task.deferCount }
                    .thenBy { it.task.title }
            )
        val maxDriftDays = driftStatuses.maxOfOrNull {
            maxOf(it.daysOverdue, it.daysUntouched, it.daysOld)
        }?.coerceAtLeast(5L) ?: 10L
        val driftItems = driftStatuses.map { status ->
            val driftDays = maxOf(status.daysOverdue, status.daysUntouched, status.daysOld)
            val fraction = (driftDays.toFloat() / maxDriftDays.toFloat()).coerceIn(0.28f, 1.0f)
            val primaryLabel = if (status.daysOverdue > 0) {
                "${status.daysOverdue}d overdue"
            } else {
                "${driftDays}d idle"
            }
            HorizonWindowBarItem(
                taskId = status.task.id,
                title = status.task.title,
                shortLabel = truncateLabel(status.task.title, maxChars = 28),
                primaryMetricLabel = primaryLabel,
                secondaryMetricLabel = if (status.task.deferCount > 0) "${status.task.deferCount}× slip" else "Untouched",
                intensityFraction = fraction,
                category = status.category,
                deferCount = status.task.deferCount,
                daysOld = status.daysOld,
                daysUntouched = status.daysUntouched,
                daysOverdue = status.daysOverdue,
                sortScore = driftDays * 1000L + status.task.deferCount
            )
        }

        // Window 3: Committed & Active Flow (Top 3 first, then descending by deferCount & age)
        val activeStatuses = openStatuses
            .filter {
                it.category == AccountabilityCategory.ACTIVE_COMMITTED ||
                    it.category == AccountabilityCategory.HEALTHY_BACKLOG
            }
            .sortedWith(
                compareByDescending<TaskAccountabilityStatus> {
                    if (it.category == AccountabilityCategory.ACTIVE_COMMITTED) 1 else 0
                }
                    .thenByDescending { it.task.deferCount }
                    .thenByDescending { maxOf(it.daysOld, it.daysUntouched) }
                    .thenBy { it.task.title }
            )
        val activeItems = activeStatuses.mapIndexed { idx, status ->
            val isTop3 = status.category == AccountabilityCategory.ACTIVE_COMMITTED
            val age = maxOf(status.daysOld, status.daysUntouched)
            val fraction = if (isTop3) {
                (1.0f - (idx * 0.12f)).coerceIn(0.65f, 1.0f)
            } else {
                (0.55f - (idx * 0.06f)).coerceIn(0.25f, 0.55f)
            }
            HorizonWindowBarItem(
                taskId = status.task.id,
                title = status.task.title,
                shortLabel = truncateLabel(status.task.title, maxChars = 28),
                primaryMetricLabel = if (isTop3) "Top 3" else "${age}d old",
                secondaryMetricLabel = if (status.task.deferCount > 0) {
                    "Deferred ${status.task.deferCount}×"
                } else if (isTop3) {
                    "Locked Today"
                } else {
                    "In Flow"
                },
                intensityFraction = fraction,
                category = status.category,
                deferCount = status.task.deferCount,
                daysOld = status.daysOld,
                daysUntouched = status.daysUntouched,
                daysOverdue = status.daysOverdue,
                sortScore = (if (isTop3) 10_000L else 0L) + status.task.deferCount * 100L + age
            )
        }

        return listOf(
            HorizonWindowCardModel(
                windowType = HorizonWindowType.HABITUALLY_UNDONE,
                title = HorizonWindowType.HABITUALLY_UNDONE.title,
                shortTabTitle = "${HorizonWindowType.HABITUALLY_UNDONE.shortTabTitle} (${habitualItems.size})",
                subtitle = HorizonWindowType.HABITUALLY_UNDONE.subtitle,
                headlineStat = if (habitualItems.isEmpty()) "0 tasks" else "Max ${habitualItems.first().deferCount}×",
                emptyStateTitle = "Zero Habitually Deferred Tasks",
                emptyStateBody = "No tasks have slipped 2 or more times. Swipe right to inspect Long-Standing Drift or Active Flow.",
                items = habitualItems
            ),
            HorizonWindowCardModel(
                windowType = HorizonWindowType.LONG_STANDING_DRIFT,
                title = HorizonWindowType.LONG_STANDING_DRIFT.title,
                shortTabTitle = "${HorizonWindowType.LONG_STANDING_DRIFT.shortTabTitle} (${driftItems.size})",
                subtitle = HorizonWindowType.LONG_STANDING_DRIFT.subtitle,
                headlineStat = if (driftItems.isEmpty()) "0 tasks" else "${maxDriftDays}d oldest",
                emptyStateTitle = "Zero Long-Standing Drift",
                emptyStateBody = "Nothing is sitting untouched for 5+ days without a commitment. Swipe to view Habitual or Active Flow.",
                items = driftItems
            ),
            HorizonWindowCardModel(
                windowType = HorizonWindowType.ACTIVE_FLOW,
                title = HorizonWindowType.ACTIVE_FLOW.title,
                shortTabTitle = "${HorizonWindowType.ACTIVE_FLOW.shortTabTitle} (${activeItems.size})",
                subtitle = HorizonWindowType.ACTIVE_FLOW.subtitle,
                headlineStat = "${activeStatuses.count { it.category == AccountabilityCategory.ACTIVE_COMMITTED }}/3 Top-3",
                emptyStateTitle = "No Active Flow Tasks Yet",
                emptyStateBody = "Sync with Google Tasks or lock in up to 3 priorities for today.",
                items = activeItems
            )
        )
    }

    internal fun resolveNodeCollisions(nodes: List<TaskVisualNode>): List<TaskVisualNode> {
        if (nodes.size <= 1) return nodes
        val mutableX = FloatArray(nodes.size) { nodes[it].xNormalized }
        val mutableY = FloatArray(nodes.size) { nodes[it].yNormalized }

        repeat(12) {
            for (i in nodes.indices) {
                for (j in i + 1 until nodes.size) {
                    val dx = mutableX[j] - mutableX[i]
                    val dy = mutableY[j] - mutableY[i]
                    val distSq = dx * dx + dy * dy
                    if (distSq < MIN_NODE_SEPARATION * MIN_NODE_SEPARATION) {
                        val dist = sqrt(distSq.toDouble()).toFloat()
                        val overlap = (MIN_NODE_SEPARATION - dist).coerceAtLeast(0.02f)
                        val dirX = if (abs(dx) > 0.001f) dx / dist else if ((i + j) % 2 == 0) 0.75f else -0.75f
                        val dirY = if (abs(dy) > 0.001f) dy / dist else if (j % 2 == 0) 0.65f else -0.65f

                        mutableX[i] = (mutableX[i] - dirX * overlap * 0.5f).coerceIn(0.14f, 0.86f)
                        mutableY[i] = (mutableY[i] - dirY * overlap * 0.5f).coerceIn(0.18f, 0.82f)
                        mutableX[j] = (mutableX[j] + dirX * overlap * 0.5f).coerceIn(0.14f, 0.86f)
                        mutableY[j] = (mutableY[j] + dirY * overlap * 0.5f).coerceIn(0.18f, 0.82f)
                    }
                }
            }
        }

        return nodes.mapIndexed { idx, node ->
            node.copy(
                xNormalized = mutableX[idx],
                yNormalized = mutableY[idx]
            )
        }
    }

    fun findTappedNode(
        nodes: List<TaskVisualNode>,
        tapXNormalized: Float,
        tapYNormalized: Float,
        hitRadiusNormalized: Float = 0.14f
    ): TaskVisualNode? {
        return nodes
            .map { node ->
                val dx = node.xNormalized - tapXNormalized
                val dy = (1f - node.yNormalized) - tapYNormalized
                val distance = sqrt((dx * dx + dy * dy).toDouble()).toFloat()
                node to distance
            }
            .filter { (node, distance) -> distance <= hitRadiusNormalized * itFirstRadiusBoost(node) }
            .minByOrNull { (_, distance) -> distance }
            ?.first
    }

    private fun itFirstRadiusBoost(node: TaskVisualNode): Float =
        node.radiusMultiplier.coerceIn(0.95f, 1.5f)

    internal fun truncateLabel(title: String, maxChars: Int): String {
        val clean = title.trim()
        if (clean.length <= maxChars) return clean
        return clean.take(maxChars - 1).trimEnd() + "…"
    }
}
