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
    fun `pdu and jpi are recognised`() {
        assertTrue(PalletLayout.isPduJarPot("PDU-A40A"))
        assertTrue(!PalletLayout.isPduJarPot("PDZ-A40A"))
        // 頭に JP が付くものはすべて 1 段 7 個
        assertTrue(PalletLayout.isJp7Type("JPI-H100"))
        assertTrue(PalletLayout.isJp7Type("JPV-H100"))
        assertTrue(PalletLayout.isJp7Type("JPK+G18C(T)"))
        assertTrue(!PalletLayout.isJp7Type("JRI-G100(KKB)"))
        assertTrue(!PalletLayout.isJp7Type("PDZ-A100"))
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
