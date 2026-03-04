import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:animate_do/animate_do.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_colors_scheme.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/providers/auth_provider.dart';
import '../../../shared/providers/tenant_config_provider.dart';
import '../../../shared/widgets/stat_card.dart';
import '../../../shared/widgets/iados_logo.dart';
import '../../../shared/widgets/panic_alert_dialog.dart';

final dashboardStatsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final auth = ref.watch(authProvider);
  if (auth.tenantId == null) return {};
  final res = await api.get('/reports/dashboard');
  return res.data['data'] as Map<String, dynamic>? ?? {};
});

final recentAccessProvider = FutureProvider<List<dynamic>>((ref) async {
  final auth = ref.watch(authProvider);
  if (auth.tenantId == null) return [];
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/access/logs', params: {'limit': '8'});
  return res.data['data'] as List? ?? [];
});

final recentServiceRequestsProvider = FutureProvider<List<dynamic>>((ref) async {
  final auth = ref.watch(authProvider);
  if (auth.tenantId == null) return [];
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get('/service-qr/requests', params: {'limit': '5'});
    return res.data['data'] as List? ?? [];
  } catch (_) {
    return [];
  }
});

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final stats = ref.watch(dashboardStatsProvider);
    final recentAccess = ref.watch(recentAccessProvider);

    final tenantConfigAsync = ref.watch(tenantConfigProvider);
    final recentServiceRequests = ref.watch(recentServiceRequestsProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: CustomScrollView(
        slivers: [
          // App Bar personalizado
          SliverAppBar(
            expandedHeight: 148,
            floating: false,
            pinned: true,
            backgroundColor: Theme.of(context).scaffoldBackgroundColor,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).scaffoldBackgroundColor,
                ),
                padding: const EdgeInsets.fromLTRB(20, 52, 20, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Fila: Logo + nombre fraccionamiento + badge rol
                    Row(
                      children: [
                        const _HexLogoSmall(),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            auth.tenantName ?? 'Acceso Digital',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Theme.of(context).colorScheme.onSurface,
                              letterSpacing: -0.3,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        _RoleBadge(auth: auth, ref: ref),
                      ],
                    ),
                    const SizedBox(height: 8),
                    // Saludo
                    Text(
                      _greeting(),
                      style: TextStyle(
                        fontSize: 13,
                        color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                      ),
                    ),
                    const SizedBox(height: 1),
                    // Versión
                    Text(
                      'v1.0.0',
                      style: TextStyle(
                        fontSize: 10,
                        color: Theme.of(context).colorScheme.onSurface.withOpacity(0.3),
                      ),
                    ),
                    const SizedBox(height: 4),
                    // Nombre del usuario
                    Text(
                      auth.displayName.isNotEmpty ? auth.displayName : '',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverList(
              delegate: SliverChildListDelegate([

                // Stats grid (ADMIN y GUARD)
                if (auth.isAdmin || auth.isGuard) ...[
                  FadeInUp(
                    duration: const Duration(milliseconds: 400),
                    child: stats.when(
                      loading: () => _StatsGrid(isLoading: true),
                      error: (_, __) => _StatsGrid(isLoading: false, error: true),
                      data: (data) => _StatsGrid(data: data),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // Resumen para RESIDENT
                if (auth.isResident) ...[
                  FadeInUp(
                    duration: const Duration(milliseconds: 400),
                    child: stats.when(
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (data) => _ResidentSummary(data: data),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // Botones de acceso configurables
                FadeInUp(
                  delay: const Duration(milliseconds: 200),
                  child: tenantConfigAsync.when(
                    loading: () => const SizedBox.shrink(),
                    error: (_, __) => const SizedBox.shrink(),
                    data: (config) => _AccessButtons(auth: auth, config: config),
                  ),
                ),

                const SizedBox(height: 24),

                // Botón de pánico — todos los roles, siempre visible
                FadeInUp(
                  delay: const Duration(milliseconds: 300),
                  child: const _PanicButton(),
                ),

                const SizedBox(height: 16),

                // Formas de pago — todos los roles (si está configurado)
                if (tenantConfigAsync.valueOrNull?.paymentConfig.hasInfo == true)
                  FadeInUp(
                    delay: const Duration(milliseconds: 350),
                    child: _PaymentShortcutCard(
                      config: tenantConfigAsync.valueOrNull!.paymentConfig,
                      role: auth.role,
                    ),
                  ),

                const SizedBox(height: 24),

                // Actividad reciente (todos los roles)
                FadeInUp(
                  delay: const Duration(milliseconds: 400),
                  child: Row(
                    children: [
                      Text(
                        auth.isResident ? 'Mis accesos recientes' : AppStrings.recentActivity,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.onSurface,
                        ),
                      ),
                      const Spacer(),
                      if (auth.isAdmin || auth.isGuard)
                        TextButton(
                          onPressed: () => context.go('/access'),
                          child: const Text('Ver todo'),
                        ),
                    ],
                  ),
                ),

                const SizedBox(height: 8),

                Builder(builder: (context) {
                  if (recentAccess.isLoading || recentServiceRequests.isLoading) {
                    return _AccessLogSkeleton();
                  }
                  if (recentAccess.hasError) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(recentAccess.error.toString(),
                          style: TextStyle(color: context.colors.error, fontSize: 13)),
                    );
                  }

                  final logs = recentAccess.valueOrNull ?? [];
                  final svcReqs = recentServiceRequests.valueOrNull ?? [];

                  // Normalizar y combinar
                  final combined = [
                    ...logs.map((l) => _ActivityItem(type: 'access', data: l,
                        date: DateTime.tryParse(l['createdAt'] as String? ?? '') ?? DateTime(0))),
                    ...svcReqs.map((s) => _ActivityItem(type: 'service', data: s,
                        date: DateTime.tryParse(s['createdAt'] as String? ?? '') ?? DateTime(0))),
                  ]..sort((a, b) => b.date.compareTo(a.date));

                  final items = combined.take(10).toList();

                  if (items.isEmpty) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Center(
                        child: Text('Sin actividad reciente',
                            style: TextStyle(color: context.colors.textMuted, fontSize: 13)),
                      ),
                    );
                  }

                  return Column(
                    children: items.map((item) => item.type == 'service'
                        ? _ServiceRequestLogItem(data: item.data)
                        : _AccessLogItem(log: item.data)).toList(),
                  );
                }),

                const SizedBox(height: 80),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }
}

class _HexLogoSmall extends StatelessWidget {
  const _HexLogoSmall();
  @override
  Widget build(BuildContext context) =>
      const IadosLogo(size: 42, showText: false);
}

class _RoleBadge extends StatelessWidget {
  final AuthState auth;
  final WidgetRef ref;
  const _RoleBadge({required this.auth, required this.ref});

  Color _roleColor(BuildContext context) {
    final c = context.colors;
    switch (auth.role) {
      case 'ADMIN': return c.primary;
      case 'GUARD': return c.info;
      default: return c.textMuted;
    }
  }

  String get _roleLabel {
    switch (auth.role) {
      case 'ADMIN': return 'Administrador';
      case 'GUARD': return 'Guardia';
      default: return 'Residente';
    }
  }

  @override
  Widget build(BuildContext context) {
    final displayName = auth.displayName;
    final color = _roleColor(context);

    final badge = Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(
            radius: 10,
            backgroundColor: color.withOpacity(0.25),
            child: Text(
              displayName.isNotEmpty ? displayName[0].toUpperCase() : '?',
              style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 6),
          Text(
            displayName,
            style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
          ),
          const SizedBox(width: 2),
          Icon(Icons.arrow_drop_down, color: color, size: 16),
        ],
      ),
    );

    return PopupMenuButton<String>(
      onSelected: (value) async {
        if (value == 'profile') {
          context.push('/profile');
          return;
        }
        if (value == 'about') {
          final uri = Uri.parse('https://iados.mx');
          if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
          return;
        }
        if (value == 'logout') {
          final confirm = await showDialog<bool>(
            context: context,
            useRootNavigator: true,
            builder: (dialogCtx) {
                final c = dialogCtx.colors;
                return AlertDialog(
                  backgroundColor: c.bgCard,
                  title: Text('Cerrar sesión',
                      style: TextStyle(color: c.textPrimary)),
                  content: Text('¿Estás seguro que deseas salir?',
                      style: TextStyle(color: c.textSecondary)),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(dialogCtx, false),
                        child: const Text('Cancelar')),
                    TextButton(
                      onPressed: () => Navigator.pop(dialogCtx, true),
                      child: Text('Salir', style: TextStyle(color: c.error)),
                    ),
                  ],
                );
              },
          );
          if (confirm == true) {
            await ref.read(authProvider.notifier).logout();
          }
        }
      },
      color: context.colors.bgCard,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      itemBuilder: (_) {
        final c = context.colors;
        return [
          PopupMenuItem(
            enabled: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(displayName,
                    style: TextStyle(
                        color: c.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 14)),
                const SizedBox(height: 2),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(_roleLabel,
                      style: TextStyle(
                          color: color, fontSize: 11, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
          const PopupMenuDivider(),
          PopupMenuItem(
            value: 'profile',
            child: Row(
              children: [
                Icon(Icons.person_outline_rounded, color: c.textMuted, size: 18),
                const SizedBox(width: 10),
                Text('Mi perfil', style: TextStyle(color: c.textMuted, fontSize: 13)),
              ],
            ),
          ),
          PopupMenuItem(
            value: 'about',
            child: Row(
              children: [
                Icon(Icons.info_outline_rounded, color: c.textMuted, size: 18),
                const SizedBox(width: 10),
                Text('iados.mx', style: TextStyle(color: c.textMuted, fontSize: 13)),
              ],
            ),
          ),
          const PopupMenuDivider(),
          PopupMenuItem(
            value: 'logout',
            child: Row(
              children: [
                Icon(Icons.logout_rounded, color: c.error, size: 18),
                const SizedBox(width: 10),
                Text('Cerrar sesión', style: TextStyle(color: c.error)),
              ],
            ),
          ),
        ];
      },
      child: badge,
    );
  }
}

class _StatsGrid extends StatelessWidget {
  final Map<String, dynamic>? data;
  final bool isLoading;
  final bool error;

  const _StatsGrid({this.data, this.isLoading = false, this.error = false});

  @override
  Widget build(BuildContext context) {
    final stats = data ?? {};
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.35,
      children: [
        StatCard(
          label: AppStrings.todayAccess,
          value: stats['todayAccesses']?.toString() ?? '—',
          icon: Icons.login_rounded,
          accentColor: context.colors.primary,
          isLoading: isLoading,
        ),
        StatCard(
          label: AppStrings.activeUnits,
          value: stats['totalUnits']?.toString() ?? '—',
          icon: Icons.home_outlined,
          accentColor: context.colors.info,
          isLoading: isLoading,
        ),
        StatCard(
          label: AppStrings.pendingPayments,
          value: stats['delinquentUnits']?.toString() ?? '—',
          icon: Icons.receipt_long_outlined,
          accentColor: context.colors.warning,
          isLoading: isLoading,
        ),
        StatCard(
          label: AppStrings.devicesOnline,
          value: stats['onlineDevices']?.toString() ?? '—',
          icon: Icons.router_outlined,
          accentColor: context.colors.success,
          isLoading: isLoading,
        ),
      ],
    );
  }
}

// ── Resumen para RESIDENT ────────────────────────────────────────────────

class _ResidentSummary extends StatelessWidget {
  final Map<String, dynamic> data;
  const _ResidentSummary({required this.data});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final resident = data['resident'] as Map<String, dynamic>?;

    final isDelinquent = resident?['isDelinquent'] as bool? ?? false;
    final pendingCharges = resident?['pendingCharges'] as int? ?? 0;
    final pendingAmount = (resident?['pendingAmount'] as num?)?.toDouble() ?? 0.0;
    final nextDueDate = resident?['nextDueDate'] as String?;

    // Color basado en morosidad
    final statusColor = isDelinquent ? c.error : c.success;
    final paymentColor = isDelinquent ? c.error : (pendingCharges > 0 ? c.warning : c.success);

    String nextPayStr = '';
    if (nextDueDate != null) {
      try {
        final dt = DateTime.parse(nextDueDate).toLocal();
        nextPayStr = DateFormat('dd/MM/yyyy').format(dt);
      } catch (_) {}
    }

    final amountStr = pendingAmount > 0
        ? NumberFormat.currency(locale: 'es_MX', symbol: '\$').format(pendingAmount)
        : '\$0';

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _SummaryCard(
                icon: isDelinquent ? Icons.cancel_rounded : Icons.check_circle_outline_rounded,
                label: 'Estado cuenta',
                value: isDelinquent ? 'Moroso' : 'Al corriente',
                color: statusColor,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: GestureDetector(
                onTap: () => context.go('/payments'),
                child: _SummaryCard(
                  icon: Icons.receipt_long_rounded,
                  label: 'Saldo pendiente',
                  value: amountStr,
                  color: paymentColor,
                ),
              ),
            ),
          ],
        ),
        if (nextPayStr.isNotEmpty) ...[
          const SizedBox(height: 12),
          _SummaryCard(
            icon: Icons.calendar_today_rounded,
            label: 'Fecha límite de pago',
            value: nextPayStr,
            color: isDelinquent ? c.error : c.info,
            fullWidth: true,
          ),
        ],
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final bool fullWidth;
  const _SummaryCard({required this.icon, required this.label, required this.value, required this.color, this.fullWidth = false});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final card = Container(
      width: fullWidth ? double.infinity : null,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: fullWidth
          ? Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: color.withOpacity(0.1), shape: BoxShape.circle),
                  child: Icon(icon, color: color, size: 16),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: TextStyle(fontSize: 11, color: cs.onSurface.withOpacity(0.5))),
                    const SizedBox(height: 2),
                    Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color)),
                  ],
                ),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: color.withOpacity(0.1), shape: BoxShape.circle),
                  child: Icon(icon, color: color, size: 16),
                ),
                const SizedBox(height: 10),
                Text(label, style: TextStyle(fontSize: 11, color: cs.onSurface.withOpacity(0.5))),
                const SizedBox(height: 2),
                Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: color)),
              ],
            ),
    );
    return card;
  }
}

