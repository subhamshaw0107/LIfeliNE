import { MeshTransport, PacketReceivedCallback } from './meshTransport';

/**
 * MockMeshTransport — simulated M2 transport for tests and UI demo.
 *
 * TRANSPORT-ONLY responsibilities (no M3 logic here):
 *  - Move raw bytes between registered nodes.
 *  - Track per-node peer connectivity (who is in radio range).
 *  - Invoke the destination node's receive callbacks.
 *
 * It MUST NOT implement: SOS business logic, deduplication, TTL decisions,
 * geo-triage, ACK logic, priority or storage decisions. Those live in
 * PacketEngine (M3). This class only decides HOW bytes move.
 *
 * Wiring model (shared virtual medium):
 *  - Each simulated device owns ONE MockMeshTransport with its own nodeId.
 *  - All instances self-register in a static network map:
 *        nodeId -> Set of live transport instances
 *  - `sendPacket(peerId, bytes)` looks up the destination node's
 *    transport(s) and invokes THEIR `onPacketReceived` listeners with
 *    (senderNodeId, bytesCopy). Awaiting `sendPacket` therefore awaits
 *    delivery to the destination PacketEngine (provided the engine's
 *    callback returns its processing promise — see PacketEngine.setTransport).
 *  - `connectedPeers` acts as radio range: sending to a peer that is not
 *    in the set returns false (no crash).
 *  - Sending to an unknown nodeId (nothing registered) returns false.
 *
 * Legacy support:
 *  - `registerPeerInbox(peerId, fn)` is kept for older hand-wired tests.
 *    `sendPacket` also delivers to those inboxes, so previous wiring keeps
 *    working while new tests use the automatic node registry.
 *  - `simulateIncomingBytes()` remains for isolated unit tests that inject
 *    bytes without a sender transport.
 */
export class MockMeshTransport implements MeshTransport {
  readonly name = 'MOCK_IN_MEMORY_TRANSPORT';

  private nodeId: string;
  private connectedPeers: Set<string> = new Set(['NODE-PERSON-B', 'NODE-PERSON-C', 'NODE-RESCUE-CMD']);
  private listeners: PacketReceivedCallback[] = [];
  private peerInboxes: Map<string, ((bytes: Uint8Array) => void)[]> = new Map();

  /** Shared virtual medium: nodeId -> live transport instances. */
  private static network: Map<string, Set<MockMeshTransport>> = new Map();

  constructor(nodeId?: string, connectedPeers?: string[]) {
    this.nodeId = nodeId ?? 'NODE-LOCAL';
    if (connectedPeers) {
      this.connectedPeers = new Set(connectedPeers);
    }
    MockMeshTransport.registerOnNetwork(this.nodeId, this);
  }

  // ------------------------------------------------------------------
  // Identity / registry
  // ------------------------------------------------------------------

  getNodeId(): string {
    return this.nodeId;
  }

  setNodeId(id: string): void {
    if (id === this.nodeId) return;
    MockMeshTransport.unregisterFromNetwork(this.nodeId, this);
    this.nodeId = id;
    MockMeshTransport.registerOnNetwork(this.nodeId, this);
  }

  private static registerOnNetwork(nodeId: string, instance: MockMeshTransport): void {
    let set = MockMeshTransport.network.get(nodeId);
    if (!set) {
      set = new Set();
      MockMeshTransport.network.set(nodeId, set);
    }
    set.add(instance);
  }

  private static unregisterFromNetwork(nodeId: string, instance: MockMeshTransport): void {
    const set = MockMeshTransport.network.get(nodeId);
    if (!set) return;
    set.delete(instance);
    if (set.size === 0) {
      MockMeshTransport.network.delete(nodeId);
    }
  }

  /** Test helper: wipe the shared medium between suites. */
  static resetNetwork(): void {
    MockMeshTransport.network.clear();
  }

  /** Test helper: detach this instance from the shared medium. */
  dispose(): void {
    MockMeshTransport.unregisterFromNetwork(this.nodeId, this);
  }

  // ------------------------------------------------------------------
  // Peer / range management (simulated radio visibility)
  // ------------------------------------------------------------------

