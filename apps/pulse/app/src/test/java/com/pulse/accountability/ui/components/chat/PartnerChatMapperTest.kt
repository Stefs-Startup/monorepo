package com.pulse.accountability.ui.components.chat

import com.pulse.accountability.data.local.PartnerTone
import com.pulse.accountability.data.local.TaskItemEntity
import com.pulse.accountability.data.local.UserSettings
import com.pulse.accountability.domain.AccountabilityCategory
import com.pulse.accountability.domain.ChatRole
import com.pulse.accountability.domain.ConversationalMessage
import com.pulse.accountability.domain.TaskAccountabilityStatus
import com.pulse.accountability.domain.TriageAction
import com.pulse.accountability.ui.PulseUiState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class PartnerChatMapperTest {

    @Test
    fun `fromUiState maps active task, stalled index, quick replies, and partner tone deterministically`() {
        val t1 = TaskItemEntity(id = "t1", title = "Schedule bloodwork", deferCount = 4)
        val t2 = TaskItemEntity(id = "t2", title = "File taxes", deferCount = 2)
        val stalled = listOf(
            TaskAccountabilityStatus(t1, AccountabilityCategory.HABITUALLY_DEFERRED, "Deferred 4×", 9, 2, 0),
            TaskAccountabilityStatus(t2, AccountabilityCategory.HABITUALLY_DEFERRED, "Deferred 2×", 5, 1, 0)
        )
        val msg = ConversationalMessage(role = ChatRole.PARTNER, text = "How can we make this easier?")

        val state = PulseUiState(
            stalledStatuses = stalled,
            activeConversationTask = t1,
            conversationMessages = listOf(msg),
            settings = UserSettings(partnerTone = PartnerTone.GENTLE_COACH)
        )

        val model = PartnerChatMapper.fromUiState(state, LocalDate.of(2026, 11, 5))

        assertEquals("Schedule bloodwork", model.activeTask?.title)
        assertEquals("Deferred 4×", model.badgeText)
        assertTrue(model.isHabitualDeferral)
        assertEquals("1 of 2 stalled", model.positionLabel)
        assertTrue(model.canCycleNext)
        assertEquals("Warm & Grounded Partner", model.partnerTitle)
        assertEquals(5, model.quickReplies.size)
        assertEquals("Shrink to 5m & Do Today", PartnerChatMapper.actionLabelFor(TriageAction.ShrinkTo5m))
    }
}
