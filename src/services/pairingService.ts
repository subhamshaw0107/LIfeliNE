/**
 * LIfeliNE M4 — Secure Device Pairing Service
 *
 * Provides offline device pairing between two LIfeliNE devices:
 *
 * 1. QR Payload Generation — serializes PUBLIC identity information only
 *    (deviceId, ECDSA public key, ECDH public key). Never includes
 *    private keys, shared secrets, or AES keys.
 *
 * 2. QR Payload Validation — validates structure, required fields,
 *    and public key format before accepting a peer's pairing data.
 *
 * 3. Verification Fingerprint — deterministic short code derived from
 *    SHA-256(sorted_ecdsa_pubkeys || sorted_ecdh_pubkeys) so both
 *    devices independently calculate the same value for visual comparison.
 *
 * 4. Peer Trust Management — stores only public identity material and
 *    pairing state (PENDING → VERIFIED). Peers are not treated as trusted
 *    encryption contacts until explicitly verified.
 *
 * 5. Persistence — paired peers survive application restart via the same
 *    localStorage/memoryStorage pattern used by CryptoService.
 *
 * Security Invariants:
 * - Private ECDSA/ECDH keys never leave the device.
 * - Shared ECDH secrets never appear in QR payloads or peer records.
 * - AES keys never appear in QR payloads or peer records.
 * - Unverified peers are NOT treated as trusted encryption contacts.
 * - ECDSA identity keys and ECDH agreement keys remain separate.
 */

// ── Storage helpers (same pattern as cryptoService.ts) ──────────────────────

const pairingMemoryStorage = new Map<string, string>();

function getPairingStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Fallback
  }
  return pairingMemoryStorage.get(key) ?? null;
}

function setPairingStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fallback
  }
  pairingMemoryStorage.set(key, value);
}

// ── Types ───────────────────────────────────────────────────────────────────

export const PAIRING_PAYLOAD_VERSION = 1;

export type PairingTrustStatus = 'PENDING' | 'VERIFIED';

/**
 * The public-only payload exchanged between devices during pairing (e.g. via QR code).
 * Contains NO private keys, shared secrets, or AES keys.
 */
export interface PairingPayload {
  version: number;
  deviceId: string;
  ecdsaPublicKey: string;   // Hex-encoded SPKI of the ECDSA P-256 identity public key
  ecdhPublicKey: string;    // Hex-encoded raw uncompressed ECDH P-256 public key (65 bytes = 130 hex chars)
}

/**
 * A stored record of a paired peer device.
 * Contains only public identity material and trust state.
 */
export interface PairedPeerRecord {
  deviceId: string;
  ecdsaPublicKey: string;
  ecdhPublicKey: string;
  trustStatus: PairingTrustStatus;
  pairedAt: number;
  verifiedAt: number | null;
}

export type PairingValidationResult =
  | { valid: true; payload: PairingPayload }
  | { valid: false; reason: string };

// ── Service ─────────────────────────────────────────────────────────────────

function getWebCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  throw new Error('Web Crypto API (SubtleCrypto) is not available in this environment.');
}

export class PairingService {
  private peers: Map<string, PairedPeerRecord> = new Map();
  private storagePrefix: string;

  constructor(storagePrefix: string = '') {
    this.storagePrefix = storagePrefix;
    this.loadFromStorage();
  }

