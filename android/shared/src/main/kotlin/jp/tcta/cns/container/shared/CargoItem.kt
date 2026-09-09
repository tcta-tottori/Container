package jp.tcta.cns.container.shared

import kotlinx.serialization.Serializable

/**
 * コンテナ内の荷物 1 品目。
 *
 * 数量は「パレット枚数 + 端数カートン」で持つ（例: 1PL 5CT）。
 * 元のコンテナアプリ（CNS）の PL / CT 表示と同じ考え方。
 *
 * @property id 品目 ID（コンテナ内で一意）
 * @property name 品名
 * @property quantity 総数（個）。同期はするが画面には出さない
 * @property palletCount パレット枚数（PL）
 * @property cartonCount 端数カートン数（CT）
 * @property itemType 種類。[ItemTypes] の値（ポリカバー / ジャーポット / 箱 / 部品 / 鍋 / ヤーマン部品 / その他）。色分けに使う
 * @property modelName 機種名（代表機種。例: JPV-H100）。作業画面で大きく出す。無ければ [name] を出す
 * @property remainingPercentage 残り割合 (0..100)。100 = 未着手、0 = 完了。作業画面のリングに使う。不明なら null
 * @property warning 注意書き（例: 類似品あり）。あれば作業画面に警告マークを出す
 * @property qtyPerPallet 1 パレットあたりのケース数。端数パレットの積み方を組み立てるのに使う
 * @property measurements 1 ケースの外寸 "55*38*38"（cm）。同上
 * @property location 気高コード（KTE）。不明なら null
 * @property status 状態（例: 未着手 / 作業中 / 完了）。不明なら null
 * @property newPartNumber 新建高コード（KEN）。不明なら null
 * @property representModel 代表機種（「内容」シートの値）。[modelName] と違うときだけ詳細に出す
 * @property description 英語の品名（AQSS の ITEM DESCRIPTION）。不明なら null
 * @property color 色（黒 / 白 / 他色）。品名から読み取れたときだけ
 * @property sizeLabel 鍋のサイズ（100 / 180）。鍋以外は null
 * @property packingQty 入数（個 / ケース）。0 なら不明
 * @property casesPerTier 1 段のケース数。0 なら不明
 * @property grossWeight 1 ケースの総重量（kg）。不明なら null
 * @property cbm 1 ケースのかさ（m³）。不明なら null
 * @property originalPalletCount 荷降ろし前のパレット枚数。0 なら不明
 * @property originalCartonCount 荷降ろし前の端数カートン数
 * @property originalQuantity 荷降ろし前の総数（個）。0 なら不明
 */
@Serializable
data class CargoItem(
    val id: String,
    val name: String,
    val quantity: Int,
    val palletCount: Int = 0,
    val cartonCount: Int = 0,
    val itemType: String? = null,
    val modelName: String? = null,
    val remainingPercentage: Float? = null,
    val warning: String? = null,
    val qtyPerPallet: Int = 0,
    val measurements: String? = null,
    val location: String? = null,
    val status: String? = null,
    // --- ここから下はウォッチの詳細画面で出す（古いスマホ側が送らなくても既定値で動く） ---
    val newPartNumber: String? = null,
    val representModel: String? = null,
    val description: String? = null,
    val color: String? = null,
    val sizeLabel: String? = null,
    val packingQty: Int = 0,
    val casesPerTier: Int = 0,
    val grossWeight: Float? = null,
    val cbm: Float? = null,
    val originalPalletCount: Int = 0,
    val originalCartonCount: Int = 0,
    val originalQuantity: Int = 0,
) {
    /** 残りのケース数（パレットぶん + 端数）。重さ・かさの合計を出すのに使う */
    val remainingCartons: Int get() = palletCount * qtyPerPallet + cartonCount

    /** 荷降ろし前のケース数。0 なら元の数が分からない（古いスマホ側） */
    val originalCartons: Int get() = originalPalletCount * qtyPerPallet + originalCartonCount
}
