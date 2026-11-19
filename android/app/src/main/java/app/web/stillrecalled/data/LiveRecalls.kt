package app.web.stillrecalled.data

import android.content.Context
import app.web.stillrecalled.ai.Ai
import app.web.stillrecalled.ai.LiveSettings
import app.web.stillrecalled.engine.Checker
import app.web.stillrecalled.engine.Rules
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
import org.json.JSONArray
import org.json.JSONObject

/**
 * Live recalls, as in the extension: CPSC publishes new recalls every week, and the recall list in the app stops at
 * its build. This asks the CPSC recall API for notices since the newest one known; Gemini in the cloud writes each new
 * notice's field-guide entry (the build's own prompt, ONLY_IN_CLOUD); from then on the phone matches against it on its
 * own. Then the watched listings are checked against the new recalls: plain code on the phone first, and the full
 * check (Gemini Nano when the app is open, Gemini in the cloud otherwise) only for a listing whose words could match.
 */
object LiveRecalls {
    data class Outcome(val added: Int, val written: Int, val hits: List<Pair<Store.Watched, JSONObject>>)

    private val lock = Mutex()
    private const val MAX_WRITTEN = 60

    suspend fun refresh(context: Context, store: Store): Outcome = lock.withLock {
        Rules.start(context, store.liveCards())
        val settings = LiveSettings.get()
        val records = Net.recallsSince(Rules.str("newest"))
        val unknown = Rules.arr("unknown", records)
        val spots = JSONObject()
        if (store.cloudCheck && settings.cloudCheck && settings.liveRecalls && unknown.length() > 0) {
            val prompt = Rules.obj("prompts").getJSONObject("spotter").let { Ai.Prompt(it.getString("system"), it.getJSONObject("schema")) }
            val models = (listOf(LiveSettings.FIELD_GUIDE_MODEL) + settings.models).distinct()
            val gate = Semaphore(4)
            coroutineScope {
                (0 until minOf(unknown.length(), MAX_WRITTEN)).map { i ->
                    async {
                        gate.withPermit {
                            val r = unknown.getJSONObject(i)
                            try {
                                val ans = Ai.json(prompt, listOf(Ai.Text(Rules.str("noticeText", r))), Ai.Mode.CLOUD_ONLY, models)
                                synchronized(spots) { spots.put(r.optString("RecallNumber").trim(), ans.json) }
                            } catch (_: Throwable) { /* this notice keeps the plain-code card */ }
                        }
                    }
                }.awaitAll()
            }
        }
        val cards = Rules.arr("liveCards", unknown, spots)
        if (cards.length() == 0) return@withLock Outcome(0, 0, emptyList())
        store.addLive(cards, spots.length())
        Rules.call("setLive", store.liveCards())

        val newIds = JSONArray((0 until cards.length()).map { cards.getJSONObject(it).getString("id") })
        val watched = store.watch.value.filter { it.alert == null }
        val hits = mutableListOf<Pair<Store.Watched, JSONObject>>()
        if (watched.isNotEmpty()) {
            val listings = JSONArray(watched.map { it.listing })
            val maybe = Rules.obj("watchHits", listings, newIds)
            val checker = Checker { store.cloudCheck }
            for (w in watched.filter { maybe.has(it.key) }) {
                val out = try { checker.check(store.photoOf(w), w.listing.optString("title"), {}) } catch (e: Throwable) { null } ?: continue
                val r = out.result
                val recall = r.optJSONObject("recall")
                if (r.optString("level") in setOf("likely", "possible") && recall != null && (0 until newIds.length()).any { newIds.getString(it) == recall.optString("id") }) {
                    val alert = JSONObject().put("at", System.currentTimeMillis()).put("level", r.optString("level")).put("badge", r.optString("badge"))
                        .put("verdict", r.optString("verdict")).put("confirmed", r.optBoolean("confirmed")).put("recall", recall).put("seen", false)
                    store.setAlert(w.key, alert)
                    hits += w to alert
                }
            }
        }
        Outcome(cards.length(), spots.length(), hits)
    }
}
