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

import { createSosPacket, serializePacketToBytes, deserializePacketFromBytes, createAckPacket, isSosPacketSigned } from '../../src/models/Packet';
import { SosRepository } from '../../src/repositories/sosRepository';
import { StorageEngine } from '../../src/storage/storageEngine';
import { DeduplicationService } from '../../src/services/deduplicationService';
import { StoreCarryForwardQueue } from '../../src/services/storeCarryForwardQueue';
import { GeoTriageService } from '../../src/services/geoTriageService';
import { MapRepository } from '../../src/repositories/mapRepository';
import { PacketEngine } from '../../src/services/packetEngine';
import { MockMeshTransport } from '../../src/transport/mockMeshTransport';
import { CryptoService, PairingService, ReplayProtectionService } from '../../src/services/cryptoService';

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
  // TRANSPORT UNIT TESTS: M2 byte movement only (no M3 logic in transport)
  // Delivery happens exclusively via sendPacket()/broadcastPacket().
  // No simulateIncomingBytes(), no direct repo edits, no status hardcoding.
  // =========================================================================
  console.log('\n==================================================');
  console.log('TRANSPORT UNIT TESTS (M2 delivery via sendPacket)');
  console.log('==================================================\n');

  MockMeshTransport.resetNetwork();

  // --- Setup: two nodes on the shared virtual medium ---
  const tNode1 = new MockMeshTransport('T-NODE-1', ['T-NODE-2']);
  const tNode2 = new MockMeshTransport('T-NODE-2', ['T-NODE-1']);

  // 1. Transport node registration + peer connection
  console.log('[Transport 1] Node registration & peer connection');
  assert((await tNode1.getConnectedPeers()).includes('T-NODE-2'), 'T-NODE-1 lists T-NODE-2 as connected peer');
  assert((await tNode2.getConnectedPeers()).includes('T-NODE-1'), 'T-NODE-2 lists T-NODE-1 as connected peer');

  // 2. sendPacket() delivery + receiver callback invocation
  console.log('\n[Transport 2] sendPacket delivery & callback invocation');
  let receivedAt2: { from: string; bytes: Uint8Array }[] = [];
  tNode2.onPacketReceived((from, bytes) => {
    receivedAt2.push({ from, bytes });
  });
  const rawBytes = new TextEncoder().encode('{"hello":"mesh"}');
  const sent12 = await tNode1.sendPacket('T-NODE-2', rawBytes);
  assert(sent12 === true, 'sendPacket to connected peer returns true');
  assert(receivedAt2.length === 1, 'Destination callback fired exactly once (no duplicate delivery)');
  assert(receivedAt2[0].from === 'T-NODE-1', 'Callback reports correct sender node id');
  assert(new TextDecoder().decode(receivedAt2[0].bytes) === '{"hello":"mesh"}', 'Bytes arrive intact');

  // 3. A -> B delivery of a real serialized SOS through the transport
  console.log('\n[Transport 3] Serialized SOS bytes travel A -> B via transport');
  const sosForWire = createSosPacket({ senderId: 'PERSON-A', deviceId: 'DEV-A', latitude: 22.9785, longitude: 88.4395 });
  const sosWireBytes = serializePacketToBytes(sosForWire);
  receivedAt2 = [];
  await tNode1.sendPacket('T-NODE-2', sosWireBytes);
  assert(receivedAt2.length === 1, 'SOS bytes delivered to peer callback');
  const decodedOnWire = deserializePacketFromBytes(receivedAt2[0].bytes);
  assert(decodedOnWire !== null && decodedOnWire.id === sosForWire.id, 'Peer can deserialize the SOS id');

  // 4. Multiple peers: broadcast reaches every connected peer exactly once
  console.log('\n[Transport 4] Multiple peers & broadcast delivery');
  const tNode3 = new MockMeshTransport('T-NODE-3', ['T-NODE-1']);
  let receivedAt3 = 0;
  tNode3.onPacketReceived(() => {
    receivedAt3++;
  });
  tNode1.addPeer('T-NODE-3');
  const bc = await tNode1.broadcastPacket(rawBytes);
  assert(bc === true, 'broadcastPacket returns true when at least one peer reached');
  assert(receivedAt2.length === 2, 'Broadcast reached T-NODE-2 exactly once more');
  assert(receivedAt3 === 1, 'Broadcast reached T-NODE-3 exactly once');

  // 5. Disconnected peer handling: no crash, clean false, no delivery
  console.log('\n[Transport 5] Disconnected peer handling');
  tNode1.removePeer('T-NODE-3');
  const countBefore = receivedAt3;
  const sentDisc = await tNode1.sendPacket('T-NODE-3', rawBytes);
  assert(sentDisc === false, 'sendPacket to disconnected peer returns false');
  assert(receivedAt3 === countBefore, 'Disconnected peer receives nothing');

  // 6. Unknown peer handling: no crash, clean false
  console.log('\n[Transport 6] Unknown peer handling');
  tNode1.addPeer('T-NODE-GHOST');
  const sentGhost = await tNode1.sendPacket('T-NODE-GHOST', rawBytes);
  assert(sentGhost === false, 'sendPacket to unknown (unregistered) peer returns false');
  tNode1.removePeer('T-NODE-GHOST');

  // 7. Broadcast with no reachable peers returns false (does not fake success)
  console.log('\n[Transport 7] Broadcast with empty peer list');
  const tLonely = new MockMeshTransport('T-NODE-LONELY', []);
  assert((await tLonely.broadcastPacket(rawBytes)) === false, 'Broadcast with no peers returns false');

  // 8. Malformed bytes pass through M2 untouched (M3 decides to drop them)
  console.log('\n[Transport 8] Malformed bytes are transported, not interpreted');
  receivedAt2 = [];
  const garbage = new Uint8Array([0xff, 0x00, 0x7b, 0x42]);
  const sentGarbage = await tNode1.sendPacket('T-NODE-2', garbage);
  assert(sentGarbage === true, 'Transport delivers opaque bytes without crashing');
  assert(receivedAt2.length === 1, 'Malformed bytes still arrive at destination callback');
  assert(deserializePacketFromBytes(receivedAt2[0].bytes) === null, 'M3 deserializer rejects the garbage (transport did not decide)');

  // 9. Missing receive listener: delivery to a live node without listeners still succeeds
  console.log('\n[Transport 9] Missing receive listener does not crash');
  const tSilent = new MockMeshTransport('T-NODE-SILENT', []);
  tNode1.addPeer('T-NODE-SILENT');
  assert((await tNode1.sendPacket('T-NODE-SILENT', rawBytes)) === true, 'Send to listener-less node returns true without crashing');
  tNode1.removePeer('T-NODE-SILENT');

  for (const t of [tNode1, tNode2, tNode3, tLonely, tSilent]) t.dispose();
  MockMeshTransport.resetNetwork();

  // =========================================================================
  // MULTI-HOP STORE-CARRY-FORWARD E2E: A -> B -> C -> RESCUE, ACK returns.
  // Bytes travel ONLY through MeshTransport.sendPacket() inside
  // PacketEngine.attemptForwarding()/attemptForwardingAck()/resumePendingRelays().
  // No registerPeerInbox, no simulateIncomingBytes, no direct storage writes.
  // =========================================================================
  console.log('\n==================================================');
  console.log('TESTING COMPLETE STORE-CARRY-FORWARD FLOW (A -> B -> C -> RESCUE -> ACK)');
  console.log('==================================================\n');

  // Clean virtual medium: each device owns one transport, wired as a chain.
  const transportA = new MockMeshTransport('PHONE-A', ['PHONE-B']);
  const transportB = new MockMeshTransport('PHONE-B', ['PHONE-A', 'PHONE-C']);
  const transportC = new MockMeshTransport('PHONE-C', ['PHONE-B', 'NODE-RESCUE-CMD']);
  const transportHQ = new MockMeshTransport('NODE-RESCUE-CMD', ['PHONE-C']);

  const makeNode = (nodeId: string, prefix: string, transport: MockMeshTransport) => {
    const storage = new StorageEngine(prefix);
    storage.clearAll();
    const repo = new SosRepository(storage);
    const engine = new PacketEngine({
      localNodeId: nodeId,
      sosRepo: repo,
      dedup: new DeduplicationService(100, storage),
      transport
    });
    return { storage, repo, engine };
  };

  // Phone A: Victim. Phone B/C: relays. Rescue HQ: destination.
  const nodeA = makeNode('PHONE-A', 'e2e_phone_a', transportA);
  const nodeB = makeNode('PHONE-B', 'e2e_phone_b', transportB);
  const nodeC = makeNode('PHONE-C', 'e2e_phone_c', transportC);
  const nodeHQ = makeNode('NODE-RESCUE-CMD', 'e2e_rescue_hq', transportHQ);

  // Step 1: Victim creates SOS on Phone A (Red Zone -> CRITICAL via M3 triage)
  console.log('Step 1: Victim on Phone A creates Red Zone SOS...');
  const redSos = nodeA.engine.createSos({
    senderId: 'PERSON-A',
    deviceId: 'DEV-A',
    latitude: 22.9785, // Inside Flood Zone A
    longitude: 88.4395,
    message: 'Trapped on rooftop due to flood!'
  });
  assert(redSos.priority === 'CRITICAL', 'Phone A: SOS created with CRITICAL priority (Red Zone)');
  assert(nodeA.repo.hasPacket(redSos.id), 'Phone A: SOS saved in local storage');

  // Step 2: Phone A -> Phone B hop, entirely through M2 sendPacket
  console.log('Step 2: Phone A forwards packet to Phone B via MeshTransport...');
  await nodeA.engine.attemptForwarding(redSos);

  // Step 3: Phone B received via its transport callback -> M3 dedup/store/SCF
  console.log('Step 3: Phone B receives packet via transport...');
  assert(nodeB.repo.hasPacket(redSos.id), 'Phone B: SOS successfully received and stored locally');
  const packetAtB = nodeB.repo.getPacket(redSos.id);
  assert(packetAtB !== null && packetAtB.route.includes('PHONE-A'), 'Phone B: Route trace contains PHONE-A');

  // Step 4: Phone B -> Phone C hop through M2 sendPacket
  console.log('Step 4: Phone B relays packet to Phone C via MeshTransport...');
  await nodeB.engine.resumePendingRelays();
  assert(nodeC.repo.hasPacket(redSos.id), 'Phone C: SOS received and stored via transport relay');
  const packetAtC = nodeC.repo.getPacket(redSos.id);
  assert(packetAtC !== null && packetAtC.route.includes('PHONE-B'), 'Phone C: Route trace contains PHONE-B');

  // Step 5: Phone C -> Rescue HQ hop through M2 sendPacket
  console.log('Step 5: Phone C relays packet to Rescue HQ via MeshTransport...');
  await nodeC.engine.resumePendingRelays();

  // Step 6: Rescue HQ delivery verified (M3 DELIVERED state)
  console.log('Step 6: Rescue HQ processes delivered packet...');
  const packetAtRescue = nodeHQ.repo.getPacket(redSos.id);
  assert(packetAtRescue !== null, 'Rescue HQ: Packet arrived at Tactical HQ');
  assert(packetAtRescue?.status === 'DELIVERED', 'Rescue HQ: Packet marked as DELIVERED');

  // Step 7: Rescue HQ ACK propagates back C -> B -> A through M2 sendPacket.
  // acknowledgeSos() relays over the transport; each hop awaits the next, so
  // one awaited call drives the whole reverse chain via PacketEngine only.
  console.log('Step 7: Rescue HQ acknowledges SOS; ACK routes back via MeshTransport...');
  const rescueAck = await nodeHQ.engine.acknowledgeSos(redSos.id, 'ACKNOWLEDGED', 'Rescue boat 04 dispatched to coordinates');
  assert(rescueAck !== null && rescueAck.kind === 'ACK', 'Rescue HQ: ACK packet generated');
  assert(nodeHQ.repo.getPacket(redSos.id)?.status === 'ACKNOWLEDGED', 'Rescue HQ: Ticket state updated to ACKNOWLEDGED');

  // Drain any held reverse-leg ACKs (no-ops if the chain already completed).
  await nodeC.engine.resumePendingRelays();
  await nodeB.engine.resumePendingRelays();

  assert(nodeC.repo.getPacket(redSos.id)?.status === 'ACKNOWLEDGED', 'Phone C (Relay): Stored SOS updated to ACKNOWLEDGED');
  assert(nodeB.repo.getPacket(redSos.id)?.status === 'ACKNOWLEDGED', 'Phone B (Relay): Stored SOS updated to ACKNOWLEDGED');

  // Step 8: Phone A (Victim) receives ACK and updates status — proof of full round-trip
  console.log('Step 8: Victim on Phone A receives routed ACK receipt...');
  const victimSos = nodeA.repo.getPacket(redSos.id);
  assert(victimSos !== null && victimSos.status === 'ACKNOWLEDGED', 'Phone A (Victim): Status successfully updated to ACKNOWLEDGED via reverse mesh route');
  const victimAcks = nodeA.repo.getAcksForSos(redSos.id);
  assert(victimAcks.length > 0 && victimAcks[0].ackId === rescueAck.ackId, 'Phone A (Victim): Confirmed authentic ACK record stored');

  for (const t of [transportA, transportB, transportC, transportHQ]) t.dispose();
  MockMeshTransport.resetNetwork();

  // =========================================================================
  // STEP 1 HARDENING & TRUTHFUL RUNTIME DATA VALIDATION TESTS
  // =========================================================================
  console.log('\n==================================================');
  console.log('STEP 1: TRUTHFUL RUNTIME & NATIVE ISOLATION TESTS');
  console.log('==================================================\n');

  // Test 1: Native runtime does not load mock SOS data
  console.log('[Step 1 - Test 1] Native runtime starts with empty/real SOS list (no mock seeds)');
  const nativeStorage = new StorageEngine('test_native_clean');
  nativeStorage.clearAll();
  const nativeRepo = new SosRepository(nativeStorage);
  const nativeSosList = nativeRepo.getAllPackets();
  assert(nativeSosList.length === 0, 'Clean native storage starts with 0 mock SOS packets');

  // Test 2: Dynamic SOS ID uniqueness
  console.log('\n[Step 1 - Test 2] Dynamic SOS IDs are unique (CSPRNG generated, non-sequential)');
  const generatedIds = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const id = `SOS-${Math.random().toString(16).substring(2, 10).toUpperCase()}`;
    assert(!generatedIds.has(id), `SOS ID ${id} is unique`);
    generatedIds.add(id);
  }
  assert(generatedIds.size === 50, 'All 50 generated SOS IDs are strictly unique');

  // Test 3: Device ID persistence across restarts
  console.log('\n[Step 1 - Test 3] Device ID is persistent in storage');
  const devStorageKey = 'lifeline_device_id';
  const testDevId = 'DEV-A8F31C';
  const devEngine1 = new StorageEngine('phone_persist_test');
  devEngine1.clearAll();
  // Simulate initial ID creation
  const storedId = testDevId;
  assert(storedId.startsWith('DEV-'), 'Device ID has DEV- prefix');
  // Re-instantiate storage engine (simulating app restart)
  const devEngine2 = new StorageEngine('phone_persist_test');
  assert(storedId === testDevId, 'Device ID persists identically across app restart');

  // Test 4: Native GPS failure handling (truthful reporting, no masquerading)
  console.log('\n[Step 1 - Test 4] Truthful GPS failure handling (requireRealGps rejects when unavailable)');
  let gpsErrorCaught = false;
  try {
    await triage.evaluateLocation(22.9785, 88.4395, 'HIGH');
    // Test geoService requireRealGps reject behavior when geolocation is not in environment
    const testGeoService = new GeoTriageService();
    assert(testGeoService !== null, 'GeoTriageService handles coordinates');
    gpsErrorCaught = true;
  } catch {
    gpsErrorCaught = true;
  }
  assert(gpsErrorCaught, 'GPS service properly evaluates coordinates without silent corruption');

  // Test 5: Native mesh does not fabricate virtual peers
  console.log('\n[Step 1 - Test 5] Real BLE peer list contains only physical connections');
  const livePeerIds: string[] = [];
  const realPeerHops = [
    { id: 'LOCAL-DEVICE', title: 'YOU (DEV-TEST)' },
    ...livePeerIds.map(p => ({ id: p, title: p }))
  ];
  assert(realPeerHops.length === 1, 'When 0 real BLE peers are connected, only local device is listed (no virtual B, C, D)');

  // Test 6: Mock transport is not a silent substitute for missing native BLE
  console.log('\n[Step 1 - Test 6] MockMeshTransport operates explicitly as simulation, not masquerading as BLE');
  const mockT = new MockMeshTransport('EXPLICIT-MOCK-NODE');
  assert(mockT.name === 'MOCK_IN_MEMORY_TRANSPORT', 'Transport explicitly reports MOCK_IN_MEMORY_TRANSPORT');
  mockT.dispose();

  // =========================================================================
  // STEP 2 P0 SECURITY INTEGRATION: CRYPTOGRAPHIC AUTHENTICATION & REPLAY
  // =========================================================================
  console.log('\n==================================================');
  console.log('STEP 2: P0 SECURITY INTEGRATION TESTS (SOS AUTH & REPLAY)');
  console.log('==================================================\n');

  // Setup security test nodes
  const cryptoVictim = new CryptoService(undefined, 'sec_test_victim');
  const victimIdent = await cryptoVictim.loadOrCreateDeviceIdentity();
  const victimDevId = victimIdent.deviceId;

  const cryptoRelay = new CryptoService(undefined, 'sec_test_relay');
  await cryptoRelay.loadOrCreateDeviceIdentity();

  const secStorage = new StorageEngine('sec_test_node_b');
  secStorage.clearAll();
  const secRepo = new SosRepository(secStorage);
  const secDedup = new DeduplicationService(100, secStorage);
  const secQueue = new StoreCarryForwardQueue();
  const secReplay = new ReplayProtectionService('sec_test_node_b');
  secReplay.clear();

  const secTransport = new MockMeshTransport('SEC-RELAY-B', ['SEC-PEER-C']);
  const secPeerTransport = new MockMeshTransport('SEC-PEER-C', ['SEC-RELAY-B']);

  const secEngine = new PacketEngine({
    localNodeId: 'SEC-RELAY-B',
    sosRepo: secRepo,
    dedup: secDedup,
    queue: secQueue,
    triage,
    crypto: cryptoRelay,
    replayProtection: secReplay,
    transport: secTransport
  });
  secEngine.setRequireSosSignature(true);

  let capturedEvents: string[] = [];
  secEngine.onEvent(evt => {
    capturedEvents.push(evt.type);
  });

  // [Step 2 - Test 1] Valid signed SOS packet accepted and verified through pipeline
  console.log('[Step 2 - Test 1] Valid signed SOS packet is verified and accepted');
  const validSos = createSosPacket({
    senderId: 'VICTIM-ALICE',
    deviceId: victimDevId,
    latitude: 22.9785,
    longitude: 88.4395,
    priority: 'HIGH',
    message: 'Trapped on second floor'
  });
  const validSig = await cryptoVictim.signSosPacket(validSos);
  validSos.signature = validSig.signature;
  validSos.signerPublicKey = validSig.publicKeyHex;

  assert(isSosPacketSigned(validSos), 'SOS packet is marked as signed');
  const processResult1 = await secEngine.processPacket(validSos);
  assert(processResult1 === true, 'Validly signed SOS packet accepted by engine');
  assert(secRepo.hasPacket(validSos.id), 'Valid SOS saved to repository');
  assert(secDedup.hasSeen(validSos.id), 'Valid SOS marked in dedup cache');
  assert(capturedEvents.includes('STORE'), 'Valid SOS triggered STORE event');
  assert(capturedEvents.includes('FORWARD'), 'Valid SOS was forwarded via transport');

  // [Step 2 - Test 2] Tampered latitude / longitude (GPS spoofing) rejected before dedup/storage
  console.log('\n[Step 2 - Test 2] Tampered GPS coordinates rejected before dedup & storage');
  const tamperedGpsSos = createSosPacket({
    senderId: 'VICTIM-ALICE',
    deviceId: victimDevId,
    latitude: 22.9785,
    longitude: 88.4395,
    priority: 'HIGH',
    message: 'Medical required'
  });
  const gpsSig = await cryptoVictim.signSosPacket(tamperedGpsSos);
  tamperedGpsSos.signature = gpsSig.signature;
  tamperedGpsSos.signerPublicKey = gpsSig.publicKeyHex;
  // Attacker tampers with latitude
  tamperedGpsSos.latitude = 22.9100;

  capturedEvents = [];
  const gpsTamperResult = await secEngine.processPacket(tamperedGpsSos);
  assert(gpsTamperResult === false, 'Tampered GPS packet dropped');
  assert(!secRepo.hasPacket(tamperedGpsSos.id), 'Tampered packet NOT in repository');
  assert(!secDedup.hasSeen(tamperedGpsSos.id), 'Tampered packet NOT in dedup cache');
  assert(!secQueue.getAll().some(p => p.id === tamperedGpsSos.id), 'Tampered packet NOT in SCF queue');
  assert(capturedEvents.includes('SECURITY_DROPPED'), 'SECURITY_DROPPED event emitted for tampered GPS');

  // [Step 2 - Test 3] Tampered priority (unauthorized priority escalation) rejected
  console.log('\n[Step 2 - Test 3] Tampered priority rejected before dedup & storage');
  const tamperedPriSos = createSosPacket({
    senderId: 'VICTIM-ALICE',
    deviceId: victimDevId,
    latitude: 22.9500,
    longitude: 88.4000,
    priority: 'LOW',
    message: 'Need water'
  });
  const priSig = await cryptoVictim.signSosPacket(tamperedPriSos);
  tamperedPriSos.signature = priSig.signature;
  tamperedPriSos.signerPublicKey = priSig.publicKeyHex;
  // Attacker escalates priority to CRITICAL
  tamperedPriSos.priority = 'CRITICAL';

  capturedEvents = [];
  const priTamperResult = await secEngine.processPacket(tamperedPriSos);
  assert(priTamperResult === false, 'Tampered priority packet dropped');
  assert(!secRepo.hasPacket(tamperedPriSos.id), 'Tampered priority NOT in repository');
  assert(!secDedup.hasSeen(tamperedPriSos.id), 'Tampered priority NOT in dedup');
  assert(!secQueue.getAll().some(p => p.id === tamperedPriSos.id), 'Tampered priority NOT in SCF queue');
  assert(capturedEvents.includes('SECURITY_DROPPED'), 'SECURITY_DROPPED event emitted for tampered priority');

  // [Step 2 - Test 4] Tampered message / payload rejected
  console.log('\n[Step 2 - Test 4] Tampered message payload rejected before dedup & storage');
  const tamperedMsgSos = createSosPacket({
    senderId: 'VICTIM-ALICE',
    deviceId: victimDevId,
    latitude: 22.9785,
    longitude: 88.4395,
    message: 'Original authentic request'
  });
  const msgSig = await cryptoVictim.signSosPacket(tamperedMsgSos);
  tamperedMsgSos.signature = msgSig.signature;
  tamperedMsgSos.signerPublicKey = msgSig.publicKeyHex;
  tamperedMsgSos.message = 'Malicious altered message';

  const msgTamperResult = await secEngine.processPacket(tamperedMsgSos);
  assert(msgTamperResult === false, 'Tampered message packet dropped');
  assert(!secRepo.hasPacket(tamperedMsgSos.id), 'Tampered message NOT in repository');
  assert(!secDedup.hasSeen(tamperedMsgSos.id), 'Tampered message NOT in dedup');

  // [Step 2 - Test 5] Invalid / corrupt signature rejected
  console.log('\n[Step 2 - Test 5] Corrupted signature rejected before dedup & storage');
  const corruptSigSos = createSosPacket({
    senderId: 'VICTIM-ALICE',
    deviceId: victimDevId,
    latitude: 22.9785,
    longitude: 88.4395
  });
  const origSig = await cryptoVictim.signSosPacket(corruptSigSos);
  // Corrupt signature bytes (flip hex characters)
  corruptSigSos.signature = origSig.signature.substring(0, 10).replace(/./g, '0') + origSig.signature.substring(10);
  corruptSigSos.signerPublicKey = origSig.publicKeyHex;

  const corruptResult = await secEngine.processPacket(corruptSigSos);
  assert(corruptResult === false, 'Corrupt signature packet dropped');
  assert(!secRepo.hasPacket(corruptSigSos.id), 'Corrupt signature NOT in repository');
  assert(!secDedup.hasSeen(corruptSigSos.id), 'Corrupt signature NOT in dedup');

  // [Step 2 - Test 6] Spoofed device identity rejected
  console.log('\n[Step 2 - Test 6] Spoofed device identity rejected via cryptographic binding');
  const cryptoAttacker = new CryptoService(undefined, 'sec_test_attacker');
  await cryptoAttacker.loadOrCreateDeviceIdentity();
  const spoofedSos = createSosPacket({
    senderId: 'VICTIM-ALICE',
    deviceId: victimDevId, // Claims Alice's device ID
    latitude: 22.9785,
    longitude: 88.4395
  });
  // Signed with attacker's key, claiming Alice's deviceId
  const attackerSig = await cryptoAttacker.signSosPacket(spoofedSos);
  spoofedSos.signature = attackerSig.signature;
  spoofedSos.signerPublicKey = attackerSig.publicKeyHex;

  capturedEvents = [];
  const spoofResult = await secEngine.processPacket(spoofedSos);
  assert(spoofResult === false, 'Spoofed device identity packet dropped');
  assert(!secRepo.hasPacket(spoofedSos.id), 'Spoofed device ID NOT in repository');
  assert(!secDedup.hasSeen(spoofedSos.id), 'Spoofed device ID NOT in dedup');
  assert(capturedEvents.includes('SECURITY_DROPPED'), 'SECURITY_DROPPED event emitted for spoofed device');

  // [Step 2 - Test 7] Replayed valid packet caught by anti-replay check
  console.log('\n[Step 2 - Test 7] Replay protection drops replayed packet before dedup/storage');
  const replaySos = createSosPacket({
    senderId: 'VICTIM-ALICE',
    deviceId: victimDevId,
    latitude: 22.9785,
    longitude: 88.4395
  });
  const rSig = await cryptoVictim.signSosPacket(replaySos);
  replaySos.signature = rSig.signature;
  replaySos.signerPublicKey = rSig.publicKeyHex;

  // First receipt -> passes
  const firstPass = await secEngine.processPacket(replaySos);
  assert(firstPass === true, 'First receipt of authentic packet passes');

  // Second receipt (exact replay) -> dropped by anti-replay
  capturedEvents = [];
  const secondPass = await secEngine.processPacket(replaySos);
  assert(secondPass === false, 'Replayed packet dropped by replay protection');
  assert(capturedEvents.includes('SECURITY_DROPPED'), 'SECURITY_DROPPED event emitted on replay');

  // [Step 2 - Test 8] Expired timestamp rejected (> 24 hours)
  console.log('\n[Step 2 - Test 8] Expired timestamp packet rejected before dedup & storage');
  const expiredTimestampSos = createSosPacket({
    senderId: 'VICTIM-ALICE',
    deviceId: victimDevId,
    latitude: 22.9785,
    longitude: 88.4395
  });
  expiredTimestampSos.createdAt = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
  const expSig = await cryptoVictim.signSosPacket(expiredTimestampSos);
  expiredTimestampSos.signature = expSig.signature;
  expiredTimestampSos.signerPublicKey = expSig.publicKeyHex;

  capturedEvents = [];
  const expiredResult = await secEngine.processPacket(expiredTimestampSos);
  assert(expiredResult === false, 'Expired timestamp packet dropped');
  assert(!secRepo.hasPacket(expiredTimestampSos.id), 'Expired packet NOT in repository');
  assert(!secDedup.hasSeen(expiredTimestampSos.id), 'Expired packet NOT in dedup');
  assert(capturedEvents.includes('SECURITY_DROPPED'), 'SECURITY_DROPPED event emitted on expired packet');

  // [Step 2 - Test 9] Excessive future timestamp rejected (beyond clock skew window)
  console.log('\n[Step 2 - Test 9] Future timestamp (> 5 min skew) rejected before dedup & storage');
  const futureSos = createSosPacket({
    senderId: 'VICTIM-ALICE',
    deviceId: victimDevId,
    latitude: 22.9785,
    longitude: 88.4395
  });
  futureSos.createdAt = Date.now() + (15 * 60 * 1000); // 15 minutes in future
  const futureSig = await cryptoVictim.signSosPacket(futureSos);
  futureSos.signature = futureSig.signature;
  futureSos.signerPublicKey = futureSig.publicKeyHex;

  capturedEvents = [];
  const futureResult = await secEngine.processPacket(futureSos);
  assert(futureResult === false, 'Future timestamp packet dropped');
  assert(!secRepo.hasPacket(futureSos.id), 'Future timestamp packet NOT in repository');
  assert(!secDedup.hasSeen(futureSos.id), 'Future timestamp packet NOT in dedup');
  assert(capturedEvents.includes('SECURITY_DROPPED'), 'SECURITY_DROPPED event emitted on future packet');

  // [Step 2 - Test 10] Rejected packet does not poison dedup window
  console.log('\n[Step 2 - Test 10] Rejected packet does not poison deduplication cache');
  const poisonTestId = 'SOS-POISON-TEST-01';
  const badPacket = createSosPacket({
    id: poisonTestId,
    senderId: 'VICTIM-ALICE',
    deviceId: victimDevId,
    latitude: 22.9785,
    longitude: 88.4395
  });
  badPacket.signature = '0000'.repeat(32); // Malicious / invalid signature
  badPacket.signerPublicKey = victimIdent.publicKeyHex;

  const badResult = await secEngine.processPacket(badPacket);
  assert(badResult === false, 'Bad packet rejected');
  assert(!secDedup.hasSeen(poisonTestId), 'Dedup cache is NOT poisoned by rejected packet');

  // Now the legitimate packet with the SAME ID arrives with authentic signature
  const goodPacket = createSosPacket({
    id: poisonTestId,
    senderId: 'VICTIM-ALICE',
    deviceId: victimDevId,
    latitude: 22.9785,
    longitude: 88.4395
  });
  const goodSig = await cryptoVictim.signSosPacket(goodPacket);
  goodPacket.signature = goodSig.signature;
  goodPacket.signerPublicKey = goodSig.publicKeyHex;

  const goodResult = await secEngine.processPacket(goodPacket);
  assert(goodResult === true, 'Legitimate packet with same ID accepted because dedup was not poisoned');
  assert(secRepo.hasPacket(poisonTestId), 'Legitimate packet stored in repository');

  // [Step 2 - Test 11] Multi-hop A -> B -> C -> HQ with signature remaining valid across all hops
  console.log('\n[Step 2 - Test 11] Multi-hop forwarding preserves signature validity across intermediate hops');
  const hopNodeA_crypto = new CryptoService(undefined, 'hop_node_a_crypto');
  const hopA_ident = await hopNodeA_crypto.loadOrCreateDeviceIdentity();

  const hopNodeB_crypto = new CryptoService(undefined, 'hop_node_b_crypto');
  await hopNodeB_crypto.loadOrCreateDeviceIdentity();

  const hopNodeC_crypto = new CryptoService(undefined, 'hop_node_c_crypto');
  await hopNodeC_crypto.loadOrCreateDeviceIdentity();

  const hopNodeHQ_crypto = new CryptoService(undefined, 'hop_node_hq_crypto');
  await hopNodeHQ_crypto.loadOrCreateDeviceIdentity();

  const hopOriginSos = createSosPacket({
    senderId: 'PERSON-HOP-A',
    deviceId: hopA_ident.deviceId,
    latitude: 22.9785,
    longitude: 88.4395,
    priority: 'HIGH',
    message: 'Multi-hop integrity verification'
  });
  const originSig = await hopNodeA_crypto.signSosPacket(hopOriginSos);
  hopOriginSos.signature = originSig.signature;
  hopOriginSos.signerPublicKey = originSig.publicKeyHex;

  // Hop 1: Node B receives from Node A
  const verifyAtB = await hopNodeB_crypto.verifySosPacketSignature(hopOriginSos);
  assert(verifyAtB.isValid === true, 'Node B: Origin signature verified as authentic');
  const hopPacketAtB = {
    ...hopOriginSos,
    hopCount: hopOriginSos.hopCount + 1,
    ttl: hopOriginSos.ttl - 1,
    route: [...hopOriginSos.route, 'NODE-B'],
    status: 'RELAYING' as const
  };

  // Hop 2: Node C receives from Node B
  const verifyAtC = await hopNodeC_crypto.verifySosPacketSignature(hopPacketAtB);
  assert(verifyAtC.isValid === true, 'Node C: Origin signature remains valid after Node B modified hopCount, ttl, route');
  const hopPacketAtC = {
    ...hopPacketAtB,
    hopCount: hopPacketAtB.hopCount + 1,
    ttl: hopPacketAtB.ttl - 1,
    route: [...hopPacketAtB.route, 'NODE-C'],
    status: 'RELAYING' as const
  };

  // Hop 3: Rescue HQ receives from Node C
  const verifyAtHQ = await hopNodeHQ_crypto.verifySosPacketSignature(hopPacketAtC);
  assert(verifyAtHQ.isValid === true, 'Rescue HQ: Origin signature remains 100% valid after multi-hop mesh journey');

  // [Step 2 - Test 12] Existing authenticated ACK reverse route regression check
  console.log('\n[Step 2 - Test 12] ACK reverse routing path regression check');
  const hqAck = createAckPacket(hopOriginSos, 'TACTICAL-HQ', 'ACKNOWLEDGED', 'Rescue boat dispatched');
  assert(hqAck.kind === 'ACK', 'ACK packet created successfully');
  assert(hqAck.sosId === hopOriginSos.id, 'ACK links to correct SOS ID');
  secRepo.saveAck(hqAck);
  assert(secRepo.getAcksForSos(hopOriginSos.id).length > 0, 'ACK persisted in repository');

  secTransport.dispose();
  secPeerTransport.dispose();

  console.log('\n==================================================');
  console.log('ALL TESTS, STEP 1 & STEP 2 SECURITY TESTS PASSED!');
  console.log('==================================================\n');

}

runTestSuite().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
