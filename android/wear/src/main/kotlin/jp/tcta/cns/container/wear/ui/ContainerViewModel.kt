package jp.tcta.cns.container.wear.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import jp.tcta.cns.container.shared.ContainerSyncPayload
import jp.tcta.cns.container.shared.WatchCommand
import jp.tcta.cns.container.wear.data.ContainerRepository
import jp.tcta.cns.container.wear.sync.CommandSender
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class ContainerUiState(
    /** 最後に受信した内容。未受信なら null */
    val payload: ContainerSyncPayload? = null,
    /** ウォッチが受信した時刻。未受信なら 0 */
    val receivedAt: Long = 0L,
    /** スマホ接続状態。未確認なら null */
    val phoneConnected: Boolean? = null,
    val refreshing: Boolean = false,
)

/**
 * 画面用の状態。データは [ContainerRepository]（DataStore）から流れてくるので、
 * ListenerService が新しい内容を保存すると画面も自動で更新される。
 */
class ContainerViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = ContainerRepository.getInstance(application)
    private val commandSender = CommandSender(application)
    private val phoneConnected = MutableStateFlow<Boolean?>(null)
    private val refreshing = MutableStateFlow(false)

    val uiState: StateFlow<ContainerUiState> = combine(
        repository.snapshot,
        phoneConnected,
        refreshing,
    ) { snapshot, connected, isRefreshing ->
        ContainerUiState(
            payload = snapshot?.payload,
            receivedAt = snapshot?.receivedAt ?: 0L,
            phoneConnected = connected,
            refreshing = isRefreshing,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ContainerUiState())

    init {
        refresh()
    }

    /** 品目を切り替える。スマホ（CNS）の表示も追従する */
    fun selectItem(containerId: String, itemId: String) =
        send(WatchCommand.SELECT_ITEM, containerId, itemId)

    /** パレットを 1 枚減らす（CNS の画面を 1 回タップしたのと同じ） */
    fun decrementPallet(containerId: String, itemId: String) =
        send(WatchCommand.DECREMENT_PALLET, containerId, itemId)

    /** パレットを 1 枚戻す（CNS の画面を 2 回タップしたのと同じ） */
    fun incrementPallet(containerId: String, itemId: String) =
        send(WatchCommand.INCREMENT_PALLET, containerId, itemId)

    /** 完了にした品目を元に戻す */
    fun uncompleteItem(containerId: String, itemId: String) =
        send(WatchCommand.UNCOMPLETE_ITEM, containerId, itemId)

    /** スマホでコールを鳴らす。[which] は WatchCommand.CALL_* のどれか */
    fun call(containerId: String, itemId: String, which: String) =
        send(WatchCommand.CALL, containerId, itemId, which)

    private fun send(type: String, containerId: String, itemId: String, arg: String? = null) {
        viewModelScope.launch {
            val delivered = commandSender.send(
                WatchCommand(
                    type = type,
                    itemId = itemId,
                    containerId = containerId,
                    issuedAt = System.currentTimeMillis(),
                    arg = arg,
                ),
            )
            phoneConnected.value = delivered
        }
    }

    /** Data Layer を読み直し、スマホ接続状態を確認する */
    fun refresh() {
        if (refreshing.value) return
        viewModelScope.launch {
            refreshing.value = true
            try {
                repository.refreshFromDataLayer()
                phoneConnected.value = repository.isPhoneConnected()
            } finally {
                refreshing.value = false
            }
        }
    }
}
