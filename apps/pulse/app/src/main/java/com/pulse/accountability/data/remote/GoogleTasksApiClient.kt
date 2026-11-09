package com.pulse.accountability.data.remote

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

@Serializable
data class GoogleTaskListsResponse(
    val items: List<GoogleTaskListDto> = emptyList()
)

@Serializable
data class GoogleTaskListDto(
    val id: String,
    val title: String
)

@Serializable
data class GoogleTasksResponse(
    val items: List<GoogleTaskDto> = emptyList()
)

@Serializable
data class GoogleTaskDto(
    val id: String? = null,
    val title: String = "",
    val notes: String? = null,
    val status: String = "needsAction", // "needsAction" or "completed"
    val due: String? = null, // RFC 3339 timestamp
    val completed: String? = null,
    val updated: String? = null
)

@Serializable
data class GoogleTaskCreatePayload(
    val title: String,
    val notes: String? = null,
    val status: String = "needsAction",
    val due: String? = null
)

class GoogleTasksApiClient(
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build(),
    private val baseUrl: String = "https://tasks.googleapis.com"
) {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun fetchTaskLists(accessToken: String): Result<List<GoogleTaskListDto>> = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder()
                .url("$baseUrl/tasks/v1/users/@me/lists?maxResults=20")
                .addHeader("Authorization", "Bearer $accessToken")
                .get()
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    throw IllegalStateException("Google Tasks API HTTP ${response.code}: ${response.message}")
                }
                val bodyStr = response.body?.string().orEmpty()
                json.decodeFromString<GoogleTaskListsResponse>(bodyStr).items
            }
        }
    }

    suspend fun fetchTasksForList(
        accessToken: String,
        taskListId: String = "@default"
    ): Result<List<GoogleTaskDto>> = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder()
                .url("$baseUrl/tasks/v1/lists/$taskListId/tasks?showCompleted=true&showHidden=true&maxResults=100")
                .addHeader("Authorization", "Bearer $accessToken")
                .get()
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    throw IllegalStateException("Google Tasks API HTTP ${response.code}: ${response.message}")
                }
                val bodyStr = response.body?.string().orEmpty()
                json.decodeFromString<GoogleTasksResponse>(bodyStr).items
            }
        }
    }

    suspend fun createOrUpdateTask(
        accessToken: String,
        taskListId: String = "@default",
        googleTaskId: String? = null,
        title: String,
        notes: String,
        isCompleted: Boolean,
        dueEpochMillis: Long?
    ): Result<GoogleTaskDto> = withContext(Dispatchers.IO) {
        runCatching {
            val dueRfc3339 = dueEpochMillis?.let {
                Instant.ofEpochMilli(it).atOffset(ZoneOffset.UTC).format(DateTimeFormatter.ISO_INSTANT)
            }
            val payload = GoogleTaskCreatePayload(
                title = title,
                notes = notes.ifBlank { null },
                status = if (isCompleted) "completed" else "needsAction",
                due = dueRfc3339
            )
            val bodyString = json.encodeToString(GoogleTaskCreatePayload.serializer(), payload)

            val requestBuilder = Request.Builder()
                .addHeader("Authorization", "Bearer $accessToken")

            val request = if (googleTaskId.isNullOrBlank()) {
                requestBuilder
                    .url("https://tasks.googleapis.com/tasks/v1/lists/$taskListId/tasks")
                    .post(bodyString.toRequestBody(jsonMediaType))
                    .build()
            } else {
                requestBuilder
                    .url("https://tasks.googleapis.com/tasks/v1/lists/$taskListId/tasks/$googleTaskId")
                    .patch(bodyString.toRequestBody(jsonMediaType))
                    .build()
            }

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    throw IllegalStateException("Google Tasks Sync failed (${response.code})")
                }
                val bodyStr = response.body?.string().orEmpty()
                json.decodeFromString<GoogleTaskDto>(bodyStr)
            }
        }
    }

    companion object {
        fun parseRfc3339Millis(rfcString: String?): Long? {
            if (rfcString.isNullOrBlank()) return null
            return runCatching {
                Instant.parse(rfcString).toEpochMilli()
            }.getOrNull()
        }
    }
}
