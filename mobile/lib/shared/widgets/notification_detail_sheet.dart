import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/constants/app_colors_scheme.dart';
import '../../core/network/api_client.dart';
import '../../features/notifications/providers/notifications_provider.dart';

// Muestra el detalle de una notificación y la marca como leída si estaba pendiente.
Future<void> showNotificationDetail(
  BuildContext context,
  WidgetRef ref,
  NotificationItem item,
) async {
  if (item.isUnread) {
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/notifications/${item.id}/read', data: {});
      ref.invalidate(notificationsProvider);
      ref.invalidate(unreadCountProvider);
      ref.invalidate(recentNotificationsProvider);
    } catch (_) {}
  }
  if (!context.mounted) return;
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => NotificationDetailSheet(item: item),
  );
}

class NotificationDetailSheet extends StatelessWidget {
  final NotificationItem item;
  const NotificationDetailSheet({super.key, required this.item});

  static const _typeLabels = <String, String>{
    'ACCESS_DENIED':     'Acceso denegado',
    'QR_USED':           'QR utilizado',
    'NEW_CHARGE':        'Nuevo cargo',
    'PAYMENT_CONFIRMED': 'Pago confirmado',
    'DEVICE_OFFLINE':    'Dispositivo offline',
    'SERVICE_REQUEST':   'Solicitud de servicio',
    'PANIC':             'Alerta de pánico',
    'MANUAL':            'Notificación',
  };

  static const _typeIcons = <String, IconData>{
    'ACCESS_DENIED':     Icons.block_rounded,
    'QR_USED':           Icons.qr_code_scanner_rounded,
    'NEW_CHARGE':        Icons.receipt_long_rounded,
    'PAYMENT_CONFIRMED': Icons.check_circle_rounded,
    'DEVICE_OFFLINE':    Icons.wifi_off_rounded,
    'SERVICE_REQUEST':   Icons.manage_accounts_rounded,
    'PANIC':             Icons.crisis_alert_rounded,
  };

  // Etiquetas para campos del payload data
  static const _dataLabels = <String, String>{
    'unitLabel':      'Unidad',
    'unitIdentifier': 'Unidad',
    'method':         'Método',
    'deviceName':     'Dispositivo',
    'direction':      'Dirección',
    'qrType':         'Tipo QR',
    'amount':         'Monto',
    'concept':        'Concepto',
    'dueDate':        'Fecha límite',
    'paymentMethod':  'Método de pago',
    'service':        'Servicio',
    'status':         'Estado',
    'visitorPhone':   'Teléfono visitante',
    'userName':       'Usuario',
    'phone':          'Teléfono',
    'block':          'Bloque',
    'guardName':      'Guardia',
    'plate':          'Placa',
    'residentName':   'Residente',
  };

  Color _typeColor(AppColorsScheme c) {
    switch (item.type) {
      case 'ACCESS_DENIED': return c.error;
      case 'QR_USED':       return c.primary;
      case 'NEW_CHARGE':    return c.warning;
      case 'PAYMENT_CONFIRMED': return c.success;
      case 'DEVICE_OFFLINE':    return c.textSecondary;
      case 'PANIC':             return c.error;
      case 'SERVICE_REQUEST':   return c.info;
      default:                  return c.info;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final typeLabel = _typeLabels[item.type] ?? item.type;
    final typeIcon  = _typeIcons[item.type] ?? Icons.notifications_rounded;
    final typeColor = _typeColor(c);

    final dateStr = DateFormat("d 'de' MMMM yyyy, HH:mm", 'es_MX')
        .format(item.createdAt.toLocal());

    // Campos de data con etiqueta conocida y valor no vacío
    final dataFields = item.data?.entries
        .where((e) => _dataLabels.containsKey(e.key) && e.value != null && e.value.toString().isNotEmpty)
        .toList() ?? [];

    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      builder: (_, controller) => Container(
        decoration: BoxDecoration(
          color: c.bgSurface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Handle
            Container(
              margin: const EdgeInsets.only(top: 12, bottom: 4),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: c.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Expanded(
              child: ListView(
                controller: controller,
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 36),
                children: [
                  // Header: icono + tipo + badge leído/no leído
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: typeColor.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(typeIcon, color: typeColor, size: 26),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              typeLabel,
                              style: TextStyle(
                                color: typeColor,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: item.isUnread
                                    ? c.primary.withOpacity(0.1)
                                    : c.success.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                item.isUnread ? 'No leída' : 'Leída',
                                style: TextStyle(
                                  color: item.isUnread ? c.primary : c.success,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Botón cerrar
                      GestureDetector(
                        onTap: () => Navigator.of(context).pop(),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: c.border.withOpacity(0.5),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.close_rounded, size: 18, color: c.textMuted),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  // Título
                  Text(
                    item.title,
                    style: TextStyle(
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                      color: c.textPrimary,
                      height: 1.3,
                    ),
                  ),

                  const SizedBox(height: 10),

                  // Cuerpo completo
                  Text(
                    item.body,
                    style: TextStyle(fontSize: 15, color: c.textSecondary, height: 1.5),
                  ),

                  const SizedBox(height: 20),
                  Divider(color: c.border, height: 1),
                  const SizedBox(height: 16),

                  // Fecha y hora
                  _DetailRow(
                    icon: Icons.schedule_rounded,
                    label: 'Fecha y hora',
                    value: dateStr,
                    c: c,
                  ),

                  // Datos adicionales del payload
                  if (dataFields.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    ...dataFields.map((e) => _DetailRow(
                      icon: Icons.info_outline_rounded,
                      label: _dataLabels[e.key]!,
                      value: e.value.toString(),
                      c: c,
                    )),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final AppColorsScheme c;
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.c,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Icon(icon, size: 15, color: c.textMuted),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(fontSize: 11, color: c.textMuted, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(fontSize: 14, color: c.textPrimary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
