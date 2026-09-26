pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "ContainerWatch"

// :shared  … スマホ / ウォッチ共通のデータモデルと JSON コーデック（純 Kotlin/JVM）
// :mobile  … Android スマートフォン側。Data Layer API でウォッチへ送信する
// :wear    … Pixel Watch 側。受信したコンテナ情報を表示する + Tile
include(":shared", ":mobile", ":wear")
