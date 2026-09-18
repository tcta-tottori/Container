package jp.tcta.cns.container.shared

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PalletLayoutTest {

    @Test
    fun `measurements are parsed`() {
        assertEquals(Triple(55f, 38f, 38f), PalletLayout.parseMeasurements("55*38*38"))
        assertEquals(Triple(46f, 46f, 29.3f), PalletLayout.parseMeasurements("46×46×29.3"))
        assertNull(PalletLayout.parseMeasurements("ふつうの文字"))
        assertNull(PalletLayout.parseMeasurements(null))
    }

    @Test
    fun `box dimensions fall back by item name`() {
        assertEquals(Triple(55f, 42f, 42f), PalletLayout.boxDimensionsCm(null, "JPV-G180-1"))
        assertEquals(Triple(42f, 32f, 28f), PalletLayout.boxDimensionsCm(null, "SR-060X"))
        assertEquals(Triple(55f, 38f, 38f), PalletLayout.boxDimensionsCm(null, null))
    }

    @Test
    fun `layer count follows the type`() {
        // 180 サイズは 4 段、それ以外は 5 段
        assertEquals(4, PalletLayout.stackLayers(ItemTypes.POLY_COVER, "JPV-G180-1", 30, null))
        assertEquals(5, PalletLayout.stackLayers(ItemTypes.POLY_COVER, "JPV-G100-1", 30, null))
        // 50 サイズのポットは 4 段
        assertEquals(4, PalletLayout.stackLayers(ItemTypes.JAR_POT, "PDU-A50A", 20, null))
        assertEquals(5, PalletLayout.stackLayers(ItemTypes.JAR_POT, "PDU-A40A", 20, null))
    }

    @Test
    fun `pdu and per-layer types are recognised`() {
        assertTrue(PalletLayout.isPduJarPot("PDU-A40A"))
        assertTrue(!PalletLayout.isPduJarPot("PDZ-A40A"))
        // 1 段 7 個: JPI・JPK・JRD・JPD
        assertTrue(PalletLayout.is7PerLayerType("JPI-H100"))
        assertTrue(PalletLayout.is7PerLayerType("JPK+G18C(T)"))
        assertTrue(PalletLayout.is7PerLayerType("JRD-G100"))
        assertTrue(PalletLayout.is7PerLayerType("JPD-G100"))
        // 1 段 6 個: JRI・JPV
        assertTrue(PalletLayout.is6PerLayerType("JRI-G100(KKB)"))
        assertTrue(PalletLayout.is6PerLayerType("JPV-H100"))
        // どちらでもない
        assertTrue(!PalletLayout.is7PerLayerType("JPV-H100"))
        assertTrue(!PalletLayout.is6PerLayerType("JPI-H100"))
        assertTrue(!PalletLayout.is7PerLayerType("PDZ-A100"))
        assertTrue(!PalletLayout.is6PerLayerType("PDZ-A100"))
    }

    @Test
    fun `per-layer count follows the model prefix`() {
        // 1 段 6 個の JPV: 6 個ちょうどで 1 段ぶんの高さに収まる
        val jpv = PalletLayout.buildFractionStack(
            cartons = 6, qtyPerPallet = 30,
            itemType = ItemTypes.POLY_COVER, itemName = "JPV-G100-1",
            measurements = "46*46*29.3",
        )
        assertEquals(6, jpv.slots.size)
        assertEquals(1, jpv.slots.map { it.z }.distinct().size)

        // 1 段 7 個の JPI: 7 個ちょうどで 1 段ぶん
        val jpi = PalletLayout.buildFractionStack(
            cartons = 7, qtyPerPallet = 35,
            itemType = ItemTypes.POLY_COVER, itemName = "JPI-G100-1",
            measurements = "46*46*29.3",
        )
        assertEquals(7, jpi.slots.size)
        assertEquals(1, jpi.slots.map { it.z }.distinct().size)

        // JRI も 1 段 6 個
        val jri = PalletLayout.buildFractionStack(
            cartons = 6, qtyPerPallet = 30,
            itemType = ItemTypes.POLY_COVER, itemName = "JRI-G100(KKB)",
            measurements = "46*46*29.3",
        )
        assertEquals(1, jri.slots.map { it.z }.distinct().size)

        // JRD は 1 段 7 個
        val jrd = PalletLayout.buildFractionStack(
            cartons = 7, qtyPerPallet = 35,
            itemType = ItemTypes.POLY_COVER, itemName = "JRD-G100",
            measurements = "46*46*29.3",
        )
        assertEquals(7, jrd.slots.size)
        assertEquals(1, jrd.slots.map { it.z }.distinct().size)
    }

    @Test
    fun `big nabe boxes stack five per layer`() {
        // 3L JPV-T100 のような 1 ケース 12 個入りの大きい箱は 1 段 5 個
        val big = PalletLayout.buildFractionStack(
            cartons = 5, qtyPerPallet = 25,
            itemType = ItemTypes.POT, itemName = "JPVT100ｳﾁﾅﾍﾞ$",
            measurements = "66*44*30", packingQty = 12,
        )
        assertEquals(5, big.slots.size)
        assertEquals(1, big.slots.map { it.z }.distinct().size)
        // 奥の 2 個は「横」（幅が長辺）、手前の 3 個は「縦」（奥行きが長辺）
        assertEquals(2, big.slots.count { it.w > it.d })
        assertEquals(3, big.slots.count { it.d > it.w })

        // 従来の 8 個入りの内鍋は、これまでどおり 1 段 6 個
        val small = PalletLayout.buildFractionStack(
            cartons = 6, qtyPerPallet = 30,
            itemType = ItemTypes.POT, itemName = "JPVG100ｳﾁﾅﾍﾞ$1",
            measurements = "46*46*29.3", packingQty = 8,
        )
        assertEquals(6, small.slots.size)
        assertEquals(1, small.slots.map { it.z }.distinct().size)
    }

    @Test
    fun `big nabe layers interlock and stay on the pallet`() {
        // 2 段目は 90 度まわして噛み合わせる。荷姿からははみ出さない
        val stack = PalletLayout.buildFractionStack(
            cartons = 10, qtyPerPallet = 25,
            itemType = ItemTypes.POT, itemName = "JPVT100ｳﾁﾅﾍﾞ$",
            measurements = "66*44*30", packingQty = 12,
        )
        assertEquals(10, stack.slots.size)
        assertEquals(2, stack.slots.map { it.z }.distinct().size)
        val zs = stack.slots.map { it.z }.distinct().sorted()
        val lower = stack.slots.filter { it.z == zs[0] }
        val upper = stack.slots.filter { it.z == zs[1] }
        // 1 段目と 2 段目で「横」と「縦」の数が入れ替わる
        assertEquals(2, lower.count { it.w > it.d })
        assertEquals(2, upper.count { it.d > it.w })
        // どの箱もパレットの中に収まっている
        for (b in stack.slots) {
            assertTrue(b.x >= -0.01f && b.x + b.w <= stack.palletWidth + 0.01f)
            assertTrue(b.y >= -0.01f && b.y + b.d <= stack.palletDepth + 0.01f)
        }
    }

    @Test
    fun `fraction stack places exactly the remainder`() {
        val stack = PalletLayout.buildFractionStack(
            cartons = 15,
            qtyPerPallet = 30,
            itemType = ItemTypes.POLY_COVER,
            itemName = "JPV-G100-1",
            measurements = "46*46*29.3",
        )
        assertEquals(15, stack.slots.size)
        assertEquals(1, stack.casesPerBox)
        // 積む順番は 0..n-1 が 1 回ずつ
        assertEquals((0 until 15).toList(), stack.order.sorted())
        assertTrue(stack.totalHeight > PALLET_BASE_HEIGHT)
    }

    @Test
    fun `pdu counts two cases as one bundle`() {
        val stack = PalletLayout.buildFractionStack(
            cartons = 7,
            qtyPerPallet = 20,
            itemType = ItemTypes.JAR_POT,
            itemName = "PDU-A40A",
            measurements = null,
        )
        assertEquals(2, stack.casesPerBox)
        // 7 ケース → 4 玉（切り上げ）
        assertEquals(4, stack.slots.size)
    }

    @Test
    fun `no cartons means nothing to draw`() {
        val stack = PalletLayout.buildFractionStack(0, 30, ItemTypes.POLY_COVER, "JPV-G100-1", null)
        assertTrue(stack.isEmpty)
    }

    @Test
    fun `top layer keeps the four corners`() {
        // 1 段 6 個・端数 2 → 下の段を崩して四隅を確保するので、置いた数は端数どおり
        val stack = PalletLayout.buildFractionStack(
            cartons = 8,
            qtyPerPallet = 30,
            itemType = ItemTypes.POT,
            itemName = "SR-26IH",
            measurements = "46*46*29.3",
        )
        assertEquals(8, stack.slots.size)
    }
}
