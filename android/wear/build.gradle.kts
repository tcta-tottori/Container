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
        versionCode = 1
        versionName = "1.0"
        // ネイティブコードを含まないため、生成される APK / AAB はそのまま 64bit 対応になる。
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
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)

    // Compose for Wear OS（Material 3）
    implementation(libs.androidx.wear.compose.material3)
    implementation(libs.androidx.wear.compose.foundation)
    implementation(libs.androidx.wear.compose.navigation)
    implementation(libs.androidx.navigation.compose)

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
