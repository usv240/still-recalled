package app.web.stillrecalled.engine

import android.graphics.Bitmap
import app.web.stillrecalled.ai.Ai
import app.web.stillrecalled.ai.LiveSettings
import app.web.stillrecalled.data.Net
import org.json.JSONArray
import org.json.JSONObject

/**
 * One check, the extension's pipeline (extension/src/engine.js) with a phone's input:
 *
 *   read   a shared screenshot or photo becomes a listing          Gemini Nano on the phone, or Gemini in the cloud
 *   words  every CPSC recall since 1973, by brand, line, model     plain code, on the phone
 *   look   is it the product, a part, a toy? a risky sleep type?    Gemini Nano on the phone, or Gemini in the cloud
 *   cloud  only what the look flagged, with the full notice         Gemini in the cloud (ONLY_IN_CLOUD)
 */
class Checker(private val cloudAllowed: () -> Boolean) {
    enum class State { WAITING, ACTIVE, DONE, SKIPPED }
    data class Step(val key: String, val label: String, val state: State = State.WAITING, val detail: String = "")

    data class Outcome(
        val result: JSONObject,          // the presented result (shared/present.mjs)
        val listing: JSONObject,
        val photo: Bitmap?,
        val readOnDevice: Boolean?,      // null when nothing was read (typed text)
    )

    class NothingFound : Exception("No product in this image.")

    private var prompts: JSONObject? = null
    private suspend fun prompt(name: String): Ai.Prompt {
        val p = (prompts ?: Rules.obj("prompts").also { prompts = it }).getJSONObject(name)
        return Ai.Prompt(p.getString("system"), p.getJSONObject("schema"))
    }

