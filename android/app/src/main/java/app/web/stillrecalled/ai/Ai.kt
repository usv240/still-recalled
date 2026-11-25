package app.web.stillrecalled.ai

import android.graphics.Bitmap
import com.google.firebase.Firebase
import com.google.firebase.ai.GenerativeModel
import com.google.firebase.ai.InferenceMode
import com.google.firebase.ai.InferenceSource
import com.google.firebase.ai.OnDeviceConfig
import com.google.firebase.ai.OnDeviceModelStatus
import com.google.firebase.ai.ai
import com.google.firebase.ai.type.FunctionDeclaration
import com.google.firebase.ai.type.FunctionResponsePart
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.RequestOptions
import com.google.firebase.ai.type.Schema
import com.google.firebase.ai.type.Tool
import com.google.firebase.ai.type.content
import com.google.firebase.ai.type.generationConfig
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.json.JSONArray
import org.json.JSONObject

/**
 * Every model call in the app goes through Firebase AI Logic, here. Three ways of running, each where it fits:
 *
 *   ON_DEVICE_FIRST  PREFER_ON_DEVICE: Gemini Nano on this phone (through AICore) when the phone has it, Gemini in
 *                    the cloud when it doesn't. Reading a screenshot, looking at a listing.
 *   CLOUD_FIRST      PREFER_IN_CLOUD: Gemini in the cloud, and Gemini Nano on this phone when the cloud can't be
 *                    reached (a yard sale with no signal). Reading a label: small model numbers are what Gemini Nano
 *                    was measured to misread, and the cloud would read any reassuring label again anyway, so the
 *                    cloud goes first; the phone's own reading, when it is all there is, can warn but not reassure.
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
    enum class Mode { ON_DEVICE_FIRST, CLOUD_FIRST, DEVICE_ONLY, CLOUD_ONLY }

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
                        Mode.CLOUD_FIRST -> OnDeviceConfig(mode = InferenceMode.PREFER_IN_CLOUD, maxOutputTokens = 400, temperature = 0f)
                        Mode.DEVICE_ONLY -> OnDeviceConfig(mode = InferenceMode.ONLY_ON_DEVICE, maxOutputTokens = 400, temperature = 0f)
                        Mode.CLOUD_ONLY -> OnDeviceConfig(mode = InferenceMode.ONLY_IN_CLOUD)
                    },
                )
            }
        }
    }

    // Errors that mean "try the next model": busy or over quota, and a model that is no longer there (404).
    private val RETRYABLE = Regex("""\b(404|429|500|503|504)\b|NOT_FOUND|high demand|overloaded|RESOURCE_EXHAUSTED|UNAVAILABLE|timed? ?out|Timeout""", RegexOption.IGNORE_CASE)

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

    /**
     * A Gemini Live session for yard-sale mode (Firebase AI Logic's Live API): the camera's frames and the microphone
     * in, speech and its transcript out, and `tool` as a function the phone answers. The Agent Platform's Live models
     * are regional, so the backend is in one of `locations`, tried in order: when one refuses or does not answer in
     * 15 s, the next. App Check goes with the connection as it does with every call. Returns the session and where.
     */
    suspend fun liveSession(model: String, locations: List<String>, system: String, tool: JSONObject): Pair<com.google.firebase.ai.type.LiveSession, String> {
        var last: Throwable? = null
        for (location in locations) {
            try {
                return liveSessionAt(model, location, system, tool) to location
            } catch (e: kotlinx.coroutines.CancellationException) {
                if (e is kotlinx.coroutines.TimeoutCancellationException) { last = e; continue }
                throw e
            } catch (e: Exception) {
                android.util.Log.w("StillRecalled", "yard sale: Live refused at $location: ${e.javaClass.simpleName}: ${e.message?.take(120)}")
                last = e
            }
        }
        throw last ?: IllegalStateException("no Live location")
    }

    private suspend fun liveSessionAt(model: String, location: String, system: String, tool: JSONObject): com.google.firebase.ai.type.LiveSession {
        val params = tool.getJSONObject("parameters")
        val props = params.getJSONObject("properties")
        val required = params.optJSONArray("required") ?: JSONArray()
        val req = (0 until required.length()).map { required.getString(it) }.toSet()
        val map = LinkedHashMap<String, Schema>()
        for (k in props.keys()) map[k] = Schema.string(props.getJSONObject(k).optString("description").ifEmpty { null })
        val live = Firebase.ai(backend = GenerativeBackend.agentPlatform(location)).liveModel(
            modelName = model,
            generationConfig = com.google.firebase.ai.type.liveGenerationConfig {
                responseModality = com.google.firebase.ai.type.ResponseModality.AUDIO
                outputAudioTranscription = com.google.firebase.ai.type.AudioTranscriptionConfig()
                inputAudioTranscription = com.google.firebase.ai.type.AudioTranscriptionConfig()
                temperature = 0.3f
            },
            tools = listOf(Tool.functionDeclarations(listOf(FunctionDeclaration(tool.getString("name"), tool.getString("description"), map, map.keys.filter { it !in req })))),
            systemInstruction = content { text(system) },
        )
        return withTimeout(15_000) { live.connect() }
    }

    /**
     * One JSON answer from a server prompt template (Firebase AI Logic server prompt templates): the prompt and its
     * schema live in Firebase, locked, and the phone sends only `inputs`. Cloud only; throws when the template can't
     * run, and the caller uses the prompt built into the app instead.
     */
    suspend fun template(templateId: String, inputs: Map<String, Any>): Answer {
        val started = System.currentTimeMillis()
        val response = withTimeout(60_000) { ai.templateGenerativeModel(options).generateContent(templateId, inputs) }
        android.util.Log.i("StillRecalled", "model call: template $templateId, ${System.currentTimeMillis() - started} ms")
        return Answer(parseJson(response.text ?: ""), false, "template $templateId")
    }

    /**
     * A function the cloud model may call before it answers (Firebase AI Logic function calling). `declaration` is
     * the shared rules' JSON declaration (name, description, parameters); `run` answers a call on this phone.
     */
    class Function(val declaration: JSONObject, val run: suspend (JSONObject) -> JSONObject)

    private fun toolModel(prompt: Prompt, cloudModel: String, fn: Function): GenerativeModel {
        val key = "TOOL|$cloudModel|${prompt.system.hashCode()}"
        return synchronized(models) {
            models.getOrPut(key) {
                val params = fn.declaration.getJSONObject("parameters")
                val props = params.getJSONObject("properties")
                val required = params.optJSONArray("required") ?: JSONArray()
                val req = (0 until required.length()).map { required.getString(it) }.toSet()
                val map = LinkedHashMap<String, Schema>()
                for (k in props.keys()) map[k] = Schema.string(props.getJSONObject(k).optString("description").ifEmpty { null })
                ai.generativeModel(
                    modelName = cloudModel,
                    generationConfig = generationConfig {
                        responseMimeType = "application/json"
                        responseSchema = toSchema(prompt.schema)
                        temperature = 0f
                    },
                    tools = listOf(Tool.functionDeclarations(listOf(FunctionDeclaration(
                        fn.declaration.getString("name"), fn.declaration.getString("description"), map, map.keys.filter { it !in req })))),
                    systemInstruction = content { text(prompt.system + "\n\n" + jsonInstruction(prompt.schema)) },
                    requestOptions = options,
                    onDeviceConfig = OnDeviceConfig(mode = InferenceMode.ONLY_IN_CLOUD),
                )
            }
        }
    }

    /**
     * One JSON answer from the cloud (ONLY_IN_CLOUD), which may first call `fn`. The call comes back to the phone,
     * `fn.run` answers it here, and the model then gives its answer. At most two rounds of calls.
     */
    suspend fun jsonWithFunction(prompt: Prompt, parts: List<Part>, cloudModels: List<String>, fn: Function): Answer {
        var last: Throwable? = null
        for (attempt in 0..2) {
            for (name in cloudModels) {
                val started = System.currentTimeMillis()
                try {
                    val text = withTimeout(90_000) {
                        val chat = toolModel(prompt, name, fn).startChat()
                        var response = chat.sendMessage(content {
                            for (p in parts) when (p) {
                                is Text -> text(p.text)
                                is Image -> image(p.bitmap)
                            }
                        })
                        var round = 0
                        while (response.functionCalls.isNotEmpty() && round < 3) {
                            val answers = response.functionCalls.take(3).map { call ->
                                val args = JSONObject()
                                for ((k, v) in call.args) args.put(k, (v as? JsonPrimitive)?.content ?: v.toString())
                                val result = if (round < 2) fn.run(args) else JSONObject().put("note", "No more lookups. Answer now.")
                                FunctionResponsePart(call.name, Json.parseToJsonElement(result.toString()).jsonObject)
                            }
                            android.util.Log.i("StillRecalled", "function call: ${response.functionCalls.first().name}, answered on this phone")
                            response = chat.sendMessage(content("function") { for (a in answers) part(a) })
                            round++
                        }
                        response.text ?: ""
                    }
                    android.util.Log.i("StillRecalled", "model call: $name, ${System.currentTimeMillis() - started} ms")
                    // A model that keeps calling the function after being told to answer leaves no text: ask once
                    // more without it.
                    if (!text.contains('{')) return json(prompt, parts, Mode.CLOUD_ONLY, listOf(name))
                    return Answer(parseJson(text), false, name)
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
