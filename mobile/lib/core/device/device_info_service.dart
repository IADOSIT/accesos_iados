import 'dart:math';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart'
    show kIsWeb, defaultTargetPlatform, TargetPlatform;
import '../storage/secure_storage.dart';

class DeviceInfoService {
  static final DeviceInfoPlugin _plugin = DeviceInfoPlugin();

  static String _generateUUID() {
    final rng = Random.secure();
    final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  /// Returns a stable UUID for this device installation.
  /// Generated once and persisted in SecureStorage.
  static Future<String> getDeviceId(SecureStorage storage) async {
    final saved = await storage.getDeviceId();
    if (saved != null && saved.isNotEmpty) return saved;
    final id = _generateUUID();
    await storage.saveDeviceId(id);
    return id;
  }

  /// Returns a human-readable device name, e.g. "Samsung Galaxy S21".
  static Future<String?> getDeviceName() async {
    if (kIsWeb) return 'Web';
    try {
      if (defaultTargetPlatform == TargetPlatform.android) {
        final info = await _plugin.androidInfo;
        return '${info.manufacturer} ${info.model}';
      } else if (defaultTargetPlatform == TargetPlatform.iOS) {
        final info = await _plugin.iosInfo;
        return info.name;
      }
    } catch (_) {}
    return null;
  }

  static String get platform {
    if (kIsWeb) return 'web';
    if (defaultTargetPlatform == TargetPlatform.android) return 'android';
    if (defaultTargetPlatform == TargetPlatform.iOS) return 'ios';
    return 'unknown';
  }
}
