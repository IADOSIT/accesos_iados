import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/constants/app_colors_scheme.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/providers/tenant_config_provider.dart';
import '../../../shared/providers/auth_provider.dart';

final chargesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final auth = ref.watch(authProvider);
  // Sin unidad asignada → el usuario no tiene cargos propios
  if (auth.unitId == null) return [];
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/payments/charges', params: {
    'limit': '100',
    'unitId': auth.unitId!,
  });
  return res.data['data'] as List? ?? [];
});

final myDevicesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/auth/my-devices');
  return res.data['data'] as List? ?? [];
});

class PaymentsScreen extends ConsumerWidget {
  const PaymentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final auth = ref.watch(authProvider);
    final charges = ref.watch(chargesProvider);
    final devices = ref.watch(myDevicesProvider);
    final paymentCfg = ref.watch(tenantConfigProvider).valueOrNull?.paymentConfig;
    final tenantName = auth.tenantName ?? '';
    final currencyFmt = NumberFormat.currency(locale: 'es_MX', symbol: '\$');

    // Admin/Guard sin unidad asignada → esta sección no aplica para su perfil
    if (auth.unitId == null && !auth.isResident) {
      return Scaffold(
        backgroundColor: c.bgMain,
        appBar: AppBar(title: const Text('Pagos')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.receipt_long_outlined, size: 56, color: c.textMuted),
                const SizedBox(height: 16),
                Text(
                  'Esta sección muestra los cargos de tu unidad como residente.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 15, color: c.textPrimary, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Text(
                  'Tu perfil de ${auth.isAdmin ? 'administrador' : 'guardia'} no tiene una unidad asignada.\nConsulta los cargos desde el portal web.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: c.textMuted),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: c.bgMain,
      appBar: AppBar(
        title: const Text('Pagos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () {
              ref.invalidate(chargesProvider);
              ref.invalidate(myDevicesProvider);
            },
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: [

          // ── Plan de dispositivos ────────────────────────────────
          if (paymentCfg != null && paymentCfg.devicePlans.isNotEmpty)
            SliverToBoxAdapter(
              child: _DevicePlanSection(
                cfg: paymentCfg,
                devices: devices.valueOrNull ?? [],
                fmt: currencyFmt,
              ),
            ),

          // ── Cómo pagar ──────────────────────────────────────────
          if (paymentCfg != null && paymentCfg.bankAccounts.isNotEmpty)
            SliverToBoxAdapter(
              child: _PaymentMethodsSection(
                cfg: paymentCfg,
                fmt: currencyFmt,
                tenantName: tenantName,
              ),
            ),

          // ── Resumen de cargos ───────────────────────────────────
          SliverToBoxAdapter(
            child: charges.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: _InfoCard(children: [
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline_rounded, color: c.textMuted, size: 20),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Los cargos son visibles para residentes',
                            style: TextStyle(color: c.textMuted, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                ]),
              ),
              data: (items) => _PaymentSummary(charges: items, fmt: currencyFmt),
            ),
          ),

          // ── Lista de cargos ─────────────────────────────────────
          if (charges.hasValue)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
              sliver: _ChargesList(charges: charges.valueOrNull ?? [], fmt: currencyFmt, colors: c),
            ),
        ],
      ),
    );
  }
}

// ── Sección: plan de dispositivos ──────────────────────────────────────────

class _DevicePlanSection extends StatelessWidget {
  final PaymentConfig cfg;
  final List<dynamic> devices;
  final NumberFormat fmt;
  const _DevicePlanSection({required this.cfg, required this.devices, required this.fmt});

