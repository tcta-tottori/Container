package jp.tcta.cns.container.wear.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.AutoCenteringParams
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.wear.R

/**
 * 画面 2: コンテナ詳細。
 * 先頭にコンテナの概要（積載率バッジ・コンテナ番号・PL / CT 合計・経過時間）、
 * 続けてコンテナ番号・形態・積載率・残容量・荷物数・SKU 数・状態・更新時刻、作業画面へのボタン。
 */
@Composable
fun ContainerDetailScreen(
    state: ContainerUiState,
    containerId: String,
    onShowCargo: () -> Unit,
) {
    val listState = rememberScalingLazyListState(initialCenterItemIndex = 0, initialCenterItemScrollOffset = 0)
    val container = state.payload?.container(containerId)
    val cargoCount = state.payload?.cargoOf(containerId)?.size ?: 0

    // ScreenScaffold にスクロールを渡すと時刻がスクロールで隠れるため、Box で受ける
    Box(modifier = Modifier.fillMaxSize()) {
        ScalingLazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            // 上は常時表示の時刻のぶんを空ける
            contentPadding = PaddingValues(top = 34.dp, bottom = 44.dp, start = 10.dp, end = 10.dp),
            autoCentering = AutoCenteringParams(itemIndex = 0, itemOffset = 0),
        ) {
            if (container == null) {
                item {
                    Text(
                        text = stringResource(R.string.not_found),
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                return@ScalingLazyColumn
            }

            item(key = "summary") {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    PillBadge(
                        text = "${stringResource(R.string.label_load)} ${DisplayFormat.percent(container.loadPercentage)}",
                        accent = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = container.name,
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(4.dp))
                    PalletCartonRow(
                        accent = MaterialTheme.colorScheme.primary,
                        pallets = container.totalPallets,
                        cartons = container.totalCartons,
                    )
                    val startedAt = container.startedAt
                    if (startedAt != null) {
                        Spacer(Modifier.height(4.dp))
                        ElapsedTimer(startedAt = startedAt, pausedAt = container.pausedAt)
                    }
                }
            }

            item { KeyValueRow(stringResource(R.string.detail_container_no), container.id) }
            item { KeyValueRow(stringResource(R.string.detail_type), container.containerType) }
            item { KeyValueRow(stringResource(R.string.detail_load), DisplayFormat.percent(container.loadPercentage)) }
            item { KeyValueRow(stringResource(R.string.detail_remaining), DisplayFormat.percent(container.remainingPercentage)) }
            item {
                KeyValueRow(
                    stringResource(R.string.detail_quantity),
                    DisplayFormat.palletCarton(container.totalPallets, container.totalCartons),
                )
            }
            item { KeyValueRow(stringResource(R.string.detail_sku), stringResource(R.string.count_unit, container.itemCount)) }
            item {
                KeyValueRow(
                    stringResource(R.string.detail_status),
                    container.status,
                    valueColor = statusColor(container.status),
                )
            }
            item { KeyValueRow(stringResource(R.string.detail_updated), DisplayFormat.time(container.updatedAt)) }

            item {
                Button(
                    onClick = onShowCargo,
                    enabled = cargoCount > 0,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(stringResource(R.string.action_cargo)) },
                    secondaryLabel = {
                        Text(stringResource(R.string.cargo_title, cargoCount))
                    },
                )
            }
            item { ConnectionFooter(state) }
        }
    }
}
