package jp.tcta.cns.container.wear.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.BoxSlot
import jp.tcta.cns.container.shared.CargoItem
import jp.tcta.cns.container.shared.PALLET_BASE_HEIGHT
import jp.tcta.cns.container.shared.PalletLayout
import jp.tcta.cns.container.shared.PalletStack
import jp.tcta.cns.container.wear.R
import kotlinx.coroutines.delay

/** 箱が 1 個落ちてくるのにかける時間 */
private const val DROP_MS = 260

/** 次の箱を落とすまでの間隔 */
private const val DROP_INTERVAL_MS = 150L

/** 落ちはじめの高さ（箱の高さの何倍ぶん上から落とすか） */
private const val DROP_FROM = 3.2f

/** 段ボールの色（上面・左面・右面）。上ほど明るくして立体に見せる */
private val BoxTop = Color(0xFFD9B486)
private val BoxLeft = Color(0xFF9C7549)
private val BoxRight = Color(0xFFBE9464)
private val BoxEdge = Color(0x33000000)
private val PalletTop = Color(0xFF4A5568)
private val PalletLeft = Color(0xFF2C3442)
private val PalletRight = Color(0xFF3A4454)

/**
 * 端数パレットの積み方の図。
 *
 * スマホ側（CNS）と同じ決まりで箱の置き場所を出し（`shared` の [PalletLayout]）、
 * 斜め上から見た形で描く。パレットが出たあと、箱が積む順番どおりに上から落ちてくる。
 * どこかをタップすると閉じる。
 */
@Composable
fun PalletDiagramOverlay(
    item: CargoItem,
    accent: Color,
    onClose: () -> Unit,
) {
    val stack = remember(item.id, item.cartonCount, item.qtyPerPallet, item.measurements, item.name) {
        PalletLayout.buildFractionStack(
            cartons = item.cartonCount,
            qtyPerPallet = item.qtyPerPallet,
            itemType = item.itemType,
            itemName = item.name,
            measurements = item.measurements,
        )
    }

    // 積む順に 1 個ずつ出していく
    var placed by remember(stack) { mutableIntStateOf(0) }
    LaunchedEffect(stack) {
        placed = 0
        delay(320L)
        while (placed < stack.slots.size) {
            placed += 1
            delay(DROP_INTERVAL_MS)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .pointerInput(item.id) { detectTapGestures(onTap = { onClose() }) },
    ) {
        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val w = maxWidth
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = w * 0.10f, vertical = w * 0.13f),
            ) {
                Text(
                    text = item.modelName ?: item.name,
                    style = TextStyle(fontSize = (w.value * 0.055f).sp, fontWeight = FontWeight.Bold),
                    color = Color.White,
                    maxLines = 1,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(w * 0.012f))
                if (stack.isEmpty) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            text = stringResource(R.string.pallet_none),
                            style = TextStyle(fontSize = (w.value * 0.05f).sp),
                            color = Color.White.copy(alpha = 0.7f),
                        )
                    }
                } else {
                    PalletCanvas(
                        stack = stack,
                        placed = placed,
                        accent = accent,
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                    )
                    Text(
                        text = "${item.cartonCount}CT",
                        style = TextStyle(fontSize = (w.value * 0.062f).sp, fontWeight = FontWeight.Bold),
                        color = accent,
                        maxLines = 1,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }
}

/** 斜め上から見たパレットと箱を描く */
@Composable
private fun PalletCanvas(
    stack: PalletStack,
    placed: Int,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    // 何個目まで出したかが変わるたび、その箱を落として見せる
    val progress by animateFloatAsState(
        targetValue = placed.toFloat(),
        animationSpec = tween(durationMillis = DROP_MS, easing = LinearEasing),
        label = "drop",
    )

    Canvas(modifier = modifier) {
        val projected = project(stack, size.width, size.height)
        drawPalletBase(projected)

        // 奥・下から順に描くと前後の重なりが正しく見える
        val visible = stack.slots.indices
            .filter { stack.order[it] < placed }
            .sortedWith(
                compareByDescending<Int> { stack.slots[it].y + stack.slots[it].d }
                    .thenBy { stack.slots[it].z }
                    .thenBy { stack.slots[it].x },
            )

        for (i in visible) {
            val slot = stack.slots[i]
            // いま落ちている最中の 1 個だけ、上から降りてくる途中を描く
            val step = stack.order[i]
            val fall = (1f - (progress - step)).coerceIn(0f, 1f)
            val lift = fall * slot.h * DROP_FROM
            val alpha = if (fall > 0f) (1f - fall * 0.6f) else 1f
            drawBox(projected, slot, lift = lift, alpha = alpha, accent = accent)
        }
    }
}

