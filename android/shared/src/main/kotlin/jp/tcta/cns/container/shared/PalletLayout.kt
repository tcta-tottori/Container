package jp.tcta.cns.container.shared

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * 端数パレットの積み方を組み立てるところ。
 *
 * スマホ側（CNS）の `src/components/PalletDiagram.tsx` と同じ決まりで箱の置き場所を出す。
 * ここは place（どこに置くか）だけを扱い、描くのはウォッチ側の担当。
 */

/** パレットの厚み（箱と同じ単位） */
const val PALLET_BASE_HEIGHT = 8f

/** 図の基準幅。この幅を 1 パレットの横幅とする */
private const val VISUAL_SIZE = 70f

/** PDU のポットは 2 箱をラミネートして 1 玉にする */
private const val PDU_CASES_PER_BUNDLE = 2

/** PDU の 1 段あたりの玉数 */
private const val PDU_BUNDLES_PER_LAYER = 10

/** 玉（2 箱をラミネートしたかたまり）の 長辺 ÷ 短辺 */
private const val PDU_BUNDLE_RATIO = 1.35f

/**
 * 箱ひとつの置き場所。
 *
 * @property x 左からの位置
 * @property y 手前からの位置（0 が手前、大きいほど奥）
 * @property z 下からの高さ
 * @property w 幅 / @property d 奥行き / @property h 高さ
 * @property split 2 箱をシュリンクで 1 玉にしているときの継ぎ目の向き（"w" or "d"）
 * @property seq 1 段のなかで積む順番（決まっているときだけ）
 */
data class BoxSlot(
    val x: Float,
    val y: Float,
    val z: Float,
    val w: Float,
    val d: Float,
    val h: Float,
    val split: String? = null,
    val seq: Int? = null,
)

/**
 * 端数パレットの積み方ひとそろい。
 *
 * @property slots 置く箱（[order] の順に積む）
 * @property order [slots] の添字ごとの「何番目に積むか」
 * @property palletWidth / @property palletDepth パレットの大きさ
 * @property totalHeight パレットを含めた高さ
 * @property casesPerBox 図の 1 個が何ケースにあたるか（PDU は 2）
 */
data class PalletStack(
    val slots: List<BoxSlot>,
    val order: List<Int>,
    val palletWidth: Float,
    val palletDepth: Float,
    val totalHeight: Float,
    val casesPerBox: Int,
) {
    val isEmpty: Boolean get() = slots.isEmpty()
}

object PalletLayout {

    /** "55*38*38" のような寸法（cm）を読む */
    fun parseMeasurements(text: String?): Triple<Float, Float, Float>? {
        if (text.isNullOrBlank()) return null
        val m = Regex("""(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)""").find(text)
            ?: return null
        return Triple(
            m.groupValues[1].toFloat(),
            m.groupValues[2].toFloat(),
            m.groupValues[3].toFloat(),
        )
    }

    /** 寸法が分からないときの既定の箱の大きさ（cm） */
    fun boxDimensionsCm(measurements: String?, itemName: String?): Triple<Float, Float, Float> {
        parseMeasurements(measurements)?.let { return it }
        if (itemName != null) {
            if (itemName.contains("180") || Regex("18[RWCS]").containsMatchIn(itemName)) {
                return Triple(55f, 42f, 42f)
            }
            if (itemName.contains("060")) return Triple(42f, 32f, 28f)
        }
        return Triple(55f, 38f, 38f)
    }

    /**
     * 1 段 7 個で積む品目か。
     * 頭に JP が付くもの（JPI・JPV・JPK など）はすべてこの積み方をする。
     */
    fun isJp7Type(itemName: String?): Boolean =
        itemName != null && Regex("""^JP[A-Z]""").containsMatchIn(itemName.replace(" ", "").uppercase())

    /** PDU が付くジャーポット（2 箱シュリンクで 1 玉） */
    fun isPduJarPot(itemName: String?): Boolean =
        itemName != null && Regex("PDU", RegexOption.IGNORE_CASE).containsMatchIn(itemName)

