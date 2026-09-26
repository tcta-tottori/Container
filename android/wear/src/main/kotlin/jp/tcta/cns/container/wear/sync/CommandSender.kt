package jp.tcta.cns.container.wear.sync

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.Wearable
import jp.tcta.cns.container.shared.DataLayerContract
import jp.tcta.cns.container.shared.WatchCommand
import jp.tcta.cns.container.shared.WatchCommandCodec
import kotlinx.coroutines.tasks.await

/**
 * ウォッチ → スマホ（CNS）へ操作を送る。
 *
 * MessageClient なので、スマホが受け取れる状態（CNS アプリが動いている）でないと届かない。
 * 届かなかった場合も画面はスマホからの同期で更新されるため、ここでは記録だけ残す。
 */
class CommandSender(context: Context) {
    private val appContext = context.applicationContext
    private val messageClient by lazy { Wearable.getMessageClient(appContext) }
    private val nodeClient by lazy { Wearable.getNodeClient(appContext) }

    /** 接続中のノードすべてに送る。1 つでも届けば true */
    suspend fun send(command: WatchCommand): Boolean {
        val payload = WatchCommandCodec.encode(command).toByteArray(Charsets.UTF_8)
        return try {
            val nodes = nodeClient.connectedNodes.await()
            if (nodes.isEmpty()) {
                Log.w(TAG, "スマホが接続されていません")
                return false
            }
            var delivered = false
            for (node in nodes) {
                runCatching {
                    messageClient.sendMessage(node.id, DataLayerContract.COMMAND_PATH, payload).await()
                }.onSuccess { delivered = true }
                    .onFailure { Log.w(TAG, "送信に失敗 node=${node.displayName}", it) }
            }
            delivered
        } catch (e: Exception) {
            Log.w(TAG, "操作を送れませんでした", e)
            false
        }
    }

    private companion object {
        const val TAG = "CommandSender"
    }
}
