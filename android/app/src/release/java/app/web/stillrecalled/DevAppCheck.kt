package app.web.stillrecalled

import com.google.firebase.appcheck.AppCheckProviderFactory

/** Release builds have no debug provider: the debug library isn't in them at all. */
object DevAppCheck {
    fun factory(): AppCheckProviderFactory = error("No debug App Check provider in a release build")
}
