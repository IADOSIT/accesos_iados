import 'dart:async';
import 'dart:convert';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Plugin — instancia del isolate principal
final FlutterLocalNotificationsPlugin localNotifPlugin =
    FlutterLocalNotificationsPlugin();

/// Canal Android para notificaciones generales (pagos, accesos, avisos)
const AndroidNotificationChannel androidGeneralChannel =
    AndroidNotificationChannel(
  'general_notifications',
  'Notificaciones',
  description: 'Alertas de pagos, accesos y avisos del fraccionamiento',
  importance: Importance.high,
  playSound: true,
  enableVibration: true,
  showBadge: true,
);

/// Canal Android para solicitudes de servicio (fullScreenIntent + max importance)
const AndroidNotificationChannel androidSvcRequestChannel =
    AndroidNotificationChannel(
  'service_requests',
  'Solicitudes de Acceso',
  description: 'Alertas urgentes cuando un visitante solicita acceso al fraccionamiento',
  importance: Importance.max,
  playSound: true,
  enableVibration: true,
  showBadge: true,
);

/// Stream para pasar datos de notificación tappeada al widget tree
final StreamController<Map<String, dynamic>> localNotifTapController =
    StreamController<Map<String, dynamic>>.broadcast();

/// Callback registrado en initialize() — se llama cuando el usuario toca la notificación
@pragma('vm:entry-point')
void onLocalNotifTap(NotificationResponse response) {
  final payload = response.payload;
  if (payload == null) return;
  try {
    final data = Map<String, dynamic>.from(jsonDecode(payload) as Map);
    localNotifTapController.add(data);
  } catch (_) {}
}
