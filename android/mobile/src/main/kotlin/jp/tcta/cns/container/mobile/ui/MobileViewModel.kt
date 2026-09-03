package jp.tcta.cns.container.mobile.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import jp.tcta.cns.container.mobile.data.ContainerDataSource
import jp.tcta.cns.container.mobile.data.ContainerRecord
import jp.tcta.cns.container.mobile.data.SampleContainerDataSource
import jp.tcta.cns.container.mobile.sync.WearSyncClient
import jp.tcta.cns.container.shared.ContainerSyncPayload
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** 送信状態 */
sealed interface SyncState {
    data object Idle : SyncState
    data object Sending : SyncState
    data class Sent(val at: Long, val bytes: Int) : SyncState
    data class Failed(val message: String) : SyncState
}

data class MobileUiState(
    val containers: List<ContainerRecord> = emptyList(),
    val selectedContainerId: String? = null,
    val syncState: SyncState = SyncState.Idle,
    val connectedWatches: List<String> = emptyList(),
    val dataSourceName: String = "",
) {
    val selected: ContainerRecord? get() = containers.firstOrNull { it.info.id == selectedContainerId }
}

class MobileViewModel(application: Application) : AndroidViewModel(application) {
    // 実データに接続するときはここを差し替える
    private val dataSource: ContainerDataSource = SampleContainerDataSource()
    private val syncClient = WearSyncClient(application)

    private val _uiState = MutableStateFlow(MobileUiState(dataSourceName = dataSource.displayName))
    val uiState: StateFlow<MobileUiState> = _uiState.asStateFlow()

    init {
        reload()
    }

    /** データ源から読み直して、そのままウォッチへ送る */
    fun reload() {
        viewModelScope.launch {
            val records = dataSource.loadContainers()
            _uiState.update { state ->
                val stillValid = records.any { it.info.id == state.selectedContainerId }
                state.copy(
                    containers = records,
                    selectedContainerId = if (stillValid) state.selectedContainerId else records.firstOrNull()?.info?.id,
                )
            }
            refreshWatches()
            syncToWatch()
        }
    }

    /** Tile に出すコンテナを切り替える。切り替えたら即送信する */
    fun selectContainer(id: String) {
        if (_uiState.value.selectedContainerId == id) return
        _uiState.update { it.copy(selectedContainerId = id) }
        syncToWatch()
    }

    fun syncToWatch() {
        viewModelScope.launch {
            _uiState.update { it.copy(syncState = SyncState.Sending) }
            val result = syncClient.publish(buildPayload())
            _uiState.update { state ->
                state.copy(
                    syncState = result.fold(
                        onSuccess = { SyncState.Sent(System.currentTimeMillis(), it) },
                        onFailure = { SyncState.Failed(it.message ?: it.javaClass.simpleName) },
                    ),
                )
            }
            refreshWatches()
        }
    }

    private fun buildPayload(): ContainerSyncPayload {
        val state = _uiState.value
        return ContainerSyncPayload(
            generatedAt = System.currentTimeMillis(),
            selectedContainerId = state.selectedContainerId,
            containers = state.containers.map { it.info },
            cargo = state.containers.associate { it.info.id to it.cargo },
        )
    }

    private suspend fun refreshWatches() {
        val names = syncClient.connectedWatchNames()
        _uiState.update { it.copy(connectedWatches = names) }
    }
}
