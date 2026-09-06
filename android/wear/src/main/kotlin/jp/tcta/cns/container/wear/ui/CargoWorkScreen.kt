package jp.tcta.cns.container.wear.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.BoxWithConstraintsScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.CargoItem
import jp.tcta.cns.container.shared.DisplayFormat
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

/** リングの開始角（3 時から時計回り）。下の 60 度は経過時間のために空ける */
private const val RING_START_ANGLE = 120f

/** リングの長さ（度） */
private const val RING_SWEEP = 300f

/**
 * 荷降ろし中の作業画面。
 *
 * 横スワイプは使わない（ウォッチの「戻る」操作をそのまま活かすため）。
 *
 * 部品表示は全画面 1 品目。
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(ScreenBlack),
            contentAlignment = Alignment.Center,
        ) {
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
    var showPallet by remember(containerId) { mutableStateOf(false) }

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
            startedAt = container?.startedAt,
            pausedAt = container?.pausedAt,
            onDecrement = { onDecrementPallet(selected.id) },
            onIncrement = { onIncrementPallet(selected.id) },
            onNextItem = { stepItem(1) },
            onPrevItem = { stepItem(-1) },
            onOpenList = { showList = true },
            onOpenPallet = { showPallet = true },
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

        // 立方体アイコンを押したときの、端数パレットの積み方
        AnimatedVisibility(
            visible = showPallet,
            modifier = Modifier.fillMaxSize(),
            enter = fadeIn(),
            exit = fadeOut(),
        ) {
            PalletDiagramOverlay(
                item = selected,
                accent = itemTypeAccent(selected.itemType),
                onClose = { showPallet = false },
            )
        }
    }
}

/**
 * 部品表示（全画面 1 品目）。
 *
 * 外周に残り割合のリング（種類の色。未達は灰色）、その内側は種類の色を暗く落とした地。
 * 中身は上から 種類バッジ / 機種名 / PL・CT / PCS。上に現在時刻、下に経過時間。
 * 大きさは画面の幅を基準に決めているので、時計の大きさが変わっても見え方が揃う。
 */
@Composable
private fun ItemPage(
    item: CargoItem,
    startedAt: Long?,
    pausedAt: Long?,
    onDecrement: () -> Unit,
    onIncrement: () -> Unit,
    onNextItem: () -> Unit,
    onPrevItem: () -> Unit,
    onOpenList: () -> Unit,
    onOpenPallet: () -> Unit,
) {
    val accent = itemTypeAccent(item.itemType)
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    // 1 回タップは 2 回目が来ないと確定しないので、少し待ってから減らす（CNS と同じ）
    var pendingTap by remember { mutableStateOf<Job?>(null) }
    val density = LocalDensity.current
    val switchThresholdPx = with(density) { ITEM_SWITCH_THRESHOLD.toPx() }
    val bottomEdgePx = with(density) { BOTTOM_EDGE_HEIGHT.toPx() }
    var dragAmount by remember { mutableFloatStateOf(0f) }
    var fromBottomEdge by remember { mutableStateOf(false) }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBlack)
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
        val w = maxWidth
        val ringStroke = w * 0.042f
        val ringInset = w * 0.035f
        val innerDiameter = w - (ringInset + ringStroke) * 2 - w * 0.012f

        // 内側の地。種類の色を暗く落として、中心をわずかに明るくする
        Box(
            modifier = Modifier
                .align(Alignment.Center)
                .size(innerDiameter)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        listOf(darkened(accent, 0.34f), darkened(accent, 0.17f)),
                    ),
                ),
        )

        ProgressRing(
            accent = accent,
            // バーが減るときはなめらかに動かす
            progress = smoothFraction((item.remainingPercentage ?: 100f) / 100f, item.id),
            strokeWidth = ringStroke,
            modifier = Modifier
                .fillMaxSize()
                .padding(ringInset),
        )

        // 中身
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .align(Alignment.Center)
                .width(innerDiameter * 0.88f),
        ) {
            TypeBadge(
                itemType = item.itemType,
                fontSize = (w.value * 0.038f).sp,
                cubeSize = w * 0.052f,
                onCubeClick = onOpenPallet,
            )
            Spacer(Modifier.height(w * 0.022f))
            MarqueeText(
                text = item.modelName ?: item.name,
                style = TextStyle(fontSize = (w.value * 0.098f).sp, fontWeight = FontWeight.Black),
                color = Color.White,
                modifier = Modifier.fillMaxWidth(),
            )
            HairLine(Modifier.padding(vertical = w * 0.014f))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth(),
            ) {
                ValueWithUnit(
                    value = countUp(item.palletCount.coerceAtLeast(0), item.id).toString(),
                    unit = "PL",
                    width = w,
                    numberScale = 0.168f,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .height(w * 0.140f)
                        .background(Color.White.copy(alpha = 0.28f)),
                )
                ValueWithUnit(
                    value = countUp(item.cartonCount.coerceAtLeast(0), item.id).toString(),
                    unit = "CT",
                    width = w,
                    numberScale = 0.168f,
                    modifier = Modifier.weight(1f),
                )
            }
            HairLine(Modifier.padding(vertical = w * 0.014f))
            ValueWithUnit(
                value = DisplayFormat.quantity(countUp(item.quantity.coerceAtLeast(0), item.id)),
                unit = "PCS",
                width = w,
                numberScale = 0.072f,
            )
        }

        TimePill(
            fontSize = (w.value * 0.048f).sp,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = w * 0.035f),
        )

        if (startedAt != null) {
            ElapsedTimer(
                startedAt = startedAt,
                pausedAt = pausedAt,
                style = TextStyle(fontSize = (w.value * 0.055f).sp, fontWeight = FontWeight.Bold),
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = w * 0.035f),
            )
        }
    }
}

