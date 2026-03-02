import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import 'auth_provider.dart';

// ── Modelo ─────────────────────────────────────────────────────────────────

class TenantConfig {
  final bool showResidentAccessButton;
  final bool showVisitorAccessButton;
  final bool showExitButton;
  final bool quickQrEnabled;
  final int quickQrDurationHours;
  final int quickQrMaxUses;
  final String uiTheme; // "DARK" | "LIGHT"

  const TenantConfig({
    this.showResidentAccessButton = false,
    this.showVisitorAccessButton = false,
    this.showExitButton = false,
    this.quickQrEnabled = false,
    this.quickQrDurationHours = 2,
    this.quickQrMaxUses = 3,
    this.uiTheme = 'DARK',
  });

  factory TenantConfig.fromJson(Map<String, dynamic> settings) {
    final flags = (settings['featureFlags'] is Map)
        ? settings['featureFlags'] as Map<String, dynamic>
        : <String, dynamic>{};

    return TenantConfig(
      showResidentAccessButton: flags['showResidentAccessButton'] as bool? ?? false,
      showVisitorAccessButton:  flags['showVisitorAccessButton']  as bool? ?? false,
      showExitButton:           flags['showExitButton']           as bool? ?? false,
      quickQrEnabled:           flags['quickQrEnabled']           as bool? ?? false,
      quickQrDurationHours:     (flags['quickQrDurationHours']    as num?)?.toInt() ?? 2,
      quickQrMaxUses:           (flags['quickQrMaxUses']          as num?)?.toInt() ?? 3,
      uiTheme:                  settings['uiTheme']               as String? ?? 'DARK',
    );
  }

  bool get isLight => uiTheme == 'LIGHT';
}

// ── Provider ───────────────────────────────────────────────────────────────

final tenantConfigProvider = FutureProvider.autoDispose<TenantConfig>((ref) async {
  final auth = ref.watch(authProvider);
  if (!auth.isAuthenticated || auth.tenantId == null) {
    return const TenantConfig();
  }
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get('/config/tenant');
    final data = res.data['data'];
    final settings = (data['settings'] is Map)
        ? data['settings'] as Map<String, dynamic>
        : <String, dynamic>{};
    return TenantConfig.fromJson(settings);
  } catch (_) {
    return const TenantConfig();
  }
});
