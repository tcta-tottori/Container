package jp.tcta.cns.container.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import jp.tcta.cns.container.shared.DisplayFormat
import jp.tcta.cns.container.wear.R

/**
 * 待機画面。
 *
 * 作業中のコンテナが無いとき（未接続・未受信を含む）に出す。
 * 画面の真ん中に再読込ボタンを固定で置き、その下に今の状態を一言で出す。
 * スマホで荷降ろしが始まれば、受信と同時に作業画面へ切り替わる。
 */
@Composable
fun HomeScreen(
    state: ContainerUiState,
    onRefresh: () -> Unit,
) {
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBlack),
        contentAlignment = Alignment.Center,
    ) {
        val w = maxWidth
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(horizontal = 24.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(96.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary)
                    .border(2.dp, MaterialTheme.colorScheme.primaryDim, CircleShape)
                    .pointerInput(Unit) { detectTapGestures(onTap = { onRefresh() }) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = stringResource(R.string.action_refresh),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onPrimary,
                    maxLines = 1,
                )
            }

            Spacer(Modifier.height(10.dp))

            Text(
                text = statusMessage(state),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                maxLines = 2,
                modifier = Modifier.fillMaxWidth(),
            )

            if (state.receivedAt > 0) {
                Text(
                    text = stringResource(R.string.received_at, DisplayFormat.time(state.receivedAt)),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.outline,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }

        TimePill(
            fontSize = (w.value * 0.048f).sp,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = w * 0.035f),
        )
    }
}

/** いま何が起きているかを一言で */
@Composable
private fun statusMessage(state: ContainerUiState): String = when {
    state.refreshing -> stringResource(R.string.status_refreshing)
    state.payload == null -> stringResource(R.string.status_no_data)
    state.phoneConnected == false -> stringResource(R.string.phone_disconnected)
    else -> stringResource(R.string.status_no_work)
}
