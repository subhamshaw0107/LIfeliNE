import { SosPacket, AckPacket, DeliveryStatus } from '../types';

export const STORAGE_KEYS = {
  PACKETS: 'lifeline_stored_sos_packets',
  SEEN_IDS: 'lifeline_seen_msg_ids',
  PENDING_QUEUE: 'lifeline_pending_relay_queue',
  ACKS: 'lifeline_stored_ack_packets',
  OFFLINE_SYNC: 'lifeline_offline_sync_queue'
} as const;

export class StorageEngine {
  private memoryCache: Map<string, SosPacket> = new Map();
  private ackCache: Map<string, AckPacket> = new Map();
  private seenSet: Set<string> = new Set();
  private isInitialized = false;
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
    this.init();
  }

  private getKey(key: string): string {
    return this.prefix ? `${this.prefix}_${key}` : key;
  }

  private init(): void {
    if (this.isInitialized) return;
    this.loadFromDisk();
    this.isInitialized = true;
  }

  private loadFromDisk(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;

      // 1. Load SOS packets
      const rawPackets = localStorage.getItem(this.getKey(STORAGE_KEYS.PACKETS));
      if (rawPackets) {
        const parsed: SosPacket[] = JSON.parse(rawPackets);
        parsed.forEach(p => this.memoryCache.set(p.id, p));
      }

      // 2. Load Seen IDs
      const rawSeen = localStorage.getItem(this.getKey(STORAGE_KEYS.SEEN_IDS));
      if (rawSeen) {
        const parsed: string[] = JSON.parse(rawSeen);
        parsed.forEach(id => this.seenSet.add(id));
      }

      // 3. Load ACKs
      const rawAcks = localStorage.getItem(this.getKey(STORAGE_KEYS.ACKS));
      if (rawAcks) {
        const parsed: AckPacket[] = JSON.parse(rawAcks);
        parsed.forEach(ack => this.ackCache.set(ack.ackId, ack));
      }
    } catch (err) {
      console.warn('[StorageEngine] Error loading from localStorage:', err);
    }
  }

  private persistPackets(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const arr = Array.from(this.memoryCache.values());
      localStorage.setItem(this.getKey(STORAGE_KEYS.PACKETS), JSON.stringify(arr));
    } catch (err) {
      console.warn('[StorageEngine] Error persisting packets:', err);
    }
  }

  private persistSeen(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const arr = Array.from(this.seenSet);
      // Keep up to 500 recent IDs to avoid unbounded growth
      const trimmed = arr.length > 500 ? arr.slice(arr.length - 500) : arr;
      localStorage.setItem(this.getKey(STORAGE_KEYS.SEEN_IDS), JSON.stringify(trimmed));
    } catch (err) {
      console.warn('[StorageEngine] Error persisting seen IDs:', err);
    }
  }

  private persistAcks(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const arr = Array.from(this.ackCache.values());
      localStorage.setItem(this.getKey(STORAGE_KEYS.ACKS), JSON.stringify(arr));
    } catch (err) {
      console.warn('[StorageEngine] Error persisting ACKs:', err);
    }
  }


  // --- CRUD Operations for SosPackets ---

  savePacket(packet: SosPacket): void {
    this.memoryCache.set(packet.id, packet);
    this.markSeen(packet.id);
    this.persistPackets();
  }

  getPacket(packetId: string): SosPacket | null {
    return this.memoryCache.get(packetId) || null;
  }

  getAllPackets(): SosPacket[] {
    return Array.from(this.memoryCache.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  deletePacket(packetId: string): boolean {
    const deleted = this.memoryCache.delete(packetId);
    if (deleted) {
      this.persistPackets();
    }
    return deleted;
  }

  hasPacket(packetId: string): boolean {
    return this.memoryCache.has(packetId);
  }

  updatePacketStatus(
    packetId: string,
    newStatus: DeliveryStatus,
    detail?: string,
    extraFields?: Partial<SosPacket>
  ): SosPacket | null {
    const packet = this.memoryCache.get(packetId);
    if (!packet) return null;

    packet.status = newStatus;
    const now = Date.now();
    packet.statusHistory.push({
      status: newStatus,
      timestamp: now,
      detail: detail || `Status updated to ${newStatus}`
    });

    if (newStatus === 'ACKNOWLEDGED') {
      packet.acknowledgedAt = now;
    } else if (newStatus === 'RESPONDING') {
      packet.respondingAt = now;
    } else if (newStatus === 'RESCUED') {
      packet.rescuedAt = now;
    }

    if (extraFields) {
      Object.assign(packet, extraFields);
    }

    this.persistPackets();
    return packet;
  }

  // --- Deduplication & Seen Tracking ---

  isSeen(packetId: string): boolean {
    return this.seenSet.has(packetId);
  }

  markSeen(packetId: string): void {
    if (!this.seenSet.has(packetId)) {
      this.seenSet.add(packetId);
      this.persistSeen();
    }
  }

  getSeenIds(): string[] {
    return Array.from(this.seenSet);
  }

  clearSeenCache(): void {
    this.seenSet.clear();
    this.persistSeen();
  }

  // --- ACK Storage ---

  saveAck(ack: AckPacket): void {
    this.ackCache.set(ack.ackId, ack);
    this.markSeen(ack.ackId);
    this.persistAcks();
  }

  getAck(ackId: string): AckPacket | null {
    return this.ackCache.get(ackId) || null;
  }

  getAcksForSos(sosId: string): AckPacket[] {
    return Array.from(this.ackCache.values()).filter(a => a.sosId === sosId);
  }

  // --- Clear / Reset ---

  clearAll(): void {
    this.memoryCache.clear();
    this.ackCache.clear();
    this.seenSet.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(this.getKey(STORAGE_KEYS.PACKETS));
        localStorage.removeItem(this.getKey(STORAGE_KEYS.SEEN_IDS));
        localStorage.removeItem(this.getKey(STORAGE_KEYS.PENDING_QUEUE));
        localStorage.removeItem(this.getKey(STORAGE_KEYS.ACKS));
        localStorage.removeItem(this.getKey(STORAGE_KEYS.OFFLINE_SYNC));
      }
    } catch {
      // ignore
    }
  }
}

export const defaultStorageEngine = new StorageEngine();
