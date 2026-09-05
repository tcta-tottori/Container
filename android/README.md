# CNS Android アプリと Pixel Watch 4 向けウォッチアプリ

CNS（コンテナ荷降ろしの Web アプリ）を Android アプリとして動かし、
その作業状態を Pixel Watch 4 で確認するための Wear OS アプリ（読み取り専用）。

```
android/
├── shared/   共通データモデル + JSON コーデック（純 Kotlin/JVM、単体テストあり）
├── mobile/   CNS アプリ。CNS（Web）を WebView で表示し、ウォッチ同期と音声をネイティブで橋渡しする
└── wear/     Pixel Watch 側。一覧 / 詳細 / 作業画面（ダイヤル）の 3 画面 + Tile
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

### 実機での確認（Pixel Watch 4 への入れ方と動かし方）

Pixel Watch には USB 端子が無いので、ウォッチへのインストールは **Wi-Fi 経由の ADB** で行う。
PC・ウォッチを同じ Wi-Fi につないでおく。スマホは USB でつなぐ。

#### 1. ウォッチ側の準備（初回のみ）

1. ウォッチの **設定 → システム → デバイス情報 → バージョン** を開き、**ビルド番号を 7 回タップ**して開発者向けオプションを有効にする。
2. **設定 → 開発者向けオプション** で **ADB デバッグ** と **ワイヤレス デバッグ** をオンにする。
3. **ワイヤレス デバッグ → 新しいデバイスとペア設定** を開くと、ペア設定コードと `IP:ポート` が出る。

#### 2. PC からウォッチへ接続

Android Studio の場合: **Device Manager → 「Pair Devices Using Wi-Fi」→ Wear タブ** で、
ウォッチに出ている 6 桁のコードを入力する。以後は端末一覧にウォッチが出る。

コマンドラインの場合（`adb` は Android Studio の SDK に同梱。`~/Library/Android/sdk/platform-tools` や `%LOCALAPPDATA%\Android\Sdk\platform-tools`）:

```bash
adb pair 192.168.1.23:41234      # 「新しいデバイスとペア設定」に出た IP:ポート。続けてコードを入力
adb connect 192.168.1.23:38765   # 「ワイヤレス デバッグ」画面の上のほうに出ている IP:ポート（ペア用とは別）
adb devices                      # ウォッチとスマホの両方が出れば OK
```

ペア設定は初回だけでよく、2 回目以降は `adb connect` だけで済む（ウォッチを再起動するとポートが変わる）。

#### 3. インストール

Android Studio: run configuration で **`wear`** を選び、対象デバイスにウォッチを選んで ▶ Run。
同様に **`mobile`** を選び、対象にスマホを選んで ▶ Run。

コマンドライン:

```bash
cd android
./gradlew :wear:installDebug     # ウォッチだけがつながっているとき。複数台なら下の adb -s を使う
./gradlew :mobile:installDebug

