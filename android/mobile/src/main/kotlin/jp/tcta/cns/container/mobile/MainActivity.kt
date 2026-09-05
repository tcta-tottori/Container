package jp.tcta.cns.container.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import jp.tcta.cns.container.mobile.bridge.NativeSpeechBridge
import jp.tcta.cns.container.mobile.bridge.WatchBridge
import jp.tcta.cns.container.mobile.work.WorkStatusService
import jp.tcta.cns.container.mobile.sync.WatchCommandReceiver
import jp.tcta.cns.container.mobile.sync.WearSyncClient
import jp.tcta.cns.container.shared.ContainerSyncCodec

/**
 * CNS アプリ本体。CNS（Web）を WebView で全画面表示する。
 *
 * - `window.CNSWatch`  … ウォッチ同期の橋渡し（[WatchBridge]）
 * - `window.CNSNative` … 読み上げ・音声認識の橋渡し（[NativeSpeechBridge]）
 * - assets/cns-native-polyfill.js を各ページの先頭で注入して Web Speech API を補う
 */
class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var speechBridge: NativeSpeechBridge
    private lateinit var watchBridge: WatchBridge
    private lateinit var commandReceiver: WatchCommandReceiver
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var polyfill: String = ""

    /** アプリが前面にあるか。裏からはフォアグラウンドサービスを始められない */
    @Volatile
    private var foreground = false

    /** 最後に CNS から受け取った同期内容。前面に戻ったときに表示を出し直すのに使う */
    @Volatile
    private var lastSyncJson: String? = null

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = fileChooserCallback ?: return@registerForActivityResult
            fileChooserCallback = null
            val data = result.data
            val uris = mutableListOf<Uri>()
            if (result.resultCode == RESULT_OK && data != null) {
                data.clipData?.let { clip -> for (i in 0 until clip.itemCount) uris += clip.getItemAt(i).uri }
                if (uris.isEmpty()) data.data?.let { uris += it }
            }
            callback.onReceiveValue(if (uris.isEmpty()) null else uris.toTypedArray())
        }

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    private val micPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            speechBridge.onMicPermissionResult(granted)
            if (!granted) Toast.makeText(this, R.string.mic_permission_denied, Toast.LENGTH_LONG).show()
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 荷降ろし現場で画面が消えないようにする
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        askNotificationPermission()

        polyfill = assets.open("cns-native-polyfill.js").bufferedReader().use { it.readText() }

        webView = WebView(this).apply {
            layoutParams = android.view.ViewGroup.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                android.view.ViewGroup.LayoutParams.MATCH_PARENT,
            )
            setBackgroundColor(0xFF1A1D2E.toInt())
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = false
                allowContentAccess = true
                mediaPlaybackRequiresUserGesture = false
                loadWithOverviewMode = true
                useWideViewPort = true
                cacheMode = WebSettings.LOAD_DEFAULT
                userAgentString = "$userAgentString CNSApp/${BuildConfig.VERSION_NAME}"
            }
        }
        setContentView(webView)

        val syncClient = WearSyncClient(this)
        watchBridge = WatchBridge(
            syncClient,
            lifecycleScope,
            onError = { message ->
                runOnUiThread { Toast.makeText(this, getString(R.string.watch_sync_failed, message), Toast.LENGTH_SHORT).show() }
            },
            // 荷降ろし中はステータスバーにも出しておく（アプリを閉じているあいだも見える）
            onPayload = { payload, json ->
                lastSyncJson = json
                WorkStatusService.update(this, payload, json, canStart = foreground)
            },
        )
        commandReceiver = WatchCommandReceiver(this) { json ->
            // ウォッチの操作を CNS へ渡す。CNS 側は画面のタップと同じ処理を行う
            runOnUiThread {
                webView.evaluateJavascript("window.CNSWatchCommand && window.CNSWatchCommand(${jsString(json)})", null)
            }
        }
        speechBridge = NativeSpeechBridge(this, webView) {
            micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
        webView.addJavascriptInterface(watchBridge, "CNSWatch")
        webView.addJavascriptInterface(speechBridge, "CNSNative")

        // ページのスクリプトより先にポリフィルを入れる（対応 WebView なら document start で確実に入る）
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, polyfill, setOf("*"))
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                // document start script が使えない WebView 向けの保険
                view.evaluateJavascript(polyfill, null)
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                // CNS 以外（AI Studio のキー取得ページなど）はブラウザで開く
                return if (isCnsUrl(url)) false else {
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)) }
                    true
                }
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showOfflinePage()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams,
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                return try {
                    fileChooserLauncher.launch(buildFileChooserIntent(fileChooserParams))
                    true
                } catch (e: Exception) {
                    Log.w(TAG, "ファイル選択を開けませんでした", e)
                    // 端末にファイル選択の画面が無いときは WebView 既定の Intent で開き直す
                    try {
                        fileChooserLauncher.launch(fileChooserParams.createIntent())
                        true
                    } catch (fallback: Exception) {
                        Log.w(TAG, "既定のファイル選択も開けませんでした", fallback)
                        fileChooserCallback = null
                        false
                    }
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                // カメラ・マイクは CNS からの要求だけ許可する
                if (isCnsUrl(request.origin)) request.grant(request.resources) else request.deny()
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        loadCns()
    }

    override fun onStart() {
        super.onStart()
        foreground = true
        commandReceiver.start()
        // 前面に戻ったときに、まだ出せていなければステータスバー表示を出す
        val json = lastSyncJson
        val payload = ContainerSyncCodec.decodeOrNull(json)
        if (json != null && payload != null) {
            WorkStatusService.update(this, payload, json, canStart = true)
        }
    }

    override fun onStop() {
        foreground = false
        commandReceiver.stop()
        super.onStop()
    }

    /** ステータスバーに作業中を出すための許可。断られてもアプリはそのまま使える */
    private fun askNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!granted) notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    /** JavaScript の文字列リテラルにする */
    private fun jsString(value: String): String {
        val sb = StringBuilder("\"")
        for (ch in value) {
            when (ch) {
                '\\' -> sb.append("\\\\")
                '"' -> sb.append("\\\"")
                '\n' -> sb.append("\\n")
                '\r' -> sb.append("\\r")
                '\u2028' -> sb.append("\\u2028")
                '\u2029' -> sb.append("\\u2029")
                else -> sb.append(ch)
            }
        }
        return sb.append('"').toString()
    }

    /**
     * ファイル選択の Intent。
     *
     * WebView 既定の `createIntent()` は accept 属性の拡張子を MIME 型に直して絞り込むが、
     * Android は `.xlsm`（マクロ付きブック）の MIME 型を知らないため、
     * そのままだと xlsm が一覧に出てこない（選べない）。
     * CNS 側が拡張子で振り分けているので、ここでは絞り込まずに全ファイルを見せる。
     * 写真の撮影が要求されているときだけ、カメラを開ける既定の Intent に任せる。
     */
    private fun buildFileChooserIntent(params: WebChromeClient.FileChooserParams): Intent {
        if (params.isCaptureEnabled) return params.createIntent()
        return Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(
                Intent.EXTRA_ALLOW_MULTIPLE,
                params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE,
            )
        }
    }

    private fun loadCns() {
        webView.settings.cacheMode = if (isOnline()) WebSettings.LOAD_DEFAULT else WebSettings.LOAD_CACHE_ELSE_NETWORK
        webView.loadUrl(BuildConfig.CNS_URL)
    }

    private fun isCnsUrl(url: Uri?): Boolean {
        if (url == null) return false
        val cns = Uri.parse(BuildConfig.CNS_URL)
        return url.scheme == cns.scheme && url.host.equals(cns.host, ignoreCase = true)
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(ConnectivityManager::class.java) ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /** 接続できないときの簡単な案内ページ。「再試行」で CNS を読み直す */
    private fun showOfflinePage() {
        val html = """
            <!doctype html><html lang="ja"><head><meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body{margin:0;background:#1a1d2e;color:#e8e8e8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}
              .box{padding:24px;max-width:320px}
              h1{font-size:18px;margin:0 0 12px}
              p{font-size:14px;line-height:1.6;color:#b4b8be;margin:0 0 20px}
              button{font-size:16px;padding:12px 28px;border-radius:24px;border:0;background:#22c55e;color:#000;font-weight:700}
            </style></head><body><div class="box">
            <h1>${getString(R.string.offline_title)}</h1>
            <p>${getString(R.string.offline_body)}</p>
            <button onclick="location.href='${BuildConfig.CNS_URL}'">${getString(R.string.offline_retry)}</button>
            </div></body></html>
        """.trimIndent()
        webView.loadDataWithBaseURL(BuildConfig.CNS_URL, html, "text/html", "utf-8", null)
    }

    override fun onDestroy() {
        WorkStatusService.stop(this)
        speechBridge.destroy()
        webView.destroy()
        super.onDestroy()
    }

    private companion object {
        const val TAG = "CNSMain"
    }
}
