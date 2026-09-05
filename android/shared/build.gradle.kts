import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// スマホ / ウォッチ共通のデータモデルと JSON コーデック。
// Android に依存しない純 Kotlin/JVM モジュールなので、JVM 単体テストで検証できる。
plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    api(libs.kotlinx.serialization.json)
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}
