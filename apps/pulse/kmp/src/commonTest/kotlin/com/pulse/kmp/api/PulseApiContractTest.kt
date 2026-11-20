package com.pulse.kmp.api

import com.pulse.kmp.api.generated.SwapTop3Request
import com.pulse.kmp.api.generated.TriageActionCode
import com.pulse.kmp.api.generated.TriageRequest
import com.pulse.kmp.domain.AccountabilityCategory
import com.pulse.kmp.domain.TaskVisualAnalyticsEngine
import kotlinx.datetime.LocalDate
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import com.pulse.kmp.api.generated.AccountabilityCategory as WireAccountabilityCategory
import com.pulse.kmp.api.generated.TaskCommitmentState as WireCommitmentState

class PulseApiContractTest {

    private val goldenDashboardJson = """
        {
          "horizon": {
            "windows": [
              {
                "windowType": "HABITUALLY_UNDONE",
                "title": "Habitually Undone",
                "shortTabTitle": "Habitual (1)",
                "subtitle": "Sorted descending by deferral count",
                "headlineStat": "Max 5×",
                "emptyStateTitle": "Zero Habitually Deferred Tasks",
                "emptyStateBody": "No tasks have slipped 2 or more times. Switch windows to inspect Long-Standing Drift or Active Flow.",
                "items": [
                  {
                    "taskId": "task-tax-receipts",
                    "title": "Consolidate Q3 expense receipts & CPA export",
                    "shortLabel": "Consolidate Q3 expense rece…",
                    "primaryMetricLabel": "5× deferred",
                    "secondaryMetricLabel": "14d span",
                    "intensityFraction": 1.0,
                    "category": "HABITUALLY_DEFERRED",
                    "deferCount": 5,
                    "daysOld": 14,
                    "daysUntouched": 6,
                    "daysOverdue": 4,
                    "sortScore": 5014
                  }
                ]
              },
              {
                "windowType": "LONG_STANDING_DRIFT",
                "title": "Long-Standing Drift",
                "shortTabTitle": "Drifting (1)",
                "subtitle": "Sorted descending by days untouched or overdue",
                "headlineStat": "12d oldest",
                "emptyStateTitle": "Zero Long-Standing Drift",
                "emptyStateBody": "Nothing is sitting untouched for 5+ days without a commitment. Switch windows to view Habitual or Active Flow.",
                "items": [
                  {
                    "taskId": "task-garage-shelf",
                    "title": "Clear garage workbench and donate spare cables",
                    "shortLabel": "Clear garage workbench and…",
                    "primaryMetricLabel": "12d idle",
                    "secondaryMetricLabel": "1× slip",
                    "intensityFraction": 1.0,
                    "category": "LONG_STANDING_GHOSTED",
                    "deferCount": 1,
                    "daysOld": 12,
                    "daysUntouched": 9,
                    "daysOverdue": 0,
                    "sortScore": 12001
                  }
                ]
              },
              {
                "windowType": "ACTIVE_FLOW",
                "title": "Committed & Active Flow",
                "shortTabTitle": "Active (2)",
                "subtitle": "Today's Top 3 commitments first, then descending by age",
                "headlineStat": "1/3 Top-3",
                "emptyStateTitle": "No Active Flow Tasks Yet",
                "emptyStateBody": "Sync with Google Tasks or lock in up to 3 priorities for today.",
                "items": [
                  {
                    "taskId": "task-top3-contract",
                    "title": "Verify OpenAPI 3.1 contract tests across stacks",
                    "shortLabel": "Verify OpenAPI 3.1 contract…",
                    "primaryMetricLabel": "Top 3",
                    "secondaryMetricLabel": "Deferred 1×",
                    "intensityFraction": 1.0,
                    "category": "ACTIVE_COMMITTED",
                    "deferCount": 1,
                    "daysOld": 3,
                    "daysUntouched": 1,
                    "daysOverdue": 0,
                    "sortScore": 10103
                  },
                  {
                    "taskId": "task-backlog-books",
                    "title": "Order replacement USB-C braided cable for desk",
                    "shortLabel": "Order replacement USB-C bra…",
                    "primaryMetricLabel": "2d old",
                    "secondaryMetricLabel": "In Flow",
                    "intensityFraction": 0.49,
                    "category": "HEALTHY_BACKLOG",
                    "deferCount": 0,
                    "daysOld": 2,
                    "daysUntouched": 1,
                    "daysOverdue": 0,
                    "sortScore": 2
                  }
                ]
              }
            ],
            "habitualDeferralCount": 1,
            "longStandingCount": 1,
            "committedTodayCount": 1,
            "healthyBacklogCount": 1,
            "averageStalledDeferrals": 3.0,
            "oldestOpenDays": 14,
            "clarityRatioPercent": 50
          },
          "allStatuses": [
            {
              "task": {
                "id": "task-tax-receipts",
                "googleTaskId": "gtask-101",
                "taskListId": "@default",
                "taskListTitle": "My Tasks",
                "title": "Consolidate Q3 expense receipts & CPA export",
                "notes": "Need to download PDF statements from two cards first",
                "isCompleted": false,
                "dueEpochMillis": 1794700800000,
                "completedEpochMillis": null,
                "createdEpochMillis": 1793836800000,
                "updatedEpochMillis": 1794528000000,
                "deferCount": 5,
                "commitment": "NORMAL",
                "energy": "DEEP_WORK",
                "blockerNote": "",
                "dirtySync": false
              },
              "category": "HABITUALLY_DEFERRED",
              "badgeLabel": "Deferred 5× • 14d old",
              "daysOld": 14,
              "daysUntouched": 6,
              "daysOverdue": 4
            },
            {
              "task": {
                "id": "task-garage-shelf",
                "googleTaskId": null,
                "taskListId": "@default",
                "taskListTitle": "Home",
                "title": "Clear garage workbench and donate spare cables",
                "notes": "Sitting untouched since last weekend",
                "isCompleted": false,
                "dueEpochMillis": null,
                "completedEpochMillis": null,
                "createdEpochMillis": 1794009600000,
                "updatedEpochMillis": 1794268800000,
                "deferCount": 1,
                "commitment": "NORMAL",
                "energy": "FOCUSED",
                "blockerNote": "",
                "dirtySync": false
              },
              "category": "LONG_STANDING_GHOSTED",
              "badgeLabel": "9d untouched",
              "daysOld": 12,
              "daysUntouched": 9,
              "daysOverdue": 0
            },
            {
              "task": {
                "id": "task-top3-contract",
                "googleTaskId": "gtask-106",
                "taskListId": "@default",
                "taskListTitle": "Work",
                "title": "Verify OpenAPI 3.1 contract tests across stacks",
                "notes": "Locked into Today's Top 3",
                "isCompleted": false,
                "dueEpochMillis": 1795046400000,
                "completedEpochMillis": null,
                "createdEpochMillis": 1794787200000,
                "updatedEpochMillis": 1794960000000,
                "deferCount": 1,
                "commitment": "TODAY_TOP_3",
                "energy": "FOCUSED",
                "blockerNote": "",
                "dirtySync": false
              },
              "category": "ACTIVE_COMMITTED",
              "badgeLabel": "Committed Today • Deferred 1×",
              "daysOld": 3,
              "daysUntouched": 1,
              "daysOverdue": 0
            },
            {
              "task": {
                "id": "task-backlog-books",
                "googleTaskId": "gtask-108",
                "taskListId": "@default",
                "taskListTitle": "Personal",
                "title": "Order replacement USB-C braided cable for desk",
                "notes": "",
                "isCompleted": false,
                "dueEpochMillis": null,
                "completedEpochMillis": null,
                "createdEpochMillis": 1794873600000,
                "updatedEpochMillis": 1794960000000,
                "deferCount": 0,
                "commitment": "NORMAL",
                "energy": "QUICK_WIN",
                "blockerNote": "",
                "dirtySync": false
              },
              "category": "HEALTHY_BACKLOG",
              "badgeLabel": "Active",
              "daysOld": 2,
              "daysUntouched": 1,
              "daysOverdue": 0
            }
          ],
          "top3Commitments": [],
          "habituallyUndone": [],
          "longStandingDrift": [],
          "activeBacklog": [],
          "conversationThreadsByTaskId": {
            "task-tax-receipts": [
              {
                "id": "msg-partner-1",
                "role": "PARTNER",
                "text": "You've carried this across 5 deferrals. What is blocking it?",
                "suggestedActionCode": null
              },
              {
                "id": "msg-partner-2",
                "role": "PARTNER",
                "text": "Let's shrink it to a 5m starter.",
                "suggestedActionCode": "SHRINK_TO_5M"
              }
            ]
          },
          "quickReplies": [
            {
              "id": "qr-5m",
              "label": "Too big — shrink to 5m",
              "messageText": "Shrink to 5m."
            }
          ],
          "settings": {
            "partnerTone": "Candid & Warm",
            "aiStreamingEnabled": true,
            "connectedGoogleAccount": "pulse-demo-user@pulse.local",
            "lastSyncStatus": "Synced • Google Tasks API v1",
            "morningRitualTime": "08:30",
            "eveningShutdownTime": "18:00",
            "zeroPiiTelemetryEnabled": true
          },
          "breadcrumbs": [
            {
              "timestampIso": "2026-11-19T12:00:00Z",
              "event": "demo_tasks_seeded",
              "summary": "demo_tasks_seeded [count=4]"
            }
          ],
          "wcagContrastAudit": [
            {"pairName": "Pair 1", "foregroundRgb": 1514777, "backgroundRgb": 16186358, "contrastRatio": 16.35, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 2", "foregroundRgb": 1514777, "backgroundRgb": 16186358, "contrastRatio": 16.35, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 3", "foregroundRgb": 3489336, "backgroundRgb": 15002085, "contrastRatio": 9.0, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 4", "foregroundRgb": 16777215, "backgroundRgb": 1332028, "contrastRatio": 9.0, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 5", "foregroundRgb": 8468, "backgroundRgb": 11137744, "contrastRatio": 13.28, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 6", "foregroundRgb": 3020032, "backgroundRgb": 16768194, "contrastRatio": 13.3, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 7", "foregroundRgb": 7224, "backgroundRgb": 13886719, "contrastRatio": 13.33, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 8", "foregroundRgb": 4259842, "backgroundRgb": 16767702, "contrastRatio": 13.26, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 9", "foregroundRgb": 16777215, "backgroundRgb": 12196378, "contrastRatio": 6.46, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 10", "foregroundRgb": 14673119, "backgroundRgb": 988433, "contrastRatio": 14.35, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 11", "foregroundRgb": 14673119, "backgroundRgb": 988433, "contrastRatio": 14.35, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 12", "foregroundRgb": 13161162, "backgroundRgb": 2435879, "contrastRatio": 9.31, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 13", "foregroundRgb": 10266, "backgroundRgb": 9360821, "contrastRatio": 9.36, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 14", "foregroundRgb": 11137744, "backgroundRgb": 20793, "contrastRatio": 7.29, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 15", "foregroundRgb": 16768194, "backgroundRgb": 6503184, "contrastRatio": 7.52, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 16", "foregroundRgb": 13886719, "backgroundRgb": 1655654, "contrastRatio": 8.01, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 17", "foregroundRgb": 16767702, "backgroundRgb": 9633802, "contrastRatio": 7.24, "minimumRequired": 4.5, "passesWcagAA": true},
            {"pairName": "Pair 18", "foregroundRgb": 5636099, "backgroundRgb": 16757931, "contrastRatio": 8.85, "minimumRequired": 4.5, "passesWcagAA": true}
          ],
          "swapRequired": false,
          "pendingSwapCandidateTaskId": null,
          "statusBanner": "Golden contract fixture"
        }
    """.trimIndent()

