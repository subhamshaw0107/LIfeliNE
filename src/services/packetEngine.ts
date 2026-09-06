import { SosPacket, AckPacket, SimpleNetworkStatus, DeliveryStatus, EmergencyPriority } from '../types';
import {
  deserializePacketFromBytes,
  serializePacketToBytes,
  isAckPacket,
  isSosPacket,
  validateSosPacket,
  createAckPacket,
  MeshPacket
} from '../models/Packet';
import { sosRepository, SosRepository } from '../repositories/sosRepository';
import { deduplicationService, DeduplicationService } from './deduplicationService';
import { storeCarryForwardQueue, StoreCarryForwardQueue } from './storeCarryForwardQueue';
import { geoTriageService, GeoTriageService } from './geoTriageService';
import { MeshTransport } from '../transport/meshTransport';

export type PacketEngineEventType =
  | 'STORE'
  | 'FORWARD'
  | 'DELIVER'
  | 'ACK_RECEIVED'
  | 'DUPLICATE_BLOCKED'
  | 'LOOP_PREVENTED'
  | 'TTL_EXPIRED'
  | 'TRIAGE_ESCALATED'
  | 'WAITING_RELAY';

export interface PacketEngineEvent {
  type: PacketEngineEventType;
  nodeId: string;
  packetId: string;
  message: string;
  timestamp: number;
}

export class PacketEngine {
  private localNodeId: string;
  private sosRepo: SosRepository;
  private dedup: DeduplicationService;
  private queue: StoreCarryForwardQueue;
  private triage: GeoTriageService;
  private transport: MeshTransport | null = null;
  private eventListeners: ((event: PacketEngineEvent) => void)[] = [];
  private onPacketDeliveredListeners: ((packet: SosPacket) => void)[] = [];
  private onAckReceivedListeners: ((ack: AckPacket) => void)[] = [];
  private onStatusChangeListeners: ((status: SimpleNetworkStatus) => void)[] = [];
  private currentNetworkStatus: SimpleNetworkStatus = 'CONNECTED';

  constructor(options?: {
    localNodeId?: string;
    sosRepo?: SosRepository;
    dedup?: DeduplicationService;
    queue?: StoreCarryForwardQueue;
    triage?: GeoTriageService;
    transport?: MeshTransport;
  }) {
    this.localNodeId = options?.localNodeId || 'NODE-LOCAL';
    this.sosRepo = options?.sosRepo || sosRepository;
    this.dedup = options?.dedup || deduplicationService;
    this.queue = options?.queue || storeCarryForwardQueue;
    this.triage = options?.triage || geoTriageService;
    if (options?.transport) {
      this.setTransport(options.transport);
    }
  }

  setLocalNodeId(id: string): void {
    this.localNodeId = id;
  }

  getLocalNodeId(): string {
    return this.localNodeId;
  }

  setTransport(transport: MeshTransport): void {
    this.transport = transport;
    this.transport.onPacketReceived((senderPeerId, packetBytes) => {
      this.processIncomingBytes(senderPeerId, packetBytes);
    });
  }

  getTransport(): MeshTransport | null {
    return this.transport;
  }

  getNetworkStatus(): SimpleNetworkStatus {
    return this.currentNetworkStatus;
  }

  setNetworkStatus(status: SimpleNetworkStatus): void {
    this.currentNetworkStatus = status;
    this.onStatusChangeListeners.forEach(cb => cb(status));
  }

  onNetworkStatusChange(callback: (status: SimpleNetworkStatus) => void): () => void {
    this.onStatusChangeListeners.push(callback);
    return () => {
      this.onStatusChangeListeners = this.onStatusChangeListeners.filter(cb => cb !== callback);
    };
  }

