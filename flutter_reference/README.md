# LIFELINE – Offline Disaster Rescue Network (Flutter Reference Architecture)

This directory contains the production Dart & Flutter architecture code ready for direct compilation into native Android and iOS applications.

## Architecture Highlights
1. **Zero-Questionnaire One-Tap SOS**: `VictimHomeScreen` with instant geolocation capture.
2. **Authenticated AES-GCM 256 Encryption**: `CryptoService` generates unique 96-bit nonces per packet using `cryptography` / `pointycastle`.
3. **Store-Carry-Forward Mesh (DTN)**: `MeshService` abstracts Bluetooth Low Energy (BLE), Wi-Fi Direct, and Wi-Fi Aware.
4. **Offline Persistence**: SQLite schema via `sqflite` with seen message deduplication cache and packet queue.
5. **Google Maps SDK Integration**: `GoogleMaps` widget with GPS decoupled from mesh transmission.

## Native Android Permissions Required (`AndroidManifest.xml`)
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
<uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />
<uses-permission android:name="android.permission.NEARBY_WIFI_DEVICES" />
```

## Compilation Commands
```bash
# Get dependencies
flutter pub get

# Run on connected Android phone or emulator
flutter run

# Build release APK
flutter build apk --release
```
