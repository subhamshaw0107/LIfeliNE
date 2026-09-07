package com.lifeline.mesh.transport

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log

/**
 * Minimal foreground service keeping BLE relay scans/advertising alive
 * while LIFELINE does store-carry-forward in the background.
 *
 * Contains NO packet logic: it only holds the foreground-service slot
 * (type "connectedDevice") and stops itself when the plugin releases it.
 * All M3 decisions stay in TypeScript PacketEngine.
 */
class BleMeshService : Service() {

    companion object {
        private const val TAG = "BleMeshService"

        fun start(context: Context) {
            try {
                val intent = Intent(context.applicationContext, BleMeshService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.applicationContext.startForegroundService(intent)
                } else {
                    context.applicationContext.startService(intent)
                }
            } catch (e: Exception) {
                Log.w(TAG, "start failed: ${e.message}")
            }
        }

        fun stop(context: Context) {
            try {
                context.applicationContext.stopService(
                    Intent(context.applicationContext, BleMeshService::class.java)
                )
            } catch (e: Exception) {
                Log.w(TAG, "stop failed: ${e.message}")
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
        val notification = buildNotification()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    BleConstants.FGS_NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
                )
            } else {
                @Suppress("DEPRECATION")
                startForeground(BleConstants.FGS_NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            Log.w(TAG, "startForeground failed: ${e.message}")
            stopSelf()
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(BleConstants.FGS_CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            BleConstants.FGS_CHANNEL_ID,
            "LIFELINE mesh relay",
            NotificationManager.IMPORTANCE_LOW
        )
        channel.description = "Keeps offline rescue-mesh radio active"
        manager.createNotificationChannel(channel)
    }

    @Suppress("DEPRECATION")
    private fun buildNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, BleConstants.FGS_CHANNEL_ID)
        } else {
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("LIFELINE mesh active")
            .setContentText("Relaying offline rescue messages")
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setOngoing(true)
            .build()
    }
}
