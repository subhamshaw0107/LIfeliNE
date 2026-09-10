/**
 * LIFELINE cloud sync tests (no internet, no live Supabase).
 * Fake CloudDb + fake deps drive CloudSyncService through:
 * null client, success, failure, partial, idempotency, seed skip,
 * persistence, ACKs, hops, device row, RLS-style failure, engine isolation.
 */

import {
  syncPendingQueue,
  buildHopRows,
  DEMO_SEED_SOS_IDS,
  resetSyncRetryForTests,
  type CloudDb,
  type SyncDependencies,
} from '../../src/services/cloudSyncService';
import { createSosPacket, createAckPacket } from '../../src/models/Packet';
import { PacketEngine } from '../../src/services/packetEngine';
import { SosRepository } from '../../src/repositories/sosRepository';
import { StorageEngine } from '../../src/storage/storageEngine';
import { DeduplicationService } from '../../src/services/deduplicationService';
import { MockMeshTransport } from '../../src/transport/mockMeshTransport';
import type { SosPacket, AckPacket } from '../../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ PASS: ${message}`);
}

function makeSos(id: string, route?: string[]): SosPacket {
  const packet = createSosPacket({
    id,
    senderId: 'PERSON-A',
    deviceId: 'DEV-A1B2C3',
    latitude: 22.9785,
    longitude: 88.4395,
    priority: 'CRITICAL',
    message: 'cloud sync test',
  });
  if (route) packet.route = [...route];
  return packet;
}

class FakeDb implements CloudDb {
  tables: Record<string, Record<string, unknown>[]> = {
    devices: [],
    incidents: [],
    packet_hops: [],
    acknowledgements: [],
  };
  failTables = new Set<string>();

  from(table: string) {
    return {
      upsert: async (rows: Record<string, unknown>[], options?: { onConflict?: string }) => {
        if (this.failTables.has(table)) {
          return { error: { message: `RLS denied on ${table}` } };
        }
        const keys = (options?.onConflict ?? '').split(',').map(k => k.trim()).filter(Boolean);
        for (const row of rows) {
          const existing = keys.length > 0
            ? this.tables[table].findIndex(r => keys.every(k => r[k] === row[k]))
            : -1;
          if (existing >= 0) {
            this.tables[table][existing] = row; // idempotent upsert
          } else {
            this.tables[table].push(row);
          }
        }
        return { error: null };
      },
    };
  }
}

interface FakeDeps extends SyncDependencies {
  queue: string[];
  packets: Map<string, SosPacket>;
  acks: Map<string, AckPacket[]>;
}

function makeDeps(packetList: SosPacket[] = [], ackList: AckPacket[] = []): FakeDeps {
  const packets = new Map(packetList.map(p => [p.id, p]));
  const acks = new Map<string, AckPacket[]>();
  for (const ack of ackList) {
    const list = acks.get(ack.sosId) ?? [];
    list.push(ack);
    acks.set(ack.sosId, list);
  }
  return {
    queue: packetList.map(p => p.id),
    packets,
    acks,
    getQueuedIds() {
      return [...this.queue];
    },
    removeFromSyncQueue(ids: string[]) {
      this.queue = this.queue.filter(id => !ids.includes(id));
    },
    getPacket(id: string) {
      return this.packets.get(id) ?? null;
    },
    getAcksForSos(sosId: string) {
      return this.acks.get(sosId) ?? [];
    },
    async getDeviceId() {
      return 'DEV-A1B2C3';
    },
    async getDevicePublicKey() {
      return 'abcd1234';
    },
  };
}

