import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/providers/auth_provider.dart';

final accessLogsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/access/logs', params: {'limit': '50'});
  return res.data['data'] as List? ?? [];
});

class AccessScreen extends ConsumerWidget {
  const AccessScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logs = ref.watch(accessLogsProvider);
    final auth = ref.watch(authProvider);
    // QR scanner solo en Android/iOS — en web la cámara requiere HTTPS
    final canScan = (auth.isAdmin || auth.isGuard) && !kIsWeb;

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        title: const Text('Bitácora de Accesos'),
        actions: [
          if (canScan)
            IconButton(
              icon: const Icon(Icons.qr_code_scanner_rounded),
              tooltip: 'Escanear QR',
              onPressed: () => _openScanner(context, ref),
            ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(accessLogsProvider),
          ),
        ],
      ),
      floatingActionButton: canScan
          ? FloatingActionButton.extended(
              onPressed: () => _showManualAccess(context),
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.add_rounded, color: Colors.white),
              label: const Text('Registro manual', style: TextStyle(color: Colors.white)),
            )
          : null,
      body: logs.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.error, size: 48),
              const SizedBox(height: 12),
              Text(e.toString(),
                  style: const TextStyle(color: AppColors.error, fontSize: 12),
                  textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.invalidate(accessLogsProvider),
                child: const Text('Reintentar'),
              ),
            ],
          ),
        ),
        data: (items) => items.isEmpty
            ? const _EmptyState()
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) => _AccessCard(log: items[i]),
              ),
      ),
    );
  }

  void _openScanner(BuildContext context, WidgetRef ref) {
    Navigator.of(context).push(MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => ProviderScope(
        parent: ProviderScope.containerOf(context),
        child: const _QRScannerScreen(),
      ),
    ));
  }

  void _showManualAccess(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      isScrollControlled: true,
      builder: (_) => const _ManualAccessSheet(),
    );
  }
}

// ─── QR Scanner Screen ────────────────────────────────────────────────────────

class _QRScannerScreen extends ConsumerStatefulWidget {
  const _QRScannerScreen();

  @override
  ConsumerState<_QRScannerScreen> createState() => _QRScannerScreenState();
}

class _QRScannerScreenState extends ConsumerState<_QRScannerScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  bool _processing = false;
  _ScanResult? _result;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing) return;
    final code = capture.barcodes.firstOrNull?.rawValue;
    // Solo procesa códigos IAD-
    if (code == null || !code.startsWith('IAD-')) return;

    setState(() => _processing = true);
    await _controller.stop();

    try {
      final api = ref.read(apiClientProvider);

      // Obtener dispositivos — prioriza ONLINE, multitenant automático por header
      final devRes = await api.get('/devices');
      final devices = (devRes.data['data'] as List? ?? []);
      final online = devices.where((d) => d['status'] == 'ONLINE').toList();
      final device = online.isNotEmpty
          ? online.first
          : (devices.isNotEmpty ? devices.first : null);

      if (device == null) {
        setState(() => _result = const _ScanResult(
          granted: false,
          message: 'No hay dispositivos disponibles',
          deviceName: '',
          code: '',
        ));
        return;
      }

      final res = await api.post('/access/open', data: {
        'deviceId': device['id'],
        'method': 'QR',
        'direction': 'ENTRY',
        'qrCode': code,
      });

      final data = res.data['data'] as Map?;
      final granted = data?['granted'] as bool? ?? false;
      final reason = data?['reason'] as String? ?? '';

      ref.invalidate(accessLogsProvider);

      setState(() => _result = _ScanResult(
        granted: granted,
        message: granted ? 'Acceso permitido' : reason.isNotEmpty ? reason : 'Acceso denegado',
        deviceName: device['name'] as String? ?? '',
        code: code,
      ));
    } catch (e) {
      final errStr = e.toString();
      String msg = 'Error al procesar el QR';
      if (errStr.contains('403')) msg = 'Unidad con adeudo pendiente';
      if (errStr.contains('400')) msg = 'QR inválido o agotado';
      if (errStr.contains('404')) msg = 'QR no encontrado';

      setState(() => _result = _ScanResult(
        granted: false,
        message: msg,
        deviceName: '',
        code: code ?? '',
      ));
    }
  }

  void _reset() {
    setState(() {
      _processing = false;
      _result = null;
    });
    _controller.start();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text('Escanear QR de acceso'),
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on_rounded),
            tooltip: 'Linterna',
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _processing ? null : _onDetect,
          ),
          if (_result == null) const _ScanOverlay(),
          if (_processing && _result == null)
            const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          if (_result != null)
            _ResultOverlay(
              result: _result!,
              onScanAgain: _reset,
              onClose: () => Navigator.pop(context),
            ),
        ],
      ),
    );
  }
}

