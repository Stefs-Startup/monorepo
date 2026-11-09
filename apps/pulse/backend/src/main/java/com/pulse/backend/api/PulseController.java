package com.pulse.backend.api;

import com.pulse.backend.api.PulseDtos.ChatMessageRequest;
import com.pulse.backend.api.PulseDtos.PartnerSettingsDto;
import com.pulse.backend.api.PulseDtos.PulseDashboardResponse;
import com.pulse.backend.api.PulseDtos.SwapTop3Request;
import com.pulse.backend.api.PulseDtos.TriageRequest;
import com.pulse.backend.observability.PulseObservability;
import com.pulse.backend.service.PulseAccountabilityService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

@RestController
@RequestMapping("/api/v1/pulse")
public class PulseController {

    private final PulseAccountabilityService service;

    public PulseController(PulseAccountabilityService service) {
        this.service = service;
    }

    @GetMapping("/state")
    public PulseDashboardResponse getState() {
        return service.getDashboardState();
    }

    @PostMapping("/tasks/{taskId}/triage")
    public PulseDashboardResponse triageTask(
            @PathVariable String taskId,
            @Valid @RequestBody TriageRequest request
    ) {
        return service.applyTriage(
                taskId,
                request.action(),
                request.waitingOn(),
                request.postponeDays()
        );
    }

    @PostMapping("/tasks/swap")
    public PulseDashboardResponse swapTop3(
            @Valid @RequestBody SwapTop3Request request
    ) {
        return service.swapTop3(request.toRemoveTaskId(), request.toAddTaskId());
    }

    @PostMapping("/tasks/{taskId}/chat")
    public PulseDashboardResponse sendChatMessage(
            @PathVariable String taskId,
            @Valid @RequestBody ChatMessageRequest request
    ) {
        return service.sendChatMessage(taskId, request.message());
    }

    @PutMapping("/settings")
    public PulseDashboardResponse updateSettings(
            @RequestBody PartnerSettingsDto settings
    ) {
        return service.updateSettings(settings);
    }

    @PostMapping("/demo/reset")
    public PulseDashboardResponse resetDemo() {
        return service.resetDemoData();
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(NoSuchElementException ex) {
        PulseObservability.recordNonFatal("PulseController_NotFound", ex, Map.of());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException ex) {
        PulseObservability.recordNonFatal("PulseController_BadRequest", ex, Map.of());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", ex.getMessage()));
    }
}
