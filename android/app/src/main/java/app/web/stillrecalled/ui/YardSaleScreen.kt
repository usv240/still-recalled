package app.web.stillrecalled.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import app.web.stillrecalled.ai.Ai
import app.web.stillrecalled.ai.LiveSettings
import app.web.stillrecalled.engine.Rules
import com.google.firebase.ai.type.FunctionResponsePart
import com.google.firebase.ai.type.InlineData
import com.google.firebase.ai.type.LiveSession
import com.google.firebase.ai.type.PublicPreviewAPI
import com.google.firebase.ai.type.liveAudioConversationConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.json.JSONObject
import java.io.ByteArrayOutputStream

/**
 * Yard-sale mode. The phone's camera and microphone go to Gemini Live (Firebase AI Logic's Live API); Gemini speaks,
 * and the screen shows its words. When Gemini names a baby product it calls lookup_recalls, and this phone answers
 * from its own field guide of every CPSC recall since 1973 and the banned infant sleep types (shared/live.mjs, in the
 * rules engine). The rows on screen are made by that code from what the field guide returned, never by the model.
 * "Check this one closely" sends the current frame through the app's full check: Gemini Nano on this phone where it
 * has it, then the cloud against the recall notice.
 *
 * One frame a second at 512 pixels, a session capped by Remote Config (two minutes by default), and everything stops
 * when the screen goes away.
 */
