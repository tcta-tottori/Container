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
        return if (h > 0) String.format(Locale.ROOT, "%d:%02d:%02d", h, m, sec)
        else String.format(Locale.ROOT, "%02d:%02d", m, sec)
    }

    /** 気温 "24℃"。小数は四捨五入 */
    fun temperature(celsius: Float): String = "${celsius.roundToInt()}℃"

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
