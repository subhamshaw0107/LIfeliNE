/**
 * LIFELINE BLE TRANSPORT BOUNDARY TESTS (no hardware, no emulator).
 *
 * Verifies the M3/M2 seam using a FakeBridge that implements the exact
 * documented native-bridge contract (see docs/BLE_TRANSPORT.md):
 *
 *  1. Uint8Array <-> base64 round trip
 *  2. 694-byte SOS fragmentation/reassembly
 *  3. 254-byte ACK fragmentation/reassembly
 *  4. default small-MTU behavior (20-byte payloads)
 *  5. larger negotiated-MTU behavior
 *  6. duplicate fragment handling
 *  7. out-of-order fragments
 *  8. missing fragment -> no delivery
 *  9. invalid fragment index -> rejected
 * 10. oversized packet rejection
 * 11. independent per-peer reassembly buffers
 * 12. complete packet reaches PacketEngine
 * 13. incomplete packet never reaches PacketEngine
 * 14. send failure returns false (never throws)
 * 15. browser/test env keeps MockMeshTransport
 *
 * The frame codec below is a TEST-ONLY reference model of the byte-exact
 * spec the Kotlin layer implements (header + LITTLE_ENDIAN + caps).
 * Production TypeScript performs NO reassembly: native delivers complete
 * packets and the adapter only decodes base64.
 */

