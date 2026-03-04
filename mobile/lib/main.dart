import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'core/services/local_notif_service.dart';
import 'app.dart';

// ── Background handler FCM (top-level, corre en isolate separado) ─────────────
// Sólo se invoca para mensajes DATA-ONLY (sin notification field en Android).
// Crea una notificación local con fullScreenIntent para irrumpir en pantalla.
@pragma('vm:entry-point')
Future<void> _fcmBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  if (message.data['type'] != 'SERVICE_REQUEST') return;

  // Crear instancia fresca (isolate separado, no comparte estado con main)
  final plugin = FlutterLocalNotificationsPlugin();
  await plugin.initialize(const InitializationSettings(
    android: AndroidInitializationSettings('@mipmap/ic_launcher'),
  ));
  await plugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(const AndroidNotificationChannel(
        'service_requests',
        'Solicitudes de Acceso',
        importance: Importance.max,
      ));

  final title = message.data['_title'] as String? ?? '🔔 Solicitud de acceso';
  final body  = message.data['_body']  as String? ?? 'Un visitante está esperando';

  await plugin.show(
    message.hashCode,
    title,
    body,
    NotificationDetails(
      android: AndroidNotificationDetails(
        'service_requests',
        'Solicitudes de Acceso',
        importance: Importance.max,
        priority: Priority.high,
        fullScreenIntent: true,          // ← irrumpe en pantalla de bloqueo
        visibility: NotificationVisibility.public,
        playSound: true,
        enableVibration: true,
        styleInformation: BigTextStyleInformation(
          message.data['unitLabel'] as String? ?? '',
          summaryText: message.data['service'] as String? ?? '',
        ),
      ),
      iOS: const DarwinNotificationDetails(
        presentAlert: true,
        presentSound: true,
        presentBadge: true,
        interruptionLevel: InterruptionLevel.timeSensitive, // ← rompe Focus modes
      ),
    ),
    payload: jsonEncode(message.data),
  );
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  if (!kIsWeb) {
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ));
    await SystemChrome.setPreferredOrientations([
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
    ]);

    // ── Flutter Local Notifications ──────────────────────────────────────────
    await localNotifPlugin.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: true,
          requestBadgePermission: true,
          requestSoundPermission: true,
        ),
      ),
      onDidReceiveNotificationResponse: onLocalNotifTap,
    );

    // Crear canales Android (idempotente)
    final androidPlugin = localNotifPlugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(androidGeneralChannel);
    await androidPlugin?.createNotificationChannel(androidSvcRequestChannel);
    await androidPlugin?.createNotificationChannel(androidPanicChannel);

    // Android 13+ (API 33+): solicitar POST_NOTIFICATIONS en runtime
    await androidPlugin?.requestNotificationsPermission();

    // ── Firebase ─────────────────────────────────────────────────────────────
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(_fcmBackgroundHandler);
      // Solicita permisos en iOS y Android 13+ (maneja POST_NOTIFICATIONS automáticamente)
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
        criticalAlert: false,
        carPlay: false,
        announcement: false,
      );
      // Desactivar la presentación automática de FCM en foreground (manejamos con local_notif)
      await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
        alert: false,
        badge: true,
        sound: false,
      );
    } catch (e) {
      debugPrint('[FCM] Firebase no inicializado: $e');
    }
  }

  runApp(
    const ProviderScope(
      child: AccesoDigitalApp(),
    ),
  );
}
