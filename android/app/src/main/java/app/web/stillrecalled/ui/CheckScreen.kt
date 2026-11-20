package app.web.stillrecalled.ui

import android.Manifest
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import app.web.stillrecalled.engine.Checker
import org.json.JSONObject
import java.io.File

@Composable
fun CheckScreen(m: AppModel, s: AppModel.Checking) {
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        LinkButton("← Check another", { m.home() }, Ink.muted)
        val o = m.outcome
        if (o == null) {
            Progress(m, s)
        } else {
            AnimatedVisibility(visible = true, enter = fadeIn(tween(220))) { Result(m, o, s.example) }
        }
        m.error?.let { e ->
            SectionCard(tone = Ink.likelyBg) { Text(e, color = Ink.likelyInk) }
            Secondary("Try again", { m.check(s.photo, s.text, s.example) })
        }
    }
}

@Composable
private fun Progress(m: AppModel, s: AppModel.Checking) {
    SectionCard {
        if (s.photo != null) {
            Image(s.photo.asImageBitmap(), "Your screenshot", contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxWidth().heightIn(max = 280.dp).clip(Control).background(Ink.raised))
        } else Text("“${s.text}”", style = MaterialTheme.typography.titleMedium)
        Gap(4.dp)
        for (st in m.steps) StepRow(st)
    }
}

@Composable
private fun StepRow(st: Checker.Step) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.size(22.dp), contentAlignment = Alignment.Center) {
            when (st.state) {
                Checker.State.ACTIVE -> CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp, color = Ink.text)
                Checker.State.DONE -> Text("✓", color = Ink.text, style = MaterialTheme.typography.titleSmall)
                Checker.State.SKIPPED -> Text("–", color = Ink.muted, style = MaterialTheme.typography.titleSmall)
                Checker.State.WAITING -> Box(Modifier.size(10.dp).border(1.5.dp, Ink.control, Chip))
            }
        }
        Column(Modifier.weight(1f)) {
            Text(st.label, style = MaterialTheme.typography.titleSmall, color = if (st.state == Checker.State.WAITING) Ink.muted else Ink.text)
            if (st.detail.isNotEmpty()) Muted(st.detail)
        }
    }
}

// ---- The result: the extension's card (extension/src/ui/detail.js), for a phone ----------------------------------
@Composable
private fun Result(m: AppModel, o: Checker.Outcome, example: Boolean) {
    val r = o.result
    val ctx = LocalContext.current
    val level = r.optString("level")
    val flagged = level == "likely" || level == "possible"
    // For the item's owner: what to do with it, in place of the question for a seller and the report.
    val owner = if (m.owner) m.ownerInfo else null
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Thumb(null, o.photo, 56.dp)
            Column(Modifier.weight(1f)) {
                Muted(if (example) "Example photo" else "You checked")
                Text(o.listing.optString("title"), style = MaterialTheme.typography.titleMedium, maxLines = 3)
            }
        }

        if (!flagged) {
            NoMatch(r, owner)
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Pill(r.optString("badge"), level)
                Text(r.optString("verdict"), style = MaterialTheme.typography.headlineSmall)
                // What to do, in one line: a flag that only names a product leaves "so can I buy it?" open.
                (owner?.optString("action") ?: r.optString("action")).takeIf { it.isNotEmpty() }?.let {
                    Row(Modifier.height(IntrinsicSize.Min)) {
                        Box(Modifier.width(3.dp).fillMaxHeight().background(if (level == "likely") Ink.likely else Ink.possible))
                        Text(it, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 10.dp))
                    }
                }
                if (r.optBoolean("confirmed") && r.optString("evidence").isNotEmpty()) Text(r.optString("evidence"), style = MaterialTheme.typography.bodyMedium, color = Ink.muted)
                // The listing's words did not name the product: the cloud did, and asked the phone's field guide.
                r.optString("foundBy").takeIf { it.isNotEmpty() }?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = Ink.muted) }
            }
            Photos(r, o)
            if (owner != null) OwnerCard(owner) else BeforeYouBuy(r)
            val recall = r.optJSONObject("recall")
            if (r.optString("kind") == "recall" && recall != null && !recall.optBoolean("all") &&
                ((recall.optJSONArray("codes")?.length() ?: 0) > 0 || recall.optInt("from") > 0)) LabelCheck(m)
            if (owner == null) Report(r)
            if (recall != null) Facts(recall)
            val src = recall?.optString("url") ?: r.optJSONObject("banned")?.optString("source")
            if (!src.isNullOrEmpty()) LinkButton(when {
                recall == null -> "CPSC safe sleep guidance ↗"
                recall.optBoolean("warning") -> "Find warning ${recall.optString("number")} on CPSC's warnings page ↗"
                else -> "Read the CPSC recall notice ↗"
            }, { ctx.open(src) })
        }
        WatchCard(m, o, flagged)
        HowChecked(r, o)
    }
}

