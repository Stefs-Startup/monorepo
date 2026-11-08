package com.pulse.backend.service;

import com.pulse.backend.api.PulseDtos.PartnerSettingsDto;
import com.pulse.backend.api.PulseDtos.PulseDashboardResponse;
import com.pulse.backend.api.PulseDtos.QuickReplySpecDto;
import com.pulse.backend.domain.AccountabilityCategory;
import com.pulse.backend.domain.ScarcityEngine;
import com.pulse.backend.domain.ScarcityEngine.PinDecision;
import com.pulse.backend.domain.ScarcityEngine.SwapResult;
import com.pulse.backend.domain.TaskItem;
import com.pulse.backend.domain.TaskItem.TaskCommitmentState;
import com.pulse.backend.domain.TaskItem.TaskEnergyLevel;
import com.pulse.backend.domain.TaskVisualAnalyticsEngine;
import com.pulse.backend.domain.TaskVisualAnalyticsEngine.TaskHorizonAnalyticsSnapshot;
import com.pulse.backend.domain.TriageRules;
import com.pulse.backend.domain.TriageRules.TriageAction;
import com.pulse.backend.domain.UndoneAccountabilityEngine;
import com.pulse.backend.domain.UndoneAccountabilityEngine.ConversationalMessage;
import com.pulse.backend.domain.UndoneAccountabilityEngine.TaskAccountabilityStatus;
import com.pulse.backend.domain.WcagContrastEngine;
import com.pulse.backend.observability.PulseObservability;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PulseAccountabilityService {

    private static final long DAY_MS = 86_400_000L;

    private final Map<String, TaskItem> tasksById = new LinkedHashMap<>();
    private final Map<String, List<ConversationalMessage>> threadsByTaskId = new ConcurrentHashMap<>();
    private PartnerSettingsDto settings = new PartnerSettingsDto(
            "Candid & Warm",
            true,
            "stefan@pulse.local",
            "Synced • Google Tasks API v1",
            "08:30",
            "18:00",
            true
    );
    private boolean swapRequired = false;
    private String pendingSwapCandidateTaskId = null;
    private String statusBanner = "Ready • 3 Horizon Windows ranked in strict descending order";

    public PulseAccountabilityService() {
        resetDemoData();
    }

    public synchronized PulseDashboardResponse resetDemoData() {
        tasksById.clear();
        threadsByTaskId.clear();
        swapRequired = false;
        pendingSwapCandidateTaskId = null;

        long now = System.currentTimeMillis();
        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.now(zone);

        List<TaskItem> seedTasks = List.of(
                new TaskItem(
                        "task-tax-receipts",
                        "gtask-101",
                        "@default",
                        "My Tasks",
                        "Consolidate Q3 expense receipts & CPA export",
                        "Need to download PDF statements from two cards first",
                        false,
                        today.minusDays(4).atStartOfDay(zone).toInstant().toEpochMilli(),
                        null,
                        now - 14 * DAY_MS,
                        now - 6 * DAY_MS,
                        5,
                        TaskCommitmentState.NORMAL,
                        TaskEnergyLevel.DEEP_WORK,
                        "",
                        false
                ),
                new TaskItem(
                        "task-dentist-call",
                        "gtask-102",
                        "@default",
                        "My Tasks",
                        "Call clinic to reschedule annual dental checkup",
                        "Clinic only answers between 9am and 4pm",
                        false,
                        today.minusDays(2).atStartOfDay(zone).toInstant().toEpochMilli(),
                        null,
                        now - 11 * DAY_MS,
                        now - 4 * DAY_MS,
                        4,
                        TaskCommitmentState.NORMAL,
                        TaskEnergyLevel.QUICK_WIN,
                        "",
                        false
                ),
                new TaskItem(
                        "task-arch-rfc",
                        "gtask-103",
                        "@default",
                        "Work",
                        "Write Spring Boot 4 + Angular 21 architecture RFC",
                        "Outline pure domain boundaries and REST contract",
                        false,
                        today.atStartOfDay(zone).toInstant().toEpochMilli(),
                        null,
                        now - 9 * DAY_MS,
                        now - 3 * DAY_MS,
                        2,
                        TaskCommitmentState.NORMAL,
                        TaskEnergyLevel.FOCUSED,
                        "",
                        false
                ),
                new TaskItem(
                        "task-garage-shelf",
                        "gtask-104",
                        "@default",
                        "Home",
                        "Clear garage workbench and donate spare cables",
                        "Sitting untouched since last weekend",
                        false,
                        null,
                        null,
                        now - 12 * DAY_MS,
                        now - 9 * DAY_MS,
                        1,
                        TaskCommitmentState.NORMAL,
                        TaskEnergyLevel.FOCUSED,
                        "",
                        false
                ),
                new TaskItem(
                        "task-security-keys",
                        "gtask-105",
                        "@default",
                        "Security",
                        "Rotate backup SSH & OAuth developer tokens",
                        "Verify SHA-1 fingerprint on Pixel 8 Pro",
                        false,
                        today.minusDays(3).atStartOfDay(zone).toInstant().toEpochMilli(),
                        null,
                        now - 8 * DAY_MS,
                        now - 7 * DAY_MS,
                        0,
                        TaskCommitmentState.NORMAL,
                        TaskEnergyLevel.QUICK_WIN,
                        "",
                        false
                ),
                new TaskItem(
                        "task-top3-contract",
                        "gtask-106",
                        "@default",
                        "Work",
                        "Verify MockWebServer OAuth 401 & 200 contract tests",
                        "Locked into Today's Top 3",
                        false,
                        today.atStartOfDay(zone).toInstant().toEpochMilli(),
                        null,
                        now - 3 * DAY_MS,
                        now - 1 * DAY_MS,
                        1,
                        TaskCommitmentState.TODAY_TOP_3,
                        TaskEnergyLevel.FOCUSED,
                        "",
                        false
                ),
                new TaskItem(
                        "task-top3-wcag",
                        "gtask-107",
                        "@default",
                        "Work",
                        "Run WCAG 2.2 AA contrast audit across Light & Dark palettes",
                        "Ensure >= 4.5:1 ratio on all Material 3 Expressive tokens",
                        false,
                        today.atStartOfDay(zone).toInstant().toEpochMilli(),
                        null,
                        now - 2 * DAY_MS,
                        now - 1 * DAY_MS,
                        0,
                        TaskCommitmentState.TODAY_TOP_3,
                        TaskEnergyLevel.QUICK_WIN,
                        "",
                        false
                ),
                new TaskItem(
                        "task-backlog-books",
                        "gtask-108",
                        "@default",
                        "Personal",
                        "Order replacement USB-C braided cable for desk",
                        "",
                        false,
                        null,
                        null,
                        now - 2 * DAY_MS,
                        now - 1 * DAY_MS,
                        0,
                        TaskCommitmentState.NORMAL,
                        TaskEnergyLevel.QUICK_WIN,
                        "",
                        false
                )
        );

        for (TaskItem task : seedTasks) {
            tasksById.put(task.id(), task);
            threadsByTaskId.put(
                    task.id(),
                    new ArrayList<>(UndoneAccountabilityEngine.buildInitialReflectionThread(task, today, now, zone))
            );
        }

        statusBanner = "Synced 8 Google Tasks • 3 Habitually Undone, 2 Drifting, 2/3 Top-3 Committed";
        PulseObservability.recordBreadcrumb("demo_tasks_seeded", Map.of("count", String.valueOf(seedTasks.size())));
        return getDashboardState();
    }

    public synchronized PulseDashboardResponse getDashboardState() {
        long now = System.currentTimeMillis();
        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.now(zone);

        List<TaskAccountabilityStatus> statuses = tasksById.values().stream()
                .map(task -> UndoneAccountabilityEngine.classifyTask(task, today, now, zone))
                .toList();

        TaskHorizonAnalyticsSnapshot horizon = TaskVisualAnalyticsEngine.buildHorizonSnapshot(statuses);

        List<TaskAccountabilityStatus> top3 = statuses.stream()
                .filter(s -> s.category() == AccountabilityCategory.ACTIVE_COMMITTED)
                .toList();

        List<TaskAccountabilityStatus> habitual = statuses.stream()
                .filter(s -> s.category() == AccountabilityCategory.HABITUALLY_DEFERRED)
                .sorted((a, b) -> Integer.compare(b.task().deferCount(), a.task().deferCount()))
                .toList();

        List<TaskAccountabilityStatus> drifting = statuses.stream()
                .filter(s -> s.category() == AccountabilityCategory.LONG_STANDING_GHOSTED)
                .sorted((a, b) -> Long.compare(
                        Math.max(b.daysOverdue(), Math.max(b.daysUntouched(), b.daysOld())),
                        Math.max(a.daysOverdue(), Math.max(a.daysUntouched(), a.daysOld()))
                ))
                .toList();

        List<TaskAccountabilityStatus> activeBacklog = statuses.stream()
                .filter(s -> s.category() == AccountabilityCategory.HEALTHY_BACKLOG)
                .toList();

        Map<String, List<ConversationalMessage>> threadsSnapshot = new LinkedHashMap<>();
        for (String taskId : tasksById.keySet()) {
            TaskItem task = tasksById.get(taskId);
            List<ConversationalMessage> thread = threadsByTaskId.computeIfAbsent(
                    taskId,
                    id -> new ArrayList<>(UndoneAccountabilityEngine.buildInitialReflectionThread(task, today, now, zone))
            );
            threadsSnapshot.put(taskId, List.copyOf(thread));
        }

        List<QuickReplySpecDto> quickReplies = List.of(
                new QuickReplySpecDto("qr-5m", "Too big — shrink to 5m", "It feels too big and vague to start right now. Let's shrink it to a 5m starter."),
                new QuickReplySpecDto("qr-top3", "Lock into Today's Top 3", "I'm ready to commit and finish this today."),
                new QuickReplySpecDto("qr-blocked", "Waiting on someone", "I'm blocked waiting on someone else to reply."),
                new QuickReplySpecDto("qr-tomorrow", "Reschedule for tomorrow", "Today is packed, let's reschedule for tomorrow."),
                new QuickReplySpecDto("qr-drop", "Not a priority — let it go", "Honestly this is not a priority anymore, let's drop it.")
        );

        return new PulseDashboardResponse(
                horizon,
                statuses,
                top3,
                habitual,
                drifting,
                activeBacklog,
                threadsSnapshot,
                quickReplies,
                settings,
                PulseObservability.recentBreadcrumbs(),
                WcagContrastEngine.auditExpressiveThemePalette(),
                swapRequired,
                pendingSwapCandidateTaskId,
                statusBanner
        );
    }

    public synchronized PulseDashboardResponse applyTriage(
            String taskId,
            String actionCode,
            String waitingOn,
            Integer postponeDays
    ) {
        TaskItem existing = getRequiredTask(taskId);
        long now = System.currentTimeMillis();
        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.now(zone);
        String normalizedAction = actionCode.trim().toUpperCase(Locale.ROOT);

        swapRequired = false;
        pendingSwapCandidateTaskId = null;

        switch (normalizedAction) {
            case "COMMIT_TODAY", "PIN_TOP_3" -> {
                List<TaskItem> currentTop3 = currentTop3Tasks();
                PinDecision decision = ScarcityEngine.evaluatePinAction(currentTop3, existing);
                switch (decision) {
                    case PinDecision.AllowPin ignored -> {
                        TaskItem updated = TriageRules.applyTriageAction(
                                existing, new TriageAction.CommitToday(), today, zone, now
                        );
                        tasksById.put(taskId, updated);
                        statusBanner = "Committed to Today's Top 3 (" + (currentTop3.size() + 1) + "/3 slots)";
                        PulseObservability.recordBreadcrumb("triage_commit_top3", Map.of(
                                "taskId", taskId,
                                "slotsUsed", String.valueOf(currentTop3.size() + 1)
                        ));
                    }
                    case PinDecision.Unpin ignored -> {
                        TaskItem unpinned = existing.withCommitment(TaskCommitmentState.NORMAL, now);
                        tasksById.put(taskId, unpinned);
                        statusBanner = "Unpinned from Today's Top 3";
                        PulseObservability.recordBreadcrumb("triage_unpin_top3", Map.of("taskId", taskId));
                    }
                    case PinDecision.SwapRequired ignored -> {
                        swapRequired = true;
                        pendingSwapCandidateTaskId = taskId;
                        statusBanner = "Scarcity Gate: Today's Top 3 is full (3/3). Choose a commitment to swap out.";
                        PulseObservability.recordBreadcrumb("scarcity_gate_swap_required", Map.of("candidateTaskId", taskId));
                    }
                }
            }
            case "UNPIN" -> {
                TaskItem unpinned = existing.withCommitment(TaskCommitmentState.NORMAL, now);
                tasksById.put(taskId, unpinned);
                statusBanner = "Unpinned from Today's Top 3";
                PulseObservability.recordBreadcrumb("triage_unpin_top3", Map.of("taskId", taskId));
            }
            case "SHRINK_TO_5M" -> {
                List<TaskItem> currentTop3 = currentTop3Tasks();
                boolean canPin = existing.commitment() == TaskCommitmentState.TODAY_TOP_3
                        || currentTop3.size() < ScarcityEngine.MAX_TOP_3_LIMIT;
                TaskItem shrunk = TriageRules.applyTriageAction(
                        existing, new TriageAction.ShrinkTo5m(), today, zone, now
                );
                if (!canPin) {
                    shrunk = shrunk.withCommitment(TaskCommitmentState.NORMAL, now);
                }
                tasksById.put(taskId, shrunk);
                statusBanner = "Shrunk to a 5-minute starter step";
                PulseObservability.recordBreadcrumb("triage_shrink_5m", Map.of("taskId", taskId));
            }
            case "RESCHEDULE" -> {
                int days = postponeDays != null && postponeDays > 0 ? postponeDays : 1;
                TaskItem rescheduled = TriageRules.applyTriageAction(
                        existing, new TriageAction.Reschedule(today.plusDays(days)), today, zone, now
                );
                tasksById.put(taskId, rescheduled);
                statusBanner = "Intentionally rescheduled (deferral count: " + rescheduled.deferCount() + "×)";
                PulseObservability.recordBreadcrumb("triage_reschedule", Map.of(
                        "taskId", taskId,
                        "deferCount", String.valueOf(rescheduled.deferCount())
                ));
            }
            case "DELEGATE" -> {
                String blocker = (waitingOn == null || waitingOn.isBlank()) ? "External dependency" : waitingOn;
                TaskItem delegated = TriageRules.applyTriageAction(
                        existing, new TriageAction.Delegate(blocker), today, zone, now
                );
                tasksById.put(taskId, delegated);
                statusBanner = "Marked Waiting-On blocker";
                PulseObservability.recordBreadcrumb("triage_delegate", Map.of("taskId", taskId));
            }
            case "PARK_SOMEDAY" -> {
                TaskItem parked = TriageRules.applyTriageAction(
                        existing, new TriageAction.ParkSomeday(), today, zone, now
                );
                tasksById.put(taskId, parked);
                statusBanner = "Parked in Someday without guilt";
                PulseObservability.recordBreadcrumb("triage_park_someday", Map.of("taskId", taskId));
            }
            case "DROP_CONSCIOUSLY" -> {
                TaskItem dropped = TriageRules.applyTriageAction(
                        existing, new TriageAction.DropConsciously(), today, zone, now
                );
                tasksById.put(taskId, dropped);
                statusBanner = "Consciously dropped from active commitments";
                PulseObservability.recordBreadcrumb("triage_drop_consciously", Map.of("taskId", taskId));
            }
            case "COMPLETE" -> {
                TaskItem completed = existing.withCompleted(true, now, "Completed via Pulse", now);
                tasksById.put(taskId, completed);
                statusBanner = "Task marked done and queued for Google Tasks sync";
                PulseObservability.recordBreadcrumb("triage_complete", Map.of("taskId", taskId));
            }
            default -> throw new IllegalArgumentException("Unsupported triage action: " + actionCode);
        }

        return getDashboardState();
    }

    public synchronized PulseDashboardResponse swapTop3(String toRemoveTaskId, String toAddTaskId) {
        TaskItem toRemove = getRequiredTask(toRemoveTaskId);
        TaskItem toAdd = getRequiredTask(toAddTaskId);
        long now = System.currentTimeMillis();

        SwapResult result = ScarcityEngine.executeSwap(currentTop3Tasks(), toRemove, toAdd, now);
        tasksById.put(result.unpinnedTask().id(), result.unpinnedTask());
        tasksById.put(result.pinnedTask().id(), result.pinnedTask());

        swapRequired = false;
        pendingSwapCandidateTaskId = null;
        statusBanner = "Swapped Today's Top 3 commitment (3/3 locked)";

        PulseObservability.recordBreadcrumb("scarcity_swap_executed", Map.of(
                "unpinnedTaskId", toRemoveTaskId,
                "pinnedTaskId", toAddTaskId
        ));

        return getDashboardState();
    }

    /**
     * Appends a user message and partner reply to the task's reflection thread WITHOUT mutating
     * the task's updatedEpochMillis (preserving idle/untouched days per UC-2).
     */
    public synchronized PulseDashboardResponse sendChatMessage(String taskId, String userMessage) {
        TaskItem task = getRequiredTask(taskId);
        long now = System.currentTimeMillis();
        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.now(zone);

        List<ConversationalMessage> thread = threadsByTaskId.computeIfAbsent(
                taskId,
                id -> new ArrayList<>(UndoneAccountabilityEngine.buildInitialReflectionThread(task, today, now, zone))
        );

        ConversationalMessage userTurn = ConversationalMessage.user(userMessage.trim());
        ConversationalMessage partnerReply = UndoneAccountabilityEngine.generatePartnerReply(task, userMessage.trim());
        thread.add(userTurn);
        thread.add(partnerReply);

        PulseObservability.recordBreadcrumb("chat_turn_completed", Map.of(
                "taskId", taskId,
                "suggestedAction", partnerReply.suggestedActionCode() != null ? partnerReply.suggestedActionCode() : "NONE"
        ));

        return getDashboardState();
    }

    public synchronized PulseDashboardResponse updateSettings(PartnerSettingsDto updated) {
        this.settings = new PartnerSettingsDto(
                updated.partnerTone() != null ? updated.partnerTone() : settings.partnerTone(),
                updated.aiStreamingEnabled(),
                PulseObservability.scrubSensitiveText(updated.connectedGoogleAccount())
                        .equals("[REDACTED_EMAIL]") ? updated.connectedGoogleAccount() : settings.connectedGoogleAccount(),
                updated.lastSyncStatus() != null ? updated.lastSyncStatus() : settings.lastSyncStatus(),
                updated.morningRitualTime() != null ? updated.morningRitualTime() : settings.morningRitualTime(),
                updated.eveningShutdownTime() != null ? updated.eveningShutdownTime() : settings.eveningShutdownTime(),
                updated.zeroPiiTelemetryEnabled()
        );
        this.statusBanner = "Partner settings updated (" + this.settings.partnerTone() + ")";
        PulseObservability.recordBreadcrumb("settings_updated", Map.of(
                "tone", this.settings.partnerTone(),
                "aiStreaming", String.valueOf(this.settings.aiStreamingEnabled())
        ));
        return getDashboardState();
    }

    private List<TaskItem> currentTop3Tasks() {
        return tasksById.values().stream()
                .filter(t -> !t.isCompleted() && t.commitment() == TaskCommitmentState.TODAY_TOP_3)
                .toList();
    }

    private TaskItem getRequiredTask(String taskId) {
        TaskItem task = tasksById.get(taskId);
        if (task == null) {
            throw new NoSuchElementException("Task not found: " + taskId);
        }
        return task;
    }
}
