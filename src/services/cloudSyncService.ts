import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../config/supabaseClient';
import { sosRepository } from '../repositories/sosRepository';
import { storageService } from './storageService';
import { cryptoService } from './cryptoService';
import type { SosPacket, AckPacket } from '../types';

/**
 * CloudSyncService — OPTIONAL offline-first Supabase sync. Owned by the
 * UI/manual-sync layer only; PacketEngine and BLE never import this
 * module, so cloud failure can never block emergency communication.
 *
 * Semantics:
 *  - Reads pending SOS IDs from the persistent local queue.
 *  - Uploads incidents (upsert on sos_id), hops derived from route[],
 *    ACKs, and the device row.
 *  - Removes an ID from the queue ONLY after its own server
 *    confirmation. Failed IDs stay queued for later retry.
 *  - Local SOS data is never deleted because an upload failed.
 *  - Demo seed packets are explicitly skipped (never uploaded).
 */

// Demo seed SOS IDs shipped for the web demo dashboard (AppContext
// INITIAL_MOCK_SOS). Real runtime-generated SOS-* IDs always sync.
export const DEMO_SEED_SOS_IDS: ReadonlySet<string> = new Set([
  'SOS-3B19E42D',
  'SOS-8C91FA02',
  'SOS-11DA49E7',
]);

export interface SyncStats {
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  remaining: number;
}

/** Minimal DB surface used (real SupabaseClient satisfies this). */
export interface CloudTable {
  upsert(
    rows: Record<string, unknown>[],
    options?: { onConflict?: string }
  ): Promise<{ error: { message: string } | null }>;
}

export interface CloudDb {
  from(table: string): CloudTable;
}

export interface SyncDependencies {
  getQueuedIds(): string[];
  removeFromSyncQueue(ids: string[]): void;
  getPacket(id: string): SosPacket | null;
  getAcksForSos(sosId: string): AckPacket[];
  getDeviceId(): Promise<string>;
  getDevicePublicKey(): Promise<string | null>;
}

export function defaultSyncDependencies(): SyncDependencies {
  return {
    getQueuedIds: () => storageService.getQueuedIds(),
    removeFromSyncQueue: ids => storageService.removeFromSyncQueue(ids),
    getPacket: id => sosRepository.getPacket(id),
    getAcksForSos: sosId => sosRepository.getAcksForSos(sosId),
    getDeviceId: () => cryptoService.getDeviceId(),
    getDevicePublicKey: async () => {
      try {
        const identity = await cryptoService.getPublicIdentity();
        return identity?.publicKeyHex ?? null;
      } catch {
        return null;
      }
    },
  };
}

const toIso = (epochMs: number): string => {
  try {
    return new Date(epochMs).toISOString();
  } catch {
    return new Date().toISOString();
  }
};

export function buildIncidentRow(packet: SosPacket): Record<string, unknown> {
  return {
    sos_id: packet.id,
    origin_device_id: packet.deviceId,
    latitude: packet.latitude,
    longitude: packet.longitude,
    priority: packet.priority,
    created_at: toIso(packet.createdAt),
    status: packet.status,
  };
}

/** Hop N = route[N]; timestamps fall back to the packet timestamp. */
export function buildHopRows(packet: SosPacket): Record<string, unknown>[] {
  if (!Array.isArray(packet.route) || packet.route.length === 0) return [];
  return packet.route.map((nodeId, hopNumber) => ({
    sos_id: packet.id,
    hop_number: hopNumber,
    node_id: nodeId,
    timestamp: toIso(packet.timestamp),
  }));
}

export function buildAckRows(acks: AckPacket[]): Record<string, unknown>[] {
  return acks.map(ack => ({
    ack_id: ack.ackId,
    sos_id: ack.sosId,
    hq_device_id: ack.acknowledgedBy,
    timestamp: toIso(ack.acknowledgedAt),
    status: ack.status,
  }));
}

export function buildDeviceRow(
  deviceId: string,
  publicKeyHex: string | null
): Record<string, unknown> {
  return {
    device_id: deviceId,
    public_key: publicKeyHex,
    last_seen: toIso(Date.now()),
    status: 'ACTIVE',
  };
}