/** 図を画面に収めるための倍率と原点 */
private data class Projection(
    val scale: Float,
    val originX: Float,
    val originY: Float,
    val palletWidth: Float,
    val palletDepth: Float,
    val totalHeight: Float,
)

/**
 * 斜め上から見た形にする。
 * 奥へ行くほど右上へずらし、高さはそのまま上へ積む。
 */
private const val ISO_X = 0.52f
private const val ISO_Y = -0.30f

private fun DrawScope.project(stack: PalletStack, width: Float, height: Float): Projection {
    val pw = stack.palletWidth
    val pd = stack.palletDepth
    val ph = stack.totalHeight
    // 図全体の外接する大きさ
    val spanX = pw + pd * ISO_X
    val spanY = ph + pd * -ISO_Y
    val scale = minOf(width / spanX, height / spanY) * 0.92f
    val originX = (width - spanX * scale) / 2
    val originY = height - (height - spanY * scale) / 2
    return Projection(scale, originX, originY, pw, pd, ph)
}

/** 立体の座標を画面の座標に直す */
private fun Projection.point(x: Float, y: Float, z: Float): Offset = Offset(
    x = originX + (x + y * ISO_X) * scale,
    y = originY - (z - y * ISO_Y) * scale,
)

private fun DrawScope.quad(p: Projection, pts: List<Triple<Float, Float, Float>>, color: Color, alpha: Float) {
    val path = Path()
    pts.forEachIndexed { i, (x, y, z) ->
        val o = p.point(x, y, z)
        if (i == 0) path.moveTo(o.x, o.y) else path.lineTo(o.x, o.y)
    }
    path.close()
    drawPath(path, color = color.copy(alpha = color.alpha * alpha))
    drawPath(path, color = BoxEdge.copy(alpha = BoxEdge.alpha * alpha), style = androidx.compose.ui.graphics.drawscope.Stroke(width = 1f))
}

/** パレットの台 */
private fun DrawScope.drawPalletBase(p: Projection) {
    val w = p.palletWidth
    val d = p.palletDepth
    val h = PALLET_BASE_HEIGHT
    // 上面
    quad(p, listOf(Triple(0f, 0f, h), Triple(w, 0f, h), Triple(w, d, h), Triple(0f, d, h)), PalletTop, 1f)
    // 手前
    quad(p, listOf(Triple(0f, 0f, h), Triple(w, 0f, h), Triple(w, 0f, 0f), Triple(0f, 0f, 0f)), PalletLeft, 1f)
    // 右
    quad(p, listOf(Triple(w, 0f, h), Triple(w, d, h), Triple(w, d, 0f), Triple(w, 0f, 0f)), PalletRight, 1f)
}

/** 箱ひとつ */
private fun DrawScope.drawBox(p: Projection, slot: BoxSlot, lift: Float, alpha: Float, accent: Color) {
    val x0 = slot.x
    val x1 = slot.x + slot.w
    val y0 = slot.y
    val y1 = slot.y + slot.d
    val z0 = slot.z + lift
    val z1 = slot.z + slot.h + lift

    // 上面 → 手前 → 右 の順に描く
    quad(p, listOf(Triple(x0, y0, z1), Triple(x1, y0, z1), Triple(x1, y1, z1), Triple(x0, y1, z1)), BoxTop, alpha)
    quad(p, listOf(Triple(x0, y0, z1), Triple(x1, y0, z1), Triple(x1, y0, z0), Triple(x0, y0, z0)), BoxLeft, alpha)
    quad(p, listOf(Triple(x1, y0, z1), Triple(x1, y1, z1), Triple(x1, y1, z0), Triple(x1, y0, z0)), BoxRight, alpha)

    // 2 箱をラミネートしている玉は、継ぎ目を上面に描く
    when (slot.split) {
        "w" -> {
            val mx = (x0 + x1) / 2
            val a = p.point(mx, y0, z1)
            val b = p.point(mx, y1, z1)
            drawLine(Color.White.copy(alpha = 0.35f * alpha), a, b, strokeWidth = 1f)
        }
        "d" -> {
            val my = (y0 + y1) / 2
            val a = p.point(x0, my, z1)
            val b = p.point(x1, my, z1)
            drawLine(Color.White.copy(alpha = 0.35f * alpha), a, b, strokeWidth = 1f)
        }
    }
}
