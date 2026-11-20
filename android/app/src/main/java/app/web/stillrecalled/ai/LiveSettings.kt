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
 */
object LiveSettings {
    data class Values(val models: List<String>, val cloudCheck: Boolean, val liveRecalls: Boolean, val from: String)

    val DEFAULT_MODELS = listOf("gemini-4-hydrogen", "gemini-3.5-flash-lite")
    /** The model that wrote the field guide's other 10,089 entries (scripts/build-spotter.mjs). */
    const val FIELD_GUIDE_MODEL = "gemini-3.5-flash-lite"

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
            from = if (from == "cached" && rc.info.lastFetchStatus != com.google.firebase.remoteconfig.FirebaseRemoteConfig.LAST_FETCH_STATUS_SUCCESS) "defaults" else from,
        ).also { cached = it; cachedAt = System.currentTimeMillis() }
    }
}
