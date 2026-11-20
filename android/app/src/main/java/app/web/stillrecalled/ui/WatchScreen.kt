package app.web.stillrecalled.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.web.stillrecalled.BuildConfig
import app.web.stillrecalled.StillRecalledApp
import app.web.stillrecalled.data.Store
import java.text.DateFormat
import java.util.Date

@Composable
fun WatchScreen(m: AppModel, onAdd: () -> Unit) {
    val list by m.store.watch.collectAsState()
    val live by m.store.live.collectAsState()
    LaunchedEffect(list.count { it.alert != null && !it.alert.optBoolean("seen") }) { if (list.any { it.alert != null && !it.alert.optBoolean("seen") }) m.store.markAlertsSeen() }
    val alerts = list.count { it.alert != null }
    val added = live.optJSONArray("cards")?.length() ?: 0
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(if (alerts > 0) "$alerts watched ${if (alerts == 1) "listing matches" else "listings match"} a new recall" else "Watching for recalls", style = MaterialTheme.typography.displaySmall)
            Muted(buildString {
                append(if (live.has("checkedAt")) "Recall list checked with CPSC ${DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(live.getLong("checkedAt")))}" else "Recall list from this version")
                if (added > 0) append(" · $added ${if (added == 1) "recall" else "recalls"} added since this version")
            })
        }
        if (list.isEmpty()) {
            SectionCard {
                Heading("Nothing watched yet")
                Text("Check a listing you bought or plan to buy, then choose Watch for recalls. When CPSC announces a recall that matches it, you get a notification, even months later.", style = MaterialTheme.typography.bodyMedium)
            }
        } else Column {
            for (w in list.sortedWith(compareByDescending<Store.Watched> { it.alert != null }.thenByDescending { it.addedAt })) {
                HorizontalDivider(color = Ink.border)
                WatchRow(m, w)
            }
            HorizontalDivider(color = Ink.border)
        }
        Secondary("+ Watch something you own", onAdd, Modifier.fillMaxWidth())
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            LinkButton(if (m.refreshing) "Checking with CPSC…" else "↻ Check for new recalls now", { m.refreshNow() })
            m.refreshNote?.let { if (!m.refreshing) Muted(it) }
        }
        Muted("New recalls are fetched from CPSC twice a day. Gemini writes each new notice's field-guide entry once, in the cloud; from then on this phone matches your watched listings against it on its own. A watched listing goes to the cloud only if it could match a new recall.")
    }
}

@Composable
private fun WatchRow(m: AppModel, w: Store.Watched) {
    val ctx = LocalContext.current
    val a = w.alert
    val photo = remember(w.key) { m.store.photoOf(w) }
    Row(Modifier.fillMaxWidth().padding(vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Thumb(w.listing.optString("image"), photo)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(w.listing.optString("title"), style = MaterialTheme.typography.titleSmall, maxLines = 2)
            if (a == null) {
                Muted("Watching since ${DateFormat.getDateInstance().format(Date(w.addedAt))} · no recall yet")
            } else {
                val r = a.getJSONObject("recall")
                val likely = a.optString("level") == "likely"
                Column(Modifier.fillMaxWidth().clip(Control).background(if (likely) Ink.likelyBg else Ink.possibleBg)
                    .border(1.dp, if (likely) androidx.compose.ui.graphics.Color.Transparent else Ink.possibleLine, Control).padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Pill(a.optString("badge").ifEmpty { "Possible recall" }, a.optString("level"))
                    val fg = if (likely) Ink.likelyInk else Ink.possibleInk
                    Text("CPSC recalled the ${r.optString("product")} on ${longDate(r.optString("date"))}. ${r.optString("hazard")}", style = MaterialTheme.typography.bodySmall, color = fg)
                    r.optString("tell").takeIf { it.isNotEmpty() }?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Ink.text) }
                    // What to do with something already in the house.
                    Text(if (likely) "What to do: stop using it, and follow the remedy in the recall notice (often a refund, repair or replacement from the maker)."
                        else "What to do: check its label against the units the notice lists. If it matches, stop using it and follow the notice's remedy.",
                        style = MaterialTheme.typography.bodySmall, color = Ink.text)
                    LinkButton("Read the recall notice ↗", { ctx.open(r.optString("url")) }, fg)
                }
            }
            LinkButton("Stop watching", { m.store.removeWatch(w.key) }, Ink.muted)
        }
    }
}

@Composable
fun AboutScreen(m: AppModel) {
    val ctx = LocalContext.current
    var cloud by remember { mutableStateOf(m.store.cloudCheck) }
    val s = m.settings
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text("How it works", style = MaterialTheme.typography.displaySmall)
        SectionCard {
            Heading("On this phone")
            Text("Every check starts here: the recall list (every CPSC recall since 1973) is matched by the same rules the Chrome extension runs, in a sealed JavaScript sandbox. When the phone has Gemini Nano, the screenshot is read and the listing looked at here too.", style = MaterialTheme.typography.bodyMedium)
        }
        SectionCard(tone = Ink.cloud) {
            Heading("In the cloud")
            Text("A baby product, or a listing that may match, goes to Gemini through Firebase AI Logic, with the full recall notice, to confirm or clear it. Anything else stays on the phone. On a phone without Gemini Nano, the screenshot is read in the cloud too.", style = MaterialTheme.typography.bodyMedium)
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Cloud double-check", style = MaterialTheme.typography.titleSmall)
                Muted("Off: nothing leaves the phone. Flags stand, marked unconfirmed, and the label check can only raise an alarm.")
            }
            Switch(cloud, { cloud = it; m.store.cloudCheck = it }, colors = SwitchDefaults.colors(checkedTrackColor = Ink.primary))
        }
        Column {
            HorizontalDivider(color = Ink.border)
            KeyValue("Gemini Nano", when (m.model) { "available" -> "Ready${if (m.modelName.isNotEmpty()) " (${m.modelName})" else ""}"; "downloadable" -> "Can be downloaded"; "downloading" -> "Downloading"; else -> "Not on this phone" })
            KeyValue("Cloud models", s?.models?.joinToString(", ") ?: "…")
            KeyValue("Settings from", when (s?.from) { "remote" -> "Firebase Remote Config"; "cached" -> "Remote Config (saved)"; "defaults" -> "Built-in defaults"; else -> "…" })
            KeyValue("App Check", (ctx.applicationContext as StillRecalledApp).appCheckMode)
            KeyValue("Version", BuildConfig.VERSION_NAME)
            HorizontalDivider(color = Ink.border)
        }
        Muted("No account, no analytics, no tracking. Removing the app removes everything it kept. It never says a product is safe: no match only means no recall was found.")
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            LinkButton("Privacy ↗", { ctx.open("https://still-recalled.web.app/privacy.html") })
            LinkButton("Source code ↗", { ctx.open("https://github.com/usv240/still-recalled") })
        }
    }
}