// ─── Resultado del escaneo ────────────────────────────────────────────────────

class _ScanResult {
  final bool granted;
  final String message;
  final String deviceName;
  final String code;
  const _ScanResult({
    required this.granted,
    required this.message,
    required this.deviceName,
    required this.code,
  });
}

// ─── Overlay de cámara con recuadro de escaneo ────────────────────────────────

class _ScanOverlay extends StatelessWidget {
  const _ScanOverlay();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _OverlayPainter(),
      child: Align(
        alignment: const Alignment(0, 0.55),
        child: Text(
          'Apunta al código QR del visitante',
          style: TextStyle(
            color: Colors.white.withOpacity(0.85),
            fontSize: 14,
            shadows: const [Shadow(blurRadius: 8, color: Colors.black54)],
          ),
        ),
      ),
    );
  }
}

class _OverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final boxSize = size.width * 0.68;
    final boxLeft = (size.width - boxSize) / 2;
    final boxTop = (size.height - boxSize) / 2 - 40;
    final boxRect = Rect.fromLTWH(boxLeft, boxTop, boxSize, boxSize);

    // Fondo semitransparente con recorte
    final overlayPaint = Paint()..color = Colors.black.withOpacity(0.6);
    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(RRect.fromRectAndRadius(boxRect, const Radius.circular(16)))
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(path, overlayPaint);

    // Esquinas decorativas en color primary
    final cornerPaint = Paint()
      ..color = AppColors.primary
      ..strokeWidth = 3.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    const c = 22.0; // longitud de la esquina
    final l = boxLeft;
    final t = boxTop;
    final r = boxLeft + boxSize;
    final b = boxTop + boxSize;

    // Top-left
    canvas.drawLine(Offset(l, t + c), Offset(l, t), cornerPaint);
    canvas.drawLine(Offset(l, t), Offset(l + c, t), cornerPaint);
    // Top-right
    canvas.drawLine(Offset(r - c, t), Offset(r, t), cornerPaint);
    canvas.drawLine(Offset(r, t), Offset(r, t + c), cornerPaint);
    // Bottom-left
    canvas.drawLine(Offset(l, b - c), Offset(l, b), cornerPaint);
    canvas.drawLine(Offset(l, b), Offset(l + c, b), cornerPaint);
    // Bottom-right
    canvas.drawLine(Offset(r - c, b), Offset(r, b), cornerPaint);
    canvas.drawLine(Offset(r, b - c), Offset(r, b), cornerPaint);
  }

  @override
  bool shouldRepaint(_OverlayPainter old) => false;
}

// ─── Overlay de resultado (éxito/error) ──────────────────────────────────────

class _ResultOverlay extends StatelessWidget {
  final _ScanResult result;
  final VoidCallback onScanAgain;
  final VoidCallback onClose;

