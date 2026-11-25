package app.web.stillrecalled.ai

import com.google.firebase.Firebase
import com.google.firebase.remoteconfig.remoteConfig
import com.google.firebase.remoteconfig.remoteConfigSettings
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Settings that change without an app update, from Firebase Remote Config: the same template the extension reads.
 *   cloud_models   cloud Gemini models, in order of preference
 *   cloud_check    off: nothing is sent to the cloud; flags stand, marked unconfirmed
 *   live_recalls   off: new recalls still arrive from CPSC, but the cloud does not write their field-guide entries
 *   field_guide_template  the server prompt template that writes field-guide entries (prompts/field-guide-v1.prompt);
 *                  empty: the prompt built into the app writes them
 *   yard_sale, yard_sale_model, yard_sale_location, yard_sale_minutes   yard-sale mode (Gemini Live): on or off, the
 *                  Live model, its locations in order (the next is tried when one refuses), and how many minutes a
 *                  session may last
 */
object LiveSettings {
    data class Values(val models: List<String>, val cloudCheck: Boolean, val liveRecalls: Boolean, val fieldGuideTemplate: String,
        val yardSale: Boolean, val yardSaleModel: String, val yardSaleLocations: List<String>, val yardSaleMinutes: Int, val from: String)

    val DEFAULT_MODELS = listOf("gemini-4-hydrogen", "gemini-3.5-flash-lite", "gemini-3.5-flash")
    /** The model that wrote the field guide's other 10,089 entries (scripts/build-spotter.mjs). */
    const val FIELD_GUIDE_MODEL = "gemini-3.5-flash-lite"
    /** Gemini Live on the Agent Platform: its Live models are regional (not in "global"). */
    const val LIVE_MODEL = "gemini-live-2.5-flash-native-audio"
    /** Where the Live model answered (tested 2026-11-24): us-central1, us-east4, us-east5, europe-west4. US first. */
    const val LIVE_LOCATION = "us-central1,us-east4,us-east5"

    private val lock = Mutex()
    private var cached: Values? = null
    private var cachedAt = 0L

    /** Read again every 10 minutes, since the app process can live for days; Remote Config goes to the network at most once an hour. */
    suspend fun get(): Values = lock.withLock {
        cached?.let { if (System.currentTimeMillis() - cachedAt < 600_000) return it }
        val rc = Firebase.remoteConfig
        val from = try {
            rc.setConfigSettingsAsync(remoteConfigSettings {
                minimumFetchIntervalInSeconds = 3600
                fetchTimeoutInSeconds = 5
            }).await()
            rc.setDefaultsAsync(mapOf(
                "cloud_models" to DEFAULT_MODELS.joinToString(","),
                "cloud_check" to true,
                "live_recalls" to true,
                "field_guide_template" to "field-guide-v1",
                "yard_sale" to true,
                "yard_sale_model" to LIVE_MODEL,
                "yard_sale_location" to LIVE_LOCATION,
                "yard_sale_minutes" to 2L,
            )).await()
            if (withTimeoutOrNull(6000) { rc.fetchAndActivate().await() } != null) "remote" else "cached"
        } catch (e: Throwable) {
            "defaults"
        }
        val models = rc.getString("cloud_models").split(',').map { it.trim() }.filter { Regex("""^gemini-[\w.-]+$""").matches(it) }
        Values(
            models = models.ifEmpty { DEFAULT_MODELS },
            cloudCheck = rc.getBoolean("cloud_check"),
            liveRecalls = rc.getBoolean("live_recalls"),
            fieldGuideTemplate = rc.getString("field_guide_template").takeIf { Regex("^[a-z0-9-]{1,63}$").matches(it) } ?: "",
            yardSale = rc.getBoolean("yard_sale"),
            yardSaleModel = rc.getString("yard_sale_model").takeIf { Regex("^gemini-[a-z0-9.-]+$").matches(it) } ?: LIVE_MODEL,
            yardSaleLocations = rc.getString("yard_sale_location").split(',').map { it.trim() }.filter { Regex("^[a-z0-9-]{2,30}$").matches(it) }
                .ifEmpty { LIVE_LOCATION.split(',') },
            yardSaleMinutes = rc.getLong("yard_sale_minutes").toInt().coerceIn(1, 5),
            from = if (from == "cached" && rc.info.lastFetchStatus != com.google.firebase.remoteconfig.FirebaseRemoteConfig.LAST_FETCH_STATUS_SUCCESS) "defaults" else from,
        ).also { cached = it; cachedAt = System.currentTimeMillis() }
    }
}
