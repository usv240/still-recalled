package app.web.stillrecalled.work

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import app.web.stillrecalled.MainActivity
import app.web.stillrecalled.R
import app.web.stillrecalled.StillRecalledApp
import app.web.stillrecalled.data.LiveRecalls
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

/** Twice a day: new recalls from CPSC, and a notification when one matches a watched listing. */
class RecallWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = try {
        val app = applicationContext as StillRecalledApp
        val out = LiveRecalls.refresh(applicationContext, app.store)
        for ((w, alert) in out.hits) notify(applicationContext, w.key, w.listing.optString("title"), alert.getJSONObject("recall"))
        Result.success()
    } catch (e: Throwable) {
        if (runAttemptCount < 3) Result.retry() else Result.failure()
    }

    companion object {
        const val CHANNEL = "watch"
        private const val PERIODIC = "recalls"
        private const val NOW = "recalls-now"
        private val net = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        fun schedule(context: Context) {
            val wm = WorkManager.getInstance(context)
            wm.enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<RecallWorker>(12, TimeUnit.HOURS).setConstraints(net).build())
            // The recall list in the app stops at its build: catch up now rather than in 12 hours.
            wm.enqueueUniqueWork(NOW, ExistingWorkPolicy.KEEP, OneTimeWorkRequestBuilder<RecallWorker>().setConstraints(net).build())
        }

        fun channel(context: Context) {
            val ch = NotificationChannel(CHANNEL, "Recalls on what you watch", NotificationManager.IMPORTANCE_HIGH)
            ch.description = "When CPSC announces a recall that matches a listing you chose to watch."
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }

        fun notify(context: Context, key: String, title: String, recall: org.json.JSONObject) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED &&
                android.os.Build.VERSION.SDK_INT >= 33) return
            val day = try { LocalDate.parse(recall.optString("date")).format(DateTimeFormatter.ofPattern("MMMM d")) } catch (e: Exception) { "" }
            val open = PendingIntent.getActivity(context, key.hashCode(),
                Intent(context, MainActivity::class.java).putExtra(MainActivity.OPEN_WATCH, true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            val body = "${title.take(80)} may be the ${recall.optString("product").take(80)} CPSC recalled${if (day.isNotEmpty()) " on $day" else ""}."
            val n = NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_notify)
                .setContentTitle("Something you're watching may be recalled")
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText("$body ${recall.optString("hazard")}"))
                .setColor(0xFFC4242A.toInt())
                .setContentIntent(open)
                .setAutoCancel(true)
                .build()
            NotificationManagerCompat.from(context).notify(key.hashCode(), n)
        }
    }
}
