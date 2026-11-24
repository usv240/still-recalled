package app.web.stillrecalled.ui

import android.app.Application
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewModelScope
import app.web.stillrecalled.StillRecalledApp
import app.web.stillrecalled.ai.Ai
import app.web.stillrecalled.ai.LiveSettings
import app.web.stillrecalled.data.LiveRecalls
import app.web.stillrecalled.engine.Checker
import app.web.stillrecalled.engine.Rules
import com.google.firebase.ai.DownloadStatus
import com.google.firebase.ai.type.PublicPreviewAPI
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/** The app's state: the engine, the on-device model, the check in progress and the watch list. */
@OptIn(PublicPreviewAPI::class)
class AppModel(app: Application, private val saved: SavedStateHandle) : AndroidViewModel(app) {
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
    /** Set when Gemini Nano's download stopped, so the start screen can say so and offer it again. */
    var downloadFailed by mutableStateOf(false)
        private set
    var recent by mutableStateOf(JSONArray())
        private set
    var settings by mutableStateOf<LiveSettings.Values?>(null)
        private set

    /** The bottom tab. Here, not in the activity, so turning the phone keeps it; saved, so Android closing the app does too. */
    var tab by mutableStateOf(saved.get<Int>("tab") ?: 0)
        private set
    fun selectTab(t: Int) { tab = t; saved["tab"] = t }

    /** The check came from another app's share menu: Back from its result returns to that app. */
    var fromShare by mutableStateOf(false)

    // The check.
    sealed interface Screen
    data object Home : Screen
    data class Checking(val photo: Bitmap?, val text: String?, val example: Boolean) : Screen
    var screen by mutableStateOf<Screen>(Home)
        private set
    val steps = mutableStateListOf<Checker.Step>()
    var outcome by mutableStateOf<Checker.Outcome?>(null)
        private set
    /** For a no-match result: what it says (shared/present.mjs noMatchView), the same words as the web page. */
    var noMatch by mutableStateOf<JSONObject?>(null)
        private set

    /** Who is checking: a buyer, or the item's owner. The check is the same; the words after it are not. */
    var owner by mutableStateOf(store.owner)
        private set
    fun chooseOwner(v: Boolean) { owner = v; store.owner = v; viewModelScope.launch { refreshViews() } }
    /** The result said to the owner (shared/present.mjs ownerView): { verdict, foundBy, action, heading, lines }. */
    var ownerInfo by mutableStateOf<org.json.JSONObject?>(null)
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

