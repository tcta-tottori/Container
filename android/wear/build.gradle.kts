import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Pixel Watch 側。受信したコンテナ情報を表示し、Tile を提供する。
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "jp.tcta.cns.container.wear"
    compileSdk = 36

    defaultConfig {
        // :mobile と同じ applicationId（Data Layer API の要件）
        applicationId = "jp.tcta.cns.container"
        // Wear OS 4 (Android 13) 以上。Pixel Watch 4 は Wear OS 6 (API 36) で出荷されるが、
        // 現行の Pixel Watch シリーズがすべて動く下限として 33 にしている。
        minSdk = 33
        targetSdk = 36
        versionCode = 5
        versionName = "1.4"
        // ネイティブコードを含まないため、生成される APK / AAB はそのまま 64bit 対応になる。
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
        compose = true
    }
}

// 出力ファイル名（例: cns-container-watch-debug.apk）。スマホ用と取り違えないように名前で区別する
base {
    archivesName.set("cns-container-watch")
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(project(":shared"))

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    // Compose 本体（版は BOM で揃える）
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.animation)
    implementation(libs.androidx.compose.material.icons.core)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)

    // Compose for Wear OS（Material 3）
    implementation(libs.androidx.wear.compose.material3)
    implementation(libs.androidx.wear.compose.foundation)

    // Tile（ProtoLayout Material 3）
    implementation(libs.androidx.wear.tiles)
    implementation(libs.androidx.wear.protolayout)
    implementation(libs.androidx.wear.protolayout.expression)
    implementation(libs.androidx.wear.protolayout.material3)
    implementation(libs.androidx.concurrent.futures)

    // 受信データのローカル保存
    implementation(libs.androidx.datastore.preferences)

    // Wearable Data Layer API
    implementation(libs.play.services.wearable)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)
}
