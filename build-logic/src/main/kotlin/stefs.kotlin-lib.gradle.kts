plugins {
    id("org.jetbrains.kotlin.multiplatform")
    `maven-publish`
}

kotlin {
    jvmToolchain(17)

    jvm {
        testRuns["test"].executionTask.configure {
            useJUnitPlatform()
        }
    }
}

publishing {
    publications.withType<MavenPublication>().configureEach {
        pom {
            url.set("https://github.com/Stefs-Startup/monorepo")
        }
    }
}