/** 種類バッジ。黒い丸枠に 種類名 ・ 立方体アイコン */
@Composable
private fun TypeBadge(
    itemType: String?,
    fontSize: androidx.compose.ui.unit.TextUnit,
    cubeSize: Dp,
    onCubeClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(percent = 50))
            .background(Color.Black.copy(alpha = 0.72f))
            .padding(horizontal = 14.dp, vertical = 5.dp),
    ) {
        Text(
            text = itemTypeLabel(itemType),
            style = TextStyle(fontSize = fontSize, fontWeight = FontWeight.Bold),
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.width(9.dp))
        Box(
            modifier = Modifier
                .width(1.dp)
                .height(cubeSize * 0.8f)
                .background(Color.White.copy(alpha = 0.35f)),
        )
        Spacer(Modifier.width(9.dp))
        // 立方体を押すと、端数パレットの積み方が出る
        Icon(
            painter = painterResource(R.drawable.ic_cube),
            contentDescription = stringResource(R.string.action_pallet),
            tint = Color.White,
            modifier = Modifier
                .size(cubeSize * 1.5f)
                .pointerInput(Unit) { detectTapGestures(onTap = { onCubeClick() }) }
                .padding(cubeSize * 0.25f),
        )
    }
}

/** 大きな数字と、その右下に添える単位 */
@Composable
private fun ValueWithUnit(
    value: String,
    unit: String,
    width: Dp,
    numberScale: Float,
    modifier: Modifier = Modifier,
) {
    Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.Center,
        modifier = modifier,
    ) {
        Text(
            text = value,
            style = TextStyle(fontSize = (width.value * numberScale).sp, fontWeight = FontWeight.Black),
            color = Color.White,
            maxLines = 1,
        )
        Spacer(Modifier.width(width * 0.010f))
        Text(
            text = unit,
            style = TextStyle(fontSize = (width.value * numberScale * 0.34f).sp, fontWeight = FontWeight.Bold),
            color = Color.White,
            maxLines = 1,
            modifier = Modifier.padding(bottom = width * 0.014f),
        )
    }
}

/** 区切りの細い線 */
@Composable
private fun HairLine(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(Color.White.copy(alpha = 0.22f)),
    )
}

/**
 * 残り割合のリング。下側を空けた 300 度の弧。
 * 未達の部分は灰色、進んでいる部分は種類の色。まわりにうっすら光を足している。
 */
@Composable
private fun ProgressRing(
    accent: Color,
    progress: Float,
    strokeWidth: Dp,
    modifier: Modifier = Modifier,
) {
    val clamped = progress.coerceIn(0f, 1f)
    Canvas(modifier = modifier) {
        val stroke = strokeWidth.toPx()
        val inset = stroke / 2f
        val arcSize = Size(size.width - stroke, size.height - stroke)
        val topLeft = Offset(inset, inset)

        drawArc(
            color = RingTrack,
            startAngle = RING_START_ANGLE,
            sweepAngle = RING_SWEEP,
            useCenter = false,
            topLeft = topLeft,
            size = arcSize,
            style = Stroke(width = stroke, cap = StrokeCap.Round),
        )

        if (clamped <= 0f) return@Canvas

        // 外側へにじむ光
        listOf(2.4f to 0.10f, 1.8f to 0.16f, 1.3f to 0.24f).forEach { (scale, alpha) ->
            drawArc(
                color = accent.copy(alpha = alpha),
                startAngle = RING_START_ANGLE,
                sweepAngle = RING_SWEEP * clamped,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = stroke * scale, cap = StrokeCap.Round),
            )
        }
        drawArc(
            color = accent,
            startAngle = RING_START_ANGLE,
            sweepAngle = RING_SWEEP * clamped,
            useCenter = false,
            topLeft = topLeft,
            size = arcSize,
            style = Stroke(width = stroke, cap = StrokeCap.Round),
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

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBlack),
    ) {
        // バーの中身の幅は 1 度だけ出しておく。行ごとに測ると，
        // スクロールのたびに測り直しが入ってカクつく
        val barWidth = maxWidth * 0.92f - 24.dp
        ScalingLazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .nestedScroll(edgePull),
            contentPadding = PaddingValues(top = 34.dp, bottom = 34.dp, start = 12.dp, end = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            items(items, key = { it.id }) { item ->
                ItemBar(
                    item = item,
                    selected = item.id == selectedId,
                    barWidth = barWidth,
                    onClick = { onSelect(item.id) },
                )
            }
        }
        EdgeScrim()
        ListScrollIndicator(
            index = listState.centerItemIndex,
            count = items.size,
            modifier = Modifier.align(Alignment.CenterEnd),
        )
    }
}

