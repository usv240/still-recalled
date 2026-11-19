package app.web.stillrecalled.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import org.json.JSONObject

val Card = RoundedCornerShape(10.dp)
val Control = RoundedCornerShape(8.dp)
val Chip = RoundedCornerShape(5.dp)

/** The mark (extension/src/ui/icons.js): a tag with a hole and a stroke, in the warning red. */
private val markTag = androidx.compose.ui.graphics.vector.PathParser().parsePathString("M3 5.5A2.5 2.5 0 0 1 5.5 3h6.1a2.5 2.5 0 0 1 1.77.73l7.4 7.4a2.5 2.5 0 0 1 0 3.54l-6.1 6.1a2.5 2.5 0 0 1-3.54 0l-7.4-7.4A2.5 2.5 0 0 1 3 11.6Z").toPath()

@Composable
fun Mark(size: Dp = 22.dp, hole: Color = Ink.ground) {
    Canvas(Modifier.size(size)) {
        val s = this.size.width / 24f
        scale(s, s, pivot = Offset.Zero) {
            drawPath(markTag, Ink.likely)
            drawCircle(hole, radius = 1.6f, center = Offset(7.6f, 7.6f))
            drawLine(hole, Offset(11.2f, 12.8f), Offset(16.4f, 12.8f), strokeWidth = 1.8f, cap = androidx.compose.ui.graphics.StrokeCap.Round)
        }
    }
}

@Composable
fun Pill(text: String, level: String) {
    val (bg, fg, line) = when (level) {
        "likely" -> Triple(Ink.likelyBg, Ink.likelyInk, Color.Transparent)
        "possible" -> Triple(Ink.possibleBg, Ink.possibleInk, Ink.possibleLine)
        "ok" -> Triple(Color(0xFFEAF6EC), Ink.ok, Color.Transparent)
        else -> Triple(Ink.raised, Ink.text, Color.Transparent)
    }
    Text(text, style = MaterialTheme.typography.labelMedium, color = fg,
        modifier = Modifier.clip(Chip).background(bg).border(1.dp, line, Chip).padding(horizontal = 9.dp, vertical = 4.dp))
}

@Composable
fun SectionCard(modifier: Modifier = Modifier, tone: Color = Ink.surface, content: @Composable () -> Unit) {
    Column(modifier.fillMaxWidth().clip(Card).background(tone).border(1.dp, Ink.border, Card).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
}

@Composable
fun Heading(text: String) = Text(text, style = MaterialTheme.typography.titleMedium)

@Composable
fun Muted(text: String, modifier: Modifier = Modifier) = Text(text, style = MaterialTheme.typography.bodySmall, color = Ink.muted, modifier = modifier)

@Composable
fun Primary(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) =
    Button(onClick, modifier.height(48.dp), enabled = enabled, shape = Control, colors = ButtonDefaults.buttonColors(containerColor = Ink.primary, contentColor = Color.White),
        contentPadding = PaddingValues(horizontal = 18.dp)) { Text(text, style = MaterialTheme.typography.labelLarge) }

@Composable
fun Secondary(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) =
    OutlinedButton(onClick, modifier.height(44.dp), enabled = enabled, shape = Control, border = BorderStroke(1.dp, Ink.control),
        colors = ButtonDefaults.outlinedButtonColors(containerColor = Ink.surface, contentColor = Ink.text), contentPadding = PaddingValues(horizontal = 16.dp)) {
        Text(text, style = MaterialTheme.typography.labelLarge)
    }

@Composable
fun LinkButton(text: String, onClick: () -> Unit, color: Color = Ink.text) =
    TextButton(onClick, contentPadding = PaddingValues(horizontal = 0.dp, vertical = 4.dp)) {
        Text(text, style = MaterialTheme.typography.labelLarge, color = color, fontWeight = FontWeight.Medium)
    }

/** A photo shown whole in a square frame, with an optional outline around `where` ({x, y, w, h} as fractions). */
@Composable
fun FramedBitmap(bitmap: Bitmap, where: JSONObject?, modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier.aspectRatio(1f).clip(Control).background(Ink.raised)) {
        Image(bitmap.asImageBitmap(), contentDescription = "The listing photo", contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
        if (where != null) {
            val shape = bitmap.width.toFloat() / bitmap.height
            val w = if (shape > 1f) 1f else shape
            val h = if (shape > 1f) 1f / shape else 1f
            val left = (1f - w) / 2f; val top = (1f - h) / 2f
            val box = maxWidth
            Box(Modifier
                .offset(box * (left + where.optDouble("x").toFloat() * w), box * (top + where.optDouble("y").toFloat() * h))
                .size(box * (where.optDouble("w").toFloat() * w), box * (where.optDouble("h").toFloat() * h))
                .border(2.5.dp, Ink.likely, RoundedCornerShape(4.dp)))
        }
    }
}

@Composable
fun FramedUrl(url: String, description: String, modifier: Modifier = Modifier) {
    Box(modifier.aspectRatio(1f).clip(Control).background(Ink.raised)) {
        AsyncImage(model = url, contentDescription = description, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
    }
}

@Composable
fun Thumb(url: String?, bitmap: Bitmap? = null, size: Dp = 52.dp) {
    // No photo (a shared link or typed text): no empty box.
    if (bitmap == null && url.isNullOrEmpty()) return
    Box(Modifier.size(size).clip(Control).background(Ink.raised)) {
        if (bitmap != null) Image(bitmap.asImageBitmap(), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        else if (!url.isNullOrEmpty()) AsyncImage(model = url, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
    }
}

@Composable
fun Gap(h: Dp) = Spacer(Modifier.height(h))

@Composable
fun Dot(color: Color, size: Dp = 8.dp) = Box(Modifier.size(size).clip(RoundedCornerShape(50)).background(color))

@Composable
fun KeyValue(k: String, v: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
        Text(k, style = MaterialTheme.typography.bodySmall, color = Ink.muted, modifier = Modifier.width(120.dp))
        Text(v, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
    }
}

// ---- Helpers ---------------------------------------------------------------------------------------------------------
fun Context.copy(label: String, text: String) {
    getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText(label, text))
    if (android.os.Build.VERSION.SDK_INT < 33) Toast.makeText(this, "Copied", Toast.LENGTH_SHORT).show()
}

fun Context.open(url: String) {
    if (!url.startsWith("https://")) return
    try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) {}
}

fun Context.shareText(text: String, title: String) =
    startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), title))

/** A picked or shared image, decoded no larger than about 2048 px on its long side. */
fun Context.loadBitmap(uri: Uri): Bitmap? = try {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 2048) sample *= 2
    contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample }) }
} catch (e: Exception) { null }
