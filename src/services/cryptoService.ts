/**
 * Lifeline Security Service (M4)
 * 
 * 1. Authenticated Symmetric Encryption: AES-GCM 256-bit with per-message 12-byte IV
 * 2. Device Identity: Persistent ECDSA P-256 asymmetric cryptographic key pair
 * 3. Key Agreement & Derivation: ECDH P-256 -> HKDF-SHA-256 -> AES-GCM-256
 * 
 * Cryptographic Pipeline:
 *   Device A Private ECDH (P-256) + Device C Public ECDH (P-256)
 *   ↓
 *   Raw ECDH Shared Secret (encapsulated as non-extractable HKDF master key)
 *   ↓
 *   HKDF-SHA-256 (Extract & Expand with protocol info: "LIfeliNE-M4-E2E-v1")
 *   ↓
 *   256-bit AES-GCM Symmetric Key (non-extractable)
 * 
 * Security Guarantees:
 * - Uses standard Web Crypto API (SubtleCrypto)
 * - Private keys, symmetric keys, and intermediate HKDF keys are encapsulated in private fields (#)
 * - Loaded in-memory private keys and derived keys are marked non-extractable (extractable: false)
 * - Never exposes or logs private keys, secret keys, shared secrets, or sensitive payloads
 * 
 * Note: This software-based key isolation within the Web Crypto API is not equivalent
 * to hardware-backed secure elements such as Android Keystore or TPM/HSM.
 */

import { SosPacket } from '../types';
import {
  ReplayProtectionService,
  replayProtectionService
} from './replayProtectionService';
import type {
  ReplayCheckResult,
  ReplayProtectionOptions
} from './replayProtectionService';
import {
  PairingService,
  pairingService,
  PAIRING_PAYLOAD_VERSION
} from './pairingService';
import type {
  PairingPayload,
  PairedPeerRecord,
  PairingTrustStatus,
  PairingValidationResult
} from './pairingService';

export {
  ReplayProtectionService,
  replayProtectionService,
  PairingService,
  pairingService,
  PAIRING_PAYLOAD_VERSION
};
export type {
  ReplayCheckResult,
  ReplayProtectionOptions,
  PairingPayload,
  PairedPeerRecord,
  PairingTrustStatus,
  PairingValidationResult
};

export interface PublicDeviceIdentity {
  deviceId: string;
  algorithm: string;
  publicKeyHex: string;
  publicKeyJwk: JsonWebKey;
}

export interface DeviceIdentitySummary {
  deviceId: string;
  algorithm: string;
  hasPrivateKey: boolean;
  publicKeyHex: string;
}

export interface HkdfDerivationOptions {
  info?: string | Uint8Array;
  salt?: Uint8Array;
}

export interface PacketAadFields {
  id: string;
  senderId: string;
  recipientId: string;
  createdAt: number;
}

export type AuthenticatedAckStatus = 'ACKNOWLEDGED' | 'RESPONDING' | 'RESCUED';

export interface AckAadFields {
  ackId: string;
  sosId: string;
  senderId: string;
  recipientId: string;
  createdAt: number;
}

/**
 * Authenticated ACK packet (M4). Distinct from the M3 mesh AckPacket used for
 * unauthenticated store-and-forward routing. Contains public binding fields plus
 * AES-GCM ciphertext; private keys and shared secrets are never included.
 */
export interface AuthenticatedAckPacket {
  kind: 'ACK';
  ackId: string;
  sosId: string;
  senderId: string;
  recipientId: string;
  deviceId: string;
  createdAt: number;
  status: AuthenticatedAckStatus;
  encryptedPayload: string;
  iv: string;
  algorithm: string;
  hopCount: number;
  ttl: number;
  route: string[];
}

export type AckVerifyStatus =
  | ReplayCheckResult
  | 'REJECT_AUTH_FAILED'
  | 'REJECT_WRONG_RECIPIENT'
  | 'REJECT_UNTRUSTED_PEER';

/**
 * Canonical fields included in the SOS digital signature.
 * Excludes mutable relay fields (hopCount, ttl, route, statusHistory, status, forwardingState,
 * riskLevel, disasterZoneName, distanceFromDisasterKm, distanceFromRescueKm) to allow
 * multi-hop mesh forwarding without invalidating the cryptographic signature.
 */
export interface SosAadFields {
  id: string;
  senderId: string;
  deviceId: string;
  createdAt: number;
  latitude: number;
  longitude: number;
  priority: string;
  message?: string;
  encryptedPayload?: string;
  iv?: string;
  recipientId?: string;
}

/**
 * Deterministic canonical serialization of immutable SOS packet fields for ECDSA signing.
 */
export function buildSosCanonicalString(fields: SosAadFields): string {
  return [
    'LIFELINE:SOS-AUTH:v1',
    `id=${fields.id}`,
    `senderId=${fields.senderId}`,
    `deviceId=${fields.deviceId}`,
    `createdAt=${fields.createdAt}`,
    `latitude=${fields.latitude}`,
    `longitude=${fields.longitude}`,
    `priority=${fields.priority}`,
    `message=${fields.message || ''}`,
    `encryptedPayload=${fields.encryptedPayload || ''}`,
    `iv=${fields.iv || ''}`,
    `recipientId=${fields.recipientId || ''}`
  ].join('|');
}