# 端末を指定する場合
adb devices                                   # シリアル（Wi-Fi の場合は IP:ポート）を確認
adb -s 192.168.1.23:38765 install -r wear/build/outputs/apk/debug/cns-container-watch-debug.apk
adb -s <スマホのシリアル>     install -r mobile/build/outputs/apk/debug/cns-container-phone-debug.apk
```

GitHub Actions の成果物 `debug-apks`（zip）を落として `adb install -r` してもよい。

> **署名の注意**: Data Layer API は、スマホ側とウォッチ側のアプリが **同じ applicationId かつ同じ鍵で署名されている**ときだけ通信できる。
> debug ビルドはリポジトリの `keystore/debug.keystore` で署名するので、PC でビルドしたものも GitHub Actions の成果物も同じ署名になる。
> それより前（この鍵を入れる前）の APK は鍵が違うため、**一度アンインストールしてから**入れ直すこと。

#### 4. 動かし方

1. スマホと Pixel Watch が **Pixel Watch アプリでペアリング済み**で、Bluetooth がオンになっていることを確認する（Data Layer はこのペアリング経路で通信する）。
2. スマホで「コンテナ ウォッチ同期」を開く。起動時にサンプルデータを読み込み、自動でウォッチへ送信する。
   画面上部に「送信済み hh:mm（n バイト）」「接続中のウォッチ: Pixel Watch」と出れば送れている。
   コンテナのラジオボタンを切り替えると、そのコンテナが Tile の表示対象になり、切り替えのたびに再送する。
3. ウォッチで（リューズを押してアプリ一覧から）**「コンテナ」** を開く。
   一覧 → カードをタップで詳細 → 「荷物一覧」ボタンで荷物一覧。右へスワイプで戻る。
   何も届いていなければ「データ未受信」と出るので、スマホ側で送信してから「再読み込み」を押す。
4. Tile を追加する: ウォッチの文字盤で **Tile を長押し**（または文字盤から左右にスワイプして Tile の端まで行き）→ **「＋」** → **「コンテナ状況」** を選ぶ。
   スマホの Pixel Watch アプリ → **タイル** からも追加できる。Tile をタップすると詳細画面が開く。

#### PC を使わずにスマホだけで入れる

ウォッチへの書き込みは ADB が必要だが、ADB はスマホ上でも動かせる。流れは次のとおり。

1. **APK を用意する**: スマホのブラウザで GitHub にログインし、Actions の実行結果から成果物 `debug-apks`（zip）をダウンロードして
   Files アプリで展開する。`cns-container-phone-debug.apk` と `cns-container-watch-debug.apk` は **同じ実行のもの**を組で使う（署名が揃う）。
2. **スマホ側アプリ**: `cns-container-phone-debug.apk` をタップしてインストールする（「提供元不明のアプリ」を許可する）。
3. **ウォッチ側の準備**: 上の「1. ウォッチ側の準備」と同じ（開発者向けオプション → ADB デバッグ / ワイヤレス デバッグ をオン）。
   スマホとウォッチは同じ Wi-Fi につなぐ。
4. **スマホから ADB で書き込む**。どちらかを使う。
   - **Wear Installer 2**（Play ストア）: ウォッチの「新しいデバイスとペア設定」に出る IP・ポート・コードを入力してペアリングし、
     `cns-container-watch-debug.apk` を選んでインストールする。画面操作だけで済む。
   - **Termux**（F-Droid または GitHub 版）: `pkg install android-tools` のあと、PC と同じコマンドを打つ。

     ```bash
     termux-setup-storage                    # Download フォルダを見えるようにする（初回）
     adb pair 192.168.1.23:41234             # ペア設定画面の IP:ポート → コードを入力
     adb connect 192.168.1.23:38765          # ワイヤレス デバッグ画面の IP:ポート
     adb install -r ~/storage/downloads/cns-container-watch-debug.apk
     ```
5. あとは「4. 動かし方」と同じ。

Play ストアから入れたい場合は、Play Console の内部テストに両アプリを登録する必要がある
（開発者アカウントと release 署名鍵が要る）。運用に乗せるときはこちらが確実。

#### 5. うまく動かないとき

```bash
adb -s <ウォッチ> logcat -s ContainerDataListener ContainerRepository   # 受信ログ
adb -s <ウォッチ> shell pm list packages | grep jp.tcta.cns.container     # インストール確認
```

- **「アプリはインストールされていません」と出る**（APK をタップしたとき）
  - `cns-container-watch-debug.apk` はウォッチ専用（`android.hardware.type.watch` が必須）なので、スマホには入らない。スマホには `cns-container-phone-debug.apk` を入れる。
  - すでに入っているアプリと署名が違う（古い CI 成果物や別 PC のビルド）と上書きできない。設定 → アプリ から「コンテナ ウォッチ同期」を
    アンインストールしてから入れ直す。ウォッチ側も同様（`adb uninstall jp.tcta.cns.container` か、ウォッチの設定 → アプリ から削除）。
  - ウォッチ側で `adb install` が `INSTALL_FAILED_UPDATE_INCOMPATIBLE` になるのも同じ原因。
- **送信は成功しているのにウォッチに届かない**: 署名が違う（上の注意）か、スマホとウォッチがペアリングされていない。
  両方をいったんアンインストールして入れ直す。
- **「送信できませんでした」になる**: スマホに Google Play 開発者サービスが無い（一部のエミュレータ）。実機を使う。
- **ウォッチが `adb devices` に出ない / offline**: 同じ Wi-Fi か確認し、ウォッチ側で「ワイヤレス デバッグ」を一度オフ→オンして `adb connect` し直す。
- **Tile が更新されない**: ウォッチのアプリを一度開くと Data Layer を読み直して Tile も更新される。
  Tile は新しいデータを保存したときに更新要求を出しているので、通常は数秒で反映される。
- **エミュレータで試す場合**: Android Studio の Device Manager で Wear OS 用と Phone 用の仮想デバイス（どちらも Google Play 入り）を作り、
  Device Manager の **Pair Wearable** でペアリングする。物理端末と同じ手順で動く。

## 同期のしくみ

```
CNS (Web, src/lib/watchSync.ts)                    mobile (Android)                      wear
作業状態 → ContainerSyncPayload の JSON ──▶ window.CNSWatch.postSync(json) ──▶ DataClient.putDataItem("/container/status")
                                                                                          │ (Wearable Data Layer API)
                                                                                          ▼
                                                                    ContainerDataListenerService.onDataChanged
                                                                                          │
                                                                                          ▼
                                                                    ContainerRepository (DataStore に JSON を保存)
                                                                         │                    │
                                                                         ▼                    ▼
                                                                 Compose 画面 (Flow)     Tile 更新要求
