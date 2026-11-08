package com.pulse.accountability.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.pulse.accountability.data.local.PartnerTone
import com.pulse.accountability.data.local.PrepStep
import com.pulse.accountability.data.local.ReflectionEntryEntity
import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskEnergyLevel
import com.pulse.accountability.data.local.TaskItemEntity
import com.pulse.accountability.data.local.UserPreferencesRepository
import com.pulse.accountability.data.local.UserSettings
import com.pulse.accountability.data.local.WeeklyGoalEntity
import com.pulse.accountability.data.repository.PulseRepository
import com.pulse.accountability.data.repository.TriageDecision
import com.pulse.accountability.domain.AccountabilityPartnerEngine
import com.pulse.accountability.domain.ActiveRitualWindow
import com.pulse.accountability.domain.PartnerBriefing
import com.pulse.accountability.domain.PinDecision
import com.pulse.accountability.domain.RitualGateRules
import com.pulse.accountability.domain.RitualWindowType
import com.pulse.accountability.domain.ScarcityEngine
import com.pulse.accountability.domain.TaskAccountabilityStatus
import com.pulse.accountability.domain.TaskHorizonAnalyticsSnapshot
import com.pulse.accountability.domain.TaskVisualAnalyticsEngine
import com.pulse.accountability.domain.TriageAction
import com.pulse.accountability.domain.TriageRules
import com.pulse.accountability.domain.UndoneAccountabilityEngine
import com.pulse.accountability.domain.AccountabilityCategory
import com.pulse.accountability.domain.ChatRole
import com.pulse.accountability.domain.ConversationalMessage
import com.pulse.accountability.observability.AuthDiagnosticResult
import com.pulse.accountability.observability.GoogleAuthDiagnostics
import com.pulse.accountability.observability.PulseObservability
import com.pulse.accountability.ui.components.chat.PartnerChatEvent
import android.content.Context
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.api.signin.GoogleSignInAccount
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate

data class PulseUiState(
    val allTasks: List<TaskItemEntity> = emptyList(),
    val todayTop3Tasks: List<TaskItemEntity> = emptyList(),
    val undoneOrForgottenTasks: List<TaskItemEntity> = emptyList(),
    val upcomingPrepTasks: List<TaskItemEntity> = emptyList(),
    val activeOtherTasks: List<TaskItemEntity> = emptyList(),
    val completedTasks: List<TaskItemEntity> = emptyList(),
    val weeklyGoals: List<WeeklyGoalEntity> = emptyList(),
    val reflections: List<ReflectionEntryEntity> = emptyList(),
    val settings: UserSettings = UserSettings(),
    val partnerBriefing: PartnerBriefing = PartnerBriefing(
        headline = "Morning Anchor",
        message = "Checking your commitments...",
        actionHighlight = "Review Today"
    ),
    val isSyncing: Boolean = false,
    val statusBannerMessage: String? = null,
    val activePrepCoachingMessage: String? = null,
    val isGeneratingPrepForTaskId: String? = null,
    val ritualWindow: ActiveRitualWindow = RitualGateRules.resolveCurrentRitual(),
    val pendingSwapCandidate: TaskItemEntity? = null,
    val stalledStatuses: List<TaskAccountabilityStatus> = emptyList(),
    val horizonSnapshot: TaskHorizonAnalyticsSnapshot = TaskVisualAnalyticsEngine.buildHorizonSnapshot(emptyList()),
    val activeConversationTask: TaskItemEntity? = null,
    val isConversationSheetOpen: Boolean = false,
    val conversationMessages: List<ConversationalMessage> = emptyList(),
    val authDiagnostic: AuthDiagnosticResult? = null
)

private data class TransientUiFeedback(
    val isSyncing: Boolean = false,
    val bannerMessage: String? = null,
    val prepCoachingMessage: String? = null,
    val generatingPrepTaskId: String? = null,
    val pendingSwapCandidate: TaskItemEntity? = null,
    val activeConversationTaskId: String? = null,
    val isConversationSheetOpen: Boolean = false,
    val conversationThreadsByTaskId: Map<String, List<ConversationalMessage>> = emptyMap(),
    val authDiagnostic: AuthDiagnosticResult? = null
)

