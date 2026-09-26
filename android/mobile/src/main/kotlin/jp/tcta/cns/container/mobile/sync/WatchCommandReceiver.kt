package jp.tcta.cns.container.mobile.sync

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import jp.tcta.cns.container.shared.DataLayerContract
import jp.tcta.cns.container.shared.WatchCommandCodec

/**
 * ウォッチからの操作（パレットの増減・品目の切り替え）を受け取る。
 *
 * CNS は WebView の中で動いているので、アプリが前面にいるときだけ受け取れればよい。
 * 受け取った JSON はそのまま CNS へ渡し、画面上の操作と同じ処理をさせる。
 */
class WatchCommandReceiver(
    context: Context,
    private val onCommand: (String) -> Unit,
) {
    private val messageClient = Wearable.getMessageClient(context.applicationContext)

    private val listener = MessageClient.OnMessageReceivedListener { event: MessageEvent ->
        if (event.path != DataLayerContract.COMMAND_PATH) return@OnMessageReceivedListener
        val json = event.data.toString(Charsets.UTF_8)
        val command = WatchCommandCodec.decodeOrNull(json)
        if (command == null) {
            Log.w(TAG, "ウォッチからの操作を読めませんでした")
            return@OnMessageReceivedListener
        }
        Log.d(TAG, "ウォッチからの操作 ${command.type} ${command.itemId}")
        onCommand(json)
    }

    fun start() {
        messageClient.addListener(listener)
    }

    fun stop() {
        messageClient.removeListener(listener)
    }

    private companion object {
        const val TAG = "WatchCommandReceiver"
    }
}