async function runTestSuite() {
  console.log('\n==================================================');
  console.log('STARTING LIFELINE CLOUD SYNC TESTS');
  console.log('==================================================\n');
  resetSyncRetryForTests();

  // Test 1: null client (offline/unconfigured)
  console.log('[Cloud 1] Supabase unavailable/null client');
  {
    const deps = makeDeps([makeSos('SOS-C1')]);
    const stats = await syncPendingQueue(null, deps);
    assert(stats.attempted === 0 && stats.succeeded === 0, 'Nothing attempted without a client');
    assert(deps.queue.length === 1, 'Queue remains intact');
  }

  // Test 2: successful incident sync
  console.log('\n[Cloud 2] Successful incident sync');
  {
    const db = new FakeDb();
    const deps = makeDeps([makeSos('SOS-C2')]);
    const stats = await syncPendingQueue(db, deps);
    assert(stats.succeeded === 1 && stats.failed === 0, 'One success recorded');
    assert(db.tables.incidents.length === 1 && db.tables.incidents[0]['sos_id'] === 'SOS-C2', 'Incident row uploaded');
    assert(deps.queue.length === 0, 'Confirmed ID removed from queue');
  }

  // Test 3: failed upload keeps queue
  console.log('\n[Cloud 3] Failed upload keeps ID queued');
  {
    const db = new FakeDb();
    db.failTables.add('incidents');
    const deps = makeDeps([makeSos('SOS-C3')]);
    const stats = await syncPendingQueue(db, deps);
    assert(stats.failed === 1 && stats.succeeded === 0, 'Failure recorded');
    assert(deps.queue.length === 1, 'Failed ID remains queued');
  }

  // Test 4: partial success A ok / B fail / C ok
  console.log('\n[Cloud 4] Partial success removes only confirmed IDs');
  {
    const db = new FakeDb();
    const failBridge: CloudDb = {
      from: table => ({
        upsert: async (rows, options) => {
          if (rows.some(r => r['sos_id'] === 'SOS-CB')) {
            return { error: { message: 'boom' } };
          }
          return db.from(table).upsert(rows, options);
        },
      }),
    };
    const deps = makeDeps([makeSos('SOS-CA'), makeSos('SOS-CB'), makeSos('SOS-CC')]);
    const stats = await syncPendingQueue(failBridge, deps);
    assert(stats.succeeded === 2 && stats.failed === 1, 'Two succeeded, one failed');
    assert(deps.queue.length === 1 && deps.queue[0] === 'SOS-CB', 'Only failed ID remains');
  }

  // Test 5: idempotent repeat
  console.log('\n[Cloud 5] Repeated SOS ID upserts idempotently');
  {
    const db = new FakeDb();
    const packet = makeSos('SOS-C5');
    const deps = makeDeps([packet]);
    await syncPendingQueue(db, deps);
    deps.queue.push('SOS-C5'); // same SOS queued again later
    await syncPendingQueue(db, deps);
    assert(
      db.tables.incidents.filter(r => r['sos_id'] === 'SOS-C5').length === 1,
      'Exactly one incident row after repeat sync'
    );
  }

  // Test 6: demo seed skip
  console.log('\n[Cloud 6] Demo seed IDs skipped');
  {
    const seedId = [...DEMO_SEED_SOS_IDS][0];
    const db = new FakeDb();
    const deps = makeDeps([makeSos(seedId)]);
    const stats = await syncPendingQueue(db, deps);
    assert(stats.skipped === 1, 'Seed counted as skipped');
    assert(db.tables.incidents.length === 0, 'Seed never uploaded');
    assert(deps.queue.length === 0, 'Seed ID drained from queue without upload');
  }

  // Test 7: persistence after failed sync
  console.log('\n[Cloud 7] Queue persistence after failed sync');
  {
    const db = new FakeDb();
    db.failTables.add('incidents');
    const deps = makeDeps([makeSos('SOS-C7A'), makeSos('SOS-C7B')]);
    await syncPendingQueue(db, deps);
    assert(deps.getQueuedIds().length === 2, 'Both IDs persist for retry');
  }

  // Test 8: ACK sync mapping
  console.log('\n[Cloud 8] ACK synchronization');
  {
    const db = new FakeDb();
    const packet = makeSos('SOS-C8');
    const ack = createAckPacket(packet, 'TACTICAL-HQ', 'ACKNOWLEDGED', 'noted');
    const deps = makeDeps([packet], [ack]);
    await syncPendingQueue(db, deps);
    assert(db.tables.acknowledgements.length === 1, 'One ACK row uploaded');
    const row = db.tables.acknowledgements[0];
    assert(row['ack_id'] === ack.ackId && row['sos_id'] === 'SOS-C8', 'ACK identity mapped');
    assert(row['hq_device_id'] === 'TACTICAL-HQ' && row['status'] === 'ACKNOWLEDGED', 'ACK fields mapped');
  }

  // Test 9: hops derived from route[]
  console.log('\n[Cloud 9] packet_hops derivation from route[]');
  {
    const packet = makeSos('SOS-C9', ['PERSON-A', 'PHONE-B', 'NODE-RESCUE-CMD']);
    const hops = buildHopRows(packet);
    assert(hops.length === 3, 'One hop row per route entry');
    assert(hops[0]['hop_number'] === 0 && hops[0]['node_id'] === 'PERSON-A', 'Hop 0 mapped');
    assert(hops[2]['hop_number'] === 2 && hops[2]['node_id'] === 'NODE-RESCUE-CMD', 'Hop 2 mapped');
    assert(hops.every(h => h['sos_id'] === 'SOS-C9'), 'All hops scoped to SOS');
  }

  // Test 10: device sync
  console.log('\n[Cloud 10] Device synchronization');
  {
    const db = new FakeDb();
    const deps = makeDeps([makeSos('SOS-C10')]);
    await syncPendingQueue(db, deps);
    assert(db.tables.devices.length === 1, 'Device row uploaded');
    assert(db.tables.devices[0]['device_id'] === 'DEV-A1B2C3', 'Device identity mapped');
  }

  // Test 11: RLS-style failure preserves everything
  console.log('\n[Cloud 11] RLS-style failure preserves local data');
  {
    const db = new FakeDb();
    db.failTables.add('devices');
    db.failTables.add('incidents');
    db.failTables.add('packet_hops');
    db.failTables.add('acknowledgements');
    const packet = makeSos('SOS-C11');
    const deps = makeDeps([packet]);
    const stats = await syncPendingQueue(db, deps);
    assert(stats.failed === 1, 'Failure recorded under blanket denial');
    assert(deps.queue.length === 1, 'Queue intact');
    assert(deps.packets.get('SOS-C11') === packet, 'Local SOS data untouched');
  }

  // Test 12: cloud failure never affects PacketEngine
  console.log('\n[Cloud 12] Cloud failure does not affect PacketEngine');
  {
    const db = new FakeDb();
    db.failTables.add('incidents');
    const deps = makeDeps([makeSos('SOS-C12')]);
    await syncPendingQueue(db, deps); // cloud fails; engine must not care
    const storage = new StorageEngine('cloud_iso');
    storage.clearAll();
    const engine = new PacketEngine({
      localNodeId: 'NODE-RESCUE-CMD',
      sosRepo: new SosRepository(storage),
      dedup: new DeduplicationService(100, storage),
      transport: new MockMeshTransport('NODE-RESCUE-CMD', []),
    });
    const arrived = createSosPacket({
      senderId: 'PERSON-A',
      deviceId: 'DEV-A',
      latitude: 22.9785,
      longitude: 88.4395,
    });
    assert((await engine.processPacket(arrived)) === true, 'Engine processes SOS despite cloud outage');
  }

  console.log('\n==================================================');
  console.log('ALL CLOUD SYNC TESTS PASSED!');
  console.log('==================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ Cloud Test Suite Failed:', err);
  process.exit(1);
});
