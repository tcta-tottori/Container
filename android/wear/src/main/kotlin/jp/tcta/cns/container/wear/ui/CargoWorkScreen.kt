package jp.tcta.cns.container.wear.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.focusable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
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
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.CargoItem
import jp.tcta.cns.container.shared.Environment
import jp.tcta.cns.container.shared.PalletLayout
import jp.tcta.cns.container.shared.WatchCommand
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.wear.R
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs

/** 縦スワイプで品目を切り替えるとみなす移動量 */
private val ITEM_SWITCH_THRESHOLD = 44.dp

/** 詳細画面のパレット図の向き（度） */
private const val DETAIL_PALLET_ANGLE_DEG = -35f

/** 詳細画面を開いたとき、進み具合のバーが伸びきるまでの時間（ミリ秒） */
private const val DETAIL_FILL_MS = 900

/** 気高コードの札の色 */
private val CodeBlue = Color(0xFF3B82F6)

/** 新建高コードの札の色 */
private val CodeRed = Color(0xFFEF4444)

/** 一覧の右に出す弧の太さ */
private val INDICATOR_STROKE = 4.dp

/** 弧を画面の縁からどれだけ内側に置くか */
private val INDICATOR_INSET = 3.dp

/** 弧が開く角度（度）。右の中央を挟んで上下に同じだけ */
private const val INDICATOR_SWEEP_DEG = 42f

/** 「元に戻しますか」でチェックを見せてから戻すまでの待ち */
private const val UNDO_CHECK_MS = 260L

/** 長押しの画面で「パレットを戻す」を表す目印 */
private const val ACTION_INCREMENT = "__increment"

/** 長押しの画面で「人物出現」を表す目印。押すと誰を出すか選ぶ画面になる */
private const val ACTION_PERSON = "__person"

/** 出せる人。ID はスマホ側（src/lib/people.ts）と合わせてある */
private val PEOPLE = listOf(
    "yamamoto" to R.string.person_yamamoto,
    "kotani" to R.string.person_kotani,
    "nagamura" to R.string.person_nagamura,
)

/** 品目が切り替わるときに、いったん縮む大きさ */
private const val ITEM_SWAP_MIN_SCALE = 0.72f

/** 縮んだところから元の大きさへ戻るまでの時間（ミリ秒） */
private const val ITEM_SWAP_MS = 320

/** 端数だけになってから積み方を出すまでの待ち（ミリ秒）。スマホ版と同じ */
private const val AUTO_PALLET_DELAY_MS = 400L

/** 画面のいちばん下の、一覧を引き出せる帯の高さ */
private val BOTTOM_EDGE_HEIGHT = 64.dp

/** 一覧の端からさらに払って部品表示へ戻るとみなす移動量 */
private val LIST_DISMISS_THRESHOLD = 56.dp

/**
 * 部品表示でリューズを時計回りに回して一覧を開くまでの量。
 * ひと目盛りがおよそ 64dp ぶんなので、3 目盛りほど回すことになる。
 */
private val ROTARY_OPEN_THRESHOLD = 190.dp

/** リューズの回した量を数え直すまでの、手を止めていられる時間（ミリ秒） */
private const val ROTARY_RESET_MS = 700L

/**
 * 部品表示の長押しで、コールの選択を出す上側の帯。画面の高さに対する割合。
 * ここには 現在時刻・気温・湿度・種類バッジ が並んでいる。
 * それより下（機種名・PL・CT・PCS）を長押しすると、その品目の詳細が出る。
 */
