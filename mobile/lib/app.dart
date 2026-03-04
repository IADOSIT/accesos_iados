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
    // .select() previene rebuild de MaterialApp.router cuando el FutureProvider
    // cambia de estado (loading/data) pero el valor real de isDark no cambia.
    // Sin esto, cada login dispara un rebuild que interrumpe la navegación en iOS.
    final isDark = ref.watch(
      tenantConfigProvider.select(
        (async) => async.maybeWhen(data: (c) => !c.isLight, orElse: () => true),
      ),
    );

    return MaterialApp.router(
      title: 'Acceso Digital – iaDoS',
      debugShowCheckedModeBanner: false,
      theme: isDark ? AppTheme.dark : AppTheme.light,
      routerConfig: router,
    );
  }
}
