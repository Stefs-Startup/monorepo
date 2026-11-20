package com.pulse.backend.api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Traceability: REQ-PULSE-002 (liveness, readiness, and revision info probes).
 */
@SpringBootTest(properties = {
        "info.app.revision=rev-test-001",
        "info.app.environment=test"
})
@AutoConfigureMockMvc
@DisplayName("REQ-PULSE-002: Production Liveness, Readiness & Revision Info Probes")
class DeploymentProbesContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void livenessAndReadinessAndInfoReturnHealthyRevisionMetadata() throws Exception {
        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.components.deploymentDrill.details.drillMode").value("healthy"));

        mockMvc.perform(get("/actuator/info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.app.name").value("pulse-backend"))
                .andExpect(jsonPath("$.app.revision").value("rev-test-001"))
                .andExpect(jsonPath("$.app.environment").value("test"));
    }
}
