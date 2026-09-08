import { SosPacket } from '../types';

export type ReplayCheckResult =
  | 'ACCEPT'
  | 'REJECT_ALREADY_SEEN'
  | 'REJECT_EXPIRED'
  | 'REJECT_INVALID_TIMESTAMP'
  | 'REJECT_FUTURE_TIMESTAMP';

export interface ReplayProtectionOptions {
  /**
   * Maximum allowed age of a message in milliseconds.
   * Default: 24 hours (24 * 60 * 60 * 1000 ms), suitable for store-and-forward mesh delays.
   */
  maxMessageAgeMs?: number;

  /**
   * Allowed clock-skew window for future timestamps in milliseconds.
   * Default: 5 minutes (5 * 60 * 1000 ms), tolerates un-synced device clocks.
   */
  clockSkewWindowMs?: number;

  /**
   * Reference time in epoch ms for verification (useful for mocking/testing).
   * Defaults to Date.now().
   */
  now?: number;
}

export interface ReplayRecord {
  messageId: string;
  createdAt: number;
  recordedAt: number;
}

export const DEFAULT_MAX_MESSAGE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const DEFAULT_CLOCK_SKEW_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export class ReplayProtectionService {
  private cache: Map<string, ReplayRecord> = new Map();
  private storagePrefix: string;

  constructor(storagePrefix: string = '') {
    this.storagePrefix = storagePrefix;
    this.loadFromStorage();
  }

  private getStorageKey(): string {
    return this.storagePrefix
      ? `${this.storagePrefix}_lifeline_replay_records`
      : 'lifeline_replay_records';
  }

  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(this.getStorageKey());
        if (raw) {
          const records: ReplayRecord[] = JSON.parse(raw);
          const now = Date.now();
          // Filter out expired records on boot
          records.forEach(r => {
            if (now - r.createdAt <= DEFAULT_MAX_MESSAGE_AGE_MS + DEFAULT_CLOCK_SKEW_WINDOW_MS) {
              this.cache.set(r.messageId, r);
            }
          });
        }
      }
    } catch {
      // Safe fallback to in-memory
    }
  }

  private persistToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const records = Array.from(this.cache.values());
        window.localStorage.setItem(this.getStorageKey(), JSON.stringify(records));
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Checks message freshness and anti-replay status without modifying the cache.
   */
  checkReplayAndFreshness(
    packet: Partial<SosPacket>,
    options?: ReplayProtectionOptions
  ): ReplayCheckResult {
    const messageId = packet.id;
    if (!messageId || typeof messageId !== 'string' || !messageId.trim()) {
      return 'REJECT_INVALID_TIMESTAMP';
    }

    const createdAt = packet.createdAt;
    if (
      typeof createdAt !== 'number' ||
      isNaN(createdAt) ||
      !isFinite(createdAt) ||
      createdAt <= 0
    ) {
      return 'REJECT_INVALID_TIMESTAMP';
    }

    const now = options?.now ?? Date.now();
    const maxAge = options?.maxMessageAgeMs ?? DEFAULT_MAX_MESSAGE_AGE_MS;
    const clockSkew = options?.clockSkewWindowMs ?? DEFAULT_CLOCK_SKEW_WINDOW_MS;

    // 1. Clock skew check (timestamp too far in future)
    if (createdAt > now + clockSkew) {
      return 'REJECT_FUTURE_TIMESTAMP';
    }

    // 2. Age / Expiry check
    if (now - createdAt > maxAge) {
      return 'REJECT_EXPIRED';
    }

    // 3. Explicit expiresAt check
    if (packet.expiresAt && typeof packet.expiresAt === 'number' && now > packet.expiresAt) {
      return 'REJECT_EXPIRED';
    }

    // 4. Bounded cleanup before checking presence
    this.cleanupExpired(now, maxAge, clockSkew);

    // 5. Already seen / Replay check
    if (this.cache.has(messageId)) {
      return 'REJECT_ALREADY_SEEN';
    }

    return 'ACCEPT';
  }

  /**
   * Records a processed message ID and timestamp in the replay cache.
   */
  recordProcessed(messageId: string, createdAt: number, now?: number): void {
    const recordedAt = now ?? Date.now();
    this.cache.set(messageId, {
      messageId,
      createdAt,
      recordedAt
    });
    this.persistToStorage();
  }

  /**
   * Atomic check-and-record operation to eliminate race conditions between concurrent packets.
   */
  checkAndRecord(
    packet: Partial<SosPacket>,
    options?: ReplayProtectionOptions
  ): ReplayCheckResult {
    const result = this.checkReplayAndFreshness(packet, options);
    if (result === 'ACCEPT') {
      const now = options?.now ?? Date.now();
      this.recordProcessed(packet.id!, packet.createdAt!, now);
    }
    return result;
  }

  /**
   * Prunes records older than the maximum validity window so cache does not grow indefinitely.
   */
  cleanupExpired(
    now?: number,
    maxAge = DEFAULT_MAX_MESSAGE_AGE_MS,
    clockSkew = DEFAULT_CLOCK_SKEW_WINDOW_MS
  ): number {
    const referenceTime = now ?? Date.now();
    const retentionLimit = maxAge + clockSkew;
    let prunedCount = 0;

    for (const [id, record] of this.cache.entries()) {
      if (referenceTime - record.createdAt > retentionLimit) {
        this.cache.delete(id);
        prunedCount++;
      }
    }

    if (prunedCount > 0) {
      this.persistToStorage();
    }
    return prunedCount;
  }

  /**
   * Check if a messageId is currently in the replay cache.
   */
  hasSeen(messageId: string): boolean {
    return this.cache.has(messageId);
  }

  /**
   * Size of the active replay cache.
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Clears the cache (useful for testing).
   */
  clear(): void {
    this.cache.clear();
    this.persistToStorage();
  }

  /**
   * Returns a clean copy of the replay records for inspection (guaranteed no plaintext or keys).
   */
  getRecords(): ReplayRecord[] {
    return Array.from(this.cache.values());
  }
}

export const replayProtectionService = new ReplayProtectionService();
