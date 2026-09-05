import { DeliveryStatus, SosPacket } from '../types';

const STORAGE_KEY_SOS_LIST = 'lifeline_stored_sos_packets';
const STORAGE_KEY_SEEN_MESSAGES = 'lifeline_seen_msg_ids';
const STORAGE_KEY_OFFLINE_QUEUE = 'lifeline_offline_sync_queue';
const STORAGE_KEY_SYNC_STATE = 'lifeline_sync_state';

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
    try {
      const data = localStorage.getItem(STORAGE_KEY_SOS_LIST);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  /**
   * Save an SOS packet to local storage (Store stage of Store-Carry-Forward).
   */
  saveSosPacket(packet: SosPacket): void {
    const list = this.getStoredSosPackets();
    const existingIndex = list.findIndex(p => p.id === packet.id);
    if (existingIndex >= 0) {
      list[existingIndex] = packet;
    } else {
      list.unshift(packet);
    }
    localStorage.setItem(STORAGE_KEY_SOS_LIST, JSON.stringify(list));

    // Also record into seen message IDs for loop prevention
    this.markMessageAsSeen(packet.id);

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
    const list = this.getStoredSosPackets();
    const packet = list.find(p => p.id === sosId);
    if (!packet) return null;

    packet.status = newStatus;
    packet.statusHistory.push({
      status: newStatus,
      timestamp: Date.now(),
      detail
    });

    if (extraFields) {
      Object.assign(packet, extraFields);
    }

    localStorage.setItem(STORAGE_KEY_SOS_LIST, JSON.stringify(list));
    return packet;
  }

  /**
   * Check if a message ID has already been seen (duplicate protection).
   */
  isMessageSeen(messageId: string): boolean {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SEEN_MESSAGES);
      if (!data) return false;
      const set: string[] = JSON.parse(data);
      return set.includes(messageId);
    } catch {
      return false;
    }
  }

  markMessageAsSeen(messageId: string): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SEEN_MESSAGES);
      const list: string[] = data ? JSON.parse(data) : [];
      if (!list.includes(messageId)) {
        list.push(messageId);
        // Keep last 200 message IDs to prevent unbounded memory
        if (list.length > 200) list.shift();
        localStorage.setItem(STORAGE_KEY_SEEN_MESSAGES, JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  }

  /**
   * Queue packet ID for cloud sync when internet returns.
   */
  queueForSync(packetId: string): void {
    try {
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
      const data = localStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
      return data ? JSON.parse(data).length : 0;
    } catch {
      return 0;
    }
  }

  clearSyncQueue(): void {
    localStorage.removeItem(STORAGE_KEY_OFFLINE_QUEUE);
  }
}

export const storageService = new StorageService();
