package com.pulse.backend.domain;

import com.pulse.backend.domain.TaskItem.TaskCommitmentState;
import com.pulse.backend.domain.TaskItem.TaskEnergyLevel;
import com.pulse.backend.domain.TaskVisualAnalyticsEngine.HorizonWindowBarItem;
import com.pulse.backend.domain.TaskVisualAnalyticsEngine.HorizonWindowCardModel;
import com.pulse.backend.domain.TaskVisualAnalyticsEngine.TaskHorizonAnalyticsSnapshot;
import com.pulse.backend.domain.UndoneAccountabilityEngine.TaskAccountabilityStatus;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TaskVisualAnalyticsEngineTest {

    private static final long DAY_MS = 86_400_000L;
    private static final ZoneId ZONE = ZoneId.of("UTC");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 7);
    private static final long NOW_MS = TODAY.atStartOfDay(ZONE).toInstant().toEpochMilli();

    @Test
    void buildsThreeHorizonWindowsSortedInStrictDescendingOrder() {
        List<TaskItem> tasks = List.of(
                new TaskItem("h-low", "g1", "@default", "Tasks", "Habitual 2x", "", false,
                        null, null, NOW_MS - 5 * DAY_MS, NOW_MS - 2 * DAY_MS, 2,
                        TaskCommitmentState.NORMAL, TaskEnergyLevel.FOCUSED, "", false),
                new TaskItem("h-high", "g2", "@default", "Tasks", "Habitual 6x", "", false,
                        null, null, NOW_MS - 12 * DAY_MS, NOW_MS - 4 * DAY_MS, 6,
                        TaskCommitmentState.NORMAL, TaskEnergyLevel.DEEP_WORK, "", false),
                new TaskItem("d-low", "g3", "@default", "Tasks", "Drift 5d", "", false,
                        null, null, NOW_MS - 5 * DAY_MS, NOW_MS - 5 * DAY_MS, 0,
                        TaskCommitmentState.NORMAL, TaskEnergyLevel.FOCUSED, "", false),
                new TaskItem("d-high", "g4", "@default", "Tasks", "Drift 11d", "", false,
                        null, null, NOW_MS - 11 * DAY_MS, NOW_MS - 11 * DAY_MS, 1,
                        TaskCommitmentState.NORMAL, TaskEnergyLevel.FOCUSED, "", false)
        );

        List<TaskAccountabilityStatus> statuses = tasks.stream()
                .map(t -> UndoneAccountabilityEngine.classifyTask(t, TODAY, NOW_MS, ZONE))
                .toList();

        TaskHorizonAnalyticsSnapshot snapshot = TaskVisualAnalyticsEngine.buildHorizonSnapshot(statuses);
        assertEquals(3, snapshot.windows().size());

        HorizonWindowCardModel habitualWindow = snapshot.windows().get(0);
        List<HorizonWindowBarItem> habitualItems = habitualWindow.items();
        assertEquals(2, habitualItems.size());
        assertEquals("h-high", habitualItems.get(0).taskId());
        assertEquals("h-low", habitualItems.get(1).taskId());
        assertTrue(habitualItems.get(0).sortScore() > habitualItems.get(1).sortScore());

        HorizonWindowCardModel driftWindow = snapshot.windows().get(1);
        List<HorizonWindowBarItem> driftItems = driftWindow.items();
        assertEquals(2, driftItems.size());
        assertEquals("d-high", driftItems.get(0).taskId());
        assertEquals("d-low", driftItems.get(1).taskId());
        assertTrue(driftItems.get(0).sortScore() > driftItems.get(1).sortScore());
    }
}
