import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BleNativeBridge } from './bleMeshTransport';

/**
 * Capacitor access for the native "BleMesh" plugin.
 *
 * registerPlugin() returns a lazy proxy: safe to create on web where the
 * native side is absent — every call rejects, and callers treat rejection
 * as "BLE unavailable" and fall back to mock transport.
 */
const BleMeshPlugin = registerPlugin<BleNativeBridge>('BleMesh');

/** True only inside the native Android app (never in browsers/tests). */
export function isNativeBleHost(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Null when the native plugin is absent (web, tests, unregistered). */
export function createCapacitorBleBridge(): BleNativeBridge | null {
  try {
    if (!isNativeBleHost()) return null;
    const plugins = (Capacitor as unknown as { Plugins?: Record<string, unknown> }).Plugins;
    if (!plugins || plugins['BleMesh'] == null) return null;
    return BleMeshPlugin as unknown as BleNativeBridge;
  } catch {
    return null;
  }
}
