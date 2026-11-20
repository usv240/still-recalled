package app.web.stillrecalled

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.IntentCompat
import app.web.stillrecalled.ui.AboutScreen
import app.web.stillrecalled.ui.AppModel
import app.web.stillrecalled.ui.CheckScreen
import app.web.stillrecalled.ui.HomeScreen
import app.web.stillrecalled.ui.Icons
import app.web.stillrecalled.ui.Ink
import app.web.stillrecalled.ui.Mark
import app.web.stillrecalled.ui.StillRecalledTheme
import app.web.stillrecalled.ui.WatchScreen
import app.web.stillrecalled.ui.loadBitmap

class MainActivity : ComponentActivity() {
    private val model: AppModel by viewModels()
    private var tab by mutableStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) handle(intent)
        setContent { StillRecalledTheme { App(model, tab) { tab = it } } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    /** From Android's share menu: a screenshot, a photo, or a listing's link and title from another app. */
    private fun handle(intent: Intent?) {
        intent ?: return
        if (intent.getBooleanExtra(OPEN_WATCH, false)) { tab = 1; return }
        // Testing only, in debug builds: replay the arrival of the recalls published since the build.
        if (BuildConfig.DEBUG && intent.getBooleanExtra("dev_forget_live", false)) model.forgetLive()
        if (intent.action != Intent.ACTION_SEND) return
        val type = intent.type ?: ""
        if (type.startsWith("image/")) {
            val uri = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java) ?: return
            loadBitmap(uri)?.let { tab = 0; model.check(it, null) }
        } else {
            val text = listOfNotNull(intent.getStringExtra(Intent.EXTRA_SUBJECT), intent.getStringExtra(Intent.EXTRA_TEXT)).joinToString(" ").trim()
            // Marketplace apps often share only a link, or a stock line around it ("Check out this item on
            // Marketplace"). Neither says what the product is, and the app can't open a Facebook link, so checking
            // it would only ever say "no match". Ask for a screenshot instead.
            val words = productWords(text)
            tab = 0
            if (words.split(' ').count { it.length > 2 } >= 2) model.check(null, words)
            else model.shareOnlyLink()
        }
    }

    companion object {
        const val OPEN_WATCH = "open_watch"
        private val STOCK = Regex("""(?i)\b(check out|look at|see|i found)\s+(this|what i found)?\s*(item|listing|post)?\s*(on|at|from)?\s*(facebook\s+)?(marketplace|offerup|ebay|mercari|craigslist|nextdoor)\b[:!.,]*|\b(shared|sent)\s+(from|via)\s+\S+""")

        /** What a shared text says about the product: without links and the apps' stock share lines. */
        fun productWords(text: String) = text.replace(Regex("""https?://\S+"""), " ").replace(STOCK, " ").replace(Regex("""\s+"""), " ").trim()
    }
}

@Composable
private fun App(m: AppModel, tab: Int, setTab: (Int) -> Unit) {
    val watch by m.store.watch.collectAsState()
    val unseen = watch.any { it.alert != null && !it.alert.optBoolean("seen") }
    BackHandler(enabled = tab != 0 || m.screen != AppModel.Home) { if (tab != 0) setTab(0) else m.home() }
    Scaffold(
        containerColor = Ink.ground,
        bottomBar = {
            NavigationBar(containerColor = Ink.surface, tonalElevation = 0.dp) {
                val colors = NavigationBarItemDefaults.colors(selectedTextColor = Ink.text, selectedIconColor = Ink.text, unselectedIconColor = Ink.muted, indicatorColor = Ink.raised, unselectedTextColor = Ink.muted)
                NavigationBarItem(tab == 0, { setTab(0) }, icon = { Icon(Icons.search, null) }, label = { Text("Check") }, colors = colors)
                NavigationBarItem(tab == 1, { setTab(1) }, icon = {
                    BadgedBox(badge = { if (unseen) Badge(containerColor = Ink.likely) }) { Icon(Icons.bell, null) }
                }, label = { Text("Watching") }, colors = colors)
                NavigationBarItem(tab == 2, { setTab(2) }, icon = { Icon(Icons.info, null) }, label = { Text("How it works") }, colors = colors)
            }
        },
    ) { pad ->
        Box(Modifier.fillMaxSize().padding(pad), contentAlignment = Alignment.TopCenter) {
            androidx.compose.foundation.layout.Column(
                Modifier.widthIn(max = 640.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 4.dp)) {
                    Mark(22.dp)
                    Text("Still Recalled", style = MaterialTheme.typography.titleMedium)
                }
                when (tab) {
                    1 -> WatchScreen(m) { m.watchOwnHint(); setTab(0) }
                    2 -> AboutScreen(m)
                    else -> when (val s = m.screen) {
                        is AppModel.Checking -> CheckScreen(m, s)
                        else -> HomeScreen(m)
                    }
                }
            }
        }
    }
}
