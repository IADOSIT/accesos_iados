import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_colors_scheme.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/providers/auth_provider.dart';

final guiaAmarillaProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final auth = ref.watch(authProvider);
  if (auth.tenantId == null) return [];
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/guia-amarilla', params: {'active': 'true'});
  return res.data['data'] as List? ?? [];
});

class GuiaAmarillaScreen extends ConsumerStatefulWidget {
  const GuiaAmarillaScreen({super.key});

  @override
  ConsumerState<GuiaAmarillaScreen> createState() => _GuiaAmarillaScreenState();
}

class _GuiaAmarillaScreenState extends ConsumerState<GuiaAmarillaScreen> {
  String _search = '';
  String? _selectedCategory;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final entries = ref.watch(guiaAmarillaProvider);

    return Scaffold(
      backgroundColor: c.bgMain,
      appBar: AppBar(
        backgroundColor: c.bgSurface,
        title: Text('Guía de Servicios',
            style: TextStyle(color: c.textPrimary, fontWeight: FontWeight.w700)),
        iconTheme: IconThemeData(color: c.textPrimary),
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(56),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: TextField(
              onChanged: (v) => setState(() => _search = v.toLowerCase()),
              style: TextStyle(color: c.textPrimary),
              decoration: InputDecoration(
                hintText: 'Buscar servicio...',
                hintStyle: TextStyle(color: c.textMuted),
                prefixIcon: Icon(Icons.search_rounded, color: c.textMuted),
                filled: true,
                fillColor: c.bgCard,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ),
      ),
      body: entries.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (data) {
          // Categorías únicas para el filtro
          final categories = data
              .map((e) => e['category'] as String? ?? '')
              .toSet()
              .where((c) => c.isNotEmpty)
              .toList()
            ..sort();

          var filtered = data.where((e) {
            final name = (e['name'] as String? ?? '').toLowerCase();
            final cat  = (e['category'] as String? ?? '').toLowerCase();
            final desc = (e['description'] as String? ?? '').toLowerCase();
            final matchSearch = _search.isEmpty ||
                name.contains(_search) ||
                cat.contains(_search) ||
                desc.contains(_search);
            final matchCat = _selectedCategory == null ||
                (e['category'] as String?) == _selectedCategory;
            return matchSearch && matchCat;
          }).toList();

          return Column(
            children: [
              // Chips de categoría
              if (categories.isNotEmpty)
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                  child: Row(
                    children: [
                      _CategoryChip(
                        label: 'Todos',
                        selected: _selectedCategory == null,
                        onTap: () => setState(() => _selectedCategory = null),
                      ),
                      ...categories.map((cat) => _CategoryChip(
                            label: cat,
                            selected: _selectedCategory == cat,
                            onTap: () => setState(() =>
                                _selectedCategory = _selectedCategory == cat ? null : cat),
                          )),
                    ],
                  ),
                ),
              // Lista de entradas
              Expanded(
                child: filtered.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.search_off_rounded, size: 48, color: c.textMuted),
                            const SizedBox(height: 12),
                            Text('Sin resultados',
                                style: TextStyle(color: c.textMuted, fontSize: 15)),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: filtered.length,
                        itemBuilder: (_, i) => _EntryCard(entry: filtered[i]),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _CategoryChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? c.primary : c.bgCard,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? c.primary : c.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : c.textSecondary,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _EntryCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  const _EntryCard({required this.entry});

  @override
  Widget build(BuildContext context) {
    final c     = context.colors;
    final emoji = entry['emoji'] as String? ?? '📞';
    final name  = entry['name'] as String? ?? '';
    final cat   = entry['category'] as String? ?? '';
    final phone = entry['phone'] as String? ?? '';
    final desc  = entry['description'] as String? ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: c.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Emoji / ícono
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: c.primary.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: Text(emoji, style: const TextStyle(fontSize: 24)),
            ),
            const SizedBox(width: 12),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name,
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: c.textPrimary)),
                  const SizedBox(height: 2),
                  Text(cat,
                      style: TextStyle(fontSize: 12, color: c.primary, fontWeight: FontWeight.w600)),
                  if (desc.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(desc,
                        style: TextStyle(fontSize: 13, color: c.textSecondary),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(Icons.phone_rounded, size: 14, color: c.textMuted),
                      const SizedBox(width: 4),
                      Text(phone,
                          style: TextStyle(fontSize: 13, color: c.textSecondary)),
                    ],
                  ),
                ],
              ),
            ),
            // Botón llamar
            GestureDetector(
              onTap: () => _call(context, phone),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: c.primary,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.phone_rounded, color: Colors.white, size: 20),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _call(BuildContext context, String phone) async {
    if (phone.isEmpty) return;
    final clean = phone.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri.parse('tel:$clean');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo abrir el marcador')),
      );
    }
  }
}
