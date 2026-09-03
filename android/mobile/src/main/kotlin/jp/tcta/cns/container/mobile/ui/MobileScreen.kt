package jp.tcta.cns.container.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import jp.tcta.cns.container.mobile.R
import jp.tcta.cns.container.mobile.data.ContainerRecord
import jp.tcta.cns.container.shared.CargoItem
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.shared.ItemTypes

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MobileScreen(
    state: MobileUiState,
    onSelectContainer: (String) -> Unit,
    onSend: () -> Unit,
    onReload: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.app_name)) },
                actions = {
                    IconButton(onClick = onReload) {
                        Icon(Icons.Filled.Refresh, contentDescription = stringResource(R.string.action_reload))
                    }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onSend,
                icon = { Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null) },
                text = { Text(stringResource(R.string.action_send)) },
            )
        },
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { SyncStatusCard(state) }

            item {
                Text(
                    text = stringResource(R.string.title_containers),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            items(state.containers, key = { it.info.id }) { record ->
                ContainerCard(
                    record = record,
                    selected = record.info.id == state.selectedContainerId,
                    onSelect = { onSelectContainer(record.info.id) },
                )
            }

            val selected = state.selected
            if (selected != null) {
                item {
                    Text(
                        text = "${stringResource(R.string.title_cargo)} — ${selected.info.name}",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
                items(selected.cargo, key = { "${selected.info.id}/${it.id}" }) { item ->
                    CargoRow(item)
                }
            }

            item {
                Text(
                    text = stringResource(R.string.note_source, state.dataSourceName),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun SyncStatusCard(state: MobileUiState) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            val syncText = when (val s = state.syncState) {
                SyncState.Idle -> stringResource(R.string.sync_idle)
                SyncState.Sending -> stringResource(R.string.sync_sending)
                is SyncState.Sent -> stringResource(R.string.sync_sent, DisplayFormat.time(s.at), s.bytes)
                is SyncState.Failed -> stringResource(R.string.sync_failed, s.message)
            }
            Text(syncText, style = MaterialTheme.typography.bodyMedium)
            Text(
                text = if (state.connectedWatches.isEmpty()) {
                    stringResource(R.string.watch_none)
                } else {
                    stringResource(R.string.watch_connected, state.connectedWatches.joinToString("、"))
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer,
            )
        }
    }
}

@Composable
private fun ContainerCard(
    record: ContainerRecord,
    selected: Boolean,
    onSelect: () -> Unit,
) {
    val info = record.info
    Card(onClick = onSelect, modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RadioButton(selected = selected, onClick = onSelect)
            Spacer(Modifier.width(4.dp))
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(info.name, style = MaterialTheme.typography.titleSmall)
                Text(
                    text = "${info.containerType} ・ ${info.status}" +
                        if (selected) " ・ ${stringResource(R.string.label_selected)}" else "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                LinearProgressIndicator(
                    progress = { (info.loadPercentage / 100f).coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(stringResource(R.string.label_load, DisplayFormat.percent(info.loadPercentage)), style = MaterialTheme.typography.bodySmall)
                    Text(stringResource(R.string.label_remaining, DisplayFormat.percent(info.remainingPercentage)), style = MaterialTheme.typography.bodySmall)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        stringResource(R.string.label_quantity, DisplayFormat.palletCarton(info.totalPallets, info.totalCartons)),
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Text(stringResource(R.string.label_sku, info.itemCount), style = MaterialTheme.typography.bodySmall)
                    Text(stringResource(R.string.label_updated, DisplayFormat.time(info.updatedAt)), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun CargoRow(item: CargoItem) {
    val typeColor = ItemTypes.colorOf(item.itemType)
    val accent = Color(typeColor.accent)
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(typeColor.background)),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TypeBadge(itemType = item.itemType)
                Text(
                    item.name,
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color(typeColor.text),
                    modifier = Modifier.weight(1f),
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                // 数量はパレットと端数カートンだけを出す（例: 1PL 5CT）
                Text(
                    DisplayFormat.palletCarton(item.palletCount, item.cartonCount),
                    style = MaterialTheme.typography.titleMedium,
                    color = accent,
                    modifier = Modifier.weight(1f),
                )
                val details = listOfNotNull(
                    item.location?.let { stringResource(R.string.label_location, it) },
                    item.status?.let { stringResource(R.string.label_status, it) },
                )
                if (details.isNotEmpty()) {
                    Text(
                        details.joinToString("　"),
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(typeColor.text),
                    )
                }
            }
        }
    }
}

/** 種類バッジ。元のコンテナアプリの type-badge と同じ色 */
@Composable
private fun TypeBadge(itemType: String?) {
    val color = ItemTypes.colorOf(itemType)
    val accent = Color(color.accent)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(accent.copy(alpha = 0.18f))
            .padding(horizontal = 10.dp, vertical = 3.dp),
    ) {
        Box(
            modifier = Modifier
                .size(7.dp)
                .clip(CircleShape)
                .background(accent),
        )
        Text(
            ItemTypes.labelOf(itemType),
            style = MaterialTheme.typography.labelMedium,
            color = Color(color.text),
        )
    }
}
