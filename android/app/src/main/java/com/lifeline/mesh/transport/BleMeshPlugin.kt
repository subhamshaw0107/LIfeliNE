package com.lifeline.mesh.transport

import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import androidx.core.app.ActivityCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Capacitor bridge for the LIFELINE BLE mesh transport ("BleMesh").
 *
 * Thin by design: bytes cross as base64 strings
 * (Uint8Array <-> base64 conversion documented in bleMeshTransport.ts),
 * framing/reassembly/identity stay inside [BleMeshManager], and every
 * packet decision stays in TypeScript PacketEngine. This class only
 * marshals calls/events and enforces the permission gate.
 *
 * Events (see BleConstants): packetReceived {peerId, data},
 * peerConnected {peerId}, peerDisconnected {peerId},
 * peerFound {address, name, rssi}.
 */
@CapacitorPlugin(name = "BleMesh")
class BleMeshPlugin : Plugin() {

    companion object {
        private const val TAG = "BleMeshPlugin"
        private const val PERMISSION_REQUEST_CODE = 0xB1E
    }

    private var manager: BleMeshManager? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var pendingPermissionCallId: String? = null

    private val managerListener = object : BleMeshManager.Listener {
        override fun onPacket(peerId: String, data: ByteArray) {
            val payload = JSObject()
            payload.put("peerId", peerId)
            // Base64 NO_WRAP: single-line string safe for the JS bridge.
            payload.put("data", Base64.encodeToString(data, Base64.NO_WRAP))
            emit(BleConstants.EVENT_PACKET, payload)
        }

        override fun onPeerConnected(peerId: String) {
            val payload = JSObject()
            payload.put("peerId", peerId)
            emit(BleConstants.EVENT_PEER_CONNECTED, payload)
        }

        override fun onPeerDisconnected(peerId: String) {
            val payload = JSObject()
            payload.put("peerId", peerId)
            emit(BleConstants.EVENT_PEER_DISCONNECTED, payload)
        }

        override fun onPeerFound(address: String, name: String?, rssi: Int) {
            val payload = JSObject()
            payload.put("address", address)
            payload.put("name", name ?: "")
            payload.put("rssi", rssi)
            emit(BleConstants.EVENT_PEER_FOUND, payload)
        }

        override fun onError(code: String, message: String) {
            Log.w(TAG, "$code: $message")
        }
    }

    private fun emit(event: String, data: JSObject) {
        // GATT callbacks arrive on binder threads; Capacitor listeners
        // must be notified on the main thread.
        mainHandler.post { notifyListeners(event, data) }
    }

    private fun ensureManager(): BleMeshManager {
        var existing = manager
        if (existing == null) {
            existing = BleMeshManager(context, managerListener)
            manager = existing
        }
        return existing
    }

    private fun radioAllowed(call: PluginCall): Boolean {
        if (BlePermissions.hasAll(context)) return true
        call.reject(
            "PERMISSION_DENIED",
            "Bluetooth permissions not granted; call requestPermissions() first"
        )
        return false
    }

    // ------------------------------------------------------------------
    // bridge API
    // ------------------------------------------------------------------

    @PluginMethod
    fun initialize(call: PluginCall) {
        val mgr = ensureManager()
        val result = JSObject()
        result.put("peerId", mgr.localPeerId)
        result.put("supported", mgr.isSupported)
        call.resolve(result)
    }

