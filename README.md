# Container Navigation System (CNS)

コンテナ荷降ろし作業を支援するWebアプリケーション。
Excelファイルから品目データを読み込み、リアルタイムの作業追跡・音声認識・読み上げ機能を提供する。

## 主な機能

### 作業モード
- 品目の大型表示（品名・種類・色バッジ・パレット図）
- アイソメトリック3Dパレット図（汎用5+4配置 / ジャーポット互い違い配置）
- パレット枚数・端数ケース・総数のリアルタイム表示
- スワイプ操作（左→完了、右→取り消し）
- 類似品目の警告表示（色違い・1文字違い）

### 音声制御
- 日本語音声認識（Web Speech API）
- 音声コマンド: 次/前/完了/読み上げ/増減/数量確認/残数確認
- 品目切り替え時の自動読み上げ（ON/OFF切替可能）

### 品目マスタ管理
- **新規登録**: 全フィールド入力可能な登録フォーム
- **編集**: 品番・品名・Description・数量・重量・寸法 全項目編集可能
- **削除**: 確認ダイアログ付き
- 種類フィルター / テキスト検索
- Excel Import（新建高コード一括更新）
- Excel Export（全フィールド出力）

### データ項目

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

| モード | 説明 |
|---|---|
| **作業** (work) | 品目詳細表示 + パレット図 + 操作バー。横画面では左右分割 |
| **一覧** (list) | 全品目のリスト表示 |
| **管理** (edit) | 品目マスタの登録・編集・削除・Import/Export |

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

## レスポンシブ対応

- **縦画面 (Portrait)**: 詳細パネルのフルスクリーン表示 + 下部操作バー
- **横画面 (Landscape)**: 左50%詳細 + 右50%品目リスト
- **モバイル (≤480px)**: コンパクトグリッド・フォントサイズ調整
- **デスクトップ (≥1024px)**: ワイドグリッド・余裕のある配置

## バージョン履歴

- **v1.2** (2026-03-24): データ項目をCNS品目一覧に統一（A-N列）。palletCount/fraction廃止→caseCountベースに変更。MODEL NO.フィールド追加
- **v1.1** (2026-03-24): 品目マスタ管理機能の拡張、新フィールド追加（Description, G.W., CBM, Meas.）、Excel Import/Export
- **v1.0** (2026-03-24): 初期リリース。パレット図、品目合算、音声操作、ダークテーマ
