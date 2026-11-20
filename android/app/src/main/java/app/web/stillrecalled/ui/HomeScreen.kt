package app.web.stillrecalled.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Composable
fun HomeScreen(m: AppModel) {
    val ctx = LocalContext.current
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri?.let { ctx.loadBitmap(it) }?.let { m.check(it, null) }
    }
    var typed by rememberSaveable { mutableStateOf("") }

    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Check a secondhand listing before you buy it", style = MaterialTheme.typography.displaySmall)
            Text("Share a listing or a screenshot from Facebook Marketplace, OfferUp, eBay or any app to Still Recalled. It's checked against every U.S. CPSC recall since 1973 and the infant sleep products linked to deaths.",
                style = MaterialTheme.typography.bodyLarge, color = Ink.muted)
        }

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Primary("Choose a screenshot", { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, Modifier.fillMaxWidth())
            OutlinedTextField(
                value = typed, onValueChange = { typed = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
                label = { Text("Or type what it is") }, placeholder = { Text("Fisher-Price Rock 'n Play") },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { if (typed.isNotBlank()) m.check(null, typed) }),
                shape = Control, colors = OutlinedTextFieldDefaults.colors(focusedContainerColor = Ink.surface, unfocusedContainerColor = Ink.surface, focusedBorderColor = Ink.primary),
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                LinkButton("Try it with an example photo", { m.checkExample() })
                Muted("  a made-up listing")
            }
        }

        m.shareNote?.let { note ->
            SectionCard(tone = Ink.possibleBg) {
                Text(note, style = MaterialTheme.typography.bodyMedium, color = Ink.possibleInk)
                LinkButton("OK", { m.dismissShareNote() }, Ink.possibleInk)
            }
        }

        ModelCard(m)

        if (m.engine != "starting" && m.engine != "ready") SectionCard(tone = Ink.likelyBg) { Text(m.engine, color = Ink.likelyInk) }

        RecentList(m)
        DataLine(m)
    }
}

/** Whether this phone has Gemini Nano, with a download when it can get it. */
@Composable
fun ModelCard(m: AppModel) {
    SectionCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Dot(when (m.model) { "available" -> Ink.ok; "downloadable", "downloading" -> Ink.possible; else -> Ink.control })
            Text(when (m.model) {
                "available" -> "Gemini Nano is ready on this phone"
                "downloadable" -> "Gemini Nano can run on this phone"
                "downloading" -> "Gemini Nano is downloading"
                "checking" -> "Checking for Gemini Nano…"
                else -> "This phone has no on-device model"
            }, style = MaterialTheme.typography.titleSmall)
        }
        Muted(when (m.model) {
            "available" -> "Screenshots and listings are read and looked at on this phone${if (m.modelName.isNotEmpty()) " (${m.modelName})" else ""}. A baby product, or a possible match, then goes to the cloud for a closer look, with the recall notice."
            "downloadable", "downloading" -> "Download it once and screenshots are read on this phone, privately and at no cost. Until then they're read by Gemini in the cloud."
            "checking" -> ""
            else -> "Firebase AI Logic runs the same check on Gemini in the cloud instead. On a phone with Gemini Nano, it runs here."
        })
        if (m.model == "downloadable" && m.download == null) Secondary("Download Gemini Nano", { m.startDownload() })
        m.download?.let { p ->
            LinearProgressIndicator(progress = { p }, modifier = Modifier.fillMaxWidth(), color = Ink.text, trackColor = Ink.raised)
            Muted("Downloading ${(p * 100).toInt()}%")
        }
    }
}

@Composable
private fun RecentList(m: AppModel) {
    val ctx = LocalContext.current
    if (m.recent.length() == 0) return
    Column {
        Text("Recently recalled baby products", style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(bottom = 8.dp))
        for (i in 0 until m.recent.length()) {
            val c = m.recent.getJSONObject(i)
            HorizontalDivider(color = Ink.border)
            Row(Modifier.fillMaxWidth().clickable { ctx.open(c.optString("url")) }.padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Thumb(c.optString("image"))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(c.optString("product"), style = MaterialTheme.typography.titleSmall, maxLines = 2)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Muted("Recalled ${longDate(c.optString("date"))}")
                        if (c.optBoolean("live")) Text("New since this version", style = MaterialTheme.typography.labelSmall, color = Ink.likelyInk,
                            modifier = Modifier.background(Ink.likelyBg, Chip).padding(horizontal = 6.dp, vertical = 2.dp))
                    }
                }
            }
        }
        HorizontalDivider(color = Ink.border)
    }
}

@Composable
private fun DataLine(m: AppModel) {
    val live by m.store.live.collectAsState()
    val bundled: Int = app.web.stillrecalled.engine.Rules.cardCount.let { if (it > 0) it else 10089 }
    val added = live.optJSONArray("cards")?.length() ?: 0
    Muted(buildString {
        append("Recall data: U.S. Consumer Product Safety Commission, ${"%,d".format(bundled + added)} notices since 1973")
        if (live.has("checkedAt")) append(", checked with CPSC ${java.text.DateFormat.getDateInstance().format(java.util.Date(live.getLong("checkedAt")))}")
        if (added > 0) append(" ($added added since this version)")
        append(".")
    })
}

fun longDate(iso: String): String = try { LocalDate.parse(iso).format(DateTimeFormatter.ofPattern("MMMM d, yyyy")) } catch (e: Exception) { iso }