private const val CALL_ZONE_RATIO = 0.36f

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
 * - リューズを時計回りに多めに回す … 一覧を開く
 * - 上のほう（時刻・気温・種類バッジ）を長押し … コールの選択を出す
 * - それより下（機種名・PL・CT・PCS）を長押し … その品目の詳細を出す
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
    onCall: (String, String) -> Unit,
    onUncomplete: (String) -> Unit,
) {
    val payload = state.payload
    val container = payload?.container(containerId)
    val items = payload?.cargoOf(containerId).orEmpty()

    // 完了した品目は下にまとめる（スマホの一覧と同じ並び）
    val orderedItems = remember(items) {
        items.filter { !it.isDone() } + items.filter { it.isDone() }
    }

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
    // 一覧で長押しした品目。詳しい内容を出しているあいだだけ入っている
    var detailItem by remember(containerId) { mutableStateOf<CargoItem?>(null) }
    // 長押しで出すコールの選択
    var showCalls by remember(containerId) { mutableStateOf(false) }
    // 「人物出現」で、誰を出すかを選んでいるあいだ
    var showPeople by remember(containerId) { mutableStateOf(false) }

    // 残りが端数パレットだけになった瞬間に、積み方を自動で出す（スマホ版と同じ）。
    // 1 品目につき 1 回だけ。何も触らなければ 5 秒で自動的に閉じる
    val fractionOnly = selected.palletCount <= 0 && selected.cartonCount > 0
    val shownFor = remember(containerId) { mutableSetOf<String>() }
    var prevFraction by remember(containerId) { mutableStateOf<Pair<String, Boolean>?>(null) }
    LaunchedEffect(selected.id, fractionOnly) {
        val prev = prevFraction
        prevFraction = selected.id to fractionOnly
        // 作業画面を開いた最初の 1 回は出さない（「端数になった」瞬間だけ）
        if (prev == null) return@LaunchedEffect
        if (!fractionOnly) return@LaunchedEffect
        if (prev.second && prev.first == selected.id) return@LaunchedEffect
        if (!shownFor.add(selected.id)) return@LaunchedEffect
        delay(AUTO_PALLET_DELAY_MS)
        showPallet = true
    }

    // 縦スワイプでの品目送り。端まで行ったら反対の端へ回る。
    // 荷降ろしが済んだ品目は送り先に入れない（一覧から選んだときだけ出す）
    val stepItems = remember(items) {
        val active = items.filter { !it.isDone() }
        if (active.isEmpty()) items else active
    }
    val selectedIndex = stepItems.indexOfFirst { it.id == selected.id }
    val stepItem: (Int) -> Unit = { delta ->
        if (stepItems.isNotEmpty()) {
            // 済んだ品目を一覧から選んで見ているときは、送り先を端から数え直す
            val from = if (selectedIndex >= 0) selectedIndex else if (delta > 0) -1 else 0
            val next = stepItems[((from + delta) % stepItems.size + stepItems.size) % stepItems.size]
            if (next.id != selected.id) {
                pendingId = next.id
                onSelectItem(next.id)
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        ItemPage(
            item = selected,
            items = items,
            environment = payload?.environment,
            startedAt = container?.startedAt,
            pausedAt = container?.pausedAt,
            // 何かをかぶせているあいだは、リューズの操作を向こうに任せる
            active = !showList && !showPallet && !showCalls && !showPeople && detailItem == null,
            onDecrement = { onDecrementPallet(selected.id) },
            onNextItem = { stepItem(1) },
            onPrevItem = { stepItem(-1) },
            onOpenList = { showList = true },
            onOpenPallet = { showPallet = true },
            onOpenCalls = { showCalls = true },
            onOpenDetail = { detailItem = selected },
        )

        // 長押しで出すコールの選択
        AnimatedVisibility(
            visible = showCalls,
            modifier = Modifier.fillMaxSize(),
            enter = fadeIn(),
            exit = fadeOut(),
        ) {
            CallMenu(
                onIncrement = {
                    showCalls = false
                    onIncrementPallet(selected.id)
                },
                onPerson = {
                    showCalls = false
                    showPeople = true
                },
                onPick = { which ->
                    showCalls = false
                    onCall(selected.id, which)
                },
                onClose = { showCalls = false },
            )
        }

        // 「人物出現」で誰を出すかを選ぶ
        AnimatedVisibility(
            visible = showPeople,
            modifier = Modifier.fillMaxSize(),
            enter = fadeIn(),
            exit = fadeOut(),
        ) {
            PersonMenu(
                onPick = { personId ->
                    showPeople = false
                    onCall(selected.id, WatchCommand.personCall(personId))
                },
                onClose = { showPeople = false },
            )
        }

        AnimatedVisibility(
            visible = showList,
            modifier = Modifier.fillMaxSize(),
            enter = slideInVertically { it },
            exit = slideOutVertically { it },
        ) {
            ItemListPage(
                items = orderedItems,
                selectedId = selected.id,
                onShowDetail = { detailItem = it },
                onUncomplete = onUncomplete,
                onClose = { showList = false },
                onSelect = { id ->
                    pendingId = id
                    onSelectItem(id)
                    showList = false
                },
            )
        }

        // 一覧で長押ししたときの、詳しい内容
        AnimatedVisibility(
            visible = detailItem != null,
            modifier = Modifier.fillMaxSize(),
            enter = fadeIn(),
            exit = fadeOut(),
        ) {
            // 閉じたあとも消えるまでのあいだ描くので、最後の品目を覚えておく
            val shown = remember(detailItem) { detailItem }
            if (shown != null) {
                ItemDetailPage(item = shown, items = orderedItems, onClose = { detailItem = null })
            }
        }

        // CT の枠を押したときの、端数パレットの積み方
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
 *
 * @param active 何もかぶさっていないか。リューズの操作を受け取るのに使う
 */
@Composable
private fun ItemPage(
    item: CargoItem,
    items: List<CargoItem>,
    environment: Environment?,
    startedAt: Long?,
    pausedAt: Long?,
    active: Boolean,
    onDecrement: () -> Unit,
    onNextItem: () -> Unit,
    onPrevItem: () -> Unit,
    onOpenList: () -> Unit,
    onOpenPallet: () -> Unit,
    onOpenCalls: () -> Unit,
    onOpenDetail: () -> Unit,
) {
    val accent = itemTypeAccent(item.itemType)
    val view = LocalView.current
    val density = LocalDensity.current
    val switchThresholdPx = with(density) { ITEM_SWITCH_THRESHOLD.toPx() }
    val bottomEdgePx = with(density) { BOTTOM_EDGE_HEIGHT.toPx() }
    val rotaryOpenPx = with(density) { ROTARY_OPEN_THRESHOLD.toPx() }
    var dragAmount by remember { mutableFloatStateOf(0f) }
    var fromBottomEdge by remember { mutableStateOf(false) }

    // リューズを時計回りに回した量。逆に回すか、手を止めると数え直す
    var rotaryAmount by remember { mutableFloatStateOf(0f) }
    var rotaryAt by remember { mutableLongStateOf(0L) }
    // リューズを受け取るには焦点が要る。何かを閉じて戻ってきたら取り直す
    val rotaryFocus = remember { FocusRequester() }
    LaunchedEffect(active) {
        if (active) runCatching { rotaryFocus.requestFocus() }
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBlack)
            .onRotaryScrollEvent { event ->
                // 何かをかぶせているあいだは、下の画面が受け取らないようにする
                if (!active) return@onRotaryScrollEvent false
                val now = System.currentTimeMillis()
                // しばらく手が止まっていたら、はじめから数え直す
                if (now - rotaryAt > ROTARY_RESET_MS) rotaryAmount = 0f
                rotaryAt = now
                // 反時計回り（戻す向き）は数えない
                rotaryAmount = if (event.verticalScrollPixels < 0f) 0f else rotaryAmount + event.verticalScrollPixels
                if (rotaryAmount >= rotaryOpenPx) {
                    rotaryAmount = 0f
                    view.performHapticFeedback(android.view.HapticFeedbackConstants.CONFIRM)
                    onOpenList()
                }
                true
            }
            .focusRequester(rotaryFocus)
            .focusable()
            .pointerInput(item.id) {
                detectTapGestures(
                    // うっかり触って減らないよう、減らすのは 2 回タップ
                    onDoubleTap = {
                        view.performHapticFeedback(android.view.HapticFeedbackConstants.CONFIRM)
                        onDecrement()
                    },
                    // 長押し。上のほう（時刻・気温・種類バッジ）はコール、
                    // それより下（機種名・PL・CT・PCS）はその品目の詳細
                    onLongPress = { offset ->
                        view.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
                        if (offset.y < size.height * CALL_ZONE_RATIO) onOpenCalls() else onOpenDetail()
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

        // 中身。品目が変わるたびに、いったん引いてからまた寄る
        val swap = remember { Animatable(1f) }
        LaunchedEffect(item.id) {
            swap.snapTo(ITEM_SWAP_MIN_SCALE)
            swap.animateTo(1f, tween(ITEM_SWAP_MS, easing = FastOutSlowInEasing))
        }
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier
                .align(Alignment.Center)
                .width(innerDiameter * 0.88f)
                .graphicsLayer {
                    scaleX = swap.value
                    scaleY = swap.value
                    alpha = ((swap.value - ITEM_SWAP_MIN_SCALE) / (1f - ITEM_SWAP_MIN_SCALE)).coerceIn(0f, 1f)
                },
        ) {
            // 気温と湿度は、時刻の下・種類バッジの上に並べる
            ClimateRow(environment = environment, fontSize = (w.value * 0.044f).sp, gap = w * 0.055f)
            Spacer(Modifier.height(w * 0.014f))
            TypeBadge(
                itemType = item.itemType,
                counts = remainingByType(items),
                fontSize = (w.value * 0.038f).sp,
                dotSize = w * 0.030f,
            )
            Spacer(Modifier.height(w * 0.018f))
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
                    // CT の枠を押すと端数パレットの積み方が出る
                    modifier = Modifier
                        .weight(1f)
                        .pointerInput(item.id) {
                            detectTapGestures(onTap = { onOpenPallet() })
                        },
                )
            }
            // PCS は常に同じ場所に出す（数によって並びが動かないようにする）
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

/**
 * 一覧で長押ししたときに出す、品目の詳しい内容。
 *
 * スマホの詳細パネルで見られることを、ウォッチでもひと通り見られるようにしている。
 * 上から 何番目か / 種類・状態・色 / 機種名 / 気高コード・新建高コード /
 * 進み具合 / 残りの数 / 1 箱のこと / 重さとかさ / 注意書き / 端数パレットの積み方。
 *
 * リューズでも指でも動かせる。2 回タップで一覧へ戻る。
 */
@Composable
private fun ItemDetailPage(item: CargoItem, items: List<CargoItem>, onClose: () -> Unit) {
    val accent = itemTypeAccent(item.itemType)
    val stack = remember(item.id, item.cartonCount, item.qtyPerPallet, item.measurements, item.name) {
        PalletLayout.buildFractionStack(
            cartons = item.cartonCount,
            qtyPerPallet = item.qtyPerPallet,
            itemType = item.itemType,
            itemName = item.name,
            measurements = item.measurements,
        )
    }
    val listState = rememberScalingLazyListState()
    val scope = rememberCoroutineScope()
    // リューズで動かす。受け取るには焦点が要る
    val rotaryFocus = remember { FocusRequester() }
    LaunchedEffect(item.id) { runCatching { rotaryFocus.requestFocus() } }

    // 開いたときに 0 から伸びるバー。数字もこれに合わせて増える
    val donePct = (100f - (item.remainingPercentage ?: 100f)).coerceIn(0f, 100f)
    val fill = remember(item.id) { Animatable(0f) }
    LaunchedEffect(item.id, donePct) {
        fill.animateTo(donePct / 100f, tween(DETAIL_FILL_MS, easing = FastOutSlowInEasing))
    }

    val position = items.indexOfFirst { it.id == item.id }
    val remainingCartons = item.remainingCartons
    val originalCartons = item.originalCartons
    val doneCartons = (originalCartons - remainingCartons).coerceAtLeast(0)
    val grossWeight = item.grossWeight ?: 0f
    val cbm = item.cbm ?: 0f
    val tiers = if (item.casesPerTier > 0 && item.qtyPerPallet > 0) item.qtyPerPallet / item.casesPerTier else 0

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            // 真っ黒ではなく、種類の色をうっすら敷いて奥行きを出す
            .background(Brush.radialGradient(listOf(darkened(accent, 0.22f), ScreenBlack)))
            // 2 回タップで一覧へ戻る
            .pointerInput(item.id) { detectTapGestures(onDoubleTap = { onClose() }) },
    ) {
        val w = maxWidth
        val titleSize = (w.value * 0.034f).sp
        val labelSize = (w.value * 0.036f).sp
        ScalingLazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .onRotaryScrollEvent { event ->
                    scope.launch { listState.scrollBy(event.verticalScrollPixels) }
                    true
                }
                .focusRequester(rotaryFocus)
                .focusable(),
            contentPadding = PaddingValues(top = 28.dp, bottom = 34.dp, start = 10.dp, end = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            // コンテナの何番目の品目か
            if (position >= 0 && items.size > 1) {
                item {
                    Text(
                        text = "${position + 1} / ${items.size}",
                        style = TextStyle(fontSize = (w.value * 0.036f).sp, fontWeight = FontWeight.Bold),
                        color = Color.White.copy(alpha = 0.40f),
                        maxLines = 1,
                    )
                }
            }

            // 種類と状態
            item {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Pill(text = itemTypeLabel(item.itemType), fontSize = labelSize, color = accent, dot = accent)
                    item.status?.let {
                        Pill(text = it, fontSize = labelSize, color = statusColor(it))
                    }
                }
            }

            // 色と、鍋のサイズ
            if (item.color != null || item.sizeLabel != null) {
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        item.color?.let {
                            Pill(text = it, fontSize = labelSize, color = swatchColor(it), dot = swatchColor(it))
                        }
                        item.sizeLabel?.let {
                            Pill(text = it, fontSize = labelSize, color = sizeColor(it))
                        }
                    }
                }
            }

            // 機種名。種類の色でうっすら光らせる
            item {
                MarqueeText(
                    text = item.modelName ?: item.name,
                    style = TextStyle(
                        fontSize = (w.value * 0.076f).sp,
                        fontWeight = FontWeight.Black,
                        shadow = Shadow(color = accent.copy(alpha = 0.75f), offset = Offset.Zero, blurRadius = 22f),
                    ),
                    color = Color.White,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            // 品名（機種名と違うときだけ）
            if (item.modelName != null && item.modelName != item.name) {
                item {
                    MarqueeText(
                        text = item.name,
                        style = TextStyle(fontSize = (w.value * 0.040f).sp),
                        color = Color.White.copy(alpha = 0.55f),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }

            // 気高コード（KTE）と新建高コード（KEN）
            if (item.location != null || item.newPartNumber != null) {
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp, Alignment.CenterHorizontally),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        item.location?.let { CodeChip(label = "KTE", value = it, color = CodeBlue, width = w) }
                        item.newPartNumber?.let { CodeChip(label = "KEN", value = it, color = CodeRed, width = w) }
                    }
                }
            }

            // 進み具合
            item {
                DetailCard(accent = accent) {
                    Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.fillMaxWidth()) {
                        CardTitle(text = "進み", color = accent, fontSize = titleSize, modifier = Modifier.weight(1f))
                        Text(
                            text = DisplayFormat.percent(fill.value * 100f),
                            style = TextStyle(
                                fontSize = (w.value * 0.072f).sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace,
                            ),
                            color = Color.White,
                            maxLines = 1,
                        )
                    }
                    Spacer(Modifier.height(5.dp))
                    DetailBar(fraction = fill.value, accent = accent, height = w * 0.028f)
                    if (originalCartons > 0) {
                        Spacer(Modifier.height(6.dp))
                        Row(modifier = Modifier.fillMaxWidth()) {
                            StatTile(value = "$doneCartons", unit = "CT", label = "済み", width = w, valueColor = accent)
                            StatTile(value = "$remainingCartons", unit = "CT", label = "残り", width = w)
                            StatTile(
                                value = DisplayFormat.palletCarton(item.originalPalletCount, item.originalCartonCount),
                                unit = "",
                                label = "元の数",
                                width = w,
                                valueScale = 0.040f,
                            )
                        }
                    }
                }
            }

            // 残りの数
            item {
                DetailCard(accent = accent) {
                    CardTitle(text = "残り", color = accent, fontSize = titleSize)
                    Spacer(Modifier.height(4.dp))
                    Row(modifier = Modifier.fillMaxWidth()) {
                        StatTile(value = "${item.palletCount.coerceAtLeast(0)}", unit = "PL", label = "パレット", width = w)
                        StatTile(value = "${item.cartonCount.coerceAtLeast(0)}", unit = "CT", label = "端数", width = w)
                        StatTile(
                            value = DisplayFormat.quantity(item.quantity.coerceAtLeast(0)),
                            unit = "",
                            label = "PCS",
                            width = w,
                            valueScale = 0.052f,
                        )
                    }
                    if (item.originalQuantity > 0 && item.originalQuantity != item.quantity) {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = "元 ${DisplayFormat.quantity(item.originalQuantity)} PCS",
                            style = TextStyle(fontSize = (w.value * 0.034f).sp),
                            color = Color.White.copy(alpha = 0.45f),
                            maxLines = 1,
                        )
                    }
                }
            }

            // 1 箱のこと
            if (item.packingQty > 0 || item.qtyPerPallet > 0 || item.casesPerTier > 0 || item.measurements != null) {
                item {
                    DetailCard(accent = accent) {
                        CardTitle(text = "1 箱", color = accent, fontSize = titleSize)
                        Spacer(Modifier.height(4.dp))
                        Row(modifier = Modifier.fillMaxWidth()) {
                            if (item.packingQty > 0) {
                                StatTile(value = "${item.packingQty}", unit = "個", label = "入数", width = w)
                            }
                            if (item.qtyPerPallet > 0) {
                                StatTile(value = "${item.qtyPerPallet}", unit = "CT", label = "1PL", width = w)
                            }
                            if (item.casesPerTier > 0) {
                                StatTile(value = "${item.casesPerTier}", unit = "CT", label = "1 段", width = w)
                            }
                        }
                        if (item.measurements != null) {
                            DetailRow("外寸", DisplayFormat.dimensions(item.measurements), w)
                        }
                        if (tiers > 0) {
                            DetailRow("積み", "${item.casesPerTier}CT × ${tiers}段", w)
                        }
                    }
                }
            }

            // 重さとかさ
            if (grossWeight > 0f || cbm > 0f) {
                item {
                    DetailCard(accent = accent) {
                        CardTitle(text = "重さ・かさ", color = accent, fontSize = titleSize)
                        Spacer(Modifier.height(4.dp))
                        if (grossWeight > 0f) {
                            Row(modifier = Modifier.fillMaxWidth()) {
                                StatTile(DisplayFormat.weight(grossWeight), "", "1 箱", w, valueScale = 0.048f)
                                if (item.qtyPerPallet > 0) {
                                    StatTile(
                                        DisplayFormat.weight(grossWeight * item.qtyPerPallet), "", "1PL", w,
                                        valueScale = 0.048f,
                                    )
                                }
                                if (remainingCartons > 0) {
                                    StatTile(
                                        DisplayFormat.weight(grossWeight * remainingCartons), "", "残り", w,
                                        valueScale = 0.048f, valueColor = accent,
                                    )
                                }
                            }
                        }
                        if (cbm > 0f) {
                            if (grossWeight > 0f) Spacer(Modifier.height(5.dp))
                            Row(modifier = Modifier.fillMaxWidth()) {
                                StatTile(DisplayFormat.volume(cbm), "", "1 箱", w, valueScale = 0.048f)
                                if (remainingCartons > 0) {
                                    StatTile(
                                        DisplayFormat.volume(cbm * remainingCartons), "", "残り", w,
                                        valueScale = 0.048f, valueColor = accent,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 代表機種と英語の品名
            if (item.representModel != null || item.description != null) {
                item {
                    DetailCard(accent = accent) {
                        item.representModel?.let { DetailRow("機種", it, w) }
                        item.description?.let { DetailRow("EN", it, w) }
                    }
                }
            }

            // 注意書き（類似品あり など）
            item.warning?.let { warning ->
                item { WarningCard(text = warning, width = w) }
            }

            // 端数パレットの積み方
            if (!stack.isEmpty) {
                item {
                    DetailCard(accent = accent) {
                        CardTitle(text = stringResource(R.string.action_pallet), color = accent, fontSize = titleSize)
                        Canvas(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(w * 0.60f),
                        ) {
                            drawPallet(stack, DETAIL_PALLET_ANGLE_DEG, 1f, 1f)
                        }
                    }
                }
            }

            item {
                Text(
                    text = stringResource(R.string.detail_close_hint),
                    style = TextStyle(fontSize = (w.value * 0.036f).sp),
                    color = Color.White.copy(alpha = 0.45f),
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp),
                )
            }
        }
        EdgeScrim()
    }
}

/** 状態（未着手 / 作業中 / 完了）の色 */
private fun statusColor(status: String): Color = when {
    status.contains("完了") -> DoneGray
    status.contains("中") -> SelectedYellow
    else -> Color(0xFF9AA0A6)
}

/** 色（黒 / 白 / 他色）を、そのまま丸に出すための色 */
private fun swatchColor(color: String): Color = when (color) {
    "黒" -> Color(0xFF9AA0A6)
    "白" -> Color(0xFFF1F3F4)
    else -> Color(0xFFDAA520)
}

/** 鍋のサイズの色。スマホのバッジと同じ（100 = 緑、180 = 青） */
private fun sizeColor(size: String): Color =
    if (size == "180") Color(0xFF3B82F6) else Color(0xFF22C55E)

/**
 * 詳細画面の囲み。種類の色をうっすら敷いて、まとまりごとに分ける。
 */
@Composable
private fun DetailCard(
    accent: Color,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            // 左上が明るく右下へ落ちる。平らな塗りより奥行きが出る
            .background(
                Brush.linearGradient(
                    listOf(darkened(accent, 0.30f), darkened(accent, 0.14f), Color.Black.copy(alpha = 0.55f)),
                ),
            )
            .border(1.dp, accent.copy(alpha = 0.28f), RoundedCornerShape(16.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        content = content,
    )
}

/** 囲みの見出し */
@Composable
private fun CardTitle(
    text: String,
    color: Color,
    fontSize: TextUnit,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        style = TextStyle(fontSize = fontSize, fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
        color = color.copy(alpha = 0.95f),
        maxLines = 1,
        textAlign = TextAlign.Start,
        modifier = modifier,
    )
}

/**
 * 囲みのなかに並べる、数字ひとつ分。
 * 上に大きな数字（と単位）、下に小さな見出し。
 */
@Composable
private fun RowScope.StatTile(
    value: String,
    unit: String,
    label: String,
    width: Dp,
    valueScale: Float = 0.064f,
    valueColor: Color = ListNumber,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.weight(1f),
    ) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                text = value,
                style = TextStyle(
                    fontSize = (width.value * valueScale).sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                ),
                color = valueColor,
                maxLines = 1,
            )
            if (unit.isNotEmpty()) {
                Spacer(Modifier.width(1.dp))
                Text(
                    text = unit,
                    style = TextStyle(fontSize = (width.value * valueScale * 0.46f).sp, fontWeight = FontWeight.Bold),
                    color = valueColor.copy(alpha = 0.6f),
                    maxLines = 1,
                    modifier = Modifier.padding(bottom = width * 0.006f),
                )
            }
        }
        Text(
            text = label,
            style = TextStyle(fontSize = (width.value * 0.030f).sp),
            color = Color.White.copy(alpha = 0.5f),
            maxLines = 1,
        )
    }
}

/** 進み具合のバー。種類の色で左から伸びる */
@Composable
private fun DetailBar(fraction: Float, accent: Color, height: Dp, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(percent = 50))
            .background(Color.White.copy(alpha = 0.10f)),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(fraction.coerceIn(0f, 1f))
                .fillMaxHeight()
                .clip(RoundedCornerShape(percent = 50))
                .background(Brush.horizontalGradient(listOf(darkened(accent, 0.70f), accent))),
        )
    }
}

/** 気高コード・新建高コードの札 */
@Composable
private fun CodeChip(label: String, value: String, color: Color, width: Dp) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(percent = 50))
            .background(Color.Black.copy(alpha = 0.45f))
            .border(1.dp, color.copy(alpha = 0.45f), RoundedCornerShape(percent = 50))
            .padding(horizontal = 7.dp, vertical = 2.dp),
    ) {
        Text(
            text = label,
            style = TextStyle(fontSize = (width.value * 0.030f).sp, fontWeight = FontWeight.Black, letterSpacing = 0.8.sp),
            color = color,
            maxLines = 1,
        )
        Spacer(Modifier.width(4.dp))
        Text(
            text = value,
            style = TextStyle(
                fontSize = (width.value * 0.040f).sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
            ),
            color = Color.White.copy(alpha = 0.9f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** 小さなしるし（種類・状態・色・サイズ） */
@Composable
private fun Pill(
    text: String,
    fontSize: TextUnit,
    color: Color,
    dot: Color? = null,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(percent = 50))
            .background(color.copy(alpha = 0.18f))
            .border(1.dp, color.copy(alpha = 0.55f), RoundedCornerShape(percent = 50))
            .padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        if (dot != null) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(dot),
            )
            Spacer(Modifier.width(4.dp))
        }
        Text(
            text = text,
            style = TextStyle(fontSize = fontSize, fontWeight = FontWeight.Bold),
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** 注意書き（類似品あり など）。オレンジで目立たせる */
@Composable
private fun WarningCard(text: String, width: Dp) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(ElapsedOrange.copy(alpha = 0.16f))
            .border(1.dp, ElapsedOrange.copy(alpha = 0.55f), RoundedCornerShape(14.dp))
            .padding(horizontal = 9.dp, vertical = 7.dp),
    ) {
        Text(
            text = "⚠",
            style = TextStyle(fontSize = (width.value * 0.048f).sp, fontWeight = FontWeight.Bold),
            color = ElapsedOrange,
            maxLines = 1,
        )
        Spacer(Modifier.width(6.dp))
        Text(
            text = text,
            style = TextStyle(fontSize = (width.value * 0.038f).sp, fontWeight = FontWeight.Bold),
            color = Color.White.copy(alpha = 0.92f),
            maxLines = 4,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** 詳細画面の 1 行（見出しと中身） */
@Composable
private fun DetailRow(label: String, value: String, width: Dp) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
    ) {
        Text(
            text = label,
            style = TextStyle(fontSize = (width.value * 0.034f).sp, fontWeight = FontWeight.Bold),
            color = Color.White.copy(alpha = 0.5f),
            maxLines = 1,
            modifier = Modifier.width(width * 0.15f),
        )
        MarqueeText(
            text = value,
            style = TextStyle(
                fontSize = (width.value * 0.044f).sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
            ),
            color = ListNumber,
            textAlign = TextAlign.Start,
            modifier = Modifier.weight(1f),
        )
    }
}

/**
 * まだ残っている品目を種類ごとに数える。
 * 完了した品目と、残りが無くなった品目は数えない。
 */
private fun remainingByType(items: List<CargoItem>): List<Pair<String?, Int>> =
    items
        .filter { it.status?.contains("完了") != true }
        .filter { it.palletCount > 0 || it.cartonCount > 0 || it.quantity > 0 }
        .groupBy { it.itemType }
        .map { (type, list) -> type to list.size }
        .sortedByDescending { it.second }

/**
 * 種類バッジ。黒い丸枠に 左から
 * 種類の色の丸 ・ 種類名 ・ 種類ごとの残り数（色の丸＋数）。
 */
@Composable
private fun TypeBadge(
    itemType: String?,
    counts: List<Pair<String?, Int>>,
    fontSize: androidx.compose.ui.unit.TextUnit,
    dotSize: Dp,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .clip(RoundedCornerShape(percent = 50))
            .background(Color.Black.copy(alpha = 0.72f))
            .padding(horizontal = 11.dp, vertical = 5.dp),
    ) {
        Box(
            modifier = Modifier
                .size(dotSize)
                .clip(CircleShape)
                .background(itemTypeAccent(itemType)),
        )
        Spacer(Modifier.width(6.dp))
        Text(
            text = itemTypeLabel(itemType),
            style = TextStyle(fontSize = fontSize, fontWeight = FontWeight.Bold),
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (counts.isNotEmpty()) {
            Spacer(Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .width(1.dp)
                    .height(dotSize * 1.6f)
                    .background(Color.White.copy(alpha = 0.35f)),
            )
            Spacer(Modifier.width(7.dp))
            counts.forEachIndexed { index, (type, count) ->
                if (index > 0) Spacer(Modifier.width(7.dp))
                Box(
                    modifier = Modifier
                        .size(dotSize * 0.78f)
                        .clip(CircleShape)
                        .background(itemTypeAccent(type)),
                )
                Spacer(Modifier.width(3.dp))
                Text(
                    text = count.toString(),
                    style = TextStyle(fontSize = fontSize, fontWeight = FontWeight.Bold),
                    color = Color.White.copy(alpha = 0.85f),
                    maxLines = 1,
                )
            }
        }
    }
}

/** 荷降ろしが済んだ品目か */
private fun CargoItem.isDone(): Boolean = status?.contains("完了") == true

/**
 * 完了した品目を元に戻すか聞く画面。
 * 「元に戻しますか」のチェックを入れると戻る。
 */
@Composable
private fun UndoDialog(item: CargoItem, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.9f))
            .pointerInput(item.id) { detectTapGestures(onTap = { onDismiss() }) },
        contentAlignment = Alignment.Center,
    ) {
        val w = maxWidth
        // チェックを入れたら、少し見せてから元に戻す
        var checked by remember(item.id) { mutableStateOf(false) }
        LaunchedEffect(checked) {
            if (checked) {
                delay(UNDO_CHECK_MS)
                onConfirm()
            }
        }
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth(0.86f)
                .pointerInput(item.id) { detectTapGestures { } },
        ) {
            MarqueeText(
                text = item.modelName ?: item.name,
                style = TextStyle(fontSize = (w.value * 0.052f).sp, fontWeight = FontWeight.Bold),
                color = Color.White,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            // このチェックを入れると元に戻る
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(
                        Brush.linearGradient(listOf(Color(0xFF2E3550), Color(0xFF1B2033))),
                    )
                    .border(1.5.dp, SelectedYellow.copy(alpha = 0.65f), RoundedCornerShape(24.dp))
                    .pointerInput(item.id) { detectTapGestures(onTap = { checked = true }) }
                    .padding(horizontal = 14.dp),
            ) {
                // チェック枠。押すとチェックが入って元に戻る
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .size(20.dp)
                        .clip(RoundedCornerShape(5.dp))
                        .background(if (checked) SelectedYellow else Color.Transparent)
                        .border(2.dp, SelectedYellow, RoundedCornerShape(5.dp)),
                ) {
                    if (checked) {
                        Text(
                            text = "✓",
                            style = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Black),
                            color = Color.Black,
                            maxLines = 1,
                        )
                    }
                }
                Spacer(Modifier.width(10.dp))
                Text(
                    text = stringResource(R.string.undo_confirm),
                    style = TextStyle(fontSize = (w.value * 0.046f).sp, fontWeight = FontWeight.Bold),
                    color = Color.White,
                    maxLines = 1,
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.undo_cancel),
                style = TextStyle(fontSize = (w.value * 0.040f).sp),
                color = Color.White.copy(alpha = 0.5f),
                modifier = Modifier
                    .pointerInput(item.id) { detectTapGestures(onTap = { onDismiss() }) }
                    .padding(8.dp),
            )
        }
    }
}

