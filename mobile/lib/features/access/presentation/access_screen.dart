import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
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

    return Scaffold(
      backgroundColor: AppColors.bgDark,
      appBar: AppBar(
        title: const Text('Bitácora de Accesos'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(accessLogsProvider),
          ),
        ],
      ),
      floatingActionButton: (auth.isAdmin || auth.isGuard)
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
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                          ),
                          const Text(' · ',
                              style: TextStyle(color: AppColors.textMuted)),
                          Text(
                            _methodLabel(method),
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
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
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
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
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
                  ],
                  if (notes != null) ...[
                    const SizedBox(width: 12),
                    const Icon(Icons.notes_rounded, size: 12, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text(notes,
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
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
            // Selector de dispositivo
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
            // Selector Entrada / Salida
            Row(
              children: [
                Expanded(child: _DirectionButton(
                  label: 'Entrada',
                  icon: Icons.login_rounded,
                  selected: _direction == 'ENTRY',
                  onTap: () => setState(() => _direction = 'ENTRY'),
                )),
                const SizedBox(width: 8),
                Expanded(child: _DirectionButton(
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
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
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
