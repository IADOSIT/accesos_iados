import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';

final chargesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/payments/charges', params: {'status': 'PENDING'});
  return res.data['data'] as List? ?? [];
});

class PaymentsScreen extends ConsumerWidget {
  const PaymentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final charges = ref.watch(chargesProvider);
    final currencyFmt = NumberFormat.currency(locale: 'es_MX', symbol: '\$');

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        title: const Text('Pagos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(chargesProvider),
          ),
        ],
      ),
      body: charges.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(e.toString(),
                    style: const TextStyle(color: AppColors.error, fontSize: 12),
                    textAlign: TextAlign.center),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.invalidate(chargesProvider),
                child: const Text('Reintentar'),
              ),
            ],
          ),
        ),
        data: (items) => CustomScrollView(
          slivers: [
            // Resumen total
            SliverToBoxAdapter(
              child: _PaymentSummary(charges: items, fmt: currencyFmt),
            ),
            // Lista de cargos
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 80),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (_, i) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _ChargeCard(charge: items[i], fmt: currencyFmt),
                  ),
                  childCount: items.length,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PaymentSummary extends StatelessWidget {
  final List<dynamic> charges;
  final NumberFormat fmt;
  const _PaymentSummary({required this.charges, required this.fmt});

  @override
  Widget build(BuildContext context) {
    double total = 0;
    for (final c in charges) {
      try {
        total += double.parse(c['amount'].toString());
      } catch (_) {}
    }

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: AppColors.primaryGradient,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withOpacity(0.3),
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
              const Text(
                'Total pendiente',
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
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
                '${charges.length} cargo(s) pendiente(s)',
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

class _ChargeCard extends StatelessWidget {
  final dynamic charge;
  final NumberFormat fmt;
  const _ChargeCard({required this.charge, required this.fmt});

  @override
  Widget build(BuildContext context) {
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

    final color = isOverdue ? AppColors.error : AppColors.warning;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isOverdue ? AppColors.error.withOpacity(0.3) : AppColors.border,
        ),
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
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'Vence: $dueDateStr',
                  style: TextStyle(
                    color: isOverdue ? AppColors.error : AppColors.textMuted,
                    fontSize: 12,
                  ),
                ),
                if (isOverdue)
                  const Text(
                    'VENCIDO',
                    style: TextStyle(
                      color: AppColors.error,
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
                  style: const TextStyle(
                    color: AppColors.success,
                    fontSize: 11,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _typeIcon(String type) {
    switch (type) {
      case 'MONTHLY': return Icons.calendar_month_outlined;
      case 'EXTRAORDINARY': return Icons.star_outline_rounded;
      case 'PENALTY': return Icons.warning_outlined;
      default: return Icons.receipt_outlined;
    }
  }
}
