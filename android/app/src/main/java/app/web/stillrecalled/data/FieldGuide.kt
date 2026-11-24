package app.web.stillrecalled.data

import android.util.Log
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.firestore
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject

/**
 * The shared field guide, as in the extension and the web page (shared/fieldguide.mjs): one entry per new CPSC notice
 * in Cloud Firestore, written by the first device that sees the notice and read by every other, so the same entry is
 * not paid for again on every phone. Firebase Authentication signs the phone in anonymously (no account, no personal
 * data) so the security rules (firestore.rules) can require a signed-in caller; App Check guards Firestore as it
 * guards AI Logic. A shared entry is used only when the rules engine finds it fits the notice this phone fetched itself.
 */
object FieldGuide {
    private const val COLLECTION = "fieldGuide"
    private const val TAG = "StillRecalled"

    private suspend fun signedIn(): String? = try {
        val auth = Firebase.auth
        (auth.currentUser ?: auth.signInAnonymously().await().user)?.uid
    } catch (e: Throwable) {
        Log.w(TAG, "field guide: no sign-in (${e.javaClass.simpleName})"); null
    }

    /** Shared entries for these notice numbers (already checked by the rules engine's entryId), as id -> entry. */
    suspend fun read(ids: List<String>): Map<String, JSONObject> {
        if (ids.isEmpty() || signedIn() == null) return emptyMap()
        val db = Firebase.firestore
        return coroutineScope {
            ids.map { id ->
                async {
                    try {
                        val snap = withTimeoutOrNull(15_000) { db.collection(COLLECTION).document(id).get().await() }
                        val spot = snap?.get("spot") as? Map<*, *>
                        if (snap?.getLong("v") == 1L && spot != null) id to toJson(spot) else null
                    } catch (_: Throwable) { null }
                }
            }.awaitAll().filterNotNull().toMap()
        }
    }

    /** Stores an entry this phone wrote, for every other device. The first entry for a notice stands. */
    suspend fun share(id: String, spot: JSONObject, model: String): Boolean {
        val uid = signedIn() ?: return false
        return try {
            val doc = mapOf("v" to 1L, "spot" to toMap(spot), "model" to model.take(60), "by" to uid, "at" to FieldValue.serverTimestamp())
            withTimeoutOrNull(15_000) { Firebase.firestore.collection(COLLECTION).document(id).set(doc).await() } != null
        } catch (_: Throwable) { false }
    }

    private fun toJson(m: Map<*, *>): JSONObject = JSONObject().apply {
        for ((k, v) in m) put(k.toString(), when (v) {
            is Map<*, *> -> toJson(v)
            is List<*> -> JSONArray(v)
            else -> v
        })
    }

    private fun toMap(o: JSONObject): Map<String, Any?> = o.keys().asSequence().associateWith { k ->
        when (val v = o.get(k)) {
            is JSONObject -> toMap(v)
            is JSONArray -> (0 until v.length()).map { v.get(it) }
            // Firestore's rules expect whole years as integers.
            is Int -> v.toLong()
            JSONObject.NULL -> null
            else -> v
        }
    }
}
