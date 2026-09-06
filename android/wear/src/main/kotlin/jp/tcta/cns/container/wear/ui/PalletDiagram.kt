package jp.tcta.cns.container.wear.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
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
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.BoxSlot
import jp.tcta.cns.container.shared.CargoItem
import jp.tcta.cns.container.shared.PALLET_BASE_HEIGHT
import jp.tcta.cns.container.shared.PalletLayout
import jp.tcta.cns.container.shared.PalletStack
import jp.tcta.cns.container.wear.R
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.hypot
import kotlin.math.sin

/* ===== スマホ版（ItemDetailPanel）と同じ動きの値 ===== */

/** 中央から出てきて大きくなるまでの時間（秒） */
private const val ENTER_SEC = 1.4f

/** 自動回転の初速（度/秒）。勢いよく回り始める */
private const val SPIN_START_DPS = 260f

/** 落ち着いたあとの速さ（15 秒で 1 回転） */
private const val SPIN_END_DPS = 360f / 15f

/** 初速から終速へ近づく時定数（秒）。3 倍の時間でほぼ終速になる */
private const val SPIN_EASE_SEC = 1.8f

/** 既定の見る角度 */
private const val START_ANGLE_DEG = -35f

/**
 * 見下ろす角度。スマホ版の `rotateX(-25deg)` と同じ 25 度。
 * sin と cos を先に出しておく。
 */
private const val PITCH_SIN = 0.4226f
private const val PITCH_COS = 0.9063f

/** 画面幅いっぱいのスワイプで回る角度（スマホ版と同じ） */
private const val SWIPE_DEG = 180f

/** 触るのをやめてから自動回転に戻るまでの間（ミリ秒） */
private const val SPIN_RESUME_DELAY_MS = 300L

/** 段ボールの色。面の向きで明るさを変えて立体に見せる */
private val CardboardBase = Color(0xFFD9B486)
private val PalletBase = Color(0xFF4A5568)
private val FaceEdge = Color(0x40000000)

/** 面の明るさ（上 / 手前・奥 / 左右） */
private const val SHADE_TOP = 1.0f
private const val SHADE_DEPTH = 0.62f
private const val SHADE_SIDE = 0.82f

