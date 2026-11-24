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
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.NavigationRailItemDefaults
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.ui.platform.LocalConfiguration
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
import app.web.stillrecalled.ui.loadBitmapAsync
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import androidx.compose.runtime.key
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics

class MainActivity : ComponentActivity() {
    private val model: AppModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) handle(intent)
        setContent { StillRecalledTheme { App(model, model.tab, { model.selectTab(it) }) { moveTaskToBack(true) } } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    /** From Android's share menu: a screenshot, a photo, or a listing's link and title from another app. */
    private fun handle(intent: Intent?) {
        intent ?: return
        if (intent.getBooleanExtra(OPEN_WATCH, false)) { model.selectTab(1); return }
        // Testing only, in debug builds: replay the arrival of the recalls published since the build.
        if (BuildConfig.DEBUG && intent.getBooleanExtra("dev_forget_live", false)) model.forgetLive()
        if (intent.action != Intent.ACTION_SEND) return
        val type = intent.type ?: ""
        if (type.startsWith("image/")) {
            val uri = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java) ?: return
            model.selectTab(0)
            lifecycleScope.launch { loadBitmapAsync(uri)?.let { model.check(it, null); model.fromShare = true } ?: model.imageFailed() }
        } else {
            val text = listOfNotNull(intent.getStringExtra(Intent.EXTRA_SUBJECT), intent.getStringExtra(Intent.EXTRA_TEXT)).joinToString(" ").trim()
            // Marketplace apps often share only a link, or a stock line around it ("Check out this item on
            // Marketplace"). Neither says what the product is, and the app can't open a Facebook link, so checking
            // it would only ever say "no match". Ask for a screenshot instead.
            val words = productWords(text)
            model.selectTab(0)
            if (words.split(' ').count { it.length > 2 } >= 2) { model.check(null, words); model.fromShare = true }
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
private fun App(m: AppModel, tab: Int, setTab: (Int) -> Unit, backToSharer: () -> Unit) {
    val watch by m.store.watch.collectAsState()
    val unseen = watch.any { it.alert != null && !it.alert.optBoolean("seen") }
    // Back from a result that came from another app's share menu goes back to that app, as share targets do; the
    // result stays here for when the user returns.
    BackHandler(enabled = tab != 0 || m.screen != AppModel.Home) {
        when {
            tab != 0 -> setTab(0)
            m.fromShare -> { m.fromShare = false; backToSharer() }
            else -> m.home()
        }
    }
    // A tablet, a foldable open, or a phone on its side: the tabs move to a rail at the side, and the column stays
    // a readable width in the middle.
    val wide = LocalConfiguration.current.screenWidthDp >= 600
    val tabs = listOf(Triple("Check", Icons.search, false), Triple("Watching", Icons.bell, unseen), Triple("How it works", Icons.info, false))
    @Composable
    fun TabIcon(i: Int) {
        val (_, icon, dot) = tabs[i]
        BadgedBox(badge = { if (dot) Badge(containerColor = Ink.likely, modifier = Modifier.semantics { contentDescription = "New recall match" }) }) { Icon(icon, null) }
    }
    Scaffold(
        containerColor = Ink.ground,
        bottomBar = {
            if (!wide) NavigationBar(containerColor = Ink.surface, tonalElevation = 0.dp) {
                val colors = NavigationBarItemDefaults.colors(selectedTextColor = Ink.text, selectedIconColor = Ink.onPrimary, unselectedIconColor = Ink.muted, indicatorColor = Ink.primary, unselectedTextColor = Ink.muted)
                tabs.forEachIndexed { i, t -> NavigationBarItem(tab == i, { setTab(i) }, icon = { TabIcon(i) }, label = { Text(t.first) }, colors = colors) }
            }
        },
    ) { pad ->
        Row(Modifier.fillMaxSize().padding(pad)) {
            if (wide) NavigationRail(containerColor = Ink.surface, modifier = Modifier.fillMaxHeight()) {
                val colors = NavigationRailItemDefaults.colors(selectedTextColor = Ink.text, selectedIconColor = Ink.onPrimary, unselectedIconColor = Ink.muted, indicatorColor = Ink.primary, unselectedTextColor = Ink.muted)
                Spacer(Modifier.height(12.dp))
                tabs.forEachIndexed { i, t -> NavigationRailItem(tab == i, { setTab(i) }, icon = { TabIcon(i) }, label = { Text(t.first) }, colors = colors) }
            }
            Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.TopCenter) {
                androidx.compose.foundation.layout.Column(
                    Modifier.widthIn(max = 640.dp).fillMaxWidth().verticalScroll(key(tab, m.screen) { rememberScrollState() }).padding(horizontal = 20.dp, vertical = 16.dp),
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
}
