import { MeshNode, MeshStatus, SimpleNetworkStatus, SosPacket, EmergencyPriority, RiskLevel } from '../types';
import { haversineDistanceKm, RESCUE_HEADQUARTERS } from './geoService';
import { storageService } from './storageService';

export const DEMO_MESH_NODES: MeshNode[] = [
  {
    id: 'NODE-PERSON-B',
    name: 'PERSON B (Nearby Citizen Relay)',
    type: 'RELAY',
    latitude: 22.9780,
    longitude: 88.4375,
    battery: 88,
    rangeKm: 1.0,
    isConnected: true,
    storedPacketsCount: 0,
    status: 'ACTIVE'
  },
  {
    id: 'NODE-PERSON-C',
    name: 'PERSON C (Emergency Volunteer Relay)',
    type: 'RELAY',
    latitude: 22.9815,
    longitude: 88.4420,
    battery: 94,
    rangeKm: 1.0,
    isConnected: true,
    storedPacketsCount: 0,
    status: 'ACTIVE'
  },
  {
    id: 'NODE-PERSON-D',
    name: 'PERSON D (Responder Relay)',
    type: 'RELAY',
    latitude: 22.9850,
    longitude: 88.4485,
    battery: 76,
    rangeKm: 1.0,
    isConnected: true,
    storedPacketsCount: 0,
    status: 'ACTIVE'
  },
  {
    id: 'NODE-RESCUE-CMD',
    name: 'RESCUE CENTER (Tactical HQ Gateway)',
    type: 'RESCUE_GATEWAY',
    latitude: RESCUE_HEADQUARTERS.latitude,
    longitude: RESCUE_HEADQUARTERS.longitude,
    battery: 100,
    rangeKm: 2.5,
    isConnected: true,
    storedPacketsCount: 0,
    status: 'ACTIVE'
  }
];

export interface MeshEvent {
  type: 'FORWARD' | 'STORE' | 'CONNECT' | 'DELIVER' | 'DISCOVER' | 'WAITING' | 'DUPLICATE_BLOCKED' | 'LOOP_PREVENTED';
  nodeId: string;
  packetId: string;
  message: string;
  timestamp: number;
}

export class MeshEngine {
  private nodes: MeshNode[] = [...DEMO_MESH_NODES];
  private communicationRangeKm = 1.0; // 1 km configured range
  private onEventCallbacks: ((event: MeshEvent) => void)[] = [];
  private onPacketDeliveredCallbacks: ((packet: SosPacket) => void)[] = [];
  private onStatusChangeCallbacks: ((status: SimpleNetworkStatus) => void)[] = [];
  private currentNetworkStatus: SimpleNetworkStatus = 'CONNECTED';

  // Seen-message cache per relay: nodeId -> Set of processed packet IDs
  // Guarantees zero duplicate storage or repeat forwarding
  private seenPacketsByNode: Map<string, Set<string>> = new Map();

  // Store-Carry-Forward pending queue
  private pendingRelayPackets: {
    packet: SosPacket;
    currentHopIndex: number;
    victimLat: number;
    victimLon: number;
  }[] = [];

  constructor() {
    this.recalculateDistances(22.9756, 88.4345);
  }

  /**
   * Check if a specific node has already processed an SOS ID.
   */
  hasNodeSeenPacket(nodeId: string, packetId: string): boolean {
    const set = this.seenPacketsByNode.get(nodeId);
    return set ? set.has(packetId) : false;
  }

  /**
   * Record that a node has processed an SOS ID.
   */
  markPacketSeenByNode(nodeId: string, packetId: string): void {
    let set = this.seenPacketsByNode.get(nodeId);
    if (!set) {
      set = new Set<string>();
      this.seenPacketsByNode.set(nodeId, set);
    }
    set.add(packetId);
  }

  /**
   * Reset seen packet cache.
   */
  clearSeenPacketCache(): void {
    this.seenPacketsByNode.clear();
  }

