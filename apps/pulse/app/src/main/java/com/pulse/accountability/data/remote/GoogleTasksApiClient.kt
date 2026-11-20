package com.pulse.accountability.data.remote

import com.stefs.googleauth.GoogleAuthContract
import com.stefs.googleauth.GoogleTasksProvider
import com.stefs.googleauth.OkHttpGoogleTasksClient
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

typealias GoogleTaskListsResponse = com.stefs.googleauth.GoogleTaskListsResponse
typealias GoogleTaskListDto = com.stefs.googleauth.GoogleTaskListDto
typealias GoogleTasksResponse = com.stefs.googleauth.GoogleTasksResponse
typealias GoogleTaskDto = com.stefs.googleauth.GoogleTaskDto
typealias GoogleTaskCreatePayload = com.stefs.googleauth.GoogleTaskCreatePayload

class GoogleTasksApiClient(
    httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build(),
    baseUrl: String = GoogleAuthContract.DEFAULT_BASE_URL,
    private val delegate: GoogleTasksProvider = OkHttpGoogleTasksClient(
        httpClient = httpClient,
        baseUrl = baseUrl
    )
) : GoogleTasksProvider by delegate {

    companion object {
        fun parseRfc3339Millis(rfcString: String?): Long? =
            GoogleAuthContract.parseRfc3339ToEpoch(rfcString)
    }
}
