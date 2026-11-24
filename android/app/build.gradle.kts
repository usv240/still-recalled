import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services")
}

// local.properties is gitignored. It may hold:
//   appcheck.debugToken  an App Check debug token, used by debug builds only (emulators, development)
//   signing.storeFile, signing.storePassword, signing.keyAlias, signing.keyPassword  the release signing key
val local = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val debugToken: String = local.getProperty("appcheck.debugToken", "")

android {
    namespace = "app.web.stillrecalled"
    compileSdk {
        version = release(37) { minorApiLevel = 2 }
    }

    defaultConfig {
        applicationId = "app.web.stillrecalled"
        minSdk = 26
        targetSdk = 36
        versionCode = 9
        versionName = "0.13.1"
        buildConfigField("String", "BRIDGE_URL", "\"https://still-recalled.web.app/appcheck-bridge.html?android=1\"")
    }

    signingConfigs {
        create("release") {
            val store = local.getProperty("signing.storeFile")
            if (store != null) {
                storeFile = rootProject.file(store)
                storePassword = local.getProperty("signing.storePassword")
                keyAlias = local.getProperty("signing.keyAlias")
                keyPassword = local.getProperty("signing.keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            // A debug build uses Firebase's debug App Check provider when a token is set in local.properties; it is
            // never in a release build, which gets App Check tokens from the site's reCAPTCHA Enterprise bridge.
            resValue("string", "firebase_app_check_debug_token", debugToken)
            buildConfigField("boolean", "DEBUG_APPCHECK", (debugToken.isNotEmpty()).toString())
        }
        release {
            isMinifyEnabled = false
            buildConfigField("boolean", "DEBUG_APPCHECK", "false")
            if (local.getProperty("signing.storeFile") != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
        resValues = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // The recall cards are already compact JSON; storing them uncompressed lets the engine read them faster.
    androidResources {
        noCompress += listOf("json")
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    // Firebase AI Logic, with hybrid inference (Gemini Nano through ML Kit / AICore, or Gemini in the cloud).
    implementation("com.google.firebase:firebase-ai:18.2.0")
    implementation("com.google.firebase:firebase-ai-ondevice:16.0.0-beta08")
    implementation("com.google.firebase:firebase-appcheck:20.1.0")
    // Only development builds carry the debug provider.
    debugImplementation("com.google.firebase:firebase-appcheck-debug:20.1.0")
    implementation("com.google.firebase:firebase-config:24.0.1")
    // The shared field guide (FieldGuide.kt): Cloud Firestore, with anonymous Firebase Authentication. Versions as in
    // Firebase BoM 35.2.0, which pairs them with the AI Logic, App Check and Remote Config versions above.
    implementation("com.google.firebase:firebase-firestore:27.2.0")
    implementation("com.google.firebase:firebase-auth:25.0.0")

    // The shared rules engine runs in Jetpack's JavaScript sandbox.
    implementation("androidx.javascriptengine:javascriptengine:1.1.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-guava:1.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.11.0")
    // Function calling passes arguments and results as kotlinx.serialization JSON (Firebase AI Logic's own types).
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")

    implementation("androidx.webkit:webkit:1.18.0")
    implementation("androidx.work:work-runtime-ktx:2.12.0")
    implementation("androidx.core:core-ktx:1.19.1")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.11.1")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.11.1")
    implementation(platform("androidx.compose:compose-bom:2026.11.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("io.coil-kt.coil3:coil-compose:3.6.3")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.6.3")
}
