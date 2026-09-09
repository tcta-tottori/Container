package jp.tcta.cns.container.shared

import kotlin.test.Test
import kotlin.test.assertEquals

class DisplayFormatTest {
    @Test
    fun `weight switches unit by size`() {
        assertEquals("—", DisplayFormat.weight(0f))
        assertEquals("8.5kg", DisplayFormat.weight(8.5f))
        assertEquals("12kg", DisplayFormat.weight(12.4f))
        assertEquals("1.5t", DisplayFormat.weight(1500f))
    }

    @Test
    fun `volume keeps three digits for small boxes`() {
        assertEquals("—", DisplayFormat.volume(0f))
        assertEquals("0.079m³", DisplayFormat.volume(0.0789f))
        assertEquals("2.40m³", DisplayFormat.volume(2.4f))
        assertEquals("24.0m³", DisplayFormat.volume(24f))
        assertEquals("240m³", DisplayFormat.volume(240f))
    }

    @Test
    fun `dimensions use a multiplication sign`() {
        assertEquals("55×38×38", DisplayFormat.dimensions("55*38*38"))
        assertEquals("55×38×37.5", DisplayFormat.dimensions("55 x 38 x 37.5"))
        assertEquals("—", DisplayFormat.dimensions(null))
        // 読めない文字はそのまま返す（消してしまわない）
        assertEquals("不明", DisplayFormat.dimensions("不明"))
    }
}
