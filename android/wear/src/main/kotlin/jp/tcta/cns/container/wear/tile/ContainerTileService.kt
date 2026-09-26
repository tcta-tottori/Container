package jp.tcta.cns.container.wear.tile

import androidx.concurrent.futures.CallbackToFutureAdapter
import androidx.wear.protolayout.DeviceParametersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.ListenableFuture
import jp.tcta.cns.container.wear.data.ContainerRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * 現在選択中のコンテナの積載率・残容量・ステータスを出す Tile。
 * データは [ContainerRepository] に保存済みのものを読むだけなので、スマホ未接続でも表示できる。
 * 新しいデータを受信すると [ContainerRepository.save] が更新を要求する。
 */
class ContainerTileService : TileService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest,
    ): ListenableFuture<TileBuilders.Tile> = CallbackToFutureAdapter.getFuture { completer ->
        scope.launch {
            try {
                val snapshot = ContainerRepository.getInstance(this@ContainerTileService).current()
                val device = requestParams.deviceConfiguration
                    ?: DeviceParametersBuilders.DeviceParameters.Builder().build()
                val layout = ContainerTileLayout.build(this@ContainerTileService, device, snapshot)
                val tile = TileBuilders.Tile.Builder()
                    .setResourcesVersion(RESOURCES_VERSION)
                    .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(layout))
                    .build()
                completer.set(tile)
            } catch (t: Throwable) {
                completer.setException(t)
            }
        }
        "ContainerTile"
    }

    override fun onTileResourcesRequest(
        requestParams: RequestBuilders.ResourcesRequest,
    ): ListenableFuture<ResourceBuilders.Resources> = CallbackToFutureAdapter.getFuture { completer ->
        completer.set(ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build())
        "ContainerTileResources"
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private companion object {
        // 画像リソースを使わないので固定でよい
        const val RESOURCES_VERSION = "1"
    }
}
