package jp.tcta.cns.container.mobile.data

import jp.tcta.cns.container.shared.CargoItem
import jp.tcta.cns.container.shared.ContainerInfo
import jp.tcta.cns.container.shared.ItemTypes

/**
 * 動作確認用のサンプルデータ。
 * CNS で扱っている品目（ポリカバー・ジャーポット・鍋・部品）を模している。
 * 数量はパレット枚数 + 端数カートン（1PL 5CT）で持つ。
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
                startedAt = now - 44 * 60_000L,
                cargo = listOf(
                    item("1", "ポリカバー 30cm 白", ItemTypes.POLY_COVER, pallets = 4, cartons = 5, perPallet = 30, perCarton = 4, "前方 パレット1-4", "完了", modelName = "JPV-G50"),
                    item("2", "ポリカバー 36cm 白", ItemTypes.POLY_COVER, pallets = 7, cartons = 0, perPallet = 30, perCarton = 4, "前方 パレット5-11", "作業中", modelName = "JPV-H100", warning = "類似品あり（30cm 白）"),
                    item("3", "ジャーポット PDU-3.0L", ItemTypes.JAR_POT, pallets = 2, cartons = 8, perPallet = 20, perCarton = 2, "中央 パレット12-14", "未着手", modelName = "JRI-A100"),
                    item("4", "ジャーポット PDZ-4.0L", ItemTypes.JAR_POT, pallets = 2, cartons = 4, perPallet = 20, perCarton = 2, "中央 パレット15-17", "未着手", modelName = "JRI-B200"),
                    item("5", "鍋 26cm IH", ItemTypes.POT, pallets = 3, cartons = 6, perPallet = 24, perCarton = 4, "後方 パレット18-21", "未着手", modelName = "SR-26IH"),
                    item("6", "ヤーマン部品 ヒーターユニット", ItemTypes.YAMAN_PARTS, pallets = 1, cartons = 5, perPallet = 40, perCarton = 6, "後方 パレット22-23", "未着手", modelName = "YM-HU12"),
                    item("7", "電源コード 1.5m", ItemTypes.PARTS, pallets = 0, cartons = 9, perPallet = 50, perCarton = 20, "後方 端数置き場", "未着手"),
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
                    item("1", "ポリカバー 24cm 透明", ItemTypes.POLY_COVER, pallets = 5, cartons = 0, perPallet = 30, perCarton = 4, "前方", "未着手", modelName = "JPV-C24"),
                    item("2", "鍋 22cm ガス", ItemTypes.POT, pallets = 3, cartons = 12, perPallet = 24, perCarton = 4, "中央", "未着手", modelName = "SR-22G"),
                    item("3", "段ボール 22cm 鍋用", ItemTypes.BOX, pallets = 1, cartons = 3, perPallet = 60, perCarton = 10, "中央", "未着手"),
                    item("4", "電源コード 1.5m", ItemTypes.PARTS, pallets = 1, cartons = 0, perPallet = 50, perCarton = 20, "後方", "未着手"),
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
                    item("1", "ジャーポット PDU-2.5L", ItemTypes.JAR_POT, pallets = 4, cartons = 0, perPallet = 20, perCarton = 2, "前方", "完了", modelName = "JRI-A080"),
                    item("2", "ジャーポット PDZ-3.0L", ItemTypes.JAR_POT, pallets = 3, cartons = 5, perPallet = 20, perCarton = 2, "中央", "完了", modelName = "JRI-B150"),
                    item("3", "ヤーマン部品 コントロール基板", ItemTypes.YAMAN_PARTS, pallets = 0, cartons = 15, perPallet = 40, perCarton = 10, "後方", "完了"),
                    item("4", "取扱説明書（その他）", null, pallets = 0, cartons = 2, perPallet = 1, perCarton = 100, "後方", "完了"),
                ),
            ),
        )
    }

    /**
     * PL / CT と 1 パレットあたりカートン数・入数から総数（個）を計算する。
     * 残り割合は状態から決める（完了 0% / 作業中 40% / 未着手 100%）。
     */
    private fun item(
        id: String,
        name: String,
        itemType: String?,
        pallets: Int,
        cartons: Int,
        perPallet: Int,
        perCarton: Int,
        location: String?,
        status: String?,
        modelName: String? = null,
        warning: String? = null,
    ): CargoItem = CargoItem(
        id = id,
        name = name,
        quantity = (pallets * perPallet + cartons) * perCarton,
        palletCount = pallets,
        cartonCount = cartons,
        itemType = itemType,
        modelName = modelName,
        remainingPercentage = when {
            status == null -> null
            status.contains("完了") -> 0f
            status.contains("中") -> 40f
            else -> 100f
        },
        warning = warning,
        location = location,
        status = status,
    )

    private fun record(
        id: String,
        name: String,
        type: String,
        loadPercentage: Float,
        status: String,
        updatedAt: Long,
        cargo: List<CargoItem>,
        startedAt: Long? = null,
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
            totalPallets = cargo.sumOf { it.palletCount },
            totalCartons = cargo.sumOf { it.cartonCount },
            startedAt = startedAt,
        ),
        cargo = cargo,
    )
}
