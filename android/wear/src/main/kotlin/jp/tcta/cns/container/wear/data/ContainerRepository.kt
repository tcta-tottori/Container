package jp.tcta.cns.container.wear.data

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.wear.tiles.TileService
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataRequest
import com.google.android.gms.wearable.Wearable
import jp.tcta.cns.container.shared.ContainerSyncCodec
import jp.tcta.cns.container.shared.ContainerSyncPayload
import jp.tcta.cns.container.shared.DataLayerContract
import jp.tcta.cns.container.wear.tile.ContainerTileService
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await

/** ローカルに保存してある最新の受信内容 */
data class StoredSnapshot(
    val payload: ContainerSyncPayload,
    /** ウォッチが受信した時刻（epoch millis） */
    val receivedAt: Long,
)

private val Context.syncDataStore: DataStore<Preferences> by preferencesDataStore(name = "container_sync")

/**
 * ウォッチ側のデータ置き場。
 *
 * - スマホから届いた JSON をそのまま DataStore に保存する
 *   → スマホとの接続が切れても最後に受信した内容を表示できる
 * - 起動時などに Data Layer の DataItem を読み直して取りこぼしを補う
 * - 保存のたびに Tile の更新を要求する
 *
 * Activity / ListenerService / TileService から共通で使うためシングルトン。
 */
class ContainerRepository private constructor(context: Context) {
    private val appContext = context.applicationContext

    /** 保存済みの最新スナップショット。未受信なら null */
    val snapshot: Flow<StoredSnapshot?> = appContext.syncDataStore.data.map { prefs ->
        val json = prefs[KEY_PAYLOAD] ?: return@map null
        val payload = ContainerSyncCodec.decodeOrNull(json) ?: return@map null
        StoredSnapshot(payload = payload, receivedAt = prefs[KEY_RECEIVED_AT] ?: 0L)
    }

    suspend fun current(): StoredSnapshot? = snapshot.first()

    /**
     * 受信した JSON を保存する。壊れた JSON は捨てる。
     * 保存後に Tile の再描画を要求する。
     */
    suspend fun save(json: String): Boolean {
        val payload = ContainerSyncCodec.decodeOrNull(json)
        if (payload == null) {
            Log.w(TAG, "受信した JSON を読めませんでした")
            return false
        }
        val stored = current()
        if (stored != null && stored.payload.generatedAt > payload.generatedAt) {
            // 古い内容が後から届いたときは上書きしない
            return false
        }
        appContext.syncDataStore.edit { prefs ->
            prefs[KEY_PAYLOAD] = json
            prefs[KEY_RECEIVED_AT] = System.currentTimeMillis()
        }
        TileService.getUpdater(appContext).requestUpdate(ContainerTileService::class.java)
        return true
    }

    /**
     * Data Layer に残っている DataItem を読み直す。
     * アプリをあとから入れた場合や、ListenerService が起動しなかった場合の取りこぼしを補う。
     * @return 新しい内容を保存できたら true
     */
    suspend fun refreshFromDataLayer(): Boolean {
        val uri = Uri.parse("${PutDataRequest.WEAR_URI_SCHEME}://*${DataLayerContract.CONTAINER_STATUS_PATH}")
        return try {
            val buffer = Wearable.getDataClient(appContext).getDataItems(uri).await()
            try {
                // 複数ノードにあるときは生成時刻がいちばん新しいものを使う
                val newest = buffer
                    .mapNotNull { item ->
                        val map = DataMapItem.fromDataItem(item).dataMap
                        val json = map.getString(DataLayerContract.KEY_PAYLOAD) ?: return@mapNotNull null
                        val generatedAt = map.getLong(DataLayerContract.KEY_GENERATED_AT, 0L)
                        generatedAt to json
                    }
                    .maxByOrNull { it.first }
                newest?.let { save(it.second) } ?: false
            } finally {
                buffer.release()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Data Layer の読み直しに失敗", e)
            false
        }
    }

    /** スマホ（ノード）が接続されているか */
    suspend fun isPhoneConnected(): Boolean = runCatching {
        Wearable.getNodeClient(appContext).connectedNodes.await().isNotEmpty()
    }.getOrDefault(false)

    companion object {
        private const val TAG = "ContainerRepository"
        private val KEY_PAYLOAD = stringPreferencesKey("payload_json")
        private val KEY_RECEIVED_AT = longPreferencesKey("received_at")

        @Volatile
        private var instance: ContainerRepository? = null

        fun getInstance(context: Context): ContainerRepository =
            instance ?: synchronized(this) {
                instance ?: ContainerRepository(context).also { instance = it }
            }
    }
}
