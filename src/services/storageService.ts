import { DeliveryStatus, SosPacket } from '../types';
import { sosRepository } from '../repositories/sosRepository';

const STORAGE_KEY_OFFLINE_QUEUE = 'lifeline_offline_sync_queue';

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedTimestamp: number | null;
  unsyncedCount: number;
}

class StorageService {
  /**
   * Get all stored SOS packets (local device store).
   */
  getStoredSosPackets(): SosPacket[] {
    return sosRepository.getAllPackets();
  }

  /**
   * Save an SOS packet to local storage (Store stage of Store-Carry-Forward).
   */
  saveSosPacket(packet: SosPacket): void {
    sosRepository.savePacket(packet);
    // Queue for cloud backend sync when connectivity is available
    this.queueForSync(packet.id);
  }

  /**
   * Update delivery status and append history detail.
   */
  updateSosStatus(
    sosId: string,
    newStatus: DeliveryStatus,
    detail: string,
    extraFields?: Partial<SosPacket>
  ): SosPacket | null {
    return sosRepository.updateStatus(sosId, newStatus, detail, extraFields);
  }

  /**
   * Check if a message ID has already been seen (duplicate protection).
   */
  isMessageSeen(messageId: string): boolean {
    return sosRepository.isSeen(messageId);
  }

  markMessageAsSeen(messageId: string): void {
    sosRepository.markSeen(messageId);
  }

  /**
   * Queue packet ID for cloud sync when internet returns.
   */
  queueForSync(packetId: string): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const data = localStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
      const queue: string[] = data ? JSON.parse(data) : [];
      if (!queue.includes(packetId)) {
        queue.push(packetId);
        localStorage.setItem(STORAGE_KEY_OFFLINE_QUEUE, JSON.stringify(queue));
      }
    } catch {
      // ignore
    }
  }

  getUnsyncedCount(): number {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return 0;
      const data = localStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
      return data ? JSON.parse(data).length : 0;
    } catch {
      return 0;
    }
  }

  clearSyncQueue(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(STORAGE_KEY_OFFLINE_QUEUE);
      }
    } catch {
      // ignore
    }
  }
}

export const storageService = new StorageService();
