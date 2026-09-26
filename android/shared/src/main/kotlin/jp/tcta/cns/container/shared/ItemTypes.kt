package jp.tcta.cns.container.shared

/**
 * 品目の種類と、その色。
 * 元のコンテナアプリ（`src/data/colorMap.ts`）と同じ値にしてある。
 *
 * - [accent] バッジの点・線・強調文字（濃い画面向け）
 * - [background] / [text] 明るい画面でのバッジ背景・文字
 */
data class ItemTypeColor(
    val accent: Long,
    val background: Long,
    val text: Long,
)

object ItemTypes {
    const val POLY_COVER = "ポリカバー"
    const val JAR_POT = "ジャーポット"
    const val BOX = "箱"
    const val PARTS = "部品"
    const val POT = "鍋"
    const val YAMAN_PARTS = "ヤーマン部品"
    const val OTHER = "その他"

    private val colors: Map<String, ItemTypeColor> = mapOf(
        POLY_COVER to ItemTypeColor(accent = 0xFF22C55E, background = 0xFFF0FDF4, text = 0xFF166534),
        JAR_POT to ItemTypeColor(accent = 0xFFEC4899, background = 0xFFFDF2F8, text = 0xFF9D174D),
        BOX to ItemTypeColor(accent = 0xFFF97316, background = 0xFFFFF7ED, text = 0xFF9A3412),
        PARTS to ItemTypeColor(accent = 0xFF8B5CF6, background = 0xFFFAF5FF, text = 0xFF6B21A8),
        POT to ItemTypeColor(accent = 0xFFEF4444, background = 0xFFFEF2F2, text = 0xFF991B1B),
        YAMAN_PARTS to ItemTypeColor(accent = 0xFFEAB308, background = 0xFFFEFCE8, text = 0xFF854D0E),
        OTHER to ItemTypeColor(accent = 0xFF6B7280, background = 0xFFF9FAFB, text = 0xFF374151),
    )

    /** 種類名から色を引く。未知・null は「その他」の色 */
    fun colorOf(itemType: String?): ItemTypeColor = colors[itemType] ?: colors.getValue(OTHER)

    /** 画面に出す種類名。null は「その他」 */
    fun labelOf(itemType: String?): String = if (itemType != null && colors.containsKey(itemType)) itemType else OTHER
}
