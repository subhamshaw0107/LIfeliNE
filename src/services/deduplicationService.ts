import { SosPacket, AckPacket } from '../types';
import { defaultStorageEngine, StorageEngine } from '../storage/storageEngine';

export class DeduplicationService {
  private seenIds: Set<string> = new Set();
  private maxCacheSize: number;
  private storage: StorageEngine;

  constructor(maxCacheSize = 1000, storage: StorageEngine = defaultStorageEngine) {
    this.maxCacheSize = maxCacheSize;
    this.storage = storage;
    this.loadInitialSeen();
  }

  private loadInitialSeen(): void {
    const persisted = this.storage.getSeenIds();
    persisted.forEach(id => this.seenIds.add(id));
  }

  /**
   * Check if a packet ID has already been seen or processed.
   */
  hasSeen(packetId: string): boolean {
    return this.seenIds.has(packetId);
  }

  /**
   * Record a packet ID as seen in memory and persistent storage.
   */
  markSeen(packetId: string): void {
    if (!this.seenIds.has(packetId)) {
      if (this.seenIds.size >= this.maxCacheSize) {
        // Evict oldest entry
        const firstKey = this.seenIds.values().next().value;
        if (firstKey) this.seenIds.delete(firstKey);
      }
      this.seenIds.add(packetId);
      this.storage.markSeen(packetId);
    }
  }

  /**
   * Check if routing loop is detected (i.e. node is already in packet's route history).
   */
  isLoopDetected(packet: SosPacket | AckPacket, targetNodeId: string): boolean {
    return packet.route.includes(targetNodeId);
  }

  /**
   * Filter an array of packets, returning only those not yet seen.
   */
  filterUnseen<T extends { id?: string; ackId?: string }>(packets: T[]): T[] {
    return packets.filter(p => {
      const id = p.id || p.ackId;
      return id ? !this.hasSeen(id) : true;
    });
  }

  /**
   * Clear the seen cache (useful in tests).
   */
  clear(): void {
    this.seenIds.clear();
    this.storage.clearSeenCache();
  }

  getSeenCount(): number {
    return this.seenIds.size;
  }
}

export const deduplicationService = new DeduplicationService();
