# `build-logic/` — Shared Gradle Convention Plugins

Included Gradle build providing standardized convention plugins and centralizing dependency management via the root version catalog ([`../gradle/libs.versions.toml`](../gradle/libs.versions.toml)).

## Convention Plugins

| Plugin ID | Target Modules | What It Configures |
| :--- | :--- | :--- |
| `stefs.android-app` | Android Compose apps (`apps/pulse/app`) | AGP + Kotlin + Compose compiler, compileSdk `35` / minSdk `28`, Java `17`, Android lint & unit test defaults |
| `stefs.jvm-service` | Spring Boot 4 services (`apps/pulse/backend`) | Java `21` toolchain, Spring Boot + dependency management, `-Xlint:all,-serial,-processing -parameters`, JUnit Platform |
| `stefs.kotlin-lib` | KMP libraries (`apps/pulse/kmp`, `apps/pulse/google-auth`) | Kotlin Multiplatform + `maven-publish` defaults, JVM `17` toolchain, JUnit Platform |

## Usage in New Gradle Builds

1. Include `build-logic` and point `libs` to the shared catalog in `settings.gradle.kts`:
   ```kotlin
   pluginManagement {
       includeBuild("../../build-logic")
   }
   dependencyResolutionManagement {
       versionCatalogs {
           create("libs") {
               from(files("../../gradle/libs.versions.toml"))
           }
       }
   }
   ```
2. Apply the single convention plugin ID in `build.gradle.kts`:
   ```kotlin
   plugins {
       id("stefs.jvm-service")
   }
   ```
3. Verify compilation via `./gradlew` in `apps/pulse` or `apps/pulse/backend`.
