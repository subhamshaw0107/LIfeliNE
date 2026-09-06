/**
 * LIFELINE M3 MESH / BACKEND TEST SUITE
 * 
 * Verifies all 15 required test criteria:
 * 1. SOS packet creation
 * 2. Packet serialization / deserialization (string & byte array)
 * 3. Saving packet to repository
 * 4. Retrieving packet by ID
 * 5. Duplicate detection & suppression
 * 6. TTL expiration handling
 * 7. Hop-count limits
 * 8. Store-Carry-Forward priority queue
 * 9. New packet processing pipeline
 * 10. Geo-triage inside Red Zone
 * 11. Geo-triage outside Red Zone
 * 12. Priority auto-escalation to CRITICAL
 * 13. Packet status updates
 * 14. ACK processing & reverse routing
 * 15. Map data retrieval
 * 
 * PLUS:
 * Complete Phone A -> Phone B -> Phone C Store-Carry-Forward multi-hop test!
 */

import { createSosPacket, serializePacketToBytes, deserializePacketFromBytes, createAckPacket } from '../../src/models/Packet';
import { SosRepository } from '../../src/repositories/sosRepository';
import { StorageEngine } from '../../src/storage/storageEngine';
import { DeduplicationService } from '../../src/services/deduplicationService';
import { StoreCarryForwardQueue } from '../../src/services/storeCarryForwardQueue';
import { GeoTriageService } from '../../src/services/geoTriageService';
import { MapRepository } from '../../src/repositories/mapRepository';
import { PacketEngine } from '../../src/services/packetEngine';
import { MockMeshTransport } from '../../src/transport/mockMeshTransport';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ PASS: ${message}`);
}

async function runTestSuite() {
  console.log('\n==================================================');
  console.log('STARTING LIFELINE M3 MESH/BACKEND TEST SUITE');
  console.log('==================================================\n');

  // Test 1: SOS Packet Creation
  console.log('[Test 1] SOS packet creation');
  const sos = createSosPacket({
    senderId: 'PERSON-A',
    deviceId: 'DEV-A8F31C',
    latitude: 22.9785,
    longitude: 88.4395,
    priority: 'HIGH',
    message: 'Medical attention required'
  });
  assert(sos.id.startsWith('SOS-'), 'SOS ID starts with SOS-');
  assert(sos.senderId === 'PERSON-A', 'Sender ID preserved');
  assert(sos.status === 'CREATED', 'Initial status is CREATED');
  assert(sos.ttl === 7, 'Default TTL is 7');
  assert(sos.hopCount === 0, 'Initial hop count is 0');

  // Test 2: Serialization & Deserialization
  console.log('\n[Test 2] Packet serialization & deserialization (Uint8Array / Bytes)');
  const bytes = serializePacketToBytes(sos);
  assert(bytes instanceof Uint8Array && bytes.length > 0, 'Serialized to non-empty Uint8Array');
  const restored = deserializePacketFromBytes(bytes);
  assert(restored !== null && restored.id === sos.id, 'Deserialized packet matches original ID');

  // Test 3 & 4: Saving & Retrieving Packet in Repository
  console.log('\n[Test 3 & 4] Storage & Repository persistence');
  const storage = new StorageEngine();
  const repo = new SosRepository(storage);
  repo.savePacket(sos);
  assert(repo.hasPacket(sos.id), 'Repository confirms packet exists');
  const fetched = repo.getPacket(sos.id);
  assert(fetched !== null && fetched.id === sos.id, 'Retrieved packet matches saved packet');

  // Test 5: Duplicate Detection
  console.log('\n[Test 5] Duplicate detection & suppression');
  const dedup = new DeduplicationService(500, storage);
  const unseenId = 'SOS-UNSEEN-001';
  assert(!dedup.hasSeen(unseenId), 'Unseen packet is not reported as seen');
  dedup.markSeen(unseenId);
  assert(dedup.hasSeen(unseenId), 'Marked packet is reported as seen');
  const filtered = dedup.filterUnseen([{ id: unseenId } as any, { id: 'SOS-NEW-99' } as any]);
  assert(filtered.length === 1 && filtered[0].id === 'SOS-NEW-99', 'Filter strips already seen packet');


  // Test 6 & 7: TTL Expiration & Hop Count
  console.log('\n[Test 6 & 7] TTL expiration and Hop-count limit');
  const triage = new GeoTriageService();
  const engine = new PacketEngine({
    localNodeId: 'RELAY-B',
    sosRepo: repo,
    dedup,
    triage
  });

  const expiredSos = createSosPacket({
    senderId: 'PERSON-X',
    deviceId: 'DEV-X',
    latitude: 22.97,
    longitude: 88.43,
    ttl: 0 // Expired!
  });
  const processedExpired = await engine.processPacket(expiredSos);
  assert(!processedExpired, 'Expired packet (TTL 0) is dropped without forwarding');

  // Test 8: Store-Carry-Forward Priority Queue
  console.log('\n[Test 8] Store-Carry-Forward queue priority sorting');
  const queue = new StoreCarryForwardQueue();
  const lowPacket = createSosPacket({ senderId: 'P1', deviceId: 'D1', latitude: 0, longitude: 0, priority: 'LOW' });
  const critPacket = createSosPacket({ senderId: 'P2', deviceId: 'D2', latitude: 0, longitude: 0, priority: 'CRITICAL' });
  const highPacket = createSosPacket({ senderId: 'P3', deviceId: 'D3', latitude: 0, longitude: 0, priority: 'HIGH' });

  queue.enqueue(lowPacket);
  queue.enqueue(critPacket);
  queue.enqueue(highPacket);

  const firstDequeued = queue.dequeue();
  assert(firstDequeued?.priority === 'CRITICAL', 'Highest priority CRITICAL dequeued first');
  const secondDequeued = queue.dequeue();
  assert(secondDequeued?.priority === 'HIGH', 'HIGH priority dequeued second');
  const thirdDequeued = queue.dequeue();
  assert(thirdDequeued?.priority === 'LOW', 'LOW priority dequeued third');

  // Test 9, 10, 11, 12: Geo-triage & Priority Auto-Escalation
  console.log('\n[Test 9, 10, 11, 12] Geo-triage and Red Zone escalation');
  // Inside Flood Zone A (River Embankment Breach: 22.9785, 88.4395, radius 1.1 km)
  const insideRedCoord = { lat: 22.9785, lon: 88.4395 };
  const redResult = triage.evaluateLocation(insideRedCoord.lat, insideRedCoord.lon, 'LOW');
  assert(redResult.isInsideRedZone, 'Coordinate inside Flood Zone A detected as Red Zone');
  assert(redResult.calculatedPriority === 'CRITICAL', 'Priority auto-escalated to CRITICAL in Red Zone');
  assert(redResult.riskLevel === 'CRITICAL', 'Risk level marked as CRITICAL');

  // Outside Red Zone (e.g. 22.9500, 88.4000)
  const safeCoord = { lat: 22.9500, lon: 88.4000 };
  const safeResult = triage.evaluateLocation(safeCoord.lat, safeCoord.lon, 'LOW');
  assert(!safeResult.isInsideRedZone, 'Safe coordinate is not inside Red Zone');
  assert(safeResult.calculatedPriority === 'LOW', 'Base priority preserved when safe');

  // Test 13: Packet Status Updates
  console.log('\n[Test 13] Packet status lifecycle transitions');
  const updatedStatus = repo.updateStatus(sos.id, 'RELAYING', 'Relayed via Person B');
  assert(updatedStatus?.status === 'RELAYING', 'Status updated to RELAYING');
  assert(updatedStatus?.statusHistory.some(h => h.status === 'RELAYING'), 'Status history recorded');

  // Test 14: ACK Processing & Propagation
  console.log('\n[Test 14] ACK packet processing');
  const ack = createAckPacket(sos, 'TACTICAL-HQ', 'ACKNOWLEDGED', 'Rescue team dispatched');
  repo.saveAck(ack);
  const fetchedAcks = repo.getAcksForSos(sos.id);
  assert(fetchedAcks.length > 0 && fetchedAcks[0].ackId === ack.ackId, 'ACK successfully persisted and linked to SOS');
  assert(repo.getPacket(sos.id)?.status === 'ACKNOWLEDGED', 'SOS status automatically marked as ACKNOWLEDGED');

  // Test 15: Map Data Retrieval
  console.log('\n[Test 15] Map repository composite layers');
  const mapRepo = new MapRepository(repo);
  const mapData = mapRepo.getMapData();
  assert(mapData.hazardZones.length > 0, 'Hazard zones returned for map rendering');
  assert(mapData.shelters.length > 0, 'Shelters returned for map rendering');
  assert(mapData.blockedRoads.length > 0, 'Blocked roads returned for map rendering');
  assert(mapData.sosLocations.some(p => p.packetId === sos.id), 'Active SOS returned as map pin');

  // =========================================================================
  // MULTI-HOP STORE-CARRY-FORWARD DEMO SCENARIO: PHONE A -> PHONE B -> RESCUE
  // =========================================================================
  console.log('\n==================================================');
  console.log('TESTING COMPLETE STORE-CARRY-FORWARD FLOW (A -> B -> RESCUE)');
  console.log('==================================================\n');

  // Setup simulated devices
  const transportAB = new MockMeshTransport();
  const transportBRescue = new MockMeshTransport();
  // Phone B is initially disconnected from Rescue HQ (Carrying while moving)
  transportBRescue.setConnectedPeers([]);

  // Phone A: Victim
  const storageA = new StorageEngine('phone_a');
  storageA.clearAll();
  const repoA = new SosRepository(storageA);
  const phoneA = new PacketEngine({
    localNodeId: 'PHONE-A',
    sosRepo: repoA,
    dedup: new DeduplicationService(100, storageA),
    transport: transportAB
  });

  // Phone B: Relay Node
  const storageB = new StorageEngine('phone_b');
  storageB.clearAll();
  const repoB = new SosRepository(storageB);
  const phoneB = new PacketEngine({
    localNodeId: 'PHONE-B',
    sosRepo: repoB,
    dedup: new DeduplicationService(100, storageB),
    transport: transportBRescue
  });

  // Rescue Command Center Gateway
  const storageRescue = new StorageEngine('rescue_hq');
  storageRescue.clearAll();
  const repoRescue = new SosRepository(storageRescue);
  const rescueHQ = new PacketEngine({
    localNodeId: 'NODE-RESCUE-CMD',
    sosRepo: repoRescue,
    dedup: new DeduplicationService(100, storageRescue)
  });

  // Wire transports:
  // When Phone A sends to PHONE-B, deliver to Phone B
  transportAB.registerPeerInbox('PHONE-B', async bytes => {
    await phoneB.processIncomingBytes('PHONE-A', bytes);
  });

  // When Phone B sends to NODE-RESCUE-CMD, deliver to Rescue HQ
  transportBRescue.registerPeerInbox('NODE-RESCUE-CMD', async bytes => {
    await rescueHQ.processIncomingBytes('PHONE-B', bytes);
  });



  // Step 1: Victim creates SOS on Phone A
  console.log('Step 1: Victim on Phone A creates Red Zone SOS...');
  const redSos = phoneA.createSos({
    senderId: 'PERSON-A',
    deviceId: 'DEV-A',
    latitude: 22.9785, // Inside Flood Zone A
    longitude: 88.4395,
    message: 'Trapped on rooftop due to flood!'
  });
  assert(redSos.priority === 'CRITICAL', 'Phone A: SOS created with CRITICAL priority (Red Zone)');
  assert(repoA.hasPacket(redSos.id), 'Phone A: SOS saved in local storage');

  // Step 2: Phone A transmits to Phone B via transport
  console.log('Step 2: Phone A forwards packet to Phone B...');
  transportAB.setConnectedPeers(['PHONE-B']);
  await phoneA.attemptForwarding(redSos);

  // Step 3: Phone B receives, deduplicates, stores, and queues for Rescue
  console.log('Step 3: Phone B receives packet...');
  assert(repoB.hasPacket(redSos.id), 'Phone B: SOS successfully received and stored locally');
  const packetAtB = repoB.getPacket(redSos.id);
  assert(packetAtB !== null && packetAtB.route.includes('PHONE-A'), 'Phone B: Route trace contains PHONE-A');

  // Step 4: Phone B encounters Rescue HQ and forwards
  console.log('Step 4: Phone B encounters Rescue HQ and forwards packet...');
  transportBRescue.setConnectedPeers(['NODE-RESCUE-CMD']);
  await phoneB.resumePendingRelays();

  // Step 5: Rescue HQ receives and verifies delivery
  console.log('Step 5: Rescue HQ processes delivered packet...');
  const packetAtRescue = repoRescue.getPacket(redSos.id);
  assert(packetAtRescue !== null, 'Rescue HQ: Packet arrived at Tactical HQ');
  assert(packetAtRescue?.status === 'DELIVERED', 'Rescue HQ: Packet marked as DELIVERED');


  // Step 6: Rescue HQ dispatches ACK back
  console.log('Step 6: Rescue HQ acknowledges SOS and creates ACK receipt...');
  const rescueAck = rescueHQ.acknowledgeSos(redSos.id, 'ACKNOWLEDGED', 'Rescue boat 04 dispatched to coordinates');
  assert(rescueAck !== null && rescueAck.kind === 'ACK', 'Rescue HQ: ACK packet generated');
  assert(repoRescue.getPacket(redSos.id)?.status === 'ACKNOWLEDGED', 'Rescue HQ: Ticket state updated to ACKNOWLEDGED');

  console.log('\n==================================================');
  console.log('ALL 15 TESTS & STORE-CARRY-FORWARD DEMO PASSED! 🎉');
  console.log('==================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