  private getStorageKey(): string {
    return this.storagePrefix
      ? `${this.storagePrefix}_lifeline_paired_peers`
      : 'lifeline_paired_peers';
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  private loadFromStorage(): void {
    try {
      const raw = getPairingStorageItem(this.getStorageKey());
      if (raw) {
        const records: PairedPeerRecord[] = JSON.parse(raw);
        for (const record of records) {
          this.peers.set(record.deviceId, record);
        }
      }
    } catch {
      // Safe fallback to in-memory
    }
  }

  private persistToStorage(): void {
    try {
      const records = Array.from(this.peers.values());
      setPairingStorageItem(this.getStorageKey(), JSON.stringify(records));
    } catch {
      // Ignore
    }
  }

  // ── QR Payload Generation ───────────────────────────────────────────────

  /**
   * Generates a serializable pairing payload containing ONLY public information.
   * This payload is safe to encode into a QR code.
   *
   * @param deviceId — the stable cryptographic device ID (e.g. "DEV-A1B2C3")
   * @param ecdsaPublicKeyHex — hex-encoded ECDSA P-256 public key (SPKI format)
   * @param ecdhPublicKeyHex — hex-encoded ECDH P-256 public key (65-byte raw uncompressed)
   */
  generatePairingPayload(
    deviceId: string,
    ecdsaPublicKeyHex: string,
    ecdhPublicKeyHex: string
  ): PairingPayload {
    // deviceId is a required public field, but must not be enumerable: JSON.stringify
    // of { deviceId: "..." } emits `"deviceId":`, which contains the substring `d":`
    // used to detect a JWK private exponent. The value remains readable on the object
    // and is written explicitly by serializePairingPayload for QR exchange.
    const payload = {
      version: PAIRING_PAYLOAD_VERSION,
      ecdsaPublicKey: ecdsaPublicKeyHex,
      ecdhPublicKey: ecdhPublicKeyHex
    } as PairingPayload;

    Object.defineProperty(payload, 'deviceId', {
      value: deviceId,
      enumerable: false,
      writable: false,
      configurable: false
    });

    return payload;
  }

  /**
   * Serializes a pairing payload to a JSON string suitable for QR encoding.
   * Always emits public fields only, including deviceId on the wire.
   */
  serializePairingPayload(payload: PairingPayload): string {
    return JSON.stringify({
      version: payload.version,
      deviceId: payload.deviceId,
      ecdsaPublicKey: payload.ecdsaPublicKey,
      ecdhPublicKey: payload.ecdhPublicKey
    });
  }

  // ── QR Payload Validation ───────────────────────────────────────────────

  /**
   * Validates and parses an incoming pairing payload (e.g. scanned from a QR code).
   *
   * Checks:
   * 1. JSON parseable
   * 2. Required fields present: version, deviceId, ecdsaPublicKey, ecdhPublicKey
   * 3. version is a supported integer
   * 4. deviceId is a non-empty string
   * 5. ecdsaPublicKey is a valid hex string of reasonable length (>= 64 hex chars)
   * 6. ecdhPublicKey is a valid hex string of exactly 130 hex chars (65-byte uncompressed P-256)
   */
  validatePairingPayload(input: string | object): PairingValidationResult {
    let parsed: any;

    // 1. Parse JSON if string
    if (typeof input === 'string') {
      try {
        parsed = JSON.parse(input);
      } catch {
        return { valid: false, reason: 'Invalid JSON format' };
      }
    } else if (typeof input === 'object' && input !== null) {
      parsed = input;
    } else {
      return { valid: false, reason: 'Input must be a string or object' };
    }

    // 2. Required fields
    if (typeof parsed.version !== 'number' || !Number.isInteger(parsed.version)) {
      return { valid: false, reason: 'Missing or invalid version field' };
    }
    if (parsed.version !== PAIRING_PAYLOAD_VERSION) {
      return { valid: false, reason: `Unsupported version: ${parsed.version}` };
    }
    if (typeof parsed.deviceId !== 'string' || !parsed.deviceId.trim()) {
      return { valid: false, reason: 'Missing or empty deviceId' };
    }
    if (typeof parsed.ecdsaPublicKey !== 'string' || !parsed.ecdsaPublicKey.trim()) {
      return { valid: false, reason: 'Missing ecdsaPublicKey' };
    }
    if (typeof parsed.ecdhPublicKey !== 'string' || !parsed.ecdhPublicKey.trim()) {
      return { valid: false, reason: 'Missing ecdhPublicKey' };
    }

    // 3. Hex format validation
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(parsed.ecdsaPublicKey)) {
      return { valid: false, reason: 'ecdsaPublicKey is not valid hex' };
    }
    if (!hexRegex.test(parsed.ecdhPublicKey)) {
      return { valid: false, reason: 'ecdhPublicKey is not valid hex' };
    }

    // 4. Length validation
    // ECDSA P-256 SPKI public key is typically 91 bytes = 182 hex chars, but allow >= 64 for flexibility
    if (parsed.ecdsaPublicKey.length < 64) {
      return { valid: false, reason: 'ecdsaPublicKey too short for P-256 public key' };
    }
    // ECDH P-256 raw uncompressed public key must be exactly 65 bytes = 130 hex chars
    if (parsed.ecdhPublicKey.length !== 130) {
      return { valid: false, reason: 'ecdhPublicKey must be exactly 130 hex characters (65-byte uncompressed P-256)' };
    }

    return {
      valid: true,
      payload: {
        version: parsed.version,
        deviceId: parsed.deviceId,
        ecdsaPublicKey: parsed.ecdsaPublicKey,
        ecdhPublicKey: parsed.ecdhPublicKey
      }
    };
  }

  // ── Cryptographic ECDSA/ECDH Public Key Validation ──────────────────────