  DevicePlan? _activePlan() {
    if (cfg.devicePlans.isEmpty) return null;
    final count = devices.isNotEmpty ? devices.length : 1;
    final sorted = [...cfg.devicePlans]..sort((a, b) => a.maxDevices.compareTo(b.maxDevices));
    return sorted.firstWhere(
      (p) => p.maxDevices >= count,
      orElse: () => sorted.last,
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final plan = _activePlan();
    if (plan == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: c.primary.withOpacity(0.12), shape: BoxShape.circle),
              child: Icon(Icons.devices_rounded, color: c.primary, size: 18),
            ),
            const SizedBox(width: 10),
            Text('Tu plan de acceso',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.textPrimary)),
          ]),
          const SizedBox(height: 14),
          _InfoCard(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(plan.label,
                            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.textPrimary)),
                        const SizedBox(height: 2),
                        Text(
                          devices.isEmpty
                              ? 'Sin dispositivos registrados'
                              : '${devices.length} dispositivo${devices.length == 1 ? '' : 's'} registrado${devices.length == 1 ? '' : 's'}',
                          style: TextStyle(fontSize: 13, color: c.textMuted),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(fmt.format(plan.monthlyAmount),
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: c.primary)),
                      Text('/ mes', style: TextStyle(fontSize: 11, color: c.textMuted)),
                    ],
                  ),
                ],
              ),
            ),
            if (devices.isNotEmpty) ...[
              Divider(height: 1, color: c.border),
              ...devices.asMap().entries.map((e) {
                final dev = e.value as Map;
                final name = dev['deviceName'] as String? ?? 'Dispositivo ${e.key + 1}';
                final platform = dev['platform'] as String? ?? '';
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(children: [
                    Icon(
                      platform == 'ios' ? Icons.phone_iphone_rounded : Icons.smartphone_rounded,
                      color: c.primary,
                      size: 16,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(name, style: TextStyle(fontSize: 13, color: c.textPrimary)),
                    ),
                  ]),
                );
              }),
            ],
          ]),
          const SizedBox(height: 4),
          Text(
            'Precio: ${fmt.format(plan.monthlyAmount)} × ${devices.isEmpty ? 1 : devices.length} dispositivo${(devices.isEmpty ? 1 : devices.length) == 1 ? '' : 's'}',
            style: TextStyle(fontSize: 12, color: c.textMuted),
          ),
          const Divider(height: 28),
        ],
      ),
    );
  }
}

// ── Lista separada pendientes / pagados ────────────────────────────────────

class _ChargesList extends StatelessWidget {
  final List<dynamic> charges;
  final NumberFormat fmt;
  final AppColorsScheme colors;
  const _ChargesList({required this.charges, required this.fmt, required this.colors});

  @override
  Widget build(BuildContext context) {
    final pending = charges.where((c) => (c['status'] as String?) != 'PAID' && (c['status'] as String?) != 'CANCELLED').toList();
    final paid    = charges.where((c) => (c['status'] as String?) == 'PAID').toList();

    if (charges.isEmpty) {
      return SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.check_circle_outline_rounded, color: colors.success, size: 48),
              const SizedBox(height: 12),
              Text('Sin cargos registrados', style: TextStyle(color: colors.textMuted, fontSize: 14)),
            ],
          ),
        ),
      );
    }

    final items = <Widget>[];

    if (pending.isNotEmpty) {
      items.add(Padding(
        padding: const EdgeInsets.only(top: 4, bottom: 8),
        child: Text('PENDIENTES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: colors.textMuted, letterSpacing: 0.8)),
      ));
      for (final c in pending) {
        items.add(Padding(padding: const EdgeInsets.only(bottom: 8), child: _ChargeCard(charge: c, fmt: fmt)));
      }
    } else {
      items.add(Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Row(children: [
          Icon(Icons.check_circle_outline_rounded, color: colors.success, size: 18),
          const SizedBox(width: 8),
          Text('Sin cargos pendientes', style: TextStyle(color: colors.textMuted, fontSize: 13)),
        ]),
      ));
    }

    if (paid.isNotEmpty) {
      items.add(Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 8),
        child: Text('PAGADOS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: colors.success, letterSpacing: 0.8)),
      ));
      for (final c in paid) {
        items.add(Padding(padding: const EdgeInsets.only(bottom: 8), child: _ChargeCard(charge: c, fmt: fmt)));
      }
    }

    return SliverList(delegate: SliverChildBuilderDelegate((_, i) => items[i], childCount: items.length));
  }
}

// ── ¿Cómo pagar? ───────────────────────────────────────────────────────────

class _PaymentMethodsSection extends StatelessWidget {
  final PaymentConfig cfg;
  final NumberFormat fmt;
  final String tenantName;
  const _PaymentMethodsSection(
      {required this.cfg, required this.fmt, required this.tenantName});

