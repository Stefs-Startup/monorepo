package com.pulse.accountability.data.remote

import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class GoogleTasksSyncContractTest {

    private lateinit var mockServer: MockWebServer
    private lateinit var client: GoogleTasksApiClient

    @Before
    fun setUp() {
        mockServer = MockWebServer()
        mockServer.start()
        val baseUrl = mockServer.url("/").toString().removeSuffix("/")
        client = GoogleTasksApiClient(baseUrl = baseUrl)
    }

    @After
    fun tearDown() {
        mockServer.shutdown()
    }

    @Test
    fun `fetchTaskLists returns parsed items on 200 OK`() = runTest {
        val jsonPayload = """
            {
              "items": [
                { "id": "list-1", "title": "Work Tasks" },
                { "id": "list-2", "title": "Personal" }
              ]
            }
        """.trimIndent()

        mockServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(jsonPayload)
        )

        val result = client.fetchTaskLists("mock-valid-token")
        assertTrue(result.isSuccess)
        val lists = result.getOrThrow()
        assertEquals(2, lists.size)
        assertEquals("list-1", lists[0].id)
        assertEquals("Work Tasks", lists[0].title)

        val recordedRequest = mockServer.takeRequest()
        assertEquals("Bearer mock-valid-token", recordedRequest.getHeader("Authorization"))
        assertEquals("/tasks/v1/users/@me/lists?maxResults=20", recordedRequest.path)
    }

    @Test
    fun `fetchTasksForList failure triggers Result failure on 401 Unauthorized`() = runTest {
        mockServer.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setHeader("Content-Type", "application/json")
                .setBody("""{ "error": { "code": 401, "message": "Invalid Credentials" } }""")
        )

        val result = client.fetchTasksForList("expired-token", "@default")
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("401") == true)
    }

    @Test
    fun `fetchTasksForList failure triggers Result failure on 403 Insufficient Scope`() = runTest {
        mockServer.enqueue(
            MockResponse()
                .setResponseCode(403)
                .setHeader("Content-Type", "application/json")
                .setBody("""{ "error": { "code": 403, "message": "ACCESS_TOKEN_SCOPE_INSUFFICIENT" } }""")
        )

        val result = client.fetchTasksForList("scope-insufficient-token", "@default")
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("403") == true)
    }
}
