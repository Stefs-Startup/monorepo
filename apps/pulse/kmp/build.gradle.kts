import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl

plugins {
    kotlin("multiplatform") version "2.1.0"
    kotlin("plugin.serialization") version "2.1.0"
}

group = "com.pulse.kmp"
version = "0.6.5"

kotlin {
    jvmToolchain(17)

    jvm {
        testRuns["test"].executionTask.configure {
            useJUnitPlatform()
        }
    }

    @OptIn(ExperimentalWasmDsl::class)
    wasmJs {
        moduleName = "pulse-kmp-web"
        browser()
        binaries.executable()
    }

    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
                implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.6.1")
            }
        }
        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
            }
        }
        val jvmTest by getting {
            dependencies {
                implementation(kotlin("test-junit5"))
            }
        }
    }
}

tasks.register("codeQuality") {
    group = "verification"
    description = "Audits ADR-008 & ADR-009 KMP commonMain purity (zero java.time.*, java.util.UUID, or android.* imports) and compiles all KMP targets."
    dependsOn("compileCommonMainKotlinMetadata", "compileKotlinJvm", "compileKotlinWasmJs")
    doLast {
        val commonMainDir = file("src/commonMain/kotlin")
        val bannedPatterns = listOf(
            Regex("""import\s+java\.time\."""),
            Regex("""import\s+java\.util\.UUID"""),
            Regex("""import\s+android\.""")
        )
        val violations = mutableListOf<String>()
        commonMainDir.walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .forEach { ktFile ->
                val text = ktFile.readText()
                bannedPatterns.forEach { pattern ->
                    if (pattern.containsMatchIn(text)) {
                        violations.add("${ktFile.name}: Banned non-multiplatform import matching '${pattern.pattern}' in commonMain (ADR-008).")
                    }
                }
            }
        if (violations.isNotEmpty()) {
            throw GradleException("KMP commonMain purity check failed:\n" + violations.joinToString("\n"))
        }
        println("PASS KMP codeQuality: commonMain purity (ADR-008) and JVM + wasmJs compilation verified.")
    }
}
