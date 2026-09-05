package jp.tcta.cns.container.mobile.bridge

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat
import java.util.Locale

/**
 * Web Speech API の代わり。`window.CNSNative` として WebView に載せ、
 * assets/cns-native-polyfill.js が speechSynthesis / SpeechRecognition をこれで組み立てる。
 *
 * - 読み上げ: Android の TextToSpeech（日本語）
 * - 音声認識: Android の SpeechRecognizer（Android 12 以上で端末内認識が使えるときはそれを優先）
 *
 * JavaScript からの呼び出しは WebView のスレッドで来るので、すべてメインスレッドへ渡す。
 */
class NativeSpeechBridge(
    private val context: Context,
    private val webView: WebView,
    private val requestMicPermission: () -> Unit,
) {
    private val main = Handler(Looper.getMainLooper())

    // ---------- 読み上げ ----------
    private enum class TtsState { INITIALIZING, READY, FAILED }

    private var tts: TextToSpeech? = null
    private var ttsState = TtsState.INITIALIZING
    private val ttsReady get() = ttsState == TtsState.READY
    /** 初期化が終わる前に来た読み上げ。終わったら順に流す */
    private val pendingSpeaks = ArrayDeque<() -> Unit>()

    init {
        tts = TextToSpeech(context) { status ->
            main.post {
                ttsState = if (status == TextToSpeech.SUCCESS) TtsState.READY else TtsState.FAILED
                if (ttsReady) {
                    tts?.language = Locale.JAPAN
                    tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(utteranceId: String?) = js("window.__cnsTts && __cnsTts.onStart(${utteranceId?.toIntOrNull() ?: -1})")
                        override fun onDone(utteranceId: String?) = js("window.__cnsTts && __cnsTts.onEnd(${utteranceId?.toIntOrNull() ?: -1}, null)")
                        @Deprecated("Deprecated in Java")
                        override fun onError(utteranceId: String?) = js("window.__cnsTts && __cnsTts.onEnd(${utteranceId?.toIntOrNull() ?: -1}, 'synthesis-failed')")
                        override fun onError(utteranceId: String?, errorCode: Int) = js("window.__cnsTts && __cnsTts.onEnd(${utteranceId?.toIntOrNull() ?: -1}, 'synthesis-failed')")
                        override fun onStop(utteranceId: String?, interrupted: Boolean) = js("window.__cnsTts && __cnsTts.onEnd(${utteranceId?.toIntOrNull() ?: -1}, null)")
                    })
                } else {
                    Log.w(TAG, "TextToSpeech を初期化できませんでした status=$status")
                }
                while (pendingSpeaks.isNotEmpty()) pendingSpeaks.removeFirst().invoke()
            }
        }
    }

    @JavascriptInterface
    fun speak(id: Int, text: String, rate: Float, pitch: Float, volume: Float) {
        main.post {
            val run = {
                val engine = tts
                if (!ttsReady || engine == null) {
                    js("window.__cnsTts && __cnsTts.onEnd($id, 'synthesis-unavailable')")
                } else {
                    engine.setSpeechRate(rate.coerceIn(0.5f, 2f))
                    engine.setPitch(pitch.coerceIn(0.5f, 2f))
                    val params = Bundle().apply {
                        putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, volume.coerceIn(0f, 1f))
                    }
                    val result = engine.speak(text, TextToSpeech.QUEUE_FLUSH, params, id.toString())
                    if (result != TextToSpeech.SUCCESS) {
                        js("window.__cnsTts && __cnsTts.onEnd($id, 'synthesis-failed')")
                    }
                }
            }
            if (ttsState == TtsState.INITIALIZING) pendingSpeaks.addLast(run) else run()
        }
    }

    @JavascriptInterface
    fun stopSpeaking() {
        main.post { tts?.stop() }
    }

    // ---------- 音声認識 ----------
    private var recognizer: SpeechRecognizer? = null
    private var listening = false
    private var wantContinuous = false
    private var wantInterim = false
    private var lang = "ja-JP"
    private var micRequested = false
    private var lastEndAt = 0L

    @JavascriptInterface
    fun startRecognition(language: String, continuous: Boolean, interimResults: Boolean) {
        main.post {
            lang = language.ifBlank { "ja-JP" }
            wantContinuous = continuous
            wantInterim = interimResults
            if (!hasMicPermission()) {
                if (!micRequested) {
                    micRequested = true
                    requestMicPermission()
                }
                js("window.__cnsStt && __cnsStt.onError('not-allowed'); window.__cnsStt && __cnsStt.onEnd()")
                return@post
            }
            if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                js("window.__cnsStt && __cnsStt.onError('service-not-allowed'); window.__cnsStt && __cnsStt.onEnd()")
                return@post
            }
            // 終了直後の再開が連打にならないよう少し間を置く
            val wait = (lastEndAt + RESTART_GAP_MS - System.currentTimeMillis()).coerceAtLeast(0L)
            main.postDelayed({ beginListening() }, wait)
        }
    }

    @JavascriptInterface
    fun stopRecognition() {
        main.post {
            wantContinuous = false
            if (listening) {
                recognizer?.stopListening()
            }
        }
    }

    /** 権限ダイアログの結果。許可されたら Web 側の再開を待つ（次の start で動く） */
    fun onMicPermissionResult(granted: Boolean) {
        micRequested = false
        if (!granted) Log.w(TAG, "マイクの権限が許可されませんでした")
    }

    private fun hasMicPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    private fun ensureRecognizer(): SpeechRecognizer {
        recognizer?.let { return it }
        val created = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
            SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
        } else {
            SpeechRecognizer.createSpeechRecognizer(context)
        }
        created.setRecognitionListener(listener)
        recognizer = created
        return created
    }

    private fun beginListening() {
        if (listening) return
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, wantInterim)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
        }
        try {
            ensureRecognizer().startListening(intent)
            listening = true
        } catch (e: Exception) {
            Log.w(TAG, "音声認識を開始できませんでした", e)
            js("window.__cnsStt && __cnsStt.onError('audio-capture'); window.__cnsStt && __cnsStt.onEnd()")
        }
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}

        override fun onPartialResults(partialResults: Bundle?) {
            if (!wantInterim) return
            val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: return
            if (text.isNotBlank()) js("window.__cnsStt && __cnsStt.onResult(${jsString(text)}, false)")
        }

        override fun onResults(results: Bundle?) {
            listening = false
            lastEndAt = System.currentTimeMillis()
            val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
            if (!text.isNullOrBlank()) js("window.__cnsStt && __cnsStt.onResult(${jsString(text)}, true)")
            // Web 側は onend で start() し直す（continuous の再現）
            js("window.__cnsStt && __cnsStt.onEnd()")
        }

        override fun onError(error: Int) {
            listening = false
            lastEndAt = System.currentTimeMillis()
            val code = when (error) {
                SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "no-speech"
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "not-allowed"
                SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network"
                SpeechRecognizer.ERROR_AUDIO -> "audio-capture"
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "aborted"
                else -> "aborted"
            }
            if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || error == SpeechRecognizer.ERROR_CLIENT) {
                // 認識器が変な状態のときは作り直す
                recognizer?.destroy()
                recognizer = null
            }
            js("window.__cnsStt && __cnsStt.onError('$code'); window.__cnsStt && __cnsStt.onEnd()")
        }

        override fun onEvent(eventType: Int, params: Bundle?) {}
    }

    // ---------- 共通 ----------
    fun destroy() {
        main.post {
            recognizer?.destroy()
            recognizer = null
            tts?.stop()
            tts?.shutdown()
            tts = null
            ttsState = TtsState.FAILED
        }
    }

    private fun js(script: String) {
        main.post { webView.evaluateJavascript(script, null) }
    }

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

    private companion object {
        const val TAG = "NativeSpeechBridge"
        const val RESTART_GAP_MS = 250L
    }
}
