package com.pulse.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.stereotype.Component;

/**
 * Readiness health indicator supporting RFC-0002 bad-deploy & rollback drills.
 * When PULSE_SIMULATE_UNHEALTHY_READINESS=true, readiness returns 503 DOWN
 * while liveness remains 200 UP so traffic shifts away without a crash loop.
 */
@Component("deploymentDrill")
public class DeploymentDrillHealthIndicator implements HealthIndicator {

    private final boolean simulateUnhealthyReadiness;

    public DeploymentDrillHealthIndicator(
            @Value("${pulse.drill.simulate-unhealthy-readiness:false}")
            boolean simulateUnhealthyReadiness
    ) {
        this.simulateUnhealthyReadiness = simulateUnhealthyReadiness;
    }

    @Override
    public Health health() {
        if (simulateUnhealthyReadiness) {
            return Health.down()
                    .withDetail("drillMode", "simulated_readiness_failure")
                    .build();
        }
        return Health.up()
                .withDetail("drillMode", "healthy")
                .build();
    }
}
