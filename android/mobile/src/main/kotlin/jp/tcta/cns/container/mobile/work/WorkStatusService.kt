package jp.tcta.cns.container.mobile.work

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import jp.tcta.cns.container.shared.ContainerSyncCodec
import jp.tcta.cns.container.shared.ContainerSyncPayload

/**
 * 荷降ろし中のあいだ、ステータスバーに作業中の表示を出しておくためのサービス。
 *
 * アプリを閉じて（バックグラウンドにして）も表示が残るよう、フォアグラウンドサービスにしている。
 * 表示する中身は CNS（WebView）から届く同期内容そのままなので、
 * 品目を切り替えたりパレットを減らしたりすると、その場で書き換わる。
 */
class WorkStatusService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val status = ContainerSyncCodec.decodeOrNull(intent?.getStringExtra(EXTRA_PAYLOAD))
            ?.let { WorkStatusNotification.statusOf(it) }
        if (status == null) {
            stopAndRemove()
            return START_NOT_STICKY
        }
        val notification = WorkStatusNotification.build(this, status)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    WorkStatusNotification.NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
                )
            } else {
                startForeground(WorkStatusNotification.NOTIFICATION_ID, notification)
            }
            running = true
        } catch (e: Exception) {
            // 通知の許可が無いときなど。表示できなくてもアプリ本体は動かし続ける
            Log.w(TAG, "ステータスバー表示を出せませんでした", e)
            stopAndRemove()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        running = false
        WorkStatusNotification.cancel(this)
        super.onDestroy()
    }

    private fun stopAndRemove() {
        running = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }

    companion object {
        private const val TAG = "WorkStatusService"
        private const val EXTRA_PAYLOAD = "payload"

        /** サービスが動いているか。動いていれば通知を書き換えるだけでよい */
        @Volatile
        private var running = false

        /**
         * 受信した同期内容に合わせてステータスバーの表示を出し直す。
         * 荷降ろし中のコンテナが無ければ表示を消す。
         *
         * @param canStart アプリが前面にあるか。Android 12 以降、裏からはサービスを始められない
         */
        fun update(context: Context, payload: ContainerSyncPayload, json: String, canStart: Boolean) {
            val status = WorkStatusNotification.statusOf(payload)
            if (status == null) {
                stop(context)
                return
            }
            if (running) {
                // すでに出ているので、中身だけ差し替える（裏にいてもこれはできる）
                runCatching {
                    context.getSystemService(NotificationManager::class.java)
                        ?.notify(WorkStatusNotification.NOTIFICATION_ID, WorkStatusNotification.build(context, status))
                }.onFailure { Log.w(TAG, "表示を書き換えられませんでした", it) }
                return
            }
            if (!canStart) return
            val intent = Intent(context, WorkStatusService::class.java).putExtra(EXTRA_PAYLOAD, json)
            runCatching { context.startForegroundService(intent) }
                .onFailure { Log.w(TAG, "サービスを開始できませんでした", it) }
        }

        /** 表示を消してサービスも止める */
        fun stop(context: Context) {
            runCatching { context.stopService(Intent(context, WorkStatusService::class.java)) }
            WorkStatusNotification.cancel(context)
        }
    }
}