    /** 何段まで積むか */
    fun stackLayers(itemType: String?, itemName: String, qtyPerPallet: Int, measurements: String?): Int {
        if (itemType == ItemTypes.JAR_POT || Regex("^(PDR|PDU|PVW)").containsMatchIn(itemName)) {
            val m = Regex("""(?:PD[RUZ]|PVW)[^0-9]{0,4}(\d{2})""").find(itemName)
                ?: Regex("(30|40|50)").find(itemName)
            val size = m?.groupValues?.get(1)?.toIntOrNull() ?: 0
            return if (size >= 50) 4 else 5
        }
        if (itemType == ItemTypes.POLY_COVER || itemType == ItemTypes.POT) {
            return if (itemName.contains("180") || Regex("18[RWCS]").containsMatchIn(itemName)) 4 else 5
        }
        val dims = parseMeasurements(measurements)
        if (dims != null && qtyPerPallet > 0) {
            val palletCm = 110f
            val perLayer = max(1f, floor(palletCm / dims.first)) * max(1f, floor(palletCm / dims.second))
            return min(max(1, ceil(qtyPerPallet / perLayer).toInt()), 5)
        }
        return 0
    }

    /**
     * 端数ぶんの積み方を組み立てる。
     *
     * @param cartons 端数のケース数
     * @param qtyPerPallet 1 パレットあたりのケース数
     * @param itemType 種類（[ItemTypes] の値）
     * @param itemName 品名（機種の判定に使う）
     * @param measurements 箱の寸法 "55*38*38"（cm）
     */
    fun buildFractionStack(
        cartons: Int,
        qtyPerPallet: Int,
        itemType: String?,
        itemName: String,
        measurements: String?,
    ): PalletStack {
        if (cartons <= 0) return PalletStack(emptyList(), emptyList(), VISUAL_SIZE, VISUAL_SIZE, PALLET_BASE_HEIGHT, 1)

        val (bwCm, bdCm, bhCm) = boxDimensionsCm(measurements, itemName)
        val isNabe = itemType == ItemTypes.POT
        val isJp7 = isJp7Type(itemName)
        val isJarPot = itemType == ItemTypes.JAR_POT || Regex("^(PDR|PDU|PVW)").containsMatchIn(itemName)
        val isPdu = isJarPot && isPduJarPot(itemName)
        val casesPerBox = if (isPdu) PDU_CASES_PER_BUNDLE else 1

        // パレットの大きさ（cm）
        val palletWcm: Float
        val palletDcm: Float
        if (isJp7 && !isNabe) {
            val side = max(bwCm, bdCm) + min(bwCm, bdCm) * 2
            palletWcm = side
            palletDcm = side
        } else {
            palletWcm = 110f
            palletDcm = 110f
        }

        val cm2px = VISUAL_SIZE / palletWcm
        val pw = palletWcm * cm2px
        val pd = palletDcm * cm2px
        val bh = bhCm * cm2px

        var layers = stackLayers(itemType, itemName, qtyPerPallet, measurements).takeIf { it > 0 } ?: 3

        val slots: MutableList<BoxSlot>
        var perLayer: Int
        when {
            isPdu -> {
                slots = pduJarPotSlots(bh, layers, pw, pd).toMutableList()
                perLayer = PDU_BUNDLES_PER_LAYER
            }
            isJarPot -> {
                slots = jarPotSlots(bh, layers, pw, pd).toMutableList()
                perLayer = 4
            }
            isNabe -> {
                slots = nabeSlots(bwCm, bdCm, bh, layers, pw, pd, cm2px).toMutableList()
                perLayer = if (slots.isNotEmpty()) (slots.size.toFloat() / layers).roundToInt() else 6
            }
            isJp7 -> {
                slots = jp7Slots(bwCm, bdCm, bh, layers, pw, pd, cm2px).toMutableList()
                perLayer = 7
            }
            else -> {
                val defaultPerLayer = max(1f, floor(pw / (bwCm * cm2px))).toInt() *
                    max(1f, floor(pd / (bdCm * cm2px))).toInt()
                if (qtyPerPallet > 0 && qtyPerPallet > defaultPerLayer * 5) {
                    // 既定の寸法では 5 段でも収まらない → 1 パレットのケース数から逆算する
                    val targetPerLayer = ceil(qtyPerPallet / 5f).toInt()
                    val cols = ceil(sqrt(targetPerLayer.toFloat())).toInt().coerceAtLeast(1)
                    val rows = ceil(targetPerLayer.toFloat() / cols).toInt().coerceAtLeast(1)
                    val boxW = pw / cols
                    val boxD = pd / rows
                    val actualLayers = min(5, ceil(qtyPerPallet.toFloat() / (cols * rows)).toInt()).coerceAtLeast(1)
                    slots = mutableListOf()
                    for (layer in 0 until actualLayers) {
                        for (r in 0 until rows) {
                            for (c in 0 until cols) {
                                slots += BoxSlot(
                                    x = c * boxW,
                                    y = r * boxD,
                                    z = PALLET_BASE_HEIGHT + layer * bh,
                                    w = boxW, d = boxD, h = bh,
                                )
                            }
                        }
                    }
                    perLayer = cols * rows
                    layers = actualLayers
                } else {
                    slots = genericSlots(bwCm, bdCm, bh, layers, pw, pd, cm2px).toMutableList()
                    perLayer = if (slots.isNotEmpty()) (slots.size.toFloat() / layers).roundToInt() else 6
                }
            }
        }
        if (perLayer <= 0) perLayer = 1

        // PDU は 2 ケースで 1 玉なので、端数のケース数を玉数に直す
        val drawn = if (casesPerBox > 1) ceil(cartons.toFloat() / casesPerBox).toInt() else cartons

        // 段が足りなければ上へ足す
        if (drawn > slots.size) {
            val templateH = slots.firstOrNull()?.h ?: bh
            val needed = ceil(drawn.toFloat() / perLayer).toInt()
            for (l in layers until needed) {
                for (i in 0 until perLayer) {
                    val src = slots.getOrNull(i) ?: break
                    slots += src.copy(z = PALLET_BASE_HEIGHT + l * templateH)
                }
            }
        }

        val render = fractionSlots(slots, perLayer, drawn)
        val order = stackOrder(render, if (isPdu || isJp7) StackMode.LAYER else StackMode.BACK_COLUMN)
        val maxZ = render.fold(PALLET_BASE_HEIGHT) { acc, s -> max(acc, s.z + s.h) }
        return PalletStack(
            slots = render,
            order = order,
            palletWidth = pw,
            palletDepth = pd,
            totalHeight = maxZ,
            casesPerBox = casesPerBox,
        )
    }

