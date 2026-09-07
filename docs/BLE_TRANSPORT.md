# LIFELINE BLE Transport (M2)

Physical byte transport for the mesh. M3 (`PacketEngine`) makes every packet
decision; this layer only moves opaque bytes between phones.

## Service & characteristics (128-bit UUIDs)

| Role | UUID |
|---|---|
| Service | `c8f6e58a-1f2b-4d3c-8e4f-5a6b7c8d9e0f` |
| RX (central → peripheral writes) | `...9e01` (WRITE, with response) |
| TX (peripheral → central notifies) | `...9e02` (NOTIFY + CCCD `2902`) |
| PEER_ID (readable stable id) | `...9e03` (READ, UTF-8 UUID-36) |

Each phone runs **both roles concurrently**: GATT server (advertise + RX/TX)
and GATT client (scan + connect + read/notify). Direction A→B uses A's
central-side RX write when A connected to B, else B's TX notify when B is
subscribed — whichever link exists.

## Frame format (byte order: LITTLE_ENDIAN, all fields)

```
[0..3] total packet length (u32)   -- full reassembled size
[4..5] fragment index      (u16)   -- 0-based
[6..7] fragment count      (u16)   -- >= 1
[8..]  payload
```

Caps: packet ≤ 8192 B, fragments ≤ 512, buffer timeout 30 s. Violations,
duplicates, and stale/incomplete buffers are dropped — output happens only
for complete, length-verified packets.

## MTU behavior

- Default ATT MTU 23 → 20 B usable (23 − 3 ATT overhead).
- `requestMtu(517)` after every connect; per-connection MTU tracked from
  `onMtuChanged`; usable frame payload = `mtu − 3 − 8` (header).
- 517 is **never assumed**: 694 B SOS ≈ 58 frames at MTU 23, 2 frames at 517.
- Writes are queued (one outstanding GATT write) and use WRITE_TYPE_DEFAULT.

## Stable peer IDs

Android randomizes MACs, so identity is an app UUID in SharedPreferences,
served on PEER_ID and announced once per connection as the 40-byte ASCII
message `LID:<uuid>` (first RX message only). Native code maps
address↔stable-id internally; TypeScript sees stable ids only.
M3 packet format is untouched.

## Capacitor bridge (`BleMesh` plugin)

Methods: `initialize`, `requestPermissions`, `startScan/stopScan`,
`startAdvertising/stopAdvertising`, `connect(peerId|address)`,
`disconnect`, `send(peerId, base64)`, `getConnectedPeers`.
Events: `packetReceived {peerId, data}`, `peerConnected`,
`peerDisconnected`, `peerFound {address, name, rssi}`.
Bytes cross as **base64 NO_WRAP** (`Uint8Array↔base64` in
`bleMeshTransport.ts`, `Base64.NO_WRAP` in Kotlin).

## Android permissions

- API 31+: `BLUETOOTH_SCAN` (neverForLocation), `BLUETOOTH_ADVERTISE`,
  `BLUETOOTH_CONNECT`; API 33+: `POST_NOTIFICATIONS`.
- API ≤30: `BLUETOOTH`, `BLUETOOTH_ADMIN`, `ACCESS_FINE_LOCATION`.
- Radio never starts before grant; denial resolves `{granted:false}` —
  the app falls back to mock transport, never crashes.
- Foreground service `BleMeshService` (type `connectedDevice`) keeps
  relay scans alive; holds no packet state.

## Failure behavior (M3 SCF depends on this)

`sendPacket()` returns `false` (never throws) for: BLE unavailable,
peer unknown/disconnected, write failure, empty payload, malformed args
at the bridge. M3 retains + retries via Store-Carry-Forward.

## MeshTransport connection

`BleMeshTransport implements MeshTransport` (`src/transport/`):
base64 at the boundary, complete-packets-only forwarding, boolean
failures. `bleTransportFactory` selects BLE on native hosts with the
plugin present, else `MockMeshTransport`. `demoMeshNetwork` swaps only
`selfTransport` (virtual B/C/HQ peers stay mocked); `PacketEngine`,
packet format, dedup/TTL/SCF/triage/ACK are unchanged.
BLE pairing ("Just Works") is NOT app security — M3 AES-GCM payloads are.

## Status

✅ unit-tested without hardware (`tests/ble/`) · ✅ web build ·
❌ physical two-phone verification NOT performed (requires 2 Android
devices with the release APK).
