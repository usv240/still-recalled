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

    /** True once the site has handed over a token, so the app can tell the user the first one is still on its way. */
    val ready = kotlinx.coroutines.flow.MutableStateFlow(false)

    /** Start loading the page early, so a token is ready by the first check (the AI SDK waits about 10 s for one). */
    fun warm(context: Context) = main.post { if (web == null) start(context) }

    fun request(context: Context, done: (String?, Long, String?) -> Unit) = main.post {
        val id = ++nextId
        waiting[id] = done
        val proxy = reply
        if (proxy != null) send(proxy, id) else { queued += id; start(context) }
        // A bridge that never answers must not hold up the check: give up after 25 s and start over next time.
        main.postDelayed({ waiting.remove(id)?.let { Log.w(TAG, "timed out"); it(null, 0, "timed out"); reset() } }, 25_000)
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
        }
        WebViewCompat.addWebMessageListener(view, "SRAndroid", setOf(origin)) { _, message: WebMessageCompat, sourceOrigin, isMainFrame, proxy ->
            if (!isMainFrame || sourceOrigin.toString().trimEnd('/') != origin) return@addWebMessageListener
            val data = try { JSONObject(message.data ?: "") } catch (e: Exception) { return@addWebMessageListener }
            when (data.optString("type")) {
                "ready" -> {
                    Log.i(TAG, "bridge ready")
                    reply = proxy
                    queued.forEach { send(proxy, it) }
                    queued.clear()
                }
                "token" -> {
                    val cb = waiting.remove(data.optInt("id")) ?: return@addWebMessageListener
                    val token = data.optString("token")
                    if (token.isNotEmpty()) { Log.i(TAG, "token received"); ready.value = true }
                    if (token.isNotEmpty()) cb(token, data.optLong("expireTimeMillis", System.currentTimeMillis() + 30 * 60_000), null)
                    else { Log.w(TAG, "refused: ${data.optString("error")}"); cb(null, 0, data.optString("error")); reset() }
                }
            }
        }
        web = view
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
