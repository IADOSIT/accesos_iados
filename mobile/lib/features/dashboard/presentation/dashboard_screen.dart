import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:animate_do/animate_do.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/providers/auth_provider.dart';
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

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      body: CustomScrollView(
        slivers: [
          // App Bar personalizado
          SliverAppBar(
            expandedHeight: 120,
            floating: false,
            pinned: true,
            backgroundColor: AppColors.bgDark,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF0A0F1E), Color(0xFF0D1420)],
                  ),
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
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                              letterSpacing: -0.3,
                            ),
                          ),
                          Text(
                            _greeting(),
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textMuted,
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

                // Stats grid
                FadeInUp(
                  duration: const Duration(milliseconds: 400),
                  child: stats.when(
                    loading: () => _StatsGrid(isLoading: true),
                    error: (_, __) => _StatsGrid(isLoading: false, error: true),
                    data: (data) => _StatsGrid(data: data),
                  ),
                ),

                const SizedBox(height: 24),

                // Botón abrir portón (solo ADMIN y GUARD)
                if (auth.isAdmin || auth.isGuard)
                  FadeInUp(
                    delay: const Duration(milliseconds: 200),
                    child: const _OpenGateButton(),
                  ),

                const SizedBox(height: 24),

                // Actividad reciente
                FadeInUp(
                  delay: const Duration(milliseconds: 300),
                  child: Row(
                    children: [
                      const Text(
                        AppStrings.recentActivity,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
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
                        style: const TextStyle(color: AppColors.error, fontSize: 13)),
                  ),
                  data: (logs) => Column(
                    children: logs
                        .map((log) => _AccessLogItem(log: log))
                        .toList(),
                  ),
                ),

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

  Color get _roleColor {
    switch (auth.role) {
      case 'ADMIN': return AppColors.primary;
      case 'GUARD': return AppColors.info;
      default: return AppColors.textMuted;
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
    final color = _roleColor;

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
        if (value == 'about') {
          final uri = Uri.parse('https://iados.mx');
          if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
          return;
        }
        if (value == 'logout') {
          final confirm = await showDialog<bool>(
            context: context,
            useRootNavigator: true,
            builder: (dialogCtx) => AlertDialog(
              backgroundColor: AppColors.bgCard,
              title: const Text('Cerrar sesión',
                  style: TextStyle(color: AppColors.textPrimary)),
              content: const Text('¿Estás seguro que deseas salir?',
                  style: TextStyle(color: AppColors.textSecondary)),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(dialogCtx, false),
                    child: const Text('Cancelar')),
                TextButton(
                  onPressed: () => Navigator.pop(dialogCtx, true),
                  child: const Text('Salir',
                      style: TextStyle(color: AppColors.error)),
                ),
              ],
            ),
          );
          if (confirm == true) {
            await ref.read(authProvider.notifier).logout();
          }
        }
      },
      color: AppColors.bgCard,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      itemBuilder: (_) => [
        PopupMenuItem(
          enabled: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(displayName,
                  style: TextStyle(
                      color: AppColors.textPrimary,
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
        const PopupMenuItem(
          value: 'about',
          child: Row(
            children: [
              Icon(Icons.info_outline_rounded, color: AppColors.textMuted, size: 18),
              SizedBox(width: 10),
              Text('iados.mx', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
            ],
          ),
        ),
        const PopupMenuDivider(),
        const PopupMenuItem(
          value: 'logout',
          child: Row(
            children: [
              Icon(Icons.logout_rounded, color: AppColors.error, size: 18),
              SizedBox(width: 10),
              Text('Cerrar sesión', style: TextStyle(color: AppColors.error)),
            ],
          ),
        ),
      ],
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
          accentColor: AppColors.primary,
          isLoading: isLoading,
        ),
        StatCard(
          label: AppStrings.activeUnits,
          value: stats['totalUnits']?.toString() ?? '—',
          icon: Icons.home_outlined,
          accentColor: AppColors.info,
          isLoading: isLoading,
        ),
        StatCard(
          label: AppStrings.pendingPayments,
          value: stats['delinquentUnits']?.toString() ?? '—',
          icon: Icons.receipt_long_outlined,
          accentColor: AppColors.warning,
          isLoading: isLoading,
        ),
        StatCard(
          label: AppStrings.devicesOnline,
          value: stats['onlineDevices']?.toString() ?? '—',
          icon: Icons.router_outlined,
          accentColor: AppColors.success,
          isLoading: isLoading,
        ),
      ],
    );
  }
}