export function buildSosAad(fields: SosAadFields): Uint8Array {
  return new TextEncoder().encode(buildSosCanonicalString(fields));
}

/**
 * Deterministic canonical serialization of immutable packet metadata for AES-GCM AAD.
 * Mutable relay fields (hopCount, ttl, route) are deliberately excluded so relays can forward without invalidating the tag.
 */
export function buildPacketAad(fields: PacketAadFields): Uint8Array {
  const canonicalString = `LIFELINE:AAD:v1|id=${fields.id}|sender=${fields.senderId}|recipient=${fields.recipientId}|createdAt=${fields.createdAt}`;
  return new TextEncoder().encode(canonicalString);
}

/**
 * ACK AAD binds the ACK to the original SOS/message id and the two device identities.
 * Mutable relay fields are excluded.
 */
export function buildAckAad(fields: AckAadFields): Uint8Array {
  const canonicalString = `LIFELINE:ACK-AAD:v1|ackId=${fields.ackId}|sosId=${fields.sosId}|sender=${fields.senderId}|recipient=${fields.recipientId}|createdAt=${fields.createdAt}`;
  return new TextEncoder().encode(canonicalString);
}

export const DEFAULT_HKDF_INFO = 'LIfeliNE-M4-E2E-v1';
/**
 * Domain-separated HKDF info for directional ACK keys.
 * Full info is `${DEFAULT_ACK_HKDF_INFO}|from=<senderDeviceId>|to=<recipientDeviceId>`.
 * Example: C acknowledging A uses from=C, to=A — not the SOS E2E info string.
 */
export const DEFAULT_ACK_HKDF_INFO = 'LIfeliNE-M4-ACK-v1';

export function buildAckHkdfInfo(fromDeviceId: string, toDeviceId: string): string {
  return `${DEFAULT_ACK_HKDF_INFO}|from=${fromDeviceId}|to=${toDeviceId}`;
}

// Standard RFC 5869 / Web Crypto salt (32-byte zero buffer for uniform domain binding)
export const DEFAULT_HKDF_SALT = new Uint8Array(32);

// In-memory fallback storage for environments without browser localStorage (e.g. Node.js unit tests)
const memoryStorage = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Fallback to memoryStorage
  }
  return memoryStorage.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fallback to memoryStorage
  }
  memoryStorage.set(key, value);
}

function getWebCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  throw new Error('Web Crypto API (SubtleCrypto) is not available in this environment.');
}

export class CryptoService {
  #cryptoKey: CryptoKey | null = null;
  #keyPromise: Promise<CryptoKey> | null = null;
  #customEntropy: Uint8Array | null = null;
  #storagePrefix: string = '';

  // Asymmetric Device Identity (ECDSA P-256 for signing/identity)
  #identityKeyPair: CryptoKeyPair | null = null;
  #identityPromise: Promise<PublicDeviceIdentity> | null = null;

  // Dedicated Key Agreement (ECDH P-256 for key exchange only)
  #ecdhKeyPair: CryptoKeyPair | null = null;

  constructor(customEntropy?: Uint8Array, storagePrefix: string = '') {
    if (customEntropy) {
      this.#customEntropy = customEntropy;
    }
    this.#storagePrefix = storagePrefix;
    this.#keyPromise = this.#initKey();
  }