/**
 * 端数パレットの積み方の図。
 *
 * スマホ側（CNS）と同じ決まりで箱の置き場所を出し（`shared` の [PalletLayout]）、
 * 積み終わった状態で中央から回りながら大きくなって出てくる。
 * そのあとは、勢いよく回り始めてだんだん落ち着く速さでくるくる回り続ける。
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

    // 回る角度と、出てくるときの大きさ。触っているあいだは自分で回せる
    var angleDeg by remember(stack) { mutableFloatStateOf(START_ANGLE_DEG) }
    var enter by remember(stack) { mutableFloatStateOf(0f) }
    var zoom by remember(stack) { mutableFloatStateOf(1f) }
    var paused by remember(stack) { mutableStateOf(false) }
    var lastTouchAt by remember(stack) { mutableLongStateOf(0L) }
    LaunchedEffect(stack) {
        angleDeg = START_ANGLE_DEG
        enter = 0f
        val t0 = withFrameNanos { it }
        var last = t0
        // 自動で回っているあいだだけ数える時間。触るたびに数え直すので、
        // 手を離すとまた勢いよく回り始めてだんだん落ち着く
        var spinSec = 0f
        while (true) {
            val now = withFrameNanos { it }
            val dt = ((now - last).coerceAtLeast(0L)) / 1_000_000_000f
            last = now
            enter = ((now - t0) / 1_000_000_000f / ENTER_SEC).coerceIn(0f, 1f)
            val idle = System.currentTimeMillis() - lastTouchAt > SPIN_RESUME_DELAY_MS
            if (paused || !idle) {
                spinSec = 0f
            } else {
                spinSec += dt
                // 初速から終速へ、なめらかに落ちていく
                val dps = SPIN_END_DPS + (SPIN_START_DPS - SPIN_END_DPS) * exp(-spinSec / SPIN_EASE_SEC)
                angleDeg += dps * dt
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            // 2 回タップで閉じる（1 回タップは図の停止／再開に使う）
            .pointerInput(item.id) { detectTapGestures(onDoubleTap = { onClose() }) },
    ) {
        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val w = maxWidth
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = w * 0.10f, vertical = w * 0.12f),
            ) {
                Text(
                    text = item.modelName ?: item.name,
                    style = TextStyle(fontSize = (w.value * 0.055f).sp, fontWeight = FontWeight.Bold),
                    color = Color.White,
                    maxLines = 1,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(w * 0.01f))
                if (stack.isEmpty) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(
                            text = stringResource(R.string.pallet_none),
                            style = TextStyle(fontSize = (w.value * 0.05f).sp),
                            color = Color.White.copy(alpha = 0.7f),
                        )
                    }
                } else {
                    Canvas(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            // 1 回タップで止まる／また回り出す。2 回タップで閉じる
                            .pointerInput(stack) {
                                detectTapGestures(
                                    onTap = { paused = !paused },
                                    onDoubleTap = { onClose() },
                                )
                            }
                            // 横になぞると自分で回せる。つまむと大きさが変わる
                            .pointerInput(stack) {
                                detectTransformGestures { _, pan, gestureZoom, _ ->
                                    if (gestureZoom != 1f) {
                                        zoom = (zoom * gestureZoom).coerceIn(0.5f, 3f)
                                    }
                                    if (pan.x != 0f && size.width > 0) {
                                        angleDeg += pan.x / size.width * SWIPE_DEG
                                    }
                                    lastTouchAt = System.currentTimeMillis()
                                }
                            },
                    ) {
                        drawPallet(stack, angleDeg, enter, zoom)
                    }
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

/** 図を描くのに要る、回した後の見え方 */
private class View(
    val scale: Float,
    val centerX: Float,
    val centerY: Float,
    val palletCx: Float,
    val palletCy: Float,
    val cos: Float,
    val sin: Float,
    val vertShift: Float,
) {
    /** 立体の座標を画面の座標に直す */
    fun point(x: Float, y: Float, z: Float): Offset {
        val dx = x - palletCx
        val dy = y - palletCy
        val rx = dx * cos - dy * sin
        val ry = dx * sin + dy * cos
        val up = ry * PITCH_SIN + z * PITCH_COS
        return Offset(centerX + rx * scale, centerY - (up - vertShift) * scale)
    }

    /** 奥ゆき（大きいほど遠い）。描く順を決めるのに使う */
    fun depth(x: Float, y: Float, z: Float): Float {
        val dx = x - palletCx
        val dy = y - palletCy
        val ry = dx * sin + dy * cos
        return ry * PITCH_COS - z * PITCH_SIN
    }
}

private fun DrawScope.drawPallet(stack: PalletStack, angleDeg: Float, enter: Float, zoom: Float) {
    val pw = stack.palletWidth
    val pd = stack.palletDepth
    val ph = stack.totalHeight
    val rad = Math.toRadians(angleDeg.toDouble())
    val cos = cos(rad).toFloat()
    val sin = sin(rad).toFloat()

    // 回しても図の大きさが変わらないよう、外接する円で寸法を決める
    val radius = hypot(pw / 2f, pd / 2f)
    val spanX = radius * 2f
    val spanUp = radius * 2f * PITCH_SIN + ph * PITCH_COS
    val fit = minOf(size.width / spanX, size.height / spanUp) * 0.92f
    // 中央から出てきて大きくなる（出はじめは小さく、だんだんゆるやかに）
    val eased = 1f - (1f - enter) * (1f - enter) * (1f - enter)
    val scale = fit * (0.28f + 0.72f * eased) * zoom

    val view = View(
        scale = scale,
        centerX = size.width / 2f,
        centerY = size.height / 2f,
        palletCx = pw / 2f,
        palletCy = pd / 2f,
        cos = cos,
        sin = sin,
        vertShift = ph * PITCH_COS / 2f,
    )
    val alpha = (enter * 2.2f).coerceIn(0f, 1f)

    // パレットの台と箱を、奥のものから順に描く
    data class Piece(val depth: Float, val draw: DrawScope.() -> Unit)
    val pieces = mutableListOf<Piece>()

    pieces += Piece(
        depth = view.depth(pw / 2f, pd / 2f, PALLET_BASE_HEIGHT / 2f) + 1_000f,
        draw = { drawCuboid(view, 0f, pw, 0f, pd, 0f, PALLET_BASE_HEIGHT, PalletBase, alpha, cos, sin, null) },
    )
    for (slot in stack.slots) {
        pieces += Piece(
            depth = view.depth(slot.x + slot.w / 2f, slot.y + slot.d / 2f, slot.z + slot.h / 2f),
            draw = { drawBoxSlot(view, slot, alpha, cos, sin) },
        )
    }
    pieces.sortedByDescending { it.depth }.forEach { it.draw(this) }
}