/**
 * 長押しで出すコールの選択。押すとスマホが鳴らす（スマホのメニューと同じ並び）。
 * 天気・水の音・せせらぎモードも、スマホのボタンを押したのと同じ動きになる。
 */
@Composable
private fun CallMenu(
    onIncrement: () -> Unit,
    onPerson: () -> Unit,
    onPick: (String) -> Unit,
    onClose: () -> Unit,
) {
    val calls = listOf(
        ACTION_INCREMENT to stringResource(R.string.action_increment),
        WatchCommand.CALL_REQUEST to stringResource(R.string.call_request),
        WatchCommand.CALL_NAME to stringResource(R.string.call_name),
        WatchCommand.CALL_CHEER to stringResource(R.string.call_cheer),
        WatchCommand.CALL_ITEM to stringResource(R.string.call_item),
        WatchCommand.CALL_WEATHER to stringResource(R.string.call_weather),
        WatchCommand.CALL_WATER to stringResource(R.string.call_water),
        WatchCommand.CALL_RIVER to stringResource(R.string.call_river),
        ACTION_PERSON to stringResource(R.string.call_person),
    )
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.88f))
            .pointerInput(Unit) { detectTapGestures(onTap = { onClose() }) },
    ) {
        val w = maxWidth
        ScalingLazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = 28.dp, bottom = 28.dp, start = 12.dp, end = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            item {
                Text(
                    text = stringResource(R.string.call_title),
                    style = TextStyle(fontSize = (w.value * 0.044f).sp, fontWeight = FontWeight.Bold),
                    color = Color.White.copy(alpha = 0.6f),
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
            items(calls) { (which, label) ->
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .fillMaxWidth(0.92f)
                        .height(46.dp)
                        .clip(RoundedCornerShape(23.dp))
                        .background(
                            Brush.linearGradient(
                                listOf(Color(0xFF2E3550), Color(0xFF1B2033)),
                            ),
                        )
                        .border(1.5.dp, Color.White.copy(alpha = 0.16f), RoundedCornerShape(23.dp))
                        .pointerInput(which) {
                            detectTapGestures(
                                onTap = {
                                    when (which) {
                                        ACTION_INCREMENT -> onIncrement()
                                        ACTION_PERSON -> onPerson()
                                        else -> onPick(which)
                                    }
                                },
                            )
                        },
                ) {
                    Text(
                        text = label,
                        style = TextStyle(fontSize = (w.value * 0.050f).sp, fontWeight = FontWeight.Bold),
                        color = Color.White,
                        maxLines = 1,
                    )
                }
            }
        }
        EdgeScrim()
    }
}

