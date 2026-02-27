import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/storage/secure_storage.dart';
import '../../core/network/api_client.dart';

// Estado de sesión del usuario
class AuthState {
  final bool isAuthenticated;
  final String? userId;
  final String? tenantId;
  final String? tenantName;
  final String? tenantSlug;
  final String? role;
  final String? firstName;
  final String? lastName;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.isAuthenticated = false,
    this.userId,
    this.tenantId,
    this.tenantName,
    this.tenantSlug,
    this.role,
    this.firstName,
    this.lastName,
    this.isLoading = false,
    this.error,
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
    String? firstName,
    String? lastName,
    bool? isLoading,
    String? error,
  }) =>
      AuthState(
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
        userId: userId ?? this.userId,
        tenantId: tenantId ?? this.tenantId,
        tenantName: tenantName ?? this.tenantName,
        tenantSlug: tenantSlug ?? this.tenantSlug,
        role: role ?? this.role,
        firstName: firstName ?? this.firstName,
        lastName: lastName ?? this.lastName,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  final SecureStorage _storage;
  final ApiClient _api;

  AuthNotifier(this._storage, this._api) : super(const AuthState()) {
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
      ]);
      state = AuthState(
        isAuthenticated: true,
        tenantId: results[0],
        userId: results[1],
        role: results[2],
        tenantName: results[3],
        tenantSlug: results[4],
        firstName: results[5],
        lastName: results[6],
      );
    } else {
      state = const AuthState();
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _api.post('/auth/login', data: {
        'email': email,
        'password': password,
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
      final tenant = tenants.first;
      final tenantId = tenant['tenantId'] as String;
      final role = tenant['role'] as String;
      final tenantName = tenant['tenantName'] as String?;
      final firstName = user['firstName'] as String?;
      final lastName = user['lastName'] as String?;

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

      state = AuthState(
        isAuthenticated: true,
        userId: user['id'] as String,
        tenantId: tenantId,
        role: role,
        tenantName: tenantName,
        tenantSlug: null,
        firstName: firstName,
        lastName: lastName,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Credenciales incorrectas',
      );
      return false;
    }
  }

  Future<void> logout() async {
    await _storage.clear();
    state = const AuthState();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final storage = ref.watch(secureStorageProvider);
  final api = ref.watch(apiClientProvider);
  return AuthNotifier(storage, api);
});
