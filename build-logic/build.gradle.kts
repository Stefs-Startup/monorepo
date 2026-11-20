plugins {
    `kotlin-dsl`
}

group = "com.stefs.buildlogic"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

dependencies {
    implementation(libs.android.gradlePlugin)
    implementation(libs.kotlin.gradlePlugin)
    implementation(libs.compose.gradlePlugin)
    implementation(libs.spring.boot.gradlePlugin)
    implementation(libs.spring.dependency.management.gradlePlugin)
}