    /** Shown on the start screen when a share held only a link: ask for a screenshot instead. */
    var shareNote by mutableStateOf<String?>(null)
        private set
    fun shareOnlyLink() {
        home()
        shareNote = "This share only had a link, and Still Recalled can't open Facebook or OfferUp links. Take a screenshot of the listing (with its title and photo) and share the screenshot instead."
    }
    fun dismissShareNote() { shareNote = null }
    fun watchOwnHint() {
        home()
        shareNote = "To watch something you own: take a photo of it (the label too, if you can), share a screenshot of the listing you bought it from, or type its brand and name. Then choose Watch for recalls on the result."
    }

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
            android.util.Log.i("StillRecalled", "on-device model: $model${if (modelName.isNotEmpty()) " ($modelName)" else ""}; device ${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}, Android ${android.os.Build.VERSION.RELEASE}")
        }
        viewModelScope.launch { settings = LiveSettings.get() }
        // Android closed the app in the background (the user was in Messenger sending the seller question): the
        // result comes back as it was.
        if (saved.get<Boolean>("result") == true) viewModelScope.launch { restore() }
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
            downloadFailed = false
            try {
                flow.collect { s ->
                    when (s) {
                        is DownloadStatus.DownloadStarted -> total = s.bytesToDownload
                        is DownloadStatus.DownloadInProgress -> if (total > 0) download = s.totalBytesDownloaded.toFloat() / total
                        is DownloadStatus.DownloadCompleted -> download = 1f
                        is DownloadStatus.DownloadFailed -> {
                            download = null; downloadFailed = true
                            android.util.Log.w("StillRecalled", "on-device model download failed: ${s.exception.message?.take(160)}")
                        }
                    }
                }
            } catch (e: Throwable) {
                download = null; downloadFailed = true
                android.util.Log.w("StillRecalled", "on-device model download failed: ${e.javaClass.simpleName}: ${e.message?.take(160)}")
            }
            model = Ai.deviceStatus()
            if (model == "available") { modelName = Ai.deviceModelName(); Ai.warmUp() }
            android.util.Log.i("StillRecalled", "on-device model after download: $model")
        }
    }

    fun check(photo: Bitmap?, text: String?, example: Boolean = false) {
        if (photo == null && text.isNullOrBlank()) return
        shareNote = null
        job?.cancel()
        screen = Checking(photo, text, example)
        steps.clear()
        // The first App Check token after install can take most of a minute (reCAPTCHA on a fresh WebView). Say so,
        // and wait for it, rather than let the first cloud call fail.
        val needToken = store.cloudCheck && !app.web.stillrecalled.BuildConfig.DEBUG_APPCHECK && !app.web.stillrecalled.appcheck.Bridge.ready.value
        if (needToken) steps += Checker.Step("secure", "Connecting securely (first launch only, up to a minute)", Checker.State.ACTIVE)
        steps += listOf(Checker.Step("read", if (photo != null) "Reading the screenshot" else "Reading the listing"),
            Checker.Step("words", "Searching recall notices"), Checker.Step("look", "Looking closer"))
        outcome = null; error = null; label = null; labelError = null
        job = viewModelScope.launch {
            try {
                if (engine != "ready") Rules.start(getApplication(), store.liveCards())
                if (needToken) {
                    val got = kotlinx.coroutines.withTimeoutOrNull(60_000) { app.web.stillrecalled.appcheck.Bridge.ready.first { it } }
                    val i = steps.indexOfFirst { it.key == "secure" }
                    // Not connected after a minute: the check goes on, and the cloud steps say they couldn't run.
                    if (i >= 0) steps[i] = if (got == true) steps[i].copy(state = Checker.State.DONE)
                        else steps[i].copy(state = Checker.State.SKIPPED, detail = "Not connected yet: the cloud steps may not run")
                }
                val t0 = System.currentTimeMillis()
                ownerInfo = null
                outcome = checker.check(photo, text) { s ->
                    val i = steps.indexOfFirst { it.key == s.key }
                    if (i >= 0) steps[i] = s
                }
                refreshViews()
                outcome?.let { o -> android.util.Log.i("StillRecalled", "check done in ${System.currentTimeMillis() - t0} ms: ${o.result.optString("level")} / ${o.result.optString("badge")}; read on device: ${o.readOnDevice}; how: ${logHow(o.result)}") }
                outcome?.let { persist(it, Checking(photo, text, example)) }
            } catch (e: Checker.NothingFound) {
                stopSteps()
                error = "No product in this image. Try a screenshot that shows the listing's title and photo, or type what it is."
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Throwable) {
                stopSteps()
                val said = e.toString()
                error = when {
                    !online() -> "No internet connection. Connect and try again, or type the brand and product name: matching the words against every recall works offline."
                    Regex("app ?check|attestation|40[13]", RegexOption.IGNORE_CASE).containsMatchIn(said) ->
                        "The cloud check couldn't verify this app just now, so this listing couldn't be checked. Try again in a moment."
                    Regex("timed? ?out|timeout", RegexOption.IGNORE_CASE).containsMatchIn(said) ->
                        "The cloud took too long to answer. Try again in a moment, or type the brand and product name."
                    Regex("\\b(429|503)\\b|quota|overloaded|RESOURCE_EXHAUSTED", RegexOption.IGNORE_CASE).containsMatchIn(said) ->
                        "The cloud model is busy right now. Try again in a minute."
                    else -> "Something went wrong while checking. Try again in a moment, or type the brand and product name."
                }
                // A category, never the listing: enough to tell failures apart in logcat.
                android.util.Log.e("StillRecalled", "check failed: ${e.javaClass.simpleName}")
            }
        }
    }

    /** The owner's words and the no-match words for the current result, from the shared rules. */
    private suspend fun refreshViews() {
        val o = outcome ?: run { ownerInfo = null; noMatch = null; return }
        ownerInfo = try { Rules.obj("ownerView", o.result) } catch (_: Throwable) { null }
        val level = o.result.optString("level")
        noMatch = if (level == "likely" || level == "possible") null else try {
            Rules.obj("noMatchView", o.result, o.listing, if ((screen as? Checking)?.photo != null) "listing" else "typed", owner)
        } catch (_: Throwable) { null }
    }

    /**
     * What logcat gets: where each step ran and which recalls were in play, by number. Not the cloud's answer, the
     * listing's words, or what the cloud asked the field guide for: those say what someone was shopping for.
     */
    private fun logHow(r: JSONObject): JSONObject {
        val h = r.optJSONObject("how") ?: JSONObject()
        val lookups = JSONArray()
        h.optJSONArray("lookups")?.let { a -> for (i in 0 until a.length()) lookups.put(JSONObject().put("found", a.optJSONObject(i)?.optJSONArray("found") ?: JSONArray())) }
        return JSONObject().put("device", h.optBoolean("device")).put("deviceLevel", h.optString("deviceLevel"))
            .put("candidate", h.optString("candidate")).put("judgedInCloud", h.optBoolean("judgedInCloud"))
            .put("cloudModel", h.optString("cloudModel")).put("cloudFailed", h.optString("cloudError").isNotEmpty())
            .put("deviceFailed", h.optString("deviceError").isNotEmpty()).put("lookups", lookups)
    }

    // ---- Keeping the result --------------------------------------------------------------------------------------------
    // In the app's own cache, so it never leaves the phone and Android may clear it. The saved-state flag says it belongs
    // to this visit, so a fresh launch tomorrow starts clean.
    private val lastFile get() = java.io.File(getApplication<Application>().cacheDir, "last-result.json")
    private val lastPhoto get() = java.io.File(getApplication<Application>().cacheDir, "last-result.jpg")

    private fun persist(o: Checker.Outcome, c: Checking) {
        saved["result"] = true
        val json = JSONObject().put("result", o.result).put("listing", o.listing).put("text", c.text ?: JSONObject.NULL)
            .put("example", c.example).put("readOnDevice", o.readOnDevice ?: JSONObject.NULL)
        label?.let { json.put("label", JSONObject().put("reading", it.reading).put("source", it.source).put("copy", it.copy)) }
        val photo = c.photo
        viewModelScope.launch(Dispatchers.IO) {
            try {
                if (photo != null) lastPhoto.outputStream().use { photo.compress(Bitmap.CompressFormat.JPEG, 85, it) } else lastPhoto.delete()
                lastFile.writeText(json.toString())
            } catch (_: Throwable) { /* only a convenience */ }
        }
    }

    private suspend fun restore() {
        val back = withContext(Dispatchers.IO) {
            try {
                val j = JSONObject(lastFile.readText())
                val photo = if (lastPhoto.exists()) BitmapFactory.decodeFile(lastPhoto.path) else null
                j to photo
            } catch (_: Throwable) { null }
        } ?: run { saved["result"] = false; return }
        val (j, photo) = back
        val text = if (j.isNull("text")) null else j.optString("text")
        screen = Checking(photo, text, j.optBoolean("example"))
        steps.clear()
        outcome = Checker.Outcome(j.getJSONObject("result"), j.getJSONObject("listing"), photo, if (j.isNull("readOnDevice")) null else j.optBoolean("readOnDevice"))
        j.optJSONObject("label")?.let { l -> label = Checker.LabelOutcome(l.getJSONObject("reading"), l.optString("source"), l.getJSONObject("copy")) }
        if (engine != "ready") try { Rules.start(getApplication(), store.liveCards()); engine = "ready" } catch (_: Throwable) {}
        refreshViews()
        android.util.Log.i("StillRecalled", "result restored after the app was closed")
    }

    private fun forgetResult() {
        saved["result"] = false
        viewModelScope.launch(Dispatchers.IO) { lastFile.delete(); lastPhoto.delete() }
    }

    /** After a failure, a step still marked as running would keep spinning above the error. */
    private fun stopSteps() {
        for (i in steps.indices) if (steps[i].state == Checker.State.ACTIVE) steps[i] = steps[i].copy(state = Checker.State.SKIPPED)
    }

    private fun online(): Boolean {
        val cm = getApplication<Application>().getSystemService(android.net.ConnectivityManager::class.java) ?: return true
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    /** A picked or shared image that could not be opened: say so on the start screen instead of doing nothing. */
    fun imageFailed() {
        home()
        shareNote = "This image couldn't be opened. Try another screenshot, or type the brand and product name."
    }

    /** A label photo that could not be opened. */
    fun labelImageFailed() { labelError = "This photo couldn't be opened. Try taking it again." }

    fun checkExample() {
        val bmp = getApplication<Application>().assets.open("example.jpg").use { BitmapFactory.decodeStream(it) }
        check(bmp, null, example = true)
    }

    fun home() { job?.cancel(); screen = Home; outcome = null; error = null; noMatch = null; fromShare = false; forgetResult() }

    fun readLabel(photo: Bitmap) {
        val recall = outcome?.result?.optJSONObject("recall") ?: return
        val r = JSONObject().put("codes", recall.optJSONArray("codes") ?: JSONArray()).put("from", recall.optInt("from")).put("to", recall.optInt("to"))
            // The card keeps 14 of the notice's model numbers; "more" stops "not listed" being read from a cut list.
            .put("more", recall.optBoolean("more"))
        labelBusy = true; labelError = null
        viewModelScope.launch {
            try {
                label = checker.readLabel(photo, r, owner)
                outcome?.let { o -> (screen as? Checking)?.let { persist(o, it) } }
            } catch (e: Throwable) {
                labelError = if (!online()) "No internet connection, and this phone can't read the label on its own. Connect and try again."
                    else "The label couldn't be read right now. Try again in a moment."
            }
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
