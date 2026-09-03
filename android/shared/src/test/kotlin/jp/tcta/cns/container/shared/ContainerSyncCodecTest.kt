package jp.tcta.cns.container.shared

import java.time.LocalDate
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ContainerSyncCodecTest {
    private val container = ContainerInfo(
        id = "TCLU4021378",
        name = "TCLU4021378 (9/3 入荷)",
        containerType = "40ft HC",
        loadPercentage = 68f,
        remainingPercentage = 32f,
        totalQuantity = 1860,
        itemCount = 2,
        totalPallets = 13,
        totalCartons = 7,
        startedAt = 1_756_899_000_000L,
        status = "荷降ろし中",
        updatedAt = 1_756_900_000_000L,
    )
    private val payload = ContainerSyncPayload(
        generatedAt = 1_756_900_100_000L,
        selectedContainerId = container.id,
        containers = listOf(container),
        cargo = mapOf(
            container.id to listOf(
                CargoItem("1", "ポリカバー 30cm 白", 480, palletCount = 8, cartonCount = 5, itemType = ItemTypes.POLY_COVER, modelName = "JPV-H100", remainingPercentage = 0f, warning = "類似品あり", location = "前方 パレット1-3", status = "完了"),
                CargoItem("2", "鍋 26cm IH", 300, palletCount = 5, cartonCount = 2, itemType = ItemTypes.POT),
            ),
        ),
        environment = Environment(temperatureC = 24f, humidityPercent = 86, measuredAt = 1_756_900_050_000L),
    )

    @Test
    fun `encode and decode round trip`() {
        val json = ContainerSyncCodec.encode(payload)
        val decoded = ContainerSyncCodec.decode(json)
        assertEquals(payload, decoded)
    }

    @Test
    fun `null fields are omitted from json`() {
        val json = ContainerSyncCodec.encode(payload)
        assertFalse(json.contains("\"location\":null"))
        assertTrue(json.contains("\"schemaVersion\":1"))
    }

    @Test
    fun `unknown keys are ignored`() {
        val json = """
            {"schemaVersion":2,"generatedAt":10,"futureField":"x",
             "containers":[{"id":"A","name":"A","containerType":"20ft","loadPercentage":10.0,
               "remainingPercentage":90.0,"totalQuantity":1,"itemCount":1,"status":"完了","updatedAt":1,"extra":true}],
             "cargo":{}}
        """.trimIndent()
        val decoded = ContainerSyncCodec.decode(json)
        assertEquals("A", decoded.containers.single().id)
        assertEquals(emptyList(), decoded.cargoOf("A"))
    }

    @Test
    fun `old payload without pallet fields still decodes`() {
        val json = """
            {"generatedAt":10,"containers":[{"id":"A","name":"A","containerType":"20ft","loadPercentage":10.0,
               "remainingPercentage":90.0,"totalQuantity":1,"itemCount":1,"status":"完了","updatedAt":1}],
             "cargo":{"A":[{"id":"1","name":"x","quantity":3}]}}
        """.trimIndent()
        val decoded = ContainerSyncCodec.decode(json)
        assertEquals(0, decoded.containers.single().totalPallets)
        val item = decoded.cargoOf("A").single()
        assertEquals(0, item.palletCount)
        assertNull(item.itemType)
        assertNull(item.modelName)
        assertNull(decoded.environment)
        assertNull(decoded.containers.single().startedAt)
    }

    @Test
    fun `item type colors match the web app`() {
        assertEquals(0xFF22C55E, ItemTypes.colorOf("ポリカバー").accent)
        assertEquals(0xFFEF4444, ItemTypes.colorOf("鍋").accent)
        assertEquals(ItemTypes.colorOf("その他"), ItemTypes.colorOf(null))
        assertEquals(ItemTypes.colorOf("その他"), ItemTypes.colorOf("不明な種類"))
        assertEquals("その他", ItemTypes.labelOf(null))
        assertEquals("箱", ItemTypes.labelOf("箱"))
    }

    @Test
    fun `broken json decodes to null`() {
        assertNull(ContainerSyncCodec.decodeOrNull("{not json"))
        assertNull(ContainerSyncCodec.decodeOrNull(null))
    }

    @Test
    fun `selected container falls back to first`() {
        assertEquals(container, payload.selectedContainer)
        assertEquals(container, payload.copy(selectedContainerId = "missing").selectedContainer)
        assertNull(payload.copy(containers = emptyList()).selectedContainer)
    }

    @Test
    fun `display format`() {
        assertEquals("72%", DisplayFormat.percent(71.6f))
        assertEquals("100%", DisplayFormat.percent(140f))
        assertEquals("0%", DisplayFormat.percent(-3f))
        assertEquals("1,860", DisplayFormat.quantity(1860))
        assertEquals("--:--", DisplayFormat.time(0))
        assertEquals("1PL 5CT", DisplayFormat.palletCarton(1, 5))
        assertEquals("00:44", DisplayFormat.elapsed(44_000L))
        assertEquals("12:05", DisplayFormat.elapsed(725_000L))
        assertEquals("1:02:03", DisplayFormat.elapsed(3_723_000L))
        assertEquals("00:00", DisplayFormat.elapsed(-5_000L))
        assertEquals("24℃", DisplayFormat.temperature(23.6f))
        assertEquals("0PL 0CT", DisplayFormat.palletCarton(-1, 0))
        val zone = ZoneId.of("Asia/Tokyo")
        // 2025-09-03 09:00 JST
        val millis = 1_756_857_600_000L
        assertEquals("09:00", DisplayFormat.time(millis, zone, today = LocalDate.of(2025, 9, 3)))
        assertEquals("9/3 09:00", DisplayFormat.time(millis, zone, today = LocalDate.of(2025, 9, 4)))
    }
}
