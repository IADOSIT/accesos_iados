import 'package:flutter/material.dart';

class AppColorsLight {
  AppColorsLight._();

  // Brand (mismo verde iaDoS)
  static const Color primary      = Color(0xFF10B981);
  static const Color primaryDark  = Color(0xFF059669);
  static const Color primaryLight = Color(0xFF34D399);
  static const Color primaryGlow  = Color(0x2010B981);

  // Backgrounds
  static const Color bgMain    = Color(0xFFF8FAFC); // fondo principal
  static const Color bgSurface = Color(0xFFFFFFFF); // superficies / nav bar
  static const Color bgCard    = Color(0xFFF1F5F9); // cards
  static const Color bgInput   = Color(0xFFFFFFFF); // inputs

  // Borders
  static const Color border     = Color(0xFFE2E8F0);
  static const Color borderGlow = Color(0x4010B981);

  // Text
  static const Color textPrimary   = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF475569);
  static const Color textMuted     = Color(0xFF94A3B8);
  static const Color textInverse   = Color(0xFFFFFFFF);

  // Status (mismo que dark)
  static const Color success  = Color(0xFF10B981);
  static const Color warning  = Color(0xFFF59E0B);
  static const Color error    = Color(0xFFEF4444);
  static const Color info     = Color(0xFF3B82F6);

  // Access states
  static const Color accessGranted = Color(0xFF10B981);
  static const Color accessDenied  = Color(0xFFEF4444);
  static const Color accessPending = Color(0xFFF59E0B);

  // Delinquent
  static const Color delinquent   = Color(0xFFEF4444);
  static const Color delinquentBg = Color(0x20EF4444);

  // Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF10B981), Color(0xFF059669)],
  );

  static const LinearGradient bgGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFFF8FAFC), Color(0xFFEEF2FF)],
  );

  static const LinearGradient cardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFFFFFF), Color(0xFFF8FAFC)],
  );
}