class PulseViewModel(
    private val repository: PulseRepository,
    private val prefs: UserPreferencesRepository,
    private val partnerEngine: AccountabilityPartnerEngine = AccountabilityPartnerEngine()
) : ViewModel() {

    private val feedbackState = MutableStateFlow(TransientUiFeedback())

    val uiState: StateFlow<PulseUiState> = combine(
        repository.tasksFlow,
        repository.goalsFlow,
        repository.reflectionsFlow,
        repository.settingsFlow,
        feedbackState
    ) { tasks, goals, reflections, settings, feedback ->
        val today = LocalDate.now()
        val incomplete = tasks.filter { !it.isCompleted && it.commitment != TaskCommitmentState.SOMEDAY_PARKED }

        val top3 = incomplete.filter { it.commitment == TaskCommitmentState.TODAY_TOP_3 }
        val undone = incomplete.filter { it.isUndoneOrForgotten(today) }
        val prepSoon = incomplete.filter { it.needsPreparationSoon(today) }
        val otherActive = incomplete.filter {
            it.commitment != TaskCommitmentState.TODAY_TOP_3 && !it.isUndoneOrForgotten(today)
        }
        val completed = tasks.filter { it.isCompleted }

        val briefing = partnerEngine.buildDailyBriefing(
            tasks = tasks,
            goals = goals,
            tone = settings.partnerTone,
            today = today
        )

        val classified = incomplete.map { UndoneAccountabilityEngine.classifyTask(it, today) }
        val horizonSnapshot = TaskVisualAnalyticsEngine.buildHorizonSnapshot(classified)
        val stalled = classified.filter {
            it.category == AccountabilityCategory.HABITUALLY_DEFERRED ||
                it.category == AccountabilityCategory.LONG_STANDING_GHOSTED
        }.sortedByDescending { it.task.deferCount * 10 + it.daysOld }

        val activeConvTask = tasks.find { it.id == feedback.activeConversationTaskId }
            ?: stalled.firstOrNull()?.task
            ?: incomplete.firstOrNull()
        val existingThread = activeConvTask?.id?.let { feedback.conversationThreadsByTaskId[it] }
        val effectiveMessages = if (!existingThread.isNullOrEmpty()) {
            existingThread
        } else if (activeConvTask != null) {
            UndoneAccountabilityEngine.buildInitialReflectionThread(activeConvTask, today)
        } else {
            emptyList()
        }

        PulseUiState(
            allTasks = tasks,
            todayTop3Tasks = top3,
            undoneOrForgottenTasks = undone,
            upcomingPrepTasks = prepSoon,
            activeOtherTasks = otherActive,
            completedTasks = completed,
            weeklyGoals = goals,
            reflections = reflections,
            settings = settings,
            partnerBriefing = briefing,
            isSyncing = feedback.isSyncing,
            statusBannerMessage = feedback.bannerMessage,
            activePrepCoachingMessage = feedback.prepCoachingMessage,
            isGeneratingPrepForTaskId = feedback.generatingPrepTaskId,
            ritualWindow = RitualGateRules.resolveCurrentRitual(),
            pendingSwapCandidate = feedback.pendingSwapCandidate,
            stalledStatuses = stalled,
            horizonSnapshot = horizonSnapshot,
            activeConversationTask = activeConvTask,
            isConversationSheetOpen = feedback.isConversationSheetOpen,
            conversationMessages = effectiveMessages,
            authDiagnostic = feedback.authDiagnostic
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = PulseUiState()
    )

    init {
        viewModelScope.launch {
            repository.ensureDemoSeededIfEmpty()
        }
    }

    fun completeOnboarding(silent: Boolean = false) {
        viewModelScope.launch {
            PulseObservability.recordBreadcrumb("onboarding_completed")
            prefs.setOnboardingCompleted(true)
            if (!silent) {
                showBanner("Welcome to Pulse. Let's make today count.")
            }
        }
    }

    fun restartOnboarding() {
        viewModelScope.launch {
            PulseObservability.recordBreadcrumb("onboarding_restarted")
            prefs.setOnboardingCompleted(false)
        }
    }

    fun decodePrepSteps(task: TaskItemEntity): List<PrepStep> =
        repository.decodePrepSteps(task.prepChecklistJson)

    fun toggleTaskCompleted(task: TaskItemEntity) {
        viewModelScope.launch {
            PulseObservability.recordBreadcrumb(
                event = "task_completion_toggled",
                attributes = mapOf("new_state" to (!task.isCompleted).toString())
            )
            repository.toggleTaskCompleted(task)
        }
    }

    fun toggleTodayTop3(task: TaskItemEntity) {
        viewModelScope.launch {
            val decision = ScarcityEngine.evaluatePinAction(uiState.value.todayTop3Tasks, task)
            PulseObservability.recordBreadcrumb(
                event = "top3_pin_evaluated",
                attributes = mapOf("decision" to decision.javaClass.simpleName)
            )
            when (decision) {
                is PinDecision.AllowPin -> repository.toggleTodayTop3Commitment(task)
                is PinDecision.Unpin -> repository.toggleTodayTop3Commitment(task)
                is PinDecision.SwapRequired -> {
                    feedbackState.value = feedbackState.value.copy(pendingSwapCandidate = task)
                }
            }
        }
    }

    fun executeTop3Swap(toRemove: TaskItemEntity, toAdd: TaskItemEntity) {
        viewModelScope.launch {
            PulseObservability.recordBreadcrumb("top3_swap_executed")
            val result = ScarcityEngine.executeSwap(uiState.value.todayTop3Tasks, toRemove, toAdd)
            repository.updateTask(result.unpinnedTask)
            repository.updateTask(result.pinnedTask)
            feedbackState.value = feedbackState.value.copy(pendingSwapCandidate = null)
            showBanner("Swapped \"${toRemove.title.take(18)}\" with \"${toAdd.title.take(18)}\"")
        }
    }

    fun dismissSwapModal() {
        feedbackState.value = feedbackState.value.copy(pendingSwapCandidate = null)
    }

    fun selectVisualTask(task: TaskItemEntity) {
        PulseObservability.recordBreadcrumb(
            event = "visual_horizon_node_selected",
            attributes = mapOf("defer_count" to task.deferCount.toString())
        )
        val currentThreads = feedbackState.value.conversationThreadsByTaskId
        val thread = currentThreads[task.id] ?: UndoneAccountabilityEngine.buildInitialReflectionThread(task)
        feedbackState.value = feedbackState.value.copy(
            activeConversationTaskId = task.id,
            conversationThreadsByTaskId = currentThreads + (task.id to thread)
        )
    }

    fun openConversationForTask(task: TaskItemEntity) {
        PulseObservability.recordBreadcrumb(
            event = "open_conversational_reflection",
            attributes = mapOf("defer_count" to task.deferCount.toString())
        )
        val currentThreads = feedbackState.value.conversationThreadsByTaskId
        val thread = currentThreads[task.id] ?: UndoneAccountabilityEngine.buildInitialReflectionThread(task)
        feedbackState.value = feedbackState.value.copy(
            activeConversationTaskId = task.id,
            isConversationSheetOpen = true,
            conversationThreadsByTaskId = currentThreads + (task.id to thread)
        )
    }

    fun openDefaultConversationSheet(initialUserMessage: String? = null) {
        viewModelScope.launch {
            repository.ensureDemoSeededIfEmpty()
            val tasks = uiState.value.allTasks.ifEmpty { repository.tasksFlow.first() }
            val incomplete = tasks.filter { !it.isCompleted && it.commitment != TaskCommitmentState.SOMEDAY_PARKED }
            val classified = incomplete.map { UndoneAccountabilityEngine.classifyTask(it) }
            val topStalled = classified.firstOrNull {
                it.category == AccountabilityCategory.HABITUALLY_DEFERRED ||
                    it.category == AccountabilityCategory.LONG_STANDING_GHOSTED
            }?.task
            val target = uiState.value.activeConversationTask
                ?: topStalled
                ?: incomplete.firstOrNull()

            PulseObservability.recordBreadcrumb(
                event = "chat_fab_clicked",
                attributes = mapOf("has_target" to (target != null).toString())
            )
            if (target != null) {
                openConversationForTask(target)
                if (!initialUserMessage.isNullOrBlank()) {
                    sendConversationMessageForTask(target, initialUserMessage)
                }
            } else {
                feedbackState.value = feedbackState.value.copy(isConversationSheetOpen = true)
            }
        }
    }

    fun handlePartnerChatEvent(
        event: PartnerChatEvent,
        onNavigateToLog: () -> Unit = {}
    ) {
        when (event) {
            is PartnerChatEvent.SendMessage -> sendConversationMessage(event.text)
            is PartnerChatEvent.ExecuteTriage -> executeTriageAction(event.task, event.action)
            PartnerChatEvent.CycleNextTask -> cycleNextStalledTask()
            PartnerChatEvent.OpenUndoneLog -> {
                closeConversation()
                onNavigateToLog()
            }
            PartnerChatEvent.Dismiss -> closeConversation()
        }
    }

    fun sendConversationMessage(text: String) {
        val activeTask = uiState.value.activeConversationTask ?: return
        sendConversationMessageForTask(activeTask, text)
    }

    private fun sendConversationMessageForTask(activeTask: TaskItemEntity, text: String) {
        val trimmed = text.trim()
        if (trimmed.isBlank()) return

        val currentThreads = feedbackState.value.conversationThreadsByTaskId
        val baseMessages = currentThreads[activeTask.id]
            ?: UndoneAccountabilityEngine.buildInitialReflectionThread(activeTask)
        val userMsg = ConversationalMessage(role = ChatRole.USER, text = trimmed)
        val partnerReply = UndoneAccountabilityEngine.generatePartnerReply(activeTask, trimmed)
        PulseObservability.recordBreadcrumb(
            event = "conversation_message_sent",
            attributes = mapOf(
                "suggested_action" to (partnerReply.suggestedAction?.javaClass?.simpleName ?: "none")
            )
        )

        val updatedThread = baseMessages + userMsg + partnerReply
        feedbackState.value = feedbackState.value.copy(
            activeConversationTaskId = activeTask.id,
            conversationThreadsByTaskId = currentThreads + (activeTask.id to updatedThread)
        )

        viewModelScope.launch {
            repository.updateTask(
                activeTask.copy(
                    blockerNote = trimmed
                )
            )
        }
    }

    fun cycleNextStalledTask() {
        val stalled = uiState.value.stalledStatuses.map { it.task }
        if (stalled.isEmpty()) return
        val currentId = uiState.value.activeConversationTask?.id
        val currentIdx = stalled.indexOfFirst { it.id == currentId }
        val nextTask = stalled[(currentIdx + 1) % stalled.size]
        openConversationForTask(nextTask)
    }

    fun closeConversation() {
        PulseObservability.recordBreadcrumb("conversational_reflection_closed")
        feedbackState.value = feedbackState.value.copy(
            isConversationSheetOpen = false
        )
    }

    fun executeTriageAction(task: TaskItemEntity, action: TriageAction) {
        viewModelScope.launch {
            PulseObservability.recordBreadcrumb(
                event = "triage_action_executed",
                attributes = mapOf("action" to action.javaClass.simpleName, "defer_count" to task.deferCount.toString())
            )
            if (action is TriageAction.CommitToday || action is TriageAction.ShrinkTo5m) {
                val decision = ScarcityEngine.evaluatePinAction(uiState.value.todayTop3Tasks, task)
                if (decision is PinDecision.SwapRequired) {
                    feedbackState.value = feedbackState.value.copy(pendingSwapCandidate = task)
                    return@launch
                }
            }

            val updated = TriageRules.applyTriageAction(task, action)
            repository.updateTask(updated)
            feedbackState.value = feedbackState.value.copy(isConversationSheetOpen = false)
            val msg = when (action) {
                is TriageAction.CommitToday -> "Committed to Today's Top 3"
                is TriageAction.ShrinkTo5m -> "Shrunk to 5-minute starter win for today"
                is TriageAction.Reschedule -> "Rescheduled to ${action.targetDate}"
                is TriageAction.Delegate -> "Marked waiting on: ${action.waitingOn}"
                is TriageAction.ParkSomeday -> "Parked peacefully in Someday"
                is TriageAction.DropConsciously -> "Consciously dropped from commitments"
            }
            showBanner(msg)
        }
    }

    fun triageTask(task: TaskItemEntity, decision: TriageDecision) {
        viewModelScope.launch {
            repository.triageUndoneTask(task, decision)
            val msg = when (decision) {
                TriageDecision.COMMIT_TODAY -> "Committed \"${task.title.take(24)}\" to Today's Top 3."
                TriageDecision.SHRINK_TO_5M -> "Shrunk to a 5-minute starter win for today."
                TriageDecision.RESCHEDULE_TOMORROW -> "Intentionally deferred to tomorrow."
                TriageDecision.PARK_SOMEDAY -> "Let go from active pressure (moved to Someday)."
            }
            showBanner(msg)
        }
    }

    fun generatePartnerPrepChecklist(task: TaskItemEntity) {
        viewModelScope.launch {
            feedbackState.value = feedbackState.value.copy(
                generatingPrepTaskId = task.id,
                prepCoachingMessage = null
            )
            val result = partnerEngine.generatePreparationPlan(
                task = task,
                tone = uiState.value.settings.partnerTone,
                geminiApiKey = uiState.value.settings.geminiApiKey
            )
            repository.savePrepSteps(
                task = task,
                steps = result.steps,
                energy = result.suggestedEnergy
            )
            feedbackState.value = feedbackState.value.copy(
                generatingPrepTaskId = null,
                prepCoachingMessage = result.coachingNote
            )
        }
    }

    fun togglePrepStep(task: TaskItemEntity, stepId: String) {
        viewModelScope.launch {
            repository.togglePrepStep(task, stepId)
        }
    }

    fun addCustomPrepStep(task: TaskItemEntity, stepTitle: String) {
        viewModelScope.launch {
            repository.addPrepStep(task, stepTitle)
        }
    }

    fun addNewTask(
        title: String,
        notes: String,
        energy: TaskEnergyLevel,
        commitToTodayTop3: Boolean,
        dueDaysFromNow: Long?,
        linkedGoalId: String?
    ) {
        if (title.isBlank()) return
        viewModelScope.launch {
            repository.addTask(
                title = title,
                notes = notes,
                energy = energy,
                commitToTodayTop3 = commitToTodayTop3,
                dueDaysFromNow = dueDaysFromNow,
                linkedGoalId = linkedGoalId
            )
            showBanner("Added to Google Tasks")
        }
    }

    fun addWeeklyGoal(title: String, whyItMatters: String, targetCount: Int) {
        if (title.isBlank()) return
        viewModelScope.launch {
            repository.saveWeeklyGoal(title, whyItMatters, targetCount)
            showBanner("Weekly goal locked in")
        }
    }

    fun incrementGoalProgress(goal: WeeklyGoalEntity) {
        viewModelScope.launch {
            repository.incrementGoalProgress(goal)
        }
    }

    fun submitReflection(
        type: String,
        moodScore: Int,
        winHighlight: String,
        leftUndoneReflection: String,
        tomorrowPrepNote: String
    ) {
        viewModelScope.launch {
            val state = uiState.value
            repository.saveReflection(
                type = type,
                moodScore = moodScore,
                winHighlight = winHighlight,
                leftUndoneReflection = leftUndoneReflection,
                tomorrowPrepNote = tomorrowPrepNote,
                tasksCompletedCount = state.completedTasks.size,
                tasksTriagedCount = state.undoneOrForgottenTasks.size
            )
            showBanner("Reflection saved. Proud of your consistency.")
        }
    }

    fun recordGoogleSignInLauncherFailure(throwable: Throwable) {
        val diagnostic = GoogleAuthDiagnostics.classifySignInFailure(throwable)
        PulseObservability.recordBreadcrumb(
            event = "oauth_launcher_failed",
            attributes = diagnostic.telemetryAttributes
        )
        PulseObservability.recordNonFatal("GoogleSignInLauncher", throwable, diagnostic.telemetryAttributes)
        feedbackState.value = feedbackState.value.copy(
            authDiagnostic = diagnostic,
            bannerMessage = "${diagnostic.userFacingTitle}: ${diagnostic.userFacingExplanation}"
        )
    }

    fun clearAuthDiagnostic() {
        feedbackState.value = feedbackState.value.copy(authDiagnostic = null)
    }

    fun handleGoogleSignIn(
        account: GoogleSignInAccount,
        context: Context,
        onRequiresUserConsent: (android.content.Intent) -> Unit = {}
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            val email = account.email.orEmpty()
            PulseObservability.setPseudonymousUser(email)
            PulseObservability.recordBreadcrumb("oauth_signin_started")
            feedbackState.value = feedbackState.value.copy(authDiagnostic = null)
            try {
                val token = GoogleAuthUtil.getToken(
                    context,
                    account.account ?: android.accounts.Account(email, "com.google"),
                    "oauth2:https://www.googleapis.com/auth/tasks"
                )
                repository.setGoogleSession(email, token)
                if (token.isNotBlank()) {
                    val syncResult = repository.syncWithGoogleTasks()
                    syncResult.fold(
                        onSuccess = { count ->
                            PulseObservability.recordBreadcrumb("oauth_sync_success", mapOf("count" to count.toString()))
                            showBanner("Connected as $email • Synced $count tasks")
                        },
                        onFailure = { err ->
                            PulseObservability.recordNonFatal("GoogleTasksSync", err)
                            showBanner("Connected as $email • Sync pending")
                        }
                    )
                } else {
                    showBanner("Signed in as $email")
                }
            } catch (recoverable: com.google.android.gms.auth.UserRecoverableAuthException) {
                PulseObservability.recordBreadcrumb("oauth_consent_required")
                val consentIntent = recoverable.intent
                if (consentIntent != null) {
                    onRequiresUserConsent(consentIntent)
                } else {
                    showBanner("Authorization consent required. Please try again.")
                }
            } catch (ex: Exception) {
                val diagnostic = GoogleAuthDiagnostics.classifySignInFailure(ex)
                PulseObservability.recordBreadcrumb("oauth_token_fetch_failed", diagnostic.telemetryAttributes)
                PulseObservability.recordNonFatal("GoogleOAuth", ex)
                feedbackState.value = feedbackState.value.copy(
                    authDiagnostic = diagnostic,
                    bannerMessage = "${diagnostic.userFacingTitle}: ${diagnostic.userFacingExplanation}"
                )
            }
        }
    }

    fun disconnectGoogleAccount() {
        viewModelScope.launch {
            repository.signOutGoogle()
            showBanner("Disconnected Google Account")
        }
    }

    fun syncGoogleTasks() {
        viewModelScope.launch {
            PulseObservability.recordBreadcrumb("manual_sync_triggered")
            feedbackState.value = feedbackState.value.copy(isSyncing = true)
            val result = repository.syncWithGoogleTasks()
            feedbackState.value = feedbackState.value.copy(isSyncing = false)
            result.fold(
                onSuccess = { count ->
                    PulseObservability.recordBreadcrumb("manual_sync_completed", mapOf("count" to count.toString()))
                    showBanner("Synced $count tasks from Google Tasks")
                },
                onFailure = { err ->
                    PulseObservability.recordNonFatal("GoogleTasksSync", err)
                    showBanner(err.message ?: "Sync failed")
                }
            )
        }
    }

    fun updateGoogleCredentials(email: String, accessToken: String) {
        viewModelScope.launch {
            prefs.setGoogleSession(email.trim(), accessToken.trim())
            if (accessToken.isNotBlank()) {
                syncGoogleTasks()
            } else {
                showBanner("Switched to Offline / Demo mode")
            }
        }
    }

    fun updateGeminiApiKey(key: String) {
        viewModelScope.launch {
            prefs.setGeminiApiKey(key)
            showBanner(if (key.isBlank()) "Using on-device heuristic partner" else "Gemini AI Partner enabled")
        }
    }

    fun updatePartnerTone(tone: PartnerTone) {
        viewModelScope.launch {
            prefs.setPartnerTone(tone)
        }
    }

    fun updateDynamicColors(enabled: Boolean) {
        viewModelScope.launch {
            prefs.setDynamicColors(enabled)
        }
    }

    fun resetDemoData() {
        viewModelScope.launch {
            repository.seedRichSampleData()
            showBanner("Restored sample Google Tasks & Weekly Goals")
        }
    }

    fun sendTestObservabilitySignal() {
        PulseObservability.sendTestSignal()
        showBanner("Test telemetry signal dispatched to Firebase Crashlytics")
    }

    fun clearBanner() {
        feedbackState.value = feedbackState.value.copy(bannerMessage = null)
    }

    fun showBanner(message: String) {
        feedbackState.value = feedbackState.value.copy(bannerMessage = message)
    }

    companion object {
        fun provideFactory(
            repository: PulseRepository,
            prefs: UserPreferencesRepository
        ): ViewModelProvider.Factory = object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                return PulseViewModel(repository, prefs) as T
            }
        }
    }
}