/**
 * 「人物出現」で、誰を出すかを選ぶ画面。
 * 押すとスマホの一覧のところに、その人が 10 秒だけ出る。
 */
@Composable
private fun PersonMenu(onPick: (String) -> Unit, onClose: () -> Unit) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.88f))
            .pointerInput(Unit) { detectTapGestures(onTap = { onClose() }) },
    ) {
        val w = maxWidth
        ScalingLazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = 28.dp, bottom = 28.dp, start = 12.dp, end = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            item {
                Text(
                    text = stringResource(R.string.person_title),
                    style = TextStyle(fontSize = (w.value * 0.044f).sp, fontWeight = FontWeight.Bold),
                    color = Color.White.copy(alpha = 0.6f),
                    modifier = Modifier.padding(bottom = 4.dp),
                )
            }
            items(PEOPLE) { (personId, labelRes) ->
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .fillMaxWidth(0.92f)
                        .height(46.dp)
                        .clip(RoundedCornerShape(23.dp))
                        .background(
                            Brush.linearGradient(
                                listOf(Color(0xFF3A2E50), Color(0xFF221B33)),
                            ),
                        )
                        .border(1.5.dp, Color.White.copy(alpha = 0.16f), RoundedCornerShape(23.dp))
                        .pointerInput(personId) {
                            detectTapGestures(onTap = { onPick(personId) })
                        },
                ) {
                    Text(
                        text = stringResource(labelRes),
                        style = TextStyle(fontSize = (w.value * 0.050f).sp, fontWeight = FontWeight.Bold),
                        color = Color.White,
                        maxLines = 1,
                    )
                }
            }
        }
        EdgeScrim()
    }
}