  /**
   * Get duplicate detection statistics.
   */
  getSeenPacketStats(): { totalNodesWithCache: number; totalProcessedSosEvents: number } {
    let total = 0;
    this.seenPacketsByNode.forEach(set => {
      total += set.size;
    });
    return {
      totalNodesWithCache: this.seenPacketsByNode.size,
      totalProcessedSosEvents: total
    };
  }

  getNodes(): MeshNode[] {
    return this.nodes;
  }

  setCommunicationRange(rangeKm: number): void {
    this.communicationRangeKm = rangeKm;
  }

  getCommunicationRange(): number {
    return this.communicationRangeKm;
  }

  getNetworkStatus(): SimpleNetworkStatus {
    return this.currentNetworkStatus;
  }

  setNetworkStatus(status: SimpleNetworkStatus): void {
    this.currentNetworkStatus = status;
    this.onStatusChangeCallbacks.forEach(cb => cb(status));
  }

  onNetworkStatusChange(callback: (status: SimpleNetworkStatus) => void): () => void {
    this.onStatusChangeCallbacks.push(callback);
    return () => {
      this.onStatusChangeCallbacks = this.onStatusChangeCallbacks.filter(c => c !== callback);
    };
  }

  onEvent(callback: (event: MeshEvent) => void): () => void {
    this.onEventCallbacks.push(callback);
    return () => {
      this.onEventCallbacks = this.onEventCallbacks.filter(c => c !== callback);
    };
  }

  onPacketDelivered(callback: (packet: SosPacket) => void): () => void {
    this.onPacketDeliveredCallbacks.push(callback);
    return () => {
      this.onPacketDeliveredCallbacks = this.onPacketDeliveredCallbacks.filter(c => c !== callback);
    };
  }

  private emitEvent(event: MeshEvent): void {
    this.onEventCallbacks.forEach(cb => cb(event));
  }

  /**
   * Recalculates distance of all nodes from victim location
   */
  recalculateDistances(victimLat: number, victimLon: number): void {
    this.nodes = this.nodes.map(node => {
      const distance = haversineDistanceKm(victimLat, victimLon, node.latitude, node.longitude);
      const isConnected = distance <= (node.type === 'RESCUE_GATEWAY' ? node.rangeKm : this.communicationRangeKm);
      return {
        ...node,
        distanceToVictimKm: distance,
        isConnected,
        status: isConnected ? 'ACTIVE' : 'OUT_OF_RANGE'
      };
    });
  }

  /**
   * Determine immediate victim mesh connection status
   */
  getVictimMeshStatus(victimLat: number, victimLon: number): {
    status: MeshStatus;
    connectedCount: number;
    nearestNode: MeshNode | null;
  } {
    this.recalculateDistances(victimLat, victimLon);
    const connected = this.nodes.filter(n => n.isConnected && n.type !== 'RESCUE_GATEWAY');
    const nearest = [...this.nodes].sort((a, b) => (a.distanceToVictimKm || 0) - (b.distanceToVictimKm || 0))[0] || null;

    if (connected.length > 0) {
      return { status: 'CONNECTED', connectedCount: connected.length, nearestNode: nearest };
    }
    return { status: 'SEARCHING', connectedCount: 0, nearestNode: nearest };
  }

  /**
   * Simulate a node entering or moving out of range, and resume pending relays automatically!
   */
  moveNodePosition(nodeId: string, lat: number, lon: number, victimLat: number, victimLon: number): void {
    this.nodes = this.nodes.map(node => {
      if (node.id === nodeId) {
        const distance = haversineDistanceKm(victimLat, victimLon, lat, lon);
        const isConnected = distance <= this.communicationRangeKm;
        return {
          ...node,
          latitude: lat,
          longitude: lon,
          distanceToVictimKm: distance,
          isConnected,
          status: isConnected ? 'ACTIVE' : 'OUT_OF_RANGE'
        };
      }
      return node;
    });

    // Check if any pending relays can now resume automatically!
    this.checkAndResumePendingRelays(victimLat, victimLon);
  }

