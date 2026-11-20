package com.pulse.backend.api;

import com.pulse.backend.domain.TaskVisualAnalyticsEngine.TaskHorizonAnalyticsSnapshot;
import com.pulse.backend.domain.UndoneAccountabilityEngine.ConversationalMessage;
import com.pulse.backend.domain.UndoneAccountabilityEngine.TaskAccountabilityStatus;
import com.pulse.backend.domain.WcagContrastEngine.ContrastAuditEntry;
import com.pulse.backend.observability.PulseObservability.BreadcrumbEntry;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.Map;

public final class PulseDtos {

    private PulseDtos() {}

    @Schema(description = "Supported triage moves executed against a Pulse task.")
    public enum TriageActionCode {
        COMMIT_TODAY,
        PIN_TOP_3,
        UNPIN,
        SHRINK_TO_5M,
        RESCHEDULE,
        DELEGATE,
        PARK_SOMEDAY,
        DROP_CONSCIOUSLY,
        COMPLETE
    }

    @Schema(description = "User preferences for partner tone, Google Tasks sync, daily ritual windows, and zero-PII telemetry.")
    public record PartnerSettingsDto(
            @Schema(description = "Partner coaching tone label.", example = "Candid & Warm")
            String partnerTone,
            @Schema(description = "Whether live streaming AI reflections are enabled.")
            boolean aiStreamingEnabled,
            @Schema(description = "Connected Google account identifier or pseudonymized handle.")
            String connectedGoogleAccount,
            @Schema(description = "Human-readable sync status banner.")
            String lastSyncStatus,
            @Schema(description = "Morning anchor check-in local time (HH:mm).", example = "08:30")
            String morningRitualTime,
            @Schema(description = "Evening honest shutdown local time (HH:mm).", example = "18:00")
            String eveningShutdownTime,
            @Schema(description = "Whether zero-PII diagnostic breadcrumbs are recorded.")
            boolean zeroPiiTelemetryEnabled
    ) {}

    @Schema(description = "One-tap quick reply chip offered inside the Partner Reflect overlay.")
    public record QuickReplySpecDto(
            String id,
            String label,
            String messageText
    ) {}

    @Schema(description = "Full Pulse dashboard state snapshot returned across Horizon, Undone Log, and Settings.")
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
            @Schema(description = "Task awaiting Top-3 swap selection when Today's Top 3 is already full (3/3).")
            @Nullable String pendingSwapCandidateTaskId,
            String statusBanner
    ) {}

    @Schema(description = "Request payload to apply a deterministic triage action to a task.")
    public record TriageRequest(
            @Schema(description = "Triage action to execute.", requiredMode = Schema.RequiredMode.REQUIRED)
            @NotNull TriageActionCode action,
            @Schema(description = "Optional blocker description when action is DELEGATE.", requiredMode = Schema.RequiredMode.NOT_REQUIRED)
            @Nullable String waitingOn,
            @Schema(description = "Optional number of days to postpone when action is RESCHEDULE (defaults to 1).", requiredMode = Schema.RequiredMode.NOT_REQUIRED)
            @Nullable Integer postponeDays
    ) {}

    @Schema(description = "Request payload to swap a currently pinned Top-3 task out in favor of a new candidate task.")
    public record SwapTop3Request(
            @NotBlank String toRemoveTaskId,
            @NotBlank String toAddTaskId
    ) {}

    @Schema(description = "Request payload containing a user reflection turn for a specific task.")
    public record ChatMessageRequest(
            @NotBlank String message
    ) {}

    @Schema(description = "Standardized zero-PII error response returned for 400 and 404 failures.")
    public record ApiErrorResponse(
            @Schema(description = "Scrubbed human-readable error message.", example = "Task not found: task-unknown")
            String error
    ) {}
}
