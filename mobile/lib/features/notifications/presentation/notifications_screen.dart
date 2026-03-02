import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors_scheme.dart';
import '../../../core/network/api_client.dart';
import '../providers/notifications_provider.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final notificationsAsync = ref.watch(notificationsProvider);

    return Scaffold(
      backgroundColor: c.bgMain,
      appBar: AppBar(
        backgroundColor: c.bgSurface,
        title: Text('Notificaciones', style: TextStyle(color: c.textPrimary)),
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
            child: Text('Marcar todo leído',
                style: TextStyle(color: c.primary, fontSize: 12)),
          ),
        ],
      ),
      body: notificationsAsync.when(
        loading: () => Center(child: CircularProgressIndicator(color: c.primary)),
        error: (e, _) => Center(
          child: Text('Error: $e', style: TextStyle(color: c.textSecondary)),
        ),
        data: (notifications) {
          if (notifications.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.notifications_off_rounded, size: 56, color: c.textMuted),
                  const SizedBox(height: 12),
                  Text('No tienes notificaciones',
                      style: TextStyle(color: c.textSecondary, fontSize: 15)),
                ],
              ),
            );
          }
          Future.microtask(() => ref.invalidate(unreadCountProvider));
          return RefreshIndicator(
            color: c.primary,
            onRefresh: () async {
              ref.invalidate(notificationsProvider);
              ref.invalidate(unreadCountProvider);
            },
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: notifications.length,
              separatorBuilder: (_, __) =>
                  Divider(height: 1, color: c.border),
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
      case 'ACCESS_DENIED':     return Icons.block_rounded;
      case 'QR_USED':           return Icons.qr_code_scanner_rounded;
      case 'NEW_CHARGE':        return Icons.receipt_long_rounded;
      case 'PAYMENT_CONFIRMED': return Icons.check_circle_rounded;
      case 'DEVICE_OFFLINE':    return Icons.wifi_off_rounded;
      default:                  return Icons.notifications_rounded;
    }
  }

  Color _iconColor(AppColorsScheme c) {
    switch (item.type) {
      case 'ACCESS_DENIED':     return c.error;
      case 'QR_USED':           return c.primary;
      case 'NEW_CHARGE':        return c.warning;
      case 'PAYMENT_CONFIRMED': return c.success;
      case 'DEVICE_OFFLINE':    return c.textSecondary;
      default:                  return c.info;
    }
  }

  String _timeAgo() {
    final diff = DateTime.now().difference(item.createdAt);
    if (diff.inMinutes < 1)  return 'ahora';
    if (diff.inMinutes < 60) return 'hace ${diff.inMinutes} min';
    if (diff.inHours < 24)   return 'hace ${diff.inHours} h';
    return 'hace ${diff.inDays} d';
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final iconColor = _iconColor(c);
    final isUnread = item.isUnread;

    return Container(
      color: isUnread ? c.primaryGlow : Colors.transparent,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: CircleAvatar(
          backgroundColor: iconColor.withOpacity(0.15),
          child: Icon(_icon(), color: iconColor, size: 20),
        ),
        title: Text(
          item.title,
          style: TextStyle(
            color: c.textPrimary,
            fontWeight: isUnread ? FontWeight.w600 : FontWeight.normal,
            fontSize: 14,
          ),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 2),
            Text(item.body, style: TextStyle(color: c.textSecondary, fontSize: 13)),
            const SizedBox(height: 4),
            Text(_timeAgo(), style: TextStyle(color: c.textMuted, fontSize: 11)),
          ],
        ),
        trailing: isUnread
            ? Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: c.primary, shape: BoxShape.circle),
              )
            : null,
      ),
    );
  }
}