    // ---------- 段ごとの並べ方 ----------

    /** 鍋・ポリカバー: 3 列 × N 行 */
    private fun nabeSlots(
        bwCm: Float, bdCm: Float, bhPx: Float, layers: Int,
        pw: Float, pd: Float, cm2px: Float,
    ): List<BoxSlot> {
        val boxW = min(bwCm, bdCm) * cm2px
        val boxD = max(bwCm, bdCm) * cm2px
        val cols = 3
        val rows = max(1, floor(pd / boxD).toInt())
        val totalW = cols * boxW
        val totalD = rows * boxD
        val gapX = if (totalW <= pw) max(0f, (pw - totalW) / (cols + 1)) else 0f
        val gapY = if (totalD <= pd) max(0f, (pd - totalD) / (rows + 1)) else 0f
        val startX = if (totalW <= pw) gapX else (pw - totalW) / 2
        val startY = if (totalD <= pd) gapY else (pd - totalD) / 2
        val out = mutableListOf<BoxSlot>()
        for (layer in 0 until layers) {
            for (r in 0 until rows) {
                for (c in 0 until cols) {
                    out += BoxSlot(
                        x = startX + c * (boxW + if (totalW <= pw) gapX else 0f),
                        y = startY + r * (boxD + if (totalD <= pd) gapY else 0f),
                        z = PALLET_BASE_HEIGHT + layer * bhPx,
                        w = boxW, d = boxD, h = bhPx,
                    )
                }
            }
        }
        return out
    }

    /** JP 系: 1 段 7 個。段ごとに 90 度まわして噛み合わせる */
    private fun jp7Slots(
        bwCm: Float, bdCm: Float, bhPx: Float, layers: Int,
        pw: Float, pd: Float, cm2px: Float,
    ): List<BoxSlot> {
        val s = min(bwCm, bdCm) * cm2px
        val l = max(bwCm, bdCm) * cm2px
        val out = mutableListOf<BoxSlot>()
        for (layer in 0 until layers) {
            val z = PALLET_BASE_HEIGHT + layer * bhPx
            if (layer % 2 == 0) {
                val colX = pw - l
                val colY0 = (pd - 3 * s) / 2
                for (i in 0 until 3) {
                    out += BoxSlot(colX, colY0 + (2 - i) * s, z, l, s, bhPx, seq = i)
                }
                val blkY0 = (pd - 2 * l) / 2
                for (r in 0 until 2) {
                    for (c in 0 until 2) {
                        out += BoxSlot(c * s, blkY0 + (1 - r) * l, z, s, l, bhPx, seq = 3 + r * 2 + c)
                    }
                }
            } else {
                val rowY = pd - l
                val rowX0 = (pw - 3 * s) / 2
                for (i in 0 until 3) {
                    out += BoxSlot(rowX0 + (2 - i) * s, rowY, z, s, l, bhPx, seq = i)
                }
                val blkX0 = (pw - 2 * l) / 2
                for (r in 0 until 2) {
                    for (c in 0 until 2) {
                        out += BoxSlot(blkX0 + c * l, (1 - r) * s, z, l, s, bhPx, seq = 3 + r * 2 + c)
                    }
                }
            }
        }
        return out
    }

