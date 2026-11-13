package com.pulse.backend;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * ArchUnit fitness function enforcing ADR-007 (Pure Functional Core)
 * across the com.pulse.backend domain layer.
 */
@AnalyzeClasses(packages = "com.pulse.backend", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    @ArchTest
    static final ArchRule domain_must_not_depend_on_spring_servlet_or_lombok =
            noClasses()
                    .that().resideInAPackage("..domain..")
                    .should().dependOnClassesThat().resideInAnyPackage(
                            "org.springframework..",
                            "jakarta.servlet..",
                            "lombok.."
                    )
                    .because("ADR-007 requires the domain package to remain a pure functional core free of Spring, Servlet, and Lombok dependencies.");
}
