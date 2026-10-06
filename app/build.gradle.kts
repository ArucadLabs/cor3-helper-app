plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val geckoviewVersion: String by project

android {
    namespace = "app.cor3.helper"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.cor3.helper"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
        // Your RedMagic 10 Pro is arm64; this keeps the APK much smaller.
        ndk { abiFilters += listOf("arm64-v8a") }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    packaging { jniLibs { useLegacyPackaging = true } }
    // keep the extension files untouched
    androidResources { noCompress += listOf("js", "json", "html", "css", "png") }
    // lintVital crashes on Windows ("Failed to stop service LintClassLoaderBuildService") and adds nothing here.
    lint { checkReleaseBuilds = false }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

dependencies {
    implementation("org.mozilla.geckoview:geckoview-arm64-v8a:$geckoviewVersion")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
