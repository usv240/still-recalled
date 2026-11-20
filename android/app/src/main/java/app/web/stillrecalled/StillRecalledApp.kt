package app.web.stillrecalled

import android.app.Application
import app.web.stillrecalled.appcheck.BridgeAppCheckProviderFactory
import app.web.stillrecalled.data.Store
import app.web.stillrecalled.work.RecallWorker
import com.google.firebase.Firebase
import com.google.firebase.appcheck.appCheck
import com.google.firebase.initialize

class StillRecalledApp : Application() {
    lateinit var store: Store
        private set

    override fun onCreate() {
        super.onCreate()
        Firebase.initialize(this)
        // App Check is enforced on Firebase AI Logic. A development build with a debug token in local.properties uses
        // Firebase's debug provider; every other build gets tokens from the site's reCAPTCHA Enterprise bridge.
        Firebase.appCheck.installAppCheckProviderFactory(
            if (BuildConfig.DEBUG_APPCHECK) DevAppCheck.factory() else BridgeAppCheckProviderFactory(this))
        store = Store(this)
        // Fetch the first App Check token now, so it is ready by the time the user checks a listing.
        if (!BuildConfig.DEBUG_APPCHECK) app.web.stillrecalled.appcheck.Bridge.warm(this)
        Firebase.appCheck.getAppCheckToken(false)
        RecallWorker.channel(this)
        RecallWorker.schedule(this)
    }

    val appCheckMode: String get() = if (BuildConfig.DEBUG_APPCHECK) "Debug token (development build)" else "reCAPTCHA Enterprise, through the site"
}
