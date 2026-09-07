package jp.tcta.cns.container.shared

import kotlinx.serialization.Serializable

/**
 * ウォッチ → スマホ（CNS）へ送る操作。
 *
 * MessageClient で [DataLayerContract.COMMAND_PATH] に JSON を送り、
 * スマホ側は WebView の CNS に渡して、画面上の操作と同じ処理を行う。
 *
 * @property type [SELECT_ITEM] / [DECREMENT_PALLET] / [INCREMENT_PALLET] /
 *   [UNCOMPLETE_ITEM] / [CALL]
 * @property itemId 対象の品目 ID。ウォッチで選択中のもの
 * @property containerId 対象のコンテナ ID
 * @property issuedAt ウォッチで操作した時刻（epoch millis）。取りこぼしや重複の判定に使う
 * @property arg 追加の指定。[CALL] のときにどのコールかを表す（[CALL_REQUEST] など）
 */
@Serializable
data class WatchCommand(
    val type: String,
    val itemId: String,
    val containerId: String? = null,
    val issuedAt: Long = 0L,
    val arg: String? = null,
) {
    companion object {
        /** 品目を切り替える（スマホの表示も追従する） */
        const val SELECT_ITEM = "selectItem"

        /** パレットを 1 枚減らす（画面の 1 回タップと同じ） */
        const val DECREMENT_PALLET = "decrementPallet"

        /** パレットを 1 枚戻す（画面の 2 回タップと同じ） */
        const val INCREMENT_PALLET = "incrementPallet"

        /** 完了にした品目を元に戻す */
        const val UNCOMPLETE_ITEM = "uncompleteItem"

        /** スマホでコールを鳴らす。どのコールかは [arg] で指定する */
        const val CALL = "call"

        /** 「お願いします！」 */
        const val CALL_REQUEST = "request"

        /** 「長谷川さん！お願いします！」 */
        const val CALL_NAME = "name"

        /** 応援コール（登録した文から 1 つ） */
        const val CALL_CHEER = "cheer"

        /** いまの品目を読み上げる */
        const val CALL_ITEM = "item"
    }
}

/** [WatchCommand] と JSON 文字列の相互変換 */
object WatchCommandCodec {
    fun encode(command: WatchCommand): String =
        ContainerSyncCodec.jsonFormat.encodeToString(WatchCommand.serializer(), command)

    fun decodeOrNull(text: String?): WatchCommand? = text?.let {
        runCatching { ContainerSyncCodec.jsonFormat.decodeFromString(WatchCommand.serializer(), it) }.getOrNull()
    }
}