  /**
   * Toggle node range for quick interactive hackathon testing
   */
  toggleSimulateNodeRange(victimLat: number, victimLon: number): boolean {
    const nodeC = this.nodes.find(n => n.id === 'NODE-PERSON-C');
    if (!nodeC) return false;

    // Toggle between in-range (22.9815, 88.4420) and out-of-range (22.9960, 88.4650)
    const isCurrentlyFar = (nodeC.distanceToVictimKm || 0) > this.communicationRangeKm;
    if (isCurrentlyFar) {
      // Bring Person C in range (0.6 km)
      this.moveNodePosition('NODE-PERSON-C', 22.9815, 88.4420, victimLat, victimLon);
      return true; // Now in range
    } else {
      // Move Person C out of range (1.8 km)
      this.moveNodePosition('NODE-PERSON-C', 22.9960, 88.4650, victimLat, victimLon);
      return false; // Now out of range
    }
  }

  /**
   * Check if queued DTN packets can continue hopping toward Rescue Center
   */
  private async checkAndResumePendingRelays(victimLat: number, victimLon: number): Promise<void> {
    // Prioritize transmission queue: CRITICAL > HIGH > LOW. Every packet is preserved and forwarded.
    const priorityWeight: Record<string, number> = {
      CRITICAL: 3,
      HIGH: 2,
      MEDIUM: 1,
      LOW: 0
    };
    this.pendingRelayPackets.sort((a, b) => {
      const pA = priorityWeight[a.packet.priority] ?? 0;
      const pB = priorityWeight[b.packet.priority] ?? 0;
      return pB - pA || a.packet.timestamp - b.packet.timestamp;
    });

    const remaining: typeof this.pendingRelayPackets = [];

    for (const item of this.pendingRelayPackets) {
      const success = await this.routeSosPacket(item.packet, victimLat, victimLon, undefined, item.currentHopIndex);
      if (!success) {
        remaining.push(item);
      }
    }

    this.pendingRelayPackets = remaining;
  }

  /**
   * DYNAMIC SOS PRIORITY ADAPTATION:
   * Dynamically adapts the priority of an active SOS within the mesh relay system.
   * Keeps the exact same SOS ID, updates pending queues, re-sorts transmission urgency,
   * and ensures the next relay carries the updated priority.
   */
  updatePacketPriority(
    packetId: string,
    newPriority: EmergencyPriority,
    newRiskLevel: RiskLevel
  ): void {
    let updatedInQueue = false;

    this.pendingRelayPackets = this.pendingRelayPackets.map(item => {
      if (item.packet.id === packetId) {
        updatedInQueue = true;
        return {
          ...item,
          packet: {
            ...item.packet,
            priority: newPriority,
            riskLevel: newRiskLevel
          }
        };
      }
      return item;
    });

    // Re-prioritize pending queue with updated priority
    const priorityWeight: Record<string, number> = {
      CRITICAL: 3,
      HIGH: 2,
      MEDIUM: 1,
      LOW: 0
    };
    this.pendingRelayPackets.sort((a, b) => {
      const pA = priorityWeight[a.packet.priority] ?? 0;
      const pB = priorityWeight[b.packet.priority] ?? 0;
      return pB - pA || a.packet.timestamp - b.packet.timestamp;
    });

    this.emitEvent({
      type: 'FORWARD',
      nodeId: 'DYNAMIC_PRIORITY_ADAPTER',
      packetId,
      message: `Dynamic priority updated: ${packetId} adapts to ${newPriority} (${newRiskLevel} zone). Next relay will forward updated priority.`,
      timestamp: Date.now()
    });
  }

