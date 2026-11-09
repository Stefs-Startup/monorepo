package com.pulse.accountability.domain

import com.pulse.accountability.data.local.PartnerTone
import com.pulse.accountability.data.local.PrepStep
import com.pulse.accountability.data.local.TaskCommitmentState
import com.pulse.accountability.data.local.TaskEnergyLevel
import com.pulse.accountability.data.local.TaskItemEntity
import com.pulse.accountability.data.local.WeeklyGoalEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID
import java.util.concurrent.TimeUnit

data class PartnerBriefing(
    val headline: String,
    val message: String,
    val actionHighlight: String,
    val suggestedFocusTaskId: String? = null,
    val isAiGenerated: Boolean = false
)

@Serializable
data class PreparationPlanResult(
    val coachingNote: String,
    val suggestedEnergy: TaskEnergyLevel,
    val steps: List<PrepStep>
)

class AccountabilityPartnerEngine {

    private val json = Json { ignoreUnknownKeys = true }
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .build()

    /**
     * Generates a contextual, empathetic or candid accountability briefing based on time of day,
     * forgotten/deferred tasks, and upcoming tasks requiring preparation.
     */
    fun buildDailyBriefing(
        tasks: List<TaskItemEntity>,
        goals: List<WeeklyGoalEntity>,
        tone: PartnerTone,
        nowTime: LocalTime = LocalTime.now(),
        today: LocalDate = LocalDate.now()
    ): PartnerBriefing {
        val activeTasks = tasks.filter { !it.isCompleted && it.commitment != TaskCommitmentState.SOMEDAY_PARKED }
        val top3Today = activeTasks.filter { it.commitment == TaskCommitmentState.TODAY_TOP_3 }
        val completedTodayCount = tasks.count { it.isCompleted }
        val forgotten = activeTasks.filter { it.isUndoneOrForgotten(today) }
        val repeatDeferred = activeTasks.filter { it.deferCount >= 2 }
        val needsPrep = activeTasks.filter { it.needsPreparationSoon(today) }

        val timeGreeting = when (nowTime.hour) {
            in 5..11 -> "Morning Anchor"
            in 12..17 -> "Midday Pulse"
            else -> "Evening Reflection"
        }

        if (activeTasks.isEmpty()) {
            return PartnerBriefing(
                headline = "$timeGreeting • Clear Horizon",
                message = "Your slate is completely clear. Take a breath, review your weekly goals, or capture anything lingering on your mind.",
                actionHighlight = "Review Weekly Compass"
            )
        }

        // Priority 1: Chronic deferrals (3+ times)
        val mostDeferred = repeatDeferred.maxByOrNull { it.deferCount }
        if (mostDeferred != null && mostDeferred.deferCount >= 3) {
            val msg = when (tone) {
                PartnerTone.GENTLE_COACH ->
                    "You've carried \"${mostDeferred.title}\" across ${mostDeferred.deferCount} days. No guilt—either shrink it to a 5-minute first step today, or consciously park it."
                PartnerTone.DIRECT_PARTNER ->
                    "Reality check: \"${mostDeferred.title}\" has been postponed ${mostDeferred.deferCount} times. Let's stop carrying the mental weight—do 5 minutes now or drop it."
                PartnerTone.SOCRATIC_GUIDE ->
                    "What is the real friction behind \"${mostDeferred.title}\"? After ${mostDeferred.deferCount} deferrals, is it unclear, too large, or no longer aligned with your week?"
            }
            return PartnerBriefing(
                headline = "$timeGreeting • Unblocking Friction",
                message = msg,
                actionHighlight = "Break Down \"${mostDeferred.title.take(24)}\"",
                suggestedFocusTaskId = mostDeferred.id
            )
        }

        // Priority 2: Upcoming high-prep task
        val urgentPrep = needsPrep.minByOrNull { it.daysUntilDue(today) ?: 99L }
        if (urgentPrep != null && top3Today.size < 3) {
            val daysLeft = urgentPrep.daysUntilDue(today)
            val timingLabel = when (daysLeft) {
                0L -> "due today"
                1L -> "due tomorrow"
                null -> "on your radar"
                else -> "in $daysLeft days"
            }
            return PartnerBriefing(
                headline = "$timeGreeting • Look-Ahead Prep",
                message = "\"${urgentPrep.title}\" is $timingLabel and needs preparation before the last minute. Blocking 15 minutes now will save you stress later.",
                actionHighlight = "Prepare Steps",
                suggestedFocusTaskId = urgentPrep.id
            )
        }

        // Priority 3: Forgotten tasks sitting untouched
        if (forgotten.isNotEmpty() && nowTime.hour >= 16) {
            return PartnerBriefing(
                headline = "$timeGreeting • ${forgotten.size} Items Left Undone",
                message = "Before you wind down, ${forgotten.size} task(s) are lingering overdue or untouched. A 60-second triage will let you rest with a clean conscience.",
                actionHighlight = "Triage ${forgotten.size} Left-Undone Tasks",
                suggestedFocusTaskId = forgotten.first().id
            )
        }

        // Default: Focus on Today's Top 3
        val remainingTop = top3Today.size
        val goalReminder = goals.firstOrNull()?.let { " aligned with '${it.title}'" }.orEmpty()
        return PartnerBriefing(
            headline = "$timeGreeting • $remainingTop Committed Today",
            message = if (remainingTop > 0) {
                "You have $remainingTop intentional commitment(s) on your plate today$goalReminder. Protect your focus and ignore the rest until these are done."
            } else {
                "You haven't locked in your Top 3 commitments for today yet ($completedTodayCount completed so far). Pick 1 to 3 realistic wins."
            },
            actionHighlight = if (remainingTop > 0) "Focus on Top Commitment" else "Pick Today's Top 3",
            suggestedFocusTaskId = top3Today.firstOrNull()?.id ?: activeTasks.firstOrNull()?.id
        )
    }

