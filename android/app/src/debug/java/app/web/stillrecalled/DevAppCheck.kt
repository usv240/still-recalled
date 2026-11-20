package app.web.stillrecalled

import com.google.firebase.appcheck.AppCheckProviderFactory
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory

/** Development builds only: Firebase's debug provider, used when local.properties holds a debug token. */
object DevAppCheck {
    fun factory(): AppCheckProviderFactory = DebugAppCheckProviderFactory.getInstance()
}
