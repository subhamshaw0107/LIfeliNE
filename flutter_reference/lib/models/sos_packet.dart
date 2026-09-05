/// Production Dart SOS Packet Model for Android/iOS Offline Mesh.
class SosPacket {
  final String id;
  final String senderId; // Unique User ID of original SOS creator (e.g. PERSON-A)
  final String deviceId;
  final String userId;
  final String userName;
  final int timestamp;
  final String timeFormatted;
  final double latitude;
  final double longitude;
  final double gpsAccuracy;
  final String priority; // CRITICAL, HIGH, MEDIUM
  final String riskLevel; // CRITICAL, WARNING, SAFE
  final String disasterZoneName;
  final double distanceFromDisasterKm;
  final double distanceFromRescueKm;
  final String message;
  final String messageType;
  int ttl;
  int hopCount;
  List<String> route;
  String status;
  final String encryptionStatus;
  final String encryptedPayloadHex;
  final String ivHex;
  final int batteryLevel;

  SosPacket({
    required this.id,
    required this.senderId,
    required this.deviceId,
    required this.userId,
    required this.userName,
    required this.timestamp,
    required this.timeFormatted,
    required this.latitude,
    required this.longitude,
    required this.gpsAccuracy,
    required this.priority,
    required this.riskLevel,
    required this.disasterZoneName,
    required this.distanceFromDisasterKm,
    required this.distanceFromRescueKm,
    required this.message,
    required this.messageType,
    required this.ttl,
    required this.hopCount,
    required this.route,
    required this.status,
    required this.encryptionStatus,
    required this.encryptedPayloadHex,
    required this.ivHex,
    required this.batteryLevel,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'senderId': senderId,
        'deviceId': deviceId,
        'userId': userId,
        'userName': userName,
        'timestamp': timestamp,
        'timeFormatted': timeFormatted,
        'latitude': latitude,
        'longitude': longitude,
        'gpsAccuracy': gpsAccuracy,
        'priority': priority,
        'riskLevel': riskLevel,
        'disasterZoneName': disasterZoneName,
        'distanceFromDisasterKm': distanceFromDisasterKm,
        'distanceFromRescueKm': distanceFromRescueKm,
        'message': message,
        'messageType': messageType,
        'ttl': ttl,
        'hopCount': hopCount,
        'route': route,
        'status': status,
        'encryptionStatus': encryptionStatus,
        'encryptedPayloadHex': encryptedPayloadHex,
        'ivHex': ivHex,
        'batteryLevel': batteryLevel,
      };

  factory SosPacket.fromJson(Map<String, dynamic> json) => SosPacket(
        id: json['id'],
        senderId: json['senderId'] ?? json['userId'] ?? 'PERSON-A',
        deviceId: json['deviceId'],
        userId: json['userId'],
        userName: json['userName'],
        timestamp: json['timestamp'],
        timeFormatted: json['timeFormatted'],
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        gpsAccuracy: (json['gpsAccuracy'] as num).toDouble(),
        priority: json['priority'],
        riskLevel: json['riskLevel'],
        disasterZoneName: json['disasterZoneName'],
        distanceFromDisasterKm: (json['distanceFromDisasterKm'] as num).toDouble(),
        distanceFromRescueKm: (json['distanceFromRescueKm'] as num).toDouble(),
        message: json['message'],
        messageType: json['messageType'],
        ttl: json['ttl'],
        hopCount: json['hopCount'],
        route: List<String>.from(json['route'] ?? []),
        status: json['status'],
        encryptionStatus: json['encryptionStatus'],
        encryptedPayloadHex: json['encryptedPayloadHex'],
        ivHex: json['ivHex'],
        batteryLevel: json['batteryLevel'],
      );
}
