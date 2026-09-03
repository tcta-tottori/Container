# Pixel Watch 4 向け コンテナ表示アプリ

スマートフォンで管理しているコンテナの荷物情報を Pixel Watch 4 で確認するための
Wear OS アプリ（読み取り専用）と、その送信元になるスマートフォンアプリ。

```
android/
├── shared/   共通データモデル + JSON コーデック（純 Kotlin/JVM、単体テストあり）
├── mobile/   スマートフォン側。Wearable Data Layer API で /container/status を更新する
└── wear/     Pixel Watch 側。一覧 / 詳細 / 荷物一覧 の 3 画面 + Tile
```

## 開発環境

| 項目 | 値 |
| --- | --- |
| Android Studio | Narwhal 3 Feature Drop (2025.1.3) 以降を推奨 |
| Gradle | 8.14.3（wrapper 同梱） |
| Android Gradle Plugin | 8.13.0 |
| Kotlin | 2.2.10（Compose Compiler plugin 同梱） |
| UI | Jetpack Compose / Compose for Wear OS Material 3 1.5.0 |
| Tile | androidx.wear.tiles 1.5.0 + ProtoLayout Material 3 1.3.0 |
| 同期 | play-services-wearable 19.0.0（DataClient） |
| compileSdk / targetSdk | 36 |
| minSdk | mobile 26 / wear 33（Wear OS 4 以上。Pixel Watch 4 は Wear OS 6 = API 36） |
| 64bit | ネイティブコードなし。生成される APK / AAB はそのまま 64bit 対応 |

ライブラリの版は `gradle/libs.versions.toml` にまとめてある。

## ビルド

Android Studio で `android/` フォルダを開く（リポジトリ直下ではなく `android/` を開く）。
Gradle Sync 後に run configuration で `mobile` と `wear` を選んで実行する。

コマンドライン:

```bash
cd android
./gradlew :shared:test                       # 共通モジュールの単体テスト
./gradlew :mobile:assembleDebug :wear:assembleDebug
```

GitHub Actions（`.github/workflows/android.yml`）でも同じビルドが走り、debug APK が成果物として残る。

### 実機での確認

1. スマホに `mobile`、Pixel Watch に `wear` をインストールする
   （**両方とも同じ applicationId `jp.tcta.cns.container` で、同じ鍵で署名されている必要がある**。
   デバッグビルドは同じ PC の debug keystore で署名されるので、そのまま通る）。
2. スマホアプリを開くと、サンプルデータを読み込んで自動的にウォッチへ送信する。
3. ウォッチアプリを開くとコンテナ一覧が出る。Tile 一覧に「コンテナ状況」を追加すると、
   選択中コンテナの積載率・残容量・ステータスが出る。Tile をタップすると詳細画面が開く。

## 同期のしくみ

```
mobile                                          wear
ContainerDataSource ──▶ ContainerSyncPayload ──▶ DataClient.putDataItem("/container/status")
                                                       │  (Wearable Data Layer API)
                                                       ▼
                                          ContainerDataListenerService.onDataChanged
                                                       │
                                                       ▼
                                          ContainerRepository (DataStore に JSON を保存)
                                               │                    │
                                               ▼                    ▼
                                       Compose 画面 (Flow)     Tile 更新要求
```

- DataItem のパスは `/container/status`。DataMap の `payload` キーに JSON 文字列を入れ、
  `generatedAt` に生成時刻を入れる（同じ内容を送り直しても変更として届くようにするため）。
- ウォッチは受信した JSON を DataStore にそのまま保存する。スマホと切断されていても
  最後に受信した内容を表示し、画面下部に「スマホ未接続 ・ 最後の受信内容」と受信時刻を出す。
- ウォッチアプリ起動時と「再読み込み」で Data Layer に残っている DataItem を読み直し、
  ListenerService が起動しなかった場合の取りこぼしを補う。
- 1 つの DataItem は 100 KB まで。超える場合は送信側で例外にしている（`WearSyncClient`）。

### JSON の形

```json
{
  "schemaVersion": 1,
  "generatedAt": 1756900100000,
  "selectedContainerId": "TCLU4021378",
  "containers": [
    {
      "id": "TCLU4021378",
      "name": "TCLU4021378（9/3 入荷）",
      "containerType": "40ft HC",
      "loadPercentage": 68.0,
      "remainingPercentage": 32.0,
      "totalQuantity": 1860,
      "itemCount": 6,
      "status": "荷降ろし中",
      "updatedAt": 1756900000000
    }
  ],
  "cargo": {
    "TCLU4021378": [
      { "id": "1", "name": "ポリカバー 30cm 白", "quantity": 480, "location": "前方 パレット1-3", "status": "完了" }
    ]
  }
}
```

`ContainerInfo` / `CargoItem` は `shared/src/main/kotlin/jp/tcta/cns/container/shared/` にある。
未知のキーは無視するので、スマホ側で先に項目を増やしても古いウォッチアプリは壊れない。

## 既存システムとの接続

`mobile/src/main/kotlin/jp/tcta/cns/container/mobile/data/ContainerDataSource.kt` が接続点。
現在は `SampleContainerDataSource`（CNS の品目を模したサンプル）を使っている。
実データに切り替えるときは `ContainerDataSource` を実装し、
`MobileViewModel` の `dataSource` を差し替える。返す内容は `ContainerRecord`（`ContainerInfo` + `List<CargoItem>`）のリスト。

## Wear OS 画面

| 画面 | 内容 |
| --- | --- |
| 一覧 | カードごとにコンテナ名・積載率バー・残容量・ステータス。タップで詳細へ |
| 詳細 | 円形ゲージ（積載率）、コンテナ番号・形態・積載率・残容量・荷物数・SKU 数・状態・更新時刻、荷物一覧ボタン |
| 荷物一覧 | 品名・数量・位置・状態 |

右スワイプで前の画面に戻る（`SwipeDismissableNavHost`）。
`ScreenScaffold` + `ScalingLazyColumn` で丸型ディスプレイの上下に余白を取り、
`AppScaffold` の `TimeText` で時刻を常時表示する。

## Tile

`wear/.../tile/ContainerTileService.kt` と `ContainerTileLayout.kt`。
`ContainerSyncPayload.selectedContainerId` のコンテナ（無ければ先頭）を表示する。
新しいデータを保存するたびに `TileService.getUpdater(...).requestUpdate(...)` で再描画を要求する。
Tile のどこをタップしても、コンテナ ID を Intent extra に付けて `MainActivity` を開き、詳細画面へ遷移する。

## 次の段階（未実装）

現状は読み取り専用。以下は今後の拡張ポイント。

- ウォッチからの操作（パレット数の減算、品目の切り替え）を `MessageClient` でスマホへ送り、
  スマホ側の表示も追従させる（双方向同期）
- 経過時間（作業タイマー）や機種名、残り箱数・端数など CNS 作業画面の項目を `ContainerInfo` / `CargoItem` に追加する
- 100 KB を超える大きなデータの Asset 分割