    /**
     * Generates a concrete preparation & micro-step plan for a task that is either daunting,
     * requires advance preparation, or has been repeatedly left undone.
     * Uses Gemini 2.5 Flash if an API key is configured; otherwise uses a rich domain-aware
     * heuristic generator so the app works 100% offline/out-of-the-box.
     */
    suspend fun generatePreparationPlan(
        task: TaskItemEntity,
        tone: PartnerTone,
        geminiApiKey: String
    ): PreparationPlanResult = withContext(Dispatchers.IO) {
        if (geminiApiKey.isNotBlank()) {
            val aiResult = runCatching {
                callGeminiForPrepPlan(task, tone, geminiApiKey)
            }.getOrNull()
            if (aiResult != null) return@withContext aiResult
        }

        buildHeuristicPrepPlan(task, tone)
    }

    fun buildHeuristicPrepPlan(
        task: TaskItemEntity,
        tone: PartnerTone
    ): PreparationPlanResult {
        val lower = (task.title + " " + task.notes).lowercase()

        val steps: List<String>
        val energy: TaskEnergyLevel

        when {
            lower.contains("present") || lower.contains("deck") || lower.contains("pitch") || lower.contains("review") || lower.contains("meeting") -> {
                energy = TaskEnergyLevel.DEEP_WORK
                steps = listOf(
                    "Write a 3-bullet outcome: what decision or takeaway must happen?",
                    "Gather the key metrics, links, or status updates in one scratch note",
                    "Draft the headline skeleton before polishing any slides or formatting",
                    "Send a quick pre-read or agenda 24h ahead so nothing surprises stakeholders"
                )
            }
            lower.contains("tax") || lower.contains("budget") || lower.contains("invoice") || lower.contains("finance") || lower.contains("reimburse") -> {
                energy = TaskEnergyLevel.FOCUSED
                steps = listOf(
                    "Open a single folder and collect all receipts/statements in one place",
                    "Set a 15-minute timer just to categorize and flag missing documents",
                    "Submit or log the completed numbers and set a calendar confirmation"
                )
            }
            lower.contains("call") || lower.contains("email") || lower.contains("reply") || lower.contains("follow up") || lower.contains("schedule") -> {
                energy = TaskEnergyLevel.QUICK_WIN
                steps = listOf(
                    "Jot down the 2 key questions or dates you need to propose",
                    "Draft a concise 3-sentence message without overthinking the wording",
                    "Send now and log any waiting-on follow-up date"
                )
            }
            lower.contains("plan") || lower.contains("trip") || lower.contains("offsite") || lower.contains("prepare") -> {
                energy = TaskEnergyLevel.DEEP_WORK
                steps = listOf(
                    "List the hard constraints (dates, budget, people, must-haves)",
                    "Lock in the single most time-sensitive booking or dependency first",
                    "Create a packing/readiness checklist 48 hours before departure"
                )
            }
            else -> {
                energy = if (task.deferCount >= 2) TaskEnergyLevel.FOCUSED else task.energy
                steps = listOf(
                    "Define 'Done in 1 sentence': what does finished actually look like?",
                    "Clear the workspace and do a 5-minute ugly first draft or setup step",
                    "Complete the core action during a single 25-minute focus block",
                    "Close the loop and check it off in Google Tasks"
                )
            }
        }

        val coachingNote = when {
            task.deferCount >= 2 -> when (tone) {
                PartnerTone.GENTLE_COACH -> "Since this has been put off ${task.deferCount} times, only commit to Step 1 today. Momentum beats perfection."
                PartnerTone.DIRECT_PARTNER -> "Deferred ${task.deferCount} times. Stop treating this as one giant project—execute Step 1 in the next 5 minutes."
                PartnerTone.SOCRATIC_GUIDE -> "Notice which of these steps feels heaviest—that's the real blocker we're removing right now."
            }
            else -> "Prepared into ${steps.size} concrete steps so you don't have to figure out how to start when you're tired."
        }

        return PreparationPlanResult(
            coachingNote = coachingNote,
            suggestedEnergy = energy,
            steps = steps.map { PrepStep(id = UUID.randomUUID().toString(), title = it, isDone = false) }
        )
    }