    @Test
    fun decodesGeneratedOpenApiResponseWithNullablesAndMapsThroughAclToPureDomain() {
        val decoded = PulseApiContractMapper.decodeDashboardResponse(goldenDashboardJson)

        assertEquals(3, decoded.horizon.windows.size)
        assertEquals(18, decoded.wcagContrastAudit.size)
        assertNull(decoded.pendingSwapCandidateTaskId)
        assertFalse(decoded.swapRequired)

        val ghostedTask = decoded.allStatuses.first { it.task.id == "task-garage-shelf" }
        assertNull(ghostedTask.task.googleTaskId)
        assertNull(ghostedTask.task.dueEpochMillis)
        assertNull(ghostedTask.task.completedEpochMillis)

        val thread = decoded.conversationThreadsByTaskId["task-tax-receipts"].orEmpty()
        assertEquals(2, thread.size)
        assertNull(thread[0].suggestedActionCode)
        assertEquals("SHRINK_TO_5M", thread[1].suggestedActionCode)

        assertEquals(
            AccountabilityCategory.LONG_STANDING_IDLE,
            PulseApiContractMapper.toKmpCategory(
                WireAccountabilityCategory.LONG_STANDING_GHOSTED,
                isCompleted = false,
                commitment = WireCommitmentState.NORMAL
            )
        )
        assertEquals(
            AccountabilityCategory.SOMEDAY_PARKED,
            PulseApiContractMapper.toKmpCategory(
                WireAccountabilityCategory.COMPLETED_OR_PARKED,
                isCompleted = false,
                commitment = WireCommitmentState.SOMEDAY_PARKED
            )
        )

        val domainTasks = decoded.allStatuses.map { PulseApiContractMapper.toKmpTaskItem(it.task) }
        val windows = TaskVisualAnalyticsEngine.buildDescendingHorizonWindows(
            tasks = domainTasks,
            today = LocalDate(2026, 11, 19),
            nowMillis = 1_795_046_400_000L
        )
        assertEquals(3, windows.size)
        assertEquals("task-tax-receipts", windows[0].items.first().task.id)
        assertEquals("task-garage-shelf", windows[1].items.first().task.id)
        assertEquals("task-top3-contract", windows[2].items.first().task.id)
    }

