export type UserRole = 'VICTIM' | 'RESCUE_TEAM';

export type MeshStatus = 'CONNECTED' | 'SEARCHING' | 'OFFLINE';

export type SimpleNetworkStatus =
  | 'CONNECTED'
  | 'SEARCHING'
  | 'WAITING_RELAY'
  | 'FORWARDED'
  | 'DELIVERED';

export type RiskLevel = 'CRITICAL' | 'WARNING' | 'SAFE';

export type DeliveryStatus =
  | 'CREATED'
  | 'ENCRYPTED'
  | 'STORED'
  | 'RELAYING'
  | 'DELIVERED'
  | 'ACKNOWLEDGED'
  | 'RESPONDING'
  | 'RESCUED';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  lastUpdated: number;
}

export type EmergencyPriority = 'CRITICAL' | 'HIGH' | 'LOW' | 'MEDIUM';

export interface SosPacket {
  id: string; // e.g. "SOS-7F82A91C"
  senderId: string; // e.g. "PERSON-A"
  deviceId: string; // e.g. "DEV-A8F31C"
  userId: string;
  userName: string;
  timestamp: number;
  timeFormatted: string;
  latitude: number;
  longitude: number;
  gpsAccuracy: number;
  priority: EmergencyPriority;
  riskLevel: RiskLevel;
  disasterZoneName: string;
  distanceFromDisasterKm: number;
  distanceFromRescueKm: number;
  message: string;
  messageType: 'SOS' | 'QUICK_MSG' | 'STATUS_UPDATE';
  ttl: number;
  hopCount: number;
  route: string[];
  status: DeliveryStatus;
  encryptionStatus: 'AUTHENTICATED_AES_GCM_VALID';
  encryptedPayload: string;
  iv: string;
  batteryLevel: number;
  createdAt: number;
  expiresAt?: number;
  forwardingState?: 'PENDING' | 'FORWARDING' | 'FORWARDED' | 'DELIVERED' | 'EXPIRED';
  acknowledgedAt?: number;
  respondingAt?: number;
  rescuedAt?: number;
  statusHistory: {
    status: DeliveryStatus;
    timestamp: number;
    detail: string;
  }[];
}

export interface MeshNode {
  id: string;
  name: string;
  type: 'VICTIM' | 'RELAY' | 'RESCUE_GATEWAY' | 'SHELTER';
  latitude: number;
  longitude: number;
  battery: number;
  rangeKm: number; // default ~1.0 km
  distanceToVictimKm?: number;
  isConnected: boolean;
  storedPacketsCount: number;
  status: 'ACTIVE' | 'SEARCHING' | 'OUT_OF_RANGE';
}

export interface DisasterZone {
  id: string;
  name: string;
  type: 'FLOOD' | 'EARTHQUAKE' | 'WILDFIRE' | 'CYCLONE';
  latitude: number;
  longitude: number;
  radiusKm: number;
  severity: 'EXTREME' | 'HIGH' | 'MODERATE';
  description: string;
}

export interface UserAccount {
  userId: string;
  name: string;
  phoneId: string;
  role: UserRole;
  emergencyContact?: string;
}

export interface RateLimitState {
  countInWindow: number;
  maxAllowed: number; // 2
  windowHours: number; // 1
  timestamps: number[];
  canSend: boolean;
  cooldownRemainingSeconds: number;
  twentyFourHourCount: number;
}

export interface DemoStepState {
  currentStep: number;
  totalSteps: number;
  title: string;
  description: string;
  isActive: boolean;
  autoPlay: boolean;
}

export type PacketKind = 'SOS' | 'ACK' | 'SENSOR_ALERT' | 'HEARTBEAT';

export interface AckPacket {
  kind: 'ACK';
  ackId: string;
  sosId: string;
  acknowledgedBy: string;
  acknowledgedAt: number;
  originalSenderId: string;
  hopCount: number;
  ttl: number;
  route: string[];
  status: 'ACKNOWLEDGED' | 'RESPONDING' | 'RESCUED';
  note?: string;
}

export interface ShelterLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity: string;
  status: string;
}

export interface BlockedRoad {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  severity: 'BLOCKED' | 'HAZARDOUS' | 'CLEAR';
  description: string;
}

// Single M2 contract lives in transport/meshTransport.ts; re-exported here
// so existing `from '../types'` imports keep working without drift.
export type { MeshTransport, PacketReceivedCallback } from '../transport/meshTransport';

