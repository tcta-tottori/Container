# Container Navigation System (CNS)

コンテナ荷降ろし作業を支援するWebアプリケーション。
Excelファイルから品目データを読み込み、リアルタイムの作業追跡・音声認識・読み上げ機能を提供する。　

## 主な機能

### 作業モード
- 品目の大型表示（品名・種類・色バッジ・パレット図）
- **端数パレットの全画面表示**: 残りが端数パレットだけになると、画面に出ているパレットの位置から
  全画面へ1.4秒かけてゆっくり移動し、積み方を見せる。背景は明るさを変えずガウスぼかし（`blur(18px)`）だけを掛ける。
  横スワイプで回転（画面幅いっぱいのスワイプで180度）、触っていない間は 14度/秒 でゆっくり自動回転する。
  図の外をタップすると元の位置へ戻る。実装は `src/components/ItemDetailPanel.tsx`。
- アイソメトリック3Dパレット図（汎用5+4配置 / ジャーポット互い違い配置）
- パレット枚数・端数ケース・総数のリアルタイム表示
- スワイプ操作（左→完了、右→取り消し）
- 類似品目の警告表示（色違い・1文字違い）

### 音声制御
- 日本語音声認識（Web Speech API）
- 音声コマンド: 次/前/完了/読み上げ/増減/数量確認/残数確認
- 品目切り替え時の自動読み上げ（ON/OFF切替可能）
- 品目ごとの完了コールは行わない（作業テンポ優先）。全品目完了時のみ「全品目の荷降ろしが完了しました」とコールする

#### 気温・暑さ指数のコール
天気コール（🌦ボタン / 「天気」）・気温コール（「気温」）・10分ごとの定期コールでは、
気温・湿度・暑さ指数（WBGT）と警戒レベル（危険／厳重警戒／警戒／注意／ほぼ安全）を読み上げる。

- **SwitchBot 接続中は実測値を優先**: SwitchBot 温湿度計をスキャン中で、かつ最終受信から10分以内なら、
  気象庁データではなく実測の気温・湿度・WBGT でコールする（それ以外は気象庁データ）。
- **警戒レベルに応じた注意喚起**: 警戒（WBGT 25以上）で「水分補給をしてください」、
  厳重警戒（28以上）で「こまめに休憩と水分補給をしてください」、危険（31以上）で「作業を中断して休憩してください」を付加。
- 実装: `src/lib/weatherNews.ts` の `climateToSpeech` / `wbgtAdviceToSpeech`。

### 作業用BGM（水の流れる音）
作業中に流す水音。ヘッダーの 💧 ボタンをタップで再生／停止、長押し（右クリック）またはメニュー →「水の音」で設定パネルを開く。

- **音源**: 実録音の水の流れる音。30秒のシームレスループ素材（`public/sounds/water-loop.mp3` / MP3 128kbps モノラル・約470KB）。
  末尾2秒を先頭へ等パワークロスフェードして作成しているため、継ぎ目でクリックノイズが出ない。
- **フェードイン・アウト**: 再生開始と停止はS字カーブ（ease-in-out）でなめらかに出入りする。フェード時間は 0.5〜12秒で調整可能。
- **自動ダッキング**: 音声コール中は BGM の音量を自動で下げ、コール終了後に戻す
- **自動再開**: 「次回起動時も自動で流す」をオンにすると、次回起動後の最初の操作で再生を再開する（ブラウザの自動再生制限に対応）
- **ループ位置**: 再生のたびにループ区間内のランダムな位置から鳴らすため、毎回同じ出だしにならない
- 実装: `src/lib/waterSound.ts`（再生エンジン）、`src/hooks/useWaterSound.ts`、`src/components/WaterSoundPanel.tsx`（設定パネル）
- 設定は localStorage に保存（`cns_water_volume` / `cns_water_fade` / `cns_water_playing` / `cns_water_autostart`）
- 停止後は AudioContext を休止してバッテリーを節約する
- 注意: iPhone はマナーモードでは音が鳴らない

### 温湿度バー（ヘッダー下）
作業ページのヘッダー直下に、気温・湿度・暑さ指数（WBGT）を表示するバー。
- **気象庁データ**: Open-Meteo から現在地（気高町宝木）の気温・湿度を取得し、WBGT を推定表示。10分ごとに自動更新。
- **SwitchBot 温湿度計（Bluetooth）**: 「接続」ボタンで SwitchBot 温湿度計の BLE アドバタイズをスキャンし、実測の気温・湿度・WBGT を表示。気象庁データとの差分（SwitchBot − 気象庁）もチップで表示する。
  - 仕組み: Web Bluetooth の `navigator.bluetooth.requestLEScan`（ペアリング不要・受信のたびに最新値へ更新）。
  - 対応: Android Chrome で `chrome://flags/#enable-experimental-web-platform-features` を有効にすると利用可能。非対応環境ではバーに「非対応」と表示される。
  - 実装: `src/lib/switchbot.ts`（SwitchBot Meter サービスデータ解析）、`src/components/ClimateBar.tsx`（表示バー）。

