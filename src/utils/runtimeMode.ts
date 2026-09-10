import { Capacitor } from '@capacitor/core';

/**
 * LIFELINE Runtime Mode Detection
 *
 * Centralized utility to strictly distinguish native Android hardware execution
 * from browser / demo / test execution.
 */

export function isNativeRuntime(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isDemoRuntime(): boolean {
  return !isNativeRuntime();
}

/**
 * Diagnostic logger with category tags.
 * Safe: never logs keys, private data, or payload plaintext.
 */
export const diagLog = {
  lifeline: (msg: string, ...args: unknown[]) => console.log(`[LIFELINE] ${msg}`, ...args),
  ble: (msg: string, ...args: unknown[]) => console.log(`[BLE-DIAG] ${msg}`, ...args),
  packet: (msg: string, ...args: unknown[]) => console.log(`[PACKET] ${msg}`, ...args),
  gps: (msg: string, ...args: unknown[]) => console.log(`[GPS] ${msg}`, ...args),
  storage: (msg: string, ...args: unknown[]) => console.log(`[STORAGE] ${msg}`, ...args)
};
