package app.web.stillrecalled.appcheck

import android.annotation.SuppressLint
import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import app.web.stillrecalled.BuildConfig
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.TaskCompletionSource
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.AppCheckProvider
import com.google.firebase.appcheck.AppCheckProviderFactory
import com.google.firebase.appcheck.AppCheckToken
import org.json.JSONObject

/**
 * App Check for an app installed outside Google Play.
 *
 * Firebase AI Logic requires App Check. On Android the attestation is Play Integrity, which needs the app to come from
 * Google Play; judges and testers install this app from a GitHub release. So the app does what the Chrome extension
 * does: it asks the project's own site for a token. https://still-recalled.web.app/appcheck-bridge.html runs
 * reCAPTCHA Enterprise on the site's domain and gets an App Check token, the same protection the web page has.
 *
 * The page is loaded in a WebView the user never sees. It talks to the app through a WebMessageListener that only
 * accepts messages from the site's origin, so no other page (including the reCAPTCHA frame) can reach the app.
 * No debug token is ever built into a release.
 */
class BridgeAppCheckProviderFactory(private val context: Context) : AppCheckProviderFactory {
    override fun create(firebaseApp: FirebaseApp): AppCheckProvider = BridgeAppCheckProvider(context.applicationContext)
}

private class BridgeToken(private val token: String, private val expireTimeMillis: Long) : AppCheckToken() {
    override fun getToken(): String = token
    override fun getExpireTimeMillis(): Long = expireTimeMillis
}

private class BridgeAppCheckProvider(private val context: Context) : AppCheckProvider {
    override fun getToken(): Task<AppCheckToken> {
        val result = TaskCompletionSource<AppCheckToken>()
        Bridge.request(context) { token, expires, error ->
            if (token != null) result.trySetResult(BridgeToken(token, expires))
            else result.trySetException(IllegalStateException("App Check bridge: ${error ?: "no token"}"))
        }
        return result.task
    }
}

@SuppressLint("SetJavaScriptEnabled")
internal object Bridge {
    private const val TAG = "AppCheckBridge"
    private val main = Handler(Looper.getMainLooper())
    private val origin = Uri.parse(BuildConfig.BRIDGE_URL).let { "${it.scheme}://${it.host}" }
    private var web: WebView? = null
    private var reply: JavaScriptReplyProxy? = null
    private var nextId = 0
    private val waiting = HashMap<Int, (String?, Long, String?) -> Unit>()
    private val queued = ArrayList<Int>()
    private var loadingSince = 0L

    /** True once the site has handed over a token, so the app can tell the user the first one is still on its way. */
    val ready = kotlinx.coroutines.flow.MutableStateFlow(false)

    /** Start loading the page early, so a token is ready by the first check (the AI SDK waits about 10 s for one). */
    fun warm(context: Context) = main.post { if (web == null) start(context) }

    fun request(context: Context, done: (String?, Long, String?) -> Unit) = main.post {
        val id = ++nextId
        waiting[id] = done
        val proxy = reply
        if (proxy != null) send(proxy, id) else { queued += id; start(context) }
        // A bridge that never answers must not hold up the check: this request gives up after 25 s.
        main.postDelayed({
            waiting.remove(id)?.let {
                Log.w(TAG, "timed out")
                it(null, 0, "timed out")
                queued.remove(id)
                // A page that is ready and silent is stuck: start over next time. A page still loading is a slow phone
                // or network: let it finish, so the next request finds it ready. Starting over every 25 s meant a
                // page that needed 30 s never loaded at all (seen on a busy emulator: every cloud call was refused).
                // A page that could not load at all is reset at once by onReceivedError below.
                if (reply != null || System.currentTimeMillis() - loadingSince > 75_000) reset()
            }
        }, 25_000)
    }

    private fun send(proxy: JavaScriptReplyProxy, id: Int) = proxy.postMessage(JSONObject().put("type", "get").put("id", id).toString())

    private fun start(context: Context) {
        if (web != null) return
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            failAll("this WebView is too old for the App Check bridge")
            return
        }
        val view = WebView(context)
        view.settings.javaScriptEnabled = true
        view.settings.domStorageEnabled = true
        // Always the deployed page: a cached copy from an older deploy would not know this app.
        view.settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
        view.webChromeClient = object : android.webkit.WebChromeClient() {
            override fun onConsoleMessage(m: android.webkit.ConsoleMessage): Boolean { Log.i(TAG, "page: ${m.message()}"); return true }
        }
        view.webViewClient = object : WebViewClient() {
            // The WebView stays on the bridge page; reCAPTCHA runs in its own frames.
            override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest) = r.isForMainFrame && r.url.host != Uri.parse(origin).host
            // The page itself could not be loaded (offline, DNS): not a slow load. Start over on the next request.
            override fun onReceivedError(v: WebView, r: WebResourceRequest, e: android.webkit.WebResourceError) {
                if (r.isForMainFrame && v === web) { Log.w(TAG, "page failed to load: ${e.description}"); failAll("the App Check page could not be loaded"); reset() }
            }
        }
        WebViewCompat.addWebMessageListener(view, "SRAndroid", setOf(origin)) { _, message: WebMessageCompat, sourceOrigin, isMainFrame, proxy ->
            if (!isMainFrame || sourceOrigin.toString().trimEnd('/') != origin) return@addWebMessageListener
            val data = try { JSONObject(message.data ?: "") } catch (e: Exception) { return@addWebMessageListener }
            when (data.optString("type")) {
                "ready" -> {
                    Log.i(TAG, "bridge ready")
                    reply = proxy
                    // Every request that was waiting has given up (a slow load): ask for a token anyway, so the app
                    // knows the bridge works and the next request is answered from the page's cache.
                    if (queued.isEmpty()) send(proxy, ++nextId)
                    queued.forEach { send(proxy, it) }
                    queued.clear()
                }
                "token" -> {
                    val token = data.optString("token")
                    // Marked ready even when the request that asked has already given up: the next one will be quick.
                    if (token.isNotEmpty()) { Log.i(TAG, "token received"); ready.value = true }
                    val cb = waiting.remove(data.optInt("id")) ?: return@addWebMessageListener
                    if (token.isNotEmpty()) cb(token, data.optLong("expireTimeMillis", System.currentTimeMillis() + 30 * 60_000), null)
                    else { Log.w(TAG, "refused: ${data.optString("error")}"); cb(null, 0, data.optString("error")); reset() }
                }
            }
        }
        web = view
        loadingSince = System.currentTimeMillis()
        Log.i(TAG, "loading bridge")
        view.loadUrl(BuildConfig.BRIDGE_URL)
    }

    private fun failAll(why: String) {
        Log.w(TAG, "failed: $why")
        queued.forEach { waiting.remove(it)?.invoke(null, 0, why) }
        queued.clear()
    }

    /** A refused reCAPTCHA score makes the page's App Check stop asking for a while; a new page starts afresh. */
    private fun reset() {
        web?.destroy()
        web = null
        reply = null
    }
}