  const _ResultOverlay({
    required this.result,
    required this.onScanAgain,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    final color = result.granted ? AppColors.accessGranted : AppColors.accessDenied;
    final icon = result.granted ? Icons.check_circle_rounded : Icons.cancel_rounded;

    return Container(
      color: Colors.black.withOpacity(0.85),
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 96),
          const SizedBox(height: 24),
          Text(
            result.message,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: color,
              fontSize: 24,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (result.deviceName.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              result.deviceName,
              style: const TextStyle(color: Colors.white54, fontSize: 14),
            ),
          ],
          if (result.code.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              result.code,
              style: const TextStyle(
                color: Colors.white38,
                fontSize: 12,
                fontFamily: 'monospace',
              ),
            ),
          ],
          const SizedBox(height: 48),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: onScanAgain,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              icon: const Icon(Icons.qr_code_scanner_rounded, color: Colors.white),
              label: const Text(
                'Escanear otro',
                style: TextStyle(color: Colors.white, fontSize: 16),
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: onClose,
            child: const Text('Cerrar', style: TextStyle(color: Colors.white54)),
          ),
        ],
      ),
    );
  }
}

// ─── Access Card ─────────────────────────────────────────────────────────────

class _AccessCard extends StatelessWidget {
  final dynamic log;
  const _AccessCard({required this.log});

