package jp.tcta.cns.container.wear.notify

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import jp.tcta.cns.container.shared.ContainerInfo
import jp.tcta.cns.container.shared.ContainerSyncPayload
import jp.tcta.cns.container.shared.DataLayerContract
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.wear.MainActivity
import jp.tcta.cns.container.wear.R

/**
 * スマホが作業ページを開いたことをウォッチで知らせる。
 *
 * スマホから届いた内容に荷降ろし中のコンテナがあれば、消えない通知をひとつ出す。
 * その通知を押すと、そのコンテナの作業画面が直接開く。
 * 荷降ろし中のコンテナが無くなったら通知は消す。
 */
object WorkNotifier {
    private const val TAG = "WorkNotifier"
    private const val CHANNEL_ID = "container_work"
    private const val NOTIFICATION_ID = 1001

    /** 直前に知らせたコンテナ。同じコンテナのあいだは音や振動を出さずに中身だけ差し替える */
    @Volatile
    private var notifiedContainerId: String? = null

    /**
     * 受信内容に合わせて通知を出し直す。
     * @return 通知を出したら true、消したり出せなかったら false
     */
    fun update(context: Context, payload: ContainerSyncPayload): Boolean {
        val container = payload.containers.firstOrNull { it.isWorking() }
        if (container == null) {
            cancel(context)
            return false
        }
        if (!hasPermission(context)) {
            Log.d(TAG, "通知の許可がないので出さない")
            return false
        }

        val items = payload.cargo[container.id].orEmpty()
        val current = items.firstOrNull { it.status?.contains("作業中") == true }
            ?: items.firstOrNull { (it.status ?: "") != "完了" }
        val title = current?.modelName ?: current?.name ?: container.name
        val text = buildString {
            if (current != null) {
                append(DisplayFormat.palletCarton(current.palletCount, current.cartonCount))
            } else {
                append(DisplayFormat.palletCarton(container.totalPallets, container.totalCartons))
            }
            append("  残 ")
            append(DisplayFormat.percent(container.remainingPercentage))
        }

        val first = notifiedContainerId != container.id
        ensureChannel(context)
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_cube)
            .setContentTitle(title)
            .setContentText(text)
            .setSubText(container.name)
            .setContentIntent(openWorkScreen(context, container.id))
            .setCategory(Notification.CATEGORY_PROGRESS)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            // 作業が始まったときだけ知らせる。そのあとの数の変化は静かに差し替える
            .setPriority(if (first) NotificationCompat.PRIORITY_DEFAULT else NotificationCompat.PRIORITY_LOW)
            .setSilent(!first)
            .build()

        return try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
            notifiedContainerId = container.id
            true
        } catch (e: SecurityException) {
            Log.w(TAG, "通知を出せませんでした", e)
            false
        }
    }

    /** 通知を消す */
    fun cancel(context: Context) {
        notifiedContainerId = null
        runCatching { NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID) }
    }

    private fun hasPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    private fun ensureChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.notify_channel_work),
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = context.getString(R.string.notify_channel_work_desc)
                setShowBadge(false)
            },
        )
    }

    /** 押したときにそのコンテナの作業画面を開く */
    private fun openWorkScreen(context: Context, containerId: String): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(DataLayerContract.EXTRA_CONTAINER_ID, containerId)
        }
        return PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    /** 荷降ろしが始まっていて、まだ終わっていないコンテナか（WearApp と同じ見かた） */
    private fun ContainerInfo.isWorking(): Boolean =
        !status.contains("完了") && (startedAt != null || status.contains("中"))
}
