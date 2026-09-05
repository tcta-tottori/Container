# debug 用の署名鍵

`debug.keystore` は開発用（debug ビルド）の署名鍵。パスワード・エイリアスは Android 標準の debug 鍵と同じ
（store / key password: `android`、alias: `androiddebugkey`）。

Wearable Data Layer API はスマホ側とウォッチ側のアプリが **同じ鍵で署名されている**ことを要求する。
また、端末に入っているアプリと違う鍵の APK は上書きインストールできない。
PC ごと・CI の実行ごとに鍵が変わると、そのたびにアンインストールが必要になるので、
この鍵をリポジトリに置いて、PC でも GitHub Actions でも同じ署名になるようにしている。

本番配布（Play ストア）用の鍵は別に用意し、リポジトリには置かないこと。