    /** `photo` (a screenshot or a photo of the item) or `text` (typed or shared). `onStep` gets each step's change. */
    suspend fun check(photo: Bitmap?, text: String?, onStep: (Step) -> Unit): Outcome {
        val settings = LiveSettings.get()
        val cloudOn = cloudAllowed() && settings.cloudCheck
        val step = { key: String, label: String, state: State, detail: String -> onStep(Step(key, label, state, detail)) }

        // 1. Read.
        val listing: JSONObject
        var readOnDevice: Boolean? = null
        if (photo != null) {
            step("read", "Reading the screenshot", State.ACTIVE, "")
            val readParts = listOf(Ai.Text("Read this image."), Ai.Image(Net.scaled(photo, 1024)!!))
            val ans = try {
                Ai.json(prompt("read"), readParts, mode(cloudOn), deviceStepModels(settings.models))
            } catch (e: Throwable) {
                // Gemini Nano can fail on a photo it can't take; the cloud reads it instead, and the step says so.
                if (!cloudOn) throw e
                Ai.json(prompt("read"), readParts, Ai.Mode.CLOUD_ONLY, deviceStepModels(settings.models))
            }
            if (ans.json.optString("found") == "nothing") throw NothingFound()
            listing = Rules.obj("listingFromRead", ans.json, "")
            readOnDevice = ans.onDevice
            step("read", "Reading the screenshot", State.DONE, "${if (ans.onDevice) "Read on this phone by Gemini Nano" else "Read in the cloud"}: “${listing.optString("title")}”")
        } else {
            listing = Rules.obj("listingFromText", (text ?: "").replace(Regex("""https?://\S+"""), " ").trim())
            step("read", "Reading the listing", State.SKIPPED, "Shared or typed text, nothing to read")
        }

        // 2. Words.
        step("words", "Searching recall notices", State.ACTIVE, "${"%,d".format(Rules.cardCount)} notices since 1973")
        val t = Rules.obj("triage", listing)
        step("words", "Searching recall notices", State.DONE, t.optString("words"))
        if (!t.optBoolean("needsEyes")) {
            step("look", "Looking closer", State.SKIPPED, "Nothing here for a model to look at")
            return Outcome(Rules.obj("wordsOnly", listing, t), listing, photo, readOnDevice)
        }

        // 3. Look.
        step("look", "Looking closer", State.ACTIVE, "On this phone when it can, then in the cloud if anything matches")
        val small = Net.scaled(photo, 512)
        var answer: JSONObject? = null
        var lookedOnDevice = false
        var deviceError = ""
        try {
            val parts = mutableListOf<Ai.Part>(Ai.Text(Rules.str("judgeText", listing, t)))
            if (small != null) parts += Ai.Image(small)
            val ans = Ai.json(prompt("judge"), parts, mode(cloudOn), deviceStepModels(settings.models))
            answer = ans.json
            lookedOnDevice = ans.onDevice
        } catch (e: Throwable) {
            deviceError = e.toString().take(160)
        }
        val look = Rules.obj("afterLook", answer, t, JSONObject().put("secondOpinion", true), listing)
        val device = look.getJSONObject("device")
        val candidate = t.optJSONObject("candidate")
        val how = JSONObject()
            .put("device", lookedOnDevice)
            .put("deviceLevel", look.optString("deviceLevel"))
            .put("deviceUnit", if (lookedOnDevice && candidate != null) answer?.optString("recalled_unit") ?: "" else "")
            .put("candidate", candidate?.let { "${it.getJSONObject("card").optString("id")} ${it.optString("strength")}" } ?: "")
            .put("judgedInCloud", answer != null && !lookedOnDevice)
            .put("deviceError", deviceError)
        // The phone asked its own field guide: a brand the looking model read in the photo (shared/lookup.mjs).
        val seen = look.optJSONObject("seen")
        if (seen != null) how.put("seen", seen)
        val hints = t.optJSONArray("hints") ?: JSONArray()

        if (!look.optBoolean("needsCloud") || !cloudOn) {
            step("look", "Looking closer", State.DONE, if (lookedOnDevice) "Looked at on this phone" else if (answer != null) "Looked at in the cloud" else "Checked by its words")
            return Outcome(Rules.obj("finish", listing, device, null, hints, how), listing, photo, readOnDevice)
        }

        // 4. The cloud, with the full recall notice and both photos.
        step("look", "Looking closer", State.ACTIVE, "${if (lookedOnDevice) "Looked at on this phone. " else ""}Comparing with the full recall notice in the cloud")
        return try {
            val id = look.optString("recallId")
            // When the CPSC recall API does not answer, the check goes on with the phone's own card (bridge.js).
            val notice = if (id.isNotEmpty()) try { Net.notice(id) } catch (e: Throwable) { null } else null
            val recallPhoto = notice?.let { n -> Rules.str("noticeImage", n).takeIf { it.isNotEmpty() }?.let { Net.photo(it, 512) } }
            val texts = Rules.arr("confirmParts", listing, notice, small != null, recallPhoto != null, seen?.optString("brand") ?: "", id)
            // Each notice's remedy in full, for the card.
            val remedies = JSONObject()
            if (notice != null) remedies.put(id, Rules.str("remedy", notice))
            val parts = (0 until texts.length()).map { i ->
                when (val s = texts.getString(i)) {
                    "\u0000LISTING_PHOTO" -> Ai.Image(small!!)
                    "\u0000RECALL_PHOTO" -> Ai.Image(recallPhoto!!)
                    else -> Ai.Text(s)
                }
            }
            // The cloud asks the phone: when it can name a product the listing's words did not, it calls
            // lookup_recalls, and the field guide on this phone answers (shared/lookup.mjs).
            val lookups = JSONArray()
            val lookedUp = JSONArray()
            val fn = Ai.Function((prompts ?: Rules.obj("prompts").also { prompts = it }).getJSONObject("confirm").getJSONObject("tool")) { args ->
                // Only the recall the listing's words matched is left out of the answer; one the phone's own lookup
                // guessed may be what the cloud is asking for.
                val found = Rules.obj("lookup", args, if (seen != null) "" else id)
                val ids = found.getJSONArray("ids")
                val cards = found.getJSONArray("cards")
                val notices = JSONArray()
                for (i in 0 until ids.length()) notices.put(try { Net.notice(ids.getString(i)) ?: JSONObject.NULL } catch (e: Throwable) { JSONObject.NULL })
                for (i in 0 until ids.length()) (notices.opt(i) as? JSONObject)?.let { remedies.put(ids.getString(i), Rules.str("remedy", it)) }
                for (i in 0 until cards.length()) lookedUp.put(cards.getJSONObject(i))
                lookups.put(JSONObject().put("asked", found.getJSONObject("asked")).put("found", ids))
                Rules.obj("lookupResponse", found, notices)
            }
            val cloud = Ai.jsonWithFunction(prompt("confirm"), parts, settings.models, fn)
            how.put("cloud", JSONObject().put("model", cloud.model).put("answer", cloud.json))
            if (lookups.length() > 0) how.put("lookups", lookups)
            how.put("remedies", remedies)
            step("look", "Looking closer", State.DONE, if (lookups.length() > 0) "The cloud asked this phone's field guide, then compared with the notice" else "Compared with the full recall notice")
            Outcome(Rules.obj("finish", listing, device, cloud.json, hints, how, lookedUp, id.isNotEmpty() && notice == null), listing, photo, readOnDevice)
        } catch (e: Throwable) {
            // The on-device flag stands, marked unconfirmed.
            how.put("cloudError", e.toString().take(400))
            step("look", "Looking closer", State.DONE, "The cloud check could not run; the phone's answer stands")
            Outcome(Rules.obj("finish", listing, device, null, hints, how), listing, photo, readOnDevice)
        }
    }