  setConnectedPeers(peers: string[]): void {
    this.connectedPeers = new Set(peers);
  }

  addPeer(peerId: string): void {
    this.connectedPeers.add(peerId);
  }

  removePeer(peerId: string): void {
    this.connectedPeers.delete(peerId);
  }

  async getConnectedPeers(): Promise<string[]> {
    return Array.from(this.connectedPeers);
  }

  // ------------------------------------------------------------------
  // M2 byte movement
  // ------------------------------------------------------------------

  async sendPacket(peerId: string, packetBytes: Uint8Array): Promise<boolean> {
    // 1. Range check — peer not in range: clean failure, no crash.
    if (!this.connectedPeers.has(peerId)) {
      return false;
    }

    // Copy bytes so sender-side mutation cannot corrupt in-flight data.
    let bytesCopy: Uint8Array;
    try {
      bytesCopy = packetBytes.slice();
    } catch {
      return false;
    }

    // Simulate radio transmission latency
    await new Promise(r => setTimeout(r, 20));

    let delivered = false;

    // 2. Primary path: deliver to destination node's registered transports.
    const destinations = MockMeshTransport.network.get(peerId);
    if (destinations && destinations.size > 0) {
      const senderId = this.nodeId;
      const deliveries: Promise<unknown>[] = [];
      for (const dest of destinations) {
        for (const listener of [...dest.listeners]) {
          try {
            deliveries.push(Promise.resolve(listener(senderId, bytesCopy.slice())));
          } catch {
            // One bad listener must not crash the transport.
          }
        }
      }
      if (deliveries.length > 0) {
        await Promise.all(deliveries);
      }
      // Bytes reached the addressed device even if it currently has no
      // receive listener attached (M3 just isn't listening yet).
      delivered = true;
    }

    // 3. Legacy path: hand-wired peer inboxes on the SENDER transport
    //    (backwards compatibility with older tests). These fire in addition
    //    to — never instead of — the registry path above.
    const legacyListeners = this.peerInboxes.get(peerId);
    if (legacyListeners && legacyListeners.length > 0) {
      await Promise.all(
        legacyListeners.map(fn => {
          try {
            return Promise.resolve(fn(bytesCopy.slice()));
          } catch {
            return Promise.resolve();
          }
        })
      );
      delivered = true;
    }

    // 4. Unknown peer (not on the network and no legacy inbox): failure.
    return delivered;
  }

  async broadcastPacket(packetBytes: Uint8Array): Promise<boolean> {
    const peers = Array.from(this.connectedPeers);
    let anySent = false;
    for (const peer of peers) {
      try {
        const ok = await this.sendPacket(peer, packetBytes);
        if (ok) anySent = true;
      } catch {
        // Per-peer failure must not abort the broadcast loop.
      }
    }
    return anySent;
  }

  onPacketReceived(callback: PacketReceivedCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Helper to simulate a packet physically arriving from a peer.
   * Kept for isolated unit tests. The multi-hop integration test must use
   * sendPacket()/broadcastPacket() instead so delivery goes through M2.
   */
  async simulateIncomingBytes(fromPeerId: string, packetBytes: Uint8Array): Promise<void> {
    await Promise.all(this.listeners.map(cb => Promise.resolve(cb(fromPeerId, packetBytes))));
  }

  /**
   * @deprecated Prefer per-node transports on the shared network
   * (new MockMeshTransport(nodeId, peers) + engine.setTransport(ownTransport)).
   * Kept so previously hand-wired suites continue to pass.
   */
  registerPeerInbox(peerId: string, listener: (bytes: Uint8Array) => Promise<unknown> | void): () => void {
    let list = this.peerInboxes.get(peerId);
    if (!list) {
      list = [];
      this.peerInboxes.set(peerId, list);
    }
    list.push(listener as (bytes: Uint8Array) => void);
    return () => {
      const current = this.peerInboxes.get(peerId) || [];
      this.peerInboxes.set(peerId, current.filter(fn => fn !== listener));
    };
  }

}

export const mockMeshTransport = new MockMeshTransport();