/** 種類バッジの下に並べる、気温と湿度 */
@Composable
private fun ClimateRow(
    environment: Environment?,
    fontSize: androidx.compose.ui.unit.TextUnit,
    gap: Dp,
) {
    val celsius = environment?.temperatureC
    val humidity = environment?.humidityPercent
    if (celsius == null && humidity == null) return
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 4.dp),
    ) {
        if (celsius != null) {
            CornerReading(text = DisplayFormat.temperature(celsius), color = ElapsedOrange, fontSize = fontSize)
        }
        if (celsius != null && humidity != null) Spacer(Modifier.width(gap))
        if (humidity != null) {
            CornerReading(text = "$humidity%", color = HumidityBlue, fontSize = fontSize)
        }
    }
}

/** 気温や湿度のひとこと */
@Composable
private fun CornerReading(
    text: String,
    color: Color,
    fontSize: androidx.compose.ui.unit.TextUnit,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        style = TextStyle(fontSize = fontSize, fontWeight = FontWeight.Bold),
        color = color,
        maxLines = 1,
        modifier = modifier,
    )
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
    onShowDetail: (CargoItem) -> Unit,
    onUncomplete: (String) -> Unit,
) {
    val listState = rememberScalingLazyListState()
    val scope = rememberCoroutineScope()
    // リューズで一覧を動かす。受け取るには焦点が要る
    val rotaryFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { rotaryFocus.requestFocus() } }
    // 完了を戻すか聞いている品目
    var undoTarget by remember { mutableStateOf<CargoItem?>(null) }
    val selectedIndex = items.indexOfFirst { it.id == selectedId }
    LaunchedEffect(selectedId) {
        if (selectedIndex >= 0) runCatching { listState.animateScrollToItem(selectedIndex) }
    }

    /*
     * 端まで来たら、その指ではいったんそこで止まる。
     * 指を離してから「もう一度」端の向こうへ払ったときだけ部品表示へ戻る。
     */
    val dismissThresholdPx = with(LocalDensity.current) { LIST_DISMISS_THRESHOLD.toPx() }
    var overscroll by remember { mutableFloatStateOf(0f) }
    // 端に着いた指を離したら true。次の払いで閉じられるようになる
    var armed by remember { mutableStateOf(false) }
    val edgePull = remember(dismissThresholdPx) {
        object : NestedScrollConnection {
            override fun onPostScroll(
                consumed: Offset,
                available: Offset,
                source: androidx.compose.ui.input.nestedscroll.NestedScrollSource,
            ): Offset {
                // 一覧が動いているあいだは端に着いていない。数え直して、また構え直させる
                if (consumed.y != 0f) {
                    overscroll = 0f
                    armed = false
                }
                if (available.y != 0f && armed) {
                    overscroll += available.y
                    if (abs(overscroll) >= dismissThresholdPx) {
                        overscroll = 0f
                        armed = false
                        onClose()
                    }
                }
                return Offset.Zero
            }

            override suspend fun onPostFling(consumed: Velocity, available: Velocity): Velocity {
                // 指を離した（勢いも消えた）ところで構える。
                // 端に着いていなければ次の onPostScroll ですぐ外れる
                overscroll = 0f
                armed = true
                return Velocity.Zero
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
                .onRotaryScrollEvent { event ->
                    scope.launch { listState.scrollBy(event.verticalScrollPixels) }
                    true
                }
                .focusRequester(rotaryFocus)
                .focusable()
                .nestedScroll(edgePull),
            contentPadding = PaddingValues(top = 34.dp, bottom = 34.dp, start = 12.dp, end = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            items(items, key = { it.id }) { item ->
                ItemBar(
                    item = item,
                    selected = item.id == selectedId,
                    barWidth = barWidth,
                    onClick = { if (!item.isDone()) onSelect(item.id) },
                    onLongClick = { onShowDetail(item) },
                    // 完了した行は 2 回タップで「元に戻しますか」を出す
                    onDoubleClick = { if (item.isDone()) undoTarget = item },
                )
            }
        }
        EdgeScrim()
        undoTarget?.let { target ->
            UndoDialog(
                item = target,
                onConfirm = {
                    undoTarget = null
                    onUncomplete(target.id)
                },
                onDismiss = { undoTarget = null },
            )
        }
        ListScrollIndicator(
            index = listState.centerItemIndex,
            count = items.size,
            modifier = Modifier.fillMaxSize(),
        )
    }
}

/**
 * 一覧のどのあたりを見ているかを示す，右端のバー。
 * 丸い画面の縁に沿った弧にして、縁で切れないようにする。
 */
@Composable
private fun ListScrollIndicator(
    index: Int,
    count: Int,
    modifier: Modifier = Modifier,
) {
    if (count <= 1) return
    // つまみの長さは項目数に応じて縮むが，短くなりすぎないようにする
    val thumbRatio = (1f / count).coerceAtLeast(0.22f)
    val position = (index.toFloat() / (count - 1).toFloat()).coerceIn(0f, 1f)
    val animated by animateFloatAsState(targetValue = position, label = "listScroll")
    val track = Color.White.copy(alpha = 0.16f)
    val thumb = Color.White.copy(alpha = 0.75f)
    Canvas(modifier = modifier.fillMaxSize()) {
        val stroke = INDICATOR_STROKE.toPx()
        // 画面の縁より少し内側を通る弧。左右どちらの端でも切れない
        val inset = stroke / 2f + INDICATOR_INSET.toPx()
        val diameter = size.minDimension - inset * 2f
        val topLeft = Offset(
            x = (size.width - diameter) / 2f,
            y = (size.height - diameter) / 2f,
        )
        val arcSize = Size(diameter, diameter)
        // 右側の中央（3 時）を中心に、上下へ同じだけ開く
        val startAngle = -INDICATOR_SWEEP_DEG / 2f
        drawArc(
            color = track,
            startAngle = startAngle,
            sweepAngle = INDICATOR_SWEEP_DEG,
            useCenter = false,
            topLeft = topLeft,
            size = arcSize,
            style = Stroke(width = stroke, cap = StrokeCap.Round),
        )
        val thumbSweep = INDICATOR_SWEEP_DEG * thumbRatio
        drawArc(
            color = thumb,
            startAngle = startAngle + (INDICATOR_SWEEP_DEG - thumbSweep) * animated,
            sweepAngle = thumbSweep,
            useCenter = false,
            topLeft = topLeft,
            size = arcSize,
            style = Stroke(width = stroke, cap = StrokeCap.Round),
        )
    }
}

@Composable
private fun ItemBar(
    item: CargoItem,
    selected: Boolean,
    barWidth: Dp,
    onClick: () -> Unit,
    onLongClick: () -> Unit,
    onDoubleClick: () -> Unit,
) {
    val done = item.isDone()
    // 完了した品目は色を落としてグレーにする
    val accent = if (done) DoneGray else itemTypeAccent(item.itemType)
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
            // 左上が明るく右下へ落ちるグラデーション。平らな塗りより奥行きが出る
            .background(
                Brush.linearGradient(
                    listOf(
                        darkened(accent, if (selected) 0.86f else 0.62f),
                        darkened(accent, if (selected) 0.56f else 0.38f),
                        darkened(accent, if (selected) 0.34f else 0.22f),
                    ),
                ),
            )
            .then(
                if (selected) {
                    Modifier.border(2.dp, SelectedYellow.copy(alpha = blinkAlpha), RoundedCornerShape(23.dp))
                } else {
                    Modifier
                },
            )
            .pointerInput(item.id) {
                detectTapGestures(
                    onTap = { onClick() },
                    onDoubleTap = { onDoubleClick() },
                    onLongPress = { onLongClick() },
                )
            }
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
                color = if (done) Color.White.copy(alpha = 0.45f) else Color.White,
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
                if (item.palletCount > 0) BarValue(item.palletCount, "PL", barWidth, done)
                if (item.cartonCount > 0) BarValue(item.cartonCount, "CT", barWidth, done)
                // PL も CT も 0 のときだけ、代わりに PCS を出す
                if (item.palletCount <= 0 && item.cartonCount <= 0) {
                    BarValue(item.quantity, "PCS", barWidth, done)
                }
            }
        }
    }
}

