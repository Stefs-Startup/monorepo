package com.pulse.backend.domain;

import com.pulse.backend.domain.TaskItem.TaskCommitmentState;
import com.pulse.backend.domain.TaskItem.TaskEnergyLevel;
import com.pulse.backend.domain.UndoneAccountabilityEngine.ConversationalMessage;
import com.pulse.backend.domain.UndoneAccountabilityEngine.TaskAccountabilityStatus;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UndoneAccountabilityEngineTest {

    private static final long DAY_MS = 86_400_000L;
    private static final ZoneId ZONE = ZoneId.of("UTC");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 7);
    private static final long NOW_MS = TODAY.atStartOfDay(ZONE).toInstant().toEpochMilli();

    @Test
    void classifiesHabituallyDeferredTaskWhenDeferCountIsAtLeastTwo() {
        TaskItem task = new TaskItem(
                "t-1", "g-1", "@default", "My Tasks",
                "File quarterly state taxes", "", false,
                null, null, NOW_MS - 10 * DAY_MS, NOW_MS - 2 * DAY_MS,
                4, TaskCommitmentState.NORMAL, TaskEnergyLevel.DEEP_WORK, "", false
        );

        TaskAccountabilityStatus status = UndoneAccountabilityEngine.classifyTask(task, TODAY, NOW_MS, ZONE);

        assertEquals(AccountabilityCategory.HABITUALLY_DEFERRED, status.category());
        assertTrue(status.badgeLabel().contains("Deferred 4×"));
    }

    @Test
    void classifiesLongStandingGhostedWhenUntouchedForFiveOrMoreDays() {
        TaskItem task = new TaskItem(
                "t-2", "g-2", "@default", "My Tasks",
                "Clean garage shelves", "", false,
                null, null, NOW_MS - 8 * DAY_MS, NOW_MS - 6 * DAY_MS,
                0, TaskCommitmentState.NORMAL, TaskEnergyLevel.FOCUSED, "", false
        );

        TaskAccountabilityStatus status = UndoneAccountabilityEngine.classifyTask(task, TODAY, NOW_MS, ZONE);

        assertEquals(AccountabilityCategory.LONG_STANDING_GHOSTED, status.category());
        assertEquals("6d untouched", status.badgeLabel());
    }

    @Test
    void generatesShrinkTo5mPartnerReplyWhenUserMentionsOverwhelm() {
        TaskItem task = new TaskItem(
                "t-3", "g-3", "@default", "My Tasks",
                "Refactor legacy auth module", "", false,
                null, null, NOW_MS - 5 * DAY_MS, NOW_MS - 2 * DAY_MS,
                3, TaskCommitmentState.NORMAL, TaskEnergyLevel.DEEP_WORK, "", false
        );

        ConversationalMessage reply = UndoneAccountabilityEngine.generatePartnerReply(
                task, "It feels too big and vague to start today"
        );

        assertEquals("SHRINK_TO_5M", reply.suggestedActionCode());
        assertTrue(reply.text().contains("5-minute starter step"));
    }
}