### 品目マスタ管理（CNS品目一覧）
CNS品目一覧はコード紐付・入数・1P数・重量・寸法情報を保管するマスタデータ。
パレット枚数・端数は「内容」シート（コンテナデータ）から取得する。

- **新規登録**: 全フィールド入力可能な登録フォーム
- **編集**: 品番・品名・Description・数量・重量・寸法 全項目編集可能
- **削除**: 確認ダイアログ付き
- **CN優先ソート**: 読み込んだコンテナの対象品目を自動的に一覧上部に表示
- 種類フィルター / テキスト検索
- Excel Import（新建高コード一括更新）
- Excel Export（マスタデータ出力 — palletCount/fractionは含まない）

### 写真読込（AI/OCR）
コンテナ日程の書式の写真（JPG/PNG等）をドラッグ＆ドロップすると、
画像から自動で品目表を抽出してコンテナデータとして取り込む。

- 対応フォーマット: `.jpg` / `.jpeg` / `.png` / `.webp` / `.heic` / `.bmp`
- 抽出列: 品番 / 品名 / 代表機種 / 入荷数量 / ケース数 / パレット枚数 / 端数
- ヘッダー左上の「4月15日 26K0308」形式から日付・コンテナ番号を抽出

#### 抽出エンジン
1. **Gemini API (推奨)** — 「AI写真」ボタンから Google AI Studio で取得した API キーを設定すると、Gemini 3.6 Flash / 3.5 Flash-Lite / 3.1 Pro を用いて高精度な構造化抽出を行う。光沢・影・日本語英数混在もLLMの文脈理解で高精度に処理。Flash 系モデルは無料枠あり。
2. **Tesseract.js (フォールバック)** — API キー未設定時は tesseract.js のローカル OCR を使用。精度は低いが完全オフライン動作。

API キーは端末の localStorage にのみ保存され、外部には送信されない。

### データ構造

#### 「内容」シート（コンテナデータ）
コンテナごとの荷物情報。パレット枚数・端数を含む。

| 列 | フィールド | 説明 |
|---|---|---|
| C | 気高コード (partNumber) | 品番 |
| D | 規格 (itemName) | 製品名 |
| E | 代表機種 (representModel) | 機種名 |
| F | 入数 (packingQty) | 個/ケース |
| G | 総数 (totalQty) | 入荷数量 |
| H | ケース数 (caseCount) | カートン数 |
| I | パレット枚数 (palletCount) | パレット数 |
| J | 端数 (fraction) | 端数ケース |
| K | 1P数 (qtyPerPallet) | 1パレットあたりケース数 |

#### CNS品目一覧（マスタデータ）
コード紐付・重量・寸法等の参照情報を保管。

| 列 | フィールド | 説明 |
|---|---|---|
| A | 新建高コード (newPartNumber) | 新しい品番コード |
| B | 気高コード (partNumber) | 品番 |
| C | 規格 (itemName) | 製品名 |
| D | 種類 (type) | ポリカバー/箱/部品/その他（自動判定） |
| E | 代表機種 (representModel) | 機種名 |
| F | 入数 (packingQty) | 個/ケース |
| G | 総数 (totalQty) | 入荷数量 |
| H | ケース数 (caseCount) | カートン数 |
| I | 1P数 (qtyPerPallet) | 1パレットあたりケース数 |
| J | ITEM DESCRIPTION (description) | 品目説明 |
| K | MODEL NO. (modelNo) | モデル番号 |
| L | G.W. (grossWeight) | 総重量 KGS |
| M | CBM (cbm) | 容積 立方メートル |
| N | Meas. (measurements) | 外寸 (例: 55\*38\*38) |

## 技術スタック

| 技術 | バージョン | 用途 |
|---|---|---|
| Next.js | 14.2.35 | App Router フレームワーク |
| React | 18.x | UIライブラリ |
| TypeScript | 5.x | 型安全 |
| Tailwind CSS | 3.4.1 | スタイリング |
| xlsx | 0.18.5 | Excel パース/生成 |

## ディレクトリ構成

