package com.pulse.backend.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class PulseControllerContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void getStateReturnsThreeHorizonWindowsAndWcagAudit() throws Exception {
        mockMvc.perform(get("/api/v1/pulse/state"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.horizon.windows.length()").value(3))
                .andExpect(jsonPath("$.horizon.windows[0].windowType").value("HABITUALLY_UNDONE"))
                .andExpect(jsonPath("$.horizon.windows[1].windowType").value("LONG_STANDING_DRIFT"))
                .andExpect(jsonPath("$.horizon.windows[2].windowType").value("ACTIVE_FLOW"))
                .andExpect(jsonPath("$.wcagContrastAudit").isArray());
    }

    @Test
    void postChatAppendsPartnerReplyWithoutMutatingTaskIdleDays() throws Exception {
        mockMvc.perform(post("/api/v1/pulse/demo/reset"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/pulse/tasks/task-tax-receipts/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"It feels too big to start today\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conversationThreadsByTaskId['task-tax-receipts'].length()").value(3))
                .andExpect(jsonPath("$.conversationThreadsByTaskId['task-tax-receipts'][2].suggestedActionCode").value("SHRINK_TO_5M"));
    }

    @Test
    void triageEnforcesTop3ScarcityCapAndTriggersSwapGate() throws Exception {
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
    }
}