```

- CNS 側は `src/lib/watchSync.ts` が作業状態（コンテナ・現在の品目・パレット減算・完了・タイマー・気温湿度）から
  `ContainerSyncPayload` と同じ形の JSON を作り、`window.CNSWatch.postSync` に渡す。300ms のあいだの連続変更は 1 回にまとめ、
  内容が変わっていなければ送らない。ブラウザで開いているとき（橋渡しが無いとき）は何もしない。
- mobile 側は `bridge/WatchBridge.kt` が JSON を受け取り、DataItem のパス `/container/status` に書く。DataMap の `payload` キーに JSON 文字列、
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
      "totalPallets": 19,
      "totalCartons": 37,
      "itemCount": 7,
      "status": "荷降ろし中",
      "updatedAt": 1756900000000,
      "startedAt": 1756897360000
    }
  ],
  "cargo": {
    "TCLU4021378": [
      { "id": "2", "name": "ポリカバー 36cm 白", "quantity": 840,
        "palletCount": 7, "cartonCount": 0, "itemType": "ポリカバー",
        "modelName": "JPV-H100", "remainingPercentage": 40.0, "warning": "類似品あり（30cm 白）",
        "location": "前方 パレット5-11", "status": "作業中" }
    ]
  },
  "environment": { "temperatureC": 24.0, "humidityPercent": 86, "measuredAt": 1756900050000 }
}
```

- `modelName`（機種名）は作業画面で大きく出す。無ければ `name` を出す。
- `remainingPercentage`（残り割合）は作業画面のリングと「● 100%」バッジに使う。無ければ状態を出す。
- `warning` があると作業画面の右上に警告マークが付く。
- `startedAt`（作業開始時刻）があると経過時間を数える。`environment` があると気温・湿度を出す。

- 数量の表示は **パレットと端数カートンだけ**（例: `1PL 5CT`）。`quantity` / `totalQuantity`（個数）は同期するが画面には出さない。
- `itemType` は元のコンテナアプリの種類（ポリカバー / ジャーポット / 箱 / 部品 / 鍋 / ヤーマン部品 / その他）。
  色は `shared/.../ItemTypes.kt` にあり、Web アプリの `src/data/colorMap.ts` と同じ値。未知の値と null は「その他」の色になる。

`ContainerInfo` / `CargoItem` は `shared/src/main/kotlin/jp/tcta/cns/container/shared/` にある。
未知のキーは無視するので、スマホ側で先に項目を増やしても古いウォッチアプリは壊れない。

## CNS アプリ（mobile）のしくみ

`mobile/.../MainActivity.kt` が CNS（既定は `https://tcta-tottori.github.io/Container/`、`build.gradle.kts` の `CNS_URL`）を
WebView で全画面表示する。CNS の Web コードはブラウザ向けのまま変えていない。

| 橋渡し | 役割 |
| --- | --- |
| `window.CNSWatch`（`bridge/WatchBridge.kt`） | CNS からの JSON をウォッチへ送る |
| `window.CNSNative`（`bridge/NativeSpeechBridge.kt`） | 読み上げ（Android TextToSpeech）と音声認識（Android SpeechRecognizer。Android 12 以上で端末内認識があればそれを優先） |
| `assets/cns-native-polyfill.js` | WebView には無い `speechSynthesis` / `SpeechRecognition` を上の橋渡しで組み立てる。各ページの先頭で注入 |

そのほか: ファイル選択（Excel・写真）の `<input type="file">` 対応、マイク権限の要求、画面を消さない設定、
オフライン時はキャッシュから起動、CNS 以外のリンクはブラウザで開く。