  #getStorageKey(key: string): string {
    return this.#storagePrefix ? `${this.#storagePrefix}_${key}` : key;
  }

  /* ====================================================================
   * 1. AES-GCM-256 SYMMETRIC ENCRYPTION BASELINE
   * ==================================================================== */

  async #initKey(): Promise<CryptoKey> {
    const crypto = getWebCrypto();

    let entropy: Uint8Array;
    if (this.#customEntropy) {
      entropy = this.#customEntropy;
    } else {
      const storageKey = this.#getStorageKey('lifeline_device_secure_entropy');
      const rawKeyStored = getStorageItem(storageKey);
      if (rawKeyStored) {
        try {
          const parsed = JSON.parse(rawKeyStored);
          entropy = new Uint8Array(parsed);
        } catch {
          entropy = new Uint8Array(32);
          crypto.getRandomValues(entropy);
          setStorageItem(storageKey, JSON.stringify(Array.from(entropy)));
        }
      } else {
        entropy = new Uint8Array(32); // 256-bit key
        crypto.getRandomValues(entropy);
        setStorageItem(storageKey, JSON.stringify(Array.from(entropy)));
      }
    }

    const key = await crypto.subtle.importKey(
      'raw',
      entropy.buffer as ArrayBuffer,
      { name: 'AES-GCM', length: 256 },
      false, // Raw symmetric key is NOT exportable outside Web Crypto API
      ['encrypt', 'decrypt']
    );

    this.#cryptoKey = key;
    return key;
  }

  async #getKey(): Promise<CryptoKey> {
    if (this.#cryptoKey) return this.#cryptoKey;
    if (this.#keyPromise) return await this.#keyPromise;
    return await this.#initKey();
  }

  /**
   * Encrypt an SOS payload object using AES-GCM 256-bit with a unique 96-bit (12-byte) random IV.
   * Authentication tag length is 128-bit.
   */
  async encryptSosPayload(
    payload: Record<string, unknown>,
    keyOverride?: CryptoKey
  ): Promise<{
    ciphertext: string;
    iv: string;
    algorithm: string;
    verified: boolean;
  }> {
    const crypto = getWebCrypto();
    const key = keyOverride || (await this.#getKey());
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(payload));

    // Generate unique 12-byte (96-bit) IV/nonce for GCM
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128 // 128-bit authentication tag
      },
      key,
      plaintext
    );

    // Convert to hex representation
    const ciphertextHex = Array.from(new Uint8Array(encryptedBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const ivHex = Array.from(iv)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      ciphertext: ciphertextHex,
      iv: ivHex,
      algorithm: 'AES-GCM-256 (Authenticated)',
      verified: true
    };
  }

  /**
   * Decrypt an encrypted SOS payload at the Rescue Gateway.
   * Automatically verifies 128-bit AES-GCM authentication tag.
   * Rejects tampered ciphertext, tampered IV, wrong key, or malformed data safely.
   */
  async decryptSosPayload(
    ciphertextHex: string,
    ivHex: string,
    keyOverride?: CryptoKey
  ): Promise<Record<string, unknown> | null> {
    try {
      // Validate inputs: hex strings must be non-empty and valid hex characters
      if (!ciphertextHex || typeof ciphertextHex !== 'string' || !ivHex || typeof ivHex !== 'string') {
        return null;
      }
      if (ciphertextHex.length % 2 !== 0 || ivHex.length % 2 !== 0) {
        return null;
      }
      // IV for AES-GCM must be exactly 12 bytes = 24 hex chars
      if (ivHex.length !== 24) {
        return null;
      }
      if (!/^[0-9a-fA-F]+$/.test(ciphertextHex) || !/^[0-9a-fA-F]+$/.test(ivHex)) {
        return null;
      }

      const crypto = getWebCrypto();
      const key = keyOverride || (await this.#getKey());

      const ciphertextBytes = new Uint8Array(
        ciphertextHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );
      const ivBytes = new Uint8Array(
        ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBytes.buffer as ArrayBuffer,
          tagLength: 128
        },
        key,
        ciphertextBytes.buffer as ArrayBuffer
      );

      const decoder = new TextDecoder();
      const plaintext = decoder.decode(decryptedBuffer);
      return JSON.parse(plaintext);
    } catch {
      // Silently fail on authentication tag mismatch, wrong key, or corrupt data.
      // Never log plaintext, keys, or sensitive payloads.
      return null;
    }
  }

  /**
   * Encrypt an SOS packet payload with an E2EE AES-GCM-256 key and bind immutable packet metadata into AAD.
   */
  async encryptSosPacketPayload(
    payload: Record<string, unknown>,
    key: CryptoKey,
    aadFields: PacketAadFields
  ): Promise<{
    ciphertext: string;
    iv: string;
    algorithm: string;
    verified: boolean;
  }> {
    const crypto = getWebCrypto();
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(payload));
    const aad = buildPacketAad(aadFields);

    // Fresh 12-byte IV
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        additionalData: aad as BufferSource,
        tagLength: 128 // 128-bit authentication tag covering ciphertext AND AAD
      },
      key,
      plaintext
    );

    const ciphertextHex = Array.from(new Uint8Array(encryptedBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const ivHex = Array.from(iv)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      ciphertext: ciphertextHex,
      iv: ivHex,
      algorithm: 'AES-GCM-256 (AAD-Authenticated)',
      verified: true
    };
  }

  /**
   * Decrypt an SOS packet payload with an E2EE AES-GCM-256 key.
   * Reconstructs canonical AAD from the immutable metadata (id, senderId, recipientId, createdAt)
   * and verifies that the recipient matches expectedRecipientId.
   */
  async decryptSosPacketPayload(
    ciphertextHex: string,
    ivHex: string,
    key: CryptoKey,
    aadFields: PacketAadFields,
    expectedRecipientId?: string
  ): Promise<Record<string, unknown> | null> {
    try {
      // 1. Wrong recipient verification
      if (expectedRecipientId && aadFields.recipientId !== expectedRecipientId) {
        return null;
      }

      // 2. Format validation
      if (!ciphertextHex || typeof ciphertextHex !== 'string' || !ivHex || typeof ivHex !== 'string') {
        return null;
      }
      if (ciphertextHex.length % 2 !== 0 || ivHex.length !== 24) {
        return null;
      }
      if (!/^[0-9a-fA-F]+$/.test(ciphertextHex) || !/^[0-9a-fA-F]+$/.test(ivHex)) {
        return null;
      }

      const crypto = getWebCrypto();
      const ciphertextBytes = new Uint8Array(
        ciphertextHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );
      const ivBytes = new Uint8Array(
        ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );

      // Reconstruct identical canonical AAD
      const aad = buildPacketAad(aadFields);

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBytes.buffer as ArrayBuffer,
          additionalData: aad as BufferSource,
          tagLength: 128
        },
        key,
        ciphertextBytes.buffer as ArrayBuffer
      );

      const decoder = new TextDecoder();
      const plaintext = decoder.decode(decryptedBuffer);
      return JSON.parse(plaintext);
    } catch {
      // Silently fail on authentication tag mismatch, tampered AAD, or wrong key.
      return null;
    }
  }

  /**
   * Secure Receive Pipeline:
   * 1. Basic / Recipient validation
   * 2. Replay & freshness check (atomic check-and-record)
   * 3. AAD + AES-GCM-256 decryption & authentication
   */
  async verifyAndDecryptSosPacket(
    packet: SosPacket,
    key: CryptoKey,
    expectedRecipientId: string,
    replayService: ReplayProtectionService = replayProtectionService,
    options?: ReplayProtectionOptions
  ): Promise<{
    success: boolean;
    status: ReplayCheckResult | 'REJECT_AUTH_FAILED' | 'REJECT_WRONG_RECIPIENT';
    payload: Record<string, unknown> | null;
  }> {
    // 1. Recipient check
    if (!packet.recipientId || packet.recipientId !== expectedRecipientId) {
      return { success: false, status: 'REJECT_WRONG_RECIPIENT', payload: null };
    }

    // 2. Replay & Freshness check (atomic check-and-record to prevent race conditions)
    const replayStatus = replayService.checkAndRecord(packet, options);
    if (replayStatus !== 'ACCEPT') {
      return { success: false, status: replayStatus, payload: null };
    }

    // 3. AAD + AES-GCM Authentication & Decryption
    const aadFields: PacketAadFields = {
      id: packet.id,
      senderId: packet.senderId,
      recipientId: packet.recipientId,
      createdAt: packet.createdAt
    };

    const decrypted = await this.decryptSosPacketPayload(
      packet.encryptedPayload,
      packet.iv,
      key,
      aadFields,
      expectedRecipientId
    );

    if (!decrypted) {
      return { success: false, status: 'REJECT_AUTH_FAILED', payload: null };
    }

    return { success: true, status: 'ACCEPT', payload: decrypted };
  }

  /* ====================================================================
   * 1b. AUTHENTICATED ACK (ECDH -> HKDF ACK context -> AES-GCM-256 + AAD)
   * ==================================================================== */

  /**
   * Derives a directional ACK AES-GCM-256 key via the existing ECDH+HKDF pipeline.
   * Info is domain-separated from SOS E2E keys (DEFAULT_HKDF_INFO).
   */
  async deriveDirectionalAckKey(
    peerEcdhPublicKeyHex: string,
    fromDeviceId: string,
    toDeviceId: string
  ): Promise<CryptoKey> {
    return await this.deriveSharedKey(peerEcdhPublicKeyHex, {
      info: buildAckHkdfInfo(fromDeviceId, toDeviceId)
    });
  }

  async encryptAckPayload(
    payload: Record<string, unknown>,
    key: CryptoKey,
    aadFields: AckAadFields
  ): Promise<{
    ciphertext: string;
    iv: string;
    algorithm: string;
    verified: boolean;
  }> {
    const crypto = getWebCrypto();
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(payload));
    const aad = buildAckAad(aadFields);

    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        additionalData: aad as BufferSource,
        tagLength: 128
      },
      key,
      plaintext
    );

    const ciphertextHex = Array.from(new Uint8Array(encryptedBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const ivHex = Array.from(iv)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      ciphertext: ciphertextHex,
      iv: ivHex,
      algorithm: 'AES-GCM-256 (ACK-AAD-Authenticated)',
      verified: true
    };
  }

  async decryptAckPayload(
    ciphertextHex: string,
    ivHex: string,
    key: CryptoKey,
    aadFields: AckAadFields,
    expectedRecipientId?: string
  ): Promise<Record<string, unknown> | null> {
    try {
      if (expectedRecipientId && aadFields.recipientId !== expectedRecipientId) {
        return null;
      }
      if (!ciphertextHex || typeof ciphertextHex !== 'string' || !ivHex || typeof ivHex !== 'string') {
        return null;
      }
      if (ciphertextHex.length % 2 !== 0 || ivHex.length !== 24) {
        return null;
      }
      if (!/^[0-9a-fA-F]+$/.test(ciphertextHex) || !/^[0-9a-fA-F]+$/.test(ivHex)) {
        return null;
      }

      const crypto = getWebCrypto();
      const ciphertextBytes = new Uint8Array(
        ciphertextHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );
      const ivBytes = new Uint8Array(
        ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );
      const aad = buildAckAad(aadFields);

      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBytes.buffer as ArrayBuffer,
          additionalData: aad as BufferSource,
          tagLength: 128
        },
        key,
        ciphertextBytes.buffer as ArrayBuffer
      );

      const decoder = new TextDecoder();
      return JSON.parse(decoder.decode(decryptedBuffer));
    } catch {
      return null;
    }
  }

  generateAckId(): string {
    const crypto = getWebCrypto();
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
      .join('');
    return `ACK-${hex}`;
  }

  /**
   * Creates an authenticated ACK for a received SOS/message.
   * Requires the ACK recipient to be a VERIFIED paired peer.
   * Encrypts with a directional ACK HKDF context (from local device → recipient).
   */
  async createAuthenticatedAck(
    sosId: string,
    recipientDeviceId: string,
    pairing: PairingService,
    options?: {
      status?: AuthenticatedAckStatus;
      note?: string;
      createdAt?: number;
      ackId?: string;
    }
  ): Promise<AuthenticatedAckPacket | null> {
    if (!sosId || typeof sosId !== 'string' || !sosId.trim()) {
      return null;
    }
    if (!pairing.isTrustedPeer(recipientDeviceId)) {
      return null;
    }
    const peer = pairing.getPeer(recipientDeviceId);
    if (!peer) {
      return null;
    }

    const senderId = await this.getDeviceId();
    const ackId = options?.ackId || this.generateAckId();
    const createdAt = options?.createdAt ?? Date.now();
    const status: AuthenticatedAckStatus = options?.status ?? 'ACKNOWLEDGED';

    const aadFields: AckAadFields = {
      ackId,
      sosId,
      senderId,
      recipientId: recipientDeviceId,
      createdAt
    };

    const key = await this.deriveDirectionalAckKey(peer.ecdhPublicKey, senderId, recipientDeviceId);
    const innerPayload: Record<string, unknown> = {
      sosId,
      ackId,
      status,
      note: options?.note ?? ''
    };

    const encrypted = await this.encryptAckPayload(innerPayload, key, aadFields);

    return {
      kind: 'ACK',
      ackId,
      sosId,
      senderId,
      recipientId: recipientDeviceId,
      deviceId: senderId,
      createdAt,
      status,
      encryptedPayload: encrypted.ciphertext,
      iv: encrypted.iv,
      algorithm: encrypted.algorithm,
      hopCount: 0,
      ttl: 7,
      route: [senderId]
    };
  }

  /**
   * Verifies an authenticated ACK:
   * 1. Recipient match
   * 2. ACK sender is a VERIFIED paired peer
   * 3. Replay/freshness (existing ReplayProtectionService, keyed by ackId)
   * 4. Directional ACK key + ACK AAD + AES-GCM
   */
  async verifyAndDecryptAck(
    ack: AuthenticatedAckPacket,
    expectedRecipientId: string,
    pairing: PairingService,
    replayService: ReplayProtectionService = replayProtectionService,
    options?: ReplayProtectionOptions
  ): Promise<{
    success: boolean;
    status: AckVerifyStatus;
    payload: Record<string, unknown> | null;
  }> {
    if (!ack || ack.kind !== 'ACK' || !ack.recipientId || ack.recipientId !== expectedRecipientId) {
      return { success: false, status: 'REJECT_WRONG_RECIPIENT', payload: null };
    }

    if (!pairing.isTrustedPeer(ack.senderId)) {
      return { success: false, status: 'REJECT_UNTRUSTED_PEER', payload: null };
    }

    const peer = pairing.getPeer(ack.senderId);
    if (!peer) {
      return { success: false, status: 'REJECT_UNTRUSTED_PEER', payload: null };
    }

    const replayStatus = replayService.checkAndRecord(
      { id: ack.ackId, createdAt: ack.createdAt },
      options
    );
    if (replayStatus !== 'ACCEPT') {
      return { success: false, status: replayStatus, payload: null };
    }

    const aadFields: AckAadFields = {
      ackId: ack.ackId,
      sosId: ack.sosId,
      senderId: ack.senderId,
      recipientId: ack.recipientId,
      createdAt: ack.createdAt
    };

    const key = await this.deriveDirectionalAckKey(peer.ecdhPublicKey, ack.senderId, ack.recipientId);
    const decrypted = await this.decryptAckPayload(
      ack.encryptedPayload,
      ack.iv,
      key,
      aadFields,
      expectedRecipientId
    );

    if (!decrypted) {
      return { success: false, status: 'REJECT_AUTH_FAILED', payload: null };
    }

    if (typeof decrypted.sosId === 'string' && decrypted.sosId !== ack.sosId) {
      return { success: false, status: 'REJECT_AUTH_FAILED', payload: null };
    }

    return { success: true, status: 'ACCEPT', payload: decrypted };
  }

  /* ====================================================================
   * 2. DEVICE IDENTITY LAYER (PERSISTENT ASYMMETRIC ECDSA P-256)
   * ==================================================================== */

  /**
   * Create or load the persistent cryptographic device identity (ECDSA P-256).
   * Private key is stored locally in storage and kept inside the private security boundary.
   * Loaded in-memory private key is strictly non-extractable.
   */
  async loadOrCreateDeviceIdentity(): Promise<PublicDeviceIdentity> {
    if (this.#identityPromise) {
      return await this.#identityPromise;
    }

    this.#identityPromise = (async () => {
      const crypto = getWebCrypto();
      const privKeyStorage = this.#getStorageKey('lifeline_device_identity_priv');
      const pubKeyStorage = this.#getStorageKey('lifeline_device_identity_pub');

      const privRaw = getStorageItem(privKeyStorage);
      const pubRaw = getStorageItem(pubKeyStorage);

      if (privRaw && pubRaw) {
        try {
          const privJwk = JSON.parse(privRaw);
          const pubJwk = JSON.parse(pubRaw);

          // Import private key as non-extractable in memory
          const privateKey = await crypto.subtle.importKey(
            'jwk',
            privJwk,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false, // Non-extractable in memory
            ['sign']
          );

          const publicKey = await crypto.subtle.importKey(
            'jwk',
            pubJwk,
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['verify']
          );

          this.#identityKeyPair = { privateKey, publicKey };
          return await this.#buildPublicIdentity(publicKey);
        } catch {
          // Corrupted storage; fall-through to re-generate safely
        }
      }

      // Generate a new persistent ECDSA P-256 key pair
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true, // Extractable only to persist initial JWKs to local storage
        ['sign', 'verify']
      );

      const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
      const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

      setStorageItem(privKeyStorage, JSON.stringify(privJwk));
      setStorageItem(pubKeyStorage, JSON.stringify(pubJwk));

      // Re-import private key as strictly non-extractable in memory
      const nonExtractablePrivateKey = await crypto.subtle.importKey(
        'jwk',
        privJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, // NON-EXTRACTABLE
        ['sign']
      );

      this.#identityKeyPair = {
        privateKey: nonExtractablePrivateKey,
        publicKey: keyPair.publicKey
      };

      return await this.#buildPublicIdentity(keyPair.publicKey);
    })();

    return await this.#identityPromise;
  }

  async #buildPublicIdentity(publicKey: CryptoKey): Promise<PublicDeviceIdentity> {
    const crypto = getWebCrypto();
    const spkiBuffer = await crypto.subtle.exportKey('spki', publicKey);
    const pubJwk = await crypto.subtle.exportKey('jwk', publicKey);

    const publicKeyHex = Array.from(new Uint8Array(spkiBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Derive stable device ID cryptographically from SHA-256 of the public key
    const digest = await crypto.subtle.digest('SHA-256', spkiBuffer);
    const idHex = Array.from(new Uint8Array(digest))
      .slice(0, 3)
      .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
      .join('');
    const deviceId = `DEV-${idHex}`;

    // Ensure synchronous getOrCreateDeviceId returns the matching stable ID
    setStorageItem(this.#getStorageKey('lifeline_device_id'), deviceId);

    return {
      deviceId,
      algorithm: 'ECDSA-P256',
      publicKeyHex,
      publicKeyJwk: pubJwk
    };
  }

  /**
   * Returns the public identity of the device (safe to broadcast to other devices).
   * Private key is never included.
   */
  async getPublicIdentity(): Promise<PublicDeviceIdentity> {
    return await this.loadOrCreateDeviceIdentity();
  }

  /**
   * Returns the stable cryptographic device ID.
   */
  async getDeviceId(): Promise<string> {
    const identity = await this.loadOrCreateDeviceIdentity();
    return identity.deviceId;
  }

  /**
   * Check if device identity is loaded and ready.
   */
  hasDeviceIdentity(): boolean {
    return this.#identityKeyPair !== null;
  }

  /**
   * Derive the stable cryptographic device ID (e.g. DEV-A8F31C) from an ECDSA SPKI public key hex string.
   */
  static async deriveDeviceIdFromPublicKey(spkiPublicKeyHex: string): Promise<string> {
    const crypto = getWebCrypto();
    const bytes = new Uint8Array(spkiPublicKeyHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const idHex = Array.from(new Uint8Array(digest))
      .slice(0, 3)
      .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
      .join('');
    return `DEV-${idHex}`;
  }

  /**
   * Cryptographically sign an SOS packet using this device's persistent ECDSA P-256 identity key.
   * Signs the canonical AAD representation containing immutable author fields.
   * Returns the hex signature and this device's SPKI public key hex.
   */
  async signSosPacket(packet: SosPacket): Promise<{ signature: string; publicKeyHex: string }> {
    const identity = await this.loadOrCreateDeviceIdentity();
    const crypto = getWebCrypto();

    const aad = buildSosAad({
      id: packet.id,
      senderId: packet.senderId,
      deviceId: packet.deviceId,
      createdAt: packet.createdAt,
      latitude: packet.latitude,
      longitude: packet.longitude,
      priority: packet.priority,
      message: packet.message,
      encryptedPayload: packet.encryptedPayload,
      iv: packet.iv,
      recipientId: packet.recipientId
    });

    // Copy to an exact-length ArrayBuffer: subtle.sign requires a
    // BufferSource, and the encoder's view must not leak pooled bytes.
    const aadBytes = new Uint8Array(aad);
    const signatureBuffer = await crypto.subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      this.#identityKeyPair!.privateKey,
      aadBytes.buffer as ArrayBuffer
    );

    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return {
      signature: signatureHex,
      publicKeyHex: identity.publicKeyHex
    };
  }

  /**
   * Verify an incoming SOS packet's cryptographic signature and identity binding.
   * 
   * Identity & Trust Resolution:
   * 1. If trustedPublicKeyHex is explicitly passed, verify against that key.
   * 2. If pairingService is provided and packet.deviceId is known in the pairing store:
   *    - The public key MUST match the paired record's ecdsaPublicKey.
   *    - If requirePairedPeer is set, the peer must be VERIFIED.
   * 3. If packet.deviceId equals local deviceId:
   *    - Public key must match local public identity.
   * 4. If packet.deviceId matches DEV-XXXXXX format:
   *    - Verify that the public key's SHA-256 hash mathematically matches the device ID.
   * 5. Verify the ECDSA P-256 SHA-256 signature against canonical AAD.
   */
  async verifySosPacketSignature(
    packet: SosPacket,
    options?: {
      trustedPublicKeyHex?: string;
      pairingService?: PairingService;
      requirePairedPeer?: boolean;
    }
  ): Promise<{ isValid: boolean; reason: string }> {
    try {
      // 1. Check signature presence and format
      if (!packet.signature || typeof packet.signature !== 'string') {
        return { isValid: false, reason: 'MISSING_SIGNATURE' };
      }
      const sigClean = packet.signature.trim();
      if (sigClean.length < 64 || !/^[0-9a-fA-F]+$/.test(sigClean) || sigClean.length % 2 !== 0) {
        return { isValid: false, reason: 'INVALID_SIGNATURE_FORMAT' };
      }

      // 2. Resolve & Authenticate Signer Public Key
      let pubKeyHex: string | null = options?.trustedPublicKeyHex || null;

      const pairing = options?.pairingService;
      if (pairing && packet.deviceId) {
        const pairedPeer = pairing.getPeer(packet.deviceId);
        if (pairedPeer) {
          if (packet.signerPublicKey && packet.signerPublicKey.toLowerCase() !== pairedPeer.ecdsaPublicKey.toLowerCase()) {
            return { isValid: false, reason: 'DEVICE_ID_MISMATCH' };
          }
          if (options?.requirePairedPeer && pairedPeer.trustStatus !== 'VERIFIED') {
            return { isValid: false, reason: 'UNTRUSTED_PEER' };
          }
          pubKeyHex = pairedPeer.ecdsaPublicKey;
        } else if (options?.requirePairedPeer) {
          return { isValid: false, reason: 'UNKNOWN_PEER' };
        }
      }

      if (!pubKeyHex && this.#identityKeyPair) {
        const localId = await this.getDeviceId();
        if (packet.deviceId === localId) {
          const localPub = await this.getPublicIdentity();
          if (packet.signerPublicKey && packet.signerPublicKey.toLowerCase() !== localPub.publicKeyHex.toLowerCase()) {
            return { isValid: false, reason: 'DEVICE_ID_MISMATCH' };
          }
          pubKeyHex = localPub.publicKeyHex;
        }
      }

      if (!pubKeyHex) {
        if (!packet.signerPublicKey || typeof packet.signerPublicKey !== 'string') {
          return { isValid: false, reason: 'MISSING_PUBLIC_KEY' };
        }
        const keyClean = packet.signerPublicKey.trim();
        if (keyClean.length < 64 || !/^[0-9a-fA-F]+$/.test(keyClean) || keyClean.length % 2 !== 0) {
          return { isValid: false, reason: 'INVALID_KEY_FORMAT' };
        }
        pubKeyHex = keyClean;
      }

      // 3. Cryptographic binding check: deviceId MUST match SHA-256 of public key
      if (packet.deviceId && /^DEV-[0-9A-F]{6}$/i.test(packet.deviceId)) {
        const expectedDevId = await CryptoService.deriveDeviceIdFromPublicKey(pubKeyHex);
        if (expectedDevId.toUpperCase() !== packet.deviceId.toUpperCase()) {
          return { isValid: false, reason: 'DEVICE_ID_MISMATCH' };
        }
      }

      // 4. Import public key
      const crypto = getWebCrypto();
      const keyBytes = new Uint8Array(pubKeyHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
      let cryptoKey: CryptoKey;
      try {
        cryptoKey = await crypto.subtle.importKey(
          'spki',
          keyBytes.buffer as ArrayBuffer,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['verify']
        );
      } catch {
        return { isValid: false, reason: 'INVALID_KEY_FORMAT' };
      }

      // 5. Verify cryptographic signature over canonical AAD
      const aad = buildSosAad({
        id: packet.id,
        senderId: packet.senderId,
        deviceId: packet.deviceId,
        createdAt: packet.createdAt,
        latitude: packet.latitude,
        longitude: packet.longitude,
        priority: packet.priority,
        message: packet.message,
        encryptedPayload: packet.encryptedPayload,
        iv: packet.iv,
        recipientId: packet.recipientId
      });

      const sigBytes = new Uint8Array(sigClean.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
      // Exact-length copy for the same BufferSource reason as signSosPacket.
      const aadBytes = new Uint8Array(aad);
      const verified = await crypto.subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        cryptoKey,
        sigBytes.buffer as ArrayBuffer,
        aadBytes.buffer as ArrayBuffer
      );

      if (!verified) {
        return { isValid: false, reason: 'SIGNATURE_MISMATCH' };
      }

      return { isValid: true, reason: 'VALID' };
    } catch {
      return { isValid: false, reason: 'CRYPTO_ERROR' };
    }
  }

  /* ====================================================================
   * 3. KEY AGREEMENT & DERIVATION (ECDH P-256 -> HKDF-SHA-256 -> AES-GCM-256)
   * ==================================================================== */

  /**
   * Generates a dedicated ECDH P-256 key pair for key agreement.
   * Private key is non-extractable and held inside the private boundary (#ecdhKeyPair).
   * Returns only the public key as uncompressed raw hex (65 bytes = 130 hex characters).
   */
  async generateEcdhKeyPair(): Promise<string> {
    const crypto = getWebCrypto();
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false, // Private key is non-extractable in memory
      ['deriveKey', 'deriveBits']
    );

    this.#ecdhKeyPair = keyPair;
    return await this.getEcdhPublicKey();
  }

  /**
   * Returns the local device's public ECDH key as a hex string.
   * Private key is never exposed.
   */
  async getEcdhPublicKey(): Promise<string> {
    const crypto = getWebCrypto();
    if (!this.#ecdhKeyPair) {
      return await this.generateEcdhKeyPair();
    }
    const rawBuffer = await crypto.subtle.exportKey('raw', this.#ecdhKeyPair.publicKey);
    return Array.from(new Uint8Array(rawBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Imports a peer device's public ECDH key from hex representation.
   */
  async importPeerEcdhPublicKey(peerPublicKeyHex: string): Promise<CryptoKey> {
    if (!peerPublicKeyHex || typeof peerPublicKeyHex !== 'string' || peerPublicKeyHex.length % 2 !== 0) {
      throw new Error('Invalid peer public ECDH key format');
    }
    const crypto = getWebCrypto();
    const bytes = new Uint8Array(
      peerPublicKeyHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16))
    );
    return await crypto.subtle.importKey(
      'raw',
      bytes.buffer as ArrayBuffer,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );
  }

  /**
   * Derives a shared symmetric AES-GCM-256 key using:
   *   Local Private ECDH (P-256) + Peer Public ECDH (P-256)
   *   ↓
   *   HKDF-SHA-256 (Extract & Expand with info: "LIfeliNE-M4-E2E-v1")
   *   ↓
   *   256-bit AES-GCM Key (non-extractable)
   * 
   * Raw ECDH secret is never exposed outside the cryptographic boundary.
   */
  async deriveSharedKey(
    peerPublicKeyHex: string,
    options?: HkdfDerivationOptions
  ): Promise<CryptoKey> {
    const crypto = getWebCrypto();
    if (!this.#ecdhKeyPair) {
      await this.generateEcdhKeyPair();
    }
    const peerPublicKey = await this.importPeerEcdhPublicKey(peerPublicKeyHex);

    // 1. Derive intermediate non-extractable HKDF master key from ECDH
    const hkdfKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: peerPublicKey },
      this.#ecdhKeyPair!.privateKey,
      { name: 'HKDF' },
      false, // HKDF master key is non-extractable
      ['deriveKey', 'deriveBits']
    );

    // Format info and salt
    const infoBytes = typeof options?.info === 'string'
      ? new TextEncoder().encode(options.info)
      : options?.info || new TextEncoder().encode(DEFAULT_HKDF_INFO);

    const saltBytes = options?.salt || DEFAULT_HKDF_SALT;

    // 2. Expand via HKDF-SHA-256 into a 256-bit non-extractable AES-GCM key
    return await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: saltBytes as BufferSource,
        info: infoBytes as BufferSource
      },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false, // Derived AES-GCM key is strictly non-extractable
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Computes a SHA-256 verification fingerprint of the derived HKDF bits.
   * Used to confirm cryptographic equivalence between devices without exposing secret material.
   */
  async deriveSharedSecretFingerprint(
    peerPublicKeyHex: string,
    options?: HkdfDerivationOptions
  ): Promise<string> {
    const crypto = getWebCrypto();
    if (!this.#ecdhKeyPair) {
      await this.generateEcdhKeyPair();
    }
    const peerPublicKey = await this.importPeerEcdhPublicKey(peerPublicKeyHex);

    const hkdfKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: peerPublicKey },
      this.#ecdhKeyPair!.privateKey,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );

    const infoBytes = typeof options?.info === 'string'
      ? new TextEncoder().encode(options.info)
      : options?.info || new TextEncoder().encode(DEFAULT_HKDF_INFO);

    const saltBytes = options?.salt || DEFAULT_HKDF_SALT;

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: saltBytes as BufferSource,
        info: infoBytes as BufferSource
      },
      hkdfKey,
      256 // 256 bits = 32 bytes
    );

    const digest = await crypto.subtle.digest('SHA-256', derivedBits);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /* ====================================================================
   * 4. ID GENERATION & DEVICE ID COMPATIBILITY
   * ==================================================================== */

  private getRegisteredSosIds(): Set<string> {
    try {
      const raw = getStorageItem(this.#getStorageKey('lifeline_registered_sos_ids'));
      if (raw) {
        return new Set(JSON.parse(raw));
      }
    } catch {
      // ignore
    }
    return new Set<string>();
  }

  private registerSosId(id: string): void {
    const ids = this.getRegisteredSosIds();
    ids.add(id);
    try {
      setStorageItem(this.#getStorageKey('lifeline_registered_sos_ids'), JSON.stringify(Array.from(ids)));
    } catch {
      // ignore
    }
  }

  /**
   * Generates a globally unique, non-reusable SOS ID (e.g. "SOS-8F72A91C").
   */
  generateSosId(): string {
    const crypto = getWebCrypto();
    const registered = this.getRegisteredSosIds();
    let id = '';
    let attempts = 0;

    do {
      const bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
      const hex = Array.from(bytes)
        .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
        .join('');
      id = `SOS-${hex}`;
      attempts++;
    } while (registered.has(id) && attempts < 100);

    this.registerSosId(id);
    return id;
  }

  /**
   * Synchronous app Device ID getter for backwards-compatibility with React state.
   */
  getOrCreateDeviceId(): string {
    const saved = getStorageItem(this.#getStorageKey('lifeline_device_id'));
    if (saved) return saved;

    const crypto = getWebCrypto();
    const bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
      .join('');
    const newId = `DEV-${hex}`;
    setStorageItem(this.#getStorageKey('lifeline_device_id'), newId);
    return newId;
  }
}

export const cryptoService = new CryptoService();
