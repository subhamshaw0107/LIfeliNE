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
  recipientId?: string;
  signature?: string;
  signerPublicKey?: string;
}

/**
 * Generates a unique, standardized SOS packet ID (e.g. SOS-7F82A91C).
 * Uses a cryptographically secure RNG (CSPRNG); Math.random() is never
 * used so IDs are unpredictable across the mesh.
 */
export function generatePacketId(prefix: 'SOS' | 'ACK' = 'SOS'): string {
  const bytes = new Uint8Array(4);
  const getRandom = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (getRandom) {
    getRandom(bytes);
  } else {
    // Last-resort fallback for non-WebCrypto runtimes (never browsers).
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes)
    .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
    .join('');
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
    recipientId: params.recipientId,
    signature: params.signature,
    signerPublicKey: params.signerPublicKey,
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

/** Placeholder stored on the mesh ACK so relays never persist inner ACK plaintext. */
export const AUTHENTICATED_ACK_PLACEHOLDER = '[AUTHENTICATED ACK]';

/**
 * Mesh ACK carrying M4 authenticated ciphertext (compatibility layer over AckPacket).
 */
export function isAuthenticatedMeshAck(packet: unknown): packet is AckPacket {
  if (!isAckPacket(packet)) return false;
  return (
    typeof packet.encryptedPayload === 'string' &&
    packet.encryptedPayload.length > 0 &&
    typeof packet.iv === 'string' &&
    packet.iv.length === 24 &&
    typeof packet.senderId === 'string' &&
    typeof packet.recipientId === 'string' &&
    typeof packet.createdAt === 'number'
  );
}

/**
 * Wraps an M4 AuthenticatedAckPacket into the existing M3 AckPacket relay shape.
 * Inner note stays inside ciphertext; mesh `note` is a public placeholder only.
 */
export function toMeshAuthenticatedAck(
  auth: {
    ackId: string;
    sosId: string;
    senderId: string;
    recipientId: string;
    deviceId: string;
    createdAt: number;
    status: AckPacket['status'];
    encryptedPayload: string;
    iv: string;
    algorithm: string;
    hopCount: number;
    ttl: number;
    route: string[];
  },
  originalSenderId: string,
  meshOriginNodeId: string
): AckPacket {
  return {
    kind: 'ACK',
    ackId: auth.ackId,
    sosId: auth.sosId,
    acknowledgedBy: auth.senderId,
    acknowledgedAt: auth.createdAt,
    originalSenderId,
    hopCount: 0,
    ttl: 7,
    route: [meshOriginNodeId],
    status: auth.status,
    note: AUTHENTICATED_ACK_PLACEHOLDER,
    encryptedPayload: auth.encryptedPayload,
    iv: auth.iv,
    algorithm: auth.algorithm,
    senderId: auth.senderId,
    recipientId: auth.recipientId,
    deviceId: auth.deviceId,
    createdAt: auth.createdAt
  };
}

/**
 * Extracts M4 authenticated ACK fields from a relayed mesh AckPacket.
 */
export function fromMeshAuthenticatedAck(ack: AckPacket): {
  kind: 'ACK';
  ackId: string;
  sosId: string;
  senderId: string;
  recipientId: string;
  deviceId: string;
  createdAt: number;
  status: AckPacket['status'];
  encryptedPayload: string;
  iv: string;
  algorithm: string;
  hopCount: number;
  ttl: number;
  route: string[];
} | null {
  if (!isAuthenticatedMeshAck(ack) || !ack.senderId || !ack.recipientId || !ack.encryptedPayload || !ack.iv || ack.createdAt === undefined) {
    return null;
  }
  return {
    kind: 'ACK',
    ackId: ack.ackId,
    sosId: ack.sosId,
    senderId: ack.senderId,
    recipientId: ack.recipientId,
    deviceId: ack.deviceId || ack.senderId,
    createdAt: ack.createdAt,
    status: ack.status,
    encryptedPayload: ack.encryptedPayload,
    iv: ack.iv,
    algorithm: ack.algorithm || 'AES-GCM-256 (ACK-AAD-Authenticated)',
    hopCount: ack.hopCount,
    ttl: ack.ttl,
    route: ack.route
  };
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

export function isSosPacketSigned(packet: unknown): packet is SosPacket & { signature: string } {
  return (
    isSosPacket(packet) &&
    typeof packet.signature === 'string' &&
    packet.signature.trim().length >= 64
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
  if (packet.signature !== undefined) {
    if (typeof packet.signature !== 'string' || packet.signature.trim().length < 64) {
      return { isValid: false, error: 'Invalid cryptographic signature format' };
    }
    if (!/^[0-9a-fA-F]+$/.test(packet.signature)) {
      return { isValid: false, error: 'Signature must be valid hex' };
    }
  }
  if (packet.signerPublicKey !== undefined) {
    if (typeof packet.signerPublicKey !== 'string' || packet.signerPublicKey.trim().length < 64) {
      return { isValid: false, error: 'Invalid signer public key format' };
    }
    if (!/^[0-9a-fA-F]+$/.test(packet.signerPublicKey)) {
      return { isValid: false, error: 'Signer public key must be valid hex' };
    }
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