private fun DrawScope.drawBoxSlot(view: View, slot: BoxSlot, alpha: Float, cos: Float, sin: Float) {
    drawCuboid(
        view,
        slot.x, slot.x + slot.w,
        slot.y, slot.y + slot.d,
        slot.z, slot.z + slot.h,
        CardboardBase, alpha, cos, sin, slot.split,
    )
}

/**
 * 直方体を描く。
 * 見えている面（上・手前か奥・左か右）だけを、面の向きに応じた明るさで塗る。
 */
private fun DrawScope.drawCuboid(
    view: View,
    x0: Float, x1: Float,
    y0: Float, y1: Float,
    z0: Float, z1: Float,
    base: Color,
    alpha: Float,
    cos: Float,
    sin: Float,
    split: String?,
) {
    fun face(pts: List<Triple<Float, Float, Float>>, shade: Float) {
        val path = Path()
        pts.forEachIndexed { i, (x, y, z) ->
            val o = view.point(x, y, z)
            if (i == 0) path.moveTo(o.x, o.y) else path.lineTo(o.x, o.y)
        }
        path.close()
        drawPath(path, color = shaded(base, shade).copy(alpha = alpha))
        drawPath(path, color = FaceEdge.copy(alpha = FaceEdge.alpha * alpha), style = Stroke(width = 1f))
    }

    // 手前（y0）が見えるのは cos > 0 のとき、奥（y1）が見えるのは cos < 0 のとき
    if (cos > 0f) {
        face(listOf(Triple(x0, y0, z1), Triple(x1, y0, z1), Triple(x1, y0, z0), Triple(x0, y0, z0)), SHADE_DEPTH)
    } else {
        face(listOf(Triple(x0, y1, z1), Triple(x1, y1, z1), Triple(x1, y1, z0), Triple(x0, y1, z0)), SHADE_DEPTH)
    }
    // 左（x0）が見えるのは sin > 0 のとき、右（x1）が見えるのは sin < 0 のとき
    if (sin > 0f) {
        face(listOf(Triple(x0, y0, z1), Triple(x0, y1, z1), Triple(x0, y1, z0), Triple(x0, y0, z0)), SHADE_SIDE)
    } else {
        face(listOf(Triple(x1, y0, z1), Triple(x1, y1, z1), Triple(x1, y1, z0), Triple(x1, y0, z0)), SHADE_SIDE)
    }
    // 上面は必ず見える
    face(listOf(Triple(x0, y0, z1), Triple(x1, y0, z1), Triple(x1, y1, z1), Triple(x0, y1, z1)), SHADE_TOP)

    // 2 箱をラミネートしている玉は、上面に継ぎ目を描く
    if (split != null) {
        val a: Offset
        val b: Offset
        if (split == "w") {
            val mx = (x0 + x1) / 2
            a = view.point(mx, y0, z1)
            b = view.point(mx, y1, z1)
        } else {
            val my = (y0 + y1) / 2
            a = view.point(x0, my, z1)
            b = view.point(x1, my, z1)
        }
        drawLine(Color.White.copy(alpha = 0.32f * alpha), a, b, strokeWidth = 1f)
    }
}

private fun shaded(color: Color, amount: Float): Color =
    Color(red = color.red * amount, green = color.green * amount, blue = color.blue * amount, alpha = 1f)
