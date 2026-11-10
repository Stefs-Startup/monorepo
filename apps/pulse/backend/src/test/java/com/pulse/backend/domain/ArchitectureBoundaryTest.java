package com.pulse.backend.domain;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Enforces ADR-007 (Pure Functional Core) and Java 21 language standards
 * across the com.pulse.backend.domain package.
 */
class ArchitectureBoundaryTest {

    private static final List<Class<?>> DOMAIN_CLASSES = List.of(
            AccountabilityCategory.class,
            ScarcityEngine.class,
            TaskItem.class,
            TaskVisualAnalyticsEngine.class,
            TriageRules.class,
            UndoneAccountabilityEngine.class,
            WcagContrastEngine.class
    );

    @Test
    void domainModelsUseJava21RecordsAndSealedInterfaces() {
        assertTrue(TaskItem.class.isRecord(), "TaskItem must be an immutable Java 21 record");
        assertTrue(ScarcityEngine.PinDecision.class.isSealed(), "PinDecision must be a Java 21 sealed interface");
        assertTrue(TriageRules.TriageAction.class.isSealed(), "TriageAction must be a Java 21 sealed interface");
        assertTrue(TriageRules.TriageEligibility.class.isSealed(), "TriageEligibility must be a Java 21 sealed interface");
    }

    @Test
    void domainClassesRemainFrameworkFreeWithZeroSpringDependencies() {
        for (Class<?> domainClass : DOMAIN_CLASSES) {
            for (Field field : domainClass.getDeclaredFields()) {
                String typeName = field.getType().getName();
                assertFalse(
                        typeName.startsWith("org.springframework.") || typeName.startsWith("jakarta.servlet."),
                        () -> domainClass.getSimpleName() + " field " + field.getName() + " leaks framework type " + typeName
                );
            }
            for (Method method : domainClass.getDeclaredMethods()) {
                String returnType = method.getReturnType().getName();
                assertFalse(
                        returnType.startsWith("org.springframework.") || returnType.startsWith("jakarta.servlet."),
                        () -> domainClass.getSimpleName() + " method " + method.getName() + " leaks framework type " + returnType
                );
            }
        }
    }
}
