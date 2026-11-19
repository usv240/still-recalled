package app.web.stillrecalled.engine

import android.content.Context
import androidx.javascriptengine.IsolateStartupParameters
import androidx.javascriptengine.JavaScriptIsolate
import androidx.javascriptengine.JavaScriptSandbox
import kotlinx.coroutines.guava.await
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject

/**
 * The rules engine: the extension's own shared modules (shared/, bundled by build.mjs into assets/engine.js),
 * running in Jetpack's JavaScript sandbox, an isolated V8 process with no network, no files and no access to the app.
 * Matching a listing against 10,089 recalls, the safety rules for labels, and the wording of every warning are the
 * same code the extension and the web page run and the tests cover; only the model calls are Kotlin.
 */
object Rules {
    private val lock = Mutex()
    private var sandbox: JavaScriptSandbox? = null
    private var isolate: JavaScriptIsolate? = null
    var cardCount = 0
        private set

    class Unsupported : Exception("This phone's Android System WebView is too old to run the rules engine. Update it in Google Play.")

    suspend fun start(context: Context, liveCards: JSONArray = JSONArray()) = lock.withLock {
        if (isolate != null) return@withLock
        if (!JavaScriptSandbox.isSupported()) throw Unsupported()
        val box = JavaScriptSandbox.createConnectedInstanceAsync(context.applicationContext).await()
        val params = IsolateStartupParameters()
        if (box.isFeatureSupported(JavaScriptSandbox.JS_FEATURE_ISOLATE_MAX_HEAP_SIZE)) params.maxHeapSizeBytes = 512L shl 20
        val iso = box.createIsolate(params)
        val assets = context.assets
        iso.evaluateJavaScriptAsync(assets.open("engine.js").bufferedReader().use { it.readText() }).await()
        // The cards come in chunks of 200: one evaluation is limited in size where the sandbox runs in its own process.
        for (f in (assets.list("cards") ?: emptyArray()).sorted()) {
            val chunk = assets.open("cards/$f").bufferedReader().use { it.readText() }
            cardCount = iso.evaluateJavaScriptAsync("SR.addCards($chunk)").await().toInt()
        }
        iso.evaluateJavaScriptAsync("SR.setLive($liveCards)").await()
        sandbox = box
        isolate = iso
    }

    /** Call `SR.<fn>` with JSON arguments (org.json values, strings, numbers, booleans or null). Returns its JSON. */
    suspend fun call(fn: String, vararg args: Any?): String = lock.withLock {
        val iso = isolate ?: error("rules engine not started")
        val code = "SR.$fn(${args.joinToString(",") { lit(it) }})"
        iso.evaluateJavaScriptAsync(code).await()
    }

    suspend fun obj(fn: String, vararg args: Any?) = JSONObject(call(fn, *args))
    suspend fun arr(fn: String, vararg args: Any?) = JSONArray(call(fn, *args))
    suspend fun str(fn: String, vararg args: Any?): String = JSONArray("[${call(fn, *args)}]").getString(0)

    /** A JavaScript literal for a value. org.json escapes U+2028 and U+2029, which JSON allows and old JavaScript didn't. */
    private fun lit(v: Any?): String = when (v) {
        null -> "null"
        is JSONObject, is JSONArray -> v.toString()
        is String -> JSONObject.quote(v)
        is Boolean, is Number -> v.toString()
        is Map<*, *> -> JSONObject(v).toString()
        is List<*> -> JSONArray(v).toString()
        else -> JSONObject.quote(v.toString())
    }
}
