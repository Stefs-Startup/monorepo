package com.pulse.accountability.data.repository

import com.pulse.accountability.data.local.PrepStep
import com.pulse.accountability.data.local.PulseDao
import com.pulse.accountability.data.local.ReflectionEntryEntity
import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskEnergyLevel
import com.pulse.accountability.data.local.TaskItemEntity
import com.pulse.accountability.data.local.UserPreferencesRepository
import com.pulse.accountability.data.local.WeeklyGoalEntity
import com.pulse.accountability.data.remote.GoogleTasksApiClient
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters
import java.util.UUID

class PulseRepository(
    private val dao: PulseDao,
    private val prefs: UserPreferencesRepository,
    private val googleClient: GoogleTasksApiClient = GoogleTasksApiClient()
) {
    private val json = Json { ignoreUnknownKeys = true }

    val tasksFlow: Flow<List<TaskItemEntity>> = dao.observeAllTasks()
    val goalsFlow: Flow<List<WeeklyGoalEntity>> = dao.observeActiveGoals()
    val reflectionsFlow: Flow<List<ReflectionEntryEntity>> = dao.observeReflections()
    val settingsFlow = prefs.settingsFlow

    fun decodePrepSteps(rawJson: String): List<PrepStep> {
        if (rawJson.isBlank() || rawJson == "[]") return emptyList()
        return runCatching { json.decodeFromString<List<PrepStep>>(rawJson) }.getOrDefault(emptyList())
    }

    fun encodePrepSteps(steps: List<PrepStep>): String = json.encodeToString(steps)

    suspend fun ensureDemoSeededIfEmpty() {
        val alreadySeeded = prefs.hasSeededDemoFlow.first()
        val currentTasks = dao.getAllTasksOnce()
        if (!alreadySeeded && currentTasks.isEmpty()) {
            seedRichSampleData()
            prefs.markDemoSeeded()
        }
    }

    suspend fun seedRichSampleData() {
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now()
        val mondayThisWeek = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString()

        fun daysOffsetMillis(days: Long): Long =
            today.plusDays(days).atStartOfDay(zone).toInstant().toEpochMilli()

        val goal1Id = "goal-q4-product"
        val goal2Id = "goal-health-rhythm"
        val goal3Id = "goal-life-admin"

        dao.upsertGoal(
            WeeklyGoalEntity(
                id = goal1Id,
                weekStartIsoDate = mondayThisWeek,
                title = "Ship Q4 Roadmap & Architecture Review",
                whyItMatters = "Unblocks engineering team before November sprint",
                targetCount = 4,
                completedCount = 2
            )
        )
        dao.upsertGoal(
            WeeklyGoalEntity(
                id = goal2Id,
                weekStartIsoDate = mondayThisWeek,
                title = "Clear Financial & Life Admin Backlog",
                whyItMatters = "Stop carrying nagging open loops into the weekend",
                targetCount = 3,
                completedCount = 1
            )
        )
        dao.upsertGoal(
            WeeklyGoalEntity(
                id = goal3Id,
                weekStartIsoDate = mondayThisWeek,
                title = "Protect Evening Shutdown & Sleep Rhythm",
                whyItMatters = "Better energy for deep work mornings",
                targetCount = 5,
                completedCount = 3
            )
        )

        val now = System.currentTimeMillis()
        val dayMs = 24 * 60 * 60 * 1000L

        val sampleTasks = listOf(
            // 1. Committed Today Top 3
            TaskItemEntity(
                id = "task-1",
                taskListTitle = "Work & Strategy",
                title = "Finalize Q4 system architecture slide deck",
                notes = "Focus on latency guardrails and rollout milestones for Tuesday's review",
                isCompleted = false,
                dueEpochMillis = daysOffsetMillis(0),
                updatedEpochMillis = now - (1 * dayMs),
                deferCount = 1,
                commitmentState = TaskCommitmentState.TODAY_TOP_3.name,
                energyLevel = TaskEnergyLevel.DEEP_WORK.name,
                prepChecklistJson = encodePrepSteps(
                    listOf(
                        PrepStep("p1", "Write 3-bullet executive takeaway on Slide 1", true),
                        PrepStep("p2", "Insert p95 latency benchmark chart", false),
                        PrepStep("p3", "Share pre-read link in #eng-leads channel", false)
                    )
                ),
                linkedGoalId = goal1Id
            ),
            TaskItemEntity(
                id = "task-2",
                taskListTitle = "Personal Admin",
                title = "Submit dental & vision insurance reimbursement claim",
                notes = "Receipt PDF is in Downloads folder from last week",
                isCompleted = false,
                dueEpochMillis = daysOffsetMillis(-2), // 2 days overdue!
                updatedEpochMillis = now - (4 * dayMs),
                deferCount = 3, // Chronic deferral -> triggers partner coaching!
                commitmentState = TaskCommitmentState.TODAY_TOP_3.name,
                energyLevel = TaskEnergyLevel.QUICK_WIN.name,
                blockerNote = "Kept forgetting to log into portal during work hours",
                linkedGoalId = goal2Id
            ),
            // 2. Left Undone / Forgotten / Ghosted Tasks
            TaskItemEntity(
                id = "task-3",
                taskListTitle = "Personal Admin",
                title = "Schedule annual bloodwork & physical checkup",
                notes = "Call Dr. Patel's office before morning slots fill up",
                isCompleted = false,
                dueEpochMillis = daysOffsetMillis(-4),
                updatedEpochMillis = now - (8 * dayMs),
                deferCount = 4,
                commitmentState = TaskCommitmentState.NORMAL.name,
                energyLevel = TaskEnergyLevel.QUICK_WIN.name,
                linkedGoalId = goal3Id
            ),
            TaskItemEntity(
                id = "task-4",
                taskListTitle = "Work & Strategy",
                title = "Follow up with design partner on mobile onboarding prototype",
                notes = "Check if Figma tokens for expressive motion are ready",
                isCompleted = false,
                dueEpochMillis = null, // No due date, sitting untouched for 7 days
                updatedEpochMillis = now - (7 * dayMs),
                deferCount = 2,
                commitmentState = TaskCommitmentState.NORMAL.name,
                energyLevel = TaskEnergyLevel.QUICK_WIN.name,
                linkedGoalId = goal1Id
            ),
            // 3. Upcoming tasks that need advance preparation
            TaskItemEntity(
                id = "task-5",
                taskListTitle = "Work & Strategy",
                title = "Prepare 1-on-1 performance growth review with Maya",
                notes = "Need peer feedback summary and Q1 promotion rubric ready ahead of time",
                isCompleted = false,
                dueEpochMillis = daysOffsetMillis(2), // Due in 2 days
                updatedEpochMillis = now - (1 * dayMs),
                deferCount = 0,
                commitmentState = TaskCommitmentState.NORMAL.name,
                energyLevel = TaskEnergyLevel.DEEP_WORK.name,
                prepChecklistJson = encodePrepSteps(
                    listOf(
                        PrepStep("p4", "Gather 3 concrete project wins from last quarter", false),
                        PrepStep("p5", "Draft growth areas and career next-step questions", false)
                    )
                ),
                linkedGoalId = goal1Id
            ),
            TaskItemEntity(
                id = "task-6",
                taskListTitle = "Life & Home",
                title = "Prep weekend cabin trip itinerary & winter gear check",
                notes = "Check tire pressure, download offline maps, confirm check-in code",
                isCompleted = false,
                dueEpochMillis = daysOffsetMillis(3),
                updatedEpochMillis = now,
                deferCount = 0,
                commitmentState = TaskCommitmentState.NORMAL.name,
                energyLevel = TaskEnergyLevel.FOCUSED.name,
                linkedGoalId = goal3Id
            ),
            // 4. Already Completed today for momentum
            TaskItemEntity(
                id = "task-7",
                taskListTitle = "Work & Strategy",
                title = "Review PR #418 for Google Tasks OAuth token refresh",
                notes = "Approved with minor nit on retry backoff",
                isCompleted = true,
                dueEpochMillis = daysOffsetMillis(0),
                completedEpochMillis = now - (2 * 60 * 60 * 1000L),
                updatedEpochMillis = now - (2 * 60 * 60 * 1000L),
                commitmentState = TaskCommitmentState.TODAY_TOP_3.name,
                energyLevel = TaskEnergyLevel.FOCUSED.name,
                linkedGoalId = goal1Id
            )
        )

        dao.upsertTasks(sampleTasks)

        dao.insertReflection(
            ReflectionEntryEntity(
                id = "refl-sample-1",
                dateIso = today.minusDays(1).toString(),
                type = "EVENING_SHUTDOWN",
                moodScore = 4,
                winHighlight = "Locked in the database schema and cleared 3 lingering inbox tasks.",
                leftUndoneReflection = "Deferred the insurance claim again because I didn't have the PDF handy.",
                tomorrowPrepNote = "Start morning with 15m on the architecture deck before opening Slack.",
                tasksCompletedCount = 4,
                tasksTriagedCount = 2,
                createdAtMillis = now - dayMs
            )
        )
    }

    suspend fun addTask(
        title: String,
        notes: String,
        energy: TaskEnergyLevel,
        commitToTodayTop3: Boolean,
        dueDaysFromNow: Long? = 0L,
        linkedGoalId: String? = null
    ) {
        val zone = ZoneId.systemDefault()
        val dueMillis = dueDaysFromNow?.let {
            LocalDate.now().plusDays(it).atStartOfDay(zone).toInstant().toEpochMilli()
        }
        val entity = TaskItemEntity(
            id = UUID.randomUUID().toString(),
            title = title.trim(),
            notes = notes.trim(),
            dueEpochMillis = dueMillis,
            commitmentState = if (commitToTodayTop3) TaskCommitmentState.TODAY_TOP_3.name else TaskCommitmentState.NORMAL.name,
            energyLevel = energy.name,
            linkedGoalId = linkedGoalId,
            dirtySync = true
        )
        dao.upsertTask(entity)
        pushTaskToGoogleIfConnected(entity)
    }

    suspend fun updateTask(task: TaskItemEntity) {
        dao.upsertTask(task)
        pushTaskToGoogleIfConnected(task)
    }

    suspend fun toggleTaskCompleted(task: TaskItemEntity) {
        val newCompleted = !task.isCompleted
        val updated = task.copy(
            isCompleted = newCompleted,
            completedEpochMillis = if (newCompleted) System.currentTimeMillis() else null,
            updatedEpochMillis = System.currentTimeMillis(),
            dirtySync = true
        )
        dao.upsertTask(updated)
        pushTaskToGoogleIfConnected(updated)
    }

    suspend fun toggleTodayTop3Commitment(task: TaskItemEntity) {
        val nextState = if (task.commitment == TaskCommitmentState.TODAY_TOP_3) {
            TaskCommitmentState.NORMAL
        } else {
            TaskCommitmentState.TODAY_TOP_3
        }
        val zone = ZoneId.systemDefault()
        val todayMillis = LocalDate.now().atStartOfDay(zone).toInstant().toEpochMilli()
        val updated = task.copy(
            commitmentState = nextState.name,
            dueEpochMillis = if (nextState == TaskCommitmentState.TODAY_TOP_3 && (task.dueEpochMillis == null || task.daysOverdue() > 0)) {
                todayMillis
            } else {
                task.dueEpochMillis
            },
            updatedEpochMillis = System.currentTimeMillis()
        )
        dao.upsertTask(updated)
    }

    /**
     * Triage action for "Left Undone / Forgotten" tasks:
     * - DO_TODAY: Commits to Today's Top 3 and sets due date to today
     * - DEFER_INTENTIONALLY: Schedules for tomorrow or next week and increments deferCount with honesty
     * - SHRINK_5M: Converts to a 5m Quick Win for today
     * - LET_GO: Parks in Someday / Archive so it stops causing low-grade guilt
     */
    suspend fun triageUndoneTask(
        task: TaskItemEntity,
        decision: TriageDecision
    ) {
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now()
        val now = System.currentTimeMillis()

        val updated = when (decision) {
            TriageDecision.COMMIT_TODAY -> task.copy(
                commitmentState = TaskCommitmentState.TODAY_TOP_3.name,
                dueEpochMillis = today.atStartOfDay(zone).toInstant().toEpochMilli(),
                updatedEpochMillis = now,
                dirtySync = true
            )
            TriageDecision.SHRINK_TO_5M -> task.copy(
                title = if (task.title.startsWith("5m starter:")) task.title else "5m starter: ${task.title}",
                energyLevel = TaskEnergyLevel.QUICK_WIN.name,
                commitmentState = TaskCommitmentState.TODAY_TOP_3.name,
                dueEpochMillis = today.atStartOfDay(zone).toInstant().toEpochMilli(),
                updatedEpochMillis = now,
                dirtySync = true
            )
            TriageDecision.RESCHEDULE_TOMORROW -> task.copy(
                deferCount = task.deferCount + 1,
                commitmentState = TaskCommitmentState.DEFERRED_INTENTIONALLY.name,
                dueEpochMillis = today.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli(),
                updatedEpochMillis = now,
                dirtySync = true
            )
            TriageDecision.PARK_SOMEDAY -> task.copy(
                commitmentState = TaskCommitmentState.SOMEDAY_PARKED.name,
                dueEpochMillis = null,
                updatedEpochMillis = now,
                dirtySync = true
            )
        }
        dao.upsertTask(updated)
        pushTaskToGoogleIfConnected(updated)
    }

    suspend fun savePrepSteps(
        task: TaskItemEntity,
        steps: List<PrepStep>,
        energy: TaskEnergyLevel? = null
    ) {
        val updated = task.copy(
            prepChecklistJson = encodePrepSteps(steps),
            energyLevel = energy?.name ?: task.energyLevel,
            updatedEpochMillis = System.currentTimeMillis()
        )
        dao.upsertTask(updated)
    }

    suspend fun togglePrepStep(task: TaskItemEntity, stepId: String) {
        val current = decodePrepSteps(task.prepChecklistJson)
        val next = current.map { if (it.id == stepId) it.copy(isDone = !it.isDone) else it }
        savePrepSteps(task, next)
    }

    suspend fun addPrepStep(task: TaskItemEntity, stepTitle: String) {
        if (stepTitle.isBlank()) return
        val current = decodePrepSteps(task.prepChecklistJson)
        val next = current + PrepStep(id = UUID.randomUUID().toString(), title = stepTitle.trim(), isDone = false)
        savePrepSteps(task, next)
    }

    suspend fun saveWeeklyGoal(title: String, whyItMatters: String, targetCount: Int) {
        val monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString()
        dao.upsertGoal(
            WeeklyGoalEntity(
                id = UUID.randomUUID().toString(),
                weekStartIsoDate = monday,
                title = title.trim(),
                whyItMatters = whyItMatters.trim(),
                targetCount = targetCount.coerceIn(1, 10),
                completedCount = 0
            )
        )
    }

    suspend fun incrementGoalProgress(goal: WeeklyGoalEntity) {
        val nextCount = if (goal.completedCount >= goal.targetCount) 0 else goal.completedCount + 1
        dao.upsertGoal(goal.copy(completedCount = nextCount))
    }

    suspend fun saveReflection(
        type: String,
        moodScore: Int,
        winHighlight: String,
        leftUndoneReflection: String,
        tomorrowPrepNote: String,
        tasksCompletedCount: Int,
        tasksTriagedCount: Int
    ) {
        dao.insertReflection(
            ReflectionEntryEntity(
                id = UUID.randomUUID().toString(),
                dateIso = LocalDate.now().toString(),
                type = type,
                moodScore = moodScore,
                winHighlight = winHighlight.trim(),
                leftUndoneReflection = leftUndoneReflection.trim(),
                tomorrowPrepNote = tomorrowPrepNote.trim(),
                tasksCompletedCount = tasksCompletedCount,
                tasksTriagedCount = tasksTriagedCount
            )
        )
    }

    suspend fun setGoogleSession(email: String, accessToken: String) {
        prefs.setGoogleSession(email, accessToken)
    }

    suspend fun signOutGoogle() {
        prefs.setGoogleSession("", "")
    }

    /**
     * Two-way sync with Google Tasks REST API v1 when an OAuth access token is configured.
     */
    suspend fun syncWithGoogleTasks(): Result<Int> {
        val settings = prefs.settingsFlow.first()
        if (settings.googleAccessToken.isBlank()) {
            return Result.failure(IllegalStateException("No Google Tasks access token configured. Running in local/demo mode."))
        }

        return runCatching {
            val lists = googleClient.fetchTaskLists(settings.googleAccessToken).getOrThrow()
            var syncedCount = 0

            val targetLists = if (lists.isEmpty()) {
                listOf(com.pulse.accountability.data.remote.GoogleTaskListDto("@default", "My Tasks"))
            } else {
                lists.take(5)
            }

            for (taskList in targetLists) {
                val remoteTasks = googleClient.fetchTasksForList(settings.googleAccessToken, taskList.id).getOrDefault(emptyList())
                for (remote in remoteTasks) {
                    val gId = remote.id ?: continue
                    if (remote.title.isBlank()) continue
                    val existing = dao.getTaskByGoogleId(gId)
                    val dueMillis = GoogleTasksApiClient.parseRfc3339Millis(remote.due)
                    val updatedMillis = GoogleTasksApiClient.parseRfc3339Millis(remote.updated) ?: System.currentTimeMillis()
                    val isDone = remote.status == "completed"

                    val merged = if (existing != null) {
                        existing.copy(
                            title = remote.title,
                            notes = remote.notes ?: existing.notes,
                            isCompleted = isDone,
                            dueEpochMillis = dueMillis ?: existing.dueEpochMillis,
                            taskListId = taskList.id,
                            taskListTitle = taskList.title,
                            updatedEpochMillis = updatedMillis,
                            dirtySync = false
                        )
                    } else {
                        TaskItemEntity(
                            id = "gtask-$gId",
                            googleTaskId = gId,
                            taskListId = taskList.id,
                            taskListTitle = taskList.title,
                            title = remote.title,
                            notes = remote.notes.orEmpty(),
                            isCompleted = isDone,
                            dueEpochMillis = dueMillis,
                            updatedEpochMillis = updatedMillis,
                            dirtySync = false
                        )
                    }
                    dao.upsertTask(merged)
                    syncedCount++
                }
            }
            prefs.updateLastSynced()
            syncedCount
        }
    }

    private suspend fun pushTaskToGoogleIfConnected(task: TaskItemEntity) {
        val settings = prefs.settingsFlow.first()
        if (settings.googleAccessToken.isBlank()) return

        googleClient.createOrUpdateTask(
            accessToken = settings.googleAccessToken,
            taskListId = task.taskListId,
            googleTaskId = task.googleTaskId,
            title = task.title,
            notes = task.notes,
            isCompleted = task.isCompleted,
            dueEpochMillis = task.dueEpochMillis
        ).onSuccess { remoteDto ->
            if (remoteDto.id != null) {
                dao.upsertTask(task.copy(googleTaskId = remoteDto.id, dirtySync = false))
            }
        }
    }
}

enum class TriageDecision {
    COMMIT_TODAY,
    SHRINK_TO_5M,
    RESCHEDULE_TOMORROW,
    PARK_SOMEDAY
}
