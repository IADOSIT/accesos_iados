import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/network/api_client.dart';

class ServiceRequestDialog extends ConsumerStatefulWidget {
  final Map<String, dynamic> data;
  const ServiceRequestDialog({super.key, required this.data});

  @override
  ConsumerState<ServiceRequestDialog> createState() => _ServiceRequestDialogState();
}

class _ServiceRequestDialogState extends ConsumerState<ServiceRequestDialog> {
  bool _loading = false;
  bool _done = false;
  bool _approved = false;
  String? _photoBase64;
  bool _loadingPhoto = false;
  String _statusMsg = '';

  @override
  void initState() {
    super.initState();
    _loadPhoto();
  }

  Future<void> _loadPhoto() async {
    final requestId = widget.data['requestId'] as String? ?? '';
    if (requestId.isEmpty) return;
    setState(() => _loadingPhoto = true);
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get('/service-qr/requests/$requestId');
      final photo = res.data?['data']?['photoData'] as String?;
      if (mounted && photo != null && photo.isNotEmpty) {
        setState(() => _photoBase64 = photo);
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingPhoto = false);
  }

  Future<void> _approve() async {
    final requestId = widget.data['requestId'] as String? ?? '';
    if (requestId.isEmpty) return;
    setState(() { _loading = true; _statusMsg = ''; });
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/service-qr/requests/$requestId/approve', data: {});
      if (mounted) setState(() { _done = true; _approved = true; _statusMsg = 'Acceso aprobado — dispositivo activado'; });
    } catch (e) {
      if (mounted) setState(() { _statusMsg = 'Error: ${e.toString()}'; _loading = false; });
    }
  }

  Future<void> _reject() async {
    final requestId = widget.data['requestId'] as String? ?? '';
    if (requestId.isEmpty) return;
    setState(() { _loading = true; _statusMsg = ''; });
    try {
      final api = ref.read(apiClientProvider);
      await api.patch('/service-qr/requests/$requestId/reject', data: {});
      if (mounted) setState(() { _done = true; _approved = false; _statusMsg = 'Solicitud rechazada'; });
    } catch (e) {
      if (mounted) setState(() { _statusMsg = 'Error: ${e.toString()}'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final service      = widget.data['service']      as String? ?? 'Servicio externo';
    final unitLabel    = widget.data['unitLabel']    as String? ?? '';
    final visitorPhone = widget.data['visitorPhone'] as String? ?? '';
    final hasPhoto     = (widget.data['hasPhoto'] as String?) == 'true';

    const icons = {
      'CFE': '⚡', 'Gas': '🔥', 'Agua': '💧', 'Basura': '🗑️',
      'Paquetería': '📦', 'Mensajería': '📬', 'Domicilio': '🛵',
      'Técnico': '🔧', 'Jardinería': '🌿', 'Limpieza': '🧹',
    };
    final icon = icons[service] ?? '🔔';

    return Scaffold(
      backgroundColor: const Color(0xFF1E3A5F),
      body: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: 8, right: 12,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white70, size: 26),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 60, 20, 24),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 20, offset: Offset(0, 8))],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                        child: Row(
                          children: [
                            const Icon(Icons.doorbell_rounded, color: Color(0xFF1E3A5F), size: 22),
                            const SizedBox(width: 8),
                            const Text('Solicitud de Servicio',
                                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.black87)),
                            const Spacer(),
                            Text(DateFormat('h:mm a').format(DateTime.now()),
                                style: const TextStyle(fontSize: 12, color: Colors.grey)),
                          ],
                        ),
                      ),
                      const Divider(height: 20),

                      Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Column(
                            children: [
                              Text(icon, style: const TextStyle(fontSize: 52)),
                              const SizedBox(height: 4),
                              Text(service,
                                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.black87)),
                            ],
                          ),
                        ),
                      ),

                      if (unitLabel.isNotEmpty)
                        ServiceRow(icon: Icons.home_rounded, label: unitLabel),
                      if (visitorPhone.isNotEmpty)
                        ServiceRow(icon: Icons.phone_rounded, label: visitorPhone, copyable: true),

                      if (hasPhoto) ...[
                        const SizedBox(height: 8),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: _loadingPhoto
                              ? const Center(child: Padding(
                                  padding: EdgeInsets.all(12),
                                  child: CircularProgressIndicator(strokeWidth: 2)))
                              : _photoBase64 != null
                                  ? Builder(builder: (ctx) {
                                      try {
                                        final raw = _photoBase64!.contains(',')
                                            ? _photoBase64!.split(',').last
                                            : _photoBase64!;
                                        final bytes = base64Decode(raw);
                                        return ClipRRect(
                                          borderRadius: BorderRadius.circular(10),
                                          child: Image.memory(bytes, height: 180, width: double.infinity, fit: BoxFit.cover),
                                        );
                                      } catch (_) {
                                        return const Icon(Icons.image_not_supported_rounded, color: Colors.grey);
                                      }
                                    })
                                  : const SizedBox.shrink(),
                        ),
                      ],

                      const SizedBox(height: 16),

                      if (_statusMsg.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: _approved ? Colors.green.shade50 : Colors.red.shade50,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              _statusMsg,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: _approved ? Colors.green.shade700 : Colors.red.shade700,
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),

                      const SizedBox(height: 12),

                      if (!_done) ...[
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          child: Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: _loading ? null : _reject,
                                  icon: const Icon(Icons.block_rounded, size: 18),
                                  label: const Text('Rechazar'),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: Colors.red.shade600,
                                    side: BorderSide(color: Colors.red.shade300),
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: _loading ? null : _approve,
                                  icon: _loading
                                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                      : const Icon(Icons.check_circle_rounded, size: 18),
                                  label: const Text('Aprobar'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF059669),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ] else ...[
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          child: SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: () => Navigator.of(context).pop(),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.grey.shade200,
                                foregroundColor: Colors.black87,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              child: const Text('Cerrar'),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ServiceRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool copyable;
  const ServiceRow({super.key, required this.icon, required this.label, this.copyable = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey.shade600),
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 14, color: Colors.black87))),
          if (copyable)
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: label));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Copiado'), duration: Duration(seconds: 2)),
                );
              },
              child: const Icon(Icons.copy_rounded, size: 15, color: Colors.grey),
            ),
        ],
      ),
    );
  }
}