    /** ジャーポット: 1 段 4 個（2×2） */
    private fun jarPotSlots(bhPx: Float, layers: Int, pw: Float, pd: Float): List<BoxSlot> {
        val bw = (pw - 3) / 2
        val bd = (pd - 3) / 2
        val out = mutableListOf<BoxSlot>()
        for (layer in 0 until layers) {
            for (r in 0 until 2) {
                for (c in 0 until 2) {
                    out += BoxSlot(
                        x = 1 + c * (bw + 1),
                        y = 1 + r * (bd + 1),
                        z = PALLET_BASE_HEIGHT + layer * bhPx,
                        w = bw, d = bd, h = bhPx,
                    )
                }
            }
        }
        return out
    }

    /**
     * PDU ジャーポット: 風車（ピンホイール）状に 1 段 10 玉。
     * 横長 2 玉 ＋ 縦長 3 玉を 2 組、互い違いに置く。段ごとに左右を入れ替える。
     */
    private fun pduJarPotSlots(bhPx: Float, layers: Int, pw: Float, pd: Float): List<BoxSlot> {
        val ratio = PDU_BUNDLE_RATIO
        val sSize = min(pw / (ratio + 3), pd / (ratio + 2))
        val lSize = sSize * ratio
        val loadW = lSize + 3 * sSize
        val loadD = lSize + 2 * sSize
        val ox = (pw - loadW) / 2
        val oy = (pd - loadD) / 2

        fun layerSlots(landscapeBackLeft: Boolean): List<BoxSlot> {
            fun mirrorX(x: Float, w: Float) = if (landscapeBackLeft) x else loadW - x - w
            fun put(x: Float, y: Float, w: Float, d: Float, split: String, seq: Int) = BoxSlot(
                x = ox + mirrorX(x, w),
                y = oy + (loadD - y - d),
                z = 0f, w = w, d = d, h = 0f, split = split, seq = seq,
            )
            val out = mutableListOf<BoxSlot>()
            for (i in 0 until 2) out += put(0f, i * sSize, lSize, sSize, "w", if (i == 0) 0 else 4)
            for (i in 0 until 3) out += put(lSize + i * sSize, 0f, sSize, lSize, "d", 1 + i)
            for (i in 0 until 2) out += put(3 * sSize, lSize + i * sSize, lSize, sSize, "w", 5 + i)
            for (i in 0 until 3) out += put(i * sSize, 2 * sSize, sSize, lSize, "d", 9 - i)
            return out
        }

        val out = mutableListOf<BoxSlot>()
        for (layer in 0 until layers) {
            val z = PALLET_BASE_HEIGHT + layer * bhPx
            for (b in layerSlots(layer % 2 == 0)) out += b.copy(z = z, h = bhPx)
        }
        return out
    }

    /** そのほか: 寸法どおりに並べる */
    private fun genericSlots(
        bwCm: Float, bdCm: Float, bhPx: Float, layers: Int,
        pw: Float, pd: Float, cm2px: Float,
    ): List<BoxSlot> {
        val bw = bwCm * cm2px
        val bd = bdCm * cm2px
        val cols = max(1, floor(pw / bw).toInt())
        val rows = max(1, floor(pd / bd).toInt())
        val gapX = max(0f, (pw - cols * bw) / (cols + 1))
        val gapY = max(0f, (pd - rows * bd) / (rows + 1))
        val out = mutableListOf<BoxSlot>()
        for (layer in 0 until layers) {
            for (r in 0 until rows) {
                for (c in 0 until cols) {
                    out += BoxSlot(
                        x = gapX + c * (bw + gapX),
                        y = gapY + r * (bd + gapY),
                        z = PALLET_BASE_HEIGHT + layer * bhPx,
                        w = bw, d = bd, h = bhPx,
                    )
                }
            }
        }
        return out
    }

    // ---------- 端数の置き方 ----------

    /** 四隅寄りなら小さい値になる指標 */
    private fun cornerScore(slot: BoxSlot, layer: List<BoxSlot>): Float {
        val minX = layer.minOf { it.x }
        val maxX = layer.maxOf { it.x }
        val minY = layer.minOf { it.y }
        val maxY = layer.maxOf { it.y }
        val rangeX = (maxX - minX).takeIf { it != 0f } ?: 1f
        val rangeY = (maxY - minY).takeIf { it != 0f } ?: 1f
        val dx = min(slot.x - minX, maxX - slot.x) / rangeX
        val dy = min(slot.y - minY, maxY - slot.y) / rangeY
        return dx + dy
    }

