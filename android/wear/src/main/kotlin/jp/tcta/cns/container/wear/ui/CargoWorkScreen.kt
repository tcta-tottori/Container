package jp.tcta.cns.container.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListAnchorType
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.CargoItem
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.shared.ItemTypes
import jp.tcta.cns.container.wear.R
import jp.tcta.cns.container.wear.ui.theme.WearColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** 1 回タップと 2 回タップを見分けるための待ち時間。CNS の usePalletTap と同じ */
private const val DOUBLE_TAP_MS = 260L

/**
 * 画面 3: 荷降ろし中の作業画面。
 *
 * 左 2/3 … 選択中の機種の丸枠（固定）。上から 種類バッジ / 機種名 / PL・CT / 気温・湿度。
 *          1 回タップで PL を 1 枚減らし、2 回タップで 1 枚戻す（CNS の画面と同じ操作）。
 * 右 1/3 … 機種一覧。縦にスクロールでき、タップで表示を切り替える。
 *
 * 操作はスマホ（CNS）へ送り、CNS 側の画面も一緒に切り替わる。
 * 画面の数字は CNS からの同期で更新される。
 */
@Composable
fun CargoWorkScreen(
    state: ContainerUiState,
    containerId: String,
    onSelectItem: (String) -> Unit,
    onDecrementPallet: (String) -> Unit,
    onIncrementPallet: (String) -> Unit,
) {
    val payload = state.payload
    val container = payload?.container(containerId)
    val items = payload?.cargoOf(containerId).orEmpty()

    // CNS 側で「作業中」の品目を選択中として扱う。ウォッチで切り替えると CNS も追従する
    val syncedId = items.firstOrNull { it.status?.contains("中") == true }?.id
    // 切り替え直後は同期が届くまで少し間があるので、押した品目を先に表示しておく
    var pendingId by remember(containerId) { mutableStateOf<String?>(null) }
    LaunchedEffect(syncedId) { if (syncedId != null) pendingId = null }
    val selected = items.firstOrNull { it.id == (pendingId ?: syncedId) }
        ?: items.firstOrNull { it.status?.contains("完了") != true }
        ?: items.firstOrNull()

    if (selected == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(
                text = stringResource(R.string.cargo_empty),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
        return
    }

    Row(modifier = Modifier.fillMaxSize()) {
        WorkDial(
            item = selected,
            temperatureC = payload?.environment?.temperatureC,
            humidityPercent = payload?.environment?.humidityPercent,
            startedAt = container?.startedAt,
            pausedAt = container?.pausedAt,
            onDecrement = { onDecrementPallet(selected.id) },
            onIncrement = { onIncrementPallet(selected.id) },
            modifier = Modifier
                .weight(0.66f)
                .fillMaxHeight(),
        )
        ItemRail(
            items = items,
            selectedId = selected.id,
            onSelect = { id ->
                pendingId = id
                onSelectItem(id)
            },
            modifier = Modifier
                .weight(0.34f)
                .fillMaxHeight(),
        )
    }
}

/**
 * 左側の丸枠。中身は上から 種類バッジ / 機種名 / PL・CT / 気温・湿度。
 * 外周のリングは残り割合、下端に経過時間を出す。
 */
@Composable
private fun WorkDial(
    item: CargoItem,
    temperatureC: Float?,
    humidityPercent: Int?,
    startedAt: Long?,
    pausedAt: Long?,
    onDecrement: () -> Unit,
    onIncrement: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val accent = itemTypeAccent(item.itemType)
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    // 1 回タップは 2 回目が来ないと確定しないので、少し待ってから減らす（CNS と同じ）
    var pendingTap by remember { mutableStateOf<kotlinx.coroutines.Job?>(null) }

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .padding(4.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        listOf(accent.copy(alpha = 0.20f), accent.copy(alpha = 0.10f), Color.Transparent),
                    ),
                )
                .border(2.dp, accent.copy(alpha = 0.9f), CircleShape)
                .pointerInput(item.id) {
                    detectTapGestures(
                        onTap = {
                            pendingTap?.cancel()
                            pendingTap = scope.launch {
                                delay(DOUBLE_TAP_MS)
                                view.performHapticFeedback(android.view.HapticFeedbackConstants.CONFIRM)
                                onDecrement()
                            }
                        },
                        onDoubleTap = {
                            pendingTap?.cancel()
                            pendingTap = null
                            view.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
                            onIncrement()
                        },
                    )
                },
            contentAlignment = Alignment.Center,
        ) {
            ProgressRing(
                accent = accent,
                progress = (item.remainingPercentage ?: 100f) / 100f,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(5.dp),
            )
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 20.dp, vertical = 16.dp),
            ) {
                TypeBadge(itemType = item.itemType)
                Text(
                    text = item.modelName ?: item.name,
                    style = MaterialTheme.typography.displaySmall,
                    color = accent,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                PalletCartonRow(accent = accent, pallets = item.palletCount, cartons = item.cartonCount)
                if (temperatureC != null || humidityPercent != null) {
                    ClimateRow(temperatureC = temperatureC, humidityPercent = humidityPercent)
                }
            }
            if (!item.warning.isNullOrBlank()) {
                Icon(
                    imageVector = Icons.Filled.Warning,
                    contentDescription = item.warning,
                    tint = WearColors.Orange,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(top = 14.dp, end = 18.dp)
                        .size(16.dp),
                )
            }
            if (startedAt != null) {
                ElapsedTimer(
                    startedAt = startedAt,
                    pausedAt = pausedAt,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 10.dp),
                )
            }
        }
    }
}

/** 右側の機種一覧。縦スクロールでき、選択中は種類の色で光る */
@Composable
private fun ItemRail(
    items: List<CargoItem>,
    selectedId: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val listState = rememberScalingLazyListState()
    val selectedIndex = items.indexOfFirst { it.id == selectedId }
    LaunchedEffect(selectedId) {
        if (selectedIndex >= 0) runCatching { listState.animateScrollToItem(selectedIndex) }
    }
    ScalingLazyColumn(
        state = listState,
        modifier = modifier,
        contentPadding = PaddingValues(vertical = 8.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        anchorType = ScalingLazyListAnchorType.ItemCenter,
    ) {
        items(items, key = { it.id }) { item ->
            RailChip(
                item = item,
                selected = item.id == selectedId,
                onClick = { onSelect(item.id) },
            )
        }
    }
}

@Composable
private fun RailChip(item: CargoItem, selected: Boolean, onClick: () -> Unit) {
    val accent = itemTypeAccent(item.itemType)
    val done = item.status?.contains("完了") == true
    val dot = when {
        selected -> accent
        done -> MaterialTheme.colorScheme.outline
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .height(38.dp)
            .clip(RoundedCornerShape(19.dp))
            .background(
                if (selected) accent.copy(alpha = 0.22f) else MaterialTheme.colorScheme.surfaceContainer,
            )
            .then(
                if (selected) Modifier.border(1.dp, accent.copy(alpha = 0.7f), RoundedCornerShape(19.dp))
                else Modifier,
            )
            .pointerInput(item.id) { detectTapGestures(onTap = { onClick() }) }
            .padding(horizontal = 8.dp),
    ) {
        Box(
            modifier = Modifier
                .size(7.dp)
                .clip(CircleShape)
                .background(dot),
        )
        Spacer(Modifier.width(5.dp))
        Text(
            text = item.modelName ?: item.name,
            style = MaterialTheme.typography.labelMedium,
            color = if (selected) accent else MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
