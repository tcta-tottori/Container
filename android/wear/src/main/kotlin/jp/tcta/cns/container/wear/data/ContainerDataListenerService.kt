package jp.tcta.cns.container.wear.data

import android.util.Log
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.WearableListenerService
import jp.tcta.cns.container.shared.DataLayerContract
import kotlinx.coroutines.runBlocking

/**
 * スマホが `/container/status` を更新したときに Play 開発者サービスから起動される。
 * アプリが前面に無くても受信して保存し、Tile を更新する。
 */
class ContainerDataListenerService : WearableListenerService() {
    override fun onDataChanged(dataEvents: DataEventBuffer) {
        val repository = ContainerRepository.getInstance(this)
        for (event in dataEvents) {
            if (event.type != DataEvent.TYPE_CHANGED) continue
            val item = event.dataItem
            if (item.uri.path != DataLayerContract.CONTAINER_STATUS_PATH) continue
            val json = DataMapItem.fromDataItem(item).dataMap.getString(DataLayerContract.KEY_PAYLOAD) ?: continue
            // onDataChanged はバックグラウンドスレッドで呼ばれるので、ここで待ってよい
            val saved = runBlocking { repository.save(json) }
            Log.d(TAG, "コンテナ情報を受信 saved=$saved bytes=${json.length}")
        }
    }

    private companion object {
        const val TAG = "ContainerDataListener"
    }
}
