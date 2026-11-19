package app.web.stillrecalled.ui

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import app.web.stillrecalled.StillRecalledApp
import app.web.stillrecalled.ai.Ai
import app.web.stillrecalled.ai.LiveSettings
import app.web.stillrecalled.data.LiveRecalls
import app.web.stillrecalled.engine.Checker
import app.web.stillrecalled.engine.Rules
import com.google.firebase.ai.DownloadStatus
import com.google.firebase.ai.type.PublicPreviewAPI
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/** The app's state: the engine, the on-device model, the check in progress and the watch list. */
@OptIn(PublicPreviewAPI::class)
class AppModel(app: Application) : AndroidViewModel(app) {
    val store = (app as StillRecalledApp).store
    private val checker = Checker { store.cloudCheck }

    // Engine and model.
    var engine by mutableStateOf("starting")        // "starting", "ready", or an error message
        private set
    var model by mutableStateOf("checking")         // Ai.deviceStatus()
        private set
    var modelName by mutableStateOf("")
        private set
    var download by mutableStateOf<Float?>(null)
        private set
    var recent by mutableStateOf(JSONArray())
        private set
    var settings by mutableStateOf<LiveSettings.Values?>(null)
        private set

    // The check.
    sealed interface Screen
    data object Home : Screen
    data class Checking(val photo: Bitmap?, val text: String?, val example: Boolean) : Screen
    var screen by mutableStateOf<Screen>(Home)
        private set
    val steps = mutableStateListOf<Checker.Step>()
    var outcome by mutableStateOf<Checker.Outcome?>(null)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    var label by mutableStateOf<Checker.LabelOutcome?>(null)
        private set
    var labelBusy by mutableStateOf(false)
        private set
    var labelError by mutableStateOf<String?>(null)
        private set
    private var job: Job? = null

    // Live recalls.
    var refreshing by mutableStateOf(false)
        private set
    var refreshNote by mutableStateOf<String?>(null)
        private set

    init {
        viewModelScope.launch {
            try {
                Rules.start(app, store.liveCards())
                recent = Rules.arr("recentInfant", 6)
                engine = "ready"
            } catch (e: Throwable) {
                engine = e.message ?: e.toString()
            }
        }
        viewModelScope.launch {
            model = Ai.deviceStatus()
            if (model == "available") { modelName = Ai.deviceModelName(); Ai.warmUp() }
        }
        viewModelScope.launch { settings = LiveSettings.get() }
        // Recalls that arrive in the background show up in the recent list too.
        viewModelScope.launch {
            store.live.collect { if (engine == "ready") { Rules.call("setLive", store.liveCards()); recent = Rules.arr("recentInfant", 6) } }
        }
    }

    fun startDownload() {
        val flow = Ai.download() ?: return
        viewModelScope.launch {
            var total = 0L
            download = 0f
            try {
                flow.collect { s ->
                    when (s) {
                        is DownloadStatus.DownloadStarted -> total = s.bytesToDownload
                        is DownloadStatus.DownloadInProgress -> if (total > 0) download = s.totalBytesDownloaded.toFloat() / total
                        is DownloadStatus.DownloadCompleted -> download = 1f
                        is DownloadStatus.DownloadFailed -> download = null
                    }
                }
            } catch (_: Throwable) { download = null }
            model = Ai.deviceStatus()
            if (model == "available") modelName = Ai.deviceModelName()
        }
    }

    fun check(photo: Bitmap?, text: String?, example: Boolean = false) {
        if (photo == null && text.isNullOrBlank()) return
        job?.cancel()
        screen = Checking(photo, text, example)
        steps.clear()
        steps += listOf(Checker.Step("read", if (photo != null) "Reading the screenshot" else "Reading the listing"),
            Checker.Step("words", "Searching recall notices"), Checker.Step("look", "Looking closer"))
        outcome = null; error = null; label = null; labelError = null
        job = viewModelScope.launch {
            try {
                if (engine != "ready") Rules.start(getApplication(), store.liveCards())
                val t0 = System.currentTimeMillis()
                outcome = checker.check(photo, text) { s ->
                    val i = steps.indexOfFirst { it.key == s.key }
                    if (i >= 0) steps[i] = s
                }
                outcome?.let { o -> android.util.Log.i("StillRecalled", "check done in ${System.currentTimeMillis() - t0} ms: ${o.result.optString("level")} / ${o.result.optString("badge")}; read on device: ${o.readOnDevice}; how: ${o.result.optJSONObject("how")}") }
            } catch (e: Checker.NothingFound) {
                error = "No product in this image. Try a screenshot that shows the listing's title and photo, or type what it is."
            } catch (e: Throwable) {
                error = if (Regex("app ?check|attestation|40[13]", RegexOption.IGNORE_CASE).containsMatchIn(e.toString()))
                    "The cloud check couldn't verify this app just now, so this listing couldn't be checked. Try again in a moment."
                else "Something went wrong while checking. Try again in a moment."
                android.util.Log.e("StillRecalled", "check failed", e)
            }
        }
    }

    fun checkExample() {
        val bmp = getApplication<Application>().assets.open("example.jpg").use { BitmapFactory.decodeStream(it) }
        check(bmp, null, example = true)
    }

    fun home() { job?.cancel(); screen = Home; outcome = null; error = null }

    fun readLabel(photo: Bitmap) {
        val recall = outcome?.result?.optJSONObject("recall") ?: return
        val r = JSONObject().put("codes", recall.optJSONArray("codes") ?: JSONArray()).put("from", recall.optInt("from")).put("to", recall.optInt("to"))
        labelBusy = true; labelError = null
        viewModelScope.launch {
            try { label = checker.readLabel(photo, r) } catch (e: Throwable) { labelError = "The label couldn't be read right now. Try again in a moment." }
            labelBusy = false
        }
    }

    // ---- Watch ---------------------------------------------------------------------------------------------------------
    /** A key for the checked listing: its title, so the same listing shared twice is one entry. */
    fun watchKey(o: Checker.Outcome) = "a" + Integer.toHexString(o.listing.optString("title").lowercase().hashCode())

    fun toggleWatch(o: Checker.Outcome) {
        val key = watchKey(o)
        if (store.isWatched(key)) store.removeWatch(key) else store.addWatch(key, o.listing, o.photo)
    }

    fun forgetLive() {
        store.forgetLive()
        viewModelScope.launch { if (engine == "ready") { Rules.call("setLive", store.liveCards()); recent = Rules.arr("recentInfant", 6) } }
    }

    fun refreshNow() {
        if (refreshing) return
        refreshing = true
        refreshNote = "Checking with CPSC…"
        viewModelScope.launch {
            refreshNote = try {
                val out = LiveRecalls.refresh(getApplication(), store)
                for ((w, alert) in out.hits) app.web.stillrecalled.work.RecallWorker.notify(getApplication(), w.key, w.listing.optString("title"), alert.getJSONObject("recall"))
                if (out.added == 0) "No new recalls since the last check"
                else "${out.added} new recall${if (out.added == 1) "" else "s"} added${if (out.hits.isNotEmpty()) ", ${out.hits.size} matching what you watch" else ""}"
            } catch (e: Throwable) {
                "Couldn't reach CPSC. Try again later"
            }
            refreshing = false
        }
    }
}
