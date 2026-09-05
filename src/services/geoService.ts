import { DisasterZone, LocationCoords, RiskLevel } from '../types';

/**
 * Calculates geographic distance in kilometers between two GPS coordinates using the Haversine formula.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 100) / 100;
}

// Active disaster zones
export const DEFAULT_DISASTER_ZONES: DisasterZone[] = [
  {
    id: 'ZONE-FLOOD-A',
    name: 'Flood Zone A (River Embankment Breach)',
    type: 'FLOOD',
    latitude: 22.9785,
    longitude: 88.4395,
    radiusKm: 1.1,
    severity: 'EXTREME',
    description: 'Rapid flash flooding, water levels rising at 0.5m/hr. Roads submerged.'
  },
  {
    id: 'ZONE-CYCLONE-B',
    name: 'Storm Surge Sector 4',
    type: 'CYCLONE',
    latitude: 22.9920,
    longitude: 88.4710,
    radiusKm: 2.0,
    severity: 'HIGH',
    description: 'Heavy structural damage risk, high wind gusts, power line collapse.'
  }
];

// Rescue Gateway base camp location
export const RESCUE_HEADQUARTERS = {
  name: 'Lifeline Rescue Forward Command',
  latitude: 22.9860,
  longitude: 88.4550,
  rangeKm: 2.5
};

// Designated Safe Shelters
export const SAFE_SHELTERS = [
  {
    id: 'SHELTER-01',
    name: 'High School Relief Center',
    latitude: 22.9690,
    longitude: 88.4250,
    capacity: '450 people',
    status: 'OPEN - MEDICAL & FOOD AVAILABLE'
  },
  {
    id: 'SHELTER-02',
    name: 'Civic Stadium Higher Ground Shelter',
    latitude: 22.9910,
    longitude: 88.4420,
    capacity: '1,200 people',
    status: 'OPEN - BOATS & RESCUE VEHICLES'
  }
];

export class GeoService {
  private defaultCoords: LocationCoords = {
    latitude: 22.9756,
    longitude: 88.4345,
    accuracy: 8, // ±8 meters as requested in prompt
    lastUpdated: Date.now()
  };

  /**
   * Get victim's current location. Attempts browser geolocation,
   * falls back safely to default hackathon demo coordinates.
   */
  async getCurrentLocation(): Promise<LocationCoords> {
    return new Promise((resolve) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: Number(position.coords.latitude.toFixed(4)),
              longitude: Number(position.coords.longitude.toFixed(4)),
              accuracy: Math.round(position.coords.accuracy) || 8,
              lastUpdated: Date.now()
            });
          },
          (_err) => {
            // Permission denied or offline GPS fallback
            resolve({ ...this.defaultCoords, lastUpdated: Date.now() });
          },
          { enableHighAccuracy: true, timeout: 3000, maximumAge: 10000 }
        );
      } else {
        resolve({ ...this.defaultCoords, lastUpdated: Date.now() });
      }
    });
  }

  /**
   * Determine disaster proximity, closest zone, and risk level.
   */
  evaluateDisasterRisk(
    lat: number,
    lon: number,
    zones: DisasterZone[] = DEFAULT_DISASTER_ZONES
  ): {
    riskLevel: RiskLevel;
    closestZone: DisasterZone;
    distanceKm: number;
    distanceToRescueKm: number;
  } {
    let closestZone = zones[0];
    let minDistance = 99999;

    for (const zone of zones) {
      const d = haversineDistanceKm(lat, lon, zone.latitude, zone.longitude);
      if (d < minDistance) {
        minDistance = d;
        closestZone = zone;
      }
    }

    const distanceToRescue = haversineDistanceKm(
      lat,
      lon,
      RESCUE_HEADQUARTERS.latitude,
      RESCUE_HEADQUARTERS.longitude
    );

    // Dynamic thresholds:
    // VERY CLOSE + HIGH SEVERITY -> RED / CRITICAL
    // MEDIUM DISTANCE -> YELLOW / WARNING
    // FARTHER AWAY -> GREEN / SAFE
    let riskLevel: RiskLevel = 'SAFE';

    if (minDistance <= closestZone.radiusKm) {
      riskLevel = 'CRITICAL'; // Inside or very close to high-risk zone
    } else if (minDistance <= closestZone.radiusKm + 1.2) {
      riskLevel = 'WARNING'; // Near a disaster-risk area
    } else {
      riskLevel = 'SAFE'; // Outside configured danger area
    }

    return {
      riskLevel,
      closestZone,
      distanceKm: minDistance,
      distanceToRescueKm: distanceToRescue
    };
  }
}

/**
 * Maps disaster risk classification directly to SOS emergency priority:
 * RED / CRITICAL ZONE   -> CRITICAL SOS
 * YELLOW / WARNING ZONE -> HIGH SOS
 * GREEN / SAFE ZONE     -> LOW SOS
 */
export function calculatePriorityFromRisk(riskLevel: RiskLevel): 'CRITICAL' | 'HIGH' | 'LOW' {
  switch (riskLevel) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'WARNING':
      return 'HIGH';
    case 'SAFE':
    default:
      return 'LOW';
  }
}

export const geoService = new GeoService();
