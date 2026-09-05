package jp.tcta.cns.container.shared

/**
 * スマホ ↔ ウォッチ間の取り決め。両モジュールで同じ値を使う。
 */
object DataLayerContract {
    /** DataItem のパス */
    const val CONTAINER_STATUS_PATH = "/container/status"

    /** DataMap 内の JSON 本文のキー */
    const val KEY_PAYLOAD = "payload"

    /** DataMap 内の生成時刻のキー（同じ内容でも再送されるようにするための更新印） */
    const val KEY_GENERATED_AT = "generatedAt"

    /** ウォッチ → スマホの操作（MessageClient）のパス */
    const val COMMAND_PATH = "/container/command"

    /** Tile → 詳細画面へ渡すコンテナ ID の Intent extra */
    const val EXTRA_CONTAINER_ID = "jp.tcta.cns.container.extra.CONTAINER_ID"

    /**
     * 1 つの DataItem に載せられる上限（Data Layer API の制限は 100 KB）。
     * これを超えるときは Asset に分けるなどの対応が必要になる。
     */
    const val MAX_PAYLOAD_BYTES = 100 * 1024
}