class _OpenGateButton extends ConsumerStatefulWidget {
  const _OpenGateButton();

  @override
  ConsumerState<_OpenGateButton> createState() => _OpenGateButtonState();
}

class _OpenGateButtonState extends ConsumerState<_OpenGateButton> {
  bool _loading = false;

  Future<void> _openGate() async {
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);

      // Obtener dispositivos activos
      final devRes = await api.get('/devices');
      final allDevices = devRes.data['data'] as List? ?? [];

      // Preferir ONLINE, si no cualquier activo
      final online = allDevices
          .where((d) => d['isActive'] != false && d['status'] == 'ONLINE')
          .toList();
      final active = allDevices
          .where((d) => d['isActive'] != false)
          .toList();
      final devices = online.isNotEmpty ? online : active;

      if (devices.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('No hay dispositivos disponibles'),
              backgroundColor: AppColors.error,
            ),
          );
        }
        return;
      }

      final deviceId = devices.first['id'] as String;
      final result = await api.post('/access/open', data: {
        'deviceId': deviceId,
        'method': 'APP',
        'direction': 'ENTRY',
      });

      final granted = result.data['data']?['granted'] as bool? ?? false;
      final reason = result.data['data']?['reason'] as String? ?? '';

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(granted ? '✓ Acceso abierto correctamente' : '✗ $reason'),
            backgroundColor: granted ? AppColors.success : AppColors.error,
          ),
        );
        if (granted) ref.invalidate(recentAccessProvider);
      }
    } catch (e) {
      if (mounted) {
        final msg = e.toString().contains('429')
            ? 'Espera unos segundos antes de volver a abrir'
            : 'Error al enviar comando';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: AppColors.warning,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showOpenConfirm() {
    showDialog(
      context: context,
      useRootNavigator: true,
      builder: (dialogCtx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.lock_open_rounded, color: AppColors.primary),
            SizedBox(width: 8),
            Text('Confirmar apertura',
                style: TextStyle(color: AppColors.textPrimary)),
          ],
        ),
        content: const Text(
          '¿Deseas enviar el comando de apertura?',
          style: TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(dialogCtx);
              _openGate();
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
            child: const Text('Abrir', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.35),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _loading ? null : _showOpenConfirm,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: _loading
                ? const Center(
                    child: SizedBox(
                      height: 32,
                      width: 32,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.5,
                      ),
                    ),
                  )
                : const Column(
                    children: [
                      Icon(Icons.lock_open_rounded, color: Colors.white, size: 32),
                      SizedBox(height: 8),
                      Text(
                        'Abrir Acceso',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.3,
                        ),
                      ),
                      Text(
                        'Toca para enviar comando de apertura',
                        style: TextStyle(color: Colors.white70, fontSize: 12),
                      ),
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
    return Column(
      children: List.generate(
        4,
        (_) => Container(
          margin: const EdgeInsets.only(bottom: 10),
          height: 64,
          decoration: BoxDecoration(
            color: AppColors.bgCard,
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
    final granted = log['granted'] as bool? ?? false;
    final method = log['method'] as String? ?? '';
    final visitorName = log['visitorName'] as String?;
    final unitId = log['unitId'] as String?;
    final createdAt = log['createdAt'] as String?;

    final color = granted ? AppColors.accessGranted : AppColors.accessDenied;
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
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
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
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w500,
                    fontSize: 14,
                  ),
                ),
                Text(
                  _methodLabel(method),
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                timeStr,
                style: const TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 12,
                ),
              ),
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