/**
 * 一覧のバーに出す 数字＋単位。
 * 品名（白・標準の書体）と見分けがつくよう、数字は色も書体も変えている。
 */
@Composable
private fun BarValue(value: Int, unit: String, barWidth: Dp, done: Boolean = false) {
    // 完了した行は数字も落として、まだの品目と見分けがつくようにする
    val numberColor = if (done) Color.White.copy(alpha = 0.4f) else ListNumber
    Row(verticalAlignment = Alignment.Bottom) {
        Text(
            text = DisplayFormat.quantity(value.coerceAtLeast(0)),
            style = TextStyle(
                fontSize = (barWidth.value * 0.104f).sp,
                // 細身の書体。数字も「,」も同じ細さで並ぶ
                fontWeight = FontWeight.Light,
                fontFamily = FontFamily.SansSerif,
                letterSpacing = 0.2.sp,
            ),
            color = numberColor,
            maxLines = 1,
        )
        Text(
            text = unit,
            style = TextStyle(
                fontSize = (barWidth.value * 0.036f).sp,
                fontWeight = FontWeight.Normal,
                fontFamily = FontFamily.SansSerif,
            ),
            color = numberColor.copy(alpha = 0.62f),
            maxLines = 1,
            modifier = Modifier.padding(bottom = barWidth * 0.008f),
        )
    }
}
