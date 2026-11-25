package app.web.stillrecalled.data

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate

/** The two things the app fetches itself: CPSC's public recall API and photos (recall notices, listing images). */
object Net {
    private const val CPSC_API = "https://www.saferproducts.gov/RestWebServices/Recall"
    /** The recall mirror (shared/mirror.mjs, .github/workflows/recall-mirror.yml): CPSC's last 180 days, unchanged,
     *  through two CDNs that are not CPSC's. Read only when CPSC can't be reached. */
    private val MIRROR_URLS = listOf(
        "https://cdn.jsdelivr.net/gh/usv240/still-recalled@recall-mirror/recalls.json",
        "https://raw.githubusercontent.com/usv240/still-recalled/recall-mirror/recalls.json",
    )

    /** CPSC records dated `from` or later, from the first mirror that answers. */
    private suspend fun mirror(from: String): JSONArray {
        var last: Throwable? = null
        for (url in MIRROR_URLS) {
            try {
                val all = JSONArray(String(get(url)))
                val out = JSONArray()
                for (i in 0 until all.length()) {
                    val r = all.optJSONObject(i) ?: continue
                    if (r.optString("RecallNumber").isNotEmpty() && r.optString("RecallDate").take(10) >= from) out.put(r)
                }
                return out
            } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) { last = e }
        }
        throw last ?: IllegalStateException("no mirror")
    }

    private suspend fun get(url: String, timeoutMs: Int = 30_000): ByteArray = withContext(Dispatchers.IO) {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15_000
        c.readTimeout = timeoutMs
        c.instanceFollowRedirects = true
        c.setRequestProperty("Accept", "application/json, image/*")
        c.setRequestProperty("User-Agent", "StillRecalled-Android")
        c.useCaches = false
        try {
            if (c.responseCode !in 200..299) error("HTTP ${c.responseCode} from ${URL(url).host}")
            c.inputStream.use { it.readBytes() }
        } finally {
            c.disconnect()
        }
    }

    /** The app's bundled files, set once at start (StillRecalledApp): CPSC warnings ship with the app. */
    @Volatile var assets: android.content.res.AssetManager? = null
    private var warnings: org.json.JSONObject? = null

    /** A CPSC safety warning's full text, by id ("W27-081"). The recall API has no notice for a warning. */
    private suspend fun warning(id: String): org.json.JSONObject? = withContext(Dispatchers.IO) {
        val all = warnings ?: assets?.open("warnings.json")?.use { org.json.JSONObject(String(it.readBytes())) }?.also { warnings = it }
        all?.optJSONObject(id)
    }

    /** One recall notice by number, as the raw CPSC record, or null. */
    suspend fun notice(id: String): org.json.JSONObject? {
        if (id.startsWith("W")) return warning(id)
        val list = try {
            JSONArray(String(get("$CPSC_API?format=json&RecallNumber=$id")))
        } catch (e: Exception) {
            // CPSC can't be reached: the mirror has the last 180 days; an older notice fails as before.
            try { mirror("1973-01-01") } catch (_: Exception) { throw e }
        }
        for (i in 0 until list.length()) if (list.getJSONObject(i).optString("RecallNumber") == id) return list.getJSONObject(i)
        return null
    }

    /**
     * Notices published from `since` (minus a week: CPSC sometimes dates a notice before ones already out). The API
     * answers a URL it has seen with its earlier answer, so each request is a new URL.
     */
    suspend fun recallsSince(since: String): JSONArray {
        val from = LocalDate.parse(since).minusDays(7)
        val to = LocalDate.now().plusDays(2)
        return try {
            JSONArray(String(get("$CPSC_API?format=json&RecallDateStart=$from&RecallDateEnd=$to&_=${System.currentTimeMillis()}")))
        } catch (e: Exception) {
            android.util.Log.w("StillRecalled", "recall API: ${e.message?.take(120)}; reading the recall mirror")
            try { mirror(from.toString()) } catch (_: Exception) { throw e }
        }
    }

    /** A photo, scaled so its long side is at most `maxSide`. */
    suspend fun photo(url: String, maxSide: Int = 768): Bitmap? = try {
        val bytes = get(url, 15_000)
        scaled(BitmapFactory.decodeByteArray(bytes, 0, bytes.size), maxSide)
    } catch (e: Exception) {
        null
    }

    fun scaled(b: Bitmap?, maxSide: Int): Bitmap? {
        if (b == null) return null
        val s = maxSide.toFloat() / maxOf(b.width, b.height)
        return if (s >= 1f) b else Bitmap.createScaledBitmap(b, (b.width * s).toInt().coerceAtLeast(1), (b.height * s).toInt().coerceAtLeast(1), true)
    }
}
