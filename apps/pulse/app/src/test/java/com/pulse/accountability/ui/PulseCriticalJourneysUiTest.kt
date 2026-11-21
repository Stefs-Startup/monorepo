package com.pulse.accountability.ui

import com.pulse.accountability.data.local.PartnerTone
import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskEnergyLevel
import com.pulse.accountability.data.local.TaskItemEntity
import com.pulse.accountability.data.local.UserSettings
import com.pulse.accountability.domain.AccountabilityCategory
import com.pulse.accountability.domain.HorizonWindowType
import com.pulse.accountability.domain.PinDecision
import com.pulse.accountability.domain.ScarcityEngine
import com.pulse.accountability.domain.TaskVisualAnalyticsEngine
import com.pulse.accountability.domain.TriageAction
import com.pulse.accountability.domain.TriageRules
import com.pulse.accountability.domain.UndoneAccountabilityEngine
import com.pulse.accountability.observability.GoogleAuthDiagnostics
import com.pulse.accountability.ui.components.chat.PartnerChatMapper
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * Critical-journey Android UI & Maestro flow contract suite (STE-59):
 *   1. Onboarding (4-step setup, Google OAuth diagnostic states, persona selection, initial Top-3 anchor)
 *   2. Setting Today's Top-3 (0/3 -> 3/3 locking, 4th pin scarcity swap gate, swap execution, unpin)
 *   3. Left-Undone Rescue Triage (Habitually Undone & Long-Standing Drift triage: 5m shrink, reschedule, park)
 *   4. Maestro UI flow definitions audit (`apps/pulse/app/maestro/`)
 */
class PulseCriticalJourneysUiTest {

    private val referenceDate: LocalDate = LocalDate.of(2026, 11, 20)
    private val referenceMillis: Long =
        referenceDate.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
    private val dayMs: Long = 86_400_000L

    private fun seedTasks(): List<TaskItemEntity> = listOf(
        TaskItemEntity(
            id = "task-tax-receipts",
            title = "Consolidate Q3 expense receipts & CPA export",
            notes = "Download statements from both cards",
            deferCount = 5,
            dueEpochMillis = referenceMillis - 4 * dayMs,
            createdEpochMillis = referenceMillis - 14 * dayMs,
            updatedEpochMillis = referenceMillis - 6 * dayMs,
            energyLevel = TaskEnergyLevel.DEEP_WORK.name
        ),
        TaskItemEntity(
            id = "task-dentist-call",
            title = "Call clinic to reschedule annual dental checkup",
            notes = "Clinic open 9am-4pm",
            deferCount = 4,
            dueEpochMillis = referenceMillis - 2 * dayMs,
            createdEpochMillis = referenceMillis - 11 * dayMs,
            updatedEpochMillis = referenceMillis - 4 * dayMs,
            energyLevel = TaskEnergyLevel.QUICK_WIN.name
        ),
        TaskItemEntity(
            id = "task-arch-rfc",
            title = "Write Spring Boot 4 + Angular 21 architecture RFC",
            notes = "Outline pure domain boundaries",
            deferCount = 2,
            dueEpochMillis = referenceMillis,
            createdEpochMillis = referenceMillis - 9 * dayMs,
            updatedEpochMillis = referenceMillis - 3 * dayMs,
            energyLevel = TaskEnergyLevel.FOCUSED.name
        ),
        TaskItemEntity(
            id = "task-passport-renewal",
            title = "Renew passport photo & mail DS-82 form",
            notes = "Post office closes at 5pm",
            deferCount = 1,
            dueEpochMillis = referenceMillis - 6 * dayMs,
            createdEpochMillis = referenceMillis - 18 * dayMs,
            updatedEpochMillis = referenceMillis - 9 * dayMs,
            energyLevel = TaskEnergyLevel.FOCUSED.name
        )
    )