@Composable
private fun OwnerCard(owner: JSONObject) {
    SectionCard {
        Heading(owner.optString("heading"))
        val lines = owner.optJSONArray("lines")
        if (lines != null) for (i in 0 until lines.length()) Text(lines.getString(i), style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun NoMatch(r: JSONObject, owner: JSONObject? = null) {
    val ctx = LocalContext.current
    if (owner != null) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Pill("No match found", "none")
            Text(owner.optString("action"), style = MaterialTheme.typography.headlineSmall)
            OwnerCard(owner)
            LinkButton("Search SaferProducts.gov ↗", { ctx.open("https://www.saferproducts.gov/") })
        }
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Pill("No match found", "none")
        Text(if (Regex("part or (a )?toy").containsMatchIn(r.optString("why"))) "This looks like a part or a toy version, not the product itself."
            else "No recall found for what we could read. That doesn't mean it's safe: every CPSC recall notice since 1973 was searched, and only what the listing shows can be matched.", style = MaterialTheme.typography.headlineSmall)
        SectionCard {
            Heading("Before you buy")
            Text("A listing rarely shows the model number, and many recalls cover only some models. Ask the seller for a photo of the label, then search the model number on SaferProducts.gov.", style = MaterialTheme.typography.bodyMedium)
            LinkButton("Search SaferProducts.gov ↗", { ctx.open("https://www.saferproducts.gov/") })
        }
    }
}

@Composable
private fun Photos(r: JSONObject, o: Checker.Outcome) {
    val where = r.optJSONObject("where")
    val recall = r.optJSONObject("recall")
    val photo = o.photo
    if (r.optString("kind") == "recall" && recall != null) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            // A shared link or typed text has no photo: the notice photo alone, at the same size.
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (photo != null) {
                    FramedBitmap(photo, where)
                    Muted(if (where != null) "This listing. Outlined: what the cloud check matched." else "This listing")
                } else {
                    Muted("This is the recalled product. Compare it with the listing's photos.")
                }
            }
            // A CPSC warning comes without a photo: the hazard, in CPSC's words, stands beside the listing instead.
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (recall.optString("image").isNotEmpty()) {
                    FramedUrl(recall.optString("image"), "The photo from the recall notice")
                    Muted("Recall notice")
                } else {
                    Text(recall.optString("hazard").ifEmpty { recall.optString("title") }, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
        val tell = recall.optString("tell")
        if (tell.isNotEmpty() && tell != r.optString("check")) Text(buildAnnotated("Which units: ", tell), style = MaterialTheme.typography.bodyMedium)
    } else if (r.optString("kind") == "banned") {
        val banned = r.optJSONObject("banned")
        if (photo != null) {
            FramedBitmap(photo, where)
            if (where != null) Muted("Outlined by the cloud check: what it saw as ${banned?.optString("name")?.lowercase()}.")
        }
        banned?.optString("risk")?.takeIf { it.isNotEmpty() }?.let { SectionCard(tone = Ink.likelyBg) { Text(it, color = Ink.likelyInk, style = MaterialTheme.typography.bodyMedium) } }
    }
}

@Composable
private fun BeforeYouBuy(r: JSONObject) {
    val ctx = LocalContext.current
    SectionCard {
        Heading("Before you buy")
        val all = r.optJSONObject("recall")?.optBoolean("all") == true
        val check = if (all) "Every unit of this product is recalled, whatever its model number or date. Check that it is this product: the brand and the photos." else r.optString("check").ifEmpty { r.optJSONObject("banned")?.optString("advice") ?: "" }.ifEmpty {
            if (r.optString("kind") == "recall") "Ask for a photo of the label. The model number and manufacture date decide whether this unit is one of the recalled ones."
            else "Check the photos and the description for what the product is. A name in the title is not enough to rule it out."
        }
        Text(check, style = MaterialTheme.typography.bodyMedium)
        Text(r.optString("question"), style = MaterialTheme.typography.bodyMedium, fontStyle = FontStyle.Italic,
            modifier = Modifier.fillMaxWidth().background(Ink.ground, Control).padding(12.dp))
        Primary("Copy and send the question", { ctx.copy("Question for the seller", r.optString("question")); ctx.shareText(r.optString("question"), "Send the question to the seller") }, Modifier.fillMaxWidth())
        Muted("Copies the question and opens Android's share menu. Pick Messenger or the app you found it in, or paste it into the seller chat.")
    }
}

@Composable
private fun LabelCheck(m: AppModel) {
    val ctx = LocalContext.current
    val file = remember { File(ctx.cacheDir, "label.jpg") }
    val uri = remember { FileProvider.getUriForFile(ctx, "${ctx.packageName}.files", file) }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok -> if (ok) ctx.loadBitmap(uri)?.let { m.readLabel(it) } }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { u: Uri? -> u?.let { ctx.loadBitmap(it) }?.let { m.readLabel(it) } }
    SectionCard {
        Heading("Settle it with the label")
        Text("Have the item in front of you, or a photo of its label from the seller? Its model number and date are read and compared with the notice.", style = MaterialTheme.typography.bodyMedium)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Secondary(if (m.labelBusy) "Reading the label…" else "Take a photo", { camera.launch(uri) }, Modifier.weight(1f), enabled = !m.labelBusy)
            Secondary("Choose a photo", { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, Modifier.weight(1f), enabled = !m.labelBusy)
        }
        m.labelError?.let { Muted(it) }
        m.label?.let { l ->
            val tone = l.copy.optString("tone")
            val (bg, fg) = when (tone) { "likely" -> Ink.likelyBg to Ink.likelyInk; "possible" -> Ink.possibleBg to Ink.possibleInk; else -> Ink.raised to Ink.text }
            Column(Modifier.fillMaxWidth().clip(Control).background(bg).padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(l.copy.optString("title"), style = MaterialTheme.typography.titleSmall, color = fg)
                Text(l.copy.optString("text"), style = MaterialTheme.typography.bodySmall, color = fg)
                val read = listOf(l.reading.optString("brand")) + (0 until (l.reading.optJSONArray("model_numbers")?.length() ?: 0)).take(3).map { l.reading.getJSONArray("model_numbers").getString(it) } + listOf(l.reading.optString("manufacture_date"))
                Muted(when (l.source) {
                    "on_device" -> "Read on this phone; the photo did not leave it."
                    "device_then_cloud" -> "Read on this phone, then read again in the cloud before ruling it out."
                    else -> "Read in the cloud."
                } + read.filter { it.isNotEmpty() }.joinToString(" · ").let { if (it.isNotEmpty()) " On the label: $it." else "" })
            }
        }
    }
}

