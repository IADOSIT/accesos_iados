import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';
import 'dart:ui' as ui;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/providers/auth_provider.dart';

// ─── Provider ────────────────────────────────────────────────────────────────

final qrCodesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/access/qr', params: {'limit': '100'});
  return res.data['data'] as List? ?? [];
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

bool _isExpired(dynamic qr) {
  final expiresAt = qr['expiresAt'] as String?;
  if (expiresAt == null) return false;
  try {
    return DateTime.parse(expiresAt).isBefore(DateTime.now());
  } catch (_) {
    return false;
  }
}

bool _isEffectivelyActive(dynamic qr) {
  final isActive = qr['isActive'] as bool? ?? false;
  final maxUses = qr['maxUses'] as int? ?? 1;
  final usedCount = qr['usedCount'] as int? ?? 0;
  return isActive && !_isExpired(qr) && usedCount < maxUses;
}

String _formatDate(String? iso) {
  if (iso == null) return '';
  try {
    final dt = DateTime.parse(iso).toLocal();
    return DateFormat('dd/MM/yyyy HH:mm').format(dt);
  } catch (_) {
    return '';
  }
}

// ─── Screen ──────────────────────────────────────────────────────────────────

class VisitorsScreen extends ConsumerStatefulWidget {
  const VisitorsScreen({super.key});

  @override
  ConsumerState<VisitorsScreen> createState() => _VisitorsScreenState();
}

class _VisitorsScreenState extends ConsumerState<VisitorsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  void _showQRModal(Map<String, dynamic> qr) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (_) => _QRDisplayDialog(
        qr: qr,
        tenantName: ref.read(authProvider).tenantName ?? 'Acceso Digital',
        onRevoked: () => ref.invalidate(qrCodesProvider),
      ),
    );
  }

  void _showGenerateQr() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      isScrollControlled: true,
      builder: (_) => _GenerateQRSheet(
        onGenerated: (qr) {
          ref.invalidate(qrCodesProvider);
          // Mostrar modal con el QR recién generado
          Future.microtask(() {
            if (mounted) _showQRModal(qr);
          });
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final allQRs = ref.watch(qrCodesProvider);

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        title: const Text('Visitantes & QR'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(qrCodesProvider),
          ),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          indicatorColor: AppColors.primary,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textMuted,
          tabs: const [
            Tab(text: 'Activos'),
            Tab(text: 'Vencidos'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showGenerateQr,
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.qr_code_rounded, color: Colors.white),
        label: const Text('Generar QR', style: TextStyle(color: Colors.white)),
      ),
      body: allQRs.when(
        loading: () =>
            const Center(child: CircularProgressIndicator(color: AppColors.primary)),
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
                onPressed: () => ref.invalidate(qrCodesProvider),
                child: const Text('Reintentar'),
              ),
            ],
          ),
        ),
        data: (items) {
          final activos = items.where(_isEffectivelyActive).toList();
          final vencidos = items.where((q) => !_isEffectivelyActive(q)).toList();

          return TabBarView(
            controller: _tabCtrl,
            children: [
              _QRList(
                qrs: activos,
                emptyMessage: 'No hay QRs activos',
                emptyIcon: Icons.qr_code_outlined,
                onTap: _showQRModal,
                onRevoked: () => ref.invalidate(qrCodesProvider),
              ),
              _QRList(
                qrs: vencidos,
                emptyMessage: 'No hay QRs vencidos',
                emptyIcon: Icons.check_circle_outline,
                onTap: _showQRModal,
                onRevoked: () => ref.invalidate(qrCodesProvider),
              ),
            ],
          );
        },
      ),
    );
  }
}

// ─── Lista de QRs ────────────────────────────────────────────────────────────

class _QRList extends StatelessWidget {
  final List<dynamic> qrs;
  final String emptyMessage;
  final IconData emptyIcon;
  final void Function(Map<String, dynamic>) onTap;
  final VoidCallback onRevoked;

  const _QRList({
    required this.qrs,
    required this.emptyMessage,
    required this.emptyIcon,
    required this.onTap,
    required this.onRevoked,
  });

  @override
  Widget build(BuildContext context) {
    if (qrs.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(emptyIcon, color: AppColors.textMuted, size: 56),
            const SizedBox(height: 16),
            Text(emptyMessage,
                style:
                    const TextStyle(color: AppColors.textSecondary, fontSize: 16)),
          ],
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
      itemCount: qrs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (_, i) => _QRCard(
        qr: qrs[i],
        onTap: () => onTap(Map<String, dynamic>.from(qrs[i])),
        onRevoked: onRevoked,
      ),
    );
  }
}

