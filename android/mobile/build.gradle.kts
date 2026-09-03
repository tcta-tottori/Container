import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Android スマートフォン側。
// 既存のコンテナ管理システムのデータを Wearable Data Layer API でウォッチへ送る。
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
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

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.core)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)

    implementation(libs.play.services.wearable)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)
}
