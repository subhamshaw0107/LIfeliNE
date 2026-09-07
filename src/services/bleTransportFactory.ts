import type { MeshTransport } from '../transport/meshTransport';
import { MockMeshTransport } from '../transport/mockMeshTransport';
import { BleMeshTransport, type BleNativeBridge } from '../transport/bleMeshTransport';
import { createCapacitorBleBridge, isNativeBleHost } from '../transport/capacitorBleBridge';

/**
 * Transport selection for this device's own radio link.
 *
 *   Android + native BleMesh plugin present -> BleMeshTransport (real BLE)
 *   Browser / tests / denied / unavailable   -> MockMeshTransport (demo/SCF)
 *
 * PacketEngine is untouched either way: both implement MeshTransport.
 * BleEnvironment is injectable so the selection logic is unit-testable
 * without hardware or Capacitor.
 */
export interface BleEnvironment {
  isNative: boolean;
  createBridge(): BleNativeBridge | null;
}

export function defaultBleEnvironment(): BleEnvironment {
  return {
    isNative: isNativeBleHost(),
    createBridge: () => createCapacitorBleBridge(),
  };
}

function createMock(nodeId: string): MockMeshTransport {
  return new MockMeshTransport(nodeId);
}

/**
 * Synchronous constructor-time transport: always mock (safe everywhere).
 * Call upgradeToBleIfAvailable() afterwards to swap in real BLE.
 */
export function createSelfTransport(nodeId: string): MeshTransport {
  return createMock(nodeId);
}

/**
 * Attempt the mock -> BLE upgrade. Returns true when the device now runs
 * on the real radio. Never throws; any failure keeps the mock transport.
 */
export async function upgradeToBleIfAvailable(
  current: MeshTransport,
  nodeIdHint: string,
  activate: (transport: MeshTransport) => void,
  env: BleEnvironment = defaultBleEnvironment()
): Promise<boolean> {
  try {
    if (current instanceof BleMeshTransport) return true;
    if (!env.isNative) return false;
    const bridge = env.createBridge();
    if (bridge == null) return false;
    const ble = new BleMeshTransport(nodeIdHint, bridge);
    const started = await ble.start();
    if (!started) {
      try {
        await ble.dispose();
      } catch {
        // ignore teardown races
      }
      return false;
    }
    if (current instanceof MockMeshTransport) {
      current.dispose();
    }
    activate(ble);
    return true;
  } catch {
    return false;
  }
}
