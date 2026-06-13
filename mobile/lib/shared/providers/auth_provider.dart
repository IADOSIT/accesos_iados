import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart' show MethodChannel;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../core/storage/secure_storage.dart';
import '../../core/network/api_client.dart';
import '../../core/device/device_info_service.dart';

// Estado de sesión del usuario
class AuthState {
  final bool isAuthenticated;
  final String? userId;
  final String? tenantId;
  final String? tenantName;
  final String? tenantSlug;
  final String? role;
  final String? unitId;
  final String? firstName;
  final String? lastName;
  final bool isLoading;
  final String? error;
  final bool mustChangePassword;

  final bool deviceLimitReached;

  const AuthState({
    this.isAuthenticated = false,
    this.userId,
    this.tenantId,
    this.tenantName,
    this.tenantSlug,
    this.role,
    this.unitId,
    this.firstName,
    this.lastName,
    this.isLoading = false,
    this.error,
    this.mustChangePassword = false,
    this.deviceLimitReached = false,
  });

  bool get isAdmin => role == 'ADMIN';
  bool get isGuard => role == 'GUARD';
  bool get isResident => role == 'RESIDENT';

  String get displayName {
    final name = '${firstName ?? ''} ${lastName ?? ''}'.trim();
    return name.isNotEmpty ? name : (role ?? 'Usuario');
  }

