package com.pulse.backend;

import com.pulse.backend.api.PulseController;
import com.pulse.backend.api.PulseDtos;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Traceability: REQ-PULSE-001 (ADR-007 domain purity & REST API/DTO contract).
 */
@DisplayName("REQ-PULSE-001: ADR-007 Domain Purity & API/DTO Contract")
class ContractAndArchTest {

    @Test
    @DisplayName("REQ-PULSE-001: domain package remains free of Spring, Servlet, and Lombok dependencies")
    void domainRemainsPureFunctionalCore() {
        JavaClasses imported = new ClassFileImporter()
                .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                .importPackages("com.pulse.backend");

        noClasses()
                .that().resideInAPackage("..domain..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "org.springframework..",
                        "jakarta.servlet..",
                        "lombok.."
                )
                .because("REQ-PULSE-001 / ADR-007 requires the domain package to remain a pure functional core.")
                .check(imported);
    }

    @Test
    @DisplayName("REQ-PULSE-001: PulseController and PulseDtos preserve the /api/v1/pulse REST contract")
    void apiControllerAndDtosPreserveContract() throws IOException {
        assertTrue(PulseController.class.isAnnotationPresent(RestController.class));
        RequestMapping mapping = PulseController.class.getAnnotation(RequestMapping.class);
        assertNotNull(mapping);
        assertEquals("/api/v1/pulse", mapping.value()[0]);

        Set<String> controllerMethods = Arrays.stream(PulseController.class.getDeclaredMethods())
                .map(Method::getName)
                .collect(Collectors.toSet());
        assertTrue(controllerMethods.containsAll(Set.of(
                "getState",
                "triageTask",
                "swapTop3",
                "sendChatMessage",
                "updateSettings",
                "resetDemo"
        )));

        assertTrue(PulseDtos.PartnerSettingsDto.class.isRecord());
        assertTrue(PulseDtos.QuickReplySpecDto.class.isRecord());
        assertTrue(PulseDtos.PulseDashboardResponse.class.isRecord());
        assertTrue(PulseDtos.TriageRequest.class.isRecord());
        assertTrue(PulseDtos.SwapTop3Request.class.isRecord());
        assertTrue(PulseDtos.ChatMessageRequest.class.isRecord());

        Path controllerSource = Path.of("src/main/java/com/pulse/backend/api/PulseController.java");
        Path dtosSource = Path.of("src/main/java/com/pulse/backend/api/PulseDtos.java");
        assertTrue(Files.exists(controllerSource), "PulseController.java must exist");
        assertTrue(Files.exists(dtosSource), "PulseDtos.java must exist");
        String dtosContent = Files.readString(dtosSource);
        assertTrue(dtosContent.contains("public record PulseDashboardResponse"));
    }
}