@Composable
private fun Report(r: JSONObject) {
    val ctx = LocalContext.current
    val report = r.optString("report")
    if (report.isEmpty()) return
    SectionCard {
        Heading("Report the listing")
        Text(if (r.optString("kind") == "recall") "CPSC asks shoppers who find a recalled product for sale online to report it at SaferProducts.gov, with the listing's link and a screenshot. Its e-commerce team has such listings taken down."
            else "CPSC's e-commerce team looks for banned products listed for sale and has the listings taken down. You can report this one at SaferProducts.gov.", style = MaterialTheme.typography.bodyMedium)
        Secondary("Report to CPSC", { ctx.copy("Report to CPSC", report); ctx.open("https://www.saferproducts.gov/IncidentReporting") }, Modifier.fillMaxWidth())
        Muted("Copies the report and opens the CPSC form. Paste it into the description.")
    }
}

@Composable
private fun Facts(recall: JSONObject) {
    Column {
        HorizontalDivider(color = Ink.border)
        val warning = recall.optBoolean("warning")
        KeyValue(if (warning) "CPSC warning" else "Recall", recall.optString("number").ifEmpty { recall.optString("id") })
        KeyValue(if (warning) "Warned" else "Recalled", longDate(recall.optString("date")))
        KeyValue("Product", recall.optString("product"))
        recall.optString("hazard").takeIf { it.isNotEmpty() }?.let { KeyValue("Hazard", it) }
        recall.optString("remedy").takeIf { it.isNotEmpty() }?.let { KeyValue(if (warning) "CPSC says" else "Remedy", it) }
        HorizontalDivider(color = Ink.border)
    }
}

