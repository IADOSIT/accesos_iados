import 'package:flutter/material.dart';

/// Sistema de colores temático para iaDoS.
/// Adjuntado al ThemeData como extension → acceder via `context.colors`.
@immutable
class AppColorsScheme extends ThemeExtension<AppColorsScheme> {
  const AppColorsScheme({
    required this.bgMain,
    required this.bgSurface,
    required this.bgCard,
    required this.bgInput,
    required this.border,
    required this.borderGlow,
    required this.primary,
    required this.primaryDark,
    required this.primaryLight,
    required this.primaryGlow,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textInverse,
    required this.success,
    required this.warning,
    required this.error,
    required this.info,
    required this.accessGranted,
    required this.accessDenied,
    required this.accessPending,
    required this.delinquent,
    required this.delinquentBg,
    required this.primaryGradient,
    required this.bgGradient,
    required this.cardGradient,
  });

  final Color bgMain;
  final Color bgSurface;
  final Color bgCard;
  final Color bgInput;
  final Color border;
  final Color borderGlow;
  final Color primary;
  final Color primaryDark;
  final Color primaryLight;
  final Color primaryGlow;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textInverse;
  final Color success;
  final Color warning;
  final Color error;
  final Color info;
  final Color accessGranted;
  final Color accessDenied;
  final Color accessPending;
  final Color delinquent;
  final Color delinquentBg;
  final LinearGradient primaryGradient;
  final LinearGradient bgGradient;
  final LinearGradient cardGradient;

  // ── Tema oscuro (iaDoS original) ─────────────────────────────────────────
  static const dark = AppColorsScheme(
    bgMain:        Color(0xFF0A0F1E),
    bgSurface:     Color(0xFF111827),
    bgCard:        Color(0xFF1F2937),
    bgInput:       Color(0xFF1A2332),
    border:        Color(0xFF2D3748),
    borderGlow:    Color(0x4010B981),
    primary:       Color(0xFF10B981),
    primaryDark:   Color(0xFF059669),
    primaryLight:  Color(0xFF34D399),
    primaryGlow:   Color(0x2010B981),
    textPrimary:   Color(0xFFFFFFFF),
    textSecondary: Color(0xFF9CA3AF),
    textMuted:     Color(0xFF6B7280),
    textInverse:   Color(0xFF0A0F1E),
    success:       Color(0xFF10B981),
    warning:       Color(0xFFF59E0B),
    error:         Color(0xFFEF4444),
    info:          Color(0xFF3B82F6),
    accessGranted: Color(0xFF10B981),
    accessDenied:  Color(0xFFEF4444),
    accessPending: Color(0xFFF59E0B),
    delinquent:    Color(0xFFEF4444),
    delinquentBg:  Color(0x20EF4444),
    primaryGradient: LinearGradient(
      begin: Alignment.topLeft, end: Alignment.bottomRight,
      colors: [Color(0xFF10B981), Color(0xFF059669)],
    ),
    bgGradient: LinearGradient(
      begin: Alignment.topCenter, end: Alignment.bottomCenter,
      colors: [Color(0xFF0A0F1E), Color(0xFF0D1420)],
    ),
    cardGradient: LinearGradient(
      begin: Alignment.topLeft, end: Alignment.bottomRight,
      colors: [Color(0xFF1F2937), Color(0xFF111827)],
    ),
  );

  // ── Tema claro "Slate + Emerald" ─────────────────────────────────────────
  // Paleta profesional inspirada en apps fintech/SaaS modernas.
  // Fondo slate-100 (#F1F5F9) + cards blancas + verde esmeralda
  // con alto contraste WCAG AA en todos los textos.
  static const light = AppColorsScheme(
    bgMain:        Color(0xFFF1F5F9),  // slate-100 – fondo general
    bgSurface:     Color(0xFFFFFFFF),  // blanco – AppBar, cards
    bgCard:        Color(0xFFFFFFFF),  // blanco – cards elevadas
    bgInput:       Color(0xFFF8FAFC),  // slate-50 – fondo de inputs
    border:        Color(0xFFE2E8F0),  // slate-200 – bordes suaves
    borderGlow:    Color(0x4005966A),
    primary:       Color(0xFF059669),  // emerald-600 – mejor contraste en blanco
    primaryDark:   Color(0xFF047857),  // emerald-700
    primaryLight:  Color(0xFF10B981),  // emerald-500
    primaryGlow:   Color(0x14059669),  // glow sutil
    textPrimary:   Color(0xFF0F172A),  // slate-900 – máximo contraste
    textSecondary: Color(0xFF475569),  // slate-600
    textMuted:     Color(0xFF94A3B8),  // slate-400
    textInverse:   Color(0xFFFFFFFF),  // sobre fondos de color
    success:       Color(0xFF059669),  // emerald-600
    warning:       Color(0xFFD97706),  // amber-600
    error:         Color(0xFFDC2626),  // red-600
    info:          Color(0xFF2563EB),  // blue-600
    accessGranted: Color(0xFF059669),
    accessDenied:  Color(0xFFDC2626),
    accessPending: Color(0xFFD97706),
    delinquent:    Color(0xFFDC2626),
    delinquentBg:  Color(0x10DC2626),
    primaryGradient: LinearGradient(
      begin: Alignment.topLeft, end: Alignment.bottomRight,
      colors: [Color(0xFF059669), Color(0xFF047857)],
    ),
    bgGradient: LinearGradient(
      begin: Alignment.topCenter, end: Alignment.bottomCenter,
      colors: [Color(0xFFF1F5F9), Color(0xFFE8EFF5)],
    ),
    cardGradient: LinearGradient(
      begin: Alignment.topLeft, end: Alignment.bottomRight,
      colors: [Color(0xFFFFFFFF), Color(0xFFF8FAFC)],
    ),
  );

