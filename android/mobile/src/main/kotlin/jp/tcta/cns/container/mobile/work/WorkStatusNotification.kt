package jp.tcta.cns.container.mobile.work

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.Icon
import android.os.Build
import jp.tcta.cns.container.mobile.MainActivity
import jp.tcta.cns.container.mobile.R
import jp.tcta.cns.container.shared.CargoItem
import jp.tcta.cns.container.shared.ContainerInfo
import jp.tcta.cns.container.shared.ContainerSyncPayload
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.shared.ItemTypes
import kotlin.math.roundToInt

/** ステータスバーに出す 1 行分の中身 */
data class WorkStatus(
    val containerName: String,
    val title: String,
    val text: String,
    /** ステータスバーの狭い場所に出す短い文字（例 "33%"） */
    val shortText: String,
    /** 進捗（0..100） */
    val progress: Int,
    val accent: Int,
)

/**
 * 荷降ろし中であることを、アプリを閉じているあいだもステータスバーに出す。
 *
 * Android 16 以降は「進行中の通知」をステータスバーの時計の横に小さく出せる
 * （端末によっては時計の中央のカプセルに入る）。それより前の端末では
 * ふつうの進行中通知として通知領域に残る。
 */
object WorkStatusNotification {
    const val CHANNEL_ID = "work_status"
    const val NOTIFICATION_ID = 2001

    /** 荷降ろし中のコンテナが無ければ null（＝出すものが無い） */
    fun statusOf(payload: ContainerSyncPayload): WorkStatus? {
        val container = payload.containers.firstOrNull { it.isWorking() } ?: return null
        val items = payload.cargo[container.id].orEmpty()
        val current = items.firstOrNull { it.status?.contains("作業中") == true }
            ?: items.firstOrNull { (it.status ?: "") != "完了" }
        val done = (100f - container.remainingPercentage).coerceIn(0f, 100f)
        return WorkStatus(
            containerName = container.name,
            title = current?.modelName ?: current?.name ?: container.name,
            text = detailText(current, container),
            shortText = DisplayFormat.percent(done),
            progress = done.roundToInt(),
            accent = accentOf(current),
        )
    }

    fun build(context: Context, status: WorkStatus): Notification {
        ensureChannel(context)
        val builder = Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_container)
            .setLargeIcon(Icon.createWithResource(context, R.mipmap.ic_launcher))
            .setContentTitle(status.title)
            .setContentText(status.text)
            .setSubText(status.containerName)
            .setContentIntent(openApp(context))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setColor(status.accent)
            .setColorized(true)
            .setCategory(Notification.CATEGORY_PROGRESS)
            .setVisibility(Notification.VISIBILITY_PUBLIC)

        if (Build.VERSION.SDK_INT >= 36) {
            // ステータスバーに出しておきたい「進行中」の通知として登録する
            builder.setShortCriticalText(status.shortText)
            builder.setRequestPromotedOngoing(true)
            builder.setStyle(
                Notification.ProgressStyle()
                    .setProgress(status.progress)
                    .setProgressSegments(
                        listOf(
                            Notification.ProgressStyle.Segment(status.progress.coerceAtLeast(1))
                                .setColor(status.accent),
                            Notification.ProgressStyle.Segment((100 - status.progress).coerceAtLeast(1))
                                .setColor(Color.argb(90, 255, 255, 255)),
                        ),
                    ),
            )
        } else {
            builder.setProgress(100, status.progress, false)
        }
        return builder.build()
    }

    fun cancel(context: Context) {
        context.getSystemService(NotificationManager::class.java)?.cancel(NOTIFICATION_ID)
    }

    private fun detailText(item: CargoItem?, container: ContainerInfo): String =
        if (item != null) {
            "${DisplayFormat.palletCarton(item.palletCount, item.cartonCount)}  ${DisplayFormat.quantity(item.quantity)} pcs"
        } else {
            "${DisplayFormat.palletCarton(container.totalPallets, container.totalCartons)}  ${DisplayFormat.quantity(container.totalQuantity)} pcs"
        }

    private fun accentOf(item: CargoItem?): Int = ItemTypes.colorOf(item?.itemType).accent.toInt()

    private fun ensureChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.notify_channel_work),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = context.getString(R.string.notify_channel_work_desc)
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
            },
        )
    }

    /** 押したらアプリに戻る（作業ページのまま再開する） */
    private fun openApp(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    /** 荷降ろしが始まっていて、まだ終わっていないコンテナか（ウォッチ側と同じ見かた） */
    private fun ContainerInfo.isWorking(): Boolean =
        !status.contains("完了") && (startedAt != null || status.contains("中"))
}
