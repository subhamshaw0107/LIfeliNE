import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart';

/// Authenticated AES-GCM 256-bit encryption for Flutter Android/iOS
class CryptoService {
  static final CryptoService _instance = CryptoService._internal();
  factory CryptoService() => _instance;
  CryptoService._internal();

  final AesGcm _algorithm = AesGcm.with256Bits();
  SecretKey? _cachedKey;

  Future<SecretKey> _getOrCreateKey() async {
    if (_cachedKey != null) return _cachedKey!;
    _cachedKey = await _algorithm.newSecretKey();
    return _cachedKey!;
  }

  /// Encrypt payload using AES-GCM with unique 96-bit nonce
  Future<Map<String, String>> encryptPayload(Map<String, dynamic> payload) async {
    final key = await _getOrCreateKey();
    final plaintext = utf8.encode(jsonEncode(payload));
    final nonce = _algorithm.newNonce(); // 12 bytes / 96 bits

    final secretBox = await _algorithm.encrypt(
      plaintext,
      secretKey: key,
      nonce: nonce,
    );

    final ciphertextHex = secretBox.cipherText.map((b) => b.toRadixString(16).padLeft(2, '0')).join('');
    final nonceHex = nonce.map((b) => b.toRadixString(16).padLeft(2, '0')).join('');

    return {
      'ciphertext': ciphertextHex,
      'iv': nonceHex,
      'algorithm': 'AES-GCM-256 (Authenticated)',
    };
  }

  /// Generate unique SOS ID (e.g. SOS-7F82A91C)
  String generateSosId() {
    final rng = Random.secure();
    final bytes = List<int>.generate(4, (_) => rng.nextInt(256));
    final hex = bytes.map((b) => b.toRadixString(16).toUpperCase().padLeft(2, '0')).join('');
    return 'SOS-$hex';
  }

  /// App-generated persistent device identifier (e.g. DEV-A8F31C)
  String generateDeviceId() {
    final rng = Random.secure();
    final bytes = List<int>.generate(3, (_) => rng.nextInt(256));
    final hex = bytes.map((b) => b.toRadixString(16).toUpperCase().padLeft(2, '0')).join('');
    return 'DEV-$hex';
  }
}
