package jp.tcta.cns.container.wear.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.CargoItem
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.shared.ItemTypes
import jp.tcta.cns.container.wear.R
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs

/** 1 回タップと 2 回タップを見分けるための待ち時間。CNS の usePalletTap と同じ */
private const val DOUBLE_TAP_MS = 260L

/** 縦スワイプで品目を切り替えるとみなす移動量 */
private val ITEM_SWITCH_THRESHOLD = 44.dp

/** 画面のいちばん下の、一覧を引き出せる帯の高さ */
private val BOTTOM_EDGE_HEIGHT = 64.dp

/** 一覧の端からさらに払って部品表示へ戻るとみなす移動量 */
private val LIST_DISMISS_THRESHOLD = 56.dp

/**
 * 荷降ろし中の作業画面。
 *
 * 横スワイプは使わない（ウォッチの「戻る」操作をそのまま活かすため）。
 *
 * 部品表示は全画面 1 品目。背景は種類の色で塗りつぶし、文字は白か黒。
 * - 1 回タップ … パレットを 1 枚減らす（CNS の画面と同じ）
 * - 2 回タップ … パレットを 1 枚戻す
 * - 縦スワイプ … 品目を切り替える（上へ払うと次、下へ払うと前。端まで行くと反対の端へ回る）
 * - 画面のいちばん下から上へ払う … 一覧を開く
 *
 * 一覧は、いちばん上からさらに下へ、またはいちばん下からさらに上へ払うと部品表示へ戻る。
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
    // 切り替え直後は同期が届くまで少し間があるので、押した品目を先に出しておく
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

    var showList by remember(containerId) { mutableStateOf(false) }

    // 縦スワイプでの品目送り。端まで行ったら反対の端へ回る
    val selectedIndex = items.indexOfFirst { it.id == selected.id }
    val stepItem: (Int) -> Unit = { delta ->
        if (items.size > 1 && selectedIndex >= 0) {
            val next = items[((selectedIndex + delta) % items.size + items.size) % items.size]
            pendingId = next.id
            onSelectItem(next.id)
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        ItemPage(
            item = selected,
            temperatureC = payload?.environment?.temperatureC,
            humidityPercent = payload?.environment?.humidityPercent,
            startedAt = container?.startedAt,
            pausedAt = container?.pausedAt,
            onDecrement = { onDecrementPallet(selected.id) },
            onIncrement = { onIncrementPallet(selected.id) },
            onNextItem = { stepItem(1) },
            onPrevItem = { stepItem(-1) },
            onOpenList = { showList = true },
        )

        AnimatedVisibility(
            visible = showList,
            modifier = Modifier.fillMaxSize(),
            enter = slideInVertically { it },
            exit = slideOutVertically { it },
        ) {
            ItemListPage(
                items = items,
                selectedId = selected.id,
                onClose = { showList = false },
                onSelect = { id ->
                    pendingId = id
                    onSelectItem(id)
                    showList = false
                },
            )
        }
    }
}

/**
 * 部品表示（全画面 1 品目）。
 * 上から 種類 / 機種名 / PL・CT / 気温・湿度 / 経過時間。
 */
@Composable
private fun ItemPage(
    item: CargoItem,
    temperatureC: Float?,
    humidityPercent: Int?,
    startedAt: Long?,
    pausedAt: Long?,
    onDecrement: () -> Unit,
    onIncrement: () -> Unit,
    onNextItem: () -> Unit,
    onPrevItem: () -> Unit,
    onOpenList: () -> Unit,
) {
    val background = itemTypeAccent(item.itemType)
    val onBackground = contrastTextColor(background)
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    // 1 回タップは 2 回目が来ないと確定しないので、少し待ってから減らす（CNS と同じ）
    var pendingTap by remember { mutableStateOf<Job?>(null) }
    // 縦スワイプの移動量。指を離したときに、しきい値を超えていれば品目を送る
    val density = LocalDensity.current
    val switchThresholdPx = with(density) { ITEM_SWITCH_THRESHOLD.toPx() }
    val bottomEdgePx = with(density) { BOTTOM_EDGE_HEIGHT.toPx() }
    var dragAmount by remember { mutableFloatStateOf(0f) }
    var fromBottomEdge by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(background)
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
            }
            .pointerInput(item.id) {
                // 縦スワイプ。画面のいちばん下から始めたときだけ一覧を引き出す
                detectVerticalDragGestures(
                    onDragStart = { offset ->
                        dragAmount = 0f
                        fromBottomEdge = offset.y > size.height - bottomEdgePx
                    },
                    onDragCancel = { dragAmount = 0f },
                    onDragEnd = {
                        when {
                            fromBottomEdge && dragAmount <= -switchThresholdPx -> {
                                view.performHapticFeedback(android.view.HapticFeedbackConstants.CONFIRM)
                                onOpenList()
                            }
                            fromBottomEdge -> Unit
                            dragAmount <= -switchThresholdPx -> {
                                view.performHapticFeedback(android.view.HapticFeedbackConstants.CONFIRM)
                                onNextItem()
                            }
                            dragAmount >= switchThresholdPx -> {
                                view.performHapticFeedback(android.view.HapticFeedbackConstants.CONFIRM)
                                onPrevItem()
                            }
                        }
                        dragAmount = 0f
                    },
                    onVerticalDrag = { change, delta ->
                        dragAmount += delta
                        change.consume()
                    },
                )
            },
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .fillMaxSize()
                // 丸い画面の縁に文字がかからないよう左右を空ける
                .padding(horizontal = 34.dp, vertical = 30.dp),
        ) {
            Text(
                text = ItemTypes.labelOf(item.itemType),
                style = MaterialTheme.typography.labelSmall,
                color = onBackground.copy(alpha = 0.75f),
                maxLines = 1,
            )
            Spacer(Modifier.height(2.dp))
            MarqueeText(
                text = item.modelName ?: item.name,
                style = MaterialTheme.typography.displaySmall,
                color = onBackground,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(6.dp))
            BigPalletCarton(pallets = item.palletCount, cartons = item.cartonCount, color = onBackground)
            if (temperatureC != null || humidityPercent != null) {
                Spacer(Modifier.height(6.dp))
                ClimateRow(
                    temperatureC = temperatureC,
                    humidityPercent = humidityPercent,
                    color = onBackground.copy(alpha = 0.8f),
                )
            }
        }

        EdgeScrim(strength = 0.35f)

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 6.dp),
        ) {
            if (startedAt != null) {
                ElapsedTimer(startedAt = startedAt, pausedAt = pausedAt, color = onBackground)
                Spacer(Modifier.height(4.dp))
            }
            // ここから上へ払うと一覧が出る、という目印
            Box(
                modifier = Modifier
                    .width(28.dp)
                    .height(3.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(onBackground.copy(alpha = 0.5f)),
            )
        }
    }
}

