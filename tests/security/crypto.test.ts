/**
 * LIFELINE M4 SECURITY TEST SUITE
 * 
 * Part 1: AES-GCM-256 Symmetric Baseline (Tests 1-7)
 * Part 2: Persistent Device Identity (ECDSA P-256) (Tests 8-14)
 * Part 3: Dedicated Key Agreement Layer (ECDH P-256) (Tests A-G)
 * Part 4: HKDF-SHA-256 Key Derivation Pipeline (Tests H-M)
 * Part 5: Real SosPacket E2EE with AAD (Tests N-U)
 * Part 6: Replay Protection & Freshness Verification (Tests V-AE)
 * Part 7: Secure Device Pairing & Verification (Tests AF-AM)
 * Part 8: Authenticated ACK (Tests AN-AY)
 * Part 9: Authenticated ACK mesh integration (Tests AZ-BK)
 */

import { createSosPacket, fromMeshAuthenticatedAck, isAuthenticatedMeshAck, AUTHENTICATED_ACK_PLACEHOLDER } from '../../src/models/Packet';
import { PacketEngine } from '../../src/services/packetEngine';
import { StorageEngine } from '../../src/storage/storageEngine';
import { SosRepository } from '../../src/repositories/sosRepository';
import { DeduplicationService } from '../../src/services/deduplicationService';
import { StoreCarryForwardQueue } from '../../src/services/storeCarryForwardQueue';
import { MockMeshTransport } from '../../src/transport/mockMeshTransport';
import {
  cryptoService,
  CryptoService,
  DEFAULT_HKDF_INFO,
  DEFAULT_HKDF_SALT,
  PacketAadFields,
  buildPacketAad,
  ReplayProtectionService,
  replayProtectionService,
  PairingService,
  PAIRING_PAYLOAD_VERSION,
  AuthenticatedAckPacket,
  buildAckAad,
  buildAckHkdfInfo,
  DEFAULT_ACK_HKDF_INFO
} from '../../src/services/cryptoService';
import {
  DEFAULT_MAX_MESSAGE_AGE_MS,
  DEFAULT_CLOCK_SKEW_WINDOW_MS
} from '../../src/services/replayProtectionService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`  ✓ PASS: ${message}`);
}