async function upsertAll(
  client: CloudDb,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<boolean> {
  if (rows.length === 0) return true;
  try {
    const { error } = await client.from(table).upsert(rows, { onConflict });
    return error == null;
  } catch {
    return false;
  }
}

/**
 * Normalize any Supabase-shaped client (real Postgrest thenables or the
 * CloudDb fakes) behind the CloudDb interface. Duck-typed so executor
 * code never depends on postgrest internals.
 */
function asCloudDb(client: SupabaseClient | CloudDb): CloudDb {
  const source = client as unknown as CloudDb;
  return {
    from: (table: string): CloudTable => ({
      upsert: async (rows, options) => {
        try {
          const res = await source.from(table).upsert(rows, options);
          const err = res?.error as { message?: unknown } | null | undefined;
          if (!err) return { error: null };
          const message = typeof err.message === 'string' ? err.message : 'unknown database error';
          return { error: { message } };
        } catch {
          return { error: { message: 'network or client failure' } };
        }
      },
    }),
  };
}

/**
 * Sync every queued ID once. Returns per-ID statistics. Never throws:
 * total client absence / network failure yields attempted=0 or all-failed
 * with the queue intact.
 */
export async function syncPendingQueue(
  client: SupabaseClient | CloudDb | null = getSupabaseClient(),
  deps: SyncDependencies = defaultSyncDependencies()
): Promise<SyncStats> {
  const stats: SyncStats = { attempted: 0, succeeded: 0, failed: 0, skipped: 0, remaining: 0 };
  const queued = deps.getQueuedIds();
  if (client == null) {
    stats.remaining = queued.length;
    return stats; // offline/unconfigured: nothing attempted, queue intact
  }
  const db = asCloudDb(client);

  let deviceId: string | null = null;
  let deviceKey: string | null = null;
  try {
    deviceId = await deps.getDeviceId();
    deviceKey = await deps.getDevicePublicKey();
  } catch {
    deviceId = null;
  }
  if (deviceId) {
    // Best-effort only: a failed device row must not fail SOS uploads.
    await upsertAll(db, 'devices', [buildDeviceRow(deviceId, deviceKey)], 'device_id');
  }

  const confirmed: string[] = [];
  for (const sosId of queued) {
    if (DEMO_SEED_SOS_IDS.has(sosId)) {
      stats.skipped++;
      confirmed.push(sosId); // seeds never belong in the cloud queue
      continue;
    }
    const packet = deps.getPacket(sosId);
    if (!packet) {
      stats.skipped++; // dangling ID: nothing to upload, stop retrying it
      confirmed.push(sosId);
      continue;
    }
    stats.attempted++;
    const incidentOk = await upsertAll(db, 'incidents', [buildIncidentRow(packet)], 'sos_id');
    const hopsOk = await upsertAll(db, 'packet_hops', buildHopRows(packet), 'sos_id,hop_number');
    const acksOk = await upsertAll(
      db,
      'acknowledgements',
      buildAckRows(deps.getAcksForSos(sosId)),
      'ack_id'
    );
    if (incidentOk && hopsOk && acksOk) {
      stats.succeeded++;
      confirmed.push(sosId);
    } else {
      stats.failed++; // stays queued for a later retry
    }
  }

  if (confirmed.length > 0) {
    deps.removeFromSyncQueue(confirmed);
  }
  stats.remaining = deps.getQueuedIds().length;
  return stats;
}

// ---------------------------------------------------------------------------
// Bounded retry: failed IDs stay queued; retries back off exponentially
// (5s base, x2, 5min cap, 10 attempts max). Manual sync always works and
// correctness never depends on online-event detection.
// ---------------------------------------------------------------------------

const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 5 * 60 * 1000;
const RETRY_MAX_ATTEMPTS = 10;

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let onlineListenerAttached = false;

function clearRetryTimer(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetryInternal(): void {
  clearRetryTimer();
  if (retryAttempt >= RETRY_MAX_ATTEMPTS) return;
  const delay = Math.min(RETRY_BASE_MS * 2 ** retryAttempt, RETRY_MAX_MS);
  retryAttempt++;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void syncPendingQueue().then(stats => {
      if (stats.failed > 0 && stats.remaining > 0) {
        scheduleRetryInternal();
      } else {
        retryAttempt = 0;
      }
    });
  }, delay);
}

/** Manual entry point for UI: runs one pass, then (re)arms backoff. */
export async function syncNow(): Promise<SyncStats> {
  const stats = await syncPendingQueue();
  if (stats.failed > 0 && stats.remaining > 0) {
    scheduleRetryInternal();
  } else {
    retryAttempt = 0;
    clearRetryTimer();
  }
  return stats;
}

/** Optional online-event kick; safe no-op off-browser. Never required. */
export function enableAutoRetryOnReconnect(): void {
  try {
    if (onlineListenerAttached || typeof window === 'undefined' || !window.addEventListener) return;
    onlineListenerAttached = true;
    window.addEventListener('online', () => {
      retryAttempt = 0;
      void syncNow();
    });
  } catch {
    // ignore
  }
}

/** Test seam: reset retry bookkeeping between cases. */
export function resetSyncRetryForTests(): void {
  clearRetryTimer();
  retryAttempt = 0;
  onlineListenerAttached = false;
}
