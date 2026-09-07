package com.lifeline.mesh.transport

import java.util.UUID

/**
 * LIFELINE BLE transport constants.
 *
 * Roles (both run concurrently on one phone where Android allows it):
 *  - Peripheral (GATT server): advertises the LIFELINE service, accepts
 *    writes on RX, exposes TX notifications and a readable PEER_ID.
 *  - Central (GATT client): scans for the LIFELINE service, connects,
 *    reads the remote PEER_ID, writes data frames to the remote RX,
 *    receives TX notifications.
 *
 * Byte order: LITTLE_ENDIAN for every multi-byte numeric field
 * (frame header AND any length prefixes). See BleFrameCodec.
 */
object BleConstants {
    /** Custom 128-bit LIFELINE mesh service. */
    val SERVICE_UUID: UUID = UUID.fromString("c8f6e58a-1f2b-4d3c-8e4f-5a6b7c8d9e0f")

    /** RX: central writes outgoing frame bytes here (WRITE, response). */
    val RX_CHARACTERISTIC_UUID: UUID = UUID.fromString("c8f6e58a-1f2b-4d3c-8e4f-5a6b7c8d9e01")

    /** TX: peripheral notifies incoming frame bytes here (NOTIFY). */
    val TX_CHARACTERISTIC_UUID: UUID = UUID.fromString("c8f6e58a-1f2b-4d3c-8e4f-5a6b7c8d9e02")

    /** PEER_ID: readable UTF-8 stable LIFELINE peer UUID (36 chars). */
    val PEER_ID_CHARACTERISTIC_UUID: UUID = UUID.fromString("c8f6e58a-1f2b-4d3c-8e4f-5a6b7c8d9e03")

    /** Standard Client Characteristic Configuration descriptor. */
    val CCC_DESCRIPTOR_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    /** Identity announcement: ASCII "LID:" + 36-char UUID (40 bytes total).
     * Accepted ONLY as the first RX message of a connection (see docs). */
    const val IDENTIFY_MAGIC = "LID:"
    const val IDENTIFY_MESSAGE_LENGTH = 40

    /** Default ATT MTU before negotiation (23 -> 20 usable payload bytes). */
    const val DEFAULT_MTU = 23

    /** Preferred MTU; always negotiated, never assumed (see BleMeshManager). */
    const val PREFERRED_MTU = 517

    /** ATT payload = MTU - 3. Frame header consumes FRAME_HEADER_SIZE. */
    const val ATT_OVERHEAD = 3

    /** Hard cap: larger "packets" are rejected (SOS ~694 B, ACK ~254 B). */
    const val MAX_PACKET_BYTES = 8192

    /** Sanity cap on fragment count per packet. */
    const val MAX_FRAGMENTS = 512

    /** Drop incomplete reassembly buffers older than this (ms). */
    const val REASSEMBLY_TIMEOUT_MS = 30_000L

    /** Capacitor bridge events. */
    const val EVENT_PACKET = "packetReceived"
    const val EVENT_PEER_CONNECTED = "peerConnected"
    const val EVENT_PEER_DISCONNECTED = "peerDisconnected"
    const val EVENT_PEER_FOUND = "peerFound"

    /** SharedPreferences keys for the stable peer identity. */
    const val PREFS_NAME = "lifeline_ble_mesh"
    const val PREF_PEER_ID = "stable_peer_id"

    /** Notification channel / id for the foreground relay service. */
    const val FGS_CHANNEL_ID = "lifeline_mesh_relay"
    const val FGS_NOTIFICATION_ID = 115510
}
