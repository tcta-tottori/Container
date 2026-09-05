package jp.tcta.cns.container.wear.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.AutoCenteringParams
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.ButtonDefaults
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.CargoItem
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.wear.R

/**
 * 画面 3: 作業画面（荷物一覧）。
 *
 * 先頭に「いま見ている品目」のダイヤル（種類の色のリング・機種名・PL / CT・気温湿度・経過時間）、
 * その下に品目の切り替えチップを並べる。チップをタップするとダイヤルがその品目に変わる。
 * ウォッチ内での表示切り替えだけで、スマホ側のデータは変えない（読み取り専用）。
 */
@Composable
fun CargoWorkScreen(
    state: ContainerUiState,
    containerId: String,
) {
    val payload = state.payload
    val container = payload?.container(containerId)
    val items = payload?.cargoOf(containerId).orEmpty()

    // 最初は作業中 → 未着手 → 先頭 の順で選ぶ
    var selectedId by rememberSaveable(containerId) { mutableStateOf(defaultItemId(items)) }
    val selected = items.firstOrNull { it.id == selectedId } ?: items.firstOrNull()

    val listState = rememberScalingLazyListState(initialCenterItemIndex = 0, initialCenterItemScrollOffset = 0)
    LaunchedEffect(selectedId) {
        listState.animateScrollToItem(0)
    }

    ScreenScaffold(
        scrollState = listState,
        contentPadding = PaddingValues(0.dp),
    ) { _ ->
        ScalingLazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = 0.dp, bottom = 40.dp),
            autoCentering = AutoCenteringParams(itemIndex = 0, itemOffset = 0),
        ) {
            if (selected == null) {
                item {
                    Box(modifier = Modifier.fillMaxSize()) {
                        Text(
                            text = stringResource(R.string.cargo_empty),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
                return@ScalingLazyColumn
            }

            item(key = "dial") {
                val accent = itemTypeAccent(selected.itemType)
                val remaining = selected.remainingPercentage
                Dial(
                    accent = accent,
                    progress = (remaining ?: 100f) / 100f,
                    badgeText = if (remaining != null) DisplayFormat.percent(remaining) else (selected.status ?: "-"),
                    title = selected.modelName ?: selected.name,
                    subtitle = if (selected.modelName != null) selected.name else selected.location,
                    pallets = selected.palletCount,
                    cartons = selected.cartonCount,
                    environment = payload?.environment,
                    startedAt = container?.startedAt,
                    pausedAt = container?.pausedAt,
                    warning = selected.warning,
                )
            }

            item(key = "header") {
                ListHeader { Text(stringResource(R.string.cargo_title, items.size)) }
            }
            items(items, key = { it.id }) { item ->
                ItemChip(
                    item = item,
                    selected = item.id == selected.id,
                    onClick = { selectedId = item.id },
                )
            }
        }
    }
}

/** 作業中があればそれ、無ければ未完了の先頭、それも無ければ先頭 */
private fun defaultItemId(items: List<CargoItem>): String? =
    items.firstOrNull { it.status?.contains("中") == true }?.id
        ?: items.firstOrNull { it.status?.contains("完了") != true }?.id
        ?: items.firstOrNull()?.id

/** 品目の切り替えチップ（参考デザインの右側リスト） */
@Composable
private fun ItemChip(item: CargoItem, selected: Boolean, onClick: () -> Unit) {
    val accent = itemTypeAccent(item.itemType)
    val dotColor = if (selected) accent else MaterialTheme.colorScheme.onSurfaceVariant
    Button(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = if (selected) {
            ButtonDefaults.buttonColors(
                containerColor = accent.copy(alpha = 0.22f),
                contentColor = accent,
                secondaryContentColor = accent.copy(alpha = 0.85f),
                iconColor = accent,
            )
        } else {
            ButtonDefaults.filledTonalButtonColors()
        },
        border = if (selected) BorderStroke(1.dp, accent.copy(alpha = 0.6f)) else null,
        icon = {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(dotColor),
            )
        },
        secondaryLabel = {
            Text(
                text = listOfNotNull(
                    DisplayFormat.palletCarton(item.palletCount, item.cartonCount),
                    item.status,
                ).joinToString(" ・ "),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        },
        label = {
            Text(
                text = item.modelName ?: item.name,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        },
    )
}