// ── Botones acceso configurables ──────────────────────────────────────────

class _AccessButtons extends ConsumerStatefulWidget {
  final AuthState auth;
  final TenantConfig config;
  const _AccessButtons({required this.auth, required this.config});

  @override
  ConsumerState<_AccessButtons> createState() => _AccessButtonsState();
}

class _AccessButtonsState extends ConsumerState<_AccessButtons> {
  final Map<String, bool> _loading = {};

  Future<void> _openGate({required String direction, String? accessType, String? deviceId}) async {
    final key = '$direction-${accessType ?? 'any'}';
    setState(() => _loading[key] = true);
    try {
      final api = ref.read(apiClientProvider);

      String? resolvedDeviceId = (deviceId != null && deviceId.isNotEmpty) ? deviceId : null;

      if (resolvedDeviceId == null) {
        // Solo ADMIN y GUARD pueden consultar la lista de dispositivos como fallback
        final auth = ref.read(authProvider);
        if (!auth.isAdmin && !auth.isGuard) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: const Text('Dispositivo no configurado. Contacta al administrador.'),
                backgroundColor: context.colors.warning,
              ),
            );
          }
          return;
        }
        // Fallback para ADMIN/GUARD: buscar el primer dispositivo ONLINE
        final devRes = await api.get('/devices');
        final allDevices = devRes.data['data'] as List? ?? [];
        List candidates = allDevices.where((d) => d['isActive'] != false).toList();
        if (accessType != null) {
          final typed = candidates.where((d) => d['accessType'] == accessType).toList();
          if (typed.isNotEmpty) candidates = typed;
        }
        final online = candidates.where((d) => d['status'] == 'ONLINE').toList();
        final selected = online.isNotEmpty ? online : candidates;
        if (selected.isEmpty) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: const Text('No hay dispositivos disponibles'), backgroundColor: context.colors.error),
            );
          }
          return;
        }
        resolvedDeviceId = selected.first['id'] as String;
      }

      final result = await api.post('/access/open', data: {
        'deviceId': resolvedDeviceId,
        'method': 'APP',
        'direction': direction,
      });

      final granted = result.data['data']?['granted'] as bool? ?? false;
      final reason  = result.data['data']?['reason']  as String? ?? '';

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(granted ? '✓ Comando enviado' : '✗ $reason'),
            backgroundColor: granted ? context.colors.success : context.colors.error,
          ),
        );
        if (granted) ref.invalidate(recentAccessProvider);
      }
    } catch (e) {
      if (mounted) {
        String msg = 'Error al enviar comando';
        if (e is DioException) {
          final data = e.response?.data;
          if (data is Map) {
            msg = data['message'] as String? ?? msg;
          } else if (e.response?.statusCode == 429) {
            msg = 'Espera unos segundos antes de intentar de nuevo';
          } else if (e.response?.statusCode == 403) {
            msg = 'Acceso denegado';
          }
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), backgroundColor: context.colors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _loading.remove(key));
    }
  }

  void _confirm(String label, String direction, String? accessType, String? deviceId) {
    showDialog(
      context: context,
      useRootNavigator: true,
      builder: (ctx) => AlertDialog(
        title: Row(children: [
          Icon(Icons.lock_open_rounded, color: ctx.colors.primary),
          const SizedBox(width: 8),
          Text(label),
        ]),
        content: const Text('¿Deseas enviar el comando de apertura?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () { Navigator.pop(ctx); _openGate(direction: direction, accessType: accessType, deviceId: deviceId); },
            child: const Text('Confirmar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final config = widget.config;
    final auth = widget.auth;
    final isGuard = auth.isGuard;

    // Construir lista de botones según flags
    final List<({String label, String direction, String? accessType, IconData icon, String? deviceId})> buttons = [];

    if (config.showResidentAccessButton || isGuard) {
      buttons.add((label: 'Entrada Residentes', direction: 'ENTRY', accessType: 'RESIDENT', icon: Icons.home_rounded, deviceId: config.residentEntryDeviceId));
    }
    if ((config.showResidentAccessButton && config.showExitButton) || isGuard) {
      buttons.add((label: 'Salida Residentes', direction: 'EXIT', accessType: 'RESIDENT', icon: Icons.logout_rounded, deviceId: config.residentExitDeviceId));
    }
    if (config.showVisitorAccessButton || isGuard) {
      buttons.add((label: 'Entrada Visitas', direction: 'ENTRY', accessType: 'VISITOR', icon: Icons.group_rounded, deviceId: config.visitorEntryDeviceId));
    }
    if ((config.showVisitorAccessButton && config.showExitButton) || isGuard) {
      buttons.add((label: 'Salida Visitas', direction: 'EXIT', accessType: 'VISITOR', icon: Icons.group_remove_rounded, deviceId: config.visitorExitDeviceId));
    }

    // Si no hay flags activos y es admin/guard: mostrar botón genérico
    if (buttons.isEmpty && (auth.isAdmin || auth.isGuard)) {
      buttons.add((label: 'Abrir Acceso', direction: 'ENTRY', accessType: null, icon: Icons.lock_open_rounded, deviceId: null));
    }

    if (buttons.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        for (final btn in buttons) ...[
          _AccessButtonTile(
            label: btn.label,
            icon: btn.icon,
            direction: btn.direction,
            loading: _loading['${btn.direction}-${btn.accessType ?? 'any'}'] == true,
            onTap: () => _confirm(btn.label, btn.direction, btn.accessType, btn.deviceId),
          ),
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _AccessButtonTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final String direction;
  final bool loading;
  final VoidCallback onTap;

  const _AccessButtonTile({
    required this.label,
    required this.icon,
    required this.direction,
    required this.loading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isExit = direction == 'EXIT';
    final color = isExit ? c.warning : c.primary;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: isExit
            ? LinearGradient(colors: [c.warning, c.warning.withOpacity(0.8)],
                begin: Alignment.topLeft, end: Alignment.bottomRight)
            : c.primaryGradient,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(color: color.withOpacity(0.3), blurRadius: 16, offset: const Offset(0, 6)),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: loading ? null : onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 20),
            child: loading
                ? const Center(child: SizedBox(height: 28, width: 28,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5)))
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(icon, color: Colors.white, size: 24),
                      const SizedBox(width: 10),
                      Text(label, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _AccessLogSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      children: List.generate(
        4,
        (_) => Container(
          margin: const EdgeInsets.only(bottom: 10),
          height: 64,
          decoration: BoxDecoration(
            color: c.bgCard,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}

class _AccessLogItem extends StatelessWidget {
  final dynamic log;
  const _AccessLogItem({required this.log});

  // Categorías de QR rápido
  static const _quickCategories = {'Uber/Didi', 'Delivery', 'Servicio'};

  String _title() {
    final method = log['method'] as String? ?? '';
    final direction = log['direction'] as String? ?? 'ENTRY';
    final visitorName = log['visitorName'] as String? ?? '';
    final dir = direction == 'EXIT' ? 'Salida' : 'Entrada';

    switch (method) {
      case 'APP':
        return '$dir — Residente (App)';
      case 'QR':
        if (_quickCategories.contains(visitorName)) {
          return 'QR Rápido — $visitorName';
        }
        return visitorName.isNotEmpty ? 'QR Visita — $visitorName' : 'Código QR';
      case 'GUARD_OVERRIDE':
        return visitorName.isNotEmpty ? 'Acceso manual — $visitorName' : 'Acceso manual (Guardia)';
      case 'REMOTE':
        return '$dir — Acceso remoto';
      case 'EXIT_SENSOR':
        return 'Salida — Sensor automático';
      default:
        return method;
    }
  }

  String _subtitle() {
    final parts = <String>[];

    final unit = log['unit'] as Map?;
    final identifier = unit?['identifier'] as String?;
    if (identifier != null && identifier.isNotEmpty) parts.add('Unidad $identifier');

    final plate = log['visitorPlate'] as String?;
    if (plate != null && plate.isNotEmpty) parts.add('Placa: $plate');

    final device = log['device'] as Map?;
    final deviceName = device?['name'] as String?;
    if (deviceName != null && deviceName.isNotEmpty) parts.add(deviceName);

    final user = log['user'] as Map?;
    final firstName = user?['firstName'] as String?;
    final lastName  = user?['lastName']  as String?;
    if (firstName != null) {
      final method = log['method'] as String? ?? '';
      if (method == 'GUARD_OVERRIDE') parts.add('Guardia: $firstName ${lastName ?? ''}');
    }

    return parts.join(' · ');
  }

  IconData _icon() {
    final method = log['method'] as String? ?? '';
    final visitorName = log['visitorName'] as String? ?? '';
    switch (method) {
      case 'APP':           return Icons.smartphone_rounded;
      case 'QR':
        return _quickCategories.contains(visitorName)
            ? Icons.flash_on_rounded
            : Icons.qr_code_scanner_rounded;
      case 'GUARD_OVERRIDE': return Icons.security_rounded;
      case 'REMOTE':         return Icons.wifi_rounded;
      case 'EXIT_SENSOR':    return Icons.sensor_door_rounded;
      default:               return Icons.key_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isLight = Theme.of(context).brightness == Brightness.light;
    final granted = log['granted'] as bool? ?? false;
    final createdAt = log['createdAt'] as String?;
    final direction = log['direction'] as String? ?? 'ENTRY';

    final statusColor = granted ? c.accessGranted : c.accessDenied;
    final dirColor = direction == 'EXIT' ? c.warning : c.primary;

    String timeStr = '';
    String dateStr = '';
    if (createdAt != null) {
      try {
        final dt = DateTime.parse(createdAt).toLocal();
        final now = DateTime.now();
        timeStr = DateFormat('HH:mm').format(dt);
        if (dt.day != now.day || dt.month != now.month) {
          dateStr = DateFormat('dd/MM').format(dt);
        }
      } catch (_) {}
    }

    final subtitle = _subtitle();

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.bgCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
        boxShadow: isLight
            ? [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 2))]
            : null,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: dirColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(_icon(), color: dirColor, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _title(),
                  style: TextStyle(
                    color: c.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(subtitle, style: TextStyle(color: c.textMuted, fontSize: 11)),
                ],
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    granted ? 'Permitido' : 'Denegado',
                    style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(timeStr, style: TextStyle(color: c.textMuted, fontSize: 12, fontWeight: FontWeight.w500)),
              if (dateStr.isNotEmpty)
                Text(dateStr, style: TextStyle(color: c.textMuted, fontSize: 10)),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Helper para lista combinada ────────────────────────────────────────────
class _ActivityItem {
  final String type; // 'access' | 'service'
  final dynamic data;
  final DateTime date;
  const _ActivityItem({required this.type, required this.data, required this.date});
}

// ── Item de solicitud de servicio en el log ────────────────────────────────
class _ServiceRequestLogItem extends StatelessWidget {
  final dynamic data;
  const _ServiceRequestLogItem({required this.data});

  static const _serviceIcons = {
    'CFE': '⚡', 'Gas': '🔥', 'Agua': '💧', 'Basura': '🗑️',
    'Paquetería': '📦', 'Mensajería': '📬', 'Domicilio': '🛵',
    'Técnico': '🔧', 'Jardinería': '🌿', 'Limpieza': '🧹',
  };

  Color _statusColor(String status, AppColorsScheme c) {
    switch (status) {
      case 'APPROVED': return c.success;
      case 'REJECTED': return c.error;
      case 'EXPIRED':  return c.textMuted;
      default:         return c.warning; // PENDING
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'APPROVED': return 'Aprobado';
      case 'REJECTED': return 'Rechazado';
      case 'EXPIRED':  return 'Expirado';
      default:         return 'Pendiente';
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isLight = Theme.of(context).brightness == Brightness.light;
    final service   = data['service']  as String? ?? 'Servicio';
    final status    = data['status']   as String? ?? 'PENDING';
    final phone     = data['visitorPhone'] as String? ?? '';
    final createdAt = data['createdAt'] as String?;
    final unit      = data['unit']     as Map?;
    final identifier = unit?['identifier'] as String?;

    final emoji = _serviceIcons[service] ?? '🔔';
    final statusColor = _statusColor(status, c);

    String timeStr = '';
    String dateStr = '';
    if (createdAt != null) {
      try {
        final dt = DateTime.parse(createdAt).toLocal();
        final now = DateTime.now();
        timeStr = DateFormat('HH:mm').format(dt);
        if (dt.day != now.day || dt.month != now.month) {
          dateStr = DateFormat('dd/MM').format(dt);
        }
      } catch (_) {}
    }

    final subtitle = [
      if (identifier != null) 'Unidad $identifier',
      if (phone.isNotEmpty) phone,
    ].join(' · ');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.bgCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
        boxShadow: isLight
            ? [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 2))]
            : null,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36, height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: c.info.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(emoji, style: const TextStyle(fontSize: 18)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Servicio externo — $service',
                    style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w600, fontSize: 13)),
                if (subtitle.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(subtitle, style: TextStyle(color: c.textMuted, fontSize: 11)),
                ],
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(_statusLabel(status),
                      style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(timeStr, style: TextStyle(color: c.textMuted, fontSize: 12, fontWeight: FontWeight.w500)),
              if (dateStr.isNotEmpty)
                Text(dateStr, style: TextStyle(color: c.textMuted, fontSize: 10)),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Botón de pánico ────────────────────────────────────────────────────────
class _PanicButton extends ConsumerStatefulWidget {
  const _PanicButton();

  @override
  ConsumerState<_PanicButton> createState() => _PanicButtonState();
}

class _PanicButtonState extends ConsumerState<_PanicButton> {
  bool _loading = false;
  bool _sent = false;
  int _remainingSeconds = 0;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startCooldown(int seconds) {
    setState(() {
      _sent = true;
      _remainingSeconds = seconds;
    });
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() => _remainingSeconds--);
      if (_remainingSeconds <= 0) {
        t.cancel();
        setState(() { _sent = false; _remainingSeconds = 0; });
      }
    });
  }

  Future<void> _sendPanic() async {
    // Deshabilitar inmediatamente para prevenir doble tap
    if (_loading || _sent) return;
    setState(() => _loading = true);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('⚠️ Botón de pánico'),
        content: const Text(
          'Se enviará una alerta urgente a los administradores y guardias del fraccionamiento.\n\n'
          '¿Confirmar emergencia?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sí, enviar alerta'),
          ),
        ],
      ),
    );

    if (confirmed != true) {
      if (mounted) setState(() => _loading = false);
      return;
    }

    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/access/panic', data: {});
      final cooldown = (res.data['data']?['cooldownSeconds'] as num?)?.toInt() ?? 300;
      _startCooldown(cooldown);

      if (mounted) {
        // Mostrar popup con datos del usuario y números de emergencia
        final auth = ref.read(authProvider);
        final config = ref.read(tenantConfigProvider).valueOrNull;
        final panicData = {
          'userName': auth.displayName,
          'unitLabel': '',
          'phone': '',
          'block': '',
          'unitIdentifier': '',
        };
        showGeneralDialog(
          context: context,
          barrierDismissible: false,
          barrierLabel: 'Pánico',
          barrierColor: Colors.transparent,
          transitionDuration: const Duration(milliseconds: 300),
          transitionBuilder: (ctx, a1, a2, child) => FadeTransition(
            opacity: CurvedAnimation(parent: a1, curve: Curves.easeOut),
            child: child,
          ),
          pageBuilder: (ctx, _, __) => PanicAlertFullScreen(
            data: panicData,
            emergencyContacts: config?.emergencyContacts ?? [],
          ),
        );
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
      final msg = e.toString();
      final match = RegExp(r'Espera (\d+)').firstMatch(msg);
      if (match != null) {
        _startCooldown(int.parse(match.group(1)!));
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(match != null
                ? 'Ya enviaste una alerta reciente. Espera $_remainingSeconds s.'
                : 'Error al enviar alerta. Intenta de nuevo.'),
            backgroundColor: Colors.orange,
          ),
        );
      }
    }
  }

  String _formatTime(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: _sent
          ? Container(
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.red.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.red.withOpacity(0.4)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.check_circle, color: Colors.red, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Alerta enviada — espera ${_formatTime(_remainingSeconds)}',
                    style: const TextStyle(color: Colors.red, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            )
          : SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _loading ? null : _sendPanic,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 2,
                ),
                icon: _loading
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.crisis_alert_rounded, size: 22),
                label: Text(
                  _loading ? 'Enviando alerta...' : 'Botón de pánico',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ),
    );
  }
}

// ── Tarjeta compacta formas de pago ────────────────────────────────────────

class _PaymentShortcutCard extends StatelessWidget {
  final PaymentConfig config;
  final String? role;
  const _PaymentShortcutCard({required this.config, required this.role});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isLight = Theme.of(context).brightness == Brightness.light;

    final bankNames = config.bankAccounts.map((b) => b.bankName).join(' · ');
    final subtitle = bankNames.isNotEmpty
        ? bankNames
        : config.paymentConcept.isNotEmpty
            ? config.paymentConcept
            : 'Ver métodos de pago';

    return GestureDetector(
      onTap: () => context.go('/payments'),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.bgCard,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: c.border),
          boxShadow: isLight
              ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 8, offset: const Offset(0, 2))]
              : null,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: c.primary.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.account_balance_outlined, color: c.primary, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Formas de pago',
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: c.textPrimary),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 12, color: c.textMuted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            if (config.monthlyAmount > 0) ...[
              Text(
                NumberFormat.currency(locale: 'es_MX', symbol: '\$')
                    .format(config.monthlyAmount),
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: c.primary),
              ),
              const SizedBox(width: 8),
            ],
            Icon(Icons.chevron_right_rounded, color: c.textMuted, size: 20),
          ],
        ),
      ),
    );
  }
}
