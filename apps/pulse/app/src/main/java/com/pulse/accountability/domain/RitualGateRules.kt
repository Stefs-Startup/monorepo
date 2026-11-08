package com.pulse.accountability.domain

import java.time.LocalTime

enum class RitualWindowType {
    MORNING_ANCHOR,
    MIDDAY_FOCUS,
    EVENING_SHUTDOWN
}

data class ActiveRitualWindow(
    val type: RitualWindowType,
    val title: String,
    val headlineGuidance: String,
    val shouldPromptTriage: Boolean
)

object RitualGateRules {

    fun resolveCurrentRitual(time: LocalTime = LocalTime.now()): ActiveRitualWindow {
        val hour = time.hour

        return when {
            hour in 5..11 -> ActiveRitualWindow(
                type = RitualWindowType.MORNING_ANCHOR,
                title = "Morning Anchor Check-In",
                headlineGuidance = "Clear yesterday's open loops and lock in your Top 3 non-negotiables.",
                shouldPromptTriage = true
            )
            hour in 12..17 -> ActiveRitualWindow(
                type = RitualWindowType.MIDDAY_FOCUS,
                title = "Midday Focus Window",
                headlineGuidance = "Backlog is hidden. Protect deep work and execute your committed Top 3.",
                shouldPromptTriage = false
            )
            else -> ActiveRitualWindow(
                type = RitualWindowType.EVENING_SHUTDOWN,
                title = "Evening Shutdown Reflection",
                headlineGuidance = "Confront unfinished tasks without guilt, celebrate wins, and prep tomorrow.",
                shouldPromptTriage = true
            )
        }
    }
}
