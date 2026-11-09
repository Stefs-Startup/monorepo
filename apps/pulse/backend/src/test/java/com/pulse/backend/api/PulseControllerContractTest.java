package com.pulse.backend.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class PulseControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void getStateReturnsThreeHorizonWindowsInDescendingOrderAndWcagAudit() throws Exception {
        mockMvc.perform(post("/api/v1/pulse/demo/reset"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/pulse/state"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.horizon.windows.length()").value(3))
                .andExpect(jsonPath("$.horizon.windows[0].windowType").value("HABITUALLY_UNDONE"))
                .andExpect(jsonPath("$.horizon.windows[0].items[0].deferCount").value(5))
                .andExpect(jsonPath("$.horizon.windows[0].items[1].deferCount").value(4))
                .andExpect(jsonPath("$.horizon.windows[0].items[2].deferCount").value(2))
                .andExpect(jsonPath("$.horizon.windows[1].windowType").value("LONG_STANDING_DRIFT"))
                .andExpect(jsonPath("$.horizon.windows[2].windowType").value("ACTIVE_FLOW"))
                .andExpect(jsonPath("$.wcagContrastAudit.length()").value(18));
    }

    @Test
    void triageEnforcesTop3ScarcityCapAndExecutesSwapFlow() throws Exception {
        mockMvc.perform(post("/api/v1/pulse/demo/reset"))
                .andExpect(status().isOk());

        // Seed data starts with 2 tasks in Top 3. Pinning a 3rd succeeds:
        mockMvc.perform(post("/api/v1/pulse/tasks/task-tax-receipts/triage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"COMMIT_TODAY\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.top3Commitments.length()").value(3))
                .andExpect(jsonPath("$.swapRequired").value(false));

        // Pinning a 4th task triggers ScarcityEngine SwapRequired:
        mockMvc.perform(post("/api/v1/pulse/tasks/task-dentist-call/triage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"COMMIT_TODAY\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.swapRequired").value(true))
                .andExpect(jsonPath("$.pendingSwapCandidateTaskId").value("task-dentist-call"));

        // Executing swap replaces the selected Top-3 task and clears swapRequired:
        mockMvc.perform(post("/api/v1/pulse/tasks/swap")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"toRemoveTaskId\":\"task-top3-contract\",\"toAddTaskId\":\"task-dentist-call\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.swapRequired").value(false))
                .andExpect(jsonPath("$.top3Commitments.length()").value(3));
    }

    @Test
    void visualDashboardTriageActionsShrinkAndParkAndReturn404ForUnknownTask() throws Exception {
        mockMvc.perform(post("/api/v1/pulse/demo/reset"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/pulse/tasks/task-tax-receipts/triage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"SHRINK_TO_5M\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.top3Commitments[0].task.title").value("5m starter: Consolidate Q3 expense receipts & CPA export"));

        mockMvc.perform(put("/api/v1/pulse/settings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"partnerTone\":\"Direct & Minimalist\",\"aiStreamingEnabled\":false,\"connectedGoogleAccount\":\"stefan@pulse.local\",\"lastSyncStatus\":\"Synced\",\"morningRitualTime\":\"08:00\",\"eveningShutdownTime\":\"17:30\",\"zeroPiiTelemetryEnabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.settings.morningRitualTime").value("08:00"))
                .andExpect(jsonPath("$.settings.eveningShutdownTime").value("17:30"));

        mockMvc.perform(post("/api/v1/pulse/tasks/non-existent-task/triage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"COMPLETE\"}"))
                .andExpect(status().isNotFound());
    }
}
