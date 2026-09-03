package jp.tcta.cns.container.mobile.data

import jp.tcta.cns.container.shared.CargoItem
import jp.tcta.cns.container.shared.ContainerInfo

/**
 * 動作確認用のサンプルデータ。
 * CNS で扱っている品目（ポリカバー・ジャーポット・鍋・部品）を模している。
 * 実データに接続するときは [ContainerDataSource] を実装して差し替える。
 */
class SampleContainerDataSource : ContainerDataSource {
    override val displayName: String = "サンプルデータ"

    override suspend fun loadContainers(): List<ContainerRecord> {
        val now = System.currentTimeMillis()
        return listOf(
            record(
                id = "TCLU4021378",
                name = "TCLU4021378（9/3 入荷）",
                type = "40ft HC",
                loadPercentage = 68f,
                status = "荷降ろし中",
                updatedAt = now - 12 * 60_000L,
                cargo = listOf(
                    CargoItem("1", "ポリカバー 30cm 白", 480, "前方 パレット1-3", "完了"),
                    CargoItem("2", "ポリカバー 36cm 白", 360, "前方 パレット4-5", "作業中"),
                    CargoItem("3", "ジャーポット PDU-3.0L", 240, "中央 パレット6-8", "未着手"),
                    CargoItem("4", "ジャーポット PDZ-4.0L", 200, "中央 パレット9-10", "未着手"),
                    CargoItem("5", "鍋 26cm IH", 300, "後方 パレット11-13", "未着手"),
                    CargoItem("6", "ヤーマン部品 ヒーターユニット", 280, "後方 パレット14", "未着手"),
                ),
            ),
            record(
                id = "MSKU8834910",
                name = "MSKU8834910（9/4 入荷予定）",
                type = "20ft",
                loadPercentage = 100f,
                status = "到着待ち",
                updatedAt = now - 3 * 60 * 60_000L,
                cargo = listOf(
                    CargoItem("1", "ポリカバー 24cm 透明", 600, "前方", "未着手"),
                    CargoItem("2", "鍋 22cm ガス", 420, "中央", "未着手"),
                    CargoItem("3", "鍋 ふた 22cm", 420, "中央", "未着手"),
                    CargoItem("4", "部品 電源コード 1.5m", 900, "後方", "未着手"),
                ),
            ),
            record(
                id = "OOLU2298115",
                name = "OOLU2298115（9/2 入荷）",
                type = "40ft",
                loadPercentage = 0f,
                status = "完了",
                updatedAt = now - 26 * 60 * 60_000L,
                cargo = listOf(
                    CargoItem("1", "ジャーポット PDU-2.5L", 320, "前方", "完了"),
                    CargoItem("2", "ジャーポット PDZ-3.0L", 260, "中央", "完了"),
                    CargoItem("3", "ヤーマン部品 コントロール基板", 150, "後方", "完了"),
                ),
            ),
        )
    }

    private fun record(
        id: String,
        name: String,
        type: String,
        loadPercentage: Float,
        status: String,
        updatedAt: Long,
        cargo: List<CargoItem>,
    ): ContainerRecord = ContainerRecord(
        info = ContainerInfo(
            id = id,
            name = name,
            containerType = type,
            loadPercentage = loadPercentage,
            remainingPercentage = 100f - loadPercentage,
            totalQuantity = cargo.sumOf { it.quantity },
            itemCount = cargo.size,
            status = status,
            updatedAt = updatedAt,
        ),
        cargo = cargo,
    )
}
