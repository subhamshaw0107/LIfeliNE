import { MeshTransport, PacketReceivedCallback } from './meshTransport';

export class MockMeshTransport implements MeshTransport {
  readonly name = 'MOCK_IN_MEMORY_TRANSPORT';
  private connectedPeers: Set<string> = new Set(['NODE-PERSON-B', 'NODE-PERSON-C', 'NODE-RESCUE-CMD']);
  private listeners: PacketReceivedCallback[] = [];
  private peerInboxes: Map<string, ((bytes: Uint8Array) => void)[]> = new Map();

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

  async sendPacket(peerId: string, packetBytes: Uint8Array): Promise<boolean> {
    if (!this.connectedPeers.has(peerId)) {
      return false;
    }
    // Simulate radio transmission latency
    await new Promise(r => setTimeout(r, 20));

    // Deliver to registered peer listener if any
    const listeners = this.peerInboxes.get(peerId);
    if (listeners && listeners.length > 0) {
      await Promise.all(listeners.map(fn => Promise.resolve(fn(packetBytes))));
    }
    return true;
  }

  async broadcastPacket(packetBytes: Uint8Array): Promise<boolean> {
    const peers = Array.from(this.connectedPeers);
    for (const peer of peers) {
      await this.sendPacket(peer, packetBytes);
    }
    return true;
  }

  onPacketReceived(callback: PacketReceivedCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Helper to simulate a packet physically arriving from a peer.
   */
  async simulateIncomingBytes(fromPeerId: string, packetBytes: Uint8Array): Promise<void> {
    await Promise.all(this.listeners.map(cb => Promise.resolve(cb(fromPeerId, packetBytes))));
  }

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
