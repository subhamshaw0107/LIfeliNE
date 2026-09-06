import { SosPacket, AckPacket, EmergencyPriority, RiskLevel, DeliveryStatus } from '../types';

export type MeshPacket = SosPacket | AckPacket;

export interface CreateSosPacketParams {
  id?: string;
  senderId: string;
  deviceId: string;
  userId?: string;
  userName?: string;
  latitude: number;
  longitude: number;
  gpsAccuracy?: number;
  priority?: EmergencyPriority;
  riskLevel?: RiskLevel;
  disasterZoneName?: string;
  distanceFromDisasterKm?: number;
  distanceFromRescueKm?: number;
  message?: string;
  messageType?: 'SOS' | 'QUICK_MSG' | 'STATUS_UPDATE';
  ttl?: number;
  hopCount?: number;
  batteryLevel?: number;
  encryptedPayload?: string;
  iv?: string;
}

/**
 * Generates a unique, standardized SOS packet ID (e.g. SOS-7F82A91C).
 */
export function generatePacketId(prefix: 'SOS' | 'ACK' = 'SOS'): string {
  const hex = Math.random().toString(16).substring(2, 10).toUpperCase();
  return `${prefix}-${hex}`;
}

/**
 * Factory to create a fully-formed, valid SosPacket.
 */
export function createSosPacket(params: CreateSosPacketParams): SosPacket {
  const now = Date.now();
  const d = new Date(now);
  const timeFormatted = `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;

  const packetId = params.id || generatePacketId('SOS');
  const initialStatus: DeliveryStatus = 'CREATED';

  return {
    id: packetId,
    senderId: params.senderId,
    deviceId: params.deviceId,
    userId: params.userId || params.senderId,
    userName: params.userName || params.senderId,
    timestamp: now,
    timeFormatted,
    latitude: params.latitude,
    longitude: params.longitude,
    gpsAccuracy: params.gpsAccuracy ?? 8,
    priority: params.priority || 'HIGH',
    riskLevel: params.riskLevel || 'SAFE',
    disasterZoneName: params.disasterZoneName || 'Clear Zone',
    distanceFromDisasterKm: params.distanceFromDisasterKm ?? 0,
    distanceFromRescueKm: params.distanceFromRescueKm ?? 0,
    message: params.message || 'EMERGENCY SOS BROADCAST',
    messageType: params.messageType || 'SOS',
    ttl: params.ttl ?? 7,
    hopCount: params.hopCount ?? 0,
    route: [params.senderId],
    status: initialStatus,
    encryptionStatus: 'AUTHENTICATED_AES_GCM_VALID',
    encryptedPayload: params.encryptedPayload || '',
    iv: params.iv || '',
    batteryLevel: params.batteryLevel ?? 100,
    createdAt: now,
    statusHistory: [
      {
        status: initialStatus,
        timestamp: now,
        detail: `SOS packet initialized by ${params.senderId}`
      }
    ]
  };
}

/**
 * Factory to create an AckPacket responding to an SOS.
 */
export function createAckPacket(
  sosPacket: SosPacket,
  acknowledgedBy: string,
  status: 'ACKNOWLEDGED' | 'RESPONDING' | 'RESCUED' = 'ACKNOWLEDGED',
  note?: string
): AckPacket {
  const now = Date.now();
  return {
    kind: 'ACK',
    ackId: generatePacketId('ACK'),
    sosId: sosPacket.id,
    acknowledgedBy,
    acknowledgedAt: now,
    originalSenderId: sosPacket.senderId,
    hopCount: 0,
    ttl: 7,
    route: [acknowledgedBy],
    status,
    note: note || `Acknowledged by ${acknowledgedBy}`
  };
}

/**
 * Type guard to check if a packet is an AckPacket.
 */
export function isAckPacket(packet: unknown): packet is AckPacket {
  if (!packet || typeof packet !== 'object') return false;
  const p = packet as Record<string, unknown>;
  return p.kind === 'ACK' && typeof p.sosId === 'string' && typeof p.ackId === 'string';
}

/**
 * Type guard to check if a packet is a SosPacket.
 */
export function isSosPacket(packet: unknown): packet is SosPacket {
  if (!packet || typeof packet !== 'object') return false;
  const p = packet as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.senderId === 'string' &&
    typeof p.latitude === 'number' &&
    typeof p.longitude === 'number' &&
    typeof p.priority === 'string' &&
    typeof p.ttl === 'number' &&
    typeof p.hopCount === 'number' &&
    Array.isArray(p.route)
  );
}

/**
 * Validates essential fields of a SosPacket.
 */
export function validateSosPacket(packet: unknown): { isValid: boolean; error?: string } {
  if (!isSosPacket(packet)) {
    return { isValid: false, error: 'Malformed SOS packet structure' };
  }
  if (!packet.id || !packet.id.startsWith('SOS-')) {
    return { isValid: false, error: `Invalid packet ID: ${packet.id}` };
  }
  if (isNaN(packet.latitude) || isNaN(packet.longitude)) {
    return { isValid: false, error: 'Invalid GPS coordinates' };
  }
  if (packet.ttl < 0) {
    return { isValid: false, error: 'Packet TTL cannot be negative' };
  }
  return { isValid: true };
}

/**
 * Serializes any mesh packet to a clean JSON string.
 */
export function serializePacketToString(packet: MeshPacket): string {
  return JSON.stringify(packet);
}

/**
 * Deserializes a string into a MeshPacket (SosPacket or AckPacket).
 */
export function deserializePacketFromString(jsonStr: string): MeshPacket | null {
  try {
    const parsed = JSON.parse(jsonStr);
    if (isAckPacket(parsed)) return parsed;
    if (isSosPacket(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Serializes a mesh packet to a Uint8Array byte array for transport over BLE/Wi-Fi Direct.
 */
export function serializePacketToBytes(packet: MeshPacket): Uint8Array {
  const jsonStr = serializePacketToString(packet);
  return new TextEncoder().encode(jsonStr);
}

/**
 * Deserializes a Uint8Array byte array received from transport into a MeshPacket.
 */
export function deserializePacketFromBytes(bytes: Uint8Array): MeshPacket | null {
  try {
    const jsonStr = new TextDecoder().decode(bytes);
    return deserializePacketFromString(jsonStr);
  } catch {
    return null;
  }
}
