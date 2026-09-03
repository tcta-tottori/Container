package jp.tcta.cns.container.mobile.data

import jp.tcta.cns.container.shared.CargoItem
import jp.tcta.cns.container.shared.ContainerInfo

/** コンテナ 1 本とその荷物一覧 */
data class ContainerRecord(
    val info: ContainerInfo,
    val cargo: List<CargoItem>,
)

/**
 * 既存のコンテナ管理システムとの接続点。
 *
 * CNS（Web アプリ）や Excel、API など実際のデータ源に合わせて実装を差し替える。
 * ウォッチへ送る内容は [ContainerRecord] のリストに揃えればよい。
 * 開発中は [SampleContainerDataSource] を使う。
 */
interface ContainerDataSource {
    /** 表示用の名前（画面下部に出す） */
    val displayName: String

    suspend fun loadContainers(): List<ContainerRecord>
}
