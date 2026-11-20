plugins {
    id("stefs.kotlin-lib")
    alias(libs.plugins.kotlin.serialization)
}

group = "com.stefs.googleauth"
version = "0.1.0"

kotlin {
    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation(libs.kotlinx.serialization.json)
                implementation(libs.kotlinx.datetime)
            }
        }
        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
            }
        }
        val jvmMain by getting {
            dependencies {
                implementation(libs.okhttp)
                implementation(libs.kotlinx.coroutines.android)
            }
        }
        val jvmTest by getting {
            dependencies {
                implementation(kotlin("test-junit5"))
                implementation(libs.kotlinx.coroutines.test)
            }
        }
    }
}
