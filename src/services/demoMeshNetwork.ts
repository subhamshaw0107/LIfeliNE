import {
  SosPacket,
  AckPacket,
  MeshNode,
  EmergencyPriority,
  RiskLevel,
  SimpleNetworkStatus,
} from '../types';
import { PacketEngine, packetEngine } from './packetEngine';
import type { MeshTransport } from '../transport/meshTransport';
import { MockMeshTransport } from '../transport/mockMeshTransport';
import { BleMeshTransport } from '../transport/bleMeshTransport';
import {
  createSelfTransport,
  upgradeToBleIfAvailable,
  type BleEnvironment,
} from './bleTransportFactory';
import { StorageEngine } from '../storage/storageEngine';
import { SosRepository, sosRepository } from '../repositories/sosRepository';
import { DeduplicationService } from './deduplicationService';
import { storageService } from './storageService';
import { meshEngine } from './meshEngine';

/**
 * DemoMeshNetwork — application-runtime wiring for the unified architecture:
 *
 *   UI (AppContext)
 *     ↓
 *   PacketEngine  (M3: dedup, TTL/hops, geo-triage, SCF, ACK)
 *     ↓
 *   MeshTransport (M2: how bytes move)
 *     ↓
 *   MockMeshTransport chain (demo stand-in for real BLE/Wi-Fi peers)
 *
 * This device is ONE node (PHONE-A). The relay volunteers (NODE-PERSON-B/C)
 * and the Rescue HQ gateway (NODE-RESCUE-CMD) are virtual peer devices that
 * each run a REAL PacketEngine — exactly like physical phones would. Bytes
 * travel between them only via MeshTransport.sendPacket(). No routing logic
 * lives here or in meshEngine; this class only wires engines to transports,
 * mirrors HQ delivery into the on-device store for the Rescue dashboard, and
 * publishes transport status to the meshEngine visualization bus.
 *
 * When the real M2 radio transport lands, it replaces the MockMeshTransport
 * instances below (same MeshTransport interface) — PacketEngine is untouched.
 */

export const DEMO_SELF_NODE_ID = 'PHONE-A';
export const DEMO_RELAY_B_NODE_ID = 'NODE-PERSON-B';
export const DEMO_RELAY_C_NODE_ID = 'NODE-PERSON-C';
export const DEMO_HQ_NODE_ID = 'NODE-RESCUE-CMD';

export type DemoMeshStage =
  | 'STORE'
  | 'FORWARD'
  | 'DELIVERED'
  | 'ACK'
  | 'WAITING_RELAY';

export interface DemoMeshProgress {
  packetId: string;
  stage: DemoMeshStage;
  nodeId: string;
  /** Latest known copy of the SOS (route/hopCount/status) for UI trackers. */
  packet: SosPacket | null;
}

type ProgressCallback = (progress: DemoMeshProgress) => void;

const STAGE_STATUS: Record<DemoMeshStage, SimpleNetworkStatus | null> = {
  STORE: null,
  FORWARD: 'FORWARDED',
  DELIVERED: 'DELIVERED',
  ACK: null,
  WAITING_RELAY: 'WAITING_RELAY',
};

class DemoMeshNetwork {
  /**
   * This device's radio link (M2). Starts as mock so browser/demo/tests
   * work everywhere; upgraded to real BLE on capable Android devices
   * (see enableNativeBle). Virtual relay peers always stay mocked.
   */
  selfTransport: MeshTransport;
  private readonly relayBTransport: MockMeshTransport;
  private readonly relayCTransport: MockMeshTransport;
  private readonly hqTransport: MockMeshTransport;

  /** This device's M3 engine — the shared singleton, also used by tests. */
  private readonly selfEngine: PacketEngine = packetEngine;
  private readonly relayBEngine: PacketEngine;
  private readonly relayCEngine: PacketEngine;
  private readonly hqEngine: PacketEngine;

  private readonly relayBRepo: SosRepository;
  private readonly relayCRepo: SosRepository;
  private readonly hqRepo: SosRepository;

  private progressListeners: ProgressCallback[] = [];

