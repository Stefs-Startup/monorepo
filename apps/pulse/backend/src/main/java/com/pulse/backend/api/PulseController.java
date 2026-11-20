package com.pulse.backend.api;

import com.pulse.backend.api.PulseDtos.ApiErrorResponse;
import com.pulse.backend.api.PulseDtos.ChatMessageRequest;
import com.pulse.backend.api.PulseDtos.PartnerSettingsDto;
import com.pulse.backend.api.PulseDtos.PulseDashboardResponse;
import com.pulse.backend.api.PulseDtos.SwapTop3Request;
import com.pulse.backend.api.PulseDtos.TriageRequest;
import com.pulse.backend.observability.PulseObservability;
import com.pulse.backend.service.PulseAccountabilityService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/pulse")
@Tag(
        name = "Pulse",
        description = "Accountability horizon analytics, Top-3 scarcity gate, task triage, reflection chat, and partner settings."
)
public class PulseController {

    private final PulseAccountabilityService service;

    public PulseController(PulseAccountabilityService service) {
        this.service = service;
    }

    @GetMapping(value = "/state", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            operationId = "getPulseState",
            summary = "Get current Pulse dashboard state",
            description = "Returns the 3-window descending Horizon snapshot, categorized tasks, reflection threads, settings, breadcrumbs, and WCAG 2.2 AA audit."
    )
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Current Pulse dashboard state",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = PulseDashboardResponse.class))
            )
    })
    public PulseDashboardResponse getState() {
        return service.getDashboardState();
    }

    @PostMapping(
            value = "/tasks/{taskId}/triage",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    @Operation(
            operationId = "triageTask",
            summary = "Apply a triage action to a task",
            description = "Executes a deterministic triage move (Top-3 commit/unpin, shrink to 5m, reschedule, delegate, park, drop, or complete) and returns updated state."
    )
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Updated dashboard state after triage",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = PulseDashboardResponse.class))
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Invalid triage payload or unsupported action",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ApiErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Task not found",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ApiErrorResponse.class))
            )
    })
    public PulseDashboardResponse triageTask(
            @Parameter(description = "Unique task identifier", example = "task-tax-receipts")
            @PathVariable String taskId,
            @Valid @RequestBody TriageRequest request
    ) {
        return service.applyTriage(
                taskId,
                request.action().name(),
                request.waitingOn(),
                request.postponeDays()
        );
    }

    @PostMapping(
            value = "/tasks/swap",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    @Operation(
            operationId = "swapTop3",
            summary = "Swap a Today's Top 3 commitment",
            description = "Replaces an existing pinned Top-3 task with a new candidate task while preserving the 3-slot scarcity cap."
    )
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Updated dashboard state after swapping Top-3 commitments",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = PulseDashboardResponse.class))
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Invalid swap request or task cannot be swapped",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ApiErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Referenced task not found",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ApiErrorResponse.class))
            )
    })
    public PulseDashboardResponse swapTop3(
            @Valid @RequestBody SwapTop3Request request
    ) {
        return service.swapTop3(request.toRemoveTaskId(), request.toAddTaskId());
    }

    @PostMapping(
            value = "/tasks/{taskId}/chat",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    @Operation(
            operationId = "sendChatMessage",
            summary = "Send a partner reflection chat turn",
            description = "Appends a user reflection message and deterministic partner reply to the task's thread without mutating task idle age."
    )
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Updated dashboard state with appended conversation turn",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = PulseDashboardResponse.class))
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Blank or malformed chat message payload",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ApiErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "404",
                    description = "Task not found",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ApiErrorResponse.class))
            )
    })
    public PulseDashboardResponse sendChatMessage(
            @Parameter(description = "Unique task identifier", example = "task-tax-receipts")
            @PathVariable String taskId,
            @Valid @RequestBody ChatMessageRequest request
    ) {
        return service.sendChatMessage(taskId, request.message());
    }

    @PutMapping(
            value = "/settings",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    @Operation(
            operationId = "updateSettings",
            summary = "Update partner settings and ritual cadence",
            description = "Updates partner tone, streaming flag, ritual times, and zero-PII telemetry configuration."
    )
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Updated dashboard state with new settings",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = PulseDashboardResponse.class))
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Malformed settings payload",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = ApiErrorResponse.class))
            )
    })
    public PulseDashboardResponse updateSettings(
            @Valid @RequestBody PartnerSettingsDto settings
    ) {
        return service.updateSettings(settings);
    }

    @PostMapping(value = "/demo/reset", produces = MediaType.APPLICATION_JSON_VALUE)
    @Operation(
            operationId = "resetDemo",
            summary = "Reset demo Google Tasks state",
            description = "Restores the deterministic 8-task demo dataset and clears any pending Top-3 swap state."
    )
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Reset Pulse dashboard state",
                    content = @Content(mediaType = MediaType.APPLICATION_JSON_VALUE, schema = @Schema(implementation = PulseDashboardResponse.class))
            )
    })
    public PulseDashboardResponse resetDemo() {
        return service.resetDemoData();
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(NoSuchElementException ex) {
        PulseObservability.recordNonFatal("PulseController_NotFound", ex, Map.of());
        String safeMessage = PulseObservability.scrubSensitiveText(ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiErrorResponse(safeMessage.isEmpty() ? "Resource not found" : safeMessage));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiErrorResponse> handleBadRequest(IllegalArgumentException ex) {
        PulseObservability.recordNonFatal("PulseController_BadRequest", ex, Map.of());
        String safeMessage = PulseObservability.scrubSensitiveText(ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiErrorResponse(safeMessage.isEmpty() ? "Invalid request" : safeMessage));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidationError(MethodArgumentNotValidException ex) {
        PulseObservability.recordNonFatal("PulseController_ValidationError", ex, Map.of());
        String details = ex.getBindingResult().getFieldErrors().stream()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .collect(Collectors.joining("; "));
        String safeMessage = PulseObservability.scrubSensitiveText(details.isEmpty() ? "Validation failed" : details);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiErrorResponse(safeMessage));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadableBody(HttpMessageNotReadableException ex) {
        PulseObservability.recordNonFatal("PulseController_UnreadableBody", ex, Map.of());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiErrorResponse("Malformed JSON request or invalid enum value"));
    }
}