    @Test
    fun `Journey 1 - Onboarding UI state transitions across 4 steps, persona selection, and first Top-3 anchor`() {
        var state = PulseUiState(
            allTasks = seedTasks(),
            settings = UserSettings(
                hasCompletedOnboarding = false,
                partnerTone = PartnerTone.GENTLE_COACH,
                googleAccountEmail = ""
            )
        )

        // Step 1 -> Step 2: before Google connection, simulate OAuth diagnostic recovery and connection
        val diagnostic = GoogleAuthDiagnostics.classifySignInFailure(
            IllegalStateException("10: DEVELOPER_ERROR")
        )
        state = state.copy(authDiagnostic = diagnostic)
        assertNotNull(state.authDiagnostic)
        assertTrue(state.authDiagnostic!!.userFacingTitle.isNotBlank())

        // Connect Google account and clear diagnostic
        state = state.copy(
            authDiagnostic = null,
            settings = state.settings.copy(googleAccountEmail = "stefan@pulse.local")
        )
        assertNull(state.authDiagnostic)
        assertEquals("stefan@pulse.local", state.settings.googleAccountEmail)

        // Step 3: Select Direct Partner persona
        state = state.copy(
            settings = state.settings.copy(partnerTone = PartnerTone.DIRECT_PARTNER)
        )
        assertEquals(PartnerTone.DIRECT_PARTNER, state.settings.partnerTone)
        assertEquals("Candid & Focused", state.settings.partnerTone.title)

        // Step 4: Lock in first Top-3 commitment during onboarding
        val firstTask = state.allTasks.first()
        val pinnedFirst = TriageRules.applyTriageAction(firstTask, TriageAction.CommitToday, referenceDate)
        val updatedTasks = state.allTasks.map { if (it.id == pinnedFirst.id) pinnedFirst else it }
        state = state.copy(
            allTasks = updatedTasks,
            todayTop3Tasks = updatedTasks.filter { it.commitment == TaskCommitmentState.TODAY_TOP_3 },
            settings = state.settings.copy(hasCompletedOnboarding = true),
            statusBannerMessage = "Welcome to Pulse. Let's make today count."
        )

        assertTrue(state.settings.hasCompletedOnboarding)
        assertEquals(1, state.todayTop3Tasks.size)
        assertEquals("Welcome to Pulse. Let's make today count.", state.statusBannerMessage)
    }

    @Test
    fun `Journey 2 - Top-3 Scarcity Gate pins 3 tasks, requires swap on 4th pin, swaps, and unpins`() {
        val tasks = seedTasks().toMutableList()
        fun currentTop3(): List<TaskItemEntity> =
            tasks.filter { it.commitment == TaskCommitmentState.TODAY_TOP_3 }

        // Pin tasks 0, 1, 2 into Today's Top 3
        for (i in 0..2) {
            val candidate = tasks[i]
            val decision = ScarcityEngine.evaluatePinAction(currentTop3(), candidate)
            assertTrue("Expected AllowPin for slot ${i + 1}", decision is PinDecision.AllowPin)
            tasks[i] = candidate.copy(commitmentState = TaskCommitmentState.TODAY_TOP_3.name)
        }
        assertEquals(3, currentTop3().size)

        // 4th pin must trigger SwapRequired scarcity gate
        val fourthCandidate = tasks[3]
        val fourthDecision = ScarcityEngine.evaluatePinAction(currentTop3(), fourthCandidate)
        assertTrue(fourthDecision is PinDecision.SwapRequired)

        // UI state reflects pendingSwapCandidate modal open
        var uiState = PulseUiState(
            allTasks = tasks.toList(),
            todayTop3Tasks = currentTop3(),
            pendingSwapCandidate = fourthCandidate
        )
        assertNotNull(uiState.pendingSwapCandidate)

        // Execute swap: replace task-arch-rfc with task-passport-renewal
        val toRemove = tasks[2]
        val swapResult = ScarcityEngine.executeSwap(currentTop3(), toRemove, fourthCandidate)
        tasks[2] = swapResult.unpinnedTask
        tasks[3] = swapResult.pinnedTask

        val classified = tasks.map { UndoneAccountabilityEngine.classifyTask(it, referenceDate) }
        val horizon = TaskVisualAnalyticsEngine.buildHorizonSnapshot(classified)
        uiState = uiState.copy(
            allTasks = tasks.toList(),
            todayTop3Tasks = currentTop3(),
            pendingSwapCandidate = null,
            horizonSnapshot = horizon
        )

        assertNull(uiState.pendingSwapCandidate)
        assertEquals(3, uiState.todayTop3Tasks.size)
        assertTrue(uiState.todayTop3Tasks.any { it.id == "task-passport-renewal" })
        assertFalse(uiState.todayTop3Tasks.any { it.id == "task-arch-rfc" })

        val activeWindow = uiState.horizonSnapshot.windows.first {
            it.windowType == HorizonWindowType.ACTIVE_FLOW
        }
        assertEquals("3/3 Top-3", activeWindow.headlineStat)

        // Unpin one task from Top 3
        val unpinDecision = ScarcityEngine.evaluatePinAction(currentTop3(), tasks[3])
        assertTrue(unpinDecision is PinDecision.Unpin)
        tasks[3] = tasks[3].copy(commitmentState = TaskCommitmentState.NORMAL.name)
        assertEquals(2, currentTop3().size)
    }

