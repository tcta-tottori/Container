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
