package app.web.stillrecalled.ai

import android.graphics.Bitmap
import com.google.firebase.Firebase
import com.google.firebase.ai.GenerativeModel
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.InferenceSource
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.OnDeviceModelStatus
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.RequestOptions
import com.google.firebase.ai.type.Schema
import com.google.firebase.ai.type.content
import com.google.firebase.ai.type.generationConfig
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import org.json.JSONArray
import org.json.JSONObject

/**
 * Every model call in the app goes through Firebase AI Logic, here. Three ways of running, each where it fits:
 *
 *   ON_DEVICE_FIRST  PREFER_ON_DEVICE: Gemini Nano on this phone (through AICore) when the phone has it, Gemini in
 *                    the cloud when it doesn't. Reading a screenshot, looking at a listing, reading a label.
 *   DEVICE_ONLY      ONLY_ON_DEVICE: when the cloud check is switched off. Nothing leaves the phone.
 *   CLOUD_ONLY       ONLY_IN_CLOUD: the confirmation against the full recall notice and two photos, a judgment the
 *                    on-device model was measured to get wrong, and writing field-guide entries for new recalls.
 *
 * The prompts and JSON schemas come from the shared rules engine (the same ones the extension uses). The cloud is
 * held to the schema with a response schema; on this phone the on-device path ignores response schemas, so the
 * schema also goes into the instructions and the answer is parsed with care.
 */
@OptIn(PublicPreviewAPI::class)
object Ai {
    enum class Mode { ON_DEVICE_FIRST, DEVICE_ONLY, CLOUD_ONLY }

    sealed interface Part
    data class Text(val text: String) : Part
    data class Image(val bitmap: Bitmap) : Part

    data class Prompt(val system: String, val schema: JSONObject)
    data class Answer(val json: JSONObject, val onDevice: Boolean, val model: String)

    private val ai by lazy { Firebase.ai(backend = GenerativeBackend.agentPlatform("global")) }
    private val options = RequestOptions(timeoutInMillis = 40_000)
    private val models = HashMap<String, GenerativeModel>()

    private fun model(prompt: Prompt, mode: Mode, cloudModel: String): GenerativeModel {
        val key = "${mode.name}|$cloudModel|${prompt.system.hashCode()}"
        return synchronized(models) {
            models.getOrPut(key) {
                ai.generativeModel(
                    modelName = cloudModel,
                    generationConfig = generationConfig {
                        responseMimeType = "application/json"
                        responseSchema = toSchema(prompt.schema)
                        temperature = 0f
                    },
                    systemInstruction = content { text(prompt.system + "\n\n" + jsonInstruction(prompt.schema)) },
                    requestOptions = options,
                    onDeviceConfig = when (mode) {
                        Mode.ON_DEVICE_FIRST -> OnDeviceConfig(mode = InferenceMode.PREFER_ON_DEVICE, maxOutputTokens = 400, temperature = 0f)
                        Mode.DEVICE_ONLY -> OnDeviceConfig(mode = InferenceMode.ONLY_ON_DEVICE, maxOutputTokens = 400, temperature = 0f)
                        Mode.CLOUD_ONLY -> OnDeviceConfig(mode = InferenceMode.ONLY_IN_CLOUD)
                    },
                )
            }
        }
    }

    private val RETRYABLE = Regex("""\b(429|500|503|504)\b|high demand|overloaded|RESOURCE_EXHAUSTED|UNAVAILABLE|timed? ?out|Timeout""", RegexOption.IGNORE_CASE)