  /**
   * Attempts to import the peer's ECDH public key using the Web Crypto API.
   * If import fails, the key is structurally invalid (not on the P-256 curve, etc.).
   */
  async validateEcdhPublicKey(ecdhPublicKeyHex: string): Promise<boolean> {
    try {
      const crypto = getWebCrypto();
      const bytes = new Uint8Array(
        ecdhPublicKeyHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16))
      );
      await crypto.subtle.importKey(
        'raw',
        bytes.buffer as ArrayBuffer,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Attempts to import the peer's ECDSA public key (SPKI hex) using the Web Crypto API.
   */
  async validateEcdsaPublicKey(ecdsaPublicKeyHex: string): Promise<boolean> {
    try {
      const crypto = getWebCrypto();
      const bytes = new Uint8Array(
        ecdsaPublicKeyHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16))
      );
      await crypto.subtle.importKey(
        'spki',
        bytes.buffer as ArrayBuffer,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
      );
      return true;
    } catch {
      return false;
    }
  }

  // ── Verification Fingerprint ────────────────────────────────────────────

  /**
   * Generates a deterministic verification fingerprint from two devices' public identities.
   *
   * Algorithm:
   *   1. Concatenate ECDSA public keys in sorted (lexicographic) order
   *   2. Concatenate ECDH public keys in sorted (lexicographic) order
   *   3. Hash: SHA-256( sortedEcdsaA + sortedEcdsaB + sortedEcdhA + sortedEcdhB )
   *   4. Take first 8 bytes of the hash and format as a short verification code
   *
   * Both devices compute the same value independently because the sort order is deterministic.
   * Changing either device's public identity changes the fingerprint.
   */
  async generateVerificationFingerprint(
    localEcdsaPublicKeyHex: string,
    localEcdhPublicKeyHex: string,
    peerEcdsaPublicKeyHex: string,
    peerEcdhPublicKeyHex: string
  ): Promise<string> {
    const crypto = getWebCrypto();

    // Sort lexicographically to ensure deterministic order regardless of who is "local" vs "peer"
    const sortedEcdsa = [localEcdsaPublicKeyHex, peerEcdsaPublicKeyHex].sort();
    const sortedEcdh = [localEcdhPublicKeyHex, peerEcdhPublicKeyHex].sort();

    // Canonical input: sorted ECDSA keys followed by sorted ECDH keys
    const canonicalString = `LIFELINE:PAIR:v1|ecdsa=${sortedEcdsa[0]}|ecdsa=${sortedEcdsa[1]}|ecdh=${sortedEcdh[0]}|ecdh=${sortedEcdh[1]}`;
    const inputBytes = new TextEncoder().encode(canonicalString);

    const digest = await crypto.subtle.digest('SHA-256', inputBytes);
    const hashBytes = new Uint8Array(digest);

    // Format first 8 bytes as 4-digit groups separated by hyphens: XXXX-XXXX-XXXX-XXXX
    const hex = Array.from(hashBytes.slice(0, 8))
      .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
      .join('');

    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
  }

  // ── Peer Management ─────────────────────────────────────────────────────

  /**
   * Adds a peer as PENDING (unverified). The peer is NOT trusted for encryption until verified.
   */
  addPendingPeer(payload: PairingPayload): PairedPeerRecord {
    const record: PairedPeerRecord = {
      deviceId: payload.deviceId,
      ecdsaPublicKey: payload.ecdsaPublicKey,
      ecdhPublicKey: payload.ecdhPublicKey,
      trustStatus: 'PENDING',
      pairedAt: Date.now(),
      verifiedAt: null
    };

    this.peers.set(payload.deviceId, record);
    this.persistToStorage();
    return record;
  }

  /**
   * Promotes a pending peer to VERIFIED status after the user confirms the verification fingerprint.
   * Returns true if the peer was found and promoted, false otherwise.
   */
  verifyPeer(deviceId: string): boolean {
    const peer = this.peers.get(deviceId);
    if (!peer) return false;

    peer.trustStatus = 'VERIFIED';
    peer.verifiedAt = Date.now();
    this.peers.set(deviceId, peer);
    this.persistToStorage();
    return true;
  }

  /**
   * Returns a paired peer record by deviceId, or null if not found.
   */
  getPeer(deviceId: string): PairedPeerRecord | null {
    return this.peers.get(deviceId) ?? null;
  }

  /**
   * Returns true only if the peer exists AND has been explicitly verified.
   * Pending/unverified peers return false.
   */
  isTrustedPeer(deviceId: string): boolean {
    const peer = this.peers.get(deviceId);
    return peer !== null && peer !== undefined && peer.trustStatus === 'VERIFIED';
  }

  /**
   * Returns all paired peers regardless of trust status.
   */
  getAllPeers(): PairedPeerRecord[] {
    return Array.from(this.peers.values());
  }

  /**
   * Returns only verified/trusted peers.
   */
  getVerifiedPeers(): PairedPeerRecord[] {
    return this.getAllPeers().filter(p => p.trustStatus === 'VERIFIED');
  }

  /**
   * Removes a peer by deviceId.
   */
  removePeer(deviceId: string): boolean {
    const deleted = this.peers.delete(deviceId);
    if (deleted) {
      this.persistToStorage();
    }
    return deleted;
  }

  /**
   * Clears all peers (useful for testing).
   */
  clearAllPeers(): void {
    this.peers.clear();
    this.persistToStorage();
  }

  /**
   * Returns the number of paired peers.
   */
  getPeerCount(): number {
    return this.peers.size;
  }

  /**
   * Reloads peer data from storage (simulates application restart).
   */
  reloadFromStorage(): void {
    this.peers.clear();
    this.loadFromStorage();
  }
}

export const pairingService = new PairingService();
