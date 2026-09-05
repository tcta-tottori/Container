package jp.tcta.cns.container.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.shared.ItemTypes
import kotlinx.coroutines.delay

/** ステータス文字列に応じた色。完了は青、作業中は緑、待ちはオレンジ */
@Composable
fun statusColor(status: String?): Color = when {
    status == null -> MaterialTheme.colorScheme.onSurfaceVariant
    status.contains("完了") -> MaterialTheme.colorScheme.tertiary
    status.contains("中") -> MaterialTheme.colorScheme.primary
    status.contains("待") -> MaterialTheme.colorScheme.secondary
    else -> MaterialTheme.colorScheme.onSurfaceVariant
}

/** 種類の色。元のコンテナアプリの accent と同じ値 */
fun itemTypeAccent(itemType: String?): Color = Color(ItemTypes.colorOf(itemType).accent)

/**
 * その色の上に置く文字の色。明るい色なら黒、暗い色なら白。
 * 黄・緑は白だと読みにくいので、しきい値は 0.4 にしている。
 */
fun contrastTextColor(background: Color): Color =
    if (background.luminance() > 0.4f) Color.Black else Color.White

/** 積載率の横バー（コンテナ一覧のカード用） */
@Composable
fun LoadBar(fraction: Float, modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.primary) {
    val clamped = fraction.coerceIn(0f, 1f)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(6.dp)
            .clip(RoundedCornerShape(3.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh),
    ) {
        if (clamped > 0f) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(clamped)
                    .background(color),
            )
        }
    }
}

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
) {
    Text(
        text = text,
        style = style,
        color = color,
        maxLines = 1,
        softWrap = false,
        textAlign = TextAlign.Center,
        modifier = modifier.basicMarquee(iterations = Int.MAX_VALUE),
    )
}

/**
 * 画面の上下をうっすら暗くする膜。
 * 丸い画面の縁で文字が見づらくなるのを防ぐ（Pixel Watch のメニューと同じ見え方）。
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

/** 気温（左）と湿度（右）。色は背景に合わせて渡す */
@Composable
fun ClimateRow(
    temperatureC: Float?,
    humidityPercent: Int?,
    color: Color,
    modifier: Modifier = Modifier,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
        modifier = modifier.fillMaxWidth(),
    ) {
        temperatureC?.let {
            Text(
                text = DisplayFormat.temperature(it),
                style = MaterialTheme.typography.labelMedium,
                color = color,
                maxLines = 1,
            )
        }
        if (temperatureC != null && humidityPercent != null) {
            Spacer(Modifier.width(6.dp))
            Box(
                modifier = Modifier
                    .width(1.dp)
                    .height(11.dp)
                    .background(color.copy(alpha = 0.4f)),
            )
            Spacer(Modifier.width(6.dp))
        }
        humidityPercent?.let {
            Text(
                text = "$it%",
                style = MaterialTheme.typography.labelMedium,
                color = color,
                maxLines = 1,
            )
        }
    }
}

/** 作業開始からの経過時間。1 秒ごとに描き直す。[pausedAt] があればその時刻で止める */
@Composable
fun ElapsedTimer(
    startedAt: Long,
    modifier: Modifier = Modifier,
    pausedAt: Long? = null,
    color: Color = Color.White,
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
        style = MaterialTheme.typography.labelMedium,
        color = if (pausedAt != null) color.copy(alpha = 0.6f) else color,
        maxLines = 1,
        modifier = modifier.padding(horizontal = 4.dp),
    )
}
