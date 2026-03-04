import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../providers/tenant_config_provider.dart';

class PanicAlertFullScreen extends StatelessWidget {
  final Map<String, dynamic> data;
  final List<EmergencyContact> emergencyContacts;

  const PanicAlertFullScreen({super.key, required this.data, required this.emergencyContacts});

  @override
  Widget build(BuildContext context) {
    final now    = DateFormat('d-MMM-yy  h:mm a').format(DateTime.now());
    final name   = data['userName']       as String? ?? 'N/A';
    final unit   = data['unitLabel']      as String? ?? '';
    final phone  = data['phone']          as String? ?? '';
    final block  = data['block']          as String? ?? '';
    final unitId = data['unitIdentifier'] as String? ?? '';

    final address = [
      if (block.isNotEmpty) 'Manzana $block',
      if (unitId.isNotEmpty) 'Unidad $unitId',
    ].join(', ');

    return Scaffold(
      backgroundColor: Colors.red.shade700,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: 8, right: 12,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white, size: 26),
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
                            const Icon(Icons.notifications_active_rounded, color: Colors.red, size: 22),
                            const SizedBox(width: 8),
                            const Text('Emergencia',
                                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.black87)),
                            const Spacer(),
                            Text(now, style: const TextStyle(fontSize: 12, color: Colors.red)),
                          ],
                        ),
                      ),
                      const Divider(height: 20),

                      Center(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          child: Icon(Icons.crisis_alert_rounded, color: Colors.red.shade600, size: 80),
                        ),
                      ),

                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16),
                        child: Text(
                          'Alerta de emergencia activada',
                          style: TextStyle(fontSize: 15, color: Colors.black87, height: 1.4),
                        ),
                      ),
                      const SizedBox(height: 14),

                      PanicRow(label: 'Nombre',    value: name.isNotEmpty ? name : 'N/A'),
                      PanicRow(label: 'Familia',   value: unit.isNotEmpty ? unit : 'N/A'),
                      PanicRow(label: 'Teléfono',  value: phone.isNotEmpty ? phone : 'N/A', copyable: true),
                      PanicRow(label: 'Dirección', value: address.isNotEmpty ? address : 'N/A'),

                      const SizedBox(height: 12),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 16),
                        child: Text(
                          'Contacta al residente para confirmar la situación y de ser necesario llama a las autoridades.',
                          style: TextStyle(fontSize: 13, color: Colors.black54, height: 1.5),
                        ),
                      ),

                      if (emergencyContacts.isNotEmpty) ...[
                        const Divider(height: 28),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 16),
                          child: Text('Números de emergencia',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.black54)),
                        ),
                        const SizedBox(height: 6),
                        ...emergencyContacts.map((ec) =>
                            PanicRow(label: ec.instance, value: ec.number, copyable: true)),
                      ],

                      const SizedBox(height: 16),
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

class PanicRow extends StatelessWidget {
  final String label;
  final String value;
  final bool copyable;
  const PanicRow({super.key, required this.label, required this.value, this.copyable = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text('$label:', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Colors.black87)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 13, color: Colors.black87)),
          ),
          if (copyable && value != 'N/A')
            GestureDetector(
              onTap: () {
                Clipboard.setData(ClipboardData(text: value));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('$label copiado'), duration: const Duration(seconds: 2)),
                );
              },
              child: const Icon(Icons.copy_rounded, size: 15, color: Colors.grey),
            ),
        ],
      ),
    );
  }
}
