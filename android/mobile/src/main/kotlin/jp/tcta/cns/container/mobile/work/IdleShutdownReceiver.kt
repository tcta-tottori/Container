package jp.tcta.cns.container.mobile.work

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Process
import android.os.SystemClock
import android.util.Log
import kotlin.system.exitProcess

/**
 * 裏に回ったまま長く放っておかれたアプリを終わらせる。
 *
 * 画面を閉じた時刻から [IDLE_SHUTDOWN_MS] 後に鳴るよう仕掛けておき、
 * 鳴った時点でまだ裏にいたらステータスバーの表示を消してアプリごと終了する。
 * 前面に戻ったときは仕掛けを外す。
 *
 * Doze 中でも鳴るよう `setAndAllowWhileIdle` を使う。時刻の精度は端末任せなので、
 * 「だいたい 20 分後」の扱いになる。
 */
class IdleShutdownReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_SHUTDOWN) return
        // 仕掛けたあとに前面へ戻っていたら何もしない
        if (foreground) {
            Log.d(TAG, "前面に戻っているので終了しない")
            return
        }
        Log.i(TAG, "裏のまま ${IDLE_SHUTDOWN_MS / 60_000} 分たったので終了する")
        WorkStatusService.stop(context)
        // 残っている通知やサービスごと片付ける
        Process.killProcess(Process.myPid())
        exitProcess(0)
    }

    companion object {
        private const val TAG = "IdleShutdown"
        private const val ACTION_SHUTDOWN = "jp.tcta.cns.container.IDLE_SHUTDOWN"
        private const val REQUEST_CODE = 3001

        /** 裏に回ったままこれだけ経ったら終了する */
        const val IDLE_SHUTDOWN_MS = 20L * 60L * 1000L

        /** アプリが前面にあるか。裏に回るときだけ仕掛けたいので、ここで見ておく */
        @Volatile
        private var foreground = true

        /** 裏に回った。[IDLE_SHUTDOWN_MS] 後に終了するよう仕掛ける */
        fun scheduleOnBackground(context: Context) {
            foreground = false
            val manager = context.getSystemService(AlarmManager::class.java) ?: return
            val at = SystemClock.elapsedRealtime() + IDLE_SHUTDOWN_MS
            runCatching {
                manager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pendingIntent(context))
            }.onFailure { Log.w(TAG, "終了の仕掛けを置けませんでした", it) }
        }

        /** 前面に戻った。仕掛けを外す */
        fun cancelOnForeground(context: Context) {
            foreground = true
            val manager = context.getSystemService(AlarmManager::class.java) ?: return
            runCatching { manager.cancel(pendingIntent(context)) }
        }

        private fun pendingIntent(context: Context): PendingIntent {
            val intent = Intent(context, IdleShutdownReceiver::class.java).setAction(ACTION_SHUTDOWN)
            return PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }
}
