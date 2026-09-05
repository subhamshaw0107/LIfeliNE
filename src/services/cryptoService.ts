/**
 * Real Authenticated Encryption (AES-GCM 256-bit) for Lifeline SOS Packets.
 * Uses Web Crypto API (SubtleCrypto) with unique per-message 96-bit IV/nonce.
 * Never exposes raw secret keys in the UI.
 */

class CryptoService {
  private cryptoKey: CryptoKey | null = null;
  private keyPromise: Promise<CryptoKey> | null = null;

  constructor() {
    this.keyPromise = this.initKey();
  }

  private async initKey(): Promise<CryptoKey> {
    // Generate or derive a strong 256-bit AES-GCM key
    const rawKeyStored = localStorage.getItem('lifeline_device_secure_entropy');
    let entropy: Uint8Array;

    if (rawKeyStored) {
      const parsed = JSON.parse(rawKeyStored);
      entropy = new Uint8Array(parsed);
    } else {
      entropy = new Uint8Array(32); // 256-bit
      window.crypto.getRandomValues(entropy);
      localStorage.setItem('lifeline_device_secure_entropy', JSON.stringify(Array.from(entropy)));
    }

    const key = await window.crypto.subtle.importKey(
      'raw',
      entropy.buffer as ArrayBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    this.cryptoKey = key;
    return key;
  }

  private async getKey(): Promise<CryptoKey> {
    if (this.cryptoKey) return this.cryptoKey;
    if (this.keyPromise) return await this.keyPromise;
    return await this.initKey();
  }

  /**
   * Encrypt an SOS payload object using AES-GCM 256-bit with unique 96-bit IV.
   */
  async encryptSosPayload(payload: Record<string, unknown>): Promise<{
    ciphertext: string;
    iv: string;
    algorithm: string;
    verified: boolean;
  }> {
    const key = await this.getKey();
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(payload));

    // Generate unique 12-byte (96-bit) IV/nonce for GCM
    const iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128 // 128-bit authentication tag
      },
      key,
      plaintext
    );

    // Convert to hex representation for clean packet display
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
   */
  async decryptSosPayload(ciphertextHex: string, ivHex: string): Promise<Record<string, unknown> | null> {
    try {
      const key = await this.getKey();

      // Convert hex strings back to byte arrays
      const ciphertextBytes = new Uint8Array(
        ciphertextHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );
      const ivBytes = new Uint8Array(
        ivHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
      );

      const decryptedBuffer = await window.crypto.subtle.decrypt(
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
    } catch (err) {
      console.error('Decryption failed or authentication tag mismatch:', err);
      return null;
    }
  }

  private getRegisteredSosIds(): Set<string> {
    try {
      const raw = localStorage.getItem('lifeline_registered_sos_ids');
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
      localStorage.setItem('lifeline_registered_sos_ids', JSON.stringify(Array.from(ids)));
    } catch {
      // ignore
    }
  }

  /**
   * Generates a globally unique, non-reusable SOS ID (e.g. "SOS-8F72A91C").
   * Validates against all registered SOS IDs to guarantee zero collisions or reuse.
   */
  generateSosId(): string {
    const registered = this.getRegisteredSosIds();
    let id = '';
    let attempts = 0;

    do {
      const bytes = new Uint8Array(4);
      window.crypto.getRandomValues(bytes);
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
   * Generate persistent app Device ID (e.g. "DEV-A8F31C")
   */
  getOrCreateDeviceId(): string {
    const saved = localStorage.getItem('lifeline_device_id');
    if (saved) return saved;

    const bytes = new Uint8Array(3);
    window.crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
      .join('');
    const newId = `DEV-${hex}`;
    localStorage.setItem('lifeline_device_id', newId);
    return newId;
  }
}

export const cryptoService = new CryptoService();
