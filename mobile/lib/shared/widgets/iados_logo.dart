import 'package:flutter/material.dart';
import 'dart:math' as math;
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/app_colors.dart';

// ─── Helper: logo3_ia2.png ────────────────────────────────────────────────────
// Reemplaza el hexágono CustomPaint. Para revertir, comenta _logoImage y
// descomenta _HexagonLogo en IadosLogo.build() e IadosFooter.build().
Widget _logoImage(double size) => Image.asset(
      'logo3_ia2.png',
      width: size,
      fit: BoxFit.fitWidth,
    );

class IadosLogo extends StatelessWidget {
  final double size;
  final bool showText;
  final bool animate;

  const IadosLogo({
    super.key,
    this.size = 56,
    this.showText = true,
    this.animate = false,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _logoImage(size), // logo3_ia2.png — para revertir: _HexagonLogo(size: size)
        if (showText) ...[
          const SizedBox(height: 12),
          Text(
            'Acceso Digital',
            style: TextStyle(
              fontSize: size * 0.32,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
          Text(
            'iaDoS',
            style: TextStyle(
              fontSize: size * 0.22,
              fontWeight: FontWeight.w500,
              color: AppColors.primary,
              letterSpacing: 2,
            ),
          ),
        ],
      ],
    );
  }
}

// ─── Hexágono original (comentado para revertir si hace falta) ───────────────
/*
class _HexagonLogo extends StatelessWidget {
  final double size;
  const _HexagonLogo({required this.size});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _HexPainter(),
        child: Center(
          child: Text(
            'iD',
            style: TextStyle(
              fontSize: size * 0.3,
              fontWeight: FontWeight.w800,
              color: AppColors.bgDark,
              letterSpacing: -1,
            ),
          ),
        ),
      ),
    );
  }
}

class _HexPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = size.width / 2;

    final path = _hexPath(cx, cy, r);
    final gradient = const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [AppColors.primary, AppColors.primaryDark],
    ).createShader(Rect.fromCircle(center: Offset(cx, cy), radius: r));
    canvas.drawPath(path, Paint()..shader = gradient);

    final innerPath = _hexPath(cx, cy, r * 0.78);
    canvas.drawPath(innerPath, Paint()
      ..color = AppColors.bgDark.withOpacity(0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2);

    final outerPath = _hexPath(cx, cy, r * 0.98);
    canvas.drawPath(outerPath, Paint()
      ..color = AppColors.primary.withOpacity(0.3)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..maskFilter = const MaskFilter.blur(BlurStyle.outer, 4));
  }

  Path _hexPath(double cx, double cy, double r) {
    final path = Path();
    for (int i = 0; i < 6; i++) {
      final angle = (math.pi / 180) * (60 * i - 30);
      final x = cx + r * math.cos(angle);
      final y = cy + r * math.sin(angle);
      if (i == 0) { path.moveTo(x, y); } else { path.lineTo(x, y); }
    }
    path.close();
    return path;
  }

  @override
  bool shouldRepaint(_HexPainter oldDelegate) => false;
}
*/

// Badge hexagonal pequeño para avatares / estados
class HexBadge extends StatelessWidget {
  final String label;
  final Color color;
  final double size;

  const HexBadge({
    super.key,
    required this.label,
    this.color = AppColors.primary,
    this.size = 32,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _SmallHexPainter(color),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: size * 0.32,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}

class _SmallHexPainter extends CustomPainter {
  final Color color;
  const _SmallHexPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = size.width / 2;
    final path = Path();
    for (int i = 0; i < 6; i++) {
      final angle = (math.pi / 180) * (60 * i - 30);
      final x = cx + r * math.cos(angle);
      final y = cy + r * math.sin(angle);
      i == 0 ? path.moveTo(x, y) : path.lineTo(x, y);
    }
    path.close();
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(_SmallHexPainter old) => old.color != color;
}

// Footer de marca — se usa en login y pantallas publicas
class IadosFooter extends StatelessWidget {
  const IadosFooter({super.key});

  Future<void> _openSite() async {
    final uri = Uri.parse('https://iados.mx');
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _openSite,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _logoImage(16), // logo3_ia2.png — para revertir: _HexagonLogo(size: 16)
          const SizedBox(width: 6),
          const Text(
            'iados.mx',
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 12,
              letterSpacing: 0.5,
              decoration: TextDecoration.underline,
              decorationColor: AppColors.textMuted,
            ),
          ),
        ],
      ),
    );
  }
}
