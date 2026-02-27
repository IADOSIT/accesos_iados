import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

final secureStorageProvider = Provider<SecureStorage>((ref) => SecureStorage());

class SecureStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _keyToken = 'auth_token';
  static const _keyRefreshToken = 'refresh_token';
  static const _keyTenantId = 'tenant_id';
  static const _keyUserId = 'user_id';
  static const _keyUserRole = 'user_role';
  static const _keyTenantName = 'tenant_name';
  static const _keyTenantSlug = 'tenant_slug';
  static const _keyFirstName = 'user_first_name';
  static const _keyLastName = 'user_last_name';

  // En web usa SharedPreferences, en móvil usa FlutterSecureStorage
  Future<void> _write(String key, String value) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, value);
    } else {
      await _storage.write(key: key, value: value);
    }
  }

  Future<String?> _read(String key) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(key);
    } else {
      return _storage.read(key: key);
    }
  }

  Future<void> _deleteAll() async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.clear();
    } else {
      await _storage.deleteAll();
    }
  }

  Future<void> saveToken(String token) => _write(_keyToken, token);
  Future<String?> getToken() => _read(_keyToken);

  Future<void> saveRefreshToken(String token) => _write(_keyRefreshToken, token);
  Future<String?> getRefreshToken() => _read(_keyRefreshToken);

  Future<void> saveTenantId(String tenantId) => _write(_keyTenantId, tenantId);
  Future<String?> getTenantId() => _read(_keyTenantId);

  Future<void> saveTenantName(String name) => _write(_keyTenantName, name);
  Future<String?> getTenantName() => _read(_keyTenantName);

  Future<void> saveTenantSlug(String slug) => _write(_keyTenantSlug, slug);
  Future<String?> getTenantSlug() => _read(_keyTenantSlug);

  Future<void> saveUserId(String userId) => _write(_keyUserId, userId);
  Future<String?> getUserId() => _read(_keyUserId);

  Future<void> saveUserRole(String role) => _write(_keyUserRole, role);
  Future<String?> getUserRole() => _read(_keyUserRole);

  Future<void> saveFirstName(String name) => _write(_keyFirstName, name);
  Future<String?> getFirstName() => _read(_keyFirstName);

  Future<void> saveLastName(String name) => _write(_keyLastName, name);
  Future<String?> getLastName() => _read(_keyLastName);

  Future<void> saveSession({
    required String token,
    required String tenantId,
    required String userId,
    required String role,
    String? tenantName,
    String? tenantSlug,
    String? refreshToken,
    String? firstName,
    String? lastName,
  }) async {
    await Future.wait([
      saveToken(token),
      saveTenantId(tenantId),
      saveUserId(userId),
      saveUserRole(role),
      if (tenantName != null) saveTenantName(tenantName),
      if (tenantSlug != null) saveTenantSlug(tenantSlug),
      if (refreshToken != null) saveRefreshToken(refreshToken),
      if (firstName != null) saveFirstName(firstName),
      if (lastName != null) saveLastName(lastName),
    ]);
  }

  Future<bool> hasSession() async {
    final token = await getToken();
    final tenantId = await getTenantId();
    return token != null && tenantId != null;
  }

  Future<void> clear() => _deleteAll();
}
