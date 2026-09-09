package jp.tcta.cns.container.shared

import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

/** 画面表示用の整形。スマホ・ウォッチで同じ見た目にする。 */
object DisplayFormat {
    private val timeOnly: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm", Locale.JAPAN)
    private val dateTime: DateTimeFormatter = DateTimeFormatter.ofPattern("M/d HH:mm", Locale.JAPAN)

    /** 0..100 に丸めて "72%" の形にする */
    fun percent(value: Float): String = "${value.coerceIn(0f, 100f).roundToInt()}%"

    /** 桁区切り付きの整数 "1,860" */
    fun quantity(value: Int): String = NumberFormat.getIntegerInstance(Locale.JAPAN).format(value)

    /** 経過時間。1 時間未満は "mm:ss"、以上は "h:mm:ss"。負の値は 0 扱い */
    fun elapsed(millis: Long): String {
        val total = (millis / 1000L).coerceAtLeast(0L)
        val h = total / 3600L
        val m = (total % 3600L) / 60L
        val sec = total % 60L
        return if (h > 0) String.format(Locale.ROOT, "%02d:%02d:%02d", h, m, sec)
        else String.format(Locale.ROOT, "%02d:%02d", m, sec)
    }

    /** 気温 "24℃"。小数は四捨五入 */
    fun temperature(celsius: Float): String = "${celsius.roundToInt()}℃"

    /**
     * 重さ。1t 以上は "3.2t"、10kg 以上は "126kg"、それ未満は "8.5kg"。
     * 0 以下（不明）は "—"。
     */
    fun weight(kg: Float): String = when {
        kg <= 0f -> "—"
        kg >= 1000f -> String.format(Locale.ROOT, "%.1ft", kg / 1000f)
        kg >= 10f -> "${kg.roundToInt()}kg"
        else -> String.format(Locale.ROOT, "%.1fkg", kg)
    }

    /**
     * かさ（体積）。大きいほど桁を落とす（"24m³" / "2.4m³" / "0.152m³"）。
     * 0 以下（不明）は "—"。
     */
    fun volume(cubicMeters: Float): String = when {
        cubicMeters <= 0f -> "—"
        cubicMeters >= 100f -> String.format(Locale.ROOT, "%.0fm³", cubicMeters)
        cubicMeters >= 10f -> String.format(Locale.ROOT, "%.1fm³", cubicMeters)
        cubicMeters >= 1f -> String.format(Locale.ROOT, "%.2fm³", cubicMeters)
        else -> String.format(Locale.ROOT, "%.3fm³", cubicMeters)
    }

    /**
     * 外寸 "55*38*38" を "55×38×38" にする。
     * 読めなければ元の文字をそのまま、無ければ "—"。
     */
    fun dimensions(measurements: String?): String {
        if (measurements.isNullOrBlank()) return "—"
        val d = PalletLayout.parseMeasurements(measurements) ?: return measurements
        return "${trimZero(d.first)}×${trimZero(d.second)}×${trimZero(d.third)}"
    }

    /** 小数が要らない数は整数で出す（38.0 → "38"、37.5 → "37.5"） */
    private fun trimZero(value: Float): String =
        if (value == value.roundToInt().toFloat()) value.roundToInt().toString()
        else String.format(Locale.ROOT, "%.1f", value)

    /** パレットと端数カートンを "1PL 5CT" の形にする。どちらも常に出す */
    fun palletCarton(pallets: Int, cartons: Int): String =
        "${pallets.coerceAtLeast(0)}PL ${cartons.coerceAtLeast(0)}CT"

    /**
     * 時刻表示。今日なら "HH:mm"、それ以外は "M/d HH:mm"。
     * 0 以下（未設定）は "--:--"。
     */
    fun time(
        epochMillis: Long,
        zone: ZoneId = ZoneId.systemDefault(),
        today: LocalDate = LocalDate.now(zone),
    ): String {
        if (epochMillis <= 0L) return "--:--"
        val dt = Instant.ofEpochMilli(epochMillis).atZone(zone)
        return if (dt.toLocalDate() == today) timeOnly.format(dt) else dateTime.format(dt)
    }
}
