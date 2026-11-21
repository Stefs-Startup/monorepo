package com.stefs.googleauth

import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FakeGoogleTasksProviderTest {

    @Test
    fun `fetches lists and tasks and creates or updates tasks deterministically`() = runTest {
        val nowMs = 1_762_992_000_000L
        val oauth = FakeGoogleOAuthProvider(nowEpochMillis = nowMs)
        val session = oauth.signIn("alex.rivera@example.com").getOrThrow()
        val provider = FakeGoogleTasksProvider(nowEpochMillis = nowMs)

        val lists = provider.fetchTaskLists(session.accessToken).getOrThrow()
        assertEquals(2, lists.size)
        assertEquals("@default", lists[0].id)

        val initialTasks = provider.fetchTasksForList(session.accessToken, "@default").getOrThrow()
        assertEquals(2, initialTasks.size)

        val created = provider.createOrUpdateTask(
            accessToken = session.accessToken,
            taskListId = "@default",
            googleTaskId = null,
            title = "Write STE-36 contract test",
            notes = "Zero real Google credentials",
            isCompleted = false,
            dueEpochMillis = nowMs + 86_400_000L
        ).getOrThrow()
        assertEquals("gtask-3", created.id)
        assertEquals("needsAction", created.status)

        val updated = provider.createOrUpdateTask(
            accessToken = session.accessToken,
            taskListId = "@default",
            googleTaskId = "gtask-3",
            title = "Write STE-36 contract test",
            notes = "Completed",
            isCompleted = true,
            dueEpochMillis = null
        ).getOrThrow()
        assertEquals("completed", updated.status)

        val expiredResult = provider.fetchTasksForList("expired-token", "@default")
        assertTrue(expiredResult.isFailure)
        assertTrue(expiredResult.exceptionOrNull()?.message?.contains("401") == true)

        val scopeResult = provider.fetchTasksForList("scope-insufficient-token", "@default")
        assertTrue(scopeResult.isFailure)
        assertTrue(scopeResult.exceptionOrNull()?.message?.contains("403") == true)
    }
}