  /**
   * OFFLINE MULTI-HOP MESH ROUTING
   * 
   * Chain:
   * PERSON A (Victim)
   *    ↓
   * PERSON B (Nearby Citizen Relay)
   *    ↓
   * PERSON C (Emergency Volunteer Relay)
   *    ↓
   * PERSON D (Responder Relay)
   *    ↓
   * RESCUE CENTER (Tactical HQ)
   *
   * The victim does NOT manually select B, C, or D.
   * The SOS moves automatically toward the Rescue Center.
   */
  async routeSosPacket(
    packet: SosPacket,
    victimLat: number,
    victimLon: number,
    onStepUpdate?: (step: string, packet: SosPacket) => void,
    startFromHopIndex = 0
  ): Promise<boolean> {
    this.recalculateDistances(victimLat, victimLon);

    // Multi-hop Node definitions - Origin sender is preserved throughout
    const hopChain = [
      { id: 'SENDER', name: packet.senderId || 'PERSON-A', lat: victimLat, lon: victimLon },
      { id: 'NODE-PERSON-B', name: 'PERSON B (Nearby Citizen Relay)', lat: this.nodes[0].latitude, lon: this.nodes[0].longitude },
      { id: 'NODE-PERSON-C', name: 'PERSON C (Emergency Volunteer Relay)', lat: this.nodes[1].latitude, lon: this.nodes[1].longitude },
      { id: 'NODE-PERSON-D', name: 'PERSON D (Responder Relay)', lat: this.nodes[2].latitude, lon: this.nodes[2].longitude },
      { id: 'NODE-RESCUE-CMD', name: 'RESCUE CENTER (Tactical HQ)', lat: RESCUE_HEADQUARTERS.latitude, lon: RESCUE_HEADQUARTERS.longitude }
    ];

    let currentHop = startFromHopIndex === 0 ? 0 : packet.hopCount;
    let currentTtl = packet.ttl;
    const currentRoute = [...packet.route];

    for (let i = Math.max(0, startFromHopIndex); i < hopChain.length - 1; i++) {
      const sender = hopChain[i];
      const receiver = hopChain[i + 1];

      // Calculate distance between sender and receiver
      const distanceBetweenHops = haversineDistanceKm(sender.lat, sender.lon, receiver.lat, receiver.lon);
      const isGateway = receiver.id === 'NODE-RESCUE-CMD';
      const maxRange = isGateway ? 2.5 : this.communicationRangeKm;

      if (distanceBetweenHops > maxRange) {
        // NEXT HOP IS OUT OF RANGE!
        // Store-Carry-Forward / DTN buffer
        if (i === 0) {
          // Person B is not in range of Person A
          this.setNetworkStatus('SEARCHING');
          this.emitEvent({
            type: 'WAITING',
            nodeId: sender.name,
            packetId: packet.id,
            message: `No nearby device detected within ${this.communicationRangeKm} km. Searching...`,
            timestamp: Date.now()
          });
        } else {
          // Person B or C has the packet, waiting for next relay to come within range
          this.setNetworkStatus('WAITING_RELAY');
          this.emitEvent({
            type: 'WAITING',
            nodeId: sender.name,
            packetId: packet.id,
            message: `${sender.name} holding packet. Waiting for ${receiver.name} to enter range...`,
            timestamp: Date.now()
          });
        }

        // Queue packet for automatic resumption when node enters range
        if (!this.pendingRelayPackets.some(p => p.packet.id === packet.id)) {
          this.pendingRelayPackets.push({
            packet: { ...packet, route: currentRoute, hopCount: currentHop, ttl: currentTtl },
            currentHopIndex: i,
            victimLat,
            victimLon
          });
        }

        storageService.updateSosStatus(
          packet.id,
          'STORED',
          `Stored at ${sender.name}. Waiting for ${receiver.name} to enter range.`
        );

        if (onStepUpdate) {
          onStepUpdate('WAITING_FOR_RELAY', {
            ...packet,
            route: currentRoute,
            hopCount: currentHop,
            ttl: currentTtl,
            status: 'STORED'
          });
        }
        return false;
      }

      // 1. ROUTING LOOP PROTECTION:
      // Prevent cyclic routing loops such as A → B → C → A → B → C
      if (currentRoute.includes(receiver.name)) {
        this.emitEvent({
          type: 'LOOP_PREVENTED',
          nodeId: receiver.name,
          packetId: packet.id,
          message: `[ROUTING LOOP PREVENTED] Node ${receiver.name} already in hop history. Circular propagation terminated for ${packet.id}.`,
          timestamp: Date.now()
        });
        return false;
      }

      // 2. TTL & EXPIRATION CHECK:
      if (currentTtl <= 0) {
        this.emitEvent({
          type: 'WAITING',
          nodeId: sender.name,
          packetId: packet.id,
          message: `[TTL EXPIRED] ${packet.id} reached hop limit (TTL 0). Forwarding terminated to prevent infinite circulation.`,
          timestamp: Date.now()
        });
        return false;
      }

      // 3. DUPLICATE DETECTION (Seen-Message Cache per Relay):
      // When a relay receives an SOS:
      // IF SOS ID already exists:
      //   do NOT create another SOS, do NOT store duplicate, do NOT repeatedly forward.
      if (this.hasNodeSeenPacket(receiver.id, packet.id)) {
        this.emitEvent({
          type: 'DUPLICATE_BLOCKED',
          nodeId: receiver.name,
          packetId: packet.id,
          message: `[DUPLICATE BLOCKED] ${receiver.name} already processed ${packet.id}. Suppressing duplicate relay.`,
          timestamp: Date.now()
        });
        return true;
      }

      // IF SOS ID is new: accept it, store in cache, process it, forward it
      this.markPacketSeenByNode(receiver.id, packet.id);

      // Next hop is within range! Forward automatically
      await new Promise(r => setTimeout(r, 650)); // realistic transmission delay
      currentHop++;
      currentTtl = Math.max(0, currentTtl - 1);
      currentRoute.push(receiver.name);

      const isFinalHop = i + 1 === hopChain.length - 1;

      if (!isFinalHop) {
        this.setNetworkStatus('FORWARDED');
        this.emitEvent({
          type: 'FORWARD',
          nodeId: receiver.name,
          packetId: packet.id,
          message: `Forwarded to ${receiver.name} (Hop: ${currentHop}, TTL: ${currentTtl}) | Sender: ${packet.senderId}`,
          timestamp: Date.now()
        });
      } else {
        this.setNetworkStatus('DELIVERED');
        this.emitEvent({
          type: 'DELIVER',
          nodeId: receiver.name,
          packetId: packet.id,
          message: `Reached ${receiver.name}! Unique SOS verified: ${packet.id} (Original Creator: ${packet.senderId})`,
          timestamp: Date.now()
        });
      }

      if (onStepUpdate) {
        const partialPacket: SosPacket = {
          ...packet,
          hopCount: currentHop,
          ttl: currentTtl,
          route: currentRoute,
          status: isFinalHop ? 'DELIVERED' : 'RELAYING'
        };
        onStepUpdate(isFinalHop ? 'DELIVERED' : `HOP_${currentHop}`, partialPacket);
      }
    }

    // Packet successfully reached Rescue Center!
    const deliveredPacket = storageService.updateSosStatus(
      packet.id,
      'DELIVERED',
      'Reached Rescue Center via automatic multi-hop mesh (A → B → C → D → RESCUE CENTER).',
      {
        hopCount: currentHop,
        ttl: currentTtl,
        route: currentRoute
      }
    );

    if (deliveredPacket) {
      this.onPacketDeliveredCallbacks.forEach(cb => cb(deliveredPacket));
    }

    return true;
  }
}

export const meshEngine = new MeshEngine();