  @override
  Widget build(BuildContext context) {
    final granted = log['granted'] as bool? ?? false;
    final method = log['method'] as String? ?? '';
    final direction = log['direction'] as String? ?? 'ENTRY';
    final visitorName = log['visitorName'] as String?;
    final visitorPlate = log['visitorPlate'] as String?;
    final notes = log['notes'] as String?;
    final createdAt = log['createdAt'] as String?;
    final isDelinquent = log['reason'] == 'DELINQUENT';

    final color = granted ? AppColors.accessGranted : AppColors.accessDenied;
    final dirIcon = direction == 'ENTRY' ? Icons.login_rounded : Icons.logout_rounded;

    String timeStr = '';
    String dateStr = '';
    if (createdAt != null) {
      try {
        final dt = DateTime.parse(createdAt).toLocal();
        timeStr = DateFormat('HH:mm').format(dt);
        dateStr = DateFormat('dd/MM/yyyy').format(dt);
      } catch (_) {}
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDelinquent ? AppColors.delinquent.withOpacity(0.4) : AppColors.border,
        ),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    granted ? Icons.check_rounded : Icons.close_rounded,
                    color: color,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            visitorName ?? 'Residente',
                            style: const TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                          if (isDelinquent) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.delinquentBg,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                'MOROSO',
                                style: TextStyle(
                                  color: AppColors.delinquent,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          Icon(dirIcon, size: 12, color: AppColors.textMuted),
                          const SizedBox(width: 4),
                          Text(
                            direction == 'ENTRY' ? 'Entrada' : 'Salida',
                            style:
                                const TextStyle(color: AppColors.textMuted, fontSize: 12),
                          ),
                          const Text(' · ',
                              style: TextStyle(color: AppColors.textMuted)),
                          Text(
                            _methodLabel(method),
                            style:
                                const TextStyle(color: AppColors.textMuted, fontSize: 12),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      timeStr,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    Text(
                      dateStr,
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding:
                          const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        granted ? 'Permitido' : 'Denegado',
                        style: TextStyle(
                          color: color,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (visitorPlate != null || notes != null)
            Container(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              child: Row(
                children: [
                  if (visitorPlate != null) ...[
                    const Icon(Icons.directions_car_outlined,
                        size: 12, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text(visitorPlate,
                        style:
                            const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                  ],
                  if (notes != null) ...[
                    const SizedBox(width: 12),
                    const Icon(Icons.notes_rounded, size: 12, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text(notes,
                        style:
                            const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }

  String _methodLabel(String method) {
    switch (method) {
      case 'APP':
        return 'App';
      case 'QR':
        return 'QR';
      case 'GUARD_OVERRIDE':
        return 'Guardia';
      case 'REMOTE':
        return 'Remoto';
      case 'EXIT_SENSOR':
        return 'Sensor';
      default:
        return method;
    }
  }
}

// ─── Manual Access Sheet ──────────────────────────────────────────────────────

class _ManualAccessSheet extends ConsumerStatefulWidget {
  const _ManualAccessSheet();

  @override
  ConsumerState<_ManualAccessSheet> createState() => _ManualAccessSheetState();
}

class _ManualAccessSheetState extends ConsumerState<_ManualAccessSheet> {
  final _nameCtrl = TextEditingController();
  final _plateCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String _direction = 'ENTRY';
  bool _loading = false;
  List<dynamic> _devices = [];
  String? _selectedDeviceId;
  String? _devicesError;

  @override
  void initState() {
    super.initState();
    _loadDevices();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _plateCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadDevices() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get('/devices');
      final list = (res.data['data'] as List? ?? [])
          .where((d) => d['isActive'] != false)
          .toList();
      if (mounted) {
        setState(() {
          _devices = list;
          if (list.isNotEmpty) _selectedDeviceId = list.first['id'] as String;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _devicesError = 'No se pudieron cargar los dispositivos');
      }
    }
  }

  Future<void> _register() async {
    if (_selectedDeviceId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No hay dispositivos disponibles')),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final body = <String, dynamic>{
        'deviceId': _selectedDeviceId,
        'method': 'GUARD_OVERRIDE',
        'direction': _direction,
      };
      final name = _nameCtrl.text.trim();
      final plate = _plateCtrl.text.trim();
      final notes = _notesCtrl.text.trim();
      if (name.isNotEmpty) body['visitorName'] = name;
      if (plate.isNotEmpty) body['visitorPlate'] = plate;
      if (notes.isNotEmpty) body['notes'] = notes;

      await api.post('/access/open', data: body);
      ref.invalidate(accessLogsProvider);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Registro manual de acceso',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 20),
            if (_devicesError != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(_devicesError!,
                    style: const TextStyle(color: AppColors.error, fontSize: 13)),
              )
            else if (_devices.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('Cargando dispositivos...',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
              )
            else
              DropdownButtonFormField<String>(
                value: _selectedDeviceId,
                dropdownColor: AppColors.bgCard,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(labelText: 'Dispositivo *'),
                items: _devices
                    .map<DropdownMenuItem<String>>(
                      (d) => DropdownMenuItem<String>(
                        value: d['id'] as String,
                        child: Text(d['name'] as String? ?? d['id'] as String),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setState(() => _selectedDeviceId = v),
              ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                    child: _DirectionButton(
                  label: 'Entrada',
                  icon: Icons.login_rounded,
                  selected: _direction == 'ENTRY',
                  onTap: () => setState(() => _direction = 'ENTRY'),
                )),
                const SizedBox(width: 8),
                Expanded(
                    child: _DirectionButton(
                  label: 'Salida',
                  icon: Icons.logout_rounded,
                  selected: _direction == 'EXIT',
                  onTap: () => setState(() => _direction = 'EXIT'),
                )),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _nameCtrl,
              decoration:
                  const InputDecoration(labelText: 'Nombre del visitante (opcional)'),
              style: const TextStyle(color: AppColors.textPrimary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _plateCtrl,
              decoration: const InputDecoration(labelText: 'Placa (opcional)'),
              style: const TextStyle(color: AppColors.textPrimary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notesCtrl,
              decoration: const InputDecoration(labelText: 'Notas (opcional)'),
              style: const TextStyle(color: AppColors.textPrimary),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _register,
                child: _loading
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Registrar acceso'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DirectionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  const _DirectionButton(
      {required this.label,
      required this.icon,
      required this.selected,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withOpacity(0.15) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 16, color: selected ? AppColors.primary : AppColors.textMuted),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: selected ? AppColors.primary : AppColors.textMuted,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Empty State ─────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState();
  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.history_rounded, color: AppColors.textMuted, size: 56),
          SizedBox(height: 16),
          Text(
            'Sin registros de acceso',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 16),
          ),
        ],
      ),
    );
  }
}
