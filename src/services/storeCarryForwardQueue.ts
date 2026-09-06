import { SosPacket, EmergencyPriority, RiskLevel } from '../types';

const PRIORITY_WEIGHTS: Record<EmergencyPriority, number> = {
  CRITICAL: 3,
  HIGH: 2,
  MEDIUM: 1,
  LOW: 0
};

export class StoreCarryForwardQueue {
  private queue: SosPacket[] = [];

  /**
   * Add a packet to the queue, maintaining priority-then-timestamp ordering.
   */
  enqueue(packet: SosPacket): void {
    // Prevent duplicate entries of the same packet in the pending queue
    const existingIndex = this.queue.findIndex(p => p.id === packet.id);
    if (existingIndex !== -1) {
      this.queue[existingIndex] = packet;
      this.sort();
      return;
    }

    this.queue.push(packet);
    this.sort();
  }

  /**
   * Sort queue so highest priority and oldest timestamp comes first.
   */
  private sort(): void {
    this.queue.sort((a, b) => {
      const weightA = PRIORITY_WEIGHTS[a.priority] ?? 0;
      const weightB = PRIORITY_WEIGHTS[b.priority] ?? 0;
      if (weightB !== weightA) {
        return weightB - weightA; // Descending priority
      }
      return a.timestamp - b.timestamp; // Ascending age (older first)
    });
  }

  /**
   * Retrieve and remove the highest priority pending packet.
   */
  dequeue(): SosPacket | null {
    return this.queue.shift() || null;
  }

  /**
   * Look at the highest priority pending packet without removing it.
   */
  peek(): SosPacket | null {
    return this.queue[0] || null;
  }

  /**
   * Retrieve all currently queued packets.
   */
  getAll(): SosPacket[] {
    return [...this.queue];
  }

  /**
   * Remove a specific packet by ID (e.g. after successful delivery or expiration).
   */
  remove(packetId: string): boolean {
    const initialLen = this.queue.length;
    this.queue = this.queue.filter(p => p.id !== packetId);
    return this.queue.length < initialLen;
  }

  /**
   * Dynamically update priority and risk of a queued packet (e.g. when victim enters Red Zone).
   */
  updatePriority(
    packetId: string,
    newPriority: EmergencyPriority,
    newRiskLevel?: RiskLevel
  ): boolean {
    const packet = this.queue.find(p => p.id === packetId);
    if (!packet) return false;

    packet.priority = newPriority;
    if (newRiskLevel) {
      packet.riskLevel = newRiskLevel;
    }
    this.sort();
    return true;
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  clear(): void {
    this.queue = [];
  }
}

export const storeCarryForwardQueue = new StoreCarryForwardQueue();
