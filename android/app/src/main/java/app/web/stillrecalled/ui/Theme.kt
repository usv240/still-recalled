package app.web.stillrecalled.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.web.stillrecalled.R

/**
 * The extension's ledger style (extension/src/ui/ui.css): ink and grey; the only hues are the two warning levels.
 * Light and dark come from the system setting (StillRecalledTheme sets [dark]); every colour is read through a getter,
 * so a screen recomposes in the other palette without any code of its own. The verdict hues keep their meaning in both:
 * red for a recall that matches, amber for one to check, and each always has words beside it.
 */
object Ink {
    var dark by mutableStateOf(false)
    private fun c(light: Long, night: Long) = Color(if (dark) night else light)
    val ground get() = c(0xFFF8F8F8, 0xFF0E0E0F)
    val surface get() = c(0xFFFFFFFF, 0xFF18181A)
    val raised get() = c(0xFFEEEEEE, 0xFF252528)
    val border get() = c(0xFFE6E6E6, 0xFF2E2E32)
    val rule get() = c(0xFFF0F0F0, 0xFF222225)
    val control get() = c(0xFFD4D4D4, 0xFF46464B)
    val text get() = c(0xFF0A0A0A, 0xFFEDEDED)
    val muted get() = c(0xFF5E5E5E, 0xFFA8A8AD)          // 6.3:1 on white; 7.4:1 on the dark surface
    val primary get() = c(0xFF141414, 0xFFEDEDED)
    val onPrimary get() = c(0xFFFFFFFF, 0xFF0E0E0F)
    val focus get() = c(0xFF1D5FBF, 0xFF7EB0FF)
    val likely get() = c(0xFFC4242A, 0xFFF0606A)
    val likelyBg get() = c(0xFFFFEDEA, 0xFF3A1719)
    val likelyInk get() = c(0xFF831C1E, 0xFFFFB8B2)
    val possible get() = c(0xFFB45309, 0xFFE8A04A)
    val possibleBg get() = c(0xFFFFFBEB, 0xFF2E2411)
    val possibleLine get() = c(0xFFFDE68A, 0xFF6A4F16)
    val possibleInk get() = c(0xFF92400E, 0xFFF6CD7A)
    val ok get() = c(0xFF1A7F37, 0xFF5CCB7B)
    val okBg get() = c(0xFFEAF6EC, 0xFF14281A)
    val cloud get() = c(0xFFEEF1F6, 0xFF1C2230)
}

@OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
private fun geist(w: Int) = Font(R.font.geist, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
val Geist = FontFamily(geist(400), geist(500), geist(600), geist(700))

private val type = Typography(
    displaySmall = TextStyle(fontFamily = Geist, fontWeight = FontWeight(650), fontSize = 32.sp, lineHeight = 36.sp, letterSpacing = (-0.6).sp),
    headlineSmall = TextStyle(fontFamily = Geist, fontWeight = FontWeight.SemiBold, fontSize = 22.sp, lineHeight = 28.sp, letterSpacing = (-0.2).sp),
    titleLarge = TextStyle(fontFamily = Geist, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 24.sp),
    titleMedium = TextStyle(fontFamily = Geist, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp),
    titleSmall = TextStyle(fontFamily = Geist, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = Geist, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = Geist, fontSize = 15.sp, lineHeight = 22.sp),
    bodySmall = TextStyle(fontFamily = Geist, fontSize = 13.sp, lineHeight = 19.sp),
    labelLarge = TextStyle(fontFamily = Geist, fontWeight = FontWeight.Medium, fontSize = 15.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = Geist, fontWeight = FontWeight.Medium, fontSize = 13.sp, lineHeight = 16.sp),
    labelSmall = TextStyle(fontFamily = Geist, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp),
)

@Composable
fun StillRecalledTheme(content: @Composable () -> Unit) {
    val night = isSystemInDarkTheme()
    // Set before the first read below, so this frame already draws in the right palette.
    if (Ink.dark != night) Ink.dark = night
    val scheme = if (night) darkColorScheme(
        primary = Ink.primary, onPrimary = Ink.onPrimary,
        background = Ink.ground, onBackground = Ink.text,
        surface = Ink.ground, onSurface = Ink.text, surfaceContainer = Ink.surface, surfaceContainerLow = Ink.surface,
        surfaceContainerHigh = Ink.surface, surfaceContainerHighest = Ink.raised,
        onSurfaceVariant = Ink.muted, outline = Ink.control, outlineVariant = Ink.border,
        secondaryContainer = Ink.raised, onSecondaryContainer = Ink.text,
        error = Ink.likely,
    ) else lightColorScheme(
        primary = Ink.primary, onPrimary = Ink.onPrimary,
        background = Ink.ground, onBackground = Ink.text,
        surface = Ink.ground, onSurface = Ink.text, surfaceContainer = Ink.surface, surfaceContainerLow = Ink.surface,
        surfaceContainerHigh = Ink.surface, surfaceContainerHighest = Ink.raised,
        onSurfaceVariant = Ink.muted, outline = Ink.control, outlineVariant = Ink.border,
        secondaryContainer = Ink.raised, onSecondaryContainer = Ink.text,
        error = Ink.likely,
    )
    MaterialTheme(colorScheme = scheme, typography = type, content = content)
}