  /**
   * Latest real BLE connected-peer snapshot (stable native IDs, verbatim).
   * Empty unless selfTransport is a live BleMeshTransport. Virtual demo
   * nodes (B/C/HQ) never appear here.
   */
  private realPeerIds: string[] = [];
  private realPeerListeners: Array<(peerIds: string[]) => void> = [];
  private realPeersUnsub: (() => void) | null = null;

  constructor() {
    // This device owns one transport; virtual peers own theirs.
    this.selfTransport = createSelfTransport(DEMO_SELF_NODE_ID);
    this.relayBTransport = new MockMeshTransport(DEMO_RELAY_B_NODE_ID);
    this.relayCTransport = new MockMeshTransport(DEMO_RELAY_C_NODE_ID);
    this.hqTransport = new MockMeshTransport(DEMO_HQ_NODE_ID);
    this.applyDefaultTopology();

    // Self engine runs on the app's on-device store so victim SOS packets,
    // ACKs and status updates are visible to the Rescue dashboard.
    this.selfEngine.setLocalNodeId(DEMO_SELF_NODE_ID);
    this.selfEngine.setTransport(this.selfTransport);
    // Mock selfTransport has no real peers; a later BLE swap subscribes
    // via watchRealPeers() inside enableNativeBle().
    this.watchRealPeers();
    // Opportunistic radio upgrade: real BLE on capable Android, mock
    // everywhere else (no-op there). Virtual peers are untouched.
    void this.enableNativeBle();

    // Virtual peers are stand-ins for other people's phones: isolated stores
    // cleared on boot so demo relays never leak state between sessions.
    const { engine: relayB, repo: repoB } = this.makePeerEngine(
      DEMO_RELAY_B_NODE_ID,
      'demo_relay_b',
      this.relayBTransport
    );
    const { engine: relayC, repo: repoC } = this.makePeerEngine(
      DEMO_RELAY_C_NODE_ID,
      'demo_relay_c',
      this.relayCTransport
    );
    const { engine: hq, repo: repoHq } = this.makePeerEngine(
      DEMO_HQ_NODE_ID,
      'demo_rescue_hq',
      this.hqTransport
    );
    this.relayBEngine = relayB;
    this.relayCRepo = repoC;
    this.relayBRepo = repoB;
    this.relayCEngine = relayC;
    this.hqEngine = hq;
    this.hqRepo = repoHq;

    this.bridgeEngineEvents(this.selfEngine, sosRepository);
    this.bridgeEngineEvents(this.relayBEngine, this.relayBRepo);
    this.bridgeEngineEvents(this.relayCEngine, this.relayCRepo);
    this.bridgeEngineEvents(this.hqEngine, this.hqRepo);

    // HQ delivery + victim ACK arrival are mirrored into the on-device store
    // (same-device demo: the Rescue dashboard reads the local store).
    this.hqEngine.onPacketDelivered(packet => {
      storageService.updateSosStatus(
        packet.id,
        'DELIVERED',
        'Reached Rescue Center via multi-hop mesh (A → B → C → RESCUE).',
        { hopCount: packet.hopCount, ttl: packet.ttl, route: packet.route }
      );
    });
  }

  // ------------------------------------------------------------------
  // UI-facing API (used by AppContext)
  // ------------------------------------------------------------------

  /**
   * Send a locally created SOS through the M3 pipeline and onto the mesh.
   * Full path: validate → dedup → TTL → triage → store → forward via M2.
   */
  async sendSos(packet: SosPacket): Promise<boolean> {
    return this.selfEngine.processPacket(packet);
  }

  /**
   * Rescue-side action: the HQ gateway generates an ACK that travels back
   * over the mesh (HQ → C → B → A) through real M3 processing at each hop.
   */
  async acknowledgeFromHq(
    sosId: string,
    status: 'ACKNOWLEDGED' | 'RESPONDING' | 'RESCUED' = 'ACKNOWLEDGED',
    note?: string
  ): Promise<AckPacket | null> {
    return this.hqEngine.acknowledgeSos(sosId, status, note);
  }

