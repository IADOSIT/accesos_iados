import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'features/auth/presentation/login_screen.dart';
import 'core/network/api_client.dart';
import 'shared/widgets/service_request_dialog.dart';
import 'shared/widgets/panic_alert_dialog.dart';
import 'features/dashboard/presentation/dashboard_screen.dart';
import 'features/access/presentation/access_screen.dart';
import 'features/visitors/presentation/visitors_screen.dart';
import 'features/payments/presentation/payments_screen.dart';
import 'features/notifications/presentation/notifications_screen.dart';
import 'features/profile/presentation/profile_screen.dart';
import 'features/auth/presentation/force_change_password_screen.dart';
import 'features/notifications/providers/notifications_provider.dart';
import 'shared/providers/auth_provider.dart';
import 'shared/providers/tenant_config_provider.dart';
import 'core/constants/app_colors_scheme.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = _AuthRouteNotifier(ref);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: notifier,
    redirect: (context, state) {
      final isAuth = notifier.isAuthenticated;
      final isLoading = notifier.isLoading;
      final mustChange = notifier.mustChangePassword;
      final loc = state.matchedLocation;

      if (isLoading) return null;
      if (!isAuth && loc != '/login') return '/login';
      if (isAuth && loc == '/login') {
        return mustChange ? '/force-change-password' : '/dashboard';
      }
      if (isAuth && mustChange && loc != '/force-change-password') {
        return '/force-change-password';
      }
      // Contraseña ya cambiada: salir de la pantalla de cambio forzado
      if (isAuth && !mustChange && loc == '/force-change-password') {
        return '/dashboard';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) => _MainShell(child: child),
        routes: [
          GoRoute(
            path: '/dashboard',
            builder: (_, __) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/access',
            builder: (_, __) => const AccessScreen(),
          ),
          GoRoute(
            path: '/visitors',
            builder: (_, __) => const VisitorsScreen(),
          ),
          GoRoute(
            path: '/payments',
            builder: (_, __) => const PaymentsScreen(),
          ),
          GoRoute(
            path: '/notifications',
            builder: (_, __) => const NotificationsScreen(),
          ),
        ],
      ),
      GoRoute(
        path: '/profile',
        builder: (_, __) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/force-change-password',
        builder: (_, __) => const ForceChangePasswordScreen(),
      ),
    ],
  );
});

class _MainShell extends ConsumerStatefulWidget {
  final Widget child;
  const _MainShell({required this.child});

