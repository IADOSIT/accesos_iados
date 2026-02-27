import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // Brand
  static const Color primary = Color(0xFF10B981);       // Emerald green iaDoS
  static const Color primaryDark = Color(0xFF059669);
  static const Color primaryLight = Color(0xFF34D399);
  static const Color primaryGlow = Color(0x2010B981);   // glow para efectos

  // Backgrounds
  static const Color bgDark = Color(0xFF0A0F1E);        // fondo principal
  static const Color bgSurface = Color(0xFF111827);     // cards / surfaces
  static const Color bgCard = Color(0xFF1F2937);        // card elevada
  static const Color bgInput = Color(0xFF1A2332);       // inputs

  // Borders
  static const Color border = Color(0xFF2D3748);
  static const Color borderGlow = Color(0x4010B981);

  // Text
  static const Color textPrimary = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF9CA3AF);
  static const Color textMuted = Color(0xFF6B7280);
  static const Color textInverse = Color(0xFF0A0F1E);

  // Status
  static const Color success = Color(0xFF10B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color error = Color(0xFFEF4444);
  static const Color info = Color(0xFF3B82F6);

  // Access states
  static const Color accessGranted = Color(0xFF10B981);
  static const Color accessDenied = Color(0xFFEF4444);
  static const Color accessPending = Color(0xFFF59E0B);

  // Delinquent
  static const Color delinquent = Color(0xFFEF4444);
  static const Color delinquentBg = Color(0x20EF4444);

  // Gradient principal
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF10B981), Color(0xFF059669)],
  );

  static const LinearGradient bgGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF0A0F1E), Color(0xFF0D1420)],
  );

  static const LinearGradient cardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF1F2937), Color(0xFF111827)],
  );
}