  String _shareText(BankAccount acc) {
    final lines = <String>[
      '💳 Datos de pago — $tenantName',
      'Banco: ${acc.bankName}',
      'Titular: ${acc.accountHolder}',
      if (acc.clabe != null && acc.clabe!.isNotEmpty) 'CLABE: ${acc.clabe}',
      if (acc.accountNumber != null && acc.accountNumber!.isNotEmpty)
        'No. cuenta: ${acc.accountNumber}',
      if (acc.referenceTemplate != null && acc.referenceTemplate!.isNotEmpty)
        'Referencia: ${acc.referenceTemplate}',
    ];
    if (cfg.monthlyAmount > 0) {
      lines.add('');
      lines.add('Cuota mensual: ${fmt.format(cfg.monthlyAmount)}');
      if (cfg.dueDayOfMonth > 0) {
        lines.add('Día de pago: ${cfg.dueDayOfMonth} de cada mes');
      }
    }
    return lines.join('\n');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: c.primary.withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.account_balance_outlined, color: c.primary, size: 18),
              ),
              const SizedBox(width: 10),
              Text(
                '¿Cómo pagar?',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: c.textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // Cuota mensual (solo si no hay planes por dispositivo)
          if (cfg.monthlyAmount > 0 && cfg.devicePlans.isEmpty) ...[
            _InfoCard(children: [
              _InfoRow(label: 'Concepto', value: cfg.paymentConcept),
              _InfoRow(
                  label: 'Cuota mensual', value: fmt.format(cfg.monthlyAmount)),
              if (cfg.dueDayOfMonth > 0)
                _InfoRow(
                    label: 'Fecha límite',
                    value: 'Día ${cfg.dueDayOfMonth} de cada mes'),
              if (cfg.gracePeriodDays > 0)
                _InfoRow(
                    label: 'Días de gracia',
                    value: '${cfg.gracePeriodDays} días'),
            ]),
            const SizedBox(height: 14),
          ],

          // Cuentas bancarias
          if (cfg.bankAccounts.isNotEmpty) ...[
            Text(
              'CUENTAS PARA TRANSFERENCIA',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: c.textMuted,
                  letterSpacing: 0.8),
            ),
            const SizedBox(height: 10),
            ...cfg.bankAccounts.map((acc) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _BankAccountCard(
                      acc: acc, shareText: _shareText(acc)),
                )),
          ],

          const Divider(height: 32),
          Text(
            'MIS CARGOS PENDIENTES',
            style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: c.textMuted,
                letterSpacing: 0.8),
          ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }
}

class _BankAccountCard extends StatelessWidget {
  final BankAccount acc;
  final String shareText;
  const _BankAccountCard({required this.acc, required this.shareText});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return _InfoCard(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 12, 10),
        child: Row(
          children: [
            Icon(Icons.account_balance_rounded, color: c.primary, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                acc.bankName,
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: c.textPrimary),
              ),
            ),
            GestureDetector(
              onTap: () => Share.share(shareText),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: c.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.share_rounded, size: 14, color: c.primary),
                    const SizedBox(width: 4),
                    Text('Compartir',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: c.primary)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      Divider(height: 1, color: c.border),
      _InfoRow(label: 'Titular', value: acc.accountHolder),
      if (acc.clabe != null && acc.clabe!.isNotEmpty)
        _CopyRow(label: 'CLABE', value: acc.clabe!),
      if (acc.accountNumber != null && acc.accountNumber!.isNotEmpty)
        _CopyRow(label: 'No. cuenta', value: acc.accountNumber!),
      if (acc.referenceTemplate != null && acc.referenceTemplate!.isNotEmpty)
        _CopyRow(label: 'Referencia', value: acc.referenceTemplate!),
    ]);
  }
}

// ── Resumen total pendiente ─────────────────────────────────────────────────

