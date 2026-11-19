package app.web.stillrecalled.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.web.stillrecalled.R

/** The extension's ledger style (extension/src/ui/ui.css): ink and grey; the only hues are the two warning levels. */
object Ink {
    val ground = Color(0xFFF8F8F8)
    val surface = Color(0xFFFFFFFF)
    val raised = Color(0xFFEEEEEE)
    val border = Color(0xFFE6E6E6)
    val rule = Color(0xFFF0F0F0)
    val control = Color(0xFFD4D4D4)
    val text = Color(0xFF0A0A0A)
    val muted = Color(0xFF5E5E5E)
    val primary = Color(0xFF141414)
    val focus = Color(0xFF1D5FBF)
    val likely = Color(0xFFC4242A); val likelyBg = Color(0xFFFFEDEA); val likelyInk = Color(0xFF831C1E)
    val possible = Color(0xFFB45309); val possibleBg = Color(0xFFFFFBEB); val possibleLine = Color(0xFFFDE68A); val possibleInk = Color(0xFF92400E)
    val ok = Color(0xFF1A7F37)
    val cloud = Color(0xFFEEF1F6)
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
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Ink.primary, onPrimary = Color.White,
            background = Ink.ground, onBackground = Ink.text,
            surface = Ink.ground, onSurface = Ink.text, surfaceContainer = Ink.surface, surfaceContainerLow = Ink.surface,
            surfaceContainerHigh = Ink.surface, surfaceContainerHighest = Ink.raised,
            onSurfaceVariant = Ink.muted, outline = Ink.control, outlineVariant = Ink.border,
            secondaryContainer = Ink.raised, onSecondaryContainer = Ink.text,
            error = Ink.likely,
        ),
        typography = type,
        content = content,
    )
}
