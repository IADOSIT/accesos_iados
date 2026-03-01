import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../providers/notifications_provider.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        backgroundColor: AppColors.bgSurface,
        title: const Text('Notificaciones', style: TextStyle(color: AppColors.textPrimary)),
        actions: [
          TextButton(
            onPressed: () async {
              final api = ref.read(apiClientProvider);
              try {
                await api.patch('/notifications/read-all', data: {});
                ref.invalidate(notificationsProvider);
                ref.invalidate(unreadCountProvider);
              } catch (_) {}
            },
            child: const Text('Marcar todo leído',
                style: TextStyle(color: AppColors.primary, fontSize: 12)),
          ),
        ],
      ),
      body: notificationsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (e, _) => Center(
          child: Text('Error: $e', style: const TextStyle(color: AppColors.textSecondary)),
        ),
        data: (notifications) {
          if (notifications.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.notifications_off_rounded, size: 56, color: AppColors.textMuted),
                  SizedBox(height: 12),
                  Text('No tienes notificaciones',
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 15)),
                ],
              ),
            );
          }
          // Al abrir la pantalla, refrescar el badge
          Future.microtask(() => ref.invalidate(unreadCountProvider));
          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async {
              ref.invalidate(notificationsProvider);
              ref.invalidate(unreadCountProvider);
            },
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: notifications.length,
              separatorBuilder: (_, __) =>
                  const Divider(height: 1, color: AppColors.border),
              itemBuilder: (_, i) => _NotificationTile(item: notifications[i]),
            ),
          );
        },
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final NotificationItem item;
  const _NotificationTile({required this.item});

  IconData _icon() {
    switch (item.type) {
      case 'ACCESS_DENIED':
        return Icons.block_rounded;
      case 'QR_USED':
        return Icons.qr_code_scanner_rounded;
      case 'NEW_CHARGE':
        return Icons.receipt_long_rounded;
      case 'PAYMENT_CONFIRMED':
        return Icons.check_circle_rounded;
      case 'DEVICE_OFFLINE':
        return Icons.wifi_off_rounded;
      default:
        return Icons.notifications_rounded;
    }
  }

  Color _iconColor() {
    switch (item.type) {
      case 'ACCESS_DENIED':
        return AppColors.error;
      case 'QR_USED':
        return AppColors.primary;
      case 'NEW_CHARGE':
        return AppColors.warning;
      case 'PAYMENT_CONFIRMED':
        return AppColors.success;
      case 'DEVICE_OFFLINE':
        return AppColors.textSecondary;
      default:
        return AppColors.info;
    }
  }

  String _timeAgo() {
    final diff = DateTime.now().difference(item.createdAt);
    if (diff.inMinutes < 1) return 'ahora';
    if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'hace ${diff.inHours} h';
    return 'hace ${diff.inDays} d';
  }

  @override
  Widget build(BuildContext context) {
    final isUnread = item.isUnread;
    return Container(
      color: isUnread ? AppColors.primaryGlow : Colors.transparent,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: CircleAvatar(
          backgroundColor: _iconColor().withOpacity(0.15),
          child: Icon(_icon(), color: _iconColor(), size: 20),
        ),
        title: Text(
          item.title,
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: isUnread ? FontWeight.w600 : FontWeight.normal,
            fontSize: 14,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 2),
            Text(item.body,
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
            const SizedBox(height: 4),
            Text(_timeAgo(),
                style: const TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ],
        ),
        trailing: isUnread
            ? Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              )
            : null,
      ),
    );
  }
}
