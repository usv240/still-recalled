package app.web.stillrecalled.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * What the app keeps, all on the phone (app-private storage; nothing on a server):
 *   watch.json  the listings the user chose to watch, each with its photo saved beside it
 *   live.json   recalls CPSC published after this version, with their field-guide entries
 *   settings    the cloud check switch
 */
class Store(context: Context) {
    private val dir = context.filesDir
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    data class Watched(val key: String, val listing: JSONObject, val addedAt: Long, val alert: JSONObject?) {
        val photo: File get() = File(listing.optString("photoFile"))
    }

    private val _watch = MutableStateFlow(readWatch())
    val watch: StateFlow<List<Watched>> = _watch
    private val _live = MutableStateFlow(readLive())
    val live: StateFlow<JSONObject> = _live

    var cloudCheck: Boolean
        get() = prefs.getBoolean("cloud", true)
        set(v) { prefs.edit().putBoolean("cloud", v).apply() }

    // ---- Watch -----------------------------------------------------------------------------------------------------
    private fun readWatch(): List<Watched> = try {
        val a = JSONArray(File(dir, "watch.json").readText())
        (0 until a.length()).map { a.getJSONObject(it) }.map { Watched(it.getString("key"), it.getJSONObject("listing"), it.getLong("addedAt"), it.optJSONObject("alert")) }
    } catch (e: Exception) { emptyList() }

    @Synchronized private fun writeWatch(list: List<Watched>) {
        val a = JSONArray()
        list.forEach { a.put(JSONObject().put("key", it.key).put("listing", it.listing).put("addedAt", it.addedAt).put("alert", it.alert ?: JSONObject.NULL)) }
        File(dir, "watch.json").writeText(a.toString())
        _watch.value = list
    }

    fun isWatched(key: String) = _watch.value.any { it.key == key }

    fun addWatch(key: String, listing: JSONObject, photo: Bitmap?) {
        val l = JSONObject(listing.toString()).put("id", key)
        if (photo != null) {
            val f = File(dir, "watch-$key.jpg")
            f.outputStream().use { Net.scaled(photo, 768)!!.compress(Bitmap.CompressFormat.JPEG, 85, it) }
            l.put("photoFile", f.absolutePath)
        }
        writeWatch(_watch.value.filter { it.key != key } + Watched(key, l, System.currentTimeMillis(), null))
    }

    fun removeWatch(key: String) {
        _watch.value.find { it.key == key }?.photo?.delete()
        writeWatch(_watch.value.filter { it.key != key })
    }

    fun setAlert(key: String, alert: JSONObject) = writeWatch(_watch.value.map { if (it.key == key) it.copy(alert = alert) else it })

    fun markAlertsSeen() = writeWatch(_watch.value.map { w -> w.alert?.let { w.copy(alert = JSONObject(it.toString()).put("seen", true)) } ?: w })

    fun photoOf(w: Watched): Bitmap? = if (w.photo.exists()) BitmapFactory.decodeFile(w.photo.absolutePath) else null

    // ---- Live recalls -----------------------------------------------------------------------------------------------
    private fun readLive(): JSONObject = try { JSONObject(File(dir, "live.json").readText()) } catch (e: Exception) { JSONObject().put("cards", JSONArray()) }

    @Synchronized fun addLive(cards: JSONArray, written: Int) {
        val old = _live.value.optJSONArray("cards") ?: JSONArray()
        val known = (0 until old.length()).map { old.getJSONObject(it).optString("id") }.toSet()
        val next = JSONArray()
        for (i in 0 until cards.length()) if (cards.getJSONObject(i).optString("id") !in known) next.put(cards.getJSONObject(i))
        for (i in 0 until old.length()) next.put(old.getJSONObject(i))
        val o = JSONObject().put("cards", next).put("checkedAt", System.currentTimeMillis()).put("written", written)
        File(dir, "live.json").writeText(o.toString())
        _live.value = o
    }

    /** Debug builds only (MainActivity): forget recalls fetched since the build, to replay their arrival. */
    @Synchronized fun forgetLive() {
        File(dir, "live.json").delete()
        _live.value = JSONObject().put("cards", JSONArray())
    }

    fun liveCards(): JSONArray = _live.value.optJSONArray("cards") ?: JSONArray()
}
