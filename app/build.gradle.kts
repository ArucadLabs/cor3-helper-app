import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val geckoviewVersion: String by project
val appVersionName: String by project   // e.g. 1.0.2 (set in gradle.properties; must match the release tag)

// versionCode = major*10000 + minor*100 + patch, so every new release is an upgrade for Android.
val appVersionCode = appVersionName.split(".").let { p ->
    p[0].toInt() * 10000 + p.getOrElse(1) { "0" }.toInt() * 100 + p.getOrElse(2) { "0" }.toInt()
}

// Release signing key. Same key on every release, so new APKs install over old ones and keep the login.
// CI: KEYSTORE_FILE / KEYSTORE_PASSWORD / KEY_ALIAS env vars (from GitHub Secrets).
// Local: keystore.properties in the project root (git-ignored). If neither exists, the debug key is used.
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val releaseStoreFile: String? = System.getenv("KEYSTORE_FILE") ?: keystoreProps.getProperty("storeFile")
val releaseStorePassword: String? = System.getenv("KEYSTORE_PASSWORD") ?: keystoreProps.getProperty("storePassword")
val releaseKeyAlias: String? = System.getenv("KEY_ALIAS") ?: keystoreProps.getProperty("keyAlias")
val releaseKeyPassword: String? = System.getenv("KEY_PASSWORD") ?: keystoreProps.getProperty("keyPassword") ?: releaseStorePassword
val hasReleaseKey = releaseStoreFile != null && file(releaseStoreFile).exists() &&
    releaseStorePassword != null && releaseKeyAlias != null

android {
    namespace = "app.cor3.helper"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.cor3.helper"
        minSdk = 26
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName
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
    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                storeFile = file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName(if (hasReleaseKey) "release" else "debug")
        }
        // Android Studio "Run" builds debug; signing it with the same key lets it update the release build and vice versa.
        if (hasReleaseKey) {
            getByName("debug") { signingConfig = signingConfigs.getByName("release") }
        }
    }
}

dependencies {
    implementation("org.mozilla.geckoview:geckoview-arm64-v8a:$geckoviewVersion")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