    /**
     * One JSON answer. Tries the cloud models in order when one is busy; when all are over quota, waits and tries
     * again (twice).
     */
    suspend fun json(prompt: Prompt, parts: List<Part>, mode: Mode, cloudModels: List<String>): Answer {
        var last: Throwable? = null
        for (attempt in 0..2) {
            for (name in cloudModels) {
                val started = System.currentTimeMillis()
                try {
                    val response = withTimeout(60_000) {
                        model(prompt, mode, name).generateContent(content {
                            for (p in parts) when (p) {
                                is Text -> text(p.text)
                                is Image -> image(p.bitmap)
                            }
                        })
                    }
                    val onDevice = response.inferenceSource == InferenceSource.ON_DEVICE
                    android.util.Log.i("StillRecalled", "model call: ${if (onDevice) "on device" else name}, ${System.currentTimeMillis() - started} ms")
                    return Answer(parseJson(response.text ?: ""), onDevice, if (onDevice) "Gemini Nano" else name)
                } catch (e: Throwable) {
                    last = e
                    if (!RETRYABLE.containsMatchIn(e.toString()) && e !is kotlinx.coroutines.TimeoutCancellationException) throw e
                }
            }
            if (attempt < 2 && last != null && Regex("""\b429\b|RESOURCE_EXHAUSTED|quota""", RegexOption.IGNORE_CASE).containsMatchIn(last.toString())) delay(4000L shl attempt)
            else break
        }
        throw last ?: IllegalStateException("no model answered")
    }

    /** The answer's JSON object, also when a model wraps it in a code fence or adds a sentence. */
    fun parseJson(text: String): JSONObject {
        val start = text.indexOf('{')
        val end = text.lastIndexOf('}')
        require(start >= 0 && end > start) { "no JSON in the answer" }
        return JSONObject(text.substring(start, end + 1))
    }

    private fun jsonInstruction(schema: JSONObject) =
        "Reply with only one JSON object and no other text. It must follow this JSON Schema exactly: $schema"

    /** A JSON Schema from the shared prompts, as Firebase AI Logic's response schema. */
    fun toSchema(s: JSONObject): Schema {
        val description = s.optString("description").ifEmpty { null }
        if (s.has("enum")) {
            val values = s.getJSONArray("enum")
            return Schema.enumeration((0 until values.length()).map { values.getString(it) }, description)
        }
        return when (s.optString("type")) {
            "object" -> {
                val props = s.optJSONObject("properties") ?: JSONObject()
                val required = s.optJSONArray("required") ?: JSONArray()
                val req = (0 until required.length()).map { required.getString(it) }.toSet()
                val map = LinkedHashMap<String, Schema>()
                for (k in props.keys()) map[k] = toSchema(props.getJSONObject(k))
                Schema.obj(map, optionalProperties = map.keys.filter { it !in req }, description = description)
            }
            "array" -> Schema.array(toSchema(s.optJSONObject("items") ?: JSONObject().put("type", "string")), description)
            "boolean" -> Schema.boolean(description)
            "integer" -> Schema.integer(description)
            "number" -> Schema.double(description)
            else -> Schema.string(description)
        }
    }

    // ---- The on-device model ---------------------------------------------------------------------------------------
    private val probe by lazy {
        ai.generativeModel(modelName = "gemini-3.5-flash-lite", onDeviceConfig = OnDeviceConfig(mode = InferenceMode.PREFER_ON_DEVICE))
    }

    /** "available", "downloadable", "downloading" or "unavailable". */
    suspend fun deviceStatus(): String = try {
        when (probe.onDeviceExtension?.checkStatus()) {
            OnDeviceModelStatus.AVAILABLE -> "available"
            OnDeviceModelStatus.DOWNLOADABLE -> "downloadable"
            OnDeviceModelStatus.DOWNLOADING -> "downloading"
            else -> "unavailable"
        }
    } catch (e: Throwable) {
        "unavailable"
    }

    fun download() = probe.onDeviceExtension?.download()

    suspend fun deviceModelName(): String = try { probe.onDeviceExtension?.getModelName() ?: "" } catch (e: Throwable) { "" }

    suspend fun warmUp() { try { probe.onDeviceExtension?.warmUp() } catch (_: Throwable) {} }
}
