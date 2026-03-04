import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'router.dart';
import 'shared/providers/tenant_config_provider.dart';

class AccesoDigitalApp extends ConsumerWidget {
  const AccesoDigitalApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final configAsync = ref.watch(tenantConfigProvider);

    final isDark = configAsync.maybeWhen(
      data: (c) => !c.isLight,
      orElse: () => true,
    );

    return MaterialApp.router(
      title: 'Acceso Digital – iaDoS',
      debugShowCheckedModeBanner: false,
      theme: isDark ? AppTheme.dark : AppTheme.light,
      routerConfig: router,
    );
  }
}