  AuthState copyWith({
    bool? isAuthenticated,
    String? userId,
    String? tenantId,
    String? tenantName,
    String? tenantSlug,
    String? role,
    String? unitId,
    String? firstName,
    String? lastName,
    bool? isLoading,
    String? error,
    bool? mustChangePassword,
    bool? deviceLimitReached,
  }) =>
      AuthState(
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
        userId: userId ?? this.userId,
        tenantId: tenantId ?? this.tenantId,
        tenantName: tenantName ?? this.tenantName,
        tenantSlug: tenantSlug ?? this.tenantSlug,
        role: role ?? this.role,
        unitId: unitId ?? this.unitId,
        firstName: firstName ?? this.firstName,
        lastName: lastName ?? this.lastName,
        isLoading: isLoading ?? this.isLoading,
        error: error,
        mustChangePassword: mustChangePassword ?? this.mustChangePassword,
        deviceLimitReached: deviceLimitReached ?? this.deviceLimitReached,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  final SecureStorage _storage;
  final ApiClient _api;

  AuthNotifier(this._storage, this._api) : super(const AuthState()) {
    _api.onUnauthorized = () {
      state = const AuthState(); // token expirado → redirige al login via GoRouter
    };
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    state = state.copyWith(isLoading: true);
    final hasSession = await _storage.hasSession();
    if (hasSession) {
      final results = await Future.wait([
        _storage.getTenantId(),
        _storage.getUserId(),
        _storage.getUserRole(),
        _storage.getTenantName(),
        _storage.getTenantSlug(),
        _storage.getFirstName(),
        _storage.getLastName(),
        _storage.getUnitId(),
      ]);
      final mustChange = await _storage.getMustChangePassword();
      state = AuthState(
        isAuthenticated: true,
        tenantId: results[0],
        userId: results[1],
        role: results[2],
        tenantName: results[3],
        tenantSlug: results[4],
        firstName: results[5],
        lastName: results[6],
        unitId: results[7],
        mustChangePassword: mustChange,
      );
      _registerFCMToken(); // refrescar token en caso de que Firebase lo rotó
    } else {
      state = const AuthState();
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null, deviceLimitReached: false);
    try {
      final deviceId = await DeviceInfoService.getDeviceId(_storage);
      final deviceName = await DeviceInfoService.getDeviceName();
      final platform = DeviceInfoService.platform;

      final response = await _api.post('/auth/login', data: {
        'email': email,
        'password': password,
        'deviceId': deviceId,
        if (deviceName != null) 'deviceName': deviceName,
        'platform': platform,
      });

      final data = response.data['data'];
      // La API devuelve 'accessToken', no 'token'
      final token = data['accessToken'] as String;
      final user = data['user'];
      final tenants = user['tenants'] as List;
      if (tenants.isEmpty) {
        state = state.copyWith(isLoading: false, error: 'Sin fraccionamiento asignado');
        return false;
      }
      // Respetar el tenant guardado si el usuario sigue perteneciendo a él
      final savedTenantId = await _storage.getTenantId();
      final tenant = (savedTenantId != null
              ? tenants.firstWhere(
                  (t) => t['tenantId'] == savedTenantId,
                  orElse: () => tenants.first,
                )
              : tenants.first) as Map;
      final tenantId = tenant['tenantId'] as String;
      final role = tenant['role'] as String;
      final tenantName = tenant['tenantName'] as String?;
      final unitId = tenant['unitId'] as String?;
      final firstName = user['firstName'] as String?;
      final lastName = user['lastName'] as String?;
      final mustChange = data['mustChangePassword'] == true;

      await _storage.saveSession(
        token: token,
        tenantId: tenantId,
        userId: user['id'] as String,
        role: role,
        tenantName: tenantName,
        tenantSlug: null,
        firstName: firstName,
        lastName: lastName,
      );
      if (unitId != null) await _storage.saveUnitId(unitId);
      await _storage.saveMustChangePassword(mustChange);

      state = AuthState(
        isAuthenticated: true,
        userId: user['id'] as String,
        tenantId: tenantId,
        role: role,
        unitId: unitId,
        tenantName: tenantName,
        tenantSlug: null,
        firstName: firstName,
        lastName: lastName,
        mustChangePassword: mustChange,
      );
      _registerFCMToken(); // fire-and-forget, no bloquea el login
      return true;
    } on DioException catch (e) {
      if (e.response?.statusCode == 423) {
        final msg = e.response?.data?['message'] as String? ??
            'Límite de dispositivos alcanzado. Pide al administrador que revoque un dispositivo registrado.';
        state = state.copyWith(isLoading: false, error: msg, deviceLimitReached: true);
      } else {
        state = state.copyWith(isLoading: false, error: 'Credenciales incorrectas', deviceLimitReached: false);
      }
      return false;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Credenciales incorrectas', deviceLimitReached: false);
      return false;
    }
  }

  Future<void> logout() async {
    // Limpiar token FCM del servidor para que no lleguen notificaciones al dispositivo
    if (!kIsWeb) {
      try {
        await _api.put('/auth/fcm-token', data: {'token': ''});
        await FirebaseMessaging.instance.deleteToken();
      } catch (_) {}
    }
    await _storage.clear();
    state = const AuthState();
  }

  Future<void> clearForceChangePassword() async {
    await _storage.saveMustChangePassword(false);
    state = state.copyWith(mustChangePassword: false);
  }

  Future<void> _registerFCMToken() async {
    if (kIsWeb) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      final deviceId = await _storage.getDeviceId();
      final body = {'token': token, if (deviceId != null) 'deviceId': deviceId};
      await _api.put('/auth/fcm-token', data: body);
      await _storage.saveFCMToken(token);
      // Actualizar token si Firebase lo rota
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
        try {
          final did = await _storage.getDeviceId();
          await _api.put('/auth/fcm-token', data: {'token': newToken, if (did != null) 'deviceId': did});
          await _storage.saveFCMToken(newToken);
        } catch (_) {}
      });
      // Solicitar exención de optimización de batería para recibir push con app cerrada
      _requestBatteryExemption();
    } catch (_) {} // silencioso — no afecta el login
  }

  void _requestBatteryExemption() {
    const channel = MethodChannel('mx.iados.acceso_digital/battery');
    channel.invokeMethod('requestExemption').catchError((_) {});
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final storage = ref.watch(secureStorageProvider);
  final api = ref.watch(apiClientProvider);
  return AuthNotifier(storage, api);
});