  /**
   * Re-drive Store-Carry-Forward on every node (e.g. a relay moved back
   * into range). Returns the number of packets/ACKs that started moving.
   */
  async resumeAll(): Promise<number> {
    let total = 0;
    total += await this.selfEngine.resumePendingRelays();
    total += await this.relayBEngine.resumePendingRelays();
    total += await this.relayCEngine.resumePendingRelays();
    total += await this.hqEngine.resumePendingRelays();
    return total;
  }

  /**
   * Dynamic priority adaptation: same SOS id, re-sorted urgency on every
   * node holding a queued copy.
   */
  updateQueuedPriority(
    packetId: string,
    newPriority: EmergencyPriority,
    newRiskLevel?: RiskLevel
  ): void {
    this.selfEngine.updateQueuedPriority(packetId, newPriority, newRiskLevel);
    this.relayBEngine.updateQueuedPriority(packetId, newPriority, newRiskLevel);
    this.relayCEngine.updateQueuedPriority(packetId, newPriority, newRiskLevel);
    this.hqEngine.updateQueuedPriority(packetId, newPriority, newRiskLevel);
  }

  /**
   * Swap this device's radio link to real BLE when the host supports it
   * (native Android + BleMesh plugin + granted permissions). Safe to call
   * anywhere: resolves false and keeps mock transport on browsers, in
   * tests, and when BLE/permission is unavailable. Test seam: inject env.
   */
  async enableNativeBle(env?: BleEnvironment): Promise<boolean> {
    const upgraded = await upgradeToBleIfAvailable(
      this.selfTransport,
      DEMO_SELF_NODE_ID,
      transport => {
        this.selfTransport = transport;
        if (transport instanceof BleMeshTransport) {
          this.selfEngine.setLocalNodeId(transport.getNodeId());
        }
        this.selfEngine.setTransport(transport);
        this.watchRealPeers();
      },
      env
    );
    return upgraded;
  }

  /**
   * This device's stable BLE identity, sourced from the native layer's
   * persisted UUID (SharedPreferences) via BleMeshTransport.getNodeId().
   * Returns null unless selfTransport is a live, started BleMeshTransport —
   * so no random/React-generated ID ever competes with the native one,
   * and mock mode never reports a BLE identity.
   */
  getLocalBleId(): string | null {
    if (!(this.selfTransport instanceof BleMeshTransport)) return null;
    const id = this.selfTransport.getNodeId();
    return id && id.length > 0 ? id : null;
  }

  /**
   * Current real BLE connected-peer IDs (verbatim stable native IDs).
   * Empty array unless selfTransport is a live BleMeshTransport.
   */
  getRealPeerIds(): string[] {
    return [...this.realPeerIds];
  }

