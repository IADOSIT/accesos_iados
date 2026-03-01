import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../storage/secure_storage.dart';

// URL configurable via --dart-define=API_URL=https://tu-vps.com
// Dev Android emulator: http://10.0.2.2:3001/api
// Dev Web: http://localhost:3001/api
// Producción VPS: https://api.tu-dominio.com/api
const _apiUrl = String.fromEnvironment('API_URL');

String get _baseUrl {
  if (_apiUrl.isNotEmpty) return _apiUrl;
  return kIsWeb ? 'http://localhost:3001/api' : 'http://10.0.2.2:3001/api';
}

final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.watch(secureStorageProvider);
  return ApiClient(storage);
});

class ApiClient {
  final SecureStorage _storage;
  late final Dio _dio;

  /// Llamado cuando el servidor devuelve 401 (token expirado/inválido).
  /// AuthNotifier lo asigna para limpiar el estado y redirigir al login.
  void Function()? onUnauthorized;

  ApiClient(this._storage) {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: _onRequest,
      onError: _onError,
    ));
  }

  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.getToken();
    final tenantId = await _storage.getTenantId();

    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    if (tenantId != null) {
      options.headers['x-tenant-id'] = tenantId;
    }
    handler.next(options);
  }

  Future<void> _onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    if (error.response?.statusCode == 401) {
      await _storage.clear();
      onUnauthorized?.call();
    }
    handler.next(error);
  }

  Future<Response> get(String path, {Map<String, dynamic>? params}) =>
      _dio.get(path, queryParameters: params);

  Future<Response> post(String path, {dynamic data}) =>
      _dio.post(path, data: data);

  Future<Response> put(String path, {dynamic data}) =>
      _dio.put(path, data: data);

  Future<Response> patch(String path, {dynamic data}) =>
      _dio.patch(path, data: data);

  Future<Response> delete(String path) => _dio.delete(path);
}
