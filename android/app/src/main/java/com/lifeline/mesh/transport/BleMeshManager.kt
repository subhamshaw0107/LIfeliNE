package com.lifeline.mesh.transport

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.ParcelUuid
import android.util.Log

/**
 * Dual-role BLE mesh link manager (no SOS/packet knowledge).
 *
 * - Peripheral (GATT server): advertises [BleConstants.SERVICE_UUID],
 *   accepts frame writes on RX, notifies frames on TX, serves PEER_ID.
 * - Central (GATT client): scans, connects, negotiates MTU, reads the
 *   remote PEER_ID, writes frames to the remote RX, receives TX notifies.
 *
 * Transport guarantees:
 *  - Only complete, length-verified packets leave this class (via
 *    per-sender [BleReassembler]); partial/duplicate/invalid/oversized
 *    fragments are dropped silently.
 *  - Writes never exceed the negotiated payload size
 *    (MTU - 3 ATT overhead - 8 frame header); default MTU 23 assumed
 *    until [BluetoothGattCallback.onMtuChanged] proves otherwise.
 *  - Application identity is the stable UUID from SharedPreferences;
 *    Bluetooth addresses are used ONLY for internal bookkeeping.
 */
@SuppressLint("MissingPermission") // callers gate on BlePermissions.hasAll()
class BleMeshManager(
    appContext: Context,
    private val listener: Listener
) {
    interface Listener {
        fun onPacket(peerId: String, data: ByteArray)
        fun onPeerConnected(peerId: String)
        fun onPeerDisconnected(peerId: String)
        fun onPeerFound(address: String, name: String?, rssi: Int)
        fun onError(code: String, message: String)
    }

    companion object {
        private const val TAG = "BleMeshManager"
    }

    private val context: Context = appContext.applicationContext
    private val bluetoothManager: BluetoothManager? =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    private val adapter: BluetoothAdapter? = bluetoothManager?.adapter
    private val prefs: SharedPreferences =
        context.getSharedPreferences(BleConstants.PREFS_NAME, Context.MODE_PRIVATE)

    /** Stable application identity (never the MAC address). */
    val localPeerId: String = prefs.getString(BleConstants.PREF_PEER_ID, null)
        ?: java.util.UUID.randomUUID().toString().also {
            prefs.edit().putString(BleConstants.PREF_PEER_ID, it).apply()
        }

    val isSupported: Boolean get() =
        context.packageManager.hasSystemFeature(
            android.content.pm.PackageManager.FEATURE_BLUETOOTH_LE
        ) && adapter != null

    // -- peripheral state --
    private var gattServer: BluetoothGattServer? = null
    private var txCharacteristic: BluetoothGattCharacteristic? = null
    private var advertising = false
    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
            advertising = true
            Log.i(TAG, "advertising started")
        }

        override fun onStartFailure(errorCode: Int) {
            advertising = false
            listener.onError("ADVERTISE_FAILED", "startAdvertising error=$errorCode")
        }
    }

    // -- central state --
    private var scanner: BluetoothLeScanner? = null
    private var scanning = false
    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device ?: return
            listener.onPeerFound(
                device.address,
                try {
                    device.name
                } catch (e: SecurityException) {
                    null
                },
                result.rssi
            )
        }

        override fun onScanFailed(errorCode: Int) {
            scanning = false
            listener.onError("SCAN_FAILED", "startScan error=$errorCode")
        }
    }

    /** One logical link per remote device (either role, sometimes both). */
    private inner class Link(val address: String) {
        var clientGatt: BluetoothGatt? = null
        var remoteRx: BluetoothGattCharacteristic? = null
        var remoteTx: BluetoothGattCharacteristic? = null
        var stableId: String? = null
        var mtu: Int = BleConstants.DEFAULT_MTU
        var identified: Boolean = false
        var serverConnected: Boolean = false
        var writeQueue: ArrayDeque<ByteArray> = ArrayDeque()
        var writing: Boolean = false
        /** Server-side buffer, keyed migration to stable id on IDENTIFY. */
        val reassembler = BleReassembler()
        var sawFirstRxMessage: Boolean = false
    }

    private val links = HashMap<String, Link>() // key: device address
    private val addressByStableId = HashMap<String, String>()

    // ------------------------------------------------------------------
    // lifecycle
    // ------------------------------------------------------------------

    fun startAdvertising(): Boolean {
        if (!isSupported) {
            listener.onError("UNSUPPORTED", "BLE not supported")
            return false
        }
        val advertiser = adapter?.bluetoothLeAdvertiser
        if (advertiser == null) {
            listener.onError("ADVERTISE_UNAVAILABLE", "advertiser null (no multi-advertise support?)")
            return false
        }
        ensureServer()
        if (gattServer == null) return false
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
            .setConnectable(true)
            .build()
        val data = AdvertiseData.Builder()
            .addServiceUuid(ParcelUuid(BleConstants.SERVICE_UUID))
            .setIncludeDeviceName(false)
            .build()
        return try {
            advertiser.startAdvertising(settings, data, advertiseCallback)
            true
        } catch (e: Exception) {
            listener.onError("ADVERTISE_FAILED", e.message ?: "startAdvertising threw")
            false
        }
    }

    fun stopAdvertising() {
        try {
            adapter?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
        } catch (e: Exception) {
            Log.w(TAG, "stopAdvertising: ${e.message}")
        }
        advertising = false
    }

    fun startScan(): Boolean {
        if (!isSupported) {
            listener.onError("UNSUPPORTED", "BLE not supported")
            return false
        }
        val scanner = adapter?.bluetoothLeScanner
        if (scanner == null) {
            listener.onError("SCAN_UNAVAILABLE", "scanner null (bluetooth off?)")
            return false
        }
        this.scanner = scanner
        val filter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(BleConstants.SERVICE_UUID))
            .build()
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()
        return try {
            scanner.startScan(listOf(filter), settings, scanCallback)
            scanning = true
            true
        } catch (e: Exception) {
            listener.onError("SCAN_FAILED", e.message ?: "startScan threw")
            false
        }
    }

    fun stopScan() {
        try {
            scanner?.stopScan(scanCallback)
        } catch (e: Exception) {
            Log.w(TAG, "stopScan: ${e.message}")
        }
        scanning = false
    }

    /** Connect as central. [addressOrId] accepts a scan address or stable id. */
    fun connect(addressOrId: String): Boolean {
        if (!isSupported) return false
        val address = addressByStableId[addressOrId] ?: addressOrId
        if (!BluetoothAdapter.checkBluetoothAddress(address)) return false
        if (links[address]?.clientGatt != null) return true // already connecting/connected
        return try {
            val device = adapter!!.getRemoteDevice(address)
            val link = links.getOrPut(address) { Link(address) }
            link.clientGatt =
                device.connectGatt(context, false, clientCallback, BluetoothDevice.TRANSPORT_LE)
            link.clientGatt != null
        } catch (e: Exception) {
            listener.onError("CONNECT_FAILED", e.message ?: "connectGatt threw")
            false
        }
    }

    fun disconnect(peerIdOrAddress: String): Boolean {
        val address = addressByStableId[peerIdOrAddress] ?: peerIdOrAddress
        val link = links[address] ?: return false
        return try {
            link.clientGatt?.disconnect()
            link.clientGatt?.close()
            link.clientGatt = null
            cleanupIfOrphaned(address, link)
            true
        } catch (e: Exception) {
            false
        }
    }

    fun shutdown() {
        stopScan()
        stopAdvertising()
        synchronized(links) {
            links.values.forEach {
                try {
                    it.clientGatt?.disconnect()
                    it.clientGatt?.close()
                } catch (e: Exception) {
                    Log.w(TAG, "shutdown close: ${e.message}")
                }
            }
            links.clear()
            addressByStableId.clear()
        }
        try {
            gattServer?.close()
        } catch (e: Exception) {
            Log.w(TAG, "shutdown server: ${e.message}")
        }
        gattServer = null
    }

    // ------------------------------------------------------------------
    // send path (fragmented, MTU-sized, queued)
    // ------------------------------------------------------------------

    /** Queue a complete packet for [stableId]. False = cannot deliver. */
    @Synchronized
    fun send(stableId: String, packet: ByteArray): Boolean {
        if (packet.isEmpty() || packet.size > BleConstants.MAX_PACKET_BYTES) return false
        val address = addressByStableId[stableId] ?: return false
        val link = links[address] ?: return false
        val frames = try {
            BleFrameCodec.encode(packet, payloadPerWrite(link))
        } catch (e: Exception) {
            return false
        }
        // Prefer central-side RX writes; fall back to server-side TX notify.
        if (link.clientGatt != null && link.remoteRx != null) {
            link.writeQueue.addAll(frames)
            pumpWriteQueue(link)
            return true
        }
        if (link.serverConnected && isTxSubscribed(link)) {
            return notifyFrames(link, frames)
        }
        return false
    }

    fun connectedPeers(): List<String> = synchronized(links) {
        addressByStableId.keys.toList()
    }

    private fun payloadPerWrite(link: Link): Int =
        maxOf(BleFrameCodec.HEADER_SIZE + 1, link.mtu - BleConstants.ATT_OVERHEAD)

    @Synchronized
    private fun pumpWriteQueue(link: Link) {
        val gatt = link.clientGatt ?: return
        if (link.writing) return
        val next = link.writeQueue.removeFirstOrNull() ?: return
        val rx = link.remoteRx ?: return
        link.writing = true
        val ok = writeCharacteristicCompat(gatt, rx, next)
        if (!ok) {
            link.writing = false
            link.writeQueue.addFirst(next)
        }
    }

    @Suppress("DEPRECATION")
    private fun writeCharacteristicCompat(
        gatt: BluetoothGatt,
        characteristic: BluetoothGattCharacteristic,
        value: ByteArray
    ): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                // writeCharacteristic() returns a GATT status int on API 33+.
                // (Compared against GATT_SUCCESS rather than BluetoothStatusCodes
                // so this method verifies on API < 31 runtimes too.)
                gatt.writeCharacteristic(
                    characteristic,
                    value,
                    BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                ) == BluetoothGatt.GATT_SUCCESS
            } else {
                characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                characteristic.value = value
                gatt.writeCharacteristic(characteristic)
            }
        } catch (e: Exception) {
            false
        }
    }

    private val subscribedTx = HashSet<String>() // device address set

    private fun isTxSubscribed(link: Link): Boolean = subscribedTx.contains(link.address)

    @Suppress("DEPRECATION")
    private fun notifyFrames(link: Link, frames: List<ByteArray>): Boolean {
        val server = gattServer ?: return false
        val tx = txCharacteristic ?: return false
        val device = try {
            adapter?.getRemoteDevice(link.address)
        } catch (e: Exception) {
            null
        } ?: return false
        return try {
            var ok = true
            for (frame in frames) {
                tx.value = frame
                // Server-side notify of a >MTU value is truncated by the stack;
                // frames never exceed payloadPerWrite() so this stays in range.
                if (!server.notifyCharacteristicChanged(device, tx, false)) ok = false
            }
            ok
        } catch (e: Exception) {
            false
        }
    }

    // ------------------------------------------------------------------
    // GATT server (peripheral)
    // ------------------------------------------------------------------

    private fun ensureServer() {
        if (gattServer != null || !isSupported) return
        try {
            val server = bluetoothManager!!.openGattServer(context, serverCallback)
            val service = BluetoothGattService(
                BleConstants.SERVICE_UUID,
                BluetoothGattService.SERVICE_TYPE_PRIMARY
            )
            val rx = BluetoothGattCharacteristic(
                BleConstants.RX_CHARACTERISTIC_UUID,
                BluetoothGattCharacteristic.PROPERTY_WRITE,
                BluetoothGattCharacteristic.PERMISSION_WRITE
            )
            val tx = BluetoothGattCharacteristic(
                BleConstants.TX_CHARACTERISTIC_UUID,
                BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                BluetoothGattCharacteristic.PERMISSION_READ
            )
            val cccd = BluetoothGattDescriptor(
                BleConstants.CCC_DESCRIPTOR_UUID,
                BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE
            )
            tx.addDescriptor(cccd)
            val peerId = BluetoothGattCharacteristic(
                BleConstants.PEER_ID_CHARACTERISTIC_UUID,
                BluetoothGattCharacteristic.PROPERTY_READ,
                BluetoothGattCharacteristic.PERMISSION_READ
            )
            service.addCharacteristic(rx)
            service.addCharacteristic(tx)
            service.addCharacteristic(peerId)
            if (server?.addService(service) == true) {
                gattServer = server
                txCharacteristic = tx
            } else {
                server?.close()
            }
        } catch (e: Exception) {
            listener.onError("GATT_SERVER_FAILED", e.message ?: "openGattServer threw")
        }
    }

    private val serverCallback = object : BluetoothGattServerCallback() {
        override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
            val address = device.address ?: return
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                val link = synchronized(links) {
                    links.getOrPut(address) { Link(address) }
                }
                link.serverConnected = true
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                onLinkLost(address, serverSide = true)
            }
        }

        override fun onCharacteristicReadRequest(
            device: BluetoothDevice,
            requestId: Int,
            offset: Int,
            characteristic: BluetoothGattCharacteristic
        ) {
            if (characteristic.uuid == BleConstants.PEER_ID_CHARACTERISTIC_UUID) {
                gattServer?.sendResponse(
                    device, requestId, BluetoothGatt.GATT_SUCCESS, offset,
                    localPeerId.toByteArray(Charsets.UTF_8)
                )
            } else {
                gattServer?.sendResponse(
                    device, requestId, BluetoothGatt.GATT_REQUEST_NOT_SUPPORTED, offset, null
                )
            }
        }

        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice,
            requestId: Int,
            characteristic: BluetoothGattCharacteristic,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray
        ) {
            if (responseNeeded) {
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
            }
            if (characteristic.uuid == BleConstants.RX_CHARACTERISTIC_UUID) {
                handleServerRx(device.address, value)
            }
        }

        override fun onDescriptorWriteRequest(
            device: BluetoothDevice,
            requestId: Int,
            descriptor: BluetoothGattDescriptor,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray
        ) {
            if (responseNeeded) {
                gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
            }
            if (descriptor.uuid == BleConstants.CCC_DESCRIPTOR_UUID) {
                if (value.contentEquals(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) ||
                    value.contentEquals(BluetoothGattDescriptor.ENABLE_INDICATION_VALUE)
                ) {
                    synchronized(subscribedTx) { subscribedTx.add(device.address) }
                } else {
                    synchronized(subscribedTx) { subscribedTx.remove(device.address) }
                }
            }
        }

        override fun onMtuChanged(device: BluetoothDevice, mtu: Int) {
            links[device.address]?.let { it.mtu = mtu }
        }
    }

    private fun handleServerRx(address: String?, raw: ByteArray) {
        if (address == null || raw.isEmpty()) return
        val link = synchronized(links) { links.getOrPut(address) { Link(address) } }
        // Identity handshake: first RX message may be "LID:<stable-uuid>".
        if (!link.sawFirstRxMessage) {
            link.sawFirstRxMessage = true
            val asText = try {
                String(raw, Charsets.US_ASCII)
            } catch (e: Exception) {
                null
            }
            if (asText != null && raw.size == BleConstants.IDENTIFY_MESSAGE_LENGTH &&
                asText.startsWith(BleConstants.IDENTIFY_MAGIC)
            ) {
                val claimed = asText.substring(BleConstants.IDENTIFY_MAGIC.length)
                if (claimed.length == 36) {
                    registerStableId(link, claimed)
                    return
                }
            }
        }
        link.reassembler.pruneIfStale(System.currentTimeMillis())
        val complete = link.reassembler.feed(raw) ?: return
        val sender = link.stableId ?: address
        listener.onPacket(sender, complete)
    }

    // ------------------------------------------------------------------
    // GATT client (central)
    // ------------------------------------------------------------------

    private val clientCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            val address = gatt.device?.address ?: return
            if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                try {
                    gatt.requestMtu(BleConstants.PREFERRED_MTU)
                } catch (e: Exception) {
                    gatt.discoverServices()
                }
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                onLinkLost(address, serverSide = false)
            } else if (status != BluetoothGatt.GATT_SUCCESS) {
                try {
                    gatt.close()
                } catch (e: Exception) {
                    Log.w(TAG, "close after failed connect: ${e.message}")
                }
                links[address]?.clientGatt = null
            }
        }

        override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                links[gatt.device?.address]?.let { it.mtu = mtu }
            }
            gatt.discoverServices() // discover only after MTU settles
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS) return
            val address = gatt.device?.address ?: return
            val link = links[address] ?: return
            val service = gatt.getService(BleConstants.SERVICE_UUID) ?: run {
                gatt.disconnect()
                return
            }
            link.remoteRx = service.getCharacteristic(BleConstants.RX_CHARACTERISTIC_UUID)
            link.remoteTx = service.getCharacteristic(BleConstants.TX_CHARACTERISTIC_UUID)
            val tx = link.remoteTx
            if (link.remoteRx == null || tx == null) {
                gatt.disconnect()
                return
            }
            // Subscribe to TX notifications, then read the stable peer id.
            gatt.setCharacteristicNotification(tx, true)
            val cccd = tx.getDescriptor(BleConstants.CCC_DESCRIPTOR_UUID)
            if (cccd != null) {
                writeDescriptorCompat(gatt, cccd, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
            }
            val idChar = service.getCharacteristic(BleConstants.PEER_ID_CHARACTERISTIC_UUID)
            if (idChar != null) {
                gatt.readCharacteristic(idChar)
            }
        }

        override fun onCharacteristicRead(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            status: Int
        ) {
            if (status != BluetoothGatt.GATT_SUCCESS) return
            if (characteristic.uuid != BleConstants.PEER_ID_CHARACTERISTIC_UUID) return
            @Suppress("DEPRECATION")
            val raw = characteristic.value ?: return
            val remoteId = try {
                String(raw, Charsets.UTF_8).trim()
            } catch (e: Exception) {
                return
            }
            if (remoteId.length != 36) return
            val address = gatt.device?.address ?: return
            val link = links[address] ?: return
            registerStableId(link, remoteId)
            // Announce OUR stable id so the peripheral side can route back.
            val hello = (BleConstants.IDENTIFY_MAGIC + localPeerId).toByteArray(Charsets.US_ASCII)
            val rx = link.remoteRx
            if (rx != null) {
                link.writeQueue.addFirst(hello)
                pumpWriteQueue(link)
            }
        }

        override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            if (characteristic.uuid != BleConstants.TX_CHARACTERISTIC_UUID) return
            @Suppress("DEPRECATION")
            val value = characteristic.value ?: return
            onRemoteTxFrame(gatt.device?.address, value)
        }

        override fun onCharacteristicWrite(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            status: Int
        ) {
            val address = gatt.device?.address ?: return
            val link = links[address] ?: return
            link.writing = false
            if (status != BluetoothGatt.GATT_SUCCESS) {
                Log.w(TAG, "write failed status=$status, retrying once")
            }
            pumpWriteQueue(link)
        }
    }

    @Suppress("DEPRECATION")
    private fun writeDescriptorCompat(
        gatt: BluetoothGatt,
        descriptor: BluetoothGattDescriptor,
        value: ByteArray
    ): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                gatt.writeDescriptor(descriptor, value) == BluetoothGatt.GATT_SUCCESS
            } else {
                descriptor.value = value
                gatt.writeDescriptor(descriptor)
            }
        } catch (e: Exception) {
            false
        }
    }

    private fun onRemoteTxFrame(address: String?, frame: ByteArray) {
        if (address == null || frame.isEmpty()) return
        val link = links[address] ?: return
        link.reassembler.pruneIfStale(System.currentTimeMillis())
        val complete = link.reassembler.feed(frame) ?: return
        listener.onPacket(link.stableId ?: address, complete)
    }

    // ------------------------------------------------------------------
    // identity + cleanup
    // ------------------------------------------------------------------

    private fun registerStableId(link: Link, stableId: String) {
        synchronized(links) {
            // Drop any stale mapping that claimed this id from elsewhere.
            addressByStableId[stableId]?.let { oldAddress ->
                if (oldAddress != link.address) links.remove(oldAddress)
            }
            link.stableId = stableId
            link.identified = true
            addressByStableId[stableId] = link.address
        }
        listener.onPeerConnected(stableId)
    }

    private fun onLinkLost(address: String, serverSide: Boolean) {
        var departedId: String? = null
        synchronized(links) {
            val link = links[address]
            if (serverSide) {
                link?.serverConnected = false
                synchronized(subscribedTx) { subscribedTx.remove(address) }
            } else {
                try {
                    link?.clientGatt?.close()
                } catch (e: Exception) {
                    Log.w(TAG, "close: ${e.message}")
                }
                link?.clientGatt = null
                link?.writeQueue?.clear()
                link?.writing = false
            }
            departedId = link?.stableId
            cleanupIfOrphaned(address, link)
        }
        departedId?.let { listener.onPeerDisconnected(it) }
    }

    /** Remove link only when NEITHER role still uses it. */
    private fun cleanupIfOrphaned(address: String, link: Link?) {
        if (link == null) return
        if (link.clientGatt == null && !link.serverConnected) {
            links.remove(address)
            link.stableId?.let { id ->
                if (addressByStableId[id] == address) addressByStableId.remove(id)
            }
        }
    }
}
