package com.stefs.googleauth

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class OkHttpGoogleTasksClient(
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build(),
    private val baseUrl: String = GoogleAuthContract.DEFAULT_BASE_URL
) : GoogleTasksProvider {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val normalizedBaseUrl = baseUrl.trimEnd('/')

    override suspend fun fetchTaskLists(accessToken: String): Result<List<GoogleTaskListDto>> =
        withContext(Dispatchers.IO) {
            runCatching {
                val request = Request.Builder()
                    .url("$normalizedBaseUrl/tasks/v1/users/@me/lists?maxResults=20")
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

    override suspend fun fetchTasksForList(
        accessToken: String,
        taskListId: String
    ): Result<List<GoogleTaskDto>> = withContext(Dispatchers.IO) {
        runCatching {
            val request = Request.Builder()
                .url("$normalizedBaseUrl/tasks/v1/lists/$taskListId/tasks?showCompleted=true&showHidden=true&maxResults=100")
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

    override suspend fun createOrUpdateTask(
        accessToken: String,
        taskListId: String,
        googleTaskId: String?,
        title: String,
        notes: String,
        isCompleted: Boolean,
        dueEpochMillis: Long?
    ): Result<GoogleTaskDto> = withContext(Dispatchers.IO) {
        runCatching {
            val dueRfc3339 = dueEpochMillis?.let(GoogleAuthContract::formatEpochToRfc3339)
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
                    .url("$normalizedBaseUrl/tasks/v1/lists/$taskListId/tasks")
                    .post(bodyString.toRequestBody(jsonMediaType))
                    .build()
            } else {
                requestBuilder
                    .url("$normalizedBaseUrl/tasks/v1/lists/$taskListId/tasks/$googleTaskId")
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
}
