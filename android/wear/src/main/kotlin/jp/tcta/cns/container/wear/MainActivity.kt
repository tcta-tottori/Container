package jp.tcta.cns.container.wear

import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
        // 荷降ろし中に画面が消えないようにする（アプリを開いている間だけ）
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        requestedContainerId = intent?.containerIdExtra()
        setContent {
            WearApp(
                requestedContainerId = requestedContainerId,
                onRequestConsumed = { requestedContainerId = null },
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
}
