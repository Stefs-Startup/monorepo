package com.pulse.accountability.domain

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalTime

class RitualGateRulesTest {

    @Test
    fun `resolveCurrentRitual returns MorningAnchor between 0500 and 1159`() {
        val window = RitualGateRules.resolveCurrentRitual(LocalTime.of(8, 30))
        assertEquals(RitualWindowType.MORNING_ANCHOR, window.type)
        assertEquals(true, window.shouldPromptTriage)
    }

    @Test
    fun `resolveCurrentRitual returns MiddayFocus between 1200 and 1759 hiding triage clutter`() {
        val window = RitualGateRules.resolveCurrentRitual(LocalTime.of(14, 15))
        assertEquals(RitualWindowType.MIDDAY_FOCUS, window.type)
        assertEquals(false, window.shouldPromptTriage) // Midday hides backlog clutter
    }

    @Test
    fun `resolveCurrentRitual returns EveningShutdown after 1800`() {
        val window = RitualGateRules.resolveCurrentRitual(LocalTime.of(19, 0))
        assertEquals(RitualWindowType.EVENING_SHUTDOWN, window.type)
        assertEquals(true, window.shouldPromptTriage)
    }
}
