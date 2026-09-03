package jp.tcta.cns.container.shared

import kotlinx.serialization.json.Json

/**
 * [ContainerSyncPayload] と JSON 文字列の相互変換。
 *
 * - 未知のキーは無視する（スマホ側が先に項目を増やしてもウォッチが壊れない）
 * - 既定値も出力する（ウォッチ側が古くても読める）
 * - null の項目はキーごと省く（ペイロードを小さく保つ）
 */
object ContainerSyncCodec {
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    fun encode(payload: ContainerSyncPayload): String = json.encodeToString(ContainerSyncPayload.serializer(), payload)

    /** 壊れた JSON は例外にする。安全に読みたいときは [decodeOrNull] */
    fun decode(text: String): ContainerSyncPayload = json.decodeFromString(ContainerSyncPayload.serializer(), text)

    fun decodeOrNull(text: String?): ContainerSyncPayload? =
        text?.let { runCatching { decode(it) }.getOrNull() }
}
