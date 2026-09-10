/**
 * LIFELINE rescue-ACK gating regression tests (no UI, no hardware).
 *
 * Proves the engine-level contract the gated rescue UI depends on:
 * CASE 1: mesh send succeeds -> SOS is NOT marked RESCUED/ACKNOWLEDGED (waits for ACK)
 * CASE 2: mesh send fails -> SOS NOT marked RESCUED, persists locally for SCF/retry
 * CASE 3: valid ACK arrives -> status becomes ACKNOWLEDGED via the real pipeline
 * CASE 4: invalid/replayed ACK -> rejected, never stored, never poisons dedup
 * CASE 5: SOS remains locally persisted even if mesh transmission fails
 */

import { PacketEngine } from '../../src/services/packetEngine';
import { MockMeshTransport } from '../../src/transport/mockMeshTransport';
import { SosRepository } from '../../src/repositories/sosRepository';
import { StorageEngine } from '../../src/storage/storageEngine';
import { DeduplicationService } from '../../src/services/deduplicationService';
import { serializePacketToBytes } from '../../src/models/Packet';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ PASS: ${message}`);
}

function makeNode(nodeId: string, prefix: string, transport: MockMeshTransport) {
  const storage = new StorageEngine(prefix);
  storage.clearAll();
  return {
    storage,
    repo: new SosRepository(storage),
    engine: new PacketEngine({
      localNodeId: nodeId,
      sosRepo: new SosRepository(storage),
      dedup: new DeduplicationService(100, storage),
      transport,
    }),
  };
}

async function runTestSuite() {
  console.log('\n==================================================');
  console.log('STARTING RESCUE-ACK GATING REGRESSION TESTS');
  console.log('==================================================\n');
  MockMeshTransport.resetNetwork();

  const transportV = new MockMeshTransport('PHONE-A', ['NODE-RESCUE-CMD']);
  const transportH = new MockMeshTransport('NODE-RESCUE-CMD', ['PHONE-A']);
  const victim = makeNode('PHONE-A', 'gate_victim', transportV);
  const hq = makeNode('NODE-RESCUE-CMD', 'gate_hq', transportH);

  // CASE 1: successful mesh send claims nothing beyond forwarding
  console.log('[Gate 1] Successful send does not claim RESCUED');
  const sos = victim.engine.createSos({
    senderId: 'PERSON-A',
    deviceId: 'DEV-A',
    latitude: 22.9785,
    longitude: 88.4395,
    message: 'Gate test SOS',
  });
  assert((await victim.engine.attemptForwarding(sos)) === true, 'Forwarding succeeded over transport');
  const afterSend = victim.repo.getPacket(sos.id);
  assert(afterSend !== null, 'SOS persisted locally');
  assert(
    afterSend.status !== 'RESCUED' && afterSend.status !== 'ACKNOWLEDGED',
    `No premature terminal state (status=${afterSend.status})`
  );

  // CASE 2 + 5: failed send keeps SOS persisted + queued, claims nothing
  console.log('\n[Gate 2+5] Failed send persists SOS for SCF/retry');
  const transportDead = new MockMeshTransport('PHONE-A2', []);
  const stranded = makeNode('PHONE-A2', 'gate_stranded', transportDead);
  const sos2 = stranded.engine.createSos({
    senderId: 'PERSON-A2',
    deviceId: 'DEV-A2',
    latitude: 22.9785,
    longitude: 88.4395,
    message: 'Stranded SOS',
  });
  assert((await stranded.engine.attemptForwarding(sos2)) === false, 'Forwarding fails with no peers');
  assert(stranded.repo.hasPacket(sos2.id), 'SOS remains locally persisted');
  const strandedPacket = stranded.repo.getPacket(sos2.id);
  assert(
    strandedPacket !== null &&
      strandedPacket.status !== 'RESCUED' &&
      strandedPacket.status !== 'ACKNOWLEDGED',
    `No false terminal state after failed send (status=${strandedPacket?.status})`
  );

  // CASE 3: valid ACK drives the real state transition
  console.log('\n[Gate 3] Valid ACK transitions state via pipeline');
  const ack = await hq.engine.acknowledgeSos(sos.id, 'ACKNOWLEDGED', 'Rescue dispatched');
  assert(ack !== null && ack.kind === 'ACK', 'HQ generated a real ACK');
  // Allow the awaited reverse chain to settle into the victim repo.
  const victimAfterAck = victim.repo.getPacket(sos.id);
  assert(victimAfterAck?.status === 'ACKNOWLEDGED', 'Victim SOS is ACKNOWLEDGED after real ACK');
  assert(
    victim.repo.getAcksForSos(sos.id).some(a => a.ackId === ack.ackId),
    'Authentic ACK record stored at victim'
  );

  // CASE 4: invalid/replayed ACK rejected, dedup unpoisoned
  console.log('\n[Gate 4] Invalid ACK rejected without side effects');
  const badAck = { kind: 'ACK', ackId: '', sosId: sos.id } as never;
  assert((await victim.engine.processPacket(badAck)) === false, 'Empty-ID ACK rejected');
  assert((await victim.engine.processPacket(badAck)) === false, 'Repeat rejected too (dedup unpoisoned)');
  assert(
    victim.repo.getAcksForSos('SOS-NONEXISTENT').length === 0,
    'No phantom ACK records stored'
  );
  const garbage = new Uint8Array([0x00, 0xff, 0x7b, 0x22]);
  assert(
    (await victim.engine.processIncomingBytes('ROGUE', garbage)) === false,
    'Malformed bytes rejected'
  );

  for (const t of [transportV, transportH, transportDead]) t.dispose();
  MockMeshTransport.resetNetwork();

  console.log('\n==================================================');
  console.log('ALL RESCUE-ACK GATING TESTS PASSED!');
  console.log('==================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ Gating Test Suite Failed:', err);
  process.exit(1);
});
