package jp.tcta.cns.container.wear.ui

import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.wear.compose.material3.AppScaffold
import androidx.wear.compose.material3.TimeText
import jp.tcta.cns.container.wear.ui.theme.ContainerWearTheme
import androidx.wear.compose.navigation.SwipeDismissableNavHost
import androidx.wear.compose.navigation.composable
import androidx.wear.compose.navigation.rememberSwipeDismissableNavController

/** 画面のルート定義 */
object Routes {
    const val ARG_ID = "containerId"
    const val LIST = "containers"
    const val DETAIL = "containers/{$ARG_ID}"
    const val CARGO = "containers/{$ARG_ID}/cargo"

    fun detail(id: String) = "containers/${encode(id)}"
    fun cargo(id: String) = "containers/${encode(id)}/cargo"

    // ルートは Uri として解釈されるので、記号を含む ID は percent-encoding しておく
    private fun encode(id: String): String = Uri.encode(id)
}

/**
 * ウォッチアプリ全体。
 * 一覧 → 詳細 → 荷物一覧 の 3 画面を、右スワイプで戻れる NavHost でつなぐ。
 *
 * @param requestedContainerId Tile から渡されたコンテナ ID。あれば詳細画面を直接開く
 */
@Composable
fun WearApp(
    requestedContainerId: String?,
    onRequestConsumed: () -> Unit,
    viewModel: ContainerViewModel = viewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val navController = rememberSwipeDismissableNavController()

    LaunchedEffect(requestedContainerId) {
        if (requestedContainerId != null) {
            navController.navigate(Routes.detail(requestedContainerId)) { launchSingleTop = true }
            onRequestConsumed()
        }
    }

    ContainerWearTheme {
        // 現在時刻は常に画面上部へ出す（スクロールしても隠さない）
        AppScaffold(timeText = { TimeText() }) {
            SwipeDismissableNavHost(
                navController = navController,
                startDestination = Routes.LIST,
            ) {
                composable(Routes.LIST) {
                    ContainerListScreen(
                        state = uiState,
                        onContainerClick = { id -> navController.navigate(Routes.detail(id)) },
                        onRefresh = viewModel::refresh,
                    )
                }
                composable(Routes.DETAIL) { entry ->
                    val id = entry.arguments?.getString(Routes.ARG_ID).orEmpty()
                    ContainerDetailScreen(
                        state = uiState,
                        containerId = id,
                        onShowCargo = { navController.navigate(Routes.cargo(id)) },
                    )
                }
                composable(Routes.CARGO) { entry ->
                    val id = entry.arguments?.getString(Routes.ARG_ID).orEmpty()
                    CargoWorkScreen(
                        state = uiState,
                        containerId = id,
                        onSelectItem = { itemId -> viewModel.selectItem(id, itemId) },
                        onDecrementPallet = { itemId -> viewModel.decrementPallet(id, itemId) },
                        onIncrementPallet = { itemId -> viewModel.incrementPallet(id, itemId) },
                    )
                }
            }
        }
    }
}
