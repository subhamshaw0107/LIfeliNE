package com.lifeline.mesh.transport

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

/**
 * Runtime Bluetooth permission sets per Android version.
 *
 * API 31+: BLUETOOTH_SCAN / ADVERTISE / CONNECT (SCAN flagged
 * neverForLocation in the manifest — no location needed for mesh links).
 * API 24-30: legacy BLUETOOTH + BLUETOOTH_ADMIN + ACCESS_FINE_LOCATION
 * (required by the platform for BLE scanning on those versions).
 * API 33+: POST_NOTIFICATIONS for the relay foreground-service notice.
 *
 * Nothing here starts radio I/O; callers must check [missing] first.
 * Denial is a normal outcome and must never crash the app.
 */
object BlePermissions {
    fun required(): List<String> {
        val perms = ArrayList<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            perms.add(Manifest.permission.BLUETOOTH_SCAN)
            perms.add(Manifest.permission.BLUETOOTH_ADVERTISE)
            perms.add(Manifest.permission.BLUETOOTH_CONNECT)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                perms.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        } else {
            perms.add(Manifest.permission.BLUETOOTH)
            perms.add(Manifest.permission.BLUETOOTH_ADMIN)
            perms.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        return perms
    }

    fun missing(context: Context): List<String> =
        required().filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }

    fun hasAll(context: Context): Boolean = missing(context).isEmpty()
}
