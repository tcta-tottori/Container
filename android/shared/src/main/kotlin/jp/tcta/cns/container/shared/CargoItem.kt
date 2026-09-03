package jp.tcta.cns.container.shared

import kotlinx.serialization.Serializable

/**
 * コンテナ内の荷物 1 品目。
 *
 * @property id 品目 ID（コンテナ内で一意）
 * @property name 品名
 * @property quantity 数量
 * @property location 位置（例: 前方 パレット 1-3）。不明なら null
 * @property status 状態（例: 未着手 / 作業中 / 完了）。不明なら null
 */
@Serializable
data class CargoItem(
    val id: String,
    val name: String,
    val quantity: Int,
    val location: String? = null,
    val status: String? = null,
)
