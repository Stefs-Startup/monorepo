package com.pulse.accountability.domain

import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskItemEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset

class TaskVisualAnalyticsEngineTest {

    private val fixedToday = LocalDate.of(2026, 11, 5)
    private val fixedNowMillis = fixedToday.atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli()
    private val dayMillis = 86_400_000L

    @Test
    fun `buildHorizonSnapshot computes accurate summary metrics and normalized coordinates`() {
        val t1 = TaskItemEntity(
            id = "habitual-1",
            title = "Schedule annual bloodwork and physical",
            deferCount = 4,
            createdEpochMillis = fixedNowMillis - 10 * dayMillis,
            updatedEpochMillis = fixedNowMillis - 2 * dayMillis
        )
        val t2 = TaskItemEntity(
            id = "ghosted-1",
            title = "Clean garage shelves",
            deferCount = 0,
            createdEpochMillis = fixedNowMillis - 9 * dayMillis,
            updatedEpochMillis = fixedNowMillis - 8 * dayMillis
        )
        val t3 = TaskItemEntity(
            id = "committed-1",
            title = "Send Q4 roadmap draft",
            commitmentState = TaskCommitmentState.TODAY_TOP_3.name,
            deferCount = 0,
            createdEpochMillis = fixedNowMillis - 1 * dayMillis,
            updatedEpochMillis = fixedNowMillis
        )

        val statuses = listOf(t1, t2, t3).map {
            UndoneAccountabilityEngine.classifyTask(it, fixedToday, fixedNowMillis, ZoneOffset.UTC)
        }

        val snapshot = TaskVisualAnalyticsEngine.buildHorizonSnapshot(statuses)

        assertEquals(3, snapshot.nodes.size)
        assertEquals(1, snapshot.habitualDeferralCount)
        assertEquals(1, snapshot.longStandingCount)
        assertEquals(1, snapshot.committedTodayCount)
        assertEquals(10L, snapshot.oldestOpenDays)
        assertEquals(33, snapshot.clarityRatioPercent)
        assertEquals(2.0, snapshot.averageStalledDeferrals, 0.01)

        val habitualNode = snapshot.nodes.first { it.taskId == "habitual-1" }
        val committedNode = snapshot.nodes.first { it.taskId == "committed-1" }

        // Habitually deferred task should sit higher on the Y-axis and further right on X-axis
        assertTrue(habitualNode.yNormalized > committedNode.yNormalized)
        assertTrue(habitualNode.xNormalized > committedNode.xNormalized)
        assertEquals("4×", habitualNode.badgeText)
        assertEquals("Top 3", committedNode.badgeText)
    }

    @Test
    fun `resolveNodeCollisions separates identical tasks deterministically`() {
        val dup1 = TaskItemEntity(
            id = "dup-1",
            title = "Task A",
            deferCount = 3,
            createdEpochMillis = fixedNowMillis - 6 * dayMillis,
            updatedEpochMillis = fixedNowMillis - 6 * dayMillis
        )
        val dup2 = TaskItemEntity(
            id = "dup-2",
            title = "Task B",
            deferCount = 3,
            createdEpochMillis = fixedNowMillis - 6 * dayMillis,
            updatedEpochMillis = fixedNowMillis - 6 * dayMillis
        )

        val statuses = listOf(dup1, dup2).map {
            UndoneAccountabilityEngine.classifyTask(it, fixedToday, fixedNowMillis, ZoneOffset.UTC)
        }
        val snapshot = TaskVisualAnalyticsEngine.buildHorizonSnapshot(statuses)

        val n1 = snapshot.nodes[0]
        val n2 = snapshot.nodes[1]
        val dx = n1.xNormalized - n2.xNormalized
        val dy = n1.yNormalized - n2.yNormalized
        val dist = kotlin.math.sqrt((dx * dx + dy * dy).toDouble())

        assertTrue("Expected separated nodes, got dist=$dist", dist >= 0.08)
    }