    // Overrides Plugin.requestPermissions(PluginCall): Capacitor's default
    // uses the annotation-declared permission set, but LIFELINE needs a
    // version-aware set (API 31+ BLE vs legacy BT+location), so the manual
    // ActivityCompat flow below replaces it (same bridge name/signature).
    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        val missing = BlePermissions.missing(context)
        if (missing.isEmpty()) {
            val result = JSObject()
            result.put("granted", true)
            call.resolve(result)
            return
        }
        // Async outcome: park the call, resolve it in the permission result.
        pendingPermissionCallId = call.callbackId
        bridge.saveCall(call)
        try {
            ActivityCompat.requestPermissions(
                activity,
                missing.toTypedArray(),
                PERMISSION_REQUEST_CODE
            )
        } catch (e: Exception) {
            pendingPermissionCallId = null
            bridge.releaseCall(call)
            call.reject("PERMISSION_REQUEST_FAILED", e.message)
        }
    }

    override fun handleRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.handleRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != PERMISSION_REQUEST_CODE) return
        val id = pendingPermissionCallId ?: return
        pendingPermissionCallId = null
        val saved = bridge.getSavedCall(id) ?: return
        val granted = BlePermissions.hasAll(context)
        val result = JSObject()
        result.put("granted", granted)
        // DIAG-LOG: temporary physical-test aid (remove after field verification).
        Log.i(TAG, "DIAG permissions granted=$granted")
        saved.resolve(result)
        bridge.releaseCall(saved)
    }

    @PluginMethod
    fun startScan(call: PluginCall) {
        if (!radioAllowed(call)) return
        val mgr = ensureManager()
        if (!mgr.isSupported) {
            call.reject("UNSUPPORTED", "BLE not supported on this device")
            return
        }
        BleMeshService.start(context)
        val started = mgr.startScan()
        val result = JSObject()
        result.put("started", started)
        // DIAG-LOG: temporary physical-test aid (remove after field verification).
        Log.i(TAG, "DIAG scan started=$started")
        call.resolve(result)
    }

    @PluginMethod
    fun stopScan(call: PluginCall) {
        ensureManager().stopScan()
        relaxForegroundService()
        call.resolve()
    }

    @PluginMethod
    fun startAdvertising(call: PluginCall) {
        if (!radioAllowed(call)) return
        val mgr = ensureManager()
        if (!mgr.isSupported) {
            call.reject("UNSUPPORTED", "BLE not supported on this device")
            return
        }
        BleMeshService.start(context)
        val started = mgr.startAdvertising()
        val result = JSObject()
        result.put("started", started)
        // DIAG-LOG: temporary physical-test aid (remove after field verification).
        Log.i(TAG, "DIAG advertising started=$started")
        call.resolve(result)
    }

    @PluginMethod
    fun stopAdvertising(call: PluginCall) {
        ensureManager().stopAdvertising()
        relaxForegroundService()
        call.resolve()
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        if (!radioAllowed(call)) return
        val target = call.getString("peerId") ?: call.getString("address")
        if (target.isNullOrEmpty()) {
            call.reject("INVALID_PEER", "peerId (stable id or scan address) required")
            return
        }
        val result = JSObject()
        result.put("ok", ensureManager().connect(target))
        call.resolve(result)
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        val target = call.getString("peerId") ?: call.getString("address")
        if (target.isNullOrEmpty()) {
            call.reject("INVALID_PEER", "peerId (stable id or scan address) required")
            return
        }
        val result = JSObject()
        result.put("ok", (manager?.disconnect(target) == true))
        call.resolve(result)
    }

    @PluginMethod
    fun send(call: PluginCall) {
        if (!radioAllowed(call)) return
        val peerId = call.getString("peerId")
        val data = call.getString("data")
        if (peerId.isNullOrEmpty() || data.isNullOrEmpty()) {
            call.reject("INVALID_ARGS", "peerId and base64 data required")
            return
        }
        val bytes = try {
            Base64.decode(data, Base64.NO_WRAP)
        } catch (e: Exception) {
            call.reject("INVALID_ARGS", "data is not valid base64")
            return
        }
        val result = JSObject()
        result.put("ok", (manager?.send(peerId, bytes) == true))
        call.resolve(result)
    }

    @PluginMethod
    fun getConnectedPeers(call: PluginCall) {
        val result = JSObject()
        val array = com.getcapacitor.JSArray()
        (manager?.connectedPeers() ?: emptyList()).forEach { array.put(it) }
        result.put("peers", array)
        call.resolve(result)
    }

    /** Best-effort full teardown; never throws for lifecycle races. */
    private fun relaxForegroundService() {
        try {
            BleMeshService.stop(context)
        } catch (e: Exception) {
            Log.w(TAG, "relaxForegroundService: ${e.message}")
        }
    }

    override fun handleOnDestroy() {
        try {
            manager?.shutdown()
        } catch (e: Exception) {
            Log.w(TAG, "shutdown: ${e.message}")
        }
        manager = null
    }
}