/** PL と CT の大きな数字 */
@Composable
private fun BigPalletCarton(pallets: Int, cartons: Int, color: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxWidth(),
    ) {
        BigNumber(label = "PL", value = pallets, color = color, modifier = Modifier.weight(1f))
        Box(
            modifier = Modifier
                .width(1.dp)
                .height(40.dp)
                .background(color.copy(alpha = 0.35f)),
        )
        BigNumber(label = "CT", value = cartons, color = color, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun BigNumber(label: String, value: Int, color: Color, modifier: Modifier = Modifier) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = color.copy(alpha = 0.75f),
        )
        Text(
            text = value.coerceAtLeast(0).toString(),
            style = MaterialTheme.typography.numeralMedium,
            color = color,
            maxLines = 1,
        )
    }
}

/**
 * 一覧。機種名と PL / CT / PCS を、角を丸めたバーで並べる。
 * タップするとその品目に切り替わり、部品表示へ戻る。
 * いちばん上からさらに下へ、いちばん下からさらに上へ払っても部品表示へ戻る。
 */
@Composable
private fun ItemListPage(
    items: List<CargoItem>,
    selectedId: String,
    onClose: () -> Unit,
    onSelect: (String) -> Unit,
) {
    val listState = rememberScalingLazyListState()
    val selectedIndex = items.indexOfFirst { it.id == selectedId }
    LaunchedEffect(selectedId) {
        if (selectedIndex >= 0) runCatching { listState.animateScrollToItem(selectedIndex) }
    }

    // 端でさらに払われた分を数えて、しきい値を超えたら閉じる
    val dismissThresholdPx = with(LocalDensity.current) { LIST_DISMISS_THRESHOLD.toPx() }
    var overscroll by remember { mutableFloatStateOf(0f) }
    val edgePull = remember(dismissThresholdPx) {
        object : NestedScrollConnection {
            override fun onPostScroll(
                consumed: Offset,
                available: Offset,
                source: androidx.compose.ui.input.nestedscroll.NestedScrollSource,
            ): Offset {
                if (consumed.y != 0f) overscroll = 0f
                if (available.y != 0f) {
                    overscroll += available.y
                    if (abs(overscroll) >= dismissThresholdPx) {
                        overscroll = 0f
                        onClose()
                    }
                }
                return Offset.Zero
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        ScalingLazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .nestedScroll(edgePull),
            contentPadding = PaddingValues(top = 34.dp, bottom = 34.dp, start = 12.dp, end = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            items(items, key = { it.id }) { item ->
                ItemBar(item = item, selected = item.id == selectedId, onClick = { onSelect(item.id) })
            }
        }
        EdgeScrim()
    }
}

@Composable
private fun ItemBar(item: CargoItem, selected: Boolean, onClick: () -> Unit) {
    val background = itemTypeAccent(item.itemType)
    val onBackground = contrastTextColor(background)
    Column(
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxWidth()
            .height(54.dp)
            .clip(RoundedCornerShape(27.dp))
            .background(background)
            .then(
                if (selected) Modifier.border(2.dp, onBackground.copy(alpha = 0.85f), RoundedCornerShape(27.dp))
                else Modifier,
            )
            .pointerInput(item.id) { detectTapGestures(onTap = { onClick() }) }
            .padding(horizontal = 16.dp),
    ) {
        Text(
            text = item.modelName ?: item.name,
            style = MaterialTheme.typography.titleSmall,
            color = onBackground,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = "${item.palletCount}PL  ${item.cartonCount}CT  ${DisplayFormat.quantity(item.quantity)}pcs",
            style = MaterialTheme.typography.labelSmall,
            color = onBackground.copy(alpha = 0.85f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
