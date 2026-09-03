package jp.tcta.cns.container.wear.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.ScreenScaffoldDefaults
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.wear.R

/**
 * 画面 2: コンテナ詳細。
 * コンテナ番号・積載率・残容量・荷物数・SKU 数・更新時刻を出し、荷物一覧へ進める。
 */
@Composable
fun ContainerDetailScreen(
    state: ContainerUiState,
    containerId: String,
    onShowCargo: () -> Unit,
) {
    val listState = rememberScalingLazyListState()
    val container = state.payload?.container(containerId)
    val cargoCount = state.payload?.cargoOf(containerId)?.size ?: 0

    ScreenScaffold(
        scrollState = listState,
        contentPadding = ScreenScaffoldDefaults.contentPadding,
    ) { contentPadding ->
        ScalingLazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = contentPadding,
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

            item {
                ListHeader {
                    Text(
                        text = container.name,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center,
                    )
                }
            }
            item {
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    LoadGauge(loadPercentage = container.loadPercentage, size = 104.dp)
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
