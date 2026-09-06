package jp.tcta.cns.container.wear.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.wear.compose.material3.AppScaffold
import jp.tcta.cns.container.shared.ContainerInfo
import jp.tcta.cns.container.wear.ui.theme.ContainerWearTheme

/**
 * ウォッチアプリ全体。
 *
 * 画面は 2 つだけ。荷降ろし中のコンテナがあれば作業画面、無ければ待機画面（再読込ボタン）。
 * 画面をめくる操作は縦だけにしてあるので、横スワイプはウォッチの「戻る」がそのまま働く。
 *
 * @param requestedContainerId Tile から渡されたコンテナ ID。あればそのコンテナを優先して開く
 * @param onKeepScreenOn 画面を消さないでほしいかどうか。作業画面のあいだだけ true になる
 */
@Composable
fun WearApp(
    requestedContainerId: String?,
    onRequestConsumed: () -> Unit,
    onKeepScreenOn: (Boolean) -> Unit = {},
    viewModel: ContainerViewModel = viewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    // Tile から開いたときは、そのコンテナを覚えておいて優先する
    var pinnedContainerId by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(requestedContainerId) {
        if (requestedContainerId != null) {
            pinnedContainerId = requestedContainerId
            onRequestConsumed()
        }
    }

    val payload = uiState.payload
    val container = payload?.container(pinnedContainerId)
        ?: payload?.containers?.firstOrNull { it.isWorking() }

    // 荷降ろし中は腕を下ろしても消えないようにする。待機画面ではふだんどおり消す
    DisposableEffect(container != null) {
        onKeepScreenOn(container != null)
        onDispose { onKeepScreenOn(false) }
    }

    ContainerWearTheme {
        // 現在時刻は各画面が自前で（黒い丸枠に入れて）出すので、既定の時刻表示は使わない
        AppScaffold(timeText = {}) {
            if (container == null) {
                HomeScreen(state = uiState, onRefresh = viewModel::refresh)
            } else {
                CargoWorkScreen(
                    state = uiState,
                    containerId = container.id,
                    onSelectItem = { itemId -> viewModel.selectItem(container.id, itemId) },
                    onDecrementPallet = { itemId -> viewModel.decrementPallet(container.id, itemId) },
                    onIncrementPallet = { itemId -> viewModel.incrementPallet(container.id, itemId) },
                    onCall = { itemId, which -> viewModel.call(container.id, itemId, which) },
                )
            }
        }
    }
}

/** 荷降ろしが始まっていて、まだ終わっていないコンテナか */
private fun ContainerInfo.isWorking(): Boolean =
    !status.contains("完了") && (startedAt != null || status.contains("中"))
