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

  /** Peer-set change notification (snapshot array, never the live Set). */
export type PeersChangedCallback = (peerIds: string[]) => void;

/** Snapshot of live radio state for diagnostics. No secrets, no packet bytes. */
export interface BleDiagnostics {
  initialized: boolean;
  permissionsGranted: boolean | null;
  advertising: boolean;
  scanning: boolean;
  localPeerId: string;
  connectedPeers: string[];
  discoveredCount: number;
  lastPeerFound: string | null;
  lastConnectionState: string;
  lastPacketReceived: { peerId: string; bytes: number; at: number } | null;
  lastPacketSent: { peerId: string; bytes: number; ok: boolean; at: number } | null;
}

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
  private peerListeners: PeersChangedCallback[] = [];
  private connectedPeers: Set<string> = new Set();
  private bridgeSubscribed = false;
  private bridgeHandles: BleListenerHandle[] = [];
  private started = false;
  // Diagnostic-only runtime state (never SOS content, never keys).
  private diagInitialized = false;
  private diagPermissions: boolean | null = null;
  private diagAdvertising = false;
  private diagScanning = false;
  private diagDiscovered = new Map<string, { name: string; rssi: number; at: number }>();
  private diagLastPeerFound: string | null = null;
  private diagLastConnection = 'never connected';
  private diagLastRx: { peerId: string; bytes: number; at: number } | null = null;
  private diagLastTx: { peerId: string; bytes: number; ok: boolean; at: number } | null = null;
  // Last auto-connect attempt per discovered address (ms epoch). Prevents
  // hot-looping connectGatt on repeated scan hits; stale entries re-arm.
  private lastConnectAttempt = new Map<string, number>();
  private static readonly CONNECT_COOLDOWN_MS = 15000;
  private static readonly MAX_TRACKED_ADDRESSES = 200;

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
      this.diagInitialized = true;
      console.log('[BLE-DIAG] initialize');
      if (!info || info.supported === false) return false;
      if (info.peerId) this.nodeId = info.peerId;
      const perms = await this.bridge.requestPermissions();
      this.diagPermissions = perms?.granted === true;
      console.log(`[BLE-DIAG] permissions granted=${this.diagPermissions}`);
      if (!perms || perms.granted !== true) return false;
      await this.ensureSubscribed();
      try {
        await this.bridge.startScan();
        this.diagScanning = true;
        console.log('[BLE-DIAG] scanning started=true');
      } catch {
        console.log('[BLE-DIAG] scanning started=false');
        return false;
      }
      // Advertising is best-effort: a missing advertiser (unsupported
      // chipset, transient stack failure) must NOT kill scanning — the
      // phone can still discover and connect as a central (scan-only mode).
      let advertising = false;
      try {
        const adResult = await this.bridge.startAdvertising();
        advertising = adResult != null && adResult.started !== false;
      } catch {
        advertising = false;
      }
      this.diagAdvertising = advertising;
      console.log(`[BLE-DIAG] advertising started=${advertising}`);
      if (!advertising) {
        console.log('[BLE-DIAG] continuing in scan-only mode');
      }
      this.started = true;
      // DIAG-LOG: temporary physical-test aid (remove after field verification).
      console.log(`[BLE-DIAG] radio started, nodeId=${this.nodeId}`);
      console.log('[BLE-DIAG] transport = REAL_BLE');
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
    this.diagScanning = false;
    this.diagAdvertising = false;
    this.started = false;
    this.diagScanning = false;
    this.diagAdvertising = false;
  }

  /** Read-only radio snapshot for diagnostics. No secrets, no packet bytes. */
  getDiagnostics(): BleDiagnostics {
    return {
      initialized: this.diagInitialized,
      permissionsGranted: this.diagPermissions,
      advertising: this.diagAdvertising,
      scanning: this.diagScanning,
      localPeerId: this.nodeId,
      connectedPeers: [...this.connectedPeers],
      discoveredCount: this.diagDiscovered.size,
      lastPeerFound: this.diagLastPeerFound,
      lastConnectionState: this.diagLastConnection,
      lastPacketReceived: this.diagLastRx,
      lastPacketSent: this.diagLastTx,
    };
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
    this.peerListeners = [];
    this.connectedPeers.clear();
  }

  async sendPacket(peerId: string, packetBytes: Uint8Array): Promise<boolean> {
    if (!peerId || !packetBytes || packetBytes.length === 0) return false;
    try {
      const peers = await this.getConnectedPeers();
      if (!peers.includes(peerId)) return false;
      const result = await this.bridge.send(peerId, uint8ToBase64(packetBytes));
      const ok = result != null && result.ok === true;
      this.diagLastTx = { peerId, bytes: packetBytes.length, ok, at: Date.now() };
      console.log(`[BLE-DIAG] send: to=${peerId} bytes=${packetBytes.length} ok=${ok}`);
      return ok;
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
      const connectedHandle = await this.bridge.addListener('peerConnected', payload => {
        this.handlePeerConnected(payload);
      });
      this.bridgeHandles.push(connectedHandle);
      const disconnectedHandle = await this.bridge.addListener('peerDisconnected', payload => {
        this.handlePeerDisconnected(payload);
      });
      this.bridgeHandles.push(disconnectedHandle);
      // Discovery drives auto-connect: a found LIFELINE peer gets one
      // connectGatt attempt (cooldown-guarded). Found alone never counts
      // as connected — only peerConnected promotes to the connected set.
      const foundHandle = await this.bridge.addListener('peerFound', payload => {
        this.handlePeerFound(payload);
      });
      this.bridgeHandles.push(foundHandle);
    } catch {
      this.bridgeSubscribed = false;
    }
  }

  /**
   * Observe the connected-peer set. Fires with a snapshot array on every
   * connect/disconnect (never the mutable Set). Discovery (peerFound)
   * never triggers this — found is not connected.
   */
  onPeersChanged(callback: PeersChangedCallback): () => void {
    this.peerListeners.push(callback);
    // Lazily wire bridge events even if start() was never called.
    void this.ensureSubscribed();
    return () => {
      this.peerListeners = this.peerListeners.filter(cb => cb !== callback);
    };
  }

  private handlePeerConnected(payload: BlePeerEvent): void {
    if (payload == null || typeof payload.peerId !== 'string' || payload.peerId.length === 0) {
      return;
    }
    if (this.connectedPeers.has(payload.peerId)) return;
    this.connectedPeers.add(payload.peerId);
    this.diagLastConnection = `connected ${payload.peerId}`;
    console.log(`[BLE-DIAG] peer connected: ${payload.peerId}`);
    this.notifyPeerListeners();
  }

  private handlePeerDisconnected(payload: BlePeerEvent): void {
    if (payload == null || typeof payload.peerId !== 'string' || payload.peerId.length === 0) {
      return;
    }
    if (!this.connectedPeers.delete(payload.peerId)) return;
    this.diagLastConnection = `disconnected ${payload.peerId}`;
    console.log(`[BLE-DIAG] peer disconnected: ${payload.peerId}`);
    this.notifyPeerListeners();
  }

  /**
   * Auto-connect on discovery: the missing link that left two advertising
   * phones permanently unlinked (scan + advertise ran, but nobody ever
   * called connectGatt). Only while the radio is up; cooldown-guarded per
   * address so repeated scan hits don't hot-loop; the native side dedups
   * already-connected addresses. Discovery alone still never counts as
   * connected — only peerConnected promotes to the connected set.
   */
  private handlePeerFound(payload: { address?: string; name?: string; rssi?: number } | null): void {
    if (payload == null || typeof payload.address !== 'string' || payload.address.length === 0) {
      return;
    }
    const address = payload.address;
    this.diagDiscovered.set(address, {
      name: typeof payload.name === 'string' ? payload.name : '',
      rssi: typeof payload.rssi === 'number' ? payload.rssi : 0,
      at: Date.now(),
    });
    if (this.diagDiscovered.size > BleMeshTransport.MAX_TRACKED_ADDRESSES) {
      const oldest = [...this.diagDiscovered.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (oldest) this.diagDiscovered.delete(oldest[0]);
    }
    this.diagLastPeerFound = address;
    console.log(`[BLE-DIAG] peer found: ${address}`);
    if (!this.started) return;
    const now = Date.now();
    const last = this.lastConnectAttempt.get(address) ?? 0;
    if (now - last < BleMeshTransport.CONNECT_COOLDOWN_MS) return;
    this.lastConnectAttempt.set(address, now);
    console.log(`[BLE-DIAG] connecting: ${address}`);
    try {
      const result = this.bridge.connect(address);
      if (result != null && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).catch(() => {
          // Next scan sighting (after cooldown) retries.
        });
      }
    } catch {
      // Next scan sighting (after cooldown) retries.
    }
  }

  private notifyPeerListeners(): void {
    const snapshot = [...this.connectedPeers];
    for (const listener of [...this.peerListeners]) {
      try {
        listener(snapshot);
      } catch {
        // One bad consumer must not break notification to the rest.
      }
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
    this.diagLastRx = { peerId: sender, bytes: bytes.length, at: Date.now() };
    console.log(`[BLE-DIAG] JS packetReceived: from=${sender} bytes=${bytes.length}`);
    // DIAG-LOG: temporary physical-test aid (remove after field verification).
    console.log(`[BLE-DIAG] packet from ${sender}, ${bytes.length} bytes -> M3`);
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