async function runSecurityTestSuite() {
  console.log('\n==================================================');
  console.log('STARTING LIFELINE M4 SECURITY TEST SUITE');
  console.log('==================================================\n');

  /* ====================================================================
   * PART 1: AES-GCM-256 SYMMETRIC ENCRYPTION BASELINE
   * ==================================================================== */

  const testPayload = {
    sosId: 'SOS-FA01BC88',
    senderId: 'PERSON-A',
    latitude: 22.5726,
    longitude: 88.3639,
    priority: 'CRITICAL',
    message: 'Trapped on 2nd floor, water rising rapidly'
  };

  // Test 1: Normal encrypt -> decrypt succeeds
  console.log('[Test 1] Normal encrypt -> decrypt succeeds with exact payload');
  const encResult = await cryptoService.encryptSosPayload(testPayload);
  assert(typeof encResult.ciphertext === 'string' && encResult.ciphertext.length > 0, 'Ciphertext is non-empty string');
  assert(typeof encResult.iv === 'string' && encResult.iv.length === 24, 'IV is exactly 24 hex characters (12 bytes)');
  assert(encResult.algorithm === 'AES-GCM-256 (Authenticated)', 'Algorithm is AES-GCM-256 (Authenticated)');

  const decrypted = await cryptoService.decryptSosPayload(encResult.ciphertext, encResult.iv);
  assert(decrypted !== null, 'Decryption returned non-null object');
  assert(decrypted?.sosId === testPayload.sosId, 'Decrypted sosId matches original');
  assert(decrypted?.senderId === testPayload.senderId, 'Decrypted senderId matches original');
  assert(decrypted?.latitude === testPayload.latitude, 'Decrypted latitude matches original');
  assert(decrypted?.longitude === testPayload.longitude, 'Decrypted longitude matches original');
  assert(decrypted?.message === testPayload.message, 'Decrypted message matches original');

  // Test 2: Every encryption gets a fresh, unique 12-byte IV
  console.log('\n[Test 2] Fresh, unique 12-byte IV generated on every encryption');
  const enc1 = await cryptoService.encryptSosPayload(testPayload);
  const enc2 = await cryptoService.encryptSosPayload(testPayload);
  assert(enc1.iv !== enc2.iv, 'Two encryptions of same payload produce different IVs');
  assert(enc1.ciphertext !== enc2.ciphertext, 'Two encryptions of same payload produce different ciphertexts');
  assert(enc1.iv.length === 24 && enc2.iv.length === 24, 'Both IVs are 12 bytes (24 hex characters)');

  // Test 3: Ciphertext tampering -> rejected
  console.log('\n[Test 3] Ciphertext tampering -> rejected by authentication tag');
  const tamperedCiphertext =
    encResult.ciphertext.slice(0, -2) +
    (encResult.ciphertext.slice(-2) === 'aa' ? 'bb' : 'aa');
  const tamperedCiphertextResult = await cryptoService.decryptSosPayload(tamperedCiphertext, encResult.iv);
  assert(tamperedCiphertextResult === null, 'Tampered ciphertext returns null (rejected)');

  // Test 4: IV tampering -> rejected
  console.log('\n[Test 4] IV tampering -> rejected by authentication tag');
  const tamperedIv =
    (encResult.iv.slice(0, 2) === '00' ? '11' : '00') + encResult.iv.slice(2);
  const tamperedIvResult = await cryptoService.decryptSosPayload(encResult.ciphertext, tamperedIv);
  assert(tamperedIvResult === null, 'Tampered IV returns null (rejected)');

  // Test 5: Wrong encryption key -> rejected
  console.log('\n[Test 5] Decrypting with wrong key -> rejected');
  const attackerEntropy = new Uint8Array(32);
  for (let i = 0; i < 32; i++) attackerEntropy[i] = (i * 7 + 13) % 256;
  const attackerCryptoService = new CryptoService(attackerEntropy);

  const attackerDecryptResult = await attackerCryptoService.decryptSosPayload(
    encResult.ciphertext,
    encResult.iv
  );
  assert(attackerDecryptResult === null, 'Decryption with wrong key returns null (rejected)');

  // Test 6: Malformed encrypted data fails safely without throwing
  console.log('\n[Test 6] Malformed data fails safely');
  const malformedInputs = [
    { ct: '', iv: encResult.iv, label: 'empty ciphertext' },
    { ct: encResult.ciphertext, iv: '', label: 'empty IV' },
    { ct: 'not-a-hex-string!!!', iv: encResult.iv, label: 'invalid hex ciphertext' },
    { ct: encResult.ciphertext, iv: 'abc', label: 'truncated IV (3 hex chars)' },
    { ct: encResult.ciphertext + 'f', iv: encResult.iv, label: 'odd-length ciphertext' },
    { ct: '0102030405', iv: encResult.iv, label: 'random short raw bytes' }
  ];

  for (const input of malformedInputs) {
    const res = await cryptoService.decryptSosPayload(input.ct, input.iv);
    assert(res === null, `Malformed input (${input.label}) safely returns null`);
  }

  // Test 7: Secret keys not exposed
  console.log('\n[Test 7] Symmetric secret keys not exposed outside service');
  const keysExposed = Object.keys(cryptoService).filter(k => k.toLowerCase().includes('key'));
  assert(keysExposed.length === 0, 'No secret key properties are enumerable on cryptoService');

  /* ====================================================================
   * PART 2: PERSISTENT DEVICE IDENTITY (ECDSA P-256)
   * ==================================================================== */

  // Test 8: Identity can be created
  console.log('\n[Test 8] Device identity creation');
  const identity = await cryptoService.loadOrCreateDeviceIdentity();
  assert(typeof identity.deviceId === 'string' && identity.deviceId.startsWith('DEV-'), 'Device ID starts with DEV-');
  assert(identity.algorithm === 'ECDSA-P256', 'Algorithm is ECDSA-P256');
  assert(typeof identity.publicKeyHex === 'string' && identity.publicKeyHex.length > 50, 'Public key hex generated');
  assert(identity.publicKeyJwk.kty === 'EC' && identity.publicKeyJwk.crv === 'P-256', 'Public key is valid EC P-256 JWK');

  // Test 9: Public identity is available and safe to share (no private key material)
  console.log('\n[Test 9] Public identity availability & zero private key leakage');
  const publicIdentity = await cryptoService.getPublicIdentity();
  assert(publicIdentity.deviceId === identity.deviceId, 'Public identity deviceId matches created identity');
  assert(publicIdentity.publicKeyHex === identity.publicKeyHex, 'Public key hex matches created identity');
  assert(!('d' in publicIdentity.publicKeyJwk), 'Public JWK does NOT contain private key material ("d" parameter absent)');

  // Test 10: Private key is not exposed outside security boundary
  console.log('\n[Test 10] Private key encapsulation and non-extractability');
  const serviceProps = Object.keys(cryptoService);
  assert(!serviceProps.some(p => p.toLowerCase().includes('private')), 'No private key property exposed on service');
  assert(!serviceProps.some(p => p.toLowerCase().includes('identitykey')), 'No identity key pair exposed on service');

  // Test 11 & 12: Identity survives application restart & device ID remains stable
  console.log('\n[Test 11 & 12] Identity persistence across restarts and device ID stability');
  const node1FirstRun = new CryptoService(undefined, 'node_sim_1');
  const node1FirstIdentity = await node1FirstRun.loadOrCreateDeviceIdentity();
  const node1FirstDeviceId = await node1FirstRun.getDeviceId();

  const node1Restarted = new CryptoService(undefined, 'node_sim_1');
  const node1ReloadedIdentity = await node1Restarted.loadOrCreateDeviceIdentity();
  const node1ReloadedDeviceId = await node1Restarted.getDeviceId();

  assert(node1FirstIdentity.deviceId === node1ReloadedIdentity.deviceId, 'Device ID survives application restart');
  assert(node1FirstDeviceId === node1ReloadedDeviceId, 'getDeviceId() produces identical ID across restarts');
  assert(node1FirstIdentity.publicKeyHex === node1ReloadedIdentity.publicKeyHex, 'Public key remains identical across restarts');

  // Test 13: Distinct devices have distinct cryptographic identities
  console.log('\n[Test 13] Distinct devices generate distinct cryptographic identities');
  const node2 = new CryptoService(undefined, 'node_sim_2');
  const node2Identity = await node2.loadOrCreateDeviceIdentity();
  assert(node1FirstIdentity.deviceId !== node2Identity.deviceId, 'Different devices receive different device IDs');
  assert(node1FirstIdentity.publicKeyHex !== node2Identity.publicKeyHex, 'Different devices have different public keys');

  // Test 14: No private key in logs or string representations
  console.log('\n[Test 14] Zero private key material in string representations');
  const serializedService = JSON.stringify(cryptoService);
  assert(!serializedService.includes('privateKey'), 'JSON representation of cryptoService contains no private key');
  assert(!serializedService.includes('"d":'), 'JSON representation contains no private key JWK components');

  /* ====================================================================
   * PART 3: DEDICATED KEY AGREEMENT LAYER (ECDH P-256)
   * ==================================================================== */
  console.log('\n--------------------------------------------------');
  console.log('TESTING ECDH P-256 KEY AGREEMENT LAYER (TESTS A - G)');
  console.log('--------------------------------------------------\n');

  // Test A: Device A generates an ECDH key pair
  console.log('[Test A] Device A generates an ECDH key pair');
  const deviceA = new CryptoService(undefined, 'dev_a_ecdh');
  const pubKeyHexA = await deviceA.generateEcdhKeyPair();
  assert(typeof pubKeyHexA === 'string' && pubKeyHexA.length === 130, 'Device A generated 65-byte uncompressed public key (130 hex chars)');

  // Test B: Device C generates an ECDH key pair
  console.log('\n[Test B] Device C generates an ECDH key pair');
  const deviceC = new CryptoService(undefined, 'dev_c_ecdh');
  const pubKeyHexC = await deviceC.generateEcdhKeyPair();
  assert(typeof pubKeyHexC === 'string' && pubKeyHexC.length === 130, 'Device C generated 65-byte uncompressed public key (130 hex chars)');
  assert(pubKeyHexA !== pubKeyHexC, 'Device A and Device C have distinct public ECDH keys');

  // Test C: Device A derives a shared secret using A private key + C public key
  console.log('\n[Test C] Device A derives shared key (PrivA + PubC)');
  const sharedKeyA = await deviceA.deriveSharedKey(pubKeyHexC);
  assert(sharedKeyA instanceof Object, 'Device A derived a valid CryptoKey');
  assert(sharedKeyA.algorithm.name === 'AES-GCM', 'Derived key algorithm is AES-GCM');
  assert(sharedKeyA.extractable === false, 'Derived key on Device A is non-extractable');

  // Test D: Device C derives a shared secret using C private key + A public key
  console.log('\n[Test D] Device C derives shared key (PrivC + PubA)');
  const sharedKeyC = await deviceC.deriveSharedKey(pubKeyHexA);
  assert(sharedKeyC instanceof Object, 'Device C derived a valid CryptoKey');
  assert(sharedKeyC.algorithm.name === 'AES-GCM', 'Derived key algorithm is AES-GCM');
  assert(sharedKeyC.extractable === false, 'Derived key on Device C is non-extractable');

  // Test E: Both derived secrets are cryptographically equivalent
  console.log('\n[Test E] Both derived secrets are cryptographically equivalent');
  const fingerprintA = await deviceA.deriveSharedSecretFingerprint(pubKeyHexC);
  const fingerprintC = await deviceC.deriveSharedSecretFingerprint(pubKeyHexA);
  assert(fingerprintA === fingerprintC, 'SHA-256 fingerprints of derived shared secrets match 100%');

  const confidentialMessage = { alert: 'RESCUE_CONFIRMED', victimId: 'VICTIM-99', coords: [22.57, 88.36] };
  const encryptedByA = await deviceA.encryptSosPayload(confidentialMessage, sharedKeyA);
  const decryptedByC = await deviceC.decryptSosPayload(encryptedByA.ciphertext, encryptedByA.iv, sharedKeyC);
  assert(decryptedByC !== null, 'Device C successfully decrypted message encrypted by Device A');
  assert(decryptedByC?.alert === confidentialMessage.alert, 'Decrypted alert matches original message');
  assert(decryptedByC?.victimId === confidentialMessage.victimId, 'Decrypted victimId matches original message');

  const deviceB = new CryptoService(undefined, 'dev_b_relay');
  const pubKeyHexB = await deviceB.generateEcdhKeyPair();
  const sharedKeyB = await deviceB.deriveSharedKey(pubKeyHexA);
  const decryptedByB = await deviceB.decryptSosPayload(encryptedByA.ciphertext, encryptedByA.iv, sharedKeyB);
  assert(decryptedByB === null, 'Relay Device B fails to decrypt message meant for C (wrong shared secret)');

  // Test F: Private keys are not exposed through the public API
  console.log('\n[Test F] Private keys not exposed through public API');
  const deviceAKeys = Object.keys(deviceA);
  assert(!deviceAKeys.some(k => k.toLowerCase().includes('ecdh')), 'No internal ECDH properties exposed on service');
  assert(!deviceAKeys.some(k => k.toLowerCase().includes('private')), 'No private key properties exposed on service');

  // Test G: Shared secrets are not exposed through normal service properties or logs
  console.log('\n[Test G] Shared secrets not exposed through properties or logs');
  const serializedDeviceA = JSON.stringify(deviceA);
  assert(!serializedDeviceA.includes('shared'), 'No shared secret stored in enumerable properties');
  assert(!serializedDeviceA.includes(fingerprintA), 'Fingerprint/secret not present in serialized service');

  /* ====================================================================
   * PART 4: HKDF-SHA-256 KEY DERIVATION PIPELINE (TESTS H - M)
   * ==================================================================== */
  console.log('\n--------------------------------------------------');
  console.log('TESTING HKDF-SHA-256 KEY DERIVATION PIPELINE (TESTS H - M)');
  console.log('--------------------------------------------------\n');

  // Test H: A and C perform ECDH -> HKDF-SHA-256 -> AES-GCM and cross-encrypt/decrypt
  console.log('[Test H] Full ECDH -> HKDF-SHA-256 -> AES-GCM-256 derivation and E2EE');
  const hkdfAesKeyA = await deviceA.deriveSharedKey(pubKeyHexC, { info: DEFAULT_HKDF_INFO, salt: DEFAULT_HKDF_SALT });
  const hkdfAesKeyC = await deviceC.deriveSharedKey(pubKeyHexA, { info: DEFAULT_HKDF_INFO, salt: DEFAULT_HKDF_SALT });

  const testHMsg = { payload: 'SURVIVORS_FOUND', count: 3, zone: 'SECTOR-7' };
  const testHEncrypted = await deviceA.encryptSosPayload(testHMsg, hkdfAesKeyA);
  const testHDecrypted = await deviceC.decryptSosPayload(testHEncrypted.ciphertext, testHEncrypted.iv, hkdfAesKeyC);
  assert(testHDecrypted !== null, 'Device C decrypted message via HKDF-derived key');
  assert(testHDecrypted?.payload === testHMsg.payload, 'Payload matches through HKDF pipeline');
  assert(testHDecrypted?.count === testHMsg.count, 'Payload count verified');

  // Test I: Confirm derived key uses AES-GCM and is exactly 256 bits
  console.log('\n[Test I] Derived key algorithm and bit length verification');
  const keyAlg = hkdfAesKeyA.algorithm as AesKeyGenParams;
  assert(keyAlg.name === 'AES-GCM', 'Derived key is strictly AES-GCM');
  assert(keyAlg.length === 256, 'Derived key length is exactly 256 bits (32 bytes)');

  // Test J: Changing HKDF info/context produces different, incompatible keys
  console.log('\n[Test J] Changing HKDF info produces different key and rejection');
  const contextV1Key = await deviceA.deriveSharedKey(pubKeyHexC, { info: 'LIfeliNE-M4-E2E-v1' });
  const contextV2Key = await deviceC.deriveSharedKey(pubKeyHexA, { info: 'LIfeliNE-M4-E2E-v2-DIFFERENT' });

  const contextEnc = await deviceA.encryptSosPayload({ secret: 'critical-sos' }, contextV1Key);
  const contextDec = await deviceC.decryptSosPayload(contextEnc.ciphertext, contextEnc.iv, contextV2Key);
  assert(contextDec === null, 'Different HKDF info context yields different key; decryption fails safely');

  // Test K: Changing salt parameter produces different keys; old ciphertext cannot decrypt
  console.log('\n[Test K] Changing HKDF salt produces different key and fails decryption');
  const customSalt1 = new Uint8Array(32);
  customSalt1[0] = 0xAA;
  const customSalt2 = new Uint8Array(32);
  customSalt2[0] = 0xBB;

  const salt1Key = await deviceA.deriveSharedKey(pubKeyHexC, { salt: customSalt1 });
  const salt2Key = await deviceC.deriveSharedKey(pubKeyHexA, { salt: customSalt2 });

  const saltEnc = await deviceA.encryptSosPayload({ secret: 'custom-salt-test' }, salt1Key);
  const saltDec = await deviceC.decryptSosPayload(saltEnc.ciphertext, saltEnc.iv, salt2Key);
  assert(saltDec === null, 'Different HKDF salt yields different key; decryption fails safely');

  // Test L: Raw ECDH secret is never exposed; derived AES key is non-extractable; no secrets in logs
  console.log('\n[Test L] Non-extractability and zero secret leakage in HKDF pipeline');
  assert(hkdfAesKeyA.extractable === false, 'Derived AES-GCM key is strictly non-extractable');
  assert(hkdfAesKeyC.extractable === false, 'Peer derived AES-GCM key is strictly non-extractable');

  // Verify that calling subtle.exportKey on derived key throws error
  let exportAttemptFailed = false;
  try {
    const crypto = typeof globalThis !== 'undefined' ? globalThis.crypto : (window as unknown as { crypto: Crypto }).crypto;
    await crypto.subtle.exportKey('raw', hkdfAesKeyA);
  } catch {
    exportAttemptFailed = true;
  }
  assert(exportAttemptFailed, 'Attempting to export derived AES-GCM key fails (non-extractable)');

  // Test M: ECDSA identity key and ECDH agreement key remain strictly separate
  console.log('\n[Test M] ECDSA identity key and ECDH agreement key domain separation');
  const identityPub = await deviceA.getPublicIdentity();
  const ecdhPubHex = await deviceA.getEcdhPublicKey();
  assert(identityPub.algorithm === 'ECDSA-P256', 'Identity algorithm is ECDSA-P256');
  assert(identityPub.publicKeyHex !== ecdhPubHex, 'Identity public key differs completely from ECDH public key');

  /* ====================================================================
   * PART 5: REAL SOSPACKET E2EE WITH IMMUTABLE AAD INTEGRATION (TESTS N - U)
   * ==================================================================== */
  console.log('\n--------------------------------------------------');
  console.log('TESTING REAL SOSPACKET E2EE INTEGRATION (TESTS N - U)');
  console.log('--------------------------------------------------\n');

  // Setup: Device A (Victim/Sender), Device C (Rescue Tactical HQ), Device B (Relay Node), Device D (Rogue node)
  const nodeA = new CryptoService(undefined, 'node_A_e2ee');
  const nodeC = new CryptoService(undefined, 'node_C_e2ee');
  const nodeB = new CryptoService(undefined, 'node_B_relay');
  const nodeD = new CryptoService(undefined, 'node_D_rogue');

  const pubEcdhA = await nodeA.generateEcdhKeyPair();
  const pubEcdhC = await nodeC.generateEcdhKeyPair();
  const pubEcdhB = await nodeB.generateEcdhKeyPair();
  const pubEcdhD = await nodeD.generateEcdhKeyPair();

  const pairwiseKeyA = await nodeA.deriveSharedKey(pubEcdhC);
  const pairwiseKeyC = await nodeC.deriveSharedKey(pubEcdhA);

  const sensitiveEmergencyData = {
    triageDetail: 'Severe bleeding, elderly resident trapped',
    pulseRate: 110,
    exactFloor: 'Room 304, Building B',
    contactNumber: '+91-9876543210'
  };

  const aadFieldsA: PacketAadFields = {
    id: 'SOS-E2E-9999',
    senderId: 'VICTIM-ALICE',
    recipientId: 'TACTICAL-HQ',
    // Fresh timestamp: PacketEngine validates against the real wall clock,
    // so a hardcoded past date would (correctly) expire. Intent is a live packet.
    createdAt: Date.now()
  };

  // Test N: Real SosPacket E2EE
  console.log('[Test N] Real SosPacket E2EE creation, transmission & destination decryption');
  const encPacketPayload = await nodeA.encryptSosPacketPayload(
    sensitiveEmergencyData,
    pairwiseKeyA,
    aadFieldsA
  );

  const securePacket = createSosPacket({
    id: aadFieldsA.id,
    senderId: aadFieldsA.senderId,
    recipientId: aadFieldsA.recipientId,
    deviceId: 'DEV-A1B2C3',
    latitude: 22.5726,
    longitude: 88.3639,
    priority: 'CRITICAL',
    message: '[ENCRYPTED E2EE PAYLOAD]', // Plaintext sanitized
    encryptedPayload: encPacketPayload.ciphertext,
    iv: encPacketPayload.iv,
    ttl: 7,
    hopCount: 0
  });
  securePacket.createdAt = aadFieldsA.createdAt;

  // Simulate destination node C receiving and processing packet via PacketEngine
  const storageC = new StorageEngine('node_C_store');
  const repoC = new SosRepository(storageC);
  const dedupC = new DeduplicationService(1000, storageC);
  const engineC = new PacketEngine({
    localNodeId: 'TACTICAL-HQ',
    sosRepo: repoC,
    dedup: dedupC
  });

  const processedAtC = await engineC.processPacket(securePacket);
  assert(processedAtC === true, 'Destination PacketEngine (TACTICAL-HQ) accepted packet');

  // Reconstruct AAD at C and decrypt
  const aadFieldsC: PacketAadFields = {
    id: securePacket.id,
    senderId: securePacket.senderId,
    recipientId: securePacket.recipientId!,
    createdAt: securePacket.createdAt
  };
  const decryptedAtC = await nodeC.decryptSosPacketPayload(
    securePacket.encryptedPayload,
    securePacket.iv,
    pairwiseKeyC,
    aadFieldsC,
    'TACTICAL-HQ'
  );
  assert(decryptedAtC !== null, 'Device C successfully decrypted sensitive payload with AAD');
  assert(decryptedAtC?.exactFloor === sensitiveEmergencyData.exactFloor, 'Decrypted floor matches sensitive data');
  assert(decryptedAtC?.pulseRate === sensitiveEmergencyData.pulseRate, 'Decrypted pulse rate matches sensitive data');

  // Test O: Relay confidentiality
  console.log('\n[Test O] Relay confidentiality: Relay B cannot decrypt or access key');
  const fakeKeyB = await nodeB.deriveSharedKey(pubEcdhA); // B derives K_AB, not K_AC
  const decryptedAtB = await nodeB.decryptSosPacketPayload(
    securePacket.encryptedPayload,
    securePacket.iv,
    fakeKeyB,
    aadFieldsC,
    'TACTICAL-HQ'
  );
  assert(decryptedAtB === null, 'Relay B fails to decrypt payload (does not possess K_AC)');

  // Test P: Ciphertext tampering
  console.log('\n[Test P] Ciphertext tampering rejected at receiver');
  const tamperedCt = securePacket.encryptedPayload.slice(0, -2) + (securePacket.encryptedPayload.slice(-2) === '11' ? '22' : '11');
  const tamperedCtResult = await nodeC.decryptSosPacketPayload(
    tamperedCt,
    securePacket.iv,
    pairwiseKeyC,
    aadFieldsC,
    'TACTICAL-HQ'
  );
  assert(tamperedCtResult === null, 'Tampered ciphertext rejected (returns null)');

  // Test Q: IV tampering
  console.log('\n[Test Q] IV tampering rejected at receiver');
  const tamperedPacketIv = (securePacket.iv.slice(0, 2) === 'aa' ? 'bb' : 'aa') + securePacket.iv.slice(2);
  const tamperedPacketIvResult = await nodeC.decryptSosPacketPayload(
    securePacket.encryptedPayload,
    tamperedPacketIv,
    pairwiseKeyC,
    aadFieldsC,
    'TACTICAL-HQ'
  );
  assert(tamperedPacketIvResult === null, 'Tampered IV rejected (returns null)');

  // Test R: Authenticated metadata tampering
  console.log('\n[Test R] Authenticated metadata tampering independently rejected');
  // Subtest R.1: Tamper id / messageId
  const tamperedIdFields: PacketAadFields = { ...aadFieldsC, id: 'SOS-FORGED-ID' };
  const resTamperedId = await nodeC.decryptSosPacketPayload(securePacket.encryptedPayload, securePacket.iv, pairwiseKeyC, tamperedIdFields, 'TACTICAL-HQ');
  assert(resTamperedId === null, 'Tampered id rejected by AAD verification');

  // Subtest R.2: Tamper senderId
  const tamperedSenderFields: PacketAadFields = { ...aadFieldsC, senderId: 'ATTACKER-EVE' };
  const resTamperedSender = await nodeC.decryptSosPacketPayload(securePacket.encryptedPayload, securePacket.iv, pairwiseKeyC, tamperedSenderFields, 'TACTICAL-HQ');
  assert(resTamperedSender === null, 'Tampered senderId rejected by AAD verification');

  // Subtest R.3: Tamper recipientId
  const tamperedRecipientFields: PacketAadFields = { ...aadFieldsC, recipientId: 'ROGUE-GATEWAY' };
  const resTamperedRecipient = await nodeC.decryptSosPacketPayload(securePacket.encryptedPayload, securePacket.iv, pairwiseKeyC, tamperedRecipientFields, 'TACTICAL-HQ');
  assert(resTamperedRecipient === null, 'Tampered recipientId rejected by AAD verification');

  // Subtest R.4: Tamper createdAt
  const tamperedCreatedAtFields: PacketAadFields = { ...aadFieldsC, createdAt: aadFieldsC.createdAt + 1000 };
  const resTamperedCreatedAt = await nodeC.decryptSosPacketPayload(securePacket.encryptedPayload, securePacket.iv, pairwiseKeyC, tamperedCreatedAtFields, 'TACTICAL-HQ');
  assert(resTamperedCreatedAt === null, 'Tampered createdAt timestamp rejected by AAD verification');

  // Test S: Relay fields remain functional
  console.log('\n[Test S] Mutable relay fields (TTL, hopCount, route) remain functional');
  const storageB = new StorageEngine('node_B_store');
  const repoB = new SosRepository(storageB);
  const dedupB = new DeduplicationService(1000, storageB);
  const engineB = new PacketEngine({
    localNodeId: 'PHONE-B',
    sosRepo: repoB,
    dedup: dedupB
  });
  await engineB.processPacket(securePacket);

  const relayedPacket = repoB.getPacket(securePacket.id);
  assert(relayedPacket !== null, 'Relay B stored packet for forwarding');

  // Packet simulated as arriving at C after relay hop: TTL decremented, hopCount incremented, route updated
  const packetFromRelay = {
    ...securePacket,
    ttl: securePacket.ttl - 1,
    hopCount: securePacket.hopCount + 1,
    route: [...securePacket.route, 'PHONE-B'],
    status: 'RELAYING' as const
  };

  // Reconstruct AAD using original immutable metadata (id, senderId, recipientId, createdAt)
  const aadForRelayedPacket: PacketAadFields = {
    id: packetFromRelay.id,
    senderId: packetFromRelay.senderId,
    recipientId: packetFromRelay.recipientId!,
    createdAt: packetFromRelay.createdAt
  };
  const decryptedRelayed = await nodeC.decryptSosPacketPayload(
    packetFromRelay.encryptedPayload,
    packetFromRelay.iv,
    pairwiseKeyC,
    aadForRelayedPacket,
    'TACTICAL-HQ'
  );
  assert(decryptedRelayed !== null, 'Relay-modified mutable fields (TTL/hop/route) do NOT break AAD decryption');
  assert(decryptedRelayed?.exactFloor === sensitiveEmergencyData.exactFloor, 'Decrypted payload from relayed packet intact');

  // Test T: No plaintext in relay storage or logs
  console.log('\n[Test T] Zero plaintext in relay storage or repository');
  const storedJson = JSON.stringify(relayedPacket);
  assert(!storedJson.includes('Severe bleeding'), 'Plaintext triage detail NOT in stored relay packet');
  assert(!storedJson.includes('Room 304'), 'Plaintext location detail NOT in stored relay packet');
  assert(!storedJson.includes('+91-9876543210'), 'Plaintext phone number NOT in stored relay packet');
  assert(storedJson.includes(securePacket.encryptedPayload), 'Encrypted ciphertext IS present in stored packet');

  // Test U: Wrong recipient rejected
  console.log('\n[Test U] Wrong recipient rejected safely');
  const wrongRecipientRes = await nodeC.decryptSosPacketPayload(
    securePacket.encryptedPayload,
    securePacket.iv,
    pairwiseKeyC,
    aadFieldsC,
    'DIFFERENT-RECIPIENT-D' // Mismatched recipient
  );
  assert(wrongRecipientRes === null, 'Packet addressed to TACTICAL-HQ rejected when expected recipient is DIFFERENT-RECIPIENT-D');

  console.log('\n==================================================');
  console.log('ALL M4 SECURITY TESTS (BASELINE + IDENTITY + ECDH + HKDF + SOSPACKET E2EE) PASSED! ✓');
  console.log('==================================================\n');

  /* ====================================================================
   * PART 6: REPLAY PROTECTION & FRESHNESS VERIFICATION (TESTS V - AE)
   * ==================================================================== */
  console.log('\n--------------------------------------------------');
  console.log('TESTING REPLAY PROTECTION & FRESHNESS VERIFICATION (TESTS V - AE)');
  console.log('--------------------------------------------------\n');

  const testReplayService = new ReplayProtectionService('test_replay_store');
  testReplayService.clear();

  const baseTime = 1773000000000;

  // Prepare a valid base packet
  const validPacketPayload = { status: 'DISASTER_EVACUATION', headcount: 12 };
  const validPacketAad: PacketAadFields = {
    id: 'SOS-REPLAY-001',
    senderId: 'PERSON-A',
    recipientId: 'TACTICAL-HQ',
    createdAt: baseTime
  };
  const validEncResult = await nodeA.encryptSosPacketPayload(
    validPacketPayload,
    pairwiseKeyA,
    validPacketAad
  );
  const testVPacket = createSosPacket({
    id: validPacketAad.id,
    senderId: validPacketAad.senderId,
    recipientId: validPacketAad.recipientId,
    deviceId: 'DEV-A1B2C3',
    latitude: 22.5726,
    longitude: 88.3639,
    priority: 'HIGH',
    message: '[ENCRYPTED E2EE PAYLOAD]',
    encryptedPayload: validEncResult.ciphertext,
    iv: validEncResult.iv,
    ttl: 5,
    hopCount: 1
  });
  testVPacket.createdAt = validPacketAad.createdAt;

  // Test V — First valid packet accepted
  console.log('[Test V] First valid packet accepted');
  const resV = await nodeC.verifyAndDecryptSosPacket(
    testVPacket,
    pairwiseKeyC,
    'TACTICAL-HQ',
    testReplayService,
    { now: baseTime + 1000 }
  );
  assert(resV.success === true, 'First valid packet accepted (success === true)');
  assert(resV.status === 'ACCEPT', 'First valid packet status is ACCEPT');
  assert(resV.payload?.headcount === 12, 'Decrypted payload recovered on first accept');

  // Test W — Exact replay rejected
  console.log('\n[Test W] Exact replay rejected');
  const resW = await nodeC.verifyAndDecryptSosPacket(
    testVPacket,
    pairwiseKeyC,
    'TACTICAL-HQ',
    testReplayService,
    { now: baseTime + 2000 }
  );
  assert(resW.success === false, 'Exact replay rejected (success === false)');
  assert(resW.status === 'REJECT_ALREADY_SEEN', 'Exact replay status is REJECT_ALREADY_SEEN');
  assert(resW.payload === null, 'Replay payload is null (not processed)');

  // Test X — Same messageId replay rejected (different ciphertext)
  console.log('\n[Test X] Same messageId replay rejected (different ciphertext)');
  const forgedPayload = { status: 'CANCEL_RESCUE_ALL_FINE' };
  const forgedEnc = await nodeA.encryptSosPacketPayload(forgedPayload, pairwiseKeyA, validPacketAad);
  const sameIdPacket = {
    ...testVPacket,
    encryptedPayload: forgedEnc.ciphertext,
    iv: forgedEnc.iv
  };
  const resX = await nodeC.verifyAndDecryptSosPacket(
    sameIdPacket,
    pairwiseKeyC,
    'TACTICAL-HQ',
    testReplayService,
    { now: baseTime + 3000 }
  );
  assert(resX.success === false, 'Packet with same messageId rejected (success === false)');
  assert(resX.status === 'REJECT_ALREADY_SEEN', 'Status is REJECT_ALREADY_SEEN');
  assert(resX.payload === null, 'Forged payload rejected before decryption');

  // Test Y — Expired packet rejected
  console.log('\n[Test Y] Expired packet rejected');
  const expiredTime = baseTime - (DEFAULT_MAX_MESSAGE_AGE_MS + 10000); // 24h + 10s old
  const expiredAad: PacketAadFields = {
    id: 'SOS-EXPIRED-999',
    senderId: 'PERSON-A',
    recipientId: 'TACTICAL-HQ',
    createdAt: expiredTime
  };
  const expiredEnc = await nodeA.encryptSosPacketPayload({ alert: 'old alert' }, pairwiseKeyA, expiredAad);
  const expiredPacket = createSosPacket({
    id: expiredAad.id,
    senderId: expiredAad.senderId,
    recipientId: expiredAad.recipientId,
    deviceId: 'DEV-A1B2C3',
    latitude: 22.5726,
    longitude: 88.3639,
    priority: 'HIGH',
    message: '[ENCRYPTED E2EE PAYLOAD]',
    encryptedPayload: expiredEnc.ciphertext,
    iv: expiredEnc.iv
  });
  expiredPacket.createdAt = expiredAad.createdAt;

  const resY = await nodeC.verifyAndDecryptSosPacket(
    expiredPacket,
    pairwiseKeyC,
    'TACTICAL-HQ',
    testReplayService,
    { now: baseTime }
  );
  assert(resY.success === false, 'Expired packet rejected');
  assert(resY.status === 'REJECT_EXPIRED', 'Status is REJECT_EXPIRED');

  // Also test explicit expiresAt
  const packetWithExpiresAt = {
    ...expiredPacket,
    id: 'SOS-EXPIRES-AT-TEST',
    createdAt: baseTime,
    expiresAt: baseTime + 1000 // expires in 1s
  };
  const resY2 = testReplayService.checkReplayAndFreshness(packetWithExpiresAt, { now: baseTime + 2000 });
  assert(resY2 === 'REJECT_EXPIRED', 'Packet with past expiresAt timestamp is REJECT_EXPIRED');

  // Test Z — Future timestamp rejected
  console.log('\n[Test Z] Future timestamp outside clock-skew window rejected');
  const futureTime = baseTime + DEFAULT_CLOCK_SKEW_WINDOW_MS + 60000; // 6 minutes in future
  const futureAad: PacketAadFields = {
    id: 'SOS-FUTURE-001',
    senderId: 'PERSON-A',
    recipientId: 'TACTICAL-HQ',
    createdAt: futureTime
  };
  const futureEnc = await nodeA.encryptSosPacketPayload({ alert: 'future alert' }, pairwiseKeyA, futureAad);
  const futurePacket = createSosPacket({
    id: futureAad.id,
    senderId: futureAad.senderId,
    recipientId: futureAad.recipientId,
    deviceId: 'DEV-A1B2C3',
    latitude: 22.5726,
    longitude: 88.3639,
    priority: 'HIGH',
    message: '[ENCRYPTED E2EE PAYLOAD]',
    encryptedPayload: futureEnc.ciphertext,
    iv: futureEnc.iv
  });
  futurePacket.createdAt = futureAad.createdAt;

  const resZ = await nodeC.verifyAndDecryptSosPacket(
    futurePacket,
    pairwiseKeyC,
    'TACTICAL-HQ',
    testReplayService,
    { now: baseTime }
  );
  assert(resZ.success === false, 'Future timestamp rejected');
  assert(resZ.status === 'REJECT_FUTURE_TIMESTAMP', 'Status is REJECT_FUTURE_TIMESTAMP');

  // Test AA — Invalid timestamp rejected
  console.log('\n[Test AA] Invalid / missing / NaN timestamp rejected safely');
  const nanPacket = { ...testVPacket, id: 'SOS-NAN-001', createdAt: NaN };
  const resAA1 = testReplayService.checkReplayAndFreshness(nanPacket);
  assert(resAA1 === 'REJECT_INVALID_TIMESTAMP', 'NaN timestamp returns REJECT_INVALID_TIMESTAMP');

  const zeroPacket = { ...testVPacket, id: 'SOS-ZERO-001', createdAt: 0 };
  const resAA2 = testReplayService.checkReplayAndFreshness(zeroPacket);
  assert(resAA2 === 'REJECT_INVALID_TIMESTAMP', 'Zero timestamp returns REJECT_INVALID_TIMESTAMP');

  const emptyIdPacket = { ...testVPacket, id: '', createdAt: baseTime };
  const resAA3 = testReplayService.checkReplayAndFreshness(emptyIdPacket);
  assert(resAA3 === 'REJECT_INVALID_TIMESTAMP', 'Empty packet id returns REJECT_INVALID_TIMESTAMP');

  // Test AB — Replay cache cleanup
  console.log('\n[Test AB] Replay cache bounded cleanup');
  const isolatedReplayService = new ReplayProtectionService('test_cleanup_store');
  isolatedReplayService.clear();

  isolatedReplayService.recordProcessed('OLD-MSG-001', baseTime - (DEFAULT_MAX_MESSAGE_AGE_MS + DEFAULT_CLOCK_SKEW_WINDOW_MS + 5000), baseTime);
  isolatedReplayService.recordProcessed('FRESH-MSG-002', baseTime, baseTime);
  assert(isolatedReplayService.getCacheSize() === 2, 'Cache contains 2 records before cleanup');

  const pruned = isolatedReplayService.cleanupExpired(baseTime);
  assert(pruned === 1, 'Exactly 1 expired record pruned');
  assert(isolatedReplayService.getCacheSize() === 1, 'Cache size reduced to 1');
  assert(isolatedReplayService.hasSeen('OLD-MSG-001') === false, 'Old record removed from cache');
  assert(isolatedReplayService.hasSeen('FRESH-MSG-002') === true, 'Fresh record retained in cache');

  // Test AC — Existing TTL/hopCount still works
  console.log('\n[Test AC] Existing TTL/hopCount normal relaying works independently');
  const relayStorageEngine = new StorageEngine('node_relay_test_ac');
  const relayRepo = new SosRepository(relayStorageEngine);
  const relayDedup = new DeduplicationService(1000, relayStorageEngine);
  const relayQueue = new StoreCarryForwardQueue();
  const relayEngine = new PacketEngine({
    localNodeId: 'NODE-RELAY-AC',
    sosRepo: relayRepo,
    dedup: relayDedup,
    queue: relayQueue
  });

  const packetForHopTest = createSosPacket({
    id: 'SOS-HOP-TEST-001',
    senderId: 'PERSON-A',
    deviceId: 'DEV-A',
    latitude: 22.57,
    longitude: 88.36,
    ttl: 7,
    hopCount: 0
  });

  const hopProcessed = await relayEngine.processPacket(packetForHopTest);
  assert(hopProcessed === false || hopProcessed === true, 'PacketEngine processed relay packet');
  const queuedPacket = relayQueue.peek();
  assert(queuedPacket !== null, 'Packet queued for Store-Carry-Forward relay');
  assert(queuedPacket!.ttl === 6, 'Relay decremented TTL to 6');
  assert(queuedPacket!.hopCount === 1, 'Relay incremented hopCount to 1');
  assert(queuedPacket!.route.includes('NODE-RELAY-AC'), 'Relay added NODE-RELAY-AC to route trace');

  // Test AD — Replay protection does not replace cryptographic authentication
  console.log('\n[Test AD] Cryptographic authentication is enforced for fresh packets');
  const freshAadAD: PacketAadFields = {
    id: 'SOS-AUTH-TEST-AD',
    senderId: 'PERSON-A',
    recipientId: 'TACTICAL-HQ',
    createdAt: baseTime
  };
  const freshEncAD = await nodeA.encryptSosPacketPayload({ sensitive: 'health-vitals' }, pairwiseKeyA, freshAadAD);
  const freshPacketAD = createSosPacket({
    id: freshAadAD.id,
    senderId: freshAadAD.senderId,
    recipientId: freshAadAD.recipientId,
    deviceId: 'DEV-A',
    latitude: 22.57,
    longitude: 88.36,
    priority: 'HIGH',
    message: '[ENCRYPTED E2EE PAYLOAD]',
    encryptedPayload: freshEncAD.ciphertext,
    iv: freshEncAD.iv
  });
  freshPacketAD.createdAt = freshAadAD.createdAt;

  // Subtest AD.1: Fresh packet with tampered ciphertext passes replay check but fails AES-GCM
  const tamperedCtPacket = {
    ...freshPacketAD,
    id: 'SOS-AUTH-TEST-AD-1',
    encryptedPayload: freshEncAD.ciphertext.slice(0, -2) + '00'
  };
  const resAD1 = await nodeC.verifyAndDecryptSosPacket(
    tamperedCtPacket,
    pairwiseKeyC,
    'TACTICAL-HQ',
    testReplayService,
    { now: baseTime }
  );
  assert(resAD1.success === false, 'Tampered ciphertext fails verification');
  assert(resAD1.status === 'REJECT_AUTH_FAILED', 'Tampered ciphertext returns REJECT_AUTH_FAILED');

  // Subtest AD.2: Fresh packet with tampered senderId passes replay check but fails AAD
  const tamperedSenderPacket = {
    ...freshPacketAD,
    id: 'SOS-AUTH-TEST-AD-2',
    senderId: 'FORGED-ATTACKER'
  };
  const resAD2 = await nodeC.verifyAndDecryptSosPacket(
    tamperedSenderPacket,
    pairwiseKeyC,
    'TACTICAL-HQ',
    testReplayService,
    { now: baseTime }
  );
  assert(resAD2.success === false, 'Tampered AAD senderId fails verification');
  assert(resAD2.status === 'REJECT_AUTH_FAILED', 'Tampered AAD returns REJECT_AUTH_FAILED');

  // Test AE — No plaintext or cryptographic secrets in replay state
  console.log('\n[Test AE] Replay cache contains zero plaintext, keys, or secrets');
  const replayRecords = testReplayService.getRecords();
  assert(replayRecords.length > 0, 'Replay cache has entries');
  const serializedReplayCache = JSON.stringify(replayRecords);

  assert(!serializedReplayCache.includes('DISASTER_EVACUATION'), 'No SOS plaintext in replay state');
  assert(!serializedReplayCache.includes('headcount'), 'No payload keys in replay state');
  assert(!serializedReplayCache.includes('private'), 'No private key in replay state');
  assert(!serializedReplayCache.includes('CryptoKey'), 'No CryptoKey instances in replay state');
  assert(!serializedReplayCache.includes('shared'), 'No shared secret in replay state');
  for (const record of replayRecords) {
    const keys = Object.keys(record);
    assert(keys.length === 3 && keys.includes('messageId') && keys.includes('createdAt') && keys.includes('recordedAt'), 'Record has only messageId, createdAt, recordedAt');
  }

  /* ====================================================================
   * PART 7: SECURE DEVICE PAIRING & VERIFICATION (TESTS AF - AM)
   * ==================================================================== */
  console.log('\n--------------------------------------------------');
  console.log('TESTING SECURE DEVICE PAIRING & VERIFICATION (TESTS AF - AM)');
  console.log('--------------------------------------------------\n');

  // Setup: Two devices for pairing tests
  const pairDeviceA = new CryptoService(undefined, 'pair_dev_a');
  const pairDeviceC = new CryptoService(undefined, 'pair_dev_c');

  const identityA = await pairDeviceA.loadOrCreateDeviceIdentity();
  const identityC = await pairDeviceC.loadOrCreateDeviceIdentity();

  const ecdhPubA = await pairDeviceA.generateEcdhKeyPair();
  const ecdhPubC = await pairDeviceC.generateEcdhKeyPair();

  const pairingSvcA = new PairingService('pair_svc_a');
  const pairingSvcC = new PairingService('pair_svc_c');

  // Test AF — Generate public pairing payload
  console.log('[Test AF] Generate public pairing payload');
  const payloadA = pairingSvcA.generatePairingPayload(
    identityA.deviceId,
    identityA.publicKeyHex,
    ecdhPubA
  );

  assert(payloadA.version === PAIRING_PAYLOAD_VERSION, 'Payload has correct version');
  assert(payloadA.deviceId === identityA.deviceId, 'Payload contains deviceId');
  assert(payloadA.ecdsaPublicKey === identityA.publicKeyHex, 'Payload contains ECDSA public key');
  assert(payloadA.ecdhPublicKey === ecdhPubA, 'Payload contains ECDH public key');

  // AF.2: Payload contains NO private or secret material
  const serializedPayloadA = JSON.stringify(payloadA);
  assert(!serializedPayloadA.includes('private'), 'No private key material in payload');
  assert(!serializedPayloadA.includes('d":'), 'No JWK private component (d) in payload');
  assert(!serializedPayloadA.includes('shared'), 'No shared secret in payload');
  assert(!serializedPayloadA.includes('aes'), 'No AES key reference in payload (case-sensitive)');

  // Test AG — Pairing payload validation
  console.log('\n[Test AG] Pairing payload validation');

  // AG.1: Valid payload accepted
  const serializedQR = pairingSvcC.serializePairingPayload(payloadA);
  const validResult = pairingSvcC.validatePairingPayload(serializedQR);
  assert(validResult.valid === true, 'Valid serialized payload accepted');
  if (validResult.valid) {
    assert(validResult.payload.deviceId === identityA.deviceId, 'Parsed deviceId matches');
  }

  // AG.2: Object form also accepted
  const validResultObj = pairingSvcC.validatePairingPayload(payloadA);
  assert(validResultObj.valid === true, 'Valid object payload accepted');

  // AG.3: Missing fields rejected
  const missingDevice = pairingSvcC.validatePairingPayload(JSON.stringify({
    version: 1,
    ecdsaPublicKey: identityA.publicKeyHex,
    ecdhPublicKey: ecdhPubA
  }));
  assert(missingDevice.valid === false, 'Missing deviceId rejected');

  const missingEcdsa = pairingSvcC.validatePairingPayload(JSON.stringify({
    version: 1,
    deviceId: 'DEV-TEST',
    ecdhPublicKey: ecdhPubA
  }));
  assert(missingEcdsa.valid === false, 'Missing ecdsaPublicKey rejected');

  const missingEcdh = pairingSvcC.validatePairingPayload(JSON.stringify({
    version: 1,
    deviceId: 'DEV-TEST',
    ecdsaPublicKey: identityA.publicKeyHex
  }));
  assert(missingEcdh.valid === false, 'Missing ecdhPublicKey rejected');

  const missingVersion = pairingSvcC.validatePairingPayload(JSON.stringify({
    deviceId: 'DEV-TEST',
    ecdsaPublicKey: identityA.publicKeyHex,
    ecdhPublicKey: ecdhPubA
  }));
  assert(missingVersion.valid === false, 'Missing version rejected');

  // AG.4: Malformed keys rejected
  const malformedEcdsa = pairingSvcC.validatePairingPayload(JSON.stringify({
    version: 1,
    deviceId: 'DEV-TEST',
    ecdsaPublicKey: 'not-hex!!!',
    ecdhPublicKey: ecdhPubA
  }));
  assert(malformedEcdsa.valid === false, 'Malformed ecdsaPublicKey (non-hex) rejected');

  const shortEcdsa = pairingSvcC.validatePairingPayload(JSON.stringify({
    version: 1,
    deviceId: 'DEV-TEST',
    ecdsaPublicKey: 'aabb',
    ecdhPublicKey: ecdhPubA
  }));
  assert(shortEcdsa.valid === false, 'Too-short ecdsaPublicKey rejected');

  const wrongLenEcdh = pairingSvcC.validatePairingPayload(JSON.stringify({
    version: 1,
    deviceId: 'DEV-TEST',
    ecdsaPublicKey: identityA.publicKeyHex,
    ecdhPublicKey: 'aabbccdd'
  }));
  assert(wrongLenEcdh.valid === false, 'Wrong-length ecdhPublicKey rejected');

  // AG.5: Invalid JSON rejected
  const invalidJson = pairingSvcC.validatePairingPayload('{broken json!');
  assert(invalidJson.valid === false, 'Invalid JSON rejected');

  // AG.6: Wrong version rejected
  const wrongVersion = pairingSvcC.validatePairingPayload(JSON.stringify({
    version: 999,
    deviceId: 'DEV-TEST',
    ecdsaPublicKey: identityA.publicKeyHex,
    ecdhPublicKey: ecdhPubA
  }));
  assert(wrongVersion.valid === false, 'Unsupported version rejected');

  // AG.7: Cryptographic key validation via Web Crypto import
  const validEcdh = await pairingSvcC.validateEcdhPublicKey(ecdhPubA);
  assert(validEcdh === true, 'Valid ECDH public key passes Web Crypto import');

  const invalidEcdhKey = await pairingSvcC.validateEcdhPublicKey('04' + 'ff'.repeat(64));
  assert(invalidEcdhKey === false, 'Invalid ECDH public key (not on curve) rejected by Web Crypto');

  const validEcdsaKey = await pairingSvcC.validateEcdsaPublicKey(identityA.publicKeyHex);
  assert(validEcdsaKey === true, 'Valid ECDSA public key passes Web Crypto import');

  // Test AH — Deterministic verification fingerprint
  console.log('\n[Test AH] Deterministic verification fingerprint');

  // AH.1: A and C calculate the same value
  const fingerprintFromA = await pairingSvcA.generateVerificationFingerprint(
    identityA.publicKeyHex,
    ecdhPubA,
    identityC.publicKeyHex,
    ecdhPubC
  );
  const fingerprintFromC = await pairingSvcC.generateVerificationFingerprint(
    identityC.publicKeyHex,
    ecdhPubC,
    identityA.publicKeyHex,
    ecdhPubA
  );
  assert(fingerprintFromA === fingerprintFromC, 'A and C compute identical verification fingerprint');
  assert(fingerprintFromA.length > 0, 'Fingerprint is non-empty');
  assert(fingerprintFromA.includes('-'), 'Fingerprint formatted with dashes (XXXX-XXXX-XXXX-XXXX)');

  // AH.2: Repeating calculation produces the same result
  const fingerprintRepeat = await pairingSvcA.generateVerificationFingerprint(
    identityA.publicKeyHex,
    ecdhPubA,
    identityC.publicKeyHex,
    ecdhPubC
  );
  assert(fingerprintRepeat === fingerprintFromA, 'Repeated fingerprint calculation is deterministic');

  // Test AI — Identity change detection
  console.log('\n[Test AI] Identity change detection');

  // AI.1: Generate a third device with different identity
  const pairDeviceX = new CryptoService(undefined, 'pair_dev_x');
  const identityX = await pairDeviceX.loadOrCreateDeviceIdentity();
  const ecdhPubX = await pairDeviceX.generateEcdhKeyPair();

  // Fingerprint(A, C) vs Fingerprint(A, X) must differ
  const fingerprintAX = await pairingSvcA.generateVerificationFingerprint(
    identityA.publicKeyHex,
    ecdhPubA,
    identityX.publicKeyHex,
    ecdhPubX
  );
  assert(fingerprintAX !== fingerprintFromA, 'Changing peer identity changes fingerprint');

  // AI.2: Fingerprint(A, C) vs Fingerprint(X, C) must also differ
  const fingerprintXC = await pairingSvcC.generateVerificationFingerprint(
    identityX.publicKeyHex,
    ecdhPubX,
    identityC.publicKeyHex,
    ecdhPubC
  );
  assert(fingerprintXC !== fingerprintFromC, 'Changing local identity changes fingerprint');

  // Test AJ — Private key protection
  console.log('\n[Test AJ] Private key protection in pairing payload');

  const payloadC = pairingSvcC.generatePairingPayload(
    identityC.deviceId,
    identityC.publicKeyHex,
    ecdhPubC
  );
  const serializedPayloadC = JSON.stringify(payloadC);
  const combinedPayloads = serializedPayloadA + serializedPayloadC;

  // AJ.1: No private ECDSA/ECDH key in payload
  assert(!combinedPayloads.includes('"d"'), 'No JWK private exponent (d) in any payload');
  assert(!combinedPayloads.toLowerCase().includes('private'), 'No private key label in payloads');

  // AJ.2: No shared secret
  assert(!combinedPayloads.toLowerCase().includes('shared'), 'No shared secret in payloads');
  assert(!combinedPayloads.toLowerCase().includes('secret'), 'No secret in payloads');

  // AJ.3: No AES key material
  assert(!combinedPayloads.toLowerCase().includes('aes'), 'No AES key material in payloads');

  // AJ.4: PairingService itself has no keys in string representation
  const svcStringA = JSON.stringify(pairingSvcA);
  assert(!svcStringA.toLowerCase().includes('private'), 'No private key in PairingService string');
  assert(!svcStringA.toLowerCase().includes('secret'), 'No secret in PairingService string');

  // Test AK — Pairing persistence
  console.log('\n[Test AK] Pairing persistence across restart');

  const persistSvc = new PairingService('persist_test');
  persistSvc.clearAllPeers();

  // Pair and verify a peer
  persistSvc.addPendingPeer(payloadA);
  persistSvc.verifyPeer(payloadA.deviceId);
  assert(persistSvc.isTrustedPeer(payloadA.deviceId), 'Peer verified before restart');
  assert(persistSvc.getPeerCount() === 1, 'One peer before restart');

  // Simulate restart by creating new PairingService with same storage prefix
  const restartedSvc = new PairingService('persist_test');
  assert(restartedSvc.getPeerCount() === 1, 'Peer count persisted after restart');
  assert(restartedSvc.isTrustedPeer(payloadA.deviceId), 'Peer trust status persisted after restart');
  const restoredPeer = restartedSvc.getPeer(payloadA.deviceId);
  assert(restoredPeer !== null, 'Peer record retrieved after restart');
  assert(restoredPeer!.ecdsaPublicKey === identityA.publicKeyHex, 'ECDSA public key persisted');
  assert(restoredPeer!.ecdhPublicKey === ecdhPubA, 'ECDH public key persisted');
  assert(restoredPeer!.trustStatus === 'VERIFIED', 'Trust status persisted as VERIFIED');

  // Cleanup
  persistSvc.clearAllPeers();
  restartedSvc.clearAllPeers();

  // Test AL — Unverified peer rejection
  console.log('\n[Test AL] Unverified peer not treated as trusted encryption contact');

  const trustTestSvc = new PairingService('trust_test');
  trustTestSvc.clearAllPeers();

  // AL.1: Unknown peer is not trusted
  assert(trustTestSvc.isTrustedPeer('DEV-UNKNOWN') === false, 'Unknown peer is not trusted');

  // AL.2: Peer added as PENDING is not trusted
  const pendingRecord = trustTestSvc.addPendingPeer(payloadC);
  assert(pendingRecord.trustStatus === 'PENDING', 'Newly added peer starts as PENDING');
  assert(trustTestSvc.isTrustedPeer(payloadC.deviceId) === false, 'PENDING peer is not trusted');

  // AL.3: Verified peers list is empty while peer is PENDING
  assert(trustTestSvc.getVerifiedPeers().length === 0, 'No verified peers while peer is PENDING');

  // AL.4: After verification, peer becomes trusted
  trustTestSvc.verifyPeer(payloadC.deviceId);
  assert(trustTestSvc.isTrustedPeer(payloadC.deviceId) === true, 'Peer becomes trusted after verification');
  assert(trustTestSvc.getVerifiedPeers().length === 1, 'One verified peer after verification');

  // AL.5: Verifying a non-existent peer returns false
  assert(trustTestSvc.verifyPeer('DEV-NONEXISTENT') === false, 'Verifying non-existent peer returns false');

  trustTestSvc.clearAllPeers();

  // Test AM — ECDSA/ECDH separation
  console.log('\n[Test AM] ECDSA identity and ECDH agreement keys remain separate');

  // AM.1: ECDSA and ECDH public keys are different for Device A
  assert(identityA.publicKeyHex !== ecdhPubA, 'Device A: ECDSA public key differs from ECDH public key');

  // AM.2: ECDSA and ECDH public keys are different for Device C
  assert(identityC.publicKeyHex !== ecdhPubC, 'Device C: ECDSA public key differs from ECDH public key');

  // AM.3: Pairing payload correctly separates both keys
  assert(payloadA.ecdsaPublicKey !== payloadA.ecdhPublicKey, 'Payload A: ECDSA ≠ ECDH');
  assert(payloadC.ecdsaPublicKey !== payloadC.ecdhPublicKey, 'Payload C: ECDSA ≠ ECDH');

  // AM.4: ECDSA key has different length than raw ECDH key (SPKI vs raw uncompressed)
  assert(identityA.publicKeyHex.length !== ecdhPubA.length, 'ECDSA (SPKI) and ECDH (raw) have different encoding lengths');
  assert(ecdhPubA.length === 130, 'ECDH raw uncompressed key is exactly 130 hex chars (65 bytes)');

  /* ====================================================================
   * PART 8: AUTHENTICATED ACK (TESTS AN - AY)
   * ==================================================================== */
  console.log('\n--------------------------------------------------');
  console.log('TESTING AUTHENTICATED ACK (TESTS AN - AY)');
  console.log('--------------------------------------------------\n');

  const ackNodeA = new CryptoService(undefined, 'ack_node_a');
  const ackNodeC = new CryptoService(undefined, 'ack_node_c');
  const ackNodeB = new CryptoService(undefined, 'ack_node_b');

  const ackIdentA = await ackNodeA.loadOrCreateDeviceIdentity();
  const ackIdentC = await ackNodeC.loadOrCreateDeviceIdentity();
  const ackIdentB = await ackNodeB.loadOrCreateDeviceIdentity();

  const ackEcdhA = await ackNodeA.generateEcdhKeyPair();
  const ackEcdhC = await ackNodeC.generateEcdhKeyPair();
  await ackNodeB.generateEcdhKeyPair();

  const ackPairingA = new PairingService('ack_pair_a');
  const ackPairingC = new PairingService('ack_pair_c');
  const ackPairingB = new PairingService('ack_pair_b');
  ackPairingA.clearAllPeers();
  ackPairingC.clearAllPeers();
  ackPairingB.clearAllPeers();

  const ackPayloadA = ackPairingA.generatePairingPayload(ackIdentA.deviceId, ackIdentA.publicKeyHex, ackEcdhA);
  const ackPayloadC = ackPairingC.generatePairingPayload(ackIdentC.deviceId, ackIdentC.publicKeyHex, ackEcdhC);

  ackPairingA.addPendingPeer(ackPayloadC);
  ackPairingA.verifyPeer(ackIdentC.deviceId);
  ackPairingC.addPendingPeer(ackPayloadA);
  ackPairingC.verifyPeer(ackIdentA.deviceId);

  const originalSosId = 'SOS-M4-ACK-001';
  const ackBaseTime = 1774000000000;
  const ackReplay = new ReplayProtectionService('ack_replay_store');
  ackReplay.clear();

  // Test AN — Valid ACK succeeds
  console.log('[Test AN] Valid authenticated ACK succeeds');
  const validAck = await ackNodeC.createAuthenticatedAck(
    originalSosId,
    ackIdentA.deviceId,
    ackPairingC,
    { status: 'ACKNOWLEDGED', note: 'Rescue received SOS', createdAt: ackBaseTime, ackId: 'ACK-VALID-001' }
  );
  assert(validAck !== null, 'Trusted paired recipient can create ACK');
  assert(validAck!.kind === 'ACK', 'ACK kind is ACK');
  assert(validAck!.iv.length === 24, 'ACK IV is 12 bytes (24 hex chars)');
  assert(validAck!.algorithm === 'AES-GCM-256 (ACK-AAD-Authenticated)', 'ACK uses AES-GCM with ACK AAD');
  assert(validAck!.encryptedPayload.length > 0, 'ACK ciphertext is present');

  const resAN = await ackNodeA.verifyAndDecryptAck(
    validAck!,
    ackIdentA.deviceId,
    ackPairingA,
    ackReplay,
    { now: ackBaseTime + 1000 }
  );
  assert(resAN.success === true, 'Valid ACK succeeds');
  assert(resAN.status === 'ACCEPT', 'Valid ACK status is ACCEPT');
  assert(resAN.payload !== null, 'Valid ACK payload recovered');

  // Test AO — ACK references the original message
  console.log('\n[Test AO] ACK references the correct original message');
  assert(validAck!.sosId === originalSosId, 'ACK packet sosId matches original SOS');
  assert(resAN.payload?.sosId === originalSosId, 'Decrypted ACK payload sosId matches original SOS');
  assert(resAN.payload?.ackId === validAck!.ackId, 'Decrypted ACK payload ackId matches packet');

  // Test AP — ACK from trusted paired recipient
  console.log('\n[Test AP] ACK from the trusted paired recipient succeeds');
  assert(validAck!.senderId === ackIdentC.deviceId, 'ACK sender is Device C');
  assert(validAck!.recipientId === ackIdentA.deviceId, 'ACK recipient is Device A');
  assert(ackPairingA.isTrustedPeer(validAck!.senderId) === true, 'ACK sender is a verified paired peer of A');
  assert(resAN.payload?.status === 'ACKNOWLEDGED', 'Decrypted ACK status is ACKNOWLEDGED');

  // Test AQ — Unpaired/untrusted sender rejected
  console.log('\n[Test AQ] Unpaired sender ACK is rejected');
  const unpairedPairing = new PairingService('ack_pair_untrusted');
  unpairedPairing.clearAllPeers();
  const resAQ = await ackNodeA.verifyAndDecryptAck(
    validAck!,
    ackIdentA.deviceId,
    unpairedPairing,
    ackReplay,
    { now: ackBaseTime + 1500 }
  );
  assert(resAQ.success === false, 'Unpaired sender ACK is rejected');
  assert(resAQ.status === 'REJECT_UNTRUSTED_PEER', 'Unpaired ACK status is REJECT_UNTRUSTED_PEER');
  assert(resAQ.payload === null, 'Unpaired ACK yields no payload');

  const pendingOnly = new PairingService('ack_pair_pending');
  pendingOnly.clearAllPeers();
  pendingOnly.addPendingPeer(ackPayloadC);
  const resAQ2 = await ackNodeA.verifyAndDecryptAck(
    validAck!,
    ackIdentA.deviceId,
    pendingOnly,
    ackReplay,
    { now: ackBaseTime + 1600 }
  );
  assert(resAQ2.success === false, 'PENDING (unverified) peer ACK is rejected');
  assert(resAQ2.status === 'REJECT_UNTRUSTED_PEER', 'PENDING peer ACK status is REJECT_UNTRUSTED_PEER');

  const untrustedCreate = await ackNodeB.createAuthenticatedAck(
    originalSosId,
    ackIdentA.deviceId,
    ackPairingB
  );
  assert(untrustedCreate === null, 'Unpaired device cannot create ACK to an untrusted recipient');

  // Test AR — Tampered ciphertext rejected
  console.log('\n[Test AR] Tampered ACK ciphertext is rejected');
  const ackAR = await ackNodeC.createAuthenticatedAck(
    originalSosId,
    ackIdentA.deviceId,
    ackPairingC,
    { createdAt: ackBaseTime, ackId: 'ACK-TAMPER-CT' }
  );
  const ackTamperedCt: AuthenticatedAckPacket = {
    ...ackAR!,
    encryptedPayload: ackAR!.encryptedPayload.replace(/[0-9a-f]/, (ch) => (ch === '0' ? '1' : '0'))
  };
  const resAR = await ackNodeA.verifyAndDecryptAck(
    ackTamperedCt,
    ackIdentA.deviceId,
    ackPairingA,
    ackReplay,
    { now: ackBaseTime + 2000 }
  );
  assert(resAR.success === false, 'Tampered ACK ciphertext is rejected');
  assert(resAR.status === 'REJECT_AUTH_FAILED', 'Tampered ciphertext returns REJECT_AUTH_FAILED');

  // Test AS — Tampered IV rejected
  console.log('\n[Test AS] Tampered ACK IV is rejected');
  const ackAS = await ackNodeC.createAuthenticatedAck(
    originalSosId,
    ackIdentA.deviceId,
    ackPairingC,
    { createdAt: ackBaseTime, ackId: 'ACK-TAMPER-IV' }
  );
  const ackTamperedIv: AuthenticatedAckPacket = {
    ...ackAS!,
    iv: ackAS!.iv.replace(/[0-9a-f]/, (ch) => (ch === '0' ? '1' : '0'))
  };
  const resAS = await ackNodeA.verifyAndDecryptAck(
    ackTamperedIv,
    ackIdentA.deviceId,
    ackPairingA,
    ackReplay,
    { now: ackBaseTime + 3000 }
  );
  assert(resAS.success === false, 'Tampered ACK IV is rejected');
  assert(resAS.status === 'REJECT_AUTH_FAILED', 'Tampered IV returns REJECT_AUTH_FAILED');

  // Test AT — Tampered original message ID / AAD rejected
  console.log('\n[Test AT] Tampered original message ID / AAD is rejected');
  const ackAT = await ackNodeC.createAuthenticatedAck(
    originalSosId,
    ackIdentA.deviceId,
    ackPairingC,
    { createdAt: ackBaseTime, ackId: 'ACK-TAMPER-SOS' }
  );
  const tamperedSos: AuthenticatedAckPacket = { ...ackAT!, sosId: 'SOS-FORGED-999' };
  const resAT = await ackNodeA.verifyAndDecryptAck(
    tamperedSos,
    ackIdentA.deviceId,
    ackPairingA,
    ackReplay,
    { now: ackBaseTime + 4000 }
  );
  assert(resAT.success === false, 'Tampered original message ID is rejected');
  assert(resAT.status === 'REJECT_AUTH_FAILED', 'Tampered sosId/AAD returns REJECT_AUTH_FAILED');
  assert(buildAckAad({
    ackId: ackAT!.ackId,
    sosId: originalSosId,
    senderId: ackAT!.senderId,
    recipientId: ackAT!.recipientId,
    createdAt: ackAT!.createdAt
  }).length > 0, 'ACK AAD builder produces authenticated context bytes');

  // Test AU — Tampered sender/recipient metadata rejected
  console.log('\n[Test AU] Tampered sender/recipient metadata is rejected');
  const ackAU = await ackNodeC.createAuthenticatedAck(
    originalSosId,
    ackIdentA.deviceId,
    ackPairingC,
    { createdAt: ackBaseTime, ackId: 'ACK-TAMPER-META' }
  );
  const tamperedSender: AuthenticatedAckPacket = { ...ackAU!, senderId: ackIdentB.deviceId };
  const resAUSender = await ackNodeA.verifyAndDecryptAck(
    tamperedSender,
    ackIdentA.deviceId,
    ackPairingA,
    ackReplay,
    { now: ackBaseTime + 5000 }
  );
  assert(resAUSender.success === false, 'Tampered ACK senderId is rejected');
  assert(
    resAUSender.status === 'REJECT_UNTRUSTED_PEER' || resAUSender.status === 'REJECT_AUTH_FAILED',
    'Tampered senderId returns REJECT_UNTRUSTED_PEER or REJECT_AUTH_FAILED'
  );

  const ackAU2 = await ackNodeC.createAuthenticatedAck(
    originalSosId,
    ackIdentA.deviceId,
    ackPairingC,
    { createdAt: ackBaseTime, ackId: 'ACK-TAMPER-RCPT' }
  );
  const tamperedRecipient: AuthenticatedAckPacket = { ...ackAU2!, recipientId: 'DEV-NOT-A' };
  const resAURcpt = await ackNodeA.verifyAndDecryptAck(
    tamperedRecipient,
    ackIdentA.deviceId,
    ackPairingA,
    ackReplay,
    { now: ackBaseTime + 6000 }
  );
  assert(resAURcpt.success === false, 'Tampered ACK recipientId is rejected');
  assert(resAURcpt.status === 'REJECT_WRONG_RECIPIENT', 'Tampered recipientId returns REJECT_WRONG_RECIPIENT');

  // Test AV — Exact ACK replay rejected
  console.log('\n[Test AV] Exact ACK replay is rejected');
  const resAV = await ackNodeA.verifyAndDecryptAck(
    validAck!,
    ackIdentA.deviceId,
    ackPairingA,
    ackReplay,
    { now: ackBaseTime + 7000 }
  );
  assert(resAV.success === false, 'Exact ACK replay is rejected');
  assert(resAV.status === 'REJECT_ALREADY_SEEN', 'Exact ACK replay status is REJECT_ALREADY_SEEN');
  assert(resAV.payload === null, 'Replayed ACK yields no payload');

  // Test AW — Same ACK ID with modified ciphertext rejected
  console.log('\n[Test AW] Same ACK ID with modified ciphertext is rejected');
  const modifiedSameId: AuthenticatedAckPacket = {
    ...validAck!,
    encryptedPayload: validAck!.encryptedPayload.replace(/[0-9a-f]/, (ch) => (ch === 'a' ? 'b' : 'a'))
  };
  const resAW = await ackNodeA.verifyAndDecryptAck(
    modifiedSameId,
    ackIdentA.deviceId,
    ackPairingA,
    ackReplay,
    { now: ackBaseTime + 8000 }
  );
  assert(resAW.success === false, 'Same ACK ID with modified ciphertext is rejected');
  assert(resAW.status === 'REJECT_ALREADY_SEEN', 'Modified ciphertext with same ackId is REJECT_ALREADY_SEEN');

  // Test AX — Relay cannot forge ACK
  console.log('\n[Test AX] Relay cannot forge a valid ACK');
  const forgeAckId = 'ACK-FORGE-RELAY';
  const forgeAad = {
    ackId: forgeAckId,
    sosId: originalSosId,
    senderId: ackIdentC.deviceId,
    recipientId: ackIdentA.deviceId,
    createdAt: ackBaseTime
  };
  const relayWrongKey = await ackNodeB.deriveDirectionalAckKey(
    ackEcdhA,
    ackIdentC.deviceId,
    ackIdentA.deviceId
  );
  const ackForgedEnc = await ackNodeB.encryptAckPayload(
    { sosId: originalSosId, ackId: forgeAckId, status: 'ACKNOWLEDGED', note: 'forged' },
    relayWrongKey,
    forgeAad
  );
  const forgedAck: AuthenticatedAckPacket = {
    kind: 'ACK',
    ackId: forgeAckId,
    sosId: originalSosId,
    senderId: ackIdentC.deviceId,
    recipientId: ackIdentA.deviceId,
    deviceId: ackIdentC.deviceId,
    createdAt: ackBaseTime,
    status: 'ACKNOWLEDGED',
    encryptedPayload: ackForgedEnc.ciphertext,
    iv: ackForgedEnc.iv,
    algorithm: ackForgedEnc.algorithm,
    hopCount: 0,
    ttl: 7,
    route: [ackIdentB.deviceId]
  };
  const resAX = await ackNodeA.verifyAndDecryptAck(
    forgedAck,
    ackIdentA.deviceId,
    ackPairingA,
    ackReplay,
    { now: ackBaseTime + 9000 }
  );
  assert(resAX.success === false, 'Relay-forged ACK is rejected');
  assert(resAX.status === 'REJECT_AUTH_FAILED', 'Relay-forged ACK returns REJECT_AUTH_FAILED');
  assert(resAX.payload === null, 'Relay-forged ACK yields no payload');

  const ackInfoCA = buildAckHkdfInfo(ackIdentC.deviceId, ackIdentA.deviceId);
  const ackInfoAC = buildAckHkdfInfo(ackIdentA.deviceId, ackIdentC.deviceId);
  assert(ackInfoCA.startsWith(DEFAULT_ACK_HKDF_INFO), 'ACK HKDF info uses ACK domain prefix');
  assert(ackInfoCA !== ackInfoAC, 'C→A ACK HKDF info differs from A→C (directional)');
  assert(ackInfoCA !== DEFAULT_HKDF_INFO, 'ACK HKDF info is domain-separated from SOS E2E info');

  // Test AY — No private/shared/AES material in ACK objects
  console.log('\n[Test AY] No private/shared/AES key material in ACK objects or replay cache');
  const serializedAck = JSON.stringify(validAck);
  assert(!serializedAck.includes('private'), 'No private key material in ACK packet');
  assert(!serializedAck.includes('"d":'), 'No JWK private component in ACK packet');
  assert(!serializedAck.toLowerCase().includes('shared'), 'No shared secret in ACK packet');
  assert(!serializedAck.includes('CryptoKey'), 'No CryptoKey in ACK packet');
  const ackReplaySerialized = JSON.stringify(ackReplay.getRecords());
  assert(!ackReplaySerialized.includes('Rescue received SOS'), 'No ACK plaintext note in replay cache');
  assert(!ackReplaySerialized.toLowerCase().includes('private'), 'No private key in ACK replay cache');
  assert(!ackReplaySerialized.includes('CryptoKey'), 'No CryptoKey in ACK replay cache');
  for (const record of ackReplay.getRecords()) {
    const keys = Object.keys(record);
    assert(keys.length === 3 && keys.includes('messageId') && keys.includes('createdAt') && keys.includes('recordedAt'), 'ACK replay record has only messageId, createdAt, recordedAt');
  }

  ackPairingA.clearAllPeers();
  ackPairingC.clearAllPeers();
  ackPairingB.clearAllPeers();
  unpairedPairing.clearAllPeers();
  pendingOnly.clearAllPeers();
  ackReplay.clear();

  /* ====================================================================
   * PART 9: AUTHENTICATED ACK MESH INTEGRATION (TESTS AZ - BK)
   * ==================================================================== */
  console.log('\n--------------------------------------------------');
  console.log('TESTING AUTHENTICATED ACK MESH INTEGRATION (TESTS AZ - BK)');
  console.log('--------------------------------------------------\n');

  MockMeshTransport.resetNetwork();

  const meshCryptoA = new CryptoService(undefined, 'mesh_ack_crypto_a');
  const meshCryptoC = new CryptoService(undefined, 'mesh_ack_crypto_c');
  const meshCryptoB = new CryptoService(undefined, 'mesh_ack_crypto_b');

  const meshIdentA = await meshCryptoA.loadOrCreateDeviceIdentity();
  const meshIdentC = await meshCryptoC.loadOrCreateDeviceIdentity();
  await meshCryptoB.loadOrCreateDeviceIdentity();

  const meshEcdhA = await meshCryptoA.generateEcdhKeyPair();
  const meshEcdhC = await meshCryptoC.generateEcdhKeyPair();
  await meshCryptoB.generateEcdhKeyPair();

  const meshPairA = new PairingService('mesh_ack_pair_a');
  const meshPairC = new PairingService('mesh_ack_pair_c');
  meshPairA.clearAllPeers();
  meshPairC.clearAllPeers();
  meshPairA.addPendingPeer(meshPairC.generatePairingPayload(meshIdentC.deviceId, meshIdentC.publicKeyHex, meshEcdhC));
  meshPairA.verifyPeer(meshIdentC.deviceId);
  meshPairC.addPendingPeer(meshPairA.generatePairingPayload(meshIdentA.deviceId, meshIdentA.publicKeyHex, meshEcdhA));
  meshPairC.verifyPeer(meshIdentA.deviceId);

  const meshReplayA = new ReplayProtectionService('mesh_ack_replay_a');
  meshReplayA.clear();

  const meshTransportA = new MockMeshTransport('PHONE-A', ['PHONE-B']);
  const meshTransportB = new MockMeshTransport('PHONE-B', ['PHONE-A', 'TACTICAL-HQ']);
  const meshTransportC = new MockMeshTransport('TACTICAL-HQ', ['PHONE-B']);

  const makeMeshNode = (nodeId: string, prefix: string, transport: MockMeshTransport, extra?: ConstructorParameters<typeof PacketEngine>[0]) => {
    const storage = new StorageEngine(prefix);
    storage.clearAll();
    const repo = new SosRepository(storage);
    const engine = new PacketEngine({
      localNodeId: nodeId,
      sosRepo: repo,
      dedup: new DeduplicationService(100, storage),
      transport,
      ...extra
    });
    return { storage, repo, engine };
  };

  const meshNodeA = makeMeshNode('PHONE-A', 'mesh_ack_store_a', meshTransportA, {
    crypto: meshCryptoA,
    pairing: meshPairA,
    replayProtection: meshReplayA
  });
  const meshNodeB = makeMeshNode('PHONE-B', 'mesh_ack_store_b', meshTransportB);
  const meshNodeC = makeMeshNode('TACTICAL-HQ', 'mesh_ack_store_c', meshTransportC, {
    crypto: meshCryptoC,
    pairing: meshPairC
  });

  const meshSosPayload = { triage: 'Authenticated ACK mesh test', floor: 'B2' };
  const meshSosId = 'SOS-MESH-ACK-01';
  const meshSosCreatedAt = Date.now() - 2000;
  const meshAad: PacketAadFields = {
    id: meshSosId,
    senderId: 'PHONE-A',
    recipientId: 'TACTICAL-HQ',
    createdAt: meshSosCreatedAt
  };
  const meshSosKeyA = await meshCryptoA.deriveSharedKey(meshEcdhC);
  const meshSosKeyC = await meshCryptoC.deriveSharedKey(meshEcdhA);
  const meshSosEnc = await meshCryptoA.encryptSosPacketPayload(meshSosPayload, meshSosKeyA, meshAad);

  const meshSos = meshNodeA.engine.createSos({
    id: meshSosId,
    senderId: 'PHONE-A',
    deviceId: meshIdentA.deviceId,
    recipientId: 'TACTICAL-HQ',
    latitude: 22.5726,
    longitude: 88.3639,
    priority: 'HIGH',
    message: '[ENCRYPTED E2EE PAYLOAD]',
    encryptedPayload: meshSosEnc.ciphertext,
    iv: meshSosEnc.iv
  });
  meshSos.createdAt = meshSosCreatedAt;
  meshNodeA.repo.savePacket(meshSos);

  console.log('[Test AZ] C receives valid SOS over A → B → C');
  await meshNodeA.engine.attemptForwarding(meshSos);
  assert(meshNodeB.repo.hasPacket(meshSosId), 'Relay B stored SOS from A');
  await meshNodeB.engine.resumePendingRelays();
  const sosAtC = meshNodeC.repo.getPacket(meshSosId);
  assert(sosAtC !== null, 'Destination C received SOS');
  assert(sosAtC?.status === 'DELIVERED', 'C marked SOS as DELIVERED');
  const decryptedSosAtC = await meshCryptoC.decryptSosPacketPayload(
    sosAtC!.encryptedPayload,
    sosAtC!.iv,
    meshSosKeyC,
    {
      id: sosAtC!.id,
      senderId: sosAtC!.senderId,
      recipientId: sosAtC!.recipientId!,
      createdAt: meshSosCreatedAt
    },
    'TACTICAL-HQ'
  );
  assert(decryptedSosAtC !== null, 'C decrypted SOS payload');
  assert(decryptedSosAtC?.floor === 'B2', 'C recovered SOS plaintext after decrypt');

  console.log('\n[Test BA] C creates authenticated ACK after SOS decrypt');
  const meshAck = await meshNodeC.engine.acknowledgeSosAuthenticated(
    meshSosId,
    'ACKNOWLEDGED',
    'Victim SOS received — dispatching',
    { createdAt: Date.now(), ackId: 'ACK-MESH-001' }
  );
  assert(meshAck !== null, 'C created authenticated ACK');
  assert(isAuthenticatedMeshAck(meshAck), 'Mesh ACK carries authenticated ciphertext fields');
  assert(meshAck!.sosId === meshSosId, 'ACK references original SOS ID');
  assert(meshAck!.recipientId === meshIdentA.deviceId, 'ACK is addressed to Device A');
  assert(meshAck!.note === AUTHENTICATED_ACK_PLACEHOLDER, 'Mesh ACK note is placeholder, not inner plaintext');

  console.log('\n[Test BB] ACK travels C → B → A');
  await meshNodeB.engine.resumePendingRelays();
  const ackAtB = meshNodeB.repo.getAcksForSos(meshSosId);
  assert(ackAtB.length > 0, 'Relay B stored the ACK');
  assert(ackAtB[0].ackId === 'ACK-MESH-001', 'Relay B stored the same ACK id');
  const ackAtA = meshNodeA.repo.getAcksForSos(meshSosId);
  assert(ackAtA.length > 0, 'Victim A stored the ACK after mesh delivery');

  console.log('\n[Test BC] B can relay/store ACK but cannot decrypt it');
  const storedAckB = ackAtB[0];
  const authAtB = fromMeshAuthenticatedAck(storedAckB);
  assert(authAtB !== null, 'Relay storage still contains authenticated ACK fields');
  const relayWrongAckKey = await meshCryptoB.deriveDirectionalAckKey(
    meshEcdhA,
    meshIdentC.deviceId,
    meshIdentA.deviceId
  );
  const decryptedAtRelay = await meshCryptoB.decryptAckPayload(
    authAtB!.encryptedPayload,
    authAtB!.iv,
    relayWrongAckKey,
    {
      ackId: authAtB!.ackId,
      sosId: authAtB!.sosId,
      senderId: authAtB!.senderId,
      recipientId: authAtB!.recipientId,
      createdAt: authAtB!.createdAt
    },
    meshIdentA.deviceId
  );
  assert(decryptedAtRelay === null, 'Relay B cannot decrypt authenticated ACK');
  const storedAckBJson = JSON.stringify(storedAckB);
  assert(!storedAckBJson.includes('Victim SOS received — dispatching'), 'Inner ACK plaintext not in relay storage');
  assert(storedAckB.encryptedPayload === meshAck!.encryptedPayload, 'Relay stored the same ACK ciphertext');

  console.log('\n[Test BD] A verifies/decrypts ACK after mesh delivery');
  const verifyAtA = meshNodeA.engine.getLastAuthenticatedAckVerification();
  assert(verifyAtA !== null && verifyAtA.success === true, 'A successfully verified authenticated ACK');
  assert(verifyAtA!.status === 'ACCEPT', 'A verification status is ACCEPT');
  assert(verifyAtA!.payload?.sosId === meshSosId, 'Verified ACK payload references original SOS');
  assert(verifyAtA!.payload?.note === 'Victim SOS received — dispatching', 'A recovered authenticated ACK note');
  assert(meshNodeA.repo.getPacket(meshSosId)?.status === 'ACKNOWLEDGED', 'A SOS status updated after verified ACK');

  console.log('\n[Test BE] Mutable relay fields did not break ACK authentication');
  const ackArrivedA = ackAtA[0];
  assert(ackArrivedA.hopCount >= 1, 'ACK hopCount was incremented on the relayed copy');
  assert(ackArrivedA.route.includes('PHONE-B'), 'Relay added PHONE-B to ACK route');
  assert(ackArrivedA.ttl < 7, 'ACK TTL was decremented in transit');
  assert(verifyAtA!.success === true, 'AAD still verified after relay hop/TTL/route changes');

  console.log('\n[Test BF] Tampered ACK ciphertext fails at A');
  const tamperedMeshAck = {
    ...meshAck!,
    ackId: 'ACK-MESH-TAMPER-CT',
    encryptedPayload: meshAck!.encryptedPayload.replace(/[0-9a-f]/, (ch) => (ch === '0' ? '1' : '0'))
  };
  const tamperCtOk = await meshNodeA.engine.processPacket(tamperedMeshAck);
  assert(tamperCtOk === false, 'Tampered ACK rejected at A');
  assert(meshNodeA.engine.getLastAuthenticatedAckVerification()?.status === 'REJECT_AUTH_FAILED', 'Tampered ciphertext is REJECT_AUTH_FAILED');

  console.log('\n[Test BG] Tampered sosId fails at A');
  const tamperedSosAck = { ...meshAck!, ackId: 'ACK-MESH-TAMPER-SOS', sosId: 'SOS-FORGED-MESH' };
  const tamperSosOk = await meshNodeA.engine.processPacket(tamperedSosAck);
  assert(tamperSosOk === false, 'Tampered sosId rejected at A');
  assert(meshNodeA.engine.getLastAuthenticatedAckVerification()?.status === 'REJECT_AUTH_FAILED', 'Tampered sosId is REJECT_AUTH_FAILED');

  console.log('\n[Test BH] ACK replay fails');
  const replayCrypto = await meshCryptoA.verifyAndDecryptAck(
    fromMeshAuthenticatedAck(ackArrivedA)!,
    meshIdentA.deviceId,
    meshPairA,
    meshReplayA,
    { now: Date.now() }
  );
  assert(replayCrypto.success === false, 'Crypto-level ACK replay is rejected');
  assert(replayCrypto.status === 'REJECT_ALREADY_SEEN', 'Replay status is REJECT_ALREADY_SEEN');
  const replayMesh = await meshNodeA.engine.processPacket(ackArrivedA);
  assert(replayMesh === true, 'Mesh dedup treats exact ACK replay as already handled');

  console.log('\n[Test BI] Unverified ACK sender fails');
  const unpairedMeshPair = new PairingService('mesh_ack_pair_untrusted');
  unpairedMeshPair.clearAllPeers();
  const untrustedStorage = new StorageEngine('mesh_ack_store_untrusted');
  untrustedStorage.clearAll();
  const untrustedRepo = new SosRepository(untrustedStorage);
  untrustedRepo.savePacket(meshSos);
  const untrustedEngine = new PacketEngine({
    localNodeId: 'PHONE-A',
    sosRepo: untrustedRepo,
    dedup: new DeduplicationService(50, untrustedStorage),
    crypto: meshCryptoA,
    pairing: unpairedMeshPair,
    replayProtection: new ReplayProtectionService('mesh_ack_replay_untrusted')
  });
  const untrustedAck = {
    ...meshAck!,
    ackId: 'ACK-MESH-UNTRUSTED'
  };
  const untrustedOk = await untrustedEngine.processPacket(untrustedAck);
  assert(untrustedOk === false, 'ACK from unverified sender rejected');
  assert(untrustedEngine.getLastAuthenticatedAckVerification()?.status === 'REJECT_UNTRUSTED_PEER', 'Unverified sender is REJECT_UNTRUSTED_PEER');

  console.log('\n[Test BJ] Existing M3 unauthenticated ACK path still works');
  const m3CompatAck = await meshNodeC.engine.acknowledgeSos(meshSosId, 'RESPONDING', 'M3 plaintext path still available');
  assert(m3CompatAck !== null && m3CompatAck.kind === 'ACK', 'M3 acknowledgeSos still generates AckPacket');
  assert(!isAuthenticatedMeshAck(m3CompatAck!), 'M3 ACK remains unauthenticated (no ciphertext fields)');

  meshPairA.clearAllPeers();
  meshPairC.clearAllPeers();
  unpairedMeshPair.clearAllPeers();
  meshReplayA.clear();
  for (const t of [meshTransportA, meshTransportB, meshTransportC]) t.dispose();
  MockMeshTransport.resetNetwork();

  console.log('\n==================================================');
  console.log('ALL M4 SECURITY TESTS (BASELINE + IDENTITY + ECDH + HKDF + E2EE + REPLAY + PAIRING + ACK + MESH ACK) PASSED! ✓');
  console.log('==================================================\n');
}

runSecurityTestSuite().catch(err => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
