package jp.tcta.cns.container.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
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
import jp.tcta.cns.container.mobile.sync.WearSyncClient

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
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var polyfill: String = ""

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
        watchBridge = WatchBridge(syncClient, lifecycleScope) { message ->
            runOnUiThread { Toast.makeText(this, getString(R.string.watch_sync_failed, message), Toast.LENGTH_SHORT).show() }
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
                    fileChooserLauncher.launch(fileChooserParams.createIntent())
                    true
                } catch (e: Exception) {
                    Log.w(TAG, "ファイル選択を開けませんでした", e)
                    fileChooserCallback = null
                    false
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
        speechBridge.destroy()
        webView.destroy()
        super.onDestroy()
    }

    private companion object {
        const val TAG = "CNSMain"
    }
}
