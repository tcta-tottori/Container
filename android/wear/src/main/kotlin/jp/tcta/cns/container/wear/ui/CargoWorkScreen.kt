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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.LocalSwipeToDismissBoxState
import androidx.wear.compose.foundation.edgeSwipeToDismiss
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

/** 1 回タップと 2 回タップを見分けるための待ち時間。CNS の usePalletTap と同じ */
private const val DOUBLE_TAP_MS = 260L

/** 横スワイプで行き来する 2 面（0 = 部品表示 / 1 = 一覧） */
private const val PAGE_COUNT = 2

/** 端まで行っても止まらないよう、十分内側から始める（偶数 = 部品表示から） */
private const val START_PAGE = 1_000_000

/**
 * 荷降ろし中の作業画面。
 *
 * 横スワイプで「部品表示」と「一覧」を行き来する。左右どちらへ回しても終わりがなく、
 * 一覧の先はまた部品表示に戻る（終わりのない輪）。
 *
 * 部品表示は全画面 1 品目。背景は種類の色で塗りつぶし、文字は白か黒。
 * 1 回タップでパレットを 1 枚減らし、2 回タップで 1 枚戻す（CNS の画面と同じ操作）。
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

    val pagerState = rememberPagerState(initialPage = START_PAGE) { Int.MAX_VALUE }
    val scope = rememberCoroutineScope()

    HorizontalPager(
        state = pagerState,
        modifier = Modifier
            .fillMaxSize()
            // 横スワイプはページ送りに使うので、戻る操作は画面の左端からのスワイプにする
            .edgeSwipeToDismiss(LocalSwipeToDismissBoxState.current),
    ) { page ->
        if (page % PAGE_COUNT == 0) {
            ItemPage(
                item = selected,
                temperatureC = payload?.environment?.temperatureC,
                humidityPercent = payload?.environment?.humidityPercent,
                startedAt = container?.startedAt,
                pausedAt = container?.pausedAt,
                onDecrement = { onDecrementPallet(selected.id) },
                onIncrement = { onIncrementPallet(selected.id) },
            )
        } else {
            ItemListPage(
                items = items,
                selectedId = selected.id,
                onSelect = { id ->
                    pendingId = id
                    onSelectItem(id)
                    // 選んだらそのまま部品表示へ戻す
                    scope.launch { pagerState.animateScrollToPage(pagerState.currentPage + 1) }
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
) {
    val background = itemTypeAccent(item.itemType)
    val onBackground = contrastTextColor(background)
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    // 1 回タップは 2 回目が来ないと確定しないので、少し待ってから減らす（CNS と同じ）
    var pendingTap by remember { mutableStateOf<Job?>(null) }

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

        if (startedAt != null) {
            ElapsedTimer(
                startedAt = startedAt,
                pausedAt = pausedAt,
                color = onBackground,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 10.dp),
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
 */
@Composable
private fun ItemListPage(
    items: List<CargoItem>,
    selectedId: String,
    onSelect: (String) -> Unit,
) {
    val listState = rememberScalingLazyListState()
    val selectedIndex = items.indexOfFirst { it.id == selectedId }
    LaunchedEffect(selectedId) {
        if (selectedIndex >= 0) runCatching { listState.animateScrollToItem(selectedIndex) }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        ScalingLazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
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
