import type { MeshTransport, PacketReceivedCallback } from './meshTransport';

/**
 * Byte encoding across the Capacitor bridge.
 *
 * Capacitor's JSON bridge cannot carry raw Uint8Array, so every packet is
 * base64-encoded on the way out and decoded on the way in:
 *
 *   M3 Uint8Array --uint8ToBase64--> base64 string --bridge--> Kotlin
 *   Kotlin ByteArray --base64--> string --bridge--> base64ToUint8 --> M3
 *
 * Kotlin side uses android.util.Base64 with NO_WRAP (single line, standard
 * alphabet with padding) — byte-identical to the btoa/atob pair below.
 * No SOS parsing happens here; this is a byte-format conversion only.
 */

const BASE64_CHUNK = 0x8000;

/** Uint8Array -> base64 string (works in browsers and Node via btoa). */
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    const slice = bytes.subarray(i, i + BASE64_CHUNK);
    binary += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return btoa(binary);
}

/** base64 string -> Uint8Array. Throws on malformed input (caller drops). */
export function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i) & 0xff;
  }
  return out;
}

/** Listener handle as returned by Capacitor's addListener (or fakes). */
export interface BleListenerHandle {
  remove(): void | Promise<void>;
}

export type BlePacketEvent = { peerId: string; data: string };
export type BlePeerEvent = { peerId: string };
export type BleFoundEvent = { address: string; name: string; rssi: number };

/**
 * Minimal surface of the native "BleMesh" Capacitor plugin consumed by
 * BleMeshTransport. Mirrors BleMeshPlugin.kt one-to-one.
 */
export interface BleNativeBridge {
  initialize(): Promise<{ peerId: string; supported: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  startScan(): Promise<{ started: boolean }>;
  stopScan(): Promise<void>;
  startAdvertising(): Promise<{ started: boolean }>;
  stopAdvertising(): Promise<void>;
  connect(peerId: string): Promise<{ ok: boolean }>;
  disconnect(peerId: string): Promise<{ ok: boolean }>;
  send(peerId: string, dataBase64: string): Promise<{ ok: boolean }>;
  getConnectedPeers(): Promise<{ peers: string[] }>;
  addListener(
    event: 'packetReceived',
    callback: (payload: BlePacketEvent) => void
  ): BleListenerHandle | Promise<BleListenerHandle>;
  addListener(
    event: 'peerConnected' | 'peerDisconnected',
    callback: (payload: BlePeerEvent) => void
  ): BleListenerHandle | Promise<BleListenerHandle>;
  addListener(
    event: 'peerFound',
    callback: (payload: BleFoundEvent) => void
  ): BleListenerHandle | Promise<BleListenerHandle>;
}

/**
 * BleMeshTransport — MeshTransport over the native Android BLE plugin.
 *
 * Responsibilities (transport only):
 *  - base64 encode/decode at the bridge boundary
 *  - track this device's stable native peer id
 *  - send/broadcast/peer-list via the bridge, boolean failure semantics
 *  - forward ONLY decodable complete packets to M3 callbacks
 *    (native layer already reassembles; undecodable payloads are dropped)
 *
 * It MUST NOT deserialize SOS packets, inspect TTL/hops, deduplicate,
 * store, route, or encrypt — all of that is PacketEngine (M3).
 */
export class BleMeshTransport implements MeshTransport {
  readonly name = 'BLE_MESH_TRANSPORT';

  private nodeId: string;
  private readonly bridge: BleNativeBridge;
  private listeners: PacketReceivedCallback[] = [];
  private bridgeSubscribed = false;
  private bridgeHandles: BleListenerHandle[] = [];
  private started = false;

  constructor(nodeIdHint: string, bridge: BleNativeBridge) {
    this.nodeId = nodeIdHint;
    this.bridge = bridge;
  }

