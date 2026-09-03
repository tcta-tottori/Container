package jp.tcta.cns.container.wear.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.shared.Environment
import jp.tcta.cns.container.shared.ItemTypes
import jp.tcta.cns.container.wear.ui.theme.WearColors
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

/** 種類の強調色（濃い画面向け）。元のコンテナアプリの accent と同じ値 */
fun itemTypeAccent(itemType: String?): Color = Color(ItemTypes.colorOf(itemType).accent)

/** 積載率の横バー（一覧カード用） */
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
 * 点付きの丸いバッジ（参考デザインの「● 100%」「● JPV-H100」）。
 * 元のコンテナアプリの type-badge と同じ配色（accent 25% の背景・accent 44% の枠・白文字）。
 */
@Composable
fun PillBadge(
    text: String,
    accent: Color,
    modifier: Modifier = Modifier,
    textColor: Color = Color.White,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(accent.copy(alpha = 0.25f))
            .border(1.dp, accent.copy(alpha = 0.44f), RoundedCornerShape(20.dp))
            .padding(horizontal = 9.dp, vertical = 2.dp),
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(accent),
        )
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = textColor,
            maxLines = 1,
            modifier = Modifier.padding(start = 4.dp),
        )
    }
}

/** 種類バッジ */
@Composable
fun TypeBadge(itemType: String?, modifier: Modifier = Modifier) {
    PillBadge(text = ItemTypes.labelOf(itemType), accent = itemTypeAccent(itemType), modifier = modifier)
}

/**
 * 参考デザインのダイヤル。丸型ディスプレイいっぱいに出す。
 *
 * 外周: 進み具合のリング（[accent] 色、下側 60° は空けて経過時間を置く）
 * 中央: バッジ → 大きなタイトル（機種名）→ 補足 → PL / CT の数字 → 気温・湿度
 * 右上: 警告マーク（[warning] があるとき）
 * 下端: 経過時間（[startedAt] があるとき、1 秒ごとに更新）
 */
@Composable
fun Dial(
    accent: Color,
    progress: Float,
    badgeText: String,
    title: String,
    subtitle: String?,
    pallets: Int,
    cartons: Int,
    environment: Environment?,
    startedAt: Long?,
    warning: String?,
    modifier: Modifier = Modifier,
    ringInset: Dp = 12.dp,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(1f),
        contentAlignment = Alignment.Center,
    ) {
        // リングの内側を種類の色でうっすら染める
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(ringInset + 4.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        listOf(accent.copy(alpha = 0.10f), accent.copy(alpha = 0.18f), Color.Transparent),
                    ),
                ),
        )
        ProgressRing(
            accent = accent,
            progress = progress,
            modifier = Modifier
                .fillMaxSize()
                .padding(ringInset),
        )
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceEvenly,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = ringInset + 18.dp, vertical = ringInset + 12.dp),
        ) {
            PillBadge(text = badgeText, accent = accent)
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.displaySmall,
                    color = accent,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (!subtitle.isNullOrBlank()) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
            PalletCartonRow(accent = accent, pallets = pallets, cartons = cartons)
            if (environment != null && (environment.temperatureC != null || environment.humidityPercent != null)) {
                EnvironmentRow(environment)
            }
        }
        if (!warning.isNullOrBlank()) {
            Icon(
                imageVector = Icons.Filled.Warning,
                contentDescription = warning,
                tint = WearColors.Orange,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = ringInset + 14.dp, end = ringInset + 14.dp)
                    .size(18.dp),
            )
        }
        if (startedAt != null) {
            ElapsedTimer(
                startedAt = startedAt,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 2.dp),
            )
        }
    }
}

/** 進み具合のリング。下側 60° を空けた 300° の弧 */
@Composable
fun ProgressRing(accent: Color, progress: Float, modifier: Modifier = Modifier, strokeWidth: Dp = 5.dp) {
    val clamped = progress.coerceIn(0f, 1f)
    val track = accent.copy(alpha = 0.22f)
    Canvas(modifier = modifier) {
        val stroke = Stroke(width = strokeWidth.toPx(), cap = StrokeCap.Round)
        val inset = stroke.width / 2f
        val arcSize = Size(size.width - stroke.width, size.height - stroke.width)
        val topLeft = Offset(inset, inset)
        drawArc(
            color = track,
            startAngle = 120f,
            sweepAngle = 300f,
            useCenter = false,
            topLeft = topLeft,
            size = arcSize,
            style = stroke,
        )
        if (clamped > 0f) {
            drawArc(
                color = accent,
                startAngle = 120f,
                sweepAngle = 300f * clamped,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = stroke,
            )
        }
    }
}

/** PL（種類の色）と CT（白）の大きな数字 */
@Composable
fun PalletCartonRow(accent: Color, pallets: Int, cartons: Int) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxWidth(),
    ) {
        BigNumber(label = "PL", value = pallets, color = accent, modifier = Modifier.weight(1f))
        Box(
            modifier = Modifier
                .width(1.dp)
                .height(44.dp)
                .background(MaterialTheme.colorScheme.outlineVariant),
        )
        BigNumber(label = "CT", value = cartons, color = Color.White, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun BigNumber(label: String, value: Int, color: Color, modifier: Modifier = Modifier) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = color,
        )
        Text(
            text = value.coerceAtLeast(0).toString(),
            style = MaterialTheme.typography.numeralMedium,
            color = color,
            maxLines = 1,
        )
    }
}

/** 気温（オレンジ）と湿度（青） */
@Composable
fun EnvironmentRow(environment: Environment, modifier: Modifier = Modifier) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
        modifier = modifier.fillMaxWidth(),
    ) {
        environment.temperatureC?.let { temp ->
            Text(
                text = "気温 ${DisplayFormat.temperature(temp)}",
                style = MaterialTheme.typography.labelSmall,
                color = WearColors.Orange,
                maxLines = 1,
            )
        }
        if (environment.temperatureC != null && environment.humidityPercent != null) {
            Spacer(Modifier.width(6.dp))
            Box(
                modifier = Modifier
                    .width(1.dp)
                    .height(12.dp)
                    .background(MaterialTheme.colorScheme.outlineVariant),
            )
            Spacer(Modifier.width(6.dp))
        }
        environment.humidityPercent?.let { humidity ->
            Text(
                text = "湿度 ${humidity}%",
                style = MaterialTheme.typography.labelSmall,
                color = WearColors.Blue,
                maxLines = 1,
            )
        }
    }
}

/** 作業開始からの経過時間。1 秒ごとに描き直す */
@Composable
fun ElapsedTimer(startedAt: Long, modifier: Modifier = Modifier) {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(startedAt) {
        while (true) {
            now = System.currentTimeMillis()
            delay(1_000L)
        }
    }
    Text(
        text = DisplayFormat.elapsed(now - startedAt),
        style = MaterialTheme.typography.titleMedium,
        color = Color.White,
        maxLines = 1,
        modifier = modifier,
    )
}

/** 「ラベル / 値」の 1 行 */
@Composable
fun KeyValueRow(label: String, value: String, valueColor: Color = MaterialTheme.colorScheme.onSurface) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = valueColor,
            textAlign = TextAlign.End,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