// ─── QR Card ─────────────────────────────────────────────────────────────────

class _QRCard extends ConsumerWidget {
  final dynamic qr;
  final VoidCallback onTap;
  final VoidCallback onRevoked;

  const _QRCard({
    required this.qr,
    required this.onTap,
    required this.onRevoked,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visitorName = qr['visitorName'] as String? ?? 'Visitante';
    final maxUses = qr['maxUses'] as int? ?? 1;
    final usedCount = qr['usedCount'] as int? ?? 0;
    final code = qr['code'] as String? ?? '';
    final unitId = qr['unit']?['identifier'] as String?;
    final expired = _isExpired(qr);
    final active = _isEffectivelyActive(qr);

    final statusColor = active
        ? AppColors.success
        : expired
            ? AppColors.textMuted
            : AppColors.error;

    final statusLabel = active
        ? 'Activo'
        : expired
            ? 'Vencido'
            : 'Revocado';

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: active ? AppColors.border : AppColors.border.withOpacity(0.4),
          ),
        ),
        child: Row(
          children: [
            // QR mini preview
            Container(
              width: 48,
              height: 48,
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: active ? Colors.white : Colors.white.withOpacity(0.4),
                borderRadius: BorderRadius.circular(8),
              ),
              child: QrImageView(
                data: code.isNotEmpty ? code : 'IAD-000000',
                version: QrVersions.auto,
                backgroundColor: Colors.transparent,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    visitorName,
                    style: TextStyle(
                      color: active
                          ? AppColors.textPrimary
                          : AppColors.textMuted,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'Vence: ${_formatDate(qr['expiresAt'] as String?)}',
                    style:
                        const TextStyle(color: AppColors.textMuted, fontSize: 12),
                  ),
                  Row(
                    children: [
                      Text(
                        'Usos: $usedCount/$maxUses',
                        style: const TextStyle(
                            color: AppColors.textMuted, fontSize: 11),
                      ),
                      if (unitId != null) ...[
                        const Text(' · ',
                            style: TextStyle(color: AppColors.textMuted)),
                        Text(
                          'Unidad $unitId',
                          style: const TextStyle(
                              color: AppColors.textMuted, fontSize: 11),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    statusLabel,
                    style: TextStyle(
                      color: statusColor,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (active) ...[
                  const SizedBox(height: 6),
                  GestureDetector(
                    onTap: () => _confirmRevoke(context, ref),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.error.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: AppColors.error.withOpacity(0.3)),
                      ),
                      child: const Text(
                        'Revocar',
                        style: TextStyle(
                          color: AppColors.error,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmRevoke(BuildContext context, WidgetRef ref) async {
    final confirm = await showDialog<bool>(
      context: context,
      useRootNavigator: true,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        title: const Text('Revocar QR',
            style: TextStyle(color: AppColors.textPrimary)),
        content: Text(
          '¿Deshabilitar el QR de "${qr['visitorName']}"? El visitante ya no podrá acceder con este código.',
          style: const TextStyle(color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Revocar',
                style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    try {
      final api = ref.read(apiClientProvider);
      await api.post('/access/qr/${qr['id']}/revoke');
      onRevoked();
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }
}

// ─── QR Display Dialog ───────────────────────────────────────────────────────

class _QRDisplayDialog extends ConsumerStatefulWidget {
  final Map<String, dynamic> qr;
  final String tenantName;
  final VoidCallback onRevoked;

  const _QRDisplayDialog({
    required this.qr,
    required this.tenantName,
    required this.onRevoked,
  });

  @override
  ConsumerState<_QRDisplayDialog> createState() => _QRDisplayDialogState();
}

class _QRDisplayDialogState extends ConsumerState<_QRDisplayDialog> {
  bool _revoking = false;
  bool _sharing = false;
  final _shareKey = GlobalKey();

  Future<void> _shareAsImage() async {
    setState(() => _sharing = true);
    try {
      final boundary =
          _shareKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) throw Exception('No se pudo capturar la imagen');

      final ui.Image image = await boundary.toImage(pixelRatio: 3.0);
      final byteData =
          await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) throw Exception('Error al procesar imagen');

      final bytes = byteData.buffer.asUint8List();
      final code = widget.qr['code'] as String? ?? 'visita';
      final xFile = XFile.fromData(
        bytes,
        name: 'qr-acceso-$code.png',
        mimeType: 'image/png',
      );
      await Share.shareXFiles([xFile], subject: 'Código de acceso QR');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al compartir: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  void _copyCode() {
    final code = widget.qr['code'] as String? ?? '';
    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Código copiado al portapapeles')),
    );
  }

  Future<void> _revoke() async {
    final confirm = await showDialog<bool>(
      context: context,
      useRootNavigator: true,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.bgCard,
        title: const Text('Revocar QR',
            style: TextStyle(color: AppColors.textPrimary)),
        content: const Text(
            'El visitante ya no podrá acceder con este código.',
            style: TextStyle(color: AppColors.textSecondary)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child:
                const Text('Revocar', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _revoking = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.post('/access/qr/${widget.qr['id']}/revoke');
      widget.onRevoked();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _revoking = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final code = widget.qr['code'] as String? ?? '';
    final active = _isEffectivelyActive(widget.qr);

    return Dialog(
      backgroundColor: AppColors.bgCard,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Código QR',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded,
                        color: AppColors.textMuted, size: 20),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // QR Share Card — esto ES la imagen que se comparte
              RepaintBoundary(
                key: _shareKey,
                child: _QRShareCard(
                  qr: widget.qr,
                  tenantName: widget.tenantName,
                ),
              ),
              const SizedBox(height: 14),

              // Copiar código
              GestureDetector(
                onTap: _copyCode,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        code,
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontFamily: 'monospace',
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Icon(Icons.copy_rounded,
                          size: 14, color: AppColors.primary),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Compartir imagen
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _sharing ? null : _shareAsImage,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: _sharing
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.share_rounded, color: Colors.white),
                  label: Text(
                    _sharing ? 'Preparando...' : 'Compartir imagen',
                    style: const TextStyle(color: Colors.white, fontSize: 15),
                  ),
                ),
              ),

              // Revocar (solo si activo)
              if (active) ...[
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _revoking ? null : _revoke,
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(
                          color: AppColors.error.withOpacity(0.5)),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: _revoking
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: AppColors.error),
                          )
                        : const Icon(Icons.block_rounded,
                            color: AppColors.error, size: 18),
                    label: const Text('Revocar QR',
                        style: TextStyle(color: AppColors.error)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ─── QR Share Card (tarjeta blanca que se comparte como imagen) ───────────────

class _QRShareCard extends StatelessWidget {
  final Map<String, dynamic> qr;
  final String tenantName;

  const _QRShareCard({required this.qr, required this.tenantName});

  @override
  Widget build(BuildContext context) {
    final code = qr['code'] as String? ?? '';
    final visitorName = qr['visitorName'] as String? ?? 'Visitante';
    final unitIdentifier = qr['unit']?['identifier'] as String?;
    final createdStr = _formatDate(qr['createdAt'] as String?);
    final expiresStr = _formatDate(qr['expiresAt'] as String?);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Text(
            tenantName,
            style: const TextStyle(
              color: Color(0xFF0F172A),
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 2),
          const Text(
            'Código de acceso para visitante',
            style: TextStyle(color: Color(0xFF64748B), fontSize: 11),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),

          // QR Code
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFE2E8F0)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: QrImageView(
              data: code.isNotEmpty ? code : 'IAD-000000',
              version: QrVersions.auto,
              size: 180,
              backgroundColor: Colors.white,
              eyeStyle: const QrEyeStyle(
                eyeShape: QrEyeShape.square,
                color: Color(0xFF0F172A),
              ),
              dataModuleStyle: const QrDataModuleStyle(
                dataModuleShape: QrDataModuleShape.square,
                color: Color(0xFF0F172A),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Instrucciones
          Container(
            width: double.infinity,
            padding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: Column(
              children: [
                const Text(
                  'Presenta este QR en el lector de la entrada\ndel fraccionamiento',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFF166534),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(Icons.wb_sunny_outlined,
                        size: 12, color: Color(0xFF16A34A)),
                    SizedBox(width: 4),
                    Text(
                      'Sube el brillo de tu dispositivo',
                      style:
                          TextStyle(color: Color(0xFF16A34A), fontSize: 10),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Datos del visitante
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                _CardInfoRow(label: 'Visitante', value: visitorName),
                if (unitIdentifier != null)
                  _CardInfoRow(label: 'Unidad', value: unitIdentifier),
                if (createdStr.isNotEmpty)
                  _CardInfoRow(label: 'Generado', value: createdStr),
                if (expiresStr.isNotEmpty)
                  _CardInfoRow(label: 'Válido hasta', value: expiresStr),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Footer: iados.mx + logo
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Text(
                'iados.mx',
                style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 10,
                  letterSpacing: 0.5,
                ),
              ),
              Image.asset(
                'logo3_ia2.png',
                width: 28,
                height: 28,
                fit: BoxFit.contain,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CardInfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _CardInfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 72,
            child: Text(
              '$label:',
              style: const TextStyle(
                color: Color(0xFF94A3B8),
                fontSize: 11,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: Color(0xFF1E293B),
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Generar QR Sheet ─────────────────────────────────────────────────────────

class _GenerateQRSheet extends ConsumerStatefulWidget {
  final void Function(Map<String, dynamic> qr) onGenerated;
  const _GenerateQRSheet({required this.onGenerated});

  @override
  ConsumerState<_GenerateQRSheet> createState() => _GenerateQRSheetState();
}

class _GenerateQRSheetState extends ConsumerState<_GenerateQRSheet> {
  final _nameCtrl = TextEditingController();
  int _maxUses = 1;
  int _hours = 24;
  bool _loading = false;
  List<dynamic> _units = [];
  String? _selectedUnitId;
  String? _unitsError;

  @override
  void initState() {
    super.initState();
    _loadUnits();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadUnits() async {
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get('/units');
      final list = res.data['data'] as List? ?? [];
      if (mounted) {
        setState(() {
          _units = list;
          if (list.isNotEmpty) _selectedUnitId = list.first['id'] as String;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _unitsError = 'No se pudieron cargar las unidades');
      }
    }
  }

  Future<void> _generate() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Ingresa el nombre del visitante')));
      return;
    }
    if (_selectedUnitId == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Selecciona una unidad')));
      return;
    }
    setState(() => _loading = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.post('/access/qr', data: {
        'visitorName': name,
        'maxUses': _maxUses,
        'expiresInHours': _hours,
        'unitId': _selectedUnitId,
      });
      final qr = res.data['data'] as Map<String, dynamic>;
      if (mounted) {
        Navigator.pop(context);
        widget.onGenerated(qr);
      }
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
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Generar código QR',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _nameCtrl,
              decoration: const InputDecoration(
                labelText: 'Nombre del visitante *',
                prefixIcon: Icon(Icons.person_outline),
              ),
              style: const TextStyle(color: AppColors.textPrimary),
            ),
            const SizedBox(height: 16),
            if (_unitsError != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(_unitsError!,
                    style: const TextStyle(color: AppColors.error, fontSize: 13)),
              )
            else if (_units.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('Cargando unidades...',
                    style:
                        TextStyle(color: AppColors.textMuted, fontSize: 13)),
              )
            else
              DropdownButtonFormField<String>(
                value: _selectedUnitId,
                dropdownColor: AppColors.bgCard,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(labelText: 'Unidad *'),
                items: _units
                    .map<DropdownMenuItem<String>>(
                      (u) => DropdownMenuItem<String>(
                        value: u['id'] as String,
                        child: Text(
                            u['identifier'] as String? ?? u['id'] as String),
                      ),
                    )
                    .toList(),
                onChanged: (v) => setState(() => _selectedUnitId = v),
              ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Usos máximos',
                          style: TextStyle(
                              color: AppColors.textSecondary, fontSize: 13)),
                      Slider(
                        value: _maxUses.toDouble(),
                        min: 1,
                        max: 10,
                        divisions: 9,
                        activeColor: AppColors.primary,
                        label: _maxUses.toString(),
                        onChanged: (v) =>
                            setState(() => _maxUses = v.round()),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Vigencia (horas)',
                          style: TextStyle(
                              color: AppColors.textSecondary, fontSize: 13)),
                      Slider(
                        value: _hours.toDouble(),
                        min: 1,
                        max: 72,
                        divisions: 71,
                        activeColor: AppColors.primary,
                        label: '${_hours}h',
                        onChanged: (v) =>
                            setState(() => _hours = v.round()),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline,
                      color: AppColors.primary, size: 16),
                  const SizedBox(width: 8),
                  Text(
                    '$_maxUses uso(s) · vigente por ${_hours}h',
                    style: const TextStyle(
                        color: AppColors.primary, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _loading ? null : _generate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                icon: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.qr_code_rounded, color: Colors.white),
                label: Text(
                  _loading ? 'Generando...' : 'Generar QR',
                  style: const TextStyle(color: Colors.white, fontSize: 15),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