  /** Stable native peer id (== nodeId after initialize, else the hint). */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * Bring up the radio: permissions -> scan + advertise -> event wiring.
   * Returns false (never throws) when BLE is unavailable or denied;
   * callers fall back to mock transport / SCF hold behavior.
   */
  async start(): Promise<boolean> {
    if (this.started) return true;
    try {
      const info = await this.bridge.initialize();
      if (!info || info.supported === false) return false;
      if (info.peerId) this.nodeId = info.peerId;
      const perms = await this.bridge.requestPermissions();
      if (!perms || perms.granted !== true) return false;
      await this.ensureSubscribed();
      try {
        await this.bridge.startScan();
      } catch {
        return false;
      }
      try {
        await this.bridge.startAdvertising();
      } catch {
        return false;
      }
      this.started = true;
      return true;
    } catch {
      return false;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.bridge.stopScan();
    } catch {
      // ignore shutdown races
    }
    try {
      await this.bridge.stopAdvertising();
    } catch {
      // ignore shutdown races
    }
    this.started = false;
  }

  /** Release bridge listeners (app teardown / tests). */
  async dispose(): Promise<void> {
    await this.stop();
    for (const handle of this.bridgeHandles) {
      try {
        await handle.remove();
      } catch {
        // ignore
      }
    }
    this.bridgeHandles = [];
    this.bridgeSubscribed = false;
    this.listeners = [];
  }

  async sendPacket(peerId: string, packetBytes: Uint8Array): Promise<boolean> {
    if (!peerId || !packetBytes || packetBytes.length === 0) return false;
    try {
      const peers = await this.getConnectedPeers();
      if (!peers.includes(peerId)) return false;
      const result = await this.bridge.send(peerId, uint8ToBase64(packetBytes));
      return result != null && result.ok === true;
    } catch {
      // Normal radio failure -> boolean false (M3 SCF retains the packet).
      return false;
    }
  }

  async broadcastPacket(packetBytes: Uint8Array): Promise<boolean> {
    if (!packetBytes || packetBytes.length === 0) return false;
    let peers: string[];
    try {
      peers = await this.getConnectedPeers();
    } catch {
      return false;
    }
    let anySent = false;
    for (const peer of peers) {
      try {
        const result = await this.bridge.send(peer, uint8ToBase64(packetBytes));
        if (result != null && result.ok === true) anySent = true;
      } catch {
        // Per-peer failure must not abort the broadcast loop.
      }
    }
    return anySent;
  }

  async getConnectedPeers(): Promise<string[]> {
    try {
      const result = await this.bridge.getConnectedPeers();
      const peers = result != null && Array.isArray(result.peers) ? result.peers : [];
      return peers.filter(p => typeof p === 'string' && p.length > 0);
    } catch {
      return [];
    }
  }

  onPacketReceived(callback: PacketReceivedCallback): () => void {
    this.listeners.push(callback);
    // Lazily wire bridge events even if start() was never called.
    void this.ensureSubscribed();
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private async ensureSubscribed(): Promise<void> {
    if (this.bridgeSubscribed) return;
    this.bridgeSubscribed = true;
    try {
      const handle = await this.bridge.addListener('packetReceived', payload => {
        this.deliverFromBridge(payload);
      });
      this.bridgeHandles.push(handle);
    } catch {
      this.bridgeSubscribed = false;
    }
  }

  private deliverFromBridge(payload: BlePacketEvent): void {
    if (
      payload == null ||
      typeof payload.peerId !== 'string' ||
      typeof payload.data !== 'string'
    ) {
      return;
    }
    let bytes: Uint8Array;
    try {
      bytes = base64ToUint8(payload.data);
    } catch {
      return; // undecodable: never forward garbage to PacketEngine
    }
    if (bytes.length === 0) return;
    const sender = payload.peerId;
    const snapshot = [...this.listeners];
    for (const listener of snapshot) {
      try {
        listener(sender, bytes.slice());
      } catch {
        // One bad M3 listener must not break delivery to the rest.
      }
    }
  }
}