/**
 * 一覧のどのあたりを見ているかを示す，右端の細いバー。
 * 丸い画面に沿うよう，中央を少しふくらませた位置に置く。
 */
@Composable
private fun BoxWithConstraintsScope.ListScrollIndicator(
    index: Int,
    count: Int,
    modifier: Modifier = Modifier,
) {
    if (count <= 1) return
    val trackHeight = maxHeight * 0.42f
    // つまみの長さは項目数に応じて縮むが，短くなりすぎないようにする
    val thumbRatio = (1f / count).coerceAtLeast(0.22f)
    val position = (index.toFloat() / (count - 1).toFloat()).coerceIn(0f, 1f)
    val animated by androidx.compose.animation.core.animateFloatAsState(
        targetValue = position,
        label = "listScroll",
    )
    Box(
        modifier = modifier
            .padding(end = 4.dp)
            .width(4.dp)
            .height(trackHeight)
            .clip(RoundedCornerShape(2.dp))
            .background(Color.White.copy(alpha = 0.16f)),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(trackHeight * thumbRatio)
                .offset(y = (trackHeight - trackHeight * thumbRatio) * animated)
                .clip(RoundedCornerShape(2.dp))
                .background(Color.White.copy(alpha = 0.72f)),
        )
    }
}

@Composable
private fun ItemBar(item: CargoItem, selected: Boolean, barWidth: Dp, onClick: () -> Unit) {
    val accent = itemTypeAccent(item.itemType)
    // いま出している品目は黄色い枠を点滅させて分かるようにする
    val blink = rememberInfiniteTransition(label = "selectedBar")
    val blinkAlpha by blink.animateFloat(
        initialValue = 0.25f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "selectedBarAlpha",
    )
    Box(
        modifier = Modifier
            .fillMaxWidth(0.92f)
            .height(46.dp)
            .clip(RoundedCornerShape(23.dp))
            .background(darkened(accent, if (selected) 0.68f else 0.48f))
            .then(
                if (selected) {
                    Modifier.border(2.dp, SelectedYellow.copy(alpha = blinkAlpha), RoundedCornerShape(23.dp))
                } else {
                    Modifier
                },
            )
            .pointerInput(item.id) { detectTapGestures(onTap = { onClick() }) }
            .padding(horizontal = 12.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxSize(),
        ) {
            // 左 3/5: 品名。枠に収まらないものは横へ流す（収まっていれば動かない）
            MarqueeText(
                text = item.modelName ?: item.name,
                style = TextStyle(
                    fontSize = (barWidth.value * 0.085f).sp,
                    fontWeight = FontWeight.Bold,
                ),
                color = Color.White,
                textAlign = TextAlign.Start,
                modifier = Modifier.weight(3f),
            )
            // 右 2/5: PL / CT / PCS。数字は大きく、単位はごく小さく。
            // PL が 0 なら PL は出さず、CT も 0 なら PCS だけにする
            Row(
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.spacedBy(barWidth * 0.022f, Alignment.End),
                modifier = Modifier.weight(2f),
            ) {
                if (item.palletCount > 0) BarValue(item.palletCount, "PL", barWidth)
                if (item.cartonCount > 0) BarValue(item.cartonCount, "CT", barWidth)
                BarValue(item.quantity, "PCS", barWidth)
            }
        }
    }
}

/** 一覧のバーに出す 数字＋単位 */
@Composable
private fun BarValue(value: Int, unit: String, barWidth: Dp) {
    Row(verticalAlignment = Alignment.Bottom) {
        Text(
            text = DisplayFormat.quantity(value.coerceAtLeast(0)),
            style = TextStyle(fontSize = (barWidth.value * 0.098f).sp, fontWeight = FontWeight.Black),
            color = Color.White,
            maxLines = 1,
        )
        Text(
            text = unit,
            style = TextStyle(fontSize = (barWidth.value * 0.036f).sp, fontWeight = FontWeight.Bold),
            color = Color.White.copy(alpha = 0.75f),
            maxLines = 1,
            modifier = Modifier.padding(bottom = barWidth * 0.008f),
        )
    }
}