```
src/
├── app/
│   ├── layout.tsx          # ルートレイアウト（メタデータ・PWA設定）
│   ├── page.tsx            # メインアプリケーション
│   └── globals.css         # グローバルスタイル・CSS変数
├── components/
│   ├── ActionBar.tsx        # 下部操作バー（前後移動・増減・音声・完了）
│   ├── FileDropZone.tsx     # ファイルアップロード画面（D&D・最近のファイル）
│   ├── HeaderBar.tsx        # ヘッダー（コンテナ選択・時計・経過時間）
│   ├── ItemDetailPanel.tsx  # 作業ビュー（ヒーロー表示・パレット図・品目リスト）
│   ├── ItemEditPage.tsx     # 品目マスタ管理（登録・編集・削除・Import/Export）
│   ├── ItemListPanel.tsx    # サイドバー品目一覧
│   ├── PalletDiagram.tsx    # アイソメトリック3Dパレット図
│   └── VoiceFeedback.tsx    # 音声認識フィードバック表示
├── hooks/
│   ├── useContainerData.ts  # 状態管理（useReducer）
│   ├── useSpeech.ts         # 音声合成（TTS）
│   ├── useSpeechRecognition.ts  # 音声認識
│   └── useTimer.ts          # タイマー・時計
├── lib/
│   ├── types.ts             # 型定義（ContainerItem, Container等）
│   ├── excelParser.ts       # Excelパーサー（「内容」シート対応）
│   ├── typeDetector.ts      # 品目種類自動判定
│   ├── sorter.ts            # 品目ソート（種類優先→名前順）
│   ├── speechCommands.ts    # 音声コマンドマッピング
│   └── recentFiles.ts       # 最近のファイル（localStorage）
└── data/
    └── colorMap.ts          # 種類別カラースキーム
```

## 画面モード

すべての画面はヘッダー左のメニューから相互に行き来できる（読込画面もヘッダー・メニューを保持する）。
コンテナ未読込のときは読込画面に固定され、他のメニュー項目は選べない。

| モード | 説明 |
|---|---|
| **読込** (load) | Excel/写真の読込画面。作業中でもメニューから開けて、別ファイルへ差し替えできる |
| **作業** (work) | 品目詳細表示 + パレット図 + 操作バー。横画面では左右分割。全品目完了時は完了表示 |
| **一覧** (list) | 全品目のリスト表示 |
| **管理** (edit) | 品目マスタの登録・編集・削除・Import/Export |
| **分析** (analytics) | コンテナの内容分析 |
| **履歴** (history) | 作業履歴 |

## データフロー

```
Excel (.xlsx) → parseExcelFile() → useContainerData (reducer)
                                        ↓
                              ┌─────────┼─────────┐
                              ↓         ↓         ↓
                        作業ビュー   一覧ビュー  管理ビュー
                              ↓                    ↓
                        音声認識/TTS         Import/Export
```

1. ユーザーがExcelファイルをD&Dまたは選択
2. `parseExcelFile()` が「内容」シートを解析、コンテナ/品目データを生成
3. 同一品番・品名の品目を合算、種類別にソート
4. `useContainerData` のreducerで全状態を管理
5. 音声認識でハンズフリー操作、自動読み上げで作業支援

## 品目種類の自動判定

| 種類 | 判定ルール | 色 |
|---|---|---|
| ポリカバー | 名前に「ポリカバー」を含む / JRI-, JPI- 等の接頭辞 | 緑 |
| 箱 | PDRS, PDU+, PVW- 等の接頭辞 / 「ハコ」「箱」キーワード | 青 |
| 部品 | 「レバー」「パッキン」「スイッチ」等のキーワード | 紫 |
| その他 | 上記に該当しない品目 | グレー |

## 起動方法

```bash
# 開発サーバー
npm run dev

# 本番ビルド
npm run build && npm start
```

`http://localhost:3000` でアクセス。

## PWA / 画面表示

- **表示モード**: `standalone`（`public/manifest.json`、`display_override` にも明示）。`fullscreen` だとスマートフォンのステータスバー（時計・電池）が隠れてしまうため使わない。
  Android はインストール時の表示モードが WebAPK にキャッシュされるため、`fullscreen` で追加済みの端末は
  ホーム画面のアプリを一度削除して入れ直さないと反映されない。
- **テーマカラー**: ステータスバーの色をヘッダー（`--header-bg` = `#1a1d2e`）と同色にして一体感を出す。
  `manifest.json` の `theme_color` / `background_color` と `layout.tsx` の `viewport.themeColor` を同じ値にそろえること。
- **セーフエリア**: iOS はステータスバーが黒半透明（`statusBarStyle: black-translucent`）でコンテンツに重なるため、
  ヘッダーに `env(safe-area-inset-top)`（CSS変数 `--safe-top`）分の余白を持たせ、その領域もヘッダー色で塗る。
  ヘッダー高さとメニューパネルの表示位置は `calc(48px + var(--safe-top))` で連動させている。

## レスポンシブ対応

- **縦画面 (Portrait)**: 詳細パネルのフルスクリーン表示 + 下部操作バー
- **横画面 (Landscape)**: 左50%詳細 + 右50%品目リスト
- **モバイル (≤480px)**: コンパクトグリッド・フォントサイズ調整
- **デスクトップ (≥1024px)**: ワイドグリッド・余裕のある配置

## バージョン履歴

- **v1.2** (2026-03-24): CNS品目一覧をマスタデータ保管用に整理。palletCount/fractionは「内容」シートから取得。MODEL NO.追加。CN優先ソート機能追加
- **v1.1** (2026-03-24): 品目マスタ管理機能の拡張、新フィールド追加（Description, G.W., CBM, Meas.）、Excel Import/Export
- **v1.0** (2026-03-24): 初期リリース。パレット図、品目合算、音声操作、ダークテーマ
