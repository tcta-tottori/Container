package jp.tcta.cns.container.shared

import kotlinx.serialization.Serializable

/**
 * コンテナ 1 本ぶんの概要。スマホ → ウォッチへ同期する。
 *
 * @property id コンテナ番号（一意）
 * @property name 表示名
 * @property containerType 形態（例: 40ft HC / 20ft）
 * @property loadPercentage 積載率 (0..100)
 * @property remainingPercentage 残容量 (0..100)
 * @property totalQuantity 荷物の総数（個）。同期はするが画面には出さない
 * @property totalPallets パレット合計（PL）
 * @property totalCartons 端数カートン合計（CT）
 * @property startedAt 荷降ろし作業の開始時刻（epoch millis）。ウォッチはここから経過時間を数える。未開始なら null
 * @property itemCount SKU 数（品目の種類数）
 * @property status 状態（例: 荷降ろし中 / 完了）
 * @property updatedAt 更新時刻（epoch millis）
 */
@Serializable
data class ContainerInfo(
    val id: String,
    val name: String,
    val containerType: String,
    val loadPercentage: Float,
    val remainingPercentage: Float,
    val totalQuantity: Int,
    val itemCount: Int,
    val status: String,
    val updatedAt: Long,
    val totalPallets: Int = 0,
    val totalCartons: Int = 0,
    val startedAt: Long? = null,
)
