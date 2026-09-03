package jp.tcta.cns.container.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import jp.tcta.cns.container.mobile.ui.MobileScreen
import jp.tcta.cns.container.mobile.ui.MobileViewModel
import jp.tcta.cns.container.mobile.ui.theme.ContainerSyncTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            ContainerSyncTheme {
                val viewModel: MobileViewModel = viewModel()
                val state by viewModel.uiState.collectAsStateWithLifecycle()
                MobileScreen(
                    state = state,
                    onSelectContainer = viewModel::selectContainer,
                    onSend = viewModel::syncToWatch,
                    onReload = viewModel::reload,
                )
            }
        }
    }
}