ファイル選択は絞り込みをせず全ファイルを見せる（`MainActivity.buildFileChooserIntent`）。
WebView 既定の `createIntent()` は accept 属性の拡張子を MIME 型に直して絞り込むが、
Android は `.xlsm`（マクロ付きブック）の MIME 型を知らないため、そのままだと xlsm が一覧に出てこない。
どの形式を読むかは CNS 側（`src/lib/fileClassifier.ts` の `EXCEL_EXTENSIONS`）が拡張子で判断する。

制限:

- Google Drive の取り込みは、Google が WebView 内の OAuth ログインを許可していないため使えない。
  端末のファイル選択（Files アプリ・Google Drive アプリからの選択）で Excel を読み込む。
- 読み上げは端末の日本語 TTS エンジンを使う。Gemini TTS / sherpa-onnx は Web 側でそのまま動く。
- 音声認識は Google の音声認識サービス（または端末内認識）を使う。開始時に短い効果音が鳴る端末がある。

## Wear OS 画面

画面は 2 つだけ。アプリを開くと、荷降ろし中のコンテナがあれば作業画面へ直行し、無ければ待機画面を出す。

| 画面 | 内容 |
| --- | --- |
| 待機画面 | 画面の真ん中に固定の再読込ボタンと、今の状態（未接続 / データ未受信 / 荷降ろし中のコンテナなし）。スマホで荷降ろしが始まれば受信と同時に作業画面へ切り替わる |
| 作業画面（部品表示） | 全画面に 1 品目。背景は種類の色で塗りつぶし、文字は白か黒（背景の明るさで選ぶ）。上から 種類 / 機種名（枠に収まらなければ横へ流す）/ PL・CT の大きな数字 / 気温・湿度、下端に経過時間と、一覧を引き出せる目印 |
| 作業画面（一覧） | 機種名と PL / CT / PCS を、角を丸めたバーで並べる。タップするとその品目に切り替わり、部品表示へ戻る |

**操作は縦だけ**にしてある。横スワイプはウォッチの「戻る」がそのまま働く（アプリが閉じる）。

- 部品表示で縦に払う … 品目を切り替える（上へ払うと次、下へ払うと前。端まで行くと反対の端へ回る）
- 部品表示のいちばん下から上へ払う … 一覧を開く
- 一覧のいちばん上からさらに下へ、またはいちばん下からさらに上へ払う … 部品表示へ戻る

丸い画面の縁で文字が見づらくならないよう、上下をうっすら暗くしている（`Components.kt` の `EdgeScrim`）。
現在時刻は `AppScaffold(timeText = { TimeText() })` で常に画面上部に出す。
作業画面のあいだは画面を消さない（`FLAG_KEEP_SCREEN_ON`）。腕を下ろしても表示が残る。
待機画面ではふだんどおり消えるので、荷降ろしをしていない間は電池を使わない。

### ウォッチからの操作（スマホと双方向）

部品表示と一覧はタップで CNS を動かす。ウォッチ側では数字を書き換えず、CNS からの同期で更新する
（画面の値が CNS と食い違わないようにするため）。

| 操作 | 送るコマンド | CNS 側の処理 |
| --- | --- | --- |
| 部品表示を 1 回タップ | `decrementPallet` | パレットを 1 枚減らす（画面の 1 回タップと同じ。残数コールも鳴る）|
| 部品表示を 2 回タップ | `incrementPallet` | パレットを 1 枚戻す |
| 一覧のバーをタップ | `selectItem` | その品目に切り替える（スマホの画面も追従する）|
| 部品表示を縦スワイプ | `selectItem` | 前後の品目に切り替える（上へ払うと次、下へ払うと前。端まで行くと反対の端へ回る）|

1 回タップは 2 回目が来ないと確定しないので 260ms 待ってから送る（CNS の `usePalletTap` と同じ）。
送信は `MessageClient`（パス `/container/command`）で、スマホ側は `WatchCommandReceiver` が受けて
`window.CNSWatchCommand` に渡し、CNS が `handleDecrease` / `handleIncrease` / `handleSelectItem` を呼ぶ。
対象の品目が CNS の現在品目と違うときは、まず切り替えるだけにして誤操作を防いでいる。
CNS アプリが前面にないときは届かない（そのときウォッチの表示は変わらない）。

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
- Google Drive 取り込みをアプリ内で使えるようにする（Chrome Custom Tabs での認証など）
- ウォッチからの品目の完了操作
- 100 KB を超える大きなデータの Asset 分割
