import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Android スマートフォン側 = CNS アプリ。
// CNS（Next.js の Web アプリ）を WebView で表示し、
// ウォッチ同期（Wearable Data Layer API）と音声（TTS / 音声認識）をネイティブで橋渡しする。
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "jp.tcta.cns.container.mobile"
    compileSdk = 36

    defaultConfig {
        // Data Layer API はスマホ側とウォッチ側で applicationId と署名が同一である必要がある。
        // :wear と必ず同じ値にすること。
        applicationId = "jp.tcta.cns.container"
        minSdk = 26
        targetSdk = 36
        versionCode = 8
        versionName = "1.7"
        // ネイティブコードを含まないため、生成される APK / AAB はそのまま 64bit 対応になる。

        // 表示する CNS の URL（GitHub Pages）。別の場所に置くときはここを変える
        buildConfigField("String", "CNS_URL", "\"https://tcta-tottori.github.io/Container/\"")
    }

    signingConfigs {
        // PC でも CI でも同じ署名になるよう、リポジトリの debug 鍵を使う（keystore/README.md）
        getByName("debug") {
            storeFile = rootProject.file("keystore/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }
}

// 出力ファイル名（例: cns-container-phone-debug.apk）。ウォッチ用と取り違えないように名前で区別する
base {
    archivesName.set("cns-container-phone")
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(project(":shared"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)

    implementation(libs.play.services.wearable)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)
}