    private fun callGeminiForPrepPlan(
        task: TaskItemEntity,
        tone: PartnerTone,
        apiKey: String
    ): PreparationPlanResult {
        val prompt = """
            You are an empathetic, razor-sharp accountability partner for Google Tasks.
            Tone preference: ${tone.title} (${tone.subtitle}).
            Task Title: "${task.title}"
            Task Notes: "${task.notes}"
            Times Deferred: ${task.deferCount}
            
            Respond ONLY with valid JSON matching this schema:
            {
              "coachingNote": "1 concise sentence (max 28 words) helping the user overcome inertia or prepare ahead.",
              "energy": "QUICK_WIN" | "FOCUSED" | "DEEP_WORK",
              "steps": ["step 1 (5-minute starter)", "step 2", "step 3", "step 4"]
            }
        """.trimIndent()

        val requestPayload = buildJsonObject {
            put("contents", buildJsonArray {
                add(buildJsonObject {
                    put("parts", buildJsonArray {
                        add(buildJsonObject { put("text", prompt) })
                    })
                })
            })
            put("generationConfig", buildJsonObject {
                put("responseMimeType", "application/json")
            })
        }

        val request = Request.Builder()
            .url("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$apiKey")
            .post(requestPayload.toString().toRequestBody("application/json".toMediaType()))
            .build()

        httpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IllegalStateException("Gemini HTTP ${response.code}")
            val bodyStr = response.body?.string().orEmpty()
            val root = json.parseToJsonElement(bodyStr).jsonObject
            val text = root["candidates"]?.jsonArray?.firstOrNull()
                ?.jsonObject?.get("content")?.jsonObject
                ?.get("parts")?.jsonArray?.firstOrNull()
                ?.jsonObject?.get("text")?.jsonPrimitive?.content
                ?: throw IllegalStateException("Empty Gemini response")

            val parsed = json.parseToJsonElement(text).jsonObject
            val note = parsed["coachingNote"]?.jsonPrimitive?.content ?: "Let's start with a tiny 5-minute step."
            val energyStr = parsed["energy"]?.jsonPrimitive?.content ?: "FOCUSED"
            val energy = runCatching { TaskEnergyLevel.valueOf(energyStr) }.getOrDefault(TaskEnergyLevel.FOCUSED)
            val stepsArr = parsed["steps"]?.jsonArray ?: JsonArray(emptyList())
            val steps = stepsArr.mapNotNull { el ->
                val title = el.jsonPrimitive.content.trim()
                if (title.isNotBlank()) PrepStep(UUID.randomUUID().toString(), title, false) else null
            }.ifEmpty {
                buildHeuristicPrepPlan(task, tone).steps
            }

            return PreparationPlanResult(
                coachingNote = note,
                suggestedEnergy = energy,
                steps = steps
            )
        }
    }
}