    /**
     * 端数ぶんだけ置く。
     * 上の面は必ず四隅に箱があるようにし、足りないぶんは中央から抜く。
     * 端数が 4 未満のときは下の段を崩して四隅を確保する。
     */
    private fun fractionSlots(all: List<BoxSlot>, perLayer: Int, fraction: Int): List<BoxSlot> {
        if (fraction <= 0 || perLayer <= 0) return emptyList()
        val fullLayers = fraction / perLayer
        val remainder = fraction % perLayer
        if (remainder == 0) return all.take(fraction)

        fun layerSorted(layerIdx: Int): List<BoxSlot> {
            val start = layerIdx * perLayer
            val layer = all.drop(start).take(perLayer)
            if (layer.isEmpty()) return emptyList()
            return layer.sortedBy { cornerScore(it, layer) }
        }

        val result = mutableListOf<BoxSlot>()

        if (remainder < 4 && fullLayers > 0 && perLayer > 4) {
            val extraLayers = ceil((4 - remainder).toFloat() / (perLayer - 4)).toInt()
            val actualExtra = min(extraLayers, fullLayers)
            if (actualExtra > 0 && actualExtra * (perLayer - 4) + remainder >= 4) {
                val belowFull = fullLayers - actualExtra
                val distributed = fraction - belowFull * perLayer
                val bottomCount = distributed - actualExtra * 4
                for (i in 0 until min(belowFull * perLayer, all.size)) result += all[i]
                val bottomSorted = layerSorted(belowFull)
                for (i in 0 until min(bottomCount, bottomSorted.size)) result += bottomSorted[i]
                for (t in 0 until actualExtra) {
                    val sorted = layerSorted(belowFull + 1 + t)
                    for (i in 0 until min(4, sorted.size)) result += sorted[i]
                }
                return result
            }
        }

        for (i in 0 until min(fullLayers * perLayer, all.size)) result += all[i]
        val sorted = layerSorted(fullLayers)
        for (i in 0 until min(remainder, sorted.size)) result += sorted[i]
        return result
    }

    // ---------- 積む順番 ----------

    private enum class StackMode { BACK_COLUMN, LAYER }

    /**
     * 箱を積む順番。返す配列は「[slots] の添字 → 何番目に積むか」。
     *
     * BACK_COLUMN（ポリカバー・鍋など）… 奥の列から。1 列を上まで積んでから手前の列へ。列のなかは中央 → 左 → 右
     * LAYER（PDU・JP 系など）… 1 段ずつ仕上げる。段のなかは決まった順（seq）に従う
     */
    private fun stackOrder(slots: List<BoxSlot>, mode: StackMode): List<Int> {
        if (slots.isEmpty()) return emptyList()
        fun round(v: Float) = (v * 100).roundToInt() / 100f
        val layers = slots.map { round(it.z) }.distinct().sorted()
        // y は 0 が手前。奥から積むので大きいほうを先にする
        val rows = slots.map { round(it.y) }.distinct().sortedDescending()
        val minX = slots.minOf { it.x }
        val maxX = slots.maxOf { it.x + it.w }
        val centerX = (minX + maxX) / 2

        data class Ranked(
            val index: Int,
            val seq: Int?,
            val layer: Int,
            val row: Int,
            val fromCenter: Float,
            val left: Float,
        )

        val ranked = slots.mapIndexed { i, s ->
            Ranked(
                index = i,
                seq = s.seq,
                layer = layers.indexOf(round(s.z)),
                row = rows.indexOf(round(s.y)),
                fromCenter = round(abs(s.x + s.w / 2 - centerX)),
                left = s.x,
            )
        }.sortedWith(
            Comparator { a, b ->
                if (mode == StackMode.BACK_COLUMN) {
                    if (a.row != b.row) return@Comparator a.row - b.row
                    if (a.layer != b.layer) return@Comparator a.layer - b.layer
                } else {
                    if (a.layer != b.layer) return@Comparator a.layer - b.layer
                    val sa = a.seq
                    val sb = b.seq
                    if (sa != null && sb != null && sa != sb) return@Comparator sa - sb
                    if (a.row != b.row) return@Comparator a.row - b.row
                }
                if (a.fromCenter != b.fromCenter) return@Comparator a.fromCenter.compareTo(b.fromCenter)
                a.left.compareTo(b.left)
            },
        )

        val order = MutableList(slots.size) { 0 }
        ranked.forEachIndexed { pos, r -> order[r.index] = pos }
        return order
    }
}
