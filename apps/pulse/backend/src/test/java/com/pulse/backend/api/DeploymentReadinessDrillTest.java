package com.pulse.backend.api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Traceability: REQ-PULSE-002 (readiness 503 isolation and configurable CORS).
 */
@SpringBootTest(properties = {
        "pulse.drill.simulate-unhealthy-readiness=true",
        "pulse.cors.allowed-origin-patterns=https://pulse-web.example.com"
})
@AutoConfigureMockMvc
@DisplayName("REQ-PULSE-002: Readiness Drill 503 Isolation & Configurable CORS")
class DeploymentReadinessDrillTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void readinessFailsWith503WhileLivenessRemainsHealthy200() throws Exception {
        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("DOWN"))
                .andExpect(jsonPath("$.components.deploymentDrill.details.drillMode").value("simulated_readiness_failure"));

        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void corsAllowsConfiguredProductionOriginPattern() throws Exception {
        mockMvc.perform(options("/api/v1/pulse/state")
                        .header(HttpHeaders.ORIGIN, "https://pulse-web.example.com")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "https://pulse-web.example.com"));
    }
}