@OptIn(PublicPreviewAPI::class)
@Composable
fun YardSaleScreen(m: AppModel) {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf("Point the camera at the baby gear. Gemini says what it sees; this phone checks it against the recall list.") }
    var running by remember { mutableStateOf(false) }
    var left by remember { mutableStateOf("") }
    val said = remember { mutableStateListOf<String>() }
    val found = remember { mutableStateListOf<JSONObject>() }
    val preview = remember { PreviewView(context).apply { scaleType = PreviewView.ScaleType.FILL_CENTER } }
    var session by remember { mutableStateOf<LiveSession?>(null) }
    var job by remember { mutableStateOf<Job?>(null) }
    var camera by remember { mutableStateOf<ProcessCameraProvider?>(null) }

    fun stop(reason: String? = null) {
        job?.cancel(); job = null
        camera?.unbindAll()
        val s = session; session = null
        if (s != null) scope.launch(Dispatchers.IO) { try { s.stopAudioConversation(); s.close() } catch (_: Throwable) {} }
        running = false; left = ""
        if (reason != null) status = reason
    }
    DisposableEffect(Unit) { onDispose { stop() } }

    @SuppressLint("MissingPermission")
    fun start() {
        running = true
        said.clear()
        status = "Starting the camera…"
        job = scope.launch {
            try {
                val settings = LiveSettings.get()
                if (!settings.yardSale || !m.store.cloudCheck || !settings.cloudCheck) { stop("Yard-sale mode needs the cloud check, and it's off. Choose a screenshot instead."); return@launch }
                val spec = Rules.obj("liveSpec")

                // The camera: a preview on screen and one frame a second to Gemini.
                val provider = ProcessCameraProvider.getInstance(context).let { f -> kotlinx.coroutines.suspendCancellableCoroutine<ProcessCameraProvider> { c -> f.addListener({ c.resumeWith(Result.success(f.get())) }, ContextCompat.getMainExecutor(context)) } }
                camera = provider
                var lastFrame = 0L
                val analysis = ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888).build()
                analysis.setAnalyzer(ContextCompat.getMainExecutor(context)) { image ->
                    val s = session
                    val now = System.currentTimeMillis()
                    if (s != null && now - lastFrame >= 1000) {
                        lastFrame = now
                        val bmp = image.toBitmap()
                        val k = 512f / maxOf(bmp.width, bmp.height)
                        val small = if (k < 1f) Bitmap.createScaledBitmap(bmp, (bmp.width * k).toInt(), (bmp.height * k).toInt(), true) else bmp
                        val rotated = if (image.imageInfo.rotationDegrees != 0) Bitmap.createBitmap(small, 0, 0, small.width, small.height,
                            android.graphics.Matrix().apply { postRotate(image.imageInfo.rotationDegrees.toFloat()) }, true) else small
                        val bytes = ByteArrayOutputStream().also { rotated.compress(Bitmap.CompressFormat.JPEG, 70, it) }.toByteArray()
                        scope.launch(Dispatchers.IO) { try { s.sendVideoRealtime(InlineData(bytes, "image/jpeg")) } catch (_: Throwable) {} }
                    }
                    image.close()
                }
                val pv = Preview.Builder().build().also { it.surfaceProvider = preview.surfaceProvider }
                provider.unbindAll()
                provider.bindToLifecycle(lifecycle, CameraSelector.DEFAULT_BACK_CAMERA, pv, analysis)

                status = "Connecting to Gemini…"
                var line = -1
                // The server says when a session is about to end (goAway); the next session then opens at once, with
                // the camera still on and the same time cap.
                val renew = java.util.concurrent.atomic.AtomicBoolean(false)
                suspend fun open(): LiveSession {
                    val (live, where) = Ai.liveSession(settings.yardSaleModel, settings.yardSaleLocations, spec.getString("system"), spec.getJSONObject("tool"))
                    session = live
                    android.util.Log.i("StillRecalled", "yard sale: Live session open (${settings.yardSaleModel}, $where)")
                    live.startAudioConversation(liveAudioConversationConfig {
                        // Gemini's lookup_recalls, answered on this phone from the field guide.
                        functionCallHandler = { call ->
                            val args = JSONObject()
                            for ((k, v) in call.args) args.put(k, (v as? JsonPrimitive)?.content ?: v.toString())
                            val out = runBlocking(Dispatchers.Default) { Rules.obj("liveLookup", args) }
                            scope.launch(Dispatchers.Main) { found.add(0, out) }
                            android.util.Log.i("StillRecalled", "yard sale: lookup answered on this phone (${out.getJSONObject("shown").getJSONArray("recalls").length()} recalls)")
                            FunctionResponsePart(name = call.name, response = Json.parseToJsonElement(out.getJSONObject("response").toString()).jsonObject, id = call.id)
                        }
                        transcriptHandler = { _, output ->
                            val t = output?.text
                            if (!t.isNullOrEmpty()) scope.launch(Dispatchers.Main) {
                                if (line < 0 || line >= said.size) { said.add(""); line = said.size - 1; while (said.size > 4) { said.removeAt(0); line-- } }
                                said[line] = said[line] + t
                            }
                        }
                        goAwayHandler = { renew.set(true) }
                        enableInterruptions = true
                    })
                    return live
                }
                open().send(spec.getString("opening"), true)
                status = "Listening and watching. Ask about anything, or just point."

                // The cap.
                val until = System.currentTimeMillis() + settings.yardSaleMinutes * 60_000L
                while (true) {
                    val s = ((until - System.currentTimeMillis()) / 1000).coerceAtLeast(0)
                    left = "${s / 60}:${(s % 60).toString().padStart(2, '0')} left"
                    if (s == 0L) { stop("Stopped after ${settings.yardSaleMinutes} minutes. Start again for more."); break }
                    if (renew.getAndSet(false)) {
                        val old = session
                        android.util.Log.i("StillRecalled", "yard sale: the server is ending this session; opening the next")
                        try { open() } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
                            stop("Gemini Live ended the session. Start again, or choose a screenshot."); break
                        }
                        if (old != null) scope.launch(Dispatchers.IO) { try { old.stopAudioConversation(); old.close() } catch (_: Throwable) {} }
                    }
                    delay(1000)
                    // A new Gemini turn after a pause starts a new line.
                    line = if (said.isNotEmpty() && line == said.size - 1) line else -1
                }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Throwable) {
                android.util.Log.w("StillRecalled", "yard sale: ${e.javaClass.simpleName}: ${e.message?.take(200)}")
                stop("Gemini Live couldn't start just now. Choose a screenshot instead.")
            }
        }
    }

    // Development builds only: the same Live session, function and screen, with typed words in place of the camera
    // and microphone, so a test sends no picture or sound from the phone.
    LaunchedEffect(m.yardSaleDevText) {
        val text = m.yardSaleDevText ?: return@LaunchedEffect
        if (!app.web.stillrecalled.BuildConfig.DEBUG) return@LaunchedEffect
        running = true
        job = scope.launch {
            try {
                val settings = LiveSettings.get()
                val spec = Rules.obj("liveSpec")
                val (live, where) = Ai.liveSession(settings.yardSaleModel, settings.yardSaleLocations, spec.getString("system"), spec.getJSONObject("tool"))
                session = live
                val t0 = System.currentTimeMillis()
                android.util.Log.i("StillRecalled", "yard sale (test, words only): Live session open (${settings.yardSaleModel}, $where)")
                status = "Test: words in place of the camera."
                // A session the server ends must end the test, not leave it showing "running" (seen on the phone).
                val reader = launch { try {
                    var line = -1
                    live.receive().collect { msg ->
                        when (msg) {
                            is com.google.firebase.ai.type.LiveServerToolCall -> {
                                val answers = msg.functionCalls.map { call ->
                                    val args = JSONObject()
                                    for ((k, v) in call.args) args.put(k, (v as? JsonPrimitive)?.content ?: v.toString())
                                    val out = Rules.obj("liveLookup", args)
                                    found.add(0, out)
                                    android.util.Log.i("StillRecalled", "yard sale: lookup answered on this phone after ${System.currentTimeMillis() - t0} ms (${out.getJSONObject("shown").getJSONArray("recalls").length()} recalls, ${out.getJSONObject("shown").getJSONArray("types").length()} banned types)")
                                    FunctionResponsePart(name = call.name, response = Json.parseToJsonElement(out.getJSONObject("response").toString()).jsonObject, id = call.id)
                                }
                                live.sendFunctionResponse(answers)
                            }
                            is com.google.firebase.ai.type.LiveServerContent -> {
                                val t = msg.outputTranscription?.text
                                if (!t.isNullOrEmpty()) { if (line < 0) { said.add(""); line = said.size - 1 }; said[line] = said[line] + t }
                                if (msg.turnComplete) {
                                    if (line >= 0) android.util.Log.i("StillRecalled", "yard sale: Gemini said after ${System.currentTimeMillis() - t0} ms: ${said[line].take(400)}")
                                    line = -1
                                }
                            }
                            is com.google.firebase.ai.type.LiveServerGoAway -> android.util.Log.i("StillRecalled", "yard sale (test): the server is ending the session")
                            else -> {}
                        }
                    }
                } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (e: Exception) {
                    android.util.Log.w("StillRecalled", "yard sale (test): session ended: ${e.javaClass.simpleName}: ${e.message?.take(160)}")
                } }
                live.send(text, true)
                withTimeoutOrNull(45_000) { reader.join() }
                reader.cancel()
                stop("Test finished.")
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Throwable) {
                android.util.Log.w("StillRecalled", "yard sale (test): ${e.javaClass.simpleName}: ${e.message?.take(200)}")
                stop("Gemini Live couldn't start just now.")
            }
        }
    }

    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted[Manifest.permission.CAMERA] == true && granted[Manifest.permission.RECORD_AUDIO] == true) start()
        else status = "Yard-sale mode needs the camera and the microphone. You can allow them in Settings, or choose a screenshot instead."
    }
    fun allowed(p: String) = ContextCompat.checkSelfPermission(context, p) == PackageManager.PERMISSION_GRANTED

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        LinkButton("← Back", { stop(); m.home() }, Ink.muted)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
            Text("Yard-sale mode", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.semantics { heading() })
            if (left.isNotEmpty()) Muted(left)
        }
        AndroidView({ preview }, Modifier.fillMaxWidth().aspectRatio(3f / 4f).heightIn(max = 520.dp).clip(RoundedCornerShape(8.dp)).background(Ink.raised))
        Text(status, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        for (s in said) SectionCard { Text(s, style = MaterialTheme.typography.bodyLarge) }
        if (!running) Primary(if (said.isEmpty() && found.isEmpty()) "Start the camera" else "Start again", {
            if (allowed(Manifest.permission.CAMERA) && allowed(Manifest.permission.RECORD_AUDIO)) start()
            else ask.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
        }, Modifier.fillMaxWidth())
        else Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Secondary("Check this one closely", {
                val bmp = preview.bitmap
                stop()
                if (bmp != null) m.check(bmp, null)
            }, Modifier.weight(1f))
            Secondary("Done", { stop("Stopped.") })
        }
        for (f in found) FoundRow(f)
        Muted("While it runs, the camera and microphone go to Gemini in the cloud. The recall list stays on this phone and answers every lookup. It never says something is safe: no match only means no recall was found.")
    }
}

