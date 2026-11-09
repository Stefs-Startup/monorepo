package com.pulse.backend.api;

import com.pulse.backend.domain.TaskVisualAnalyticsEngine.TaskHorizonAnalyticsSnapshot;
import com.pulse.backend.domain.UndoneAccountabilityEngine.ConversationalMessage;
import com.pulse.backend.domain.UndoneAccountabilityEngine.TaskAccountabilityStatus;
import com.pulse.backend.domain.WcagContrastEngine.ContrastAuditEntry;
import com.pulse.backend.observability.PulseObservability.BreadcrumbEntry;
import jakarta.validation.constraints.NotBlank;

import java.util.List;
import java.util.Map;

public final class PulseDtos {

    private PulseDtos() {}

    public record PartnerSettingsDto(
            String partnerTone,
            boolean aiStreamingEnabled,
            String connectedGoogleAccount,
            String lastSyncStatus,
            String morningRitualTime,
            String eveningShutdownTime,
            boolean zeroPiiTelemetryEnabled
    ) {}

    public record QuickReplySpecDto(
            String id,
            String label,
            String messageText
    ) {}

    public record PulseDashboardResponse(
            TaskHorizonAnalyticsSnapshot horizon,
            List<TaskAccountabilityStatus> allStatuses,
            List<TaskAccountabilityStatus> top3Commitments,
            List<TaskAccountabilityStatus> habituallyUndone,
            List<TaskAccountabilityStatus> longStandingDrift,
            List<TaskAccountabilityStatus> activeBacklog,
            Map<String, List<ConversationalMessage>> conversationThreadsByTaskId,
            List<QuickReplySpecDto> quickReplies,
            PartnerSettingsDto settings,
            List<BreadcrumbEntry> breadcrumbs,
            List<ContrastAuditEntry> wcagContrastAudit,
            boolean swapRequired,
            String pendingSwapCandidateTaskId,
            String statusBanner
    ) {}

    public record TriageRequest(
            @NotBlank String action,
            String waitingOn,
            Integer postponeDays
    ) {}

    public record SwapTop3Request(
            @NotBlank String toRemoveTaskId,
            @NotBlank String toAddTaskId
    ) {}

    public record ChatMessageRequest(
            @NotBlank String message
    ) {}
}
