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

final dashboardStatsProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final auth = ref.watch(authProvider);
  if (auth.tenantId == null) return {};
  final res = await api.get('/reports/dashboard');
  return res.data['data'] as Map<String, dynamic>? ?? {};
});

final recentAccessProvider = FutureProvider<List<dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/access/logs', params: {'limit': '8'});
  return res.data['data'] as List? ?? [];
});

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final stats = ref.watch(dashboardStatsProvider);
    final recentAccess = ref.watch(recentAccessProvider);

    final tenantConfigAsync = ref.watch(tenantConfigProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: CustomScrollView(
        slivers: [
          // App Bar personalizado
          SliverAppBar(
            expandedHeight: 120,
            floating: false,
            pinned: true,
            backgroundColor: Theme.of(context).scaffoldBackgroundColor,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: BoxDecoration(
                  color: Theme.of(context).scaffoldBackgroundColor,
                ),
                padding: const EdgeInsets.fromLTRB(20, 56, 20, 16),
                child: Row(
                  children: [
                    const _HexLogoSmall(),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            auth.tenantName ?? 'Acceso Digital',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Theme.of(context).colorScheme.onSurface,
                              letterSpacing: -0.3,
                            ),
                          ),
                          Text(
                            _greeting(),
                            style: TextStyle(
                              fontSize: 13,
                              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.5),
                            ),
                          ),
                        ],
                      ),
                    ),
                    _RoleBadge(auth: auth, ref: ref),
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

                // Actividad reciente (ADMIN y GUARD siempre; RESIDENT si no hay botones)
                if (auth.isAdmin || auth.isGuard) ...[
                  FadeInUp(
                    delay: const Duration(milliseconds: 300),
                    child: Row(
                      children: [
                        Text(
                          AppStrings.recentActivity,
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Theme.of(context).colorScheme.onSurface,
                          ),
                        ),
                        const Spacer(),
                        TextButton(
                          onPressed: () => context.go('/access'),
                          child: const Text('Ver todo'),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 8),

                  recentAccess.when(
                    loading: () => _AccessLogSkeleton(),
                    error: (e, _) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(e.toString(),
                          style: TextStyle(color: context.colors.error, fontSize: 13)),
                    ),
                    data: (logs) => Column(
                      children: logs
                          .map((log) => _AccessLogItem(log: log))
                          .toList(),
                    ),
                  ),
                ],

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
      const IadosLogo(size: 36, showText: false);
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
    final cs = Theme.of(context).colorScheme;
    final c = context.colors;
    final charges = data['pendingCharges'];
    final nextPayment = data['nextDueDate'] as String?;
    final lastAccess = data['lastAccess'] as String?;

    String nextPayStr = '';
    if (nextPayment != null) {
      try {
        final dt = DateTime.parse(nextPayment).toLocal();
        nextPayStr = DateFormat('dd/MM/yyyy').format(dt);
      } catch (_) {}
    }
    String lastAccessStr = '';
    if (lastAccess != null) {
      try {
        final dt = DateTime.parse(lastAccess).toLocal();
        lastAccessStr = DateFormat('dd/MM HH:mm').format(dt);
      } catch (_) {}
    }

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _SummaryCard(
                icon: Icons.check_circle_outline_rounded,
                label: 'Estado cuenta',
                value: 'Activo',
                color: c.success,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _SummaryCard(
                icon: Icons.receipt_long_rounded,
                label: 'Cargos pendientes',
                value: charges?.toString() ?? '0',
                color: charges != null && charges > 0 ? c.warning : c.success,
              ),
            ),
          ],
        ),
        if (nextPayStr.isNotEmpty || lastAccessStr.isNotEmpty) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              if (nextPayStr.isNotEmpty)
                Expanded(
                  child: _SummaryCard(
                    icon: Icons.calendar_today_rounded,
                    label: 'Próximo pago',
                    value: nextPayStr,
                    color: c.info,
                  ),
                ),
              if (nextPayStr.isNotEmpty && lastAccessStr.isNotEmpty)
                const SizedBox(width: 12),
              if (lastAccessStr.isNotEmpty)
                Expanded(
                  child: _SummaryCard(
                    icon: Icons.login_rounded,
                    label: 'Último acceso',
                    value: lastAccessStr,
                    color: c.textMuted,
                  ),
                ),
            ],
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
  const _SummaryCard({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: cs.outline.withOpacity(0.2)),
      ),
      child: Column(
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
          Text(value, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: cs.onSurface)),
        ],
      ),
    );
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

  Future<void> _openGate({required String direction, String? accessType}) async {
    final key = '$direction-${accessType ?? 'any'}';
    setState(() => _loading[key] = true);
    try {
      final api = ref.read(apiClientProvider);
      final devRes = await api.get('/devices');
      final allDevices = devRes.data['data'] as List? ?? [];

      List devices = allDevices
          .where((d) => d['isActive'] != false)
          .toList();

      // Filtrar por accessType si hay botón específico
      if (accessType != null) {
        final typed = devices.where((d) => d['accessType'] == accessType).toList();
        if (typed.isNotEmpty) devices = typed;
      }

      final online = devices.where((d) => d['status'] == 'ONLINE').toList();
      final selected = online.isNotEmpty ? online : devices;

      if (selected.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: const Text('No hay dispositivos disponibles'), backgroundColor: context.colors.error),
          );
        }
        return;
      }

      final deviceId = selected.first['id'] as String;
      final result = await api.post('/access/open', data: {
        'deviceId': deviceId,
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().contains('429') ? 'Espera unos segundos' : 'Error al enviar comando'), backgroundColor: context.colors.warning),
        );
      }
    } finally {
      if (mounted) setState(() => _loading.remove(key));
    }
  }

  void _confirm(String label, String direction, String? accessType) {
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
            onPressed: () { Navigator.pop(ctx); _openGate(direction: direction, accessType: accessType); },
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
    final List<({String label, String direction, String? accessType, IconData icon})> buttons = [];

    if (config.showResidentAccessButton || isGuard) {
      buttons.add((label: 'Entrada Residentes', direction: 'ENTRY', accessType: 'RESIDENT', icon: Icons.home_rounded));
    }
    if ((config.showResidentAccessButton && config.showExitButton) || isGuard) {
      buttons.add((label: 'Salida Residentes', direction: 'EXIT', accessType: 'RESIDENT', icon: Icons.logout_rounded));
    }
    if (config.showVisitorAccessButton || isGuard) {
      buttons.add((label: 'Entrada Visitas', direction: 'ENTRY', accessType: 'VISITOR', icon: Icons.group_rounded));
    }
    if ((config.showVisitorAccessButton && config.showExitButton) || isGuard) {
      buttons.add((label: 'Salida Visitas', direction: 'EXIT', accessType: 'VISITOR', icon: Icons.group_remove_rounded));
    }

    // Si no hay flags activos y es admin/guard: mostrar botón genérico
    if (buttons.isEmpty && (auth.isAdmin || auth.isGuard)) {
      buttons.add((label: 'Abrir Acceso', direction: 'ENTRY', accessType: null, icon: Icons.lock_open_rounded));
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
            onTap: () => _confirm(btn.label, btn.direction, btn.accessType),
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

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isLight = Theme.of(context).brightness == Brightness.light;
    final granted = log['granted'] as bool? ?? false;
    final method = log['method'] as String? ?? '';
    final visitorName = log['visitorName'] as String?;
    final unitId = log['unitId'] as String?;
    final createdAt = log['createdAt'] as String?;

    final color = granted ? c.accessGranted : c.accessDenied;
    final icon = granted ? Icons.check_circle_outline : Icons.cancel_outlined;

    String timeStr = '';
    if (createdAt != null) {
      try {
        final dt = DateTime.parse(createdAt).toLocal();
        timeStr = DateFormat('HH:mm').format(dt);
      } catch (_) {}
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.bgCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: c.border),
        boxShadow: isLight
            ? [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 2))]
            : null,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  visitorName ?? 'Residente',
                  style: TextStyle(
                    color: c.textPrimary,
                    fontWeight: FontWeight.w500,
                    fontSize: 14,
                  ),
                ),
                Text(
                  _methodLabel(method),
                  style: TextStyle(color: c.textMuted, fontSize: 12),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(timeStr, style: TextStyle(color: c.textMuted, fontSize: 12)),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  granted ? 'Permitido' : 'Denegado',
                  style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _methodLabel(String method) {
    switch (method) {
      case 'APP': return 'App móvil';
      case 'QR': return 'Código QR';
      case 'GUARD_OVERRIDE': return 'Permiso guardia';
      case 'REMOTE': return 'Remoto';
      case 'EXIT_SENSOR': return 'Sensor de salida';
      default: return method;
    }
  }
}
