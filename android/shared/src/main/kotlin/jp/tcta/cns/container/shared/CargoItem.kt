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
 * @property location 位置（例: 前方 パレット 1-3）。不明なら null
 * @property status 状態（例: 未着手 / 作業中 / 完了）。不明なら null
 */
@Serializable
data class CargoItem(
    val id: String,
    val name: String,
    val quantity: Int,
    val palletCount: Int = 0,
    val cartonCount: Int = 0,
    val itemType: String? = null,
    val location: String? = null,
    val status: String? = null,
)