/** One lookup, as the field guide answered it: each recall, each banned type, or no match. */
@Composable
private fun FoundRow(f: JSONObject) {
    val asked = f.optJSONObject("asked") ?: JSONObject()
    val shown = f.optJSONObject("shown") ?: JSONObject()
    val what = listOf(asked.optString("brand"), asked.optString("product")).filter { it.isNotBlank() }.joinToString(" ")
    Muted("Looked up: ${what.ifEmpty { "unnamed product" }}", Modifier.padding(top = 6.dp))
    val recalls = shown.optJSONArray("recalls")
    val types = shown.optJSONArray("types")
    for (i in 0 until (recalls?.length() ?: 0)) {
        val card = recalls!!.getJSONObject(i).getJSONObject("card")
        SectionCard {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Pill(if (card.optBoolean("warning")) "CPSC warning" else "Possible recall", "possible")
                Text(card.optString("product").ifEmpty { card.optString("title") }, style = MaterialTheme.typography.titleSmall)
                Muted("${if (card.optBoolean("warning")) "Warning" else "Recall"} ${card.optString("id")}, ${card.optString("date")}. ${if (card.optBoolean("all")) "Every unit is recalled." else "Check the label for the model number."}")
            }
        }
    }
    // The type comes from the words Gemini Live used for what it saw, not from a check of the item, so it is a soft
    // flag here ("may be"), like every other flag that rests on a model's description alone. "Check this one closely"
    // runs the full check on the frame.
    for (i in 0 until (types?.length() ?: 0)) {
        val t = types!!.getJSONObject(i)
        SectionCard {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Pill("May be banned to sell", "possible")
                Text(t.optString("label"), style = MaterialTheme.typography.titleSmall)
                Muted("${t.optString("basis")} Gemini described it this way; tap \"Check this one closely\" to check it properly.")
            }
        }
    }
    if ((recalls?.length() ?: 0) == 0 && (types?.length() ?: 0) == 0) SectionCard {
        Text("No recall found for it in the list. That does not mean it has none.", style = MaterialTheme.typography.bodyMedium)
    }
}
