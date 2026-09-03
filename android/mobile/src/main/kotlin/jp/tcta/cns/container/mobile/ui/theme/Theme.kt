package jp.tcta.cns.container.mobile.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Navy = Color(0xFF0B3C5D)
private val Orange = Color(0xFFF4A261)

private val LightColors = lightColorScheme(
    primary = Navy,
    secondary = Orange,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF9CC9F5),
    secondary = Orange,
)

@Composable
fun ContainerSyncTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
