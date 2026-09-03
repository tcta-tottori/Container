package jp.tcta.cns.container.shared

import kotlinx.serialization.Serializable

/**
 * DataItem `/container/status` に載せる JSON 全体。
 *
 * コンテナ一覧と、コンテナ ID ごとの荷物一覧、そして
 * スマホ側で「現在選択中」のコンテナ ID をまとめて 1 つの JSON にする。
 * Tile はこの [selectedContainerId] のコンテナを表示する。
 *
 * @property schemaVersion 互換性判定用のスキーマ版
 * @property generatedAt スマホ側で JSON を作った時刻（epoch millis）
 * @property selectedContainerId 現在選択中のコンテナ ID。未選択なら null
 * @property containers コンテナ一覧
 * @property cargo コンテナ ID → 荷物一覧
 * @property environment 現場の気温・湿度（スマホの天気機能から）。無ければ null
 */
@Serializable
data class ContainerSyncPayload(
    val schemaVersion: Int = SCHEMA_VERSION,
    val generatedAt: Long,
    val selectedContainerId: String? = null,
    val containers: List<ContainerInfo> = emptyList(),
    val cargo: Map<String, List<CargoItem>> = emptyMap(),
    val environment: Environment? = null,
) {
    /** ID からコンテナを引く。無ければ null */
    fun container(id: String?): ContainerInfo? =
        if (id == null) null else containers.firstOrNull { it.id == id }

    /** コンテナ ID に紐づく荷物一覧。無ければ空 */
    fun cargoOf(containerId: String): List<CargoItem> = cargo[containerId].orEmpty()

    /**
     * Tile などで表示する「現在のコンテナ」。
     * 選択中 ID が無い / 見つからないときは先頭のコンテナに倒す。
     */
    val selectedContainer: ContainerInfo?
        get() = container(selectedContainerId) ?: containers.firstOrNull()

    companion object {
        const val SCHEMA_VERSION = 1
    }
}

/**
 * 現場の環境。作業画面の下段に出す。
 *
 * @property temperatureC 気温（℃）。不明なら null
 * @property humidityPercent 湿度（%）。不明なら null
 * @property measuredAt 計測時刻（epoch millis）
 */
@Serializable
data class Environment(
    val temperatureC: Float? = null,
    val humidityPercent: Int? = null,
    val measuredAt: Long = 0L,
)
