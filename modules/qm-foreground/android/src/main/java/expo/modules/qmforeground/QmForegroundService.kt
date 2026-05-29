package expo.modules.qmforeground

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Plain-notification foreground service. Its only job is to keep the
 * app process foregrounded while a QM custom bell-timer session is
 * running with the screen locked, so:
 *   - react-native-background-timer's native interval keeps firing
 *     (RN's own setInterval is dispatched on the Choreographer and
 *     freezes when the screen turns off), and
 *   - the silent keep-alive loop + bell/tick audio keep playing.
 *
 * We deliberately do NOT use expo-audio's media-player notification
 * (setActiveForLockScreen) here: its now-playing card showed the silent
 * loop's 2 s position looping, which read as a glitch. A plain ongoing
 * notification has no progress bar / misleading time.
 *
 * foregroundServiceType=mediaPlayback (declared in the manifest +
 * granted via FOREGROUND_SERVICE_MEDIA_PLAYBACK) is correct because the
 * app IS playing audio (the silent loop + cues) for the duration.
 */
class QmForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "QM Training"
    val body = intent?.getStringExtra(EXTRA_BODY) ?: "Séance en cours"
    ensureChannel()
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(body)
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setShowWhen(false)
      .build()
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          NOTIF_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        )
      } else {
        startForeground(NOTIF_ID, notification)
      }
    } catch (e: Exception) {
      // If the platform refuses the foreground promotion (e.g. started
      // from background on a strict OEM build), stop quietly rather than
      // crash — the in-app timer still works with the screen on.
      stopSelf()
    }
    return START_STICKY
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
        val ch = NotificationChannel(
          CHANNEL_ID,
          "QM Training",
          NotificationManager.IMPORTANCE_LOW
        )
        ch.setShowBadge(false)
        ch.setSound(null, null)
        mgr.createNotificationChannel(ch)
      }
    }
  }

  companion object {
    private const val CHANNEL_ID = "qm_foreground"
    private const val NOTIF_ID = 4711
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_BODY = "body"

    fun start(context: Context, title: String, body: String) {
      val intent = Intent(context, QmForegroundService::class.java)
        .putExtra(EXTRA_TITLE, title)
        .putExtra(EXTRA_BODY, body)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, QmForegroundService::class.java))
    }
  }
}