  /**
   * Observe real BLE connected-peer changes. Fires with the exact snapshot
   * reported by BleMeshTransport on every connect/disconnect — IDs are
   * forwarded unmodified (never mapped to Person A/B/C/D, no coordinates).
   * Mock transports have no real peers and never trigger this.
   */
  onRealPeersChanged(callback: (peerIds: string[]) => void): () => void {
    this.realPeerListeners.push(callback);
    return () => {
      this.realPeerListeners = this.realPeerListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * (Re)subscribe to the self transport's peer events when it is a real
   * BleMeshTransport; otherwise clear any stale subscription and IDs.
   * Virtual B/C/HQ demo transports are never watched.
   */
  private watchRealPeers(): void {
    if (this.realPeersUnsub) {
      try {
        this.realPeersUnsub();
      } catch {
        // ignore teardown races
      }
      this.realPeersUnsub = null;
    }
    if (!(this.selfTransport instanceof BleMeshTransport)) {
      return;
    }
    this.realPeersUnsub = this.selfTransport.onPeersChanged(peerIds => {
      this.realPeerIds = [...peerIds];
      for (const listener of [...this.realPeerListeners]) {
        try {
          listener([...this.realPeerIds]);
        } catch {
          // One bad consumer must not break notification to the rest.
        }
      }
    });
  }

  /**
   * Derive radio links from the visualization topology (range simulator).
   * Link B↔victim follows node B connectivity; the B↔C hop follows node C;
   * the C↔HQ gateway uplink (2.5 km) stays up while node C is up.
   */
  applyVisualizationTopology(nodes: MeshNode[]): void {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const bUp = byId.get(DEMO_RELAY_B_NODE_ID)?.isConnected ?? true;
    const cUp = byId.get(DEMO_RELAY_C_NODE_ID)?.isConnected ?? true;

    // Mock-only range simulation: a real BLE transport discovers its own
    // peers over the air and ignores the visualization topology.
    if (this.selfTransport instanceof MockMeshTransport) {
      this.selfTransport.setConnectedPeers(bUp ? [DEMO_RELAY_B_NODE_ID] : []);
    }
    this.relayBTransport.setConnectedPeers([
      ...(bUp ? [DEMO_SELF_NODE_ID] : []),
      ...(bUp && cUp ? [DEMO_RELAY_C_NODE_ID] : []),
    ]);
    this.relayCTransport.setConnectedPeers([
      ...(bUp && cUp ? [DEMO_RELAY_B_NODE_ID] : []),
      ...(cUp ? [DEMO_HQ_NODE_ID] : []),
    ]);
    this.hqTransport.setConnectedPeers(cUp ? [DEMO_RELAY_C_NODE_ID] : []);
  }

  onProgress(callback: ProgressCallback): () => void {
    this.progressListeners.push(callback);
    return () => {
      this.progressListeners = this.progressListeners.filter(cb => cb !== callback);
    };
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private makePeerEngine(
    nodeId: string,
    storagePrefix: string,
    transport: MeshTransport
  ): { engine: PacketEngine; repo: SosRepository } {
    const storage = new StorageEngine(storagePrefix);
    storage.clearAll();
    const repo = new SosRepository(storage);
    const engine = new PacketEngine({
      localNodeId: nodeId,
      sosRepo: repo,
      dedup: new DeduplicationService(100, storage),
      transport,
    });
    return { engine, repo };
  }

  private applyDefaultTopology(): void {
    if (this.selfTransport instanceof MockMeshTransport) {
      this.selfTransport.setConnectedPeers([DEMO_RELAY_B_NODE_ID]);
    }
    this.relayBTransport.setConnectedPeers([DEMO_SELF_NODE_ID, DEMO_RELAY_C_NODE_ID]);
    this.relayCTransport.setConnectedPeers([DEMO_RELAY_B_NODE_ID, DEMO_HQ_NODE_ID]);
    this.hqTransport.setConnectedPeers([DEMO_RELAY_C_NODE_ID]);
  }

  /**
   * Forward M3 events as UI progress snapshots + visualization-bus status.
   * Read-only w.r.t. routing: never creates, mutates, or forwards packets.
   */
  private bridgeEngineEvents(engine: PacketEngine, repo: SosRepository): void {
    engine.onEvent(event => {
      if (
        event.type !== 'STORE' &&
        event.type !== 'FORWARD' &&
        event.type !== 'DELIVER' &&
        event.type !== 'WAITING_RELAY'
      ) {
        return;
      }
      const stage: DemoMeshStage =
        event.type === 'DELIVER' ? 'DELIVERED' : event.type;
      const status = STAGE_STATUS[stage];
      if (status) {
        meshEngine.setNetworkStatus(status);
      }
      this.emit({
        packetId: event.packetId,
        stage,
        nodeId: event.nodeId,
        packet: repo.getPacket(event.packetId),
      });
    });

    engine.onAckReceived(ack => {
      const local = sosRepository.getPacket(ack.sosId);
      this.emit({
        packetId: ack.sosId,
        stage: 'ACK',
        nodeId: engine.getLocalNodeId(),
        packet: local,
      });
    });
  }

  private emit(progress: DemoMeshProgress): void {
    for (const cb of [...this.progressListeners]) {
      try {
        cb(progress);
      } catch {
        // UI subscriber failure must never break mesh delivery.
      }
    }
  }
}

export const demoMeshNetwork = new DemoMeshNetwork();