/** Recall notices reach the first owner, not the next one: keep checking what was bought. */
@Composable
private fun WatchCard(m: AppModel, o: Checker.Outcome, flagged: Boolean) {
    val list by m.store.watch.collectAsState()
    val key = m.watchKey(o)
    val on = list.any { it.key == key }
    val ctx = LocalContext.current
    var denied by remember { mutableStateOf(false) }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted -> denied = !granted; m.toggleWatch(o) }
    val notesOff = on && (denied || !androidx.core.app.NotificationManagerCompat.from(ctx).areNotificationsEnabled())
    SectionCard {
        Heading(if (flagged) "Bought it anyway, or already own one?" else "Buying it, or already own one?")
        Muted("Recall notices reach the first owner, not the next one. Watch it, and Still Recalled checks it against every new CPSC recall, twice a day, and tells you if one matches. The watch list stays on this phone.")
        if (on) Secondary("✓ Watching for recalls", { m.toggleWatch(o) }, Modifier.fillMaxWidth())
        // Watching without notifications would never reach the user: say so, with the way to turn them on.
        if (notesOff) {
            Text("Alerts are off, so you won't hear about a recall. Turn on notifications for Still Recalled.", style = MaterialTheme.typography.bodyMedium, color = Ink.likelyInk)
            LinkButton("Open notification settings", {
                ctx.startActivity(android.content.Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, ctx.packageName))
            })
        }
        else Primary("Watch for recalls", {
            if (Build.VERSION.SDK_INT >= 33) ask.launch(Manifest.permission.POST_NOTIFICATIONS) else m.toggleWatch(o)
        }, Modifier.fillMaxWidth())
    }
}

/** Where each step ran: the point of hybrid inference, shown rather than claimed. */
@Composable
private fun HowChecked(r: JSONObject, o: Checker.Outcome) {
    val how = r.optJSONObject("how") ?: JSONObject()
    val chips = mutableListOf<Pair<String, Boolean>>()
    when (o.readOnDevice) {
        true -> chips += "Read on this phone · Gemini Nano" to true
        false -> chips += "Read in the cloud" to false
        null -> {}
    }
    when {
        how.optBoolean("device") -> chips += "Looked at on this phone · Gemini Nano" to true
        how.optBoolean("judgedInCloud") -> chips += "Looked at in the cloud" to false
    }
    chips += "Matched against every recall on this phone" to true
    if (how.optString("cloudModel").isNotEmpty()) chips += "Confirmed in the cloud · ${how.optString("cloudModel")}" to false
    if (how.optString("cloudError").isNotEmpty()) chips += "Cloud check couldn't run: phone's answer stands" to false
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("How it was checked", style = MaterialTheme.typography.titleSmall)
        @OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            for ((t, device) in chips) Text(t, style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.clip(Chip).background(if (device) Ink.surface else Ink.cloud).border(1.dp, Ink.border, Chip).padding(horizontal = 10.dp, vertical = 6.dp))
        }
        Muted("Through Firebase AI Logic hybrid inference. It never says a product is safe: no match only means no recall was found.")
    }
}

private fun buildAnnotated(bold: String, rest: String) = androidx.compose.ui.text.buildAnnotatedString {
    pushStyle(androidx.compose.ui.text.SpanStyle(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)); append(bold); pop(); append(rest)
}
