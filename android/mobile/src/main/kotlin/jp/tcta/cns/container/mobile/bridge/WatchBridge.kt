package jp.tcta.cns.container.mobile.bridge

import android.util.Log
import android.webkit.JavascriptInterface
import jp.tcta.cns.container.mobile.sync.WearSyncClient
import jp.tcta.cns.container.shared.ContainerSyncCodec
import jp.tcta.cns.container.shared.ContainerSyncPayload
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * CNS（Web）→ ウォッチ の橋渡し。`window.CNSWatch` として WebView に載せる。
 *
 * CNS 側（src/lib/watchSync.ts）が作業状態を JSON にして [postSync] に渡す。
 * 中身は android/shared の ContainerSyncPayload と同じ形なので、そのまま Data Layer に流す。
 */
class WatchBridge(
    private val syncClient: WearSyncClient,
    private val scope: CoroutineScope,
    private val onError: (String) -> Unit,
    /** 受け取った内容。ステータスバーの作業中表示にも使う */
    private val onPayload: (ContainerSyncPayload, String) -> Unit = { _, _ -> },
) {
    private var inFlight: Job? = null
    private var queued: String? = null

    /** アプリの中で開いているかを Web 側が知るため */
    @JavascriptInterface
    fun isAvailable(): Boolean = true

    /** 橋渡しの版。Web 側が将来の互換判定に使える */
    @JavascriptInterface
    fun version(): Int = 2

    /** CNS から JSON を受け取ってウォッチへ送る。送信中に来た分は最後の 1 つだけ後で送る */
    @JavascriptInterface
    fun postSync(json: String) {
        val payload = ContainerSyncCodec.decodeOrNull(json)
        if (payload == null) {
            Log.w(TAG, "受け取った JSON を読めませんでした (${json.length} 文字)")
            return
        }
        onPayload(payload, json)
        synchronized(this) {
            if (inFlight?.isActive == true) {
                queued = json
                return
            }
            inFlight = scope.launch { send(json) }
        }
    }

    private suspend fun send(json: String) {
        var next: String? = json
        while (next != null) {
            val payload = ContainerSyncCodec.decodeOrNull(next)
            if (payload != null) {
                syncClient.publish(payload)
                    .onSuccess { Log.d(TAG, "ウォッチへ送信 ${it} bytes") }
                    .onFailure { e ->
                        Log.w(TAG, "ウォッチへの送信に失敗", e)
                        onError(e.message ?: e.javaClass.simpleName)
                    }
            }
            next = synchronized(this) { queued.also { queued = null } }
        }
    }

    private companion object {
        const val TAG = "WatchBridge"
    }
}