    @Test
    fun `Journey 3 - Left-undone rescue triage shrinks to 5m, reschedules, and parks stalled tasks`() {
        val initial = seedTasks()
        val classifiedBefore = initial.map { UndoneAccountabilityEngine.classifyTask(it, referenceDate) }
        val stalledBefore = classifiedBefore.filter {
            it.category == AccountabilityCategory.HABITUALLY_DEFERRED ||
                it.category == AccountabilityCategory.LONG_STANDING_GHOSTED
        }
        assertEquals(4, stalledBefore.size)

        // Open conversational reflection sheet on top stalled task
        val taxTask = initial[0]
        val thread = UndoneAccountabilityEngine.buildInitialReflectionThread(taxTask, referenceDate)
        val uiState = PulseUiState(
            allTasks = initial,
            stalledStatuses = stalledBefore,
            activeConversationTask = taxTask,
            isConversationSheetOpen = true,
            conversationMessages = thread,
            settings = UserSettings(partnerTone = PartnerTone.DIRECT_PARTNER)
        )
        val chatModel = PartnerChatMapper.fromUiState(uiState, referenceDate)
        assertEquals("Consolidate Q3 expense receipts & CPA export", chatModel.activeTask?.title)
        assertTrue(chatModel.quickReplies.isNotEmpty())

        // 1. Shrink habitual task to 5m starter win
        val shrunk = TriageRules.applyTriageAction(taxTask, TriageAction.ShrinkTo5m, referenceDate)
        assertTrue(shrunk.title.startsWith("5m starter:"))
        assertEquals(TaskEnergyLevel.QUICK_WIN, shrunk.energy)
        assertEquals(TaskCommitmentState.TODAY_TOP_3, shrunk.commitment)

        // 2. Reschedule second habitual task to tomorrow (increments deferCount)
        val dentistTask = initial[1]
        val tomorrow = referenceDate.plusDays(1)
        val rescheduled = TriageRules.applyTriageAction(
            dentistTask,
            TriageAction.Reschedule(tomorrow),
            referenceDate
        )
        assertEquals(dentistTask.deferCount + 1, rescheduled.deferCount)

        // 3. Park long-standing drift task in Someday
        val passportTask = initial[3]
        val parked = TriageRules.applyTriageAction(
            passportTask,
            TriageAction.ParkSomeday,
            referenceDate
        )
        assertEquals(TaskCommitmentState.SOMEDAY_PARKED, parked.commitment)
        val parkedStatus = UndoneAccountabilityEngine.classifyTask(parked, referenceDate)
        assertEquals(AccountabilityCategory.COMPLETED_OR_PARKED, parkedStatus.category)
    }

    @Test
    fun `Journey 4 - Maestro UI flow files exist and target com_pulse_accountability critical screens`() {
        val candidates = listOf(
            File("maestro"),
            File("app/maestro"),
            File("apps/pulse/app/maestro")
        )
        val maestroDir = candidates.firstOrNull { it.isDirectory }
        assertNotNull("Expected apps/pulse/app/maestro directory to exist", maestroDir)

        val config = File(maestroDir!!, "config.yaml").readText()
        assertTrue(config.contains("appId: com.pulse.accountability"))
        assertTrue(config.contains("onboarding-flow.yaml"))
        assertTrue(config.contains("top3-scarcity-flow.yaml"))
        assertTrue(config.contains("rescue-triage-flow.yaml"))

        val onboardingFlow = File(maestroDir, "onboarding-flow.yaml").readText()
        assertTrue(onboardingFlow.contains("Step 1 of 4"))
        assertTrue(onboardingFlow.contains("Begin Setup"))
        assertTrue(onboardingFlow.contains("Choose Your Partner Persona"))
        assertTrue(onboardingFlow.contains("Enter Pulse Dashboard"))

        val top3Flow = File(maestroDir, "top3-scarcity-flow.yaml").readText()
        assertTrue(top3Flow.contains("Committed Today (0/3)"))
        assertTrue(top3Flow.contains("Lock into Today's Top 3"))

        val triageFlow = File(maestroDir, "rescue-triage-flow.yaml").readText()
        assertTrue(triageFlow.contains("Habitually Undone"))
        assertTrue(triageFlow.contains("Talk it through"))
        assertTrue(triageFlow.contains("Shrink to 5-minute starter"))
    }
}
