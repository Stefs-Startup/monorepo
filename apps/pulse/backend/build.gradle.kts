plugins {
    java
    id("org.springframework.boot") version "4.1.2"
    id("io.spring.dependency-management") version "1.1.7"
    id("info.solidsoft.pitest") version "1.15.0"
    id("org.openrewrite.rewrite") version "7.39.0"
}

group = "com.pulse"
version = "0.6.0"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-actuator")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("com.tngtech.archunit:archunit-junit5:1.3.0")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    rewrite("org.openrewrite.recipe:rewrite-spring:6.37.1")
}

rewrite {
    val activeRecipesProp = providers.gradleProperty("rewrite.activeRecipes")
    if (activeRecipesProp.isPresent) {
        activeRecipe(
            *activeRecipesProp.get()
                .split(",")
                .map { it.trim() }
                .filter { it.isNotEmpty() }
                .toTypedArray()
        )
    } else {
        activeRecipe(
            "org.openrewrite.java.spring.boot4.SpringBootProperties_4_1",
            "org.openrewrite.java.spring.boot4.SpringBootProperties_4_0",
            "org.openrewrite.java.spring.boot4.MigrateToModularStarters",
            "org.openrewrite.java.spring.boot4.ReplaceMockBeanAndSpyBean",
            "org.openrewrite.java.spring.boot4.RelocateWebServerClasses",
            "org.openrewrite.java.spring.boot4.RenameDeprecatedStartersManagedVersions",
            "org.openrewrite.java.spring.security7.SecurityConfigurerRemoveThrowsException",
            "org.openrewrite.java.spring.NoRequestMappingAnnotation",
            "org.openrewrite.java.spring.NoAutowiredOnConstructor",
            "org.openrewrite.java.spring.PropertiesToKebabCase",
            "org.openrewrite.java.spring.framework.BeanMethodsNotPublic"
        )
    }
}

pitest {
    junit5PluginVersion.set("1.2.1")
    targetClasses.set(setOf("com.pulse.backend.domain.*"))
    targetTests.set(setOf("com.pulse.backend.domain.*"))
    threads.set(4)
    outputFormats.set(setOf("XML", "HTML"))
    timestampedReports.set(false)
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
    options.compilerArgs.addAll(listOf("-Xlint:all,-serial,-processing", "-parameters"))
}

tasks.register("codeQuality") {
    group = "verification"
    description = "Runs Java 21 compiler lint checks and audits ADR-007 pure domain boundaries."
    dependsOn("compileJava", "compileTestJava")
    doLast {
        val domainDir = file("src/main/java/com/pulse/backend/domain")
        val violations = mutableListOf<String>()
        domainDir.walkTopDown()
            .filter { it.isFile && it.extension == "java" }
            .forEach { srcFile ->
                val text = srcFile.readText()
                if (text.contains("import org.springframework.") || text.contains("import jakarta.servlet.")) {
                    violations.add("${srcFile.name}: Pure domain class must not import Spring or Servlet APIs (ADR-007).")
                }
                if (text.contains("import lombok.")) {
                    violations.add("${srcFile.name}: Use Java 21 records/sealed interfaces instead of Lombok.")
                }
            }
        if (violations.isNotEmpty()) {
            throw GradleException("Spring Boot 4 / Java 21 Code Quality failed:\n" + violations.joinToString("\n"))
        }
        println("PASS Spring Boot 4 / Java 21 codeQuality: pure domain boundaries and compiler lint verified.")
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}
