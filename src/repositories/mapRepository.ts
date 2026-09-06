import { DisasterZone, MeshNode, ShelterLocation, BlockedRoad, SosPacket } from '../types';
import { sosRepository, SosRepository } from './sosRepository';
import { DEFAULT_DISASTER_ZONES, SAFE_SHELTERS, RESCUE_HEADQUARTERS } from '../services/geoService';
import { DEMO_MESH_NODES } from '../services/meshEngine';

export interface SosLocationPin {
  packetId: string;
  senderId: string;
  latitude: number;
  longitude: number;
  priority: string;
  status: string;
  disasterZoneName: string;
  timestamp: number;
}

export interface MapCompositeData {
  sosLocations: SosLocationPin[];
  hazardZones: DisasterZone[];
  shelters: ShelterLocation[];
  meshNodes: MeshNode[];
  blockedRoads: BlockedRoad[];
  rescueHeadquarters: typeof RESCUE_HEADQUARTERS;
}

export class MapRepository {
  private sosRepo: SosRepository;
  private customBlockedRoads: BlockedRoad[] = [
    {
      id: 'ROAD-BLK-01',
      name: 'Riverbank Causeway Sector 3',
      latitude: 22.9790,
      longitude: 88.4380,
      severity: 'BLOCKED',
      description: 'Submerged under 1.5m floodwaters. Completely impassable.'
    },
    {
      id: 'ROAD-BLK-02',
      name: 'North Overpass Culvert',
      latitude: 22.9830,
      longitude: 88.4440,
      severity: 'HAZARDOUS',
      description: 'Mudslide debris and fallen high-voltage power lines.'
    }
  ];

  constructor(sosRepo: SosRepository = sosRepository) {
    this.sosRepo = sosRepo;
  }

  getSOSLocations(): SosLocationPin[] {
    const packets = this.sosRepo.getAllPackets();
    return packets.map((p: SosPacket) => ({
      packetId: p.id,
      senderId: p.senderId,
      latitude: p.latitude,
      longitude: p.longitude,
      priority: p.priority,
      status: p.status,
      disasterZoneName: p.disasterZoneName,
      timestamp: p.timestamp
    }));
  }

  getHazardZones(): DisasterZone[] {
    return DEFAULT_DISASTER_ZONES;
  }

  getSafeZones(): ShelterLocation[] {
    return SAFE_SHELTERS;
  }

  getShelters(): ShelterLocation[] {
    return SAFE_SHELTERS;
  }

  getMeshNodes(): MeshNode[] {
    return DEMO_MESH_NODES;
  }

  getBlockedRoads(): BlockedRoad[] {
    return this.customBlockedRoads;
  }

  addBlockedRoad(road: BlockedRoad): void {
    this.customBlockedRoads.push(road);
  }

  getMapData(): MapCompositeData {
    return {
      sosLocations: this.getSOSLocations(),
      hazardZones: this.getHazardZones(),
      shelters: this.getShelters(),
      meshNodes: this.getMeshNodes(),
      blockedRoads: this.getBlockedRoads(),
      rescueHeadquarters: RESCUE_HEADQUARTERS
    };
  }
}

export const mapRepository = new MapRepository();