  @override
  ConsumerState<_MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<_MainShell> {
  int _currentIndex = 0;

  static const _allTabs = [
    (path: '/dashboard',      icon: Icons.grid_view_rounded,        label: 'Inicio',       roles: <String>['ADMIN','GUARD','RESIDENT']),
    (path: '/access',         icon: Icons.swap_horiz_rounded,       label: 'Accesos',      roles: <String>['ADMIN','GUARD']),
    (path: '/visitors',       icon: Icons.qr_code_scanner_rounded,  label: 'Visitantes',   roles: <String>['ADMIN','RESIDENT']),
    (path: '/payments',       icon: Icons.receipt_long_rounded,     label: 'Pagos',        roles: <String>['ADMIN','RESIDENT']),
    (path: '/notifications',  icon: Icons.notifications_rounded,    label: 'Alertas',      roles: <String>['ADMIN','GUARD','RESIDENT']),
  ];

  List<({String path, IconData icon, String label, List<String> roles})> _visibleTabs(String? role) {
    if (role == null) return _allTabs;
    return _allTabs.where((t) => t.roles.contains(role)).toList();
  }

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) {
      try {
        // Foreground: app abierta
        FirebaseMessaging.onMessage.listen((message) {
          ref.invalidate(unreadCountProvider);
          if (message.data['type'] == 'PANIC') {
            SchedulerBinding.instance.addPostFrameCallback((_) {
              if (mounted) _showPanicAlert(message.data);
            });
          } else if (message.data['type'] == 'SERVICE_REQUEST') {
            SchedulerBinding.instance.addPostFrameCallback((_) {
              if (mounted) _showServiceRequestAlert(message.data);
            });
          }
        });

        // Background: usuario toca la notificación del sistema
        FirebaseMessaging.onMessageOpenedApp.listen((message) {
          ref.invalidate(unreadCountProvider);
          if (message.data['type'] == 'SERVICE_REQUEST') {
            SchedulerBinding.instance.addPostFrameCallback((_) {
              if (mounted) _showServiceRequestAlert(message.data);
            });
          } else if (message.data['type'] == 'PANIC') {
            SchedulerBinding.instance.addPostFrameCallback((_) {
              if (mounted) _showPanicAlert(message.data);
            });
          }
        });

        // Terminada: app abierta desde notificación
        FirebaseMessaging.instance.getInitialMessage().then((message) {
          if (message == null) return;
          SchedulerBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            if (message.data['type'] == 'SERVICE_REQUEST') {
              _showServiceRequestAlert(message.data);
            } else if (message.data['type'] == 'PANIC') {
              _showPanicAlert(message.data);
            }
          });
        }).catchError((_) {});
      } catch (_) {
        // Firebase no disponible en este dispositivo iOS — ignorar silenciosamente
      }
    }
  }

  void _showServiceRequestAlert(Map<String, dynamic> data) {
    showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'Servicio',
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 300),
      transitionBuilder: (ctx, a1, a2, child) => FadeTransition(
        opacity: CurvedAnimation(parent: a1, curve: Curves.easeOut),
        child: child,
      ),
      pageBuilder: (ctx, _, __) => ServiceRequestDialog(data: data),
    );
  }

  void _showPanicAlert(Map<String, dynamic> data) {
    final config = ref.read(tenantConfigProvider).valueOrNull;
    showGeneralDialog(
      context: context,
      barrierDismissible: false,
      barrierLabel: 'Pánico',
      barrierColor: Colors.transparent,
      transitionDuration: const Duration(milliseconds: 350),
      transitionBuilder: (ctx, a1, a2, child) => FadeTransition(
        opacity: CurvedAnimation(parent: a1, curve: Curves.easeOut),
        child: child,
      ),
      pageBuilder: (ctx, _, __) => PanicAlertFullScreen(
        data: data,
        emergencyContacts: config?.emergencyContacts ?? [],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(authProvider).role;
    final tabs = _visibleTabs(role);

    final safeIndex = _currentIndex < tabs.length ? _currentIndex : 0;

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: Builder(
        builder: (context) {
          final c = context.colors;
          return Container(
            decoration: BoxDecoration(
              color: c.bgSurface,
              border: Border(top: BorderSide(color: c.border, width: 1)),
            ),
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: tabs.asMap().entries.map((e) {
                    final isNotifications = e.value.path == '/notifications';
                    if (isNotifications) {
                      return _NotificationNavItem(
                        isSelected: safeIndex == e.key,
                        onTap: () => _navigate(e.key, tabs),
                      );
                    }
                    return _NavItem(
                      icon: e.value.icon,
                      label: e.value.label,
                      isSelected: safeIndex == e.key,
                      onTap: () => _navigate(e.key, tabs),
                    );
                  }).toList(),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  void _navigate(int index, List<({String path, IconData icon, String label, List<String> roles})> tabs) {
    setState(() => _currentIndex = index);
    context.go(tabs[index].path);
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final color = isSelected ? c.primary : c.textMuted;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? c.primaryGlow : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Tab de notificaciones con badge de no leídas
class _NotificationNavItem extends ConsumerWidget {
  final bool isSelected;
  final VoidCallback onTap;
  const _NotificationNavItem({required this.isSelected, required this.onTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final countAsync = ref.watch(unreadCountProvider);
    final count = countAsync.valueOrNull ?? 0;
    final color = isSelected ? c.primary : c.textMuted;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? c.primaryGlow : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(Icons.notifications_rounded, color: color, size: 22),
                if (count > 0)
                  Positioned(
                    top: -4,
                    right: -6,
                    child: Container(
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: c.error,
                        shape: BoxShape.circle,
                      ),
                      constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                      child: Text(
                        count > 99 ? '99+' : '$count',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              'Alertas',
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// PanicAlertFullScreen y PanicRow definidos en shared/widgets/panic_alert_dialog.dart
// ServiceRequestDialog definido en shared/widgets/service_request_dialog.dart

class _AuthRouteNotifier extends ChangeNotifier {
  final Ref _ref;

  _AuthRouteNotifier(this._ref) {
    _ref.listen(authProvider, (_, __) => notifyListeners());
  }

  bool get isAuthenticated => _ref.read(authProvider).isAuthenticated;
  bool get isLoading => _ref.read(authProvider).isLoading;
  bool get mustChangePassword => _ref.read(authProvider).mustChangePassword;
}