  onEvent(callback: (event: PacketEngineEvent) => void): () => void {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter(cb => cb !== callback);
    };
  }

  onPacketDelivered(callback: (packet: SosPacket) => void): () => void {
    this.onPacketDeliveredListeners.push(callback);
    return () => {
      this.onPacketDeliveredListeners = this.onPacketDeliveredListeners.filter(cb => cb !== callback);
    };
  }

  onAckReceived(callback: (ack: AckPacket) => void): () => void {
    this.onAckReceivedListeners.push(callback);
    return () => {
      this.onAckReceivedListeners = this.onAckReceivedListeners.filter(cb => cb !== callback);
    };
  }

  private emitEvent(event: PacketEngineEvent): void {
    this.eventListeners.forEach(cb => cb(event));
  }

  /**
   * Primary entry point for raw bytes arriving over BLE/Wi-Fi Direct.
   */
  async processIncomingBytes(senderPeerId: string, packetBytes: Uint8Array): Promise<boolean> {
    const packet = deserializePacketFromBytes(packetBytes);
    if (!packet) {
      console.warn('[PacketEngine] Received invalid or unparseable packet bytes from', senderPeerId);
      return false;
    }
    return this.processPacket(packet, senderPeerId);
  }

  /**
   * Main packet decision pipeline:
   * "What should happen to the packet?"
   */
  async processPacket(packet: MeshPacket, incomingFromPeerId?: string): Promise<boolean> {
    if (isAckPacket(packet)) {
      return this.processAckPacket(packet, incomingFromPeerId);
    }
    if (isSosPacket(packet)) {
      return this.processSosPacket(packet, incomingFromPeerId);
    }
    return false;
  }

  /**
   * Pipeline for incoming SosPackets
   */
  private async processSosPacket(packet: SosPacket, incomingFrom?: string): Promise<boolean> {
    // 1. Validate Structure
    const validation = validateSosPacket(packet);
    if (!validation.isValid) {
      console.warn('[PacketEngine] Dropping invalid SOS packet:', validation.error);
      return false;
    }

    // 2. Deduplication Check
    if (this.dedup.hasSeen(packet.id)) {
      this.emitEvent({
        type: 'DUPLICATE_BLOCKED',
        nodeId: this.localNodeId,
        packetId: packet.id,
        message: `[DUPLICATE BLOCKED] Packet ${packet.id} already processed. Suppressing duplicate relay.`,
        timestamp: Date.now()
      });
      return true; // Seen and handled, no need to re-forward
    }
    this.dedup.markSeen(packet.id);

    // 3. Routing Loop Protection
    if (this.dedup.isLoopDetected(packet, this.localNodeId)) {
      this.emitEvent({
        type: 'LOOP_PREVENTED',
        nodeId: this.localNodeId,
        packetId: packet.id,
        message: `[LOOP PREVENTED] Node ${this.localNodeId} already in route trace. Circular relay terminated for ${packet.id}.`,
        timestamp: Date.now()
      });
      return false;
    }

    // 4. TTL & Hop Count Bounds Check
    if (packet.ttl <= 0 || packet.hopCount >= 10) {
      this.emitEvent({
        type: 'TTL_EXPIRED',
        nodeId: this.localNodeId,
        packetId: packet.id,
        message: `[TTL EXPIRED] Packet ${packet.id} exceeded hop lifetime (TTL: ${packet.ttl}, Hops: ${packet.hopCount}). Dropped.`,
        timestamp: Date.now()
      });
      return false;
    }

    // 5. Application-Side Geo-Triage (Red Zone Evaluation)
    const triageResult = this.triage.evaluateLocation(packet.latitude, packet.longitude, packet.priority);
    let effectivePriority = packet.priority;
    let effectiveRisk = packet.riskLevel;

    if (triageResult.isInsideRedZone && packet.priority !== 'CRITICAL') {
      effectivePriority = 'CRITICAL';
      effectiveRisk = 'CRITICAL';
      this.emitEvent({
        type: 'TRIAGE_ESCALATED',
        nodeId: this.localNodeId,
        packetId: packet.id,
        message: `[GEO-TRIAGE] Victim is inside ${triageResult.disasterZoneName}. Priority auto-escalated to CRITICAL.`,
        timestamp: Date.now()
      });
    }

    // 6. Update local packet representation
    const updatedPacket: SosPacket = {
      ...packet,
      priority: effectivePriority,
      riskLevel: effectiveRisk,
      disasterZoneName: triageResult.disasterZoneName,
      distanceFromDisasterKm: triageResult.distanceFromDisasterKm,
      distanceFromRescueKm: triageResult.distanceFromRescueKm
    };

    // 7. Store Locally (Store stage of Store-Carry-Forward)
    this.sosRepo.savePacket(updatedPacket);

    this.emitEvent({
      type: 'STORE',
      nodeId: this.localNodeId,
      packetId: updatedPacket.id,
      message: `Packet ${updatedPacket.id} stored locally at ${this.localNodeId}.`,
      timestamp: Date.now()
    });

    // 8. Check Destination / Rescue HQ
    const isDestination = this.localNodeId === 'NODE-RESCUE-CMD' || this.localNodeId === 'TACTICAL-HQ';
    if (isDestination) {
      this.sosRepo.updateStatus(
        updatedPacket.id,
        'DELIVERED',
        `Delivered to Rescue Command Center (${this.localNodeId})`
      );
      this.setNetworkStatus('DELIVERED');
      this.emitEvent({
        type: 'DELIVER',
        nodeId: this.localNodeId,
        packetId: updatedPacket.id,
        message: `[DELIVERED] SOS ${updatedPacket.id} delivered to Rescue Command Center!`,
        timestamp: Date.now()
      });
      this.onPacketDeliveredListeners.forEach(cb => cb(updatedPacket));
      return true;
    }

    // 9. Forwarding Decision (Store-Carry-Forward)
    const nextHopPacket: SosPacket = {
      ...updatedPacket,
      hopCount: updatedPacket.hopCount + 1,
      ttl: Math.max(0, updatedPacket.ttl - 1),
      route: [...updatedPacket.route, this.localNodeId],
      status: 'RELAYING'
    };

    // Add to Store-Carry-Forward pending queue
    this.queue.enqueue(nextHopPacket);

    // Attempt transmission via Transport if available
    return this.attemptForwarding(nextHopPacket);
  }

  /**
   * Pipeline for incoming AckPackets
   */
  private async processAckPacket(ack: AckPacket, incomingFrom?: string): Promise<boolean> {
    if (this.dedup.hasSeen(ack.ackId)) {
      return true;
    }
    this.dedup.markSeen(ack.ackId);

    // Store ACK and update parent SOS status in local repository
    this.sosRepo.saveAck(ack);

    this.emitEvent({
      type: 'ACK_RECEIVED',
      nodeId: this.localNodeId,
      packetId: ack.ackId,
      message: `[ACK RECEIVED] SOS ${ack.sosId} acknowledged by ${ack.acknowledgedBy} (${ack.status})`,
      timestamp: Date.now()
    });

    this.onAckReceivedListeners.forEach(cb => cb(ack));

    // Check if this node is the original victim device
    if (this.localNodeId === ack.originalSenderId || this.localNodeId === 'PERSON-A') {
      this.sosRepo.updateStatus(ack.sosId, ack.status, `Direct ACK confirmation received on victim phone`);
      return true;
    }

    // Otherwise relay ACK back towards sender
    if (ack.ttl > 0 && ack.hopCount < 10) {
      const relayedAck: AckPacket = {
        ...ack,
        hopCount: ack.hopCount + 1,
        ttl: ack.ttl - 1,
        route: [...ack.route, this.localNodeId]
      };
      if (this.transport) {
        const bytes = serializePacketToBytes(relayedAck);
        await this.transport.broadcastPacket(bytes);
      }
    }

    return true;
  }

  /**
   * Attempt to send queued packets to available peers.
   */
  async attemptForwarding(packet: SosPacket): Promise<boolean> {
    if (!this.transport) {
      this.setNetworkStatus('WAITING_RELAY');
      this.emitEvent({
        type: 'WAITING_RELAY',
        nodeId: this.localNodeId,
        packetId: packet.id,
        message: `No transport configured. Packet held in Store-Carry-Forward queue.`,
        timestamp: Date.now()
      });
      return false;
    }

    const peers = await this.transport.getConnectedPeers();
    // Exclude nodes already in route to prevent loops
    const availablePeers = peers.filter(peerId => !packet.route.includes(peerId));

    if (availablePeers.length === 0) {
      this.setNetworkStatus('WAITING_RELAY');
      this.emitEvent({
        type: 'WAITING_RELAY',
        nodeId: this.localNodeId,
        packetId: packet.id,
        message: `No unconnected peers in range. Held in Store-Carry-Forward queue.`,
        timestamp: Date.now()
      });
      return false;
    }

    // Forward to next peer
    const targetPeer = availablePeers[0];
    const bytes = serializePacketToBytes(packet);
    const sent = await this.transport.sendPacket(targetPeer, bytes);

    if (sent) {
      this.setNetworkStatus('FORWARDED');
      this.emitEvent({
        type: 'FORWARD',
        nodeId: this.localNodeId,
        packetId: packet.id,
        message: `Forwarded ${packet.id} to ${targetPeer} (Hop: ${packet.hopCount}, TTL: ${packet.ttl})`,
        timestamp: Date.now()
      });
      this.queue.remove(packet.id);
      return true;
    }

    return false;
  }

  /**
   * Trigger delivery of all pending packets when new peers connect (Store-Carry-Forward resume).
   */
  async resumePendingRelays(): Promise<number> {
    const pending = this.queue.getAll();
    let sentCount = 0;
    for (const packet of pending) {
      const success = await this.attemptForwarding(packet);
      if (success) sentCount++;
    }
    return sentCount;
  }

  /**
   * Generate an explicit ACK packet from this node (used by Rescue Center).
   */
  acknowledgeSos(sosId: string, status: 'ACKNOWLEDGED' | 'RESPONDING' | 'RESCUED' = 'ACKNOWLEDGED', note?: string): AckPacket | null {
    const sos = this.sosRepo.getPacket(sosId);
    if (!sos) return null;

    const ack = createAckPacket(sos, this.localNodeId, status, note);
    this.processAckPacket(ack);
    return ack;
  }
}

export const packetEngine = new PacketEngine();
