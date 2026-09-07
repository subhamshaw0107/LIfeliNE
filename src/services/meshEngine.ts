import { MeshNode, MeshStatus, SimpleNetworkStatus } from '../types';
import { haversineDistanceKm, RESCUE_HEADQUARTERS } from './geoService';

/**
 * MeshEngine — VISUALIZATION ADAPTER (not a networking stack).
 *
 * Owns ONLY presentation state for the demo UI:
 *  - Relay-node topology (positions, range, connectivity vs the victim)
 *  - The range simulator (move/toggle nodes in and out of range)
 *  - The network-status bus the UI subscribes to
 *    (written by DemoMeshNetwork from real PacketEngine events)
 *
 * All packet routing lives in PacketEngine (M3); all byte movement lives in
 * MeshTransport implementations (M2). This class makes NO dedup/TTL/loop,
 * queue, storage, or forwarding decisions.
 */
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

export class MeshEngine {
  private nodes: MeshNode[] = [...DEMO_MESH_NODES];
  private communicationRangeKm = 1.0; // 1 km configured range
  private onStatusChangeCallbacks: ((status: SimpleNetworkStatus) => void)[] = [];
  private currentNetworkStatus: SimpleNetworkStatus = 'CONNECTED';

  constructor() {
    this.recalculateDistances(22.9756, 88.4345);
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
   * Simulate a node entering or moving out of range (visualization only).
   * Packet movement is resumed separately via DemoMeshNetwork.resumeAll(),
   * which drives real PacketEngine Store-Carry-Forward queues.
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
}


export const meshEngine = new MeshEngine();