    /**
     * The steps meant for Gemini Nano (read, look, label) fall back to the cloud's lightest model on a phone without it:
     * they ask what a small model can answer, and three calls in a row on the larger model took 34 to 48 s. The
     * confirmation against the full notice keeps the larger models, in Remote Config's order.
     */
    private fun deviceStepModels(models: List<String>) = (listOf(LiveSettings.FIELD_GUIDE_MODEL) + models).distinct()

    /** The cloud switched off (by the user or by Remote Config): the phone only, never a cloud call. */
    private fun mode(cloudOn: Boolean) = if (cloudOn) Ai.Mode.ON_DEVICE_FIRST else Ai.Mode.DEVICE_ONLY

    // ---- The label ----------------------------------------------------------------------------------------------------
    data class LabelOutcome(val reading: JSONObject, val source: String, val copy: JSONObject)

    /**
     * Settle a possible recall with a photo of the label. The phone can raise the alarm on its own, but not clear it: a
     * reading that matches a recalled model stands; anything that would reassure is read again in the cloud, and if the
     * two readings disagree, or a number is one character off a recalled one, the card says so (shared/label.mjs).
     */
    suspend fun readLabel(photo: Bitmap, recall: JSONObject, owner: Boolean = false): LabelOutcome {
        val settings = LiveSettings.get()
        val cloudOn = cloudAllowed() && settings.cloudCheck
        val parts = listOf(Ai.Text("Read the label in this photo."), Ai.Image(Net.scaled(photo, 1280)!!))
        val first = try {
            Ai.json(prompt("label"), parts, mode(cloudOn), deviceStepModels(settings.models))
        } catch (e: Throwable) {
            if (!cloudOn) throw e
            val c = Ai.json(prompt("label"), parts, Ai.Mode.CLOUD_ONLY, settings.models)
            return LabelOutcome(c.json, "in_cloud", Rules.obj("labelCopy", Rules.obj("judgeLabel", c.json, recall), owner))
        }
        val verdict = Rules.obj("judgeLabel", first.json, recall)
        if (!first.onDevice || verdict.optString("state") == "recalled") {
            return LabelOutcome(first.json, if (first.onDevice) "on_device" else "in_cloud", Rules.obj("labelCopy", verdict, owner))
        }
        // Anything that would reassure needs a second reading. Without one (the cloud is off, or failed), the phone's
        // reading does not rule the recall out (shared/label.mjs readOnce).
        val second = (if (cloudOn) try { Ai.json(prompt("label"), parts, Ai.Mode.CLOUD_ONLY, settings.models) } catch (e: Throwable) { null } else null)
            ?: return LabelOutcome(first.json, "on_device", Rules.obj("labelCopy", Rules.obj("readOnce", verdict), owner))
        val settled = Rules.obj("settleReadings", first.json, second.json, recall)
        return LabelOutcome(second.json, "device_then_cloud", Rules.obj("labelCopy", settled, owner))
    }
}