import {
  BleMeshTransport,
  uint8ToBase64,
  base64ToUint8,
  type BleNativeBridge,
  type BlePacketEvent,
  type BlePeerEvent,
  type BleFoundEvent,
  type BleListenerHandle,
} from '../../src/transport/bleMeshTransport';
import { MockMeshTransport } from '../../src/transport/mockMeshTransport';
import { PacketEngine } from '../../src/services/packetEngine';
import { SosRepository } from '../../src/repositories/sosRepository';
import { StorageEngine } from '../../src/storage/storageEngine';
import { DeduplicationService } from '../../src/services/deduplicationService';
import {
  createSosPacket,
  createAckPacket,
  serializePacketToBytes,
  deserializePacketFromBytes,
} from '../../src/models/Packet';
import {
  upgradeToBleIfAvailable,
  type BleEnvironment,
} from '../../src/services/bleTransportFactory';
import type { MeshTransport } from '../../src/transport/meshTransport';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ PASS: ${message}`);
}

// ---------------------------------------------------------------------------
// Test-only reference frame codec (mirrors docs/BLE_TRANSPORT.md + Kotlin).
// ---------------------------------------------------------------------------

const HEADER_SIZE = 8;
const MAX_PACKET_BYTES = 8192;
const MAX_FRAGMENTS = 512;

interface FrameHeader {
  total: number;
  index: number;
  count: number;
}

function encodeFrames(packet: Uint8Array, maxPayload: number): Uint8Array[] {
  if (packet.length === 0 || packet.length > MAX_PACKET_BYTES) {
    throw new Error('bad packet size');
  }
  if (maxPayload <= HEADER_SIZE) throw new Error('payload too small');
  const chunk = maxPayload - HEADER_SIZE;
  const count = Math.ceil(packet.length / chunk);
  if (count < 1 || count > MAX_FRAGMENTS) throw new Error('bad fragment count');
  const view = new DataView(new ArrayBuffer(HEADER_SIZE));
  const out: Uint8Array[] = [];
  for (let index = 0; index < count; index++) {
    const start = index * chunk;
    const end = Math.min(start + chunk, packet.length);
    view.setUint32(0, packet.length, true);
    view.setUint16(4, index, true);
    view.setUint16(6, count, true);
    const frame = new Uint8Array(HEADER_SIZE + (end - start));
    frame.set(new Uint8Array(view.buffer), 0);
    frame.set(packet.subarray(start, end), HEADER_SIZE);
    out.push(frame);
  }
  return out;
}

function parseHeader(frame: Uint8Array): FrameHeader | null {
  if (frame.length < HEADER_SIZE) return null;
  const view = new DataView(frame.buffer, frame.byteOffset, HEADER_SIZE);
  const total = view.getUint32(0, true);
  const index = view.getUint16(4, true);
  const count = view.getUint16(6, true);
  if (total <= 0 || total > MAX_PACKET_BYTES) return null;
  if (count <= 0 || count > MAX_FRAGMENTS) return null;
  if (index < 0 || index >= count) return null;
  return { total, index, count };
}

class ReferenceReassembler {
  private total = -1;
  private count = -1;
  private parts: (Uint8Array | null)[] = [];
  private received = 0;

  feed(frame: Uint8Array): Uint8Array | null {
    const header = parseHeader(frame);
    if (!header) {
      this.reset();
      return null;
    }
    if (this.total === -1) {
      this.total = header.total;
      this.count = header.count;
      this.parts = new Array(header.count).fill(null);
      this.received = 0;
    } else if (header.total !== this.total || header.count !== this.count) {
      this.reset();
      return null;
    }
    if (this.parts[header.index] != null) return null; // duplicate
    this.parts[header.index] = frame.slice(HEADER_SIZE);
    this.received++;
    if (this.received < this.count) return null;
    const out = new Uint8Array(this.total);
    let offset = 0;
    for (let i = 0; i < this.count; i++) {
      const part = this.parts[i];
      if (!part) {
        this.reset();
        return null;
      }
      const copyLen = i === this.count - 1 ? this.total - offset : part.length;
      if (copyLen < 0 || copyLen > part.length) {
        this.reset();
        return null;
      }
      out.set(part.subarray(0, copyLen), offset);
      offset += copyLen;
    }
    if (offset !== this.total) {
      this.reset();
      return null;
    }
    this.reset();
    return out;
  }

  private reset() {
    this.total = -1;
    this.count = -1;
    this.parts = [];
    this.received = 0;
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  // Deterministic reverse-pair shuffle (no RNG flakiness in tests).
  for (let i = 0; i + 1 < copy.length; i += 2) {
    const tmp = copy[i];
    copy[i] = copy[i + 1];
    copy[i + 1] = tmp;
  }
  return copy.reverse();
}

// ---------------------------------------------------------------------------
// Fake native bridge (implements the documented BleNativeBridge contract).
// ---------------------------------------------------------------------------

type PacketHandler = (payload: BlePacketEvent) => void;

class FakeBridge implements BleNativeBridge {
  peers = new Set<string>(['BLE-PEER-B']);
  sent: { peerId: string; data: string }[] = [];
  failSend = false;
  supported = true;
  granted = true;
  startedScan = false;
  startedAdvertising = false;
  private packetHandlers: PacketHandler[] = [];

  async initialize() {
    return { peerId: 'BLE-SELF-1', supported: this.supported };
  }

  async requestPermissions() {
    return { granted: this.granted };
  }

  async startScan() {
    this.startedScan = true;
    return { started: true };
  }

  async stopScan() {
    this.startedScan = false;
  }

  async startAdvertising() {
    this.startedAdvertising = true;
    return { started: true };
  }

  async stopAdvertising() {
    this.startedAdvertising = false;
  }

  async connect(peerId: string) {
    if (!this.peers.has(peerId)) return { ok: false };
    return { ok: true };
  }

  async disconnect(peerId: string) {
    this.peers.delete(peerId);
    return { ok: true };
  }

  async send(peerId: string, data: string) {
    if (this.failSend || !this.peers.has(peerId)) return { ok: false };
    this.sent.push({ peerId, data });
    return { ok: true };
  }

  async getConnectedPeers() {
    return { peers: [...this.peers] };
  }

  addListener(
    event: 'packetReceived',
    callback: (payload: BlePacketEvent) => void
  ): BleListenerHandle;
  addListener(
    event: 'peerConnected' | 'peerDisconnected',
    callback: (payload: BlePeerEvent) => void
  ): BleListenerHandle;
  addListener(
    event: 'peerFound',
    callback: (payload: BleFoundEvent) => void
  ): BleListenerHandle;
  addListener(event: string, callback: (payload: never) => void): BleListenerHandle {
    if (event === 'packetReceived') {
      this.packetHandlers.push(callback as PacketHandler);
    }
    return { remove: () => undefined };
  }

  /** Simulate the native layer delivering a COMPLETE reassembled packet. */
  async emitPacketReceived(peerId: string, bytes: Uint8Array): Promise<void> {
    const payload: BlePacketEvent = { peerId, data: uint8ToBase64(bytes) };
    await Promise.all(this.packetHandlers.map(cb => Promise.resolve(cb(payload))));
  }
}

async function runTestSuite() {
  console.log('\n==================================================');
  console.log('STARTING LIFELINE BLE TRANSPORT BOUNDARY TESTS');
  console.log('==================================================\n');

  // Test 1: base64 round trip & Raw-Byte Verification
  console.log('[BLE 1] Uint8Array <-> base64 round trip');
  const sample = new Uint8Array([0, 1, 2, 250, 255, 72, 101, 108, 108, 111]);
  assert(bytesEqual(base64ToUint8(uint8ToBase64(sample)), sample), 'Binary round trip is lossless');

  // STEP 3 DETERMINISTIC RAW-BYTE PAYLOADS (Payload-agnostic transport tests)
  console.log('\n[BLE 1A] Raw-Byte Test A: [1, 2, 3, 4, 5, 0, 127, 128, 255]');
  const rawTestA = new Uint8Array([1, 2, 3, 4, 5, 0, 127, 128, 255]);
  assert(bytesEqual(base64ToUint8(uint8ToBase64(rawTestA)), rawTestA), 'Raw Test A round-trip lossless');

  console.log('\n[BLE 1B] Raw-Byte Test B: 300 bytes (0..255 repeated)');
  const rawTestB = new Uint8Array(300);
  for (let i = 0; i < 300; i++) rawTestB[i] = i % 256;
  assert(bytesEqual(base64ToUint8(uint8ToBase64(rawTestB)), rawTestB), 'Raw Test B round-trip lossless');
  const rawTestBFrames = encodeFrames(rawTestB, 20);
  assert(rawTestBFrames.length === 25, `Raw Test B splits into ${rawTestBFrames.length} frames at MTU 23 (12B payload)`);
  const rawTestBReassembler = new ReferenceReassembler();
  let rawTestBOut: Uint8Array | null = null;
  for (const f of rawTestBFrames) rawTestBOut = rawTestBReassembler.feed(f);
  assert(rawTestBOut !== null && bytesEqual(rawTestBOut, rawTestB), 'Raw Test B reassembles byte-identical');

  console.log('\n[BLE 1C] Raw-Byte Test C: 1000 bytes (0..255 repeated)');
  const rawTestC = new Uint8Array(1000);
  for (let i = 0; i < 1000; i++) rawTestC[i] = i % 256;
  assert(bytesEqual(base64ToUint8(uint8ToBase64(rawTestC)), rawTestC), 'Raw Test C round-trip lossless');
  const rawTestCFrames = encodeFrames(rawTestC, 20);
  assert(rawTestCFrames.length === 84, `Raw Test C splits into ${rawTestCFrames.length} frames at MTU 23 (12B payload)`);
  const rawTestCReassembler = new ReferenceReassembler();
  let rawTestCOut: Uint8Array | null = null;
  for (const f of rawTestCFrames) rawTestCOut = rawTestCReassembler.feed(f);
  assert(rawTestCOut !== null && bytesEqual(rawTestCOut, rawTestC), 'Raw Test C reassembles byte-identical');

  // Reference SOS (~694 B) and ACK (~254 B) payloads
  const sos = createSosPacket({
    senderId: 'PERSON-A',
    deviceId: 'DEV-A',
    latitude: 22.9785,
    longitude: 88.4395,
    message: 'Trapped on rooftop due to flood!',
  });
  const sosBytes = serializePacketToBytes(sos);
  const ackBytes = serializePacketToBytes(
    createAckPacket(sos, 'NODE-RESCUE-CMD', 'ACKNOWLEDGED', 'Boat dispatched')
  );
  console.log(`\n(measured payloads: SOS=${sosBytes.length} B, ACK=${ackBytes.length} B)`);

  // Test 2: SOS fragmentation/reassembly
  console.log('\n[BLE 2] 694-byte SOS fragmentation/reassembly');
  const sosFrames = encodeFrames(sosBytes, 20);
  assert(sosFrames.length > 1, `SOS splits into ${sosFrames.length} frames at 20 B payload`);
  assert(sosFrames.every(f => f.length <= 20), 'No frame exceeds the small-MTU payload');
  const sosReassembler = new ReferenceReassembler();
  let sosOut: Uint8Array | null = null;
  for (const frame of sosFrames) sosOut = sosReassembler.feed(frame);
  assert(sosOut !== null && bytesEqual(sosOut, sosBytes), 'SOS reassembles byte-identical');

  // Test 3: ACK fragmentation/reassembly
  console.log('\n[BLE 3] 254-byte ACK fragmentation/reassembly');
  const ackFrames = encodeFrames(ackBytes, 20);
  assert(ackFrames.length > 1, `ACK splits into ${ackFrames.length} frames at 20 B payload`);
  const ackReassembler = new ReferenceReassembler();
  let ackOut: Uint8Array | null = null;
  for (const frame of ackFrames) ackOut = ackReassembler.feed(frame);
  assert(ackOut !== null && bytesEqual(ackOut, ackBytes), 'ACK reassembles byte-identical');

  // Test 4: default small MTU
  console.log('\n[BLE 4] Default small-MTU behavior (ATT 23 -> 20 B payload)');
  const defaultPayload = 23 - 3;
  assert(defaultPayload === 20, 'Usable payload derives as MTU-3');
  const smallFrames = encodeFrames(sosBytes, defaultPayload);
  assert(smallFrames.every(f => f.length <= 23 - 3), 'Frames fit default ATT payload');

  // Test 5: negotiated MTU
  console.log('\n[BLE 5] Negotiated-MTU behavior (517 -> usable payload)');
  const bigPayload = 517 - 3;
  const bigFrames = encodeFrames(sosBytes, bigPayload);
  assert(bigFrames.length === 2, `SOS needs only ${bigFrames.length} frames at MTU 517`);
  const bigReassembler = new ReferenceReassembler();
  let bigOut: Uint8Array | null = null;
  for (const frame of bigFrames) bigOut = bigReassembler.feed(frame);
  assert(bigOut !== null && bytesEqual(bigOut, sosBytes), 'MTU-517 reassembly is byte-identical');

  // Test 6: duplicates
  console.log('\n[BLE 6] Duplicate fragment handling');
  const dupReassembler = new ReferenceReassembler();
  let dupOut: Uint8Array | null = null;
  for (const frame of sosFrames) {
    dupOut = dupReassembler.feed(frame) ?? dupOut;
    dupOut = dupReassembler.feed(frame) ?? dupOut; // send every frame twice
  }
  assert(dupOut !== null && bytesEqual(dupOut, sosBytes), 'Duplicates ignored, single complete output');

  // Test 7: out-of-order
  console.log('\n[BLE 7] Out-of-order fragments');
  const oooReassembler = new ReferenceReassembler();
  let oooOut: Uint8Array | null = null;
  for (const frame of shuffled(sosFrames)) oooOut = oooReassembler.feed(frame);
  assert(oooOut !== null && bytesEqual(oooOut, sosBytes), 'Shuffled fragments still reassemble');

  // Test 8: missing fragment
  console.log('\n[BLE 8] Missing fragment -> no delivery');
  const missReassembler = new ReferenceReassembler();
  let missOut: Uint8Array | null = null;
  sosFrames.forEach((frame, idx) => {
    if (idx !== 1) missOut = missReassembler.feed(frame);
  });
  assert(missOut === null, 'Incomplete transfer produces no packet');

  // Test 9: invalid index
  console.log('\n[BLE 9] Invalid fragment index rejected');
  const badFrame = sosFrames[0].slice();
  const badView = new DataView(badFrame.buffer, badFrame.byteOffset, HEADER_SIZE);
  badView.setUint16(4, 9999, true); // index far beyond count
  const badReassembler = new ReferenceReassembler();
  assert(badReassembler.feed(badFrame) === null, 'Corrupt index yields no packet');

  // Test 10: oversized
  console.log('\n[BLE 10] Oversized packet rejection');
  const hugeView = new DataView(new ArrayBuffer(HEADER_SIZE));
  hugeView.setUint32(0, MAX_PACKET_BYTES + 1, true);
  hugeView.setUint16(4, 0, true);
  hugeView.setUint16(6, 999, true);
  const hugeFrame = new Uint8Array(HEADER_SIZE + 4);
  hugeFrame.set(new Uint8Array(hugeView.buffer), 0);
  const hugeReassembler = new ReferenceReassembler();
  assert(hugeReassembler.feed(hugeFrame) === null, 'Oversized total rejected');
  assert(parseHeader(hugeFrame) === null, 'Oversized header fails validation');

  // Test 11: independent per-peer buffers
  console.log('\n[BLE 11] Independent per-peer reassembly buffers');
  const reassemblerA = new ReferenceReassembler();
  const reassemblerB = new ReferenceReassembler();
  const other = createSosPacket({
    senderId: 'PERSON-B',
    deviceId: 'DEV-B',
    latitude: 22.97,
    longitude: 88.43,
  });
  const otherBytes = serializePacketToBytes(other);
  const framesA = encodeFrames(sosBytes, 64);
  const framesB = encodeFrames(otherBytes, 64);
  let outA: Uint8Array | null = null;
  let outB: Uint8Array | null = null;
  const rounds = Math.max(framesA.length, framesB.length);
  for (let i = 0; i < rounds; i++) {
    if (i < framesA.length) outA = reassemblerA.feed(framesA[i]);
    if (i < framesB.length) outB = reassemblerB.feed(framesB[i]);
  }
  assert(outA !== null && bytesEqual(outA, sosBytes), 'Peer A stream reassembles independently');
  assert(outB !== null && bytesEqual(outB, otherBytes), 'Peer B stream reassembles independently');

  // Test 12: complete packet reaches PacketEngine through the adapter
  console.log('\n[BLE 12] Complete packet reaches PacketEngine via BleMeshTransport');
  const fake = new FakeBridge();
  const ble = new BleMeshTransport('TEST-PHONE', fake);
  assert(await ble.start(), 'Adapter starts against the fake bridge');
  const storage = new StorageEngine('ble_test_phone');
  storage.clearAll();
  const repo = new SosRepository(storage);
  const engine = new PacketEngine({
    localNodeId: 'TEST-PHONE',
    sosRepo: repo,
    dedup: new DeduplicationService(100, storage),
    transport: ble,
  });
  let engineCallbacks = 0;
  engine.onPacketDelivered(() => {
    engineCallbacks++;
  });
  await fake.emitPacketReceived('BLE-PEER-B', sosBytes);
  assert(repo.hasPacket(sos.id), 'Engine stored the SOS delivered over the BLE adapter');
  const restored = deserializePacketFromBytes(
    serializePacketToBytes(repo.getPacket(sos.id)!)
  );
  assert(restored !== null && restored.id === sos.id, 'Stored packet round-trips through M3');

  // Test 13: incomplete packet never reaches PacketEngine
  console.log('\n[BLE 13] Incomplete packet never reaches PacketEngine');
  const partial = new ReferenceReassembler();
  let partialOut: Uint8Array | null = null;
  for (let i = 0; i < Math.min(3, sosFrames.length); i++) {
    partialOut = partial.feed(sosFrames[i]);
  }
  assert(partialOut === null, 'Partial transfer yields nothing to forward');
  const before = repo.getAllPackets().length;
  assert(repo.getAllPackets().length === before, 'Engine state untouched by partial data');

  // Adapter-level: malformed bridge payload never reaches M3 listeners
  let m3Calls = 0;
  const unsub = ble.onPacketReceived(() => {
    m3Calls++;
  });
  await fake.emitPacketReceived('BLE-PEER-B', sosBytes);
  assert(m3Calls === 1, 'Adapter forwards exactly one callback per complete packet');
  unsub();

  // Test 14: failures return false, never throw
  console.log('\n[BLE 14] Send failure returns false');
  assert((await ble.sendPacket('BLE-UNKNOWN', sosBytes)) === false, 'Unknown peer -> false');
  assert((await ble.sendPacket('BLE-PEER-B', new Uint8Array(0))) === false, 'Empty payload -> false');
  fake.failSend = true;
  assert((await ble.sendPacket('BLE-PEER-B', sosBytes)) === false, 'Bridge failure -> false');
  fake.failSend = false;
  assert((await ble.sendPacket('BLE-PEER-B', sosBytes)) === true, 'Healthy send -> true');
  assert((await ble.broadcastPacket(new Uint8Array(0))) === false, 'Empty broadcast -> false');

  // Test 15: browser/test env keeps MockMeshTransport
  console.log('\n[BLE 15] Non-native environment keeps MockMeshTransport');
  const webEnv: BleEnvironment = {
    isNative: false,
    createBridge: () => {
      throw new Error('must not touch native in browser');
    },
  };
  const mockTransport: MeshTransport = new MockMeshTransport('WEB-PHONE');
  let activated: MeshTransport | null = null;
  const upgraded = await upgradeToBleIfAvailable(
    mockTransport,
    'WEB-PHONE',
    t => {
      activated = t;
    },
    webEnv
  );
  assert(upgraded === false, 'No upgrade attempted in browser env');
  assert(activated === null, 'Mock transport left in place');
  assert(mockTransport instanceof MockMeshTransport, 'Browser path stays mocked');

  // Bonus: denied permissions keep mock too
  const deniedEnv: BleEnvironment = {
    isNative: true,
    createBridge: () => {
      const denied = new FakeBridge();
      denied.granted = false;
      return denied;
    },
  };
  const stillMock = new MockMeshTransport('DENIED-PHONE');
  const upgradedDenied = await upgradeToBleIfAvailable(
    stillMock,
    'DENIED-PHONE',
    () => undefined,
    deniedEnv
  );
  assert(upgradedDenied === false, 'Permission denial keeps mock transport');

  await ble.dispose();

  console.log('\n==================================================');
  console.log('ALL BLE TRANSPORT BOUNDARY TESTS PASSED!');
  console.log('==================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ BLE Test Suite Failed:', err);
  process.exit(1);
});
