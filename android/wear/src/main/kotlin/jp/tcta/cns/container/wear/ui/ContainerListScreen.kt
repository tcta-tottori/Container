package jp.tcta.cns.container.wear.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.ScreenScaffoldDefaults
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.ContainerInfo
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.wear.R

/**
 * 画面 1: コンテナ一覧。
 * 各カードにコンテナ名・積載率・残容量・ステータスを出す。
 */
@Composable
fun ContainerListScreen(
    state: ContainerUiState,
    onContainerClick: (String) -> Unit,
    onRefresh: () -> Unit,
) {
    val listState = rememberScalingLazyListState()
    val containers = state.payload?.containers.orEmpty()

    ScreenScaffold(
        scrollState = listState,
        contentPadding = ScreenScaffoldDefaults.contentPadding,
    ) { contentPadding ->
        ScalingLazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = contentPadding,
        ) {
            item {
                ListHeader { Text(stringResource(R.string.list_title)) }
            }

            if (containers.isEmpty()) {
                item {
                    Text(
                        text = stringResource(R.string.empty_title),
                        style = MaterialTheme.typography.titleSmall,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                item {
                    Text(
                        text = stringResource(R.string.empty_body),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            } else {
                items(containers, key = { it.id }) { container ->
                    ContainerCard(container = container, onClick = { onContainerClick(container.id) })
                }
            }

            item {
                ConnectionFooter(state)
            }
            item {
                Button(
                    onClick = onRefresh,
                    enabled = !state.refreshing,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(stringResource(R.string.action_refresh))
                }
            }
        }
    }
}

@Composable
private fun ContainerCard(container: ContainerInfo, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Text(
            text = container.name,
            style = MaterialTheme.typography.titleSmall,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(6.dp))
        LoadBar(fraction = container.loadPercentage / 100f)
        Spacer(Modifier.height(4.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = "${stringResource(R.string.label_load)} ${DisplayFormat.percent(container.loadPercentage)}",
                style = MaterialTheme.typography.bodySmall,
            )
            Text(
                text = "${stringResource(R.string.label_remaining)} ${DisplayFormat.percent(container.remainingPercentage)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(
            text = container.status,
            style = MaterialTheme.typography.labelSmall,
            color = statusColor(container.status),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** スマホ接続状態と最終受信時刻 */
@Composable
fun ConnectionFooter(state: ContainerUiState) {
    val connectionText = when (state.phoneConnected) {
        true -> stringResource(R.string.phone_connected)
        false -> stringResource(R.string.phone_disconnected)
        null -> null
    }
    val lines = listOfNotNull(
        connectionText,
        state.receivedAt.takeIf { it > 0 }?.let { stringResource(R.string.received_at, DisplayFormat.time(it)) },
    )
    if (lines.isNotEmpty()) {
        Text(
            text = lines.joinToString("\n"),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
