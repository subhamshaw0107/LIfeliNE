import { DisasterZone, EmergencyPriority, RiskLevel, ShelterLocation } from '../types';
import { haversineDistanceKm, DEFAULT_DISASTER_ZONES, SAFE_SHELTERS, RESCUE_HEADQUARTERS } from './geoService';

export interface GeoTriageResult {
  latitude: number;
  longitude: number;
  isInsideRedZone: boolean;
  hazardZone: DisasterZone | null;
  disasterZoneName: string;
  distanceFromDisasterKm: number;
  severity: 'EXTREME' | 'HIGH' | 'MODERATE' | 'NONE';
  calculatedPriority: EmergencyPriority;
  riskLevel: RiskLevel;
  nearestShelter: ShelterLocation | null;
  distanceToShelterKm: number;
  distanceFromRescueKm: number;
}

export class GeoTriageService {
  private disasterZones: DisasterZone[] = [...DEFAULT_DISASTER_ZONES];
  private shelters: ShelterLocation[] = [...SAFE_SHELTERS];

  constructor(disasterZones?: DisasterZone[], shelters?: ShelterLocation[]) {
    if (disasterZones) this.disasterZones = disasterZones;
    if (shelters) this.shelters = shelters;
  }

  setDisasterZones(zones: DisasterZone[]): void {
    this.disasterZones = zones;
  }

  getDisasterZones(): DisasterZone[] {
    return this.disasterZones;
  }

  /**
   * Evaluates any GPS coordinate against active disaster zones and safe shelters.
   * Auto-escalates priority to 'CRITICAL' if inside an active Red Hazard Zone.
   */
  evaluateLocation(latitude: number, longitude: number, basePriority: EmergencyPriority = 'HIGH'): GeoTriageResult {
    let matchedZone: DisasterZone | null = null;
    let minDisasterDist = Infinity;

    for (const zone of this.disasterZones) {
      const dist = haversineDistanceKm(latitude, longitude, zone.latitude, zone.longitude);
      if (dist < minDisasterDist) {
        minDisasterDist = dist;
      }
      // Check if coordinate is within circular hazard perimeter
      if (dist <= zone.radiusKm) {
        matchedZone = zone;
        break;
      }
    }

    const isInsideRedZone = matchedZone !== null;
    const riskLevel: RiskLevel = isInsideRedZone
      ? 'CRITICAL'
      : minDisasterDist <= 2.5
      ? 'WARNING'
      : 'SAFE';

    // Auto-escalate priority to CRITICAL when inside a hazard Red Zone!
    const calculatedPriority: EmergencyPriority = isInsideRedZone ? 'CRITICAL' : basePriority;

    // Find nearest safe shelter
    let nearestShelter: ShelterLocation | null = null;
    let minShelterDist = Infinity;

    for (const shelter of this.shelters) {
      const dist = haversineDistanceKm(latitude, longitude, shelter.latitude, shelter.longitude);
      if (dist < minShelterDist) {
        minShelterDist = dist;
        nearestShelter = shelter;
      }
    }

    const distFromRescue = haversineDistanceKm(
      latitude,
      longitude,
      RESCUE_HEADQUARTERS.latitude,
      RESCUE_HEADQUARTERS.longitude
    );

    return {
      latitude,
      longitude,
      isInsideRedZone,
      hazardZone: matchedZone,
      disasterZoneName: matchedZone ? matchedZone.name : 'Clear Non-Hazard Area',
      distanceFromDisasterKm: isFinite(minDisasterDist) ? minDisasterDist : 0,
      severity: matchedZone ? matchedZone.severity : 'NONE',
      calculatedPriority,
      riskLevel,
      nearestShelter,
      distanceToShelterKm: isFinite(minShelterDist) ? minShelterDist : 0,
      distanceFromRescueKm: distFromRescue
    };
  }
}

export const geoTriageService = new GeoTriageService();
