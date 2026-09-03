package jp.tcta.cns.container.mobile.sync

import android.content.Context
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import jp.tcta.cns.container.shared.ContainerSyncCodec
import jp.tcta.cns.container.shared.ContainerSyncPayload
import jp.tcta.cns.container.shared.DataLayerContract
import kotlinx.coroutines.tasks.await

/**
 * Wearable Data Layer API（DataClient）でウォッチへコンテナ情報を送る。
 *
 * DataItem は Google Play 開発者サービスが保持するので、ウォッチが未接続でも
 * 呼び出しは成功し、次に接続したときに届く。
 */
class WearSyncClient(context: Context) {
    private val appContext = context.applicationContext
    private val dataClient by lazy { Wearable.getDataClient(appContext) }
    private val nodeClient by lazy { Wearable.getNodeClient(appContext) }

    /** 送信したペイロードのバイト数を返す */
    suspend fun publish(payload: ContainerSyncPayload): Result<Int> = runCatching {
        val json = ContainerSyncCodec.encode(payload)
        val bytes = json.toByteArray(Charsets.UTF_8).size
        check(bytes <= DataLayerContract.MAX_PAYLOAD_BYTES) {
            "ペイロードが大きすぎます (${bytes} bytes > ${DataLayerContract.MAX_PAYLOAD_BYTES})"
        }
        val request = PutDataMapRequest.create(DataLayerContract.CONTAINER_STATUS_PATH).apply {
            dataMap.putString(DataLayerContract.KEY_PAYLOAD, json)
            // 同じ内容を再送しても onDataChanged が呼ばれるよう、生成時刻を含める
            dataMap.putLong(DataLayerContract.KEY_GENERATED_AT, payload.generatedAt)
        }.asPutDataRequest().setUrgent()
        dataClient.putDataItem(request).await()
        bytes
    }

    /** 現在接続しているウォッチの表示名。Play 開発者サービスが無い端末では空 */
    suspend fun connectedWatchNames(): List<String> =
        runCatching { nodeClient.connectedNodes.await().map { it.displayName } }.getOrDefault(emptyList())
}
