package com.lifeline.mesh.transport

import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * LIFELINE BLE frame codec.
 *
 * Frame layout (byte order: LITTLE_ENDIAN):
 *   [0..3]  total packet length (UInt32)
 *   [4..5]  fragment index     (UInt16, 0-based)
 *   [6..7]  fragment count     (UInt16, >= 1)
 *   [8..]   payload bytes
 *
 * Pure JVM logic (no Android dependencies) so the framing algorithm is
 * unit-testable. The TypeScript test suite carries a spec-identical
 * reference model; the native layer is the single production implementation.
 */
object BleFrameCodec {
    const val HEADER_SIZE = 8

    /** Split a complete packet into frames fitting [maxPayload] bytes each. */
    fun encode(packet: ByteArray, maxPayload: Int): List<ByteArray> {
        require(packet.isNotEmpty()) { "packet must not be empty" }
        require(packet.size <= BleConstants.MAX_PACKET_BYTES) { "packet oversized" }
        require(maxPayload > HEADER_SIZE) { "payload too small for frame header" }
        val chunk = maxPayload - HEADER_SIZE
        val count = (packet.size + chunk - 1) / chunk
        require(count in 1..BleConstants.MAX_FRAGMENTS) { "fragment count out of range" }
        val out = ArrayList<ByteArray>(count)
        for (index in 0 until count) {
            val start = index * chunk
            val end = minOf(start + chunk, packet.size)
            val buf = ByteBuffer.allocate(HEADER_SIZE + (end - start))
            buf.order(ByteOrder.LITTLE_ENDIAN)
            buf.putInt(packet.size)
            buf.putShort(index.toShort())
            buf.putShort(count.toShort())
            buf.put(packet, start, end - start)
            out.add(buf.array())
        }
        return out
    }

    /** Parsed header of one frame; null when the frame is malformed. */
    data class Header(val total: Int, val index: Int, val count: Int)

    fun parseHeader(frame: ByteArray): Header? {
        if (frame.size < HEADER_SIZE) return null
        val buf = ByteBuffer.wrap(frame).order(ByteOrder.LITTLE_ENDIAN)
        val total = buf.int
        val index = buf.short.toInt() and 0xFFFF
        val count = buf.short.toInt() and 0xFFFF
        if (total <= 0 || total > BleConstants.MAX_PACKET_BYTES) return null
        if (count <= 0 || count > BleConstants.MAX_FRAGMENTS) return null
        if (index < 0 || index >= count) return null
        if (frame.size == HEADER_SIZE && total > 0 && count > 1) {
            // Empty non-terminal fragment carries no data; reject as invalid.
            return null
        }
        return Header(total, index, count)
    }

    fun payloadOf(frame: ByteArray): ByteArray =
        frame.copyOfRange(HEADER_SIZE, frame.size)
}

/**
 * Per-peer reassembly buffer.
 *
 * Usage: call [feed] with each received frame. Returns the complete packet
 * the moment the final missing fragment arrives, otherwise null.
 * Incomplete/duplicated/invalid fragments never produce output.
 * Call [isStale] periodically (or before feed) to drop abandoned transfers.
 */
class BleReassembler {
    private var total: Int = -1
    private var count: Int = -1
    private var parts: Array<ByteArray?>? = null
    private var received: Int = 0
    private var lastActivity: Long = System.currentTimeMillis()

    /** Feed one frame. Returns complete packet or null. */
    @Synchronized
    fun feed(frame: ByteArray): ByteArray? {
        pruneIfStale(System.currentTimeMillis())
        val header = BleFrameCodec.parseHeader(frame) ?: run {
            reset()
            return null
        }
        if (total == -1) {
            total = header.total
            count = header.count
            parts = arrayOfNulls(count)
            received = 0
        } else if (header.total != total || header.count != count) {
            // New transfer started mid-buffer (or corrupt stream): restart.
            reset()
            total = header.total
            count = header.count
            parts = arrayOfNulls(count)
            received = 0
        }
        val slots = parts ?: return null
        lastActivity = System.currentTimeMillis()
        if (slots[header.index] != null) {
            return null // duplicate fragment: ignore, keep waiting
        }
        slots[header.index] = BleFrameCodec.payloadOf(frame)
        received++
        if (received < count) return null
        // All fragments present: reconstruct and verify exact length.
        val out = ByteArray(total)
        var offset = 0
        for (i in 0 until count) {
            val part = slots[i] ?: run {
                reset()
                return null
            }
            val last = i == count - 1
            if (!last && offset + part.size > total) {
                reset()
                return null
            }
            val copyLen = if (last) total - offset else part.size
            if (copyLen < 0 || copyLen > part.size) {
                reset()
                return null
            }
            part.copyInto(out, offset, 0, copyLen)
            offset += copyLen
        }
        if (offset != total) {
            reset()
            return null
        }
        reset()
        return out
    }

    fun isStale(now: Long): Boolean =
        total != -1 && now - lastActivity > BleConstants.REASSEMBLY_TIMEOUT_MS

    @Synchronized
    fun pruneIfStale(now: Long) {
        if (isStale(now)) reset()
    }

    @Synchronized
    fun reset() {
        total = -1
        count = -1
        parts = null
        received = 0
        lastActivity = System.currentTimeMillis()
    }
}
