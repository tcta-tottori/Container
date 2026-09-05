package jp.tcta.cns.container.wear.ui

import android.text.format.DateFormat
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.shared.ItemTypes
import kotlinx.coroutines.delay
import java.util.Date
import kotlin.math.roundToInt

/** 画面の地の色 */
val ScreenBlack = Color(0xFF000000)

/** リングの未達部分（灰色） */
val RingTrack = Color(0xFF8A8A8E)

/** 経過時間の色 */
val ElapsedOrange = Color(0xFFFF8C21)

/** 種類の色。元のコンテナアプリの accent と同じ値 */
fun itemTypeAccent(itemType: String?): Color = Color(ItemTypes.colorOf(itemType).accent)

/** 種類の名前 */
fun itemTypeLabel(itemType: String?): String = ItemTypes.labelOf(itemType)

/**
 * その色の上に置く文字の色。明るい色なら黒、暗い色なら白。
 * 黄・緑は白だと読みにくいので、しきい値は 0.4 にしている。
 */
fun contrastTextColor(background: Color): Color =
    if (background.luminance() > 0.4f) Color.Black else Color.White

/** 黒に向けて暗くした色。[amount] が小さいほど黒に近い */
fun darkened(color: Color, amount: Float): Color =
    Color(red = color.red * amount, green = color.green * amount, blue = color.blue * amount, alpha = 1f)

/**
 * 枠に収まらない文字は横へ流して見せる。
 * 収まっているときは動かないので、短い機種名はそのまま止まって見える。
 */
@Composable
fun MarqueeText(
    text: String,
    style: TextStyle,
    color: Color,
    modifier: Modifier = Modifier,
    textAlign: TextAlign = TextAlign.Center,
) {
    Text(
        text = text,
        style = style,
        color = color,
        maxLines = 1,
        softWrap = false,
        textAlign = textAlign,
        modifier = modifier.basicMarquee(iterations = Int.MAX_VALUE),
    )
}

/**
 * 画面の上下をうっすら暗くする膜。
 * 丸い画面の縁で文字が見づらくなるのを防ぐ。
 */
@Composable
fun BoxScope.EdgeScrim(height: Dp = 52.dp, strength: Float = 0.45f) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(height)
            .align(Alignment.TopCenter)
            .background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = strength), Color.Transparent))),
    )
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(height)
            .align(Alignment.BottomCenter)
            .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = strength)))),
    )
}

/**
 * 画面の上に出す現在時刻。黒い丸枠に入れて、下のリングと重なっても読めるようにする。
 * 端末の 12/24 時間設定に合わせる。
 */
@Composable
fun TimePill(
    fontSize: TextUnit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var now by remember { mutableStateOf(Date()) }
    LaunchedEffect(Unit) {
        while (true) {
            now = Date()
            delay(10_000L)
        }
    }
    val text = remember(now) { DateFormat.getTimeFormat(context).format(now) }
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(percent = 50))
            .background(Color.Black.copy(alpha = 0.55f))
            .padding(horizontal = 14.dp, vertical = 2.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium.copy(fontSize = fontSize, fontWeight = FontWeight.Bold),
            color = Color.White,
            maxLines = 1,
        )
    }
}

/** 作業開始からの経過時間。1 秒ごとに描き直す。[pausedAt] があればその時刻で止める */
@Composable
fun ElapsedTimer(
    startedAt: Long,
    modifier: Modifier = Modifier,
    pausedAt: Long? = null,
    color: Color = ElapsedOrange,
    style: TextStyle = MaterialTheme.typography.labelMedium,
) {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(startedAt, pausedAt) {
        while (pausedAt == null) {
            now = System.currentTimeMillis()
            delay(1_000L)
        }
    }
    val end = pausedAt ?: now
    Text(
        text = DisplayFormat.elapsed(end - startedAt),
        style = style,
        color = if (pausedAt != null) color.copy(alpha = 0.6f) else color,
        maxLines = 1,
        modifier = modifier,
    )
}

/* ===== 数字のカウント（スマホ版の useCountUp と同じ動き） ===== */

/** 品目が変わったとき、数え始めるまでの待ち */
private const val COUNT_START_DELAY_MS = 400L

/** 0 から数え上げるのにかける時間 */
private const val COUNT_UP_MS = 1000

/** 値が変わったとき（パレットを減らしたときなど）になじませる時間 */
private const val COUNT_CHANGE_MS = 500

private val EaseInOutCubic = CubicBezierEasing(0.65f, 0f, 0.35f, 1f)
private val EaseInOutQuad = CubicBezierEasing(0.45f, 0f, 0.55f, 1f)

/**
 * 数字を数えて見せる。
 *
 * [key] が変わったとき（品目が変わったとき）は、少し待ってから 0 から数え上げる。
 * [target] だけが変わったとき（パレットを減らしたときなど）は、今の値からなじませる。
 */
@Composable
fun countUp(target: Int, key: Any): Int {
    val animated = remember(key) { Animatable(0f) }
    var started by remember(key) { mutableStateOf(false) }
    LaunchedEffect(key, target) {
        if (!started) {
            started = true
            animated.snapTo(0f)
            delay(COUNT_START_DELAY_MS)
            animated.animateTo(target.toFloat(), tween(COUNT_UP_MS, easing = EaseInOutCubic))
        } else {
            animated.animateTo(target.toFloat(), tween(COUNT_CHANGE_MS, easing = EaseInOutQuad))
        }
    }
    return animated.value.roundToInt()
}

/**
 * 割合をなじませる。バーが減るときになめらかに動かすのに使う。
 */
@Composable
fun smoothFraction(target: Float, key: Any): Float {
    val animated = remember(key) { Animatable(target) }
    LaunchedEffect(key, target) {
        animated.animateTo(target, tween(COUNT_CHANGE_MS, easing = EaseInOutQuad))
    }
    return animated.value
}