    @Test
    fun `findTappedNode returns closest node within hit radius and null when far away`() {
        val task = TaskItemEntity(
            id = "target-1",
            title = "Review tax documents",
            deferCount = 3,
            createdEpochMillis = fixedNowMillis - 7 * dayMillis,
            updatedEpochMillis = fixedNowMillis - 3 * dayMillis
        )
        val status = UndoneAccountabilityEngine.classifyTask(task, fixedToday, fixedNowMillis, ZoneOffset.UTC)
        val snapshot = TaskVisualAnalyticsEngine.buildHorizonSnapshot(listOf(status))
        val node = snapshot.nodes.single()

        // Canvas Y is inverted (1f - yNormalized)
        val hit = TaskVisualAnalyticsEngine.findTappedNode(
            nodes = snapshot.nodes,
            tapXNormalized = node.xNormalized,
            tapYNormalized = 1f - node.yNormalized
        )
        assertNotNull(hit)
        assertEquals("target-1", hit?.taskId)

        val miss = TaskVisualAnalyticsEngine.findTappedNode(
            nodes = snapshot.nodes,
            tapXNormalized = 0.01f,
            tapYNormalized = 0.99f
        )
        assertNull(miss)
    }

    @Test
    fun `buildHorizonSnapshot partitions tasks into 3 swipeable windows in strict descending order`() {
        val h1 = TaskItemEntity(
            id = "h-2x",
            title = "Deferred twice",
            deferCount = 2,
            createdEpochMillis = fixedNowMillis - 4 * dayMillis,
            updatedEpochMillis = fixedNowMillis - 2 * dayMillis
        )
        val h2 = TaskItemEntity(
            id = "h-5x",
            title = "Deferred five times",
            deferCount = 5,
            createdEpochMillis = fixedNowMillis - 11 * dayMillis,
            updatedEpochMillis = fixedNowMillis - 3 * dayMillis
        )
        val h3 = TaskItemEntity(
            id = "h-3x",
            title = "Deferred three times",
            deferCount = 3,
            createdEpochMillis = fixedNowMillis - 6 * dayMillis,
            updatedEpochMillis = fixedNowMillis - 2 * dayMillis
        )
        val d1 = TaskItemEntity(
            id = "d-6d",
            title = "Idle six days",
            deferCount = 0,
            createdEpochMillis = fixedNowMillis - 6 * dayMillis,
            updatedEpochMillis = fixedNowMillis - 6 * dayMillis
        )
        val d2 = TaskItemEntity(
            id = "d-12d",
            title = "Idle twelve days",
            deferCount = 0,
            createdEpochMillis = fixedNowMillis - 12 * dayMillis,
            updatedEpochMillis = fixedNowMillis - 12 * dayMillis
        )

        val statuses = listOf(h1, h2, h3, d1, d2).map {
            UndoneAccountabilityEngine.classifyTask(it, fixedToday, fixedNowMillis, ZoneOffset.UTC)
        }
        val snapshot = TaskVisualAnalyticsEngine.buildHorizonSnapshot(statuses)

        assertEquals(3, snapshot.windows.size)

        val habitualWindow = snapshot.windows.first { it.windowType == HorizonWindowType.HABITUALLY_UNDONE }
        assertEquals(listOf("h-5x", "h-3x", "h-2x"), habitualWindow.items.map { it.taskId })
        assertTrue(habitualWindow.items[0].intensityFraction >= habitualWindow.items[1].intensityFraction)
        assertTrue(habitualWindow.items[1].intensityFraction >= habitualWindow.items[2].intensityFraction)

        val driftWindow = snapshot.windows.first { it.windowType == HorizonWindowType.LONG_STANDING_DRIFT }
        assertEquals(listOf("d-12d", "d-6d"), driftWindow.items.map { it.taskId })
        assertTrue(driftWindow.items[0].sortScore > driftWindow.items[1].sortScore)
    }
}
