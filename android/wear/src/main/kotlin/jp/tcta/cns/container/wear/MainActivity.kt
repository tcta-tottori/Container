package jp.tcta.cns.container.wear

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import jp.tcta.cns.container.shared.DataLayerContract
import jp.tcta.cns.container.wear.ui.WearApp

class MainActivity : ComponentActivity() {
    /** Tile から渡されたコンテナ ID。そのコンテナの作業画面を直接開くのに使う */
    private var requestedContainerId by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestedContainerId = intent?.containerIdExtra()
        askNotificationPermission()
        setContent {
            WearApp(
                requestedContainerId = requestedContainerId,
                onRequestConsumed = { requestedContainerId = null },
                // 作業画面のあいだだけ画面を消さない。待機画面はふだんどおり消える
                onKeepScreenOn = { keep ->
                    if (keep) {
                        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    } else {
                        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    }
                },
            )
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        requestedContainerId = intent.containerIdExtra()
    }

    private fun Intent.containerIdExtra(): String? =
        getStringExtra(DataLayerContract.EXTRA_CONTAINER_ID)?.takeIf { it.isNotBlank() }

    /** スマホが作業ページを開いたことを知らせるための許可。断られてもアプリはそのまま使える */
    private val notificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    private fun askNotificationPermission() {
        val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
}