  @override
  AppColorsScheme copyWith({
    Color? bgMain, Color? bgSurface, Color? bgCard, Color? bgInput,
    Color? border, Color? borderGlow,
    Color? primary, Color? primaryDark, Color? primaryLight, Color? primaryGlow,
    Color? textPrimary, Color? textSecondary, Color? textMuted, Color? textInverse,
    Color? success, Color? warning, Color? error, Color? info,
    Color? accessGranted, Color? accessDenied, Color? accessPending,
    Color? delinquent, Color? delinquentBg,
    LinearGradient? primaryGradient, LinearGradient? bgGradient, LinearGradient? cardGradient,
  }) => AppColorsScheme(
    bgMain: bgMain ?? this.bgMain,
    bgSurface: bgSurface ?? this.bgSurface,
    bgCard: bgCard ?? this.bgCard,
    bgInput: bgInput ?? this.bgInput,
    border: border ?? this.border,
    borderGlow: borderGlow ?? this.borderGlow,
    primary: primary ?? this.primary,
    primaryDark: primaryDark ?? this.primaryDark,
    primaryLight: primaryLight ?? this.primaryLight,
    primaryGlow: primaryGlow ?? this.primaryGlow,
    textPrimary: textPrimary ?? this.textPrimary,
    textSecondary: textSecondary ?? this.textSecondary,
    textMuted: textMuted ?? this.textMuted,
    textInverse: textInverse ?? this.textInverse,
    success: success ?? this.success,
    warning: warning ?? this.warning,
    error: error ?? this.error,
    info: info ?? this.info,
    accessGranted: accessGranted ?? this.accessGranted,
    accessDenied: accessDenied ?? this.accessDenied,
    accessPending: accessPending ?? this.accessPending,
    delinquent: delinquent ?? this.delinquent,
    delinquentBg: delinquentBg ?? this.delinquentBg,
    primaryGradient: primaryGradient ?? this.primaryGradient,
    bgGradient: bgGradient ?? this.bgGradient,
    cardGradient: cardGradient ?? this.cardGradient,
  );

  @override
  AppColorsScheme lerp(ThemeExtension<AppColorsScheme>? other, double t) {
    if (other is! AppColorsScheme) return this;
    return AppColorsScheme(
      bgMain:        Color.lerp(bgMain, other.bgMain, t)!,
      bgSurface:     Color.lerp(bgSurface, other.bgSurface, t)!,
      bgCard:        Color.lerp(bgCard, other.bgCard, t)!,
      bgInput:       Color.lerp(bgInput, other.bgInput, t)!,
      border:        Color.lerp(border, other.border, t)!,
      borderGlow:    Color.lerp(borderGlow, other.borderGlow, t)!,
      primary:       Color.lerp(primary, other.primary, t)!,
      primaryDark:   Color.lerp(primaryDark, other.primaryDark, t)!,
      primaryLight:  Color.lerp(primaryLight, other.primaryLight, t)!,
      primaryGlow:   Color.lerp(primaryGlow, other.primaryGlow, t)!,
      textPrimary:   Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted:     Color.lerp(textMuted, other.textMuted, t)!,
      textInverse:   Color.lerp(textInverse, other.textInverse, t)!,
      success:       Color.lerp(success, other.success, t)!,
      warning:       Color.lerp(warning, other.warning, t)!,
      error:         Color.lerp(error, other.error, t)!,
      info:          Color.lerp(info, other.info, t)!,
      accessGranted: Color.lerp(accessGranted, other.accessGranted, t)!,
      accessDenied:  Color.lerp(accessDenied, other.accessDenied, t)!,
      accessPending: Color.lerp(accessPending, other.accessPending, t)!,
      delinquent:    Color.lerp(delinquent, other.delinquent, t)!,
      delinquentBg:  Color.lerp(delinquentBg, other.delinquentBg, t)!,
      primaryGradient: (Gradient.lerp(primaryGradient, other.primaryGradient, t) as LinearGradient?) ?? other.primaryGradient,
      bgGradient:     (Gradient.lerp(bgGradient, other.bgGradient, t) as LinearGradient?) ?? other.bgGradient,
      cardGradient:   (Gradient.lerp(cardGradient, other.cardGradient, t) as LinearGradient?) ?? other.cardGradient,
    );
  }
}

/// Acceso rápido: `context.colors.bgCard`
extension AppColorsContext on BuildContext {
  AppColorsScheme get colors =>
      Theme.of(this).extension<AppColorsScheme>() ?? AppColorsScheme.dark;
}
