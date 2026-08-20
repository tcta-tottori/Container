# sherpa-onnx（端末内で動く音声コール）の置き場

設定ページ →「音声」タブ → 音声 API で **sherpa-onnx** を選ぶと、コールをこのフォルダの
WebAssembly（sherpa-onnx / Next-gen Kaldi）で読み上げます。通信が要らないので、
圏外でもコールが鳴り、Gemini TTS のような生成待ちもありません。

- ライセンス: Apache-2.0（商用・個人利用ともに無料）
- 使えるモデル: VITS / Piper / Kokoro など、ONNX 形式の軽量・高音質モデル
- 本家: https://github.com/k2-fsa/sherpa-onnx
- ドキュメント: https://k2-fsa.github.io/sherpa-onnx/ の「WebAssembly」→「Text-to-speech」

## 入れるファイル（4つ）

このフォルダ（`public/sherpa/`）に、次の4ファイルをそのまま置きます。

| ファイル | 中身 |
| --- | --- |
| `sherpa-onnx-wasm-main-tts.js` | Emscripten のグルーコード |
| `sherpa-onnx-wasm-main-tts.wasm` | WebAssembly 本体 |
| `sherpa-onnx-wasm-main-tts.data` | 日本語モデル（ONNX）と辞書をまとめたもの |
| `sherpa-onnx-tts.js` | `createOfflineTts` を定義するヘルパー |

ファイル名は sherpa-onnx の wasm/tts ビルドの既定名です。名前を変えると読み込めません。

## ファイルの作り方

1. sherpa-onnx を clone する
2. 使いたい日本語モデル（VITS / Piper / Kokoro など）を展開して、リポジトリ同梱の
   TTS 用 WebAssembly ビルドスクリプト（`build-wasm-simd-tts.sh`）を実行する
3. `build-wasm-simd-tts/install/bin/wasm/tts/` にできた上記4ファイルをこのフォルダにコピーする

k2-fsa が Hugging Face Spaces で公開している TTS のデモ（WebAssembly 版）から、
同じ4ファイルを取ってきて置いても動きます。

## 別の場所に置くとき

`.data` はモデルによっては数十〜百 MB になります。リポジトリに入れたくない場合は、
別のサーバー（CORS 許可が必要）に置いて、設定ページの「モデルの置き場所」に
その URL を入れてください。既定値は `sherpa/`（このフォルダ）です。

一度読み込んだファイルはブラウザの Cache Storage に残るので、2回目からは通信なしで立ち上がります。
入れ替えたときは設定ページの「保存分を削除」を押してから、もう一度「モデルを準備する」を押します。