    @Test
    fun expandAndContractResilienceIgnoresUnknownAdditiveBackendFields() {
        val expandedJson = goldenDashboardJson.replaceFirst(
            "\"statusBanner\": \"Golden contract fixture\"",
            "\"focusScore\": 92, \"futureBannerBadge\": \"v2\", \"statusBanner\": \"Golden contract fixture\""
        )

        val decoded = PulseApiContractMapper.decodeDashboardResponse(expandedJson)
        assertEquals("Golden contract fixture", decoded.statusBanner)
        assertEquals(4, decoded.allStatuses.size)
    }

    @Test
    fun encodesRequestDtosAndDecodesErrorContractMatchingSpringBootWireFormat() {
        val commitJson = PulseApiContractMapper.encodeTriageRequest(
            TriageRequest(action = TriageActionCode.COMMIT_TODAY)
        )
        assertTrue(commitJson.contains("\"action\":\"COMMIT_TODAY\""))
        assertFalse(commitJson.contains("waitingOn"))
        assertFalse(commitJson.contains("postponeDays"))

        val shrinkJson = PulseApiContractMapper.encodeTriageRequest(
            TriageRequest(action = TriageActionCode.SHRINK_TO_5_M)
        )
        assertTrue(shrinkJson.contains("\"action\":\"SHRINK_TO_5M\""))

        val swapJson = PulseApiContractMapper.encodeSwapTop3Request(
            SwapTop3Request(toAddTaskId = "task-tax-receipts", toRemoveTaskId = "task-top3-contract")
        )
        assertTrue(swapJson.contains("\"toAddTaskId\":\"task-tax-receipts\""))
        assertTrue(swapJson.contains("\"toRemoveTaskId\":\"task-top3-contract\""))

        val error = PulseApiContractMapper.decodeApiError("{\"error\":\"Task not found: task-404\"}")
        assertEquals("Task not found: task-404", error.error)
    }
}
