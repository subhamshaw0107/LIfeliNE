/**
 * LIFELINE BLE upgrade-retry regression tests (no hardware, no emulator).
 *
 * Covers the reliability fixes for native one-hop BLE bring-up:
 * 1. native initialization fails once then succeeds on retry
 * 2. advertiser unavailable does not prevent scanning (scan-only mode)
 * 3. mock fallback is reported truthfully (null diagnostics, empty peers)
 * 4. retry attempts cannot run concurrently (single in-flight upgrade)
 * 5. a successful native transport is never replaced by mock
 *
 * Uses controllable fake bridges; Fake timers are real timers with short
 * behavior windows (no fake clock library needed).
 */

import { DemoMeshNetwork } from '../../src/services/demoMeshNetwork';
import { BleMeshTransport, type BleNativeBridge } from '../../src/transport/bleMeshTransport';
import { MockMeshTransport } from '../../src/transport/mockMeshTransport';
import type { BleEnvironment } from '../../src/services/bleTransportFactory';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ PASS: ${message}`);
}

class ControllableBridge implements BleNativeBridge {
  initializeCalls = 0;
  failInitializeTimes = 0;
  granted = true;
  supported = true;
  failScan = false;
  advertiseOk = true;
  peers = new Set<string>();

  async initialize() {
    this.initializeCalls++;
    if (this.failInitializeTimes > 0) {
      this.failInitializeTimes--;
      throw new Error('simulated native init failure');
    }
    return { peerId: 'BLE-SELF-TEST', supported: this.supported };
  }

  async requestPermissions() {
    return { granted: this.granted };
  }

  async startScan() {
    if (this.failScan) throw new Error('simulated scan failure');
    return { started: true };
  }

  async stopScan() {}

  async startAdvertising() {
    return { started: this.advertiseOk };
  }

  async stopAdvertising() {}

  async connect(peerId: string) {
    return { ok: this.peers.has(peerId) };
  }

  async disconnect(peerId: string) {
    this.peers.delete(peerId);
    return { ok: true };
  }

  async send(peerId: string, data: string) {
    void data;
    return { ok: this.peers.has(peerId) };
  }

  async getConnectedPeers() {
    return { peers: [...this.peers] };
  }

  addListener(): { remove: () => void } {
    return { remove: () => undefined };
  }
}

function nativeEnv(bridge: ControllableBridge): BleEnvironment {
  return { isNative: true, createBridge: () => bridge };
}

function mockEnv(): BleEnvironment {
  return {
    isNative: false,
    createBridge: () => {
      throw new Error('must not touch native in non-native env');
    },
  };
}

/**
 * Fresh network with the constructor's own upgrade attempt settled, so
 * explicit enableNativeBle(env) calls below start a new attempt with
 * their own env instead of sharing the in-flight constructor attempt.
 */
async function freshNet(): Promise<DemoMeshNetwork> {
  const net = new DemoMeshNetwork();
  await new Promise(resolve => setTimeout(resolve, 20));
  return net;
}

async function runTestSuite() {
  console.log('\n==================================================');
  console.log('STARTING LIFELINE BLE UPGRADE-RETRY TESTS');
  console.log('==================================================\n');

  // Test 1: fail once, succeed on explicit retry
  console.log('[BLE-R1] Initialization fails once, then succeeds on retry');
  {
    const net = await freshNet();
    const bridge = new ControllableBridge();
    bridge.failInitializeTimes = 1;
    const env = nativeEnv(bridge);
    assert((await net.enableNativeBle(env)) === false, 'First attempt fails cleanly');
    assert(net.selfTransport instanceof MockMeshTransport, 'Mock retained after failure');
    assert((await net.enableNativeBle(env)) === true, 'Retry succeeds');
    assert(net.selfTransport instanceof BleMeshTransport, 'Native transport activated');
    assert(bridge.initializeCalls === 2, 'Exactly two init attempts, no hot loop');
  }

  // Test 2: advertiser unavailable must not prevent scanning
  console.log('\n[BLE-R2] Scan-only mode when advertising is unavailable');
  {
    const net = await freshNet();
    const bridge = new ControllableBridge();
    bridge.advertiseOk = false;
    assert((await net.enableNativeBle(nativeEnv(bridge))) === true, 'Upgrade succeeds without advertiser');
    const diag = net.getBleDiagnostics();
    assert(diag !== null, 'Diagnostics available on native transport');
    assert(diag.scanning === true, 'Scanning is ON');
    assert(diag.advertising === false, 'Advertising truthfully reported OFF');
  }

  // Test 3: mock fallback reported truthfully
  console.log('\n[BLE-R3] Non-native environment stays mock and says so');
  {
    const net = await freshNet();
    assert((await net.enableNativeBle(mockEnv())) === false, 'No upgrade off-native');
    assert(net.selfTransport instanceof MockMeshTransport, 'Still mock');
    assert(net.getBleDiagnostics() === null, 'Diagnostics null on mock (truthful absence)');
    assert(net.getRealPeerIds().length === 0, 'No phantom peers');
    assert(net.getLocalBleId() === null, 'No phantom BLE identity');
  }

  // Test 4: concurrent upgrade attempts collapse into one
  console.log('\n[BLE-R4] Concurrent attempts share a single in-flight upgrade');
  {
    const net = await freshNet();
    const bridge = new ControllableBridge();
    const p1 = net.enableNativeBle(nativeEnv(bridge));
    const p2 = net.enableNativeBle(nativeEnv(bridge));
    const [r1, r2] = await Promise.all([p1, p2]);
    assert(r1 === true && r2 === true, 'Both callers observe success');
    assert(bridge.initializeCalls === 1, 'Native initialize ran exactly once');
  }

  // Test 5: successful native transport is never replaced
  console.log('\n[BLE-R5] Upgrade is idempotent once native is active');
  {
    const net = await freshNet();
    const bridge = new ControllableBridge();
    const env = nativeEnv(bridge);
    assert((await net.enableNativeBle(env)) === true, 'First upgrade succeeds');
    const active = net.selfTransport;
    assert(active instanceof BleMeshTransport, 'Active transport is native BLE');
    assert((await net.enableNativeBle(env)) === true, 'Second upgrade reports success');
    assert(net.selfTransport === active, 'Same transport instance retained (not replaced)');
    assert(bridge.initializeCalls === 1, 'No redundant native re-initialization');
  }

  console.log('\n==================================================');
  console.log('ALL BLE UPGRADE-RETRY TESTS PASSED!');
  console.log('==================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ BLE Upgrade-Retry Suite Failed:', err);
  process.exit(1);
});
