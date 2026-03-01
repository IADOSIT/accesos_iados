import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'app.dart';

// Handler de mensajes FCM en background (función top-level obligatoria)
@pragma('vm:entry-point')
Future<void> _fcmBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // FCM muestra la notificación automáticamente en background
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

    // Inicializar Firebase (requiere google-services.json en android/app/)
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(_fcmBackgroundHandler);
      // Solicitar permisos de notificaciones (iOS / Android 13+)
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
    } catch (e) {
      // Sin google-services.json: la app funciona sin notificaciones push
      debugPrint('[FCM] Firebase no inicializado: $e');
    }
  }

  runApp(
    const ProviderScope(
      child: AccesoDigitalApp(),
    ),
  );
}
