/**
 * M2 / M3 INTEGRATION CONTRACT:
 * 
 * M3 decides: "What should happen to the packet?"
 * M2 decides: "How does the packet physically move between devices?"
 * 
 * M2 implements this interface for Bluetooth LE, Wi-Fi Direct, or Local Sockets.
 */
export interface MeshTransport {
  readonly name: string;
  sendPacket(peerId: string, packetBytes: Uint8Array): Promise<boolean>;
  broadcastPacket(packetBytes: Uint8Array): Promise<boolean>;
  getConnectedPeers(): Promise<string[]>;
  onPacketReceived(callback: (senderPeerId: string, packetBytes: Uint8Array) => void): () => void;
}

export type PacketReceivedCallback = (senderPeerId: string, packetBytes: Uint8Array) => void;
