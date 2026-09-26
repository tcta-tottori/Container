package jp.tcta.cns.container.wear.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material3.ColorScheme
import androidx.wear.compose.material3.MaterialTheme

/** 参考デザインの色: 黒地に緑のリング、警告はオレンジ、湿度は青 */
object WearColors {
    val Green = Color(0xFF22C55E)
    val GreenDim = Color(0xFF16A34A)
    val Orange = Color(0xFFF97316)
    val Blue = Color(0xFF3B82F6)
    val TextDim = Color(0xFFB4B8BE)
}

private val ContainerColorScheme = ColorScheme(
    primary = WearColors.Green,
    primaryDim = WearColors.GreenDim,
    primaryContainer = Color(0xFF14532D),
    onPrimary = Color.Black,
    onPrimaryContainer = Color(0xFFBBF7D0),
    secondary = WearColors.Orange,
    secondaryDim = Color(0xFFEA580C),
    secondaryContainer = Color(0xFF431407),
    onSecondary = Color.Black,
    onSecondaryContainer = Color(0xFFFED7AA),
    tertiary = WearColors.Blue,
    tertiaryDim = Color(0xFF2563EB),
    tertiaryContainer = Color(0xFF1E3A8A),
    onTertiary = Color.Black,
    onTertiaryContainer = Color(0xFFBFDBFE),
    surfaceContainerLow = Color(0xFF0E1013),
    surfaceContainer = Color(0xFF16191E),
    surfaceContainerHigh = Color(0xFF23272E),
    onSurface = Color.White,
    onSurfaceVariant = WearColors.TextDim,
    outline = Color(0xFF3A3F47),
    outlineVariant = Color(0xFF2A2E35),
    background = Color.Black,
    onBackground = Color.White,
)

@Composable
fun ContainerWearTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = ContainerColorScheme, content = content)
}