class _PaymentSummary extends StatelessWidget {
  final List<dynamic> charges;
  final NumberFormat fmt;
  const _PaymentSummary({required this.charges, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final pending = charges.where((ch) {
      final status = ch['status'] as String? ?? '';
      return status != 'PAID' && status != 'CANCELLED';
    }).toList();
    double total = 0;
    for (final charge in pending) {
      try {
        final amount = double.parse(charge['amount'].toString());
        final paid = double.parse(charge['paidAmount']?.toString() ?? '0');
        total += (amount - paid).clamp(0, double.infinity);
      } catch (_) {}
    }

    if (pending.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: c.primaryGradient,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: c.primary.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Total pendiente',
                  style: TextStyle(color: Colors.white70, fontSize: 13)),
              const SizedBox(height: 4),
              Text(
                fmt.format(total),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.5,
                ),
              ),
              Text(
                '${pending.length} cargo(s) pendiente(s)',
                style: const TextStyle(color: Colors.white60, fontSize: 12),
              ),
            ],
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.account_balance_wallet_outlined,
              color: Colors.white,
              size: 28,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Cargo individual ────────────────────────────────────────────────────────

class _ChargeCard extends StatelessWidget {
  final dynamic charge;
  final NumberFormat fmt;
  const _ChargeCard({required this.charge, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isLight = Theme.of(context).brightness == Brightness.light;

    final description = charge['description'] as String? ?? 'Cargo';
    final amount = double.tryParse(charge['amount']?.toString() ?? '0') ?? 0;
    final paidAmount =
        double.tryParse(charge['paidAmount']?.toString() ?? '0') ?? 0;
    final remaining = amount - paidAmount;
    final type = charge['type'] as String? ?? '';
    final dueDate = charge['dueDate'] as String?;
    final status = charge['status'] as String? ?? 'PENDING';

    String dueDateStr = '';
    bool isOverdue = false;
    if (dueDate != null) {
      try {
        final dt = DateTime.parse(dueDate);
        isOverdue = dt.isBefore(DateTime.now()) && status == 'PENDING';
        dueDateStr = '${dt.day}/${dt.month}/${dt.year}';
      } catch (_) {}
    }

    final color = isOverdue ? c.error : c.warning;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: c.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isOverdue ? c.error.withOpacity(0.3) : c.border,
        ),
        boxShadow: isLight
            ? [
                BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 2))
              ]
            : null,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(_typeIcon(type), color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  description,
                  style: TextStyle(
                    color: c.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 3),
                if (dueDateStr.isNotEmpty)
                  Text(
                    'Vence: $dueDateStr',
                    style: TextStyle(
                      color: isOverdue ? c.error : c.textMuted,
                      fontSize: 12,
                    ),
                  ),
                if (isOverdue)
                  Text(
                    'VENCIDO',
                    style: TextStyle(
                      color: c.error,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                fmt.format(remaining),
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
              if (paidAmount > 0)
                Text(
                  'Pagado: ${fmt.format(paidAmount)}',
                  style: TextStyle(color: c.success, fontSize: 11),
                ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _typeIcon(String type) {
    switch (type) {
      case 'MONTHLY':
        return Icons.calendar_month_outlined;
      case 'EXTRAORDINARY':
        return Icons.star_outline_rounded;
      case 'PENALTY':
        return Icons.warning_outlined;
      default:
        return Icons.receipt_outlined;
    }
  }
}

// ── Widgets compartidos ─────────────────────────────────────────────────────

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isLight = Theme.of(context).brightness == Brightness.light;
    return Container(
      decoration: BoxDecoration(
        color: c.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
        boxShadow: isLight
            ? [
                BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 2))
              ]
            : null,
      ),
      child: Column(
        children: children.asMap().entries.map((e) {
          return Column(children: [
            e.value,
            if (e.key < children.length - 1) Divider(height: 1, color: c.border),
          ]);
        }).toList(),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: c.textMuted)),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: c.textPrimary),
              textAlign: TextAlign.end,
            ),
          ),
        ],
      ),
    );
  }
}

class _CopyRow extends StatelessWidget {
  final String label;
  final String value;
  const _CopyRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      child: Row(
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: c.textMuted)),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: c.textPrimary,
                fontFamily: 'monospace'),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () {
              Clipboard.setData(ClipboardData(text: value));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('$label copiado'),
                  duration: const Duration(seconds: 2),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
            child: Icon(Icons.copy_rounded, size: 16, color: c.primary),
          ),
        ],
      ),
    );
  }
}
