import 'dart:async';
import 'dart:math';
import '../models/sos_packet.dart';

/// Offline Mesh Communication Service (Store-Carry-Forward DTN Layer).
/// Ready for integration with Android Nearby Connections / Wi-Fi Direct / BLE.
class MeshService {
  static final MeshService _instance = MeshService._internal();
  factory MeshService() => _instance;
  MeshService._internal();

  final Set<String> _seenMessageIds = {};
  final List<SosPacket> _localBufferQueue = [];

  final StreamController<SosPacket> _packetStream = StreamController<SosPacket>.broadcast();
  Stream<SosPacket> get onPacketReceived => _packetStream.stream;

  /// Haversine formula calculation in kilometers
  double calculateDistanceKm(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371.0;
    final dLat = (lat2 - lat1) * pi / 180.0;
    final dLon = (lon2 - lon1) * pi / 180.0;
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1 * pi / 180.0) * cos(lat2 * pi / 180.0) * sin(dLon / 2) * sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return double.parse((r * c).toStringAsFixed(2));
  }

  /// Store-Carry-Forward transmission entry point
  Future<void> sendSosPacket(SosPacket packet) async {
    _seenMessageIds.add(packet.id);
    _localBufferQueue.add(packet);

    // In a real device: broadcast via Wi-Fi Aware / BLE advertisements
    // In simulated prototype: evaluate neighboring nodes within ~1.0 km range
    _simulateMeshPropagation(packet);
  }

  void _simulateMeshPropagation(SosPacket packet) async {
    await Future.delayed(const Duration(milliseconds: 800));
    packet.status = 'RELAYING';
    packet.hopCount += 1;
    packet.ttl -= 1;
    packet.route.add('Relay Node (Nearby Volunteer Phone)');

    await Future.delayed(const Duration(milliseconds: 900));
    packet.status = 'DELIVERED';
    packet.route.add('Lifeline Rescue Gateway');
    _packetStream.add(packet);
  }
}
