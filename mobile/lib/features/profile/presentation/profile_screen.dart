import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors_scheme.dart';
import '../../../core/network/api_client.dart';
import '../../../shared/providers/auth_provider.dart';

// ── Provider ──────────────────────────────────────────────────────────────

final profileProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/auth/me');
  return res.data['data'] as Map<String, dynamic>? ?? {};
});

// ── Screen ─────────────────────────────────────────────────────────────────

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final profileAsync = ref.watch(profileProvider);
    final cs = Theme.of(context).colorScheme;
    final bg = cs.surface;
    final surface = Theme.of(context).scaffoldBackgroundColor;

    return Scaffold(
      backgroundColor: surface,
      appBar: AppBar(
        backgroundColor: surface,
        title: const Text('Mi perfil'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e', style: TextStyle(color: context.colors.error))),
        data: (profile) => _ProfileBody(profile: profile, auth: auth, ref: ref),
      ),
    );
  }
}

class _ProfileBody extends ConsumerStatefulWidget {
  final Map<String, dynamic> profile;
  final AuthState auth;
  final WidgetRef ref;

  const _ProfileBody({required this.profile, required this.auth, required this.ref});

  @override
  ConsumerState<_ProfileBody> createState() => _ProfileBodyState();
}

class _ProfileBodyState extends ConsumerState<_ProfileBody> {
  bool _showChangePw = false;
  final _pwForm = <String, String>{'current': '', 'new': '', 'confirm': ''};
  String _pwMsg = '';
  bool _pwLoading = false;

  Color _roleColor(BuildContext context) {
    final c = context.colors;
    switch (widget.auth.role) {
      case 'ADMIN': return c.primary;
      case 'GUARD': return c.info;
      default: return c.textMuted;
    }
  }

  String get _roleLabel {
    switch (widget.auth.role) {
      case 'ADMIN': return 'Administrador';
      case 'GUARD': return 'Guardia';
      default: return 'Residente';
    }
  }

  Future<void> _changePassword() async {
    if (_pwForm['new'] != _pwForm['confirm']) {
      setState(() => _pwMsg = 'Las contraseñas no coinciden');
      return;
    }
    setState(() { _pwLoading = true; _pwMsg = ''; });
    try {
      final api = ref.read(apiClientProvider);
      await api.put('/auth/change-password', data: {
        'currentPassword': _pwForm['current'],
        'newPassword': _pwForm['new'],
      });
      setState(() {
        _pwMsg = '✓ Contraseña actualizada';
        _pwForm['current'] = '';
        _pwForm['new'] = '';
        _pwForm['confirm'] = '';
        _showChangePw = false;
      });
    } catch (e) {
      setState(() => _pwMsg = 'Error: contraseña actual incorrecta');
    } finally {
      setState(() => _pwLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final profile = widget.profile;
    final firstName = profile['firstName'] as String? ?? '';
    final lastName  = profile['lastName']  as String? ?? '';
    final email     = profile['email']     as String? ?? '';
    final phone     = profile['phone']     as String? ?? '';
    final initials  = '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}'.toUpperCase();

    final tenants = profile['tenants'] as List? ?? [];
    final myTenant = tenants.isNotEmpty ? tenants.first : null;
    final unit = myTenant?['unit'];

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar + nombre
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: _roleColor(context).withOpacity(0.15),
                  child: Text(
                    initials,
                    style: TextStyle(
                      color: _roleColor(context),
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  '$firstName $lastName',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: c.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    color: _roleColor(context).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _roleLabel,
                    style: TextStyle(
                      color: _roleColor(context),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 28),

          // Info card
          _InfoCard(children: [
            _InfoRow(label: 'Email',    value: email),
            if (phone.isNotEmpty) _InfoRow(label: 'Teléfono', value: phone),
            if (unit != null) _InfoRow(label: 'Unidad', value: unit['identifier'] as String? ?? ''),
            if (myTenant != null) _InfoRow(label: 'Fraccionamiento', value: myTenant['tenantName'] as String? ?? ''),
          ]),

          const SizedBox(height: 20),

          // Cambiar contraseña
          _Section(
            title: 'Contraseña',
            child: Column(
              children: [
                if (_pwMsg.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      _pwMsg,
                      style: TextStyle(
                        color: _pwMsg.startsWith('✓') ? context.colors.success : context.colors.error,
                        fontSize: 13,
                      ),
                    ),
                  ),
                if (!_showChangePw)
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => setState(() { _showChangePw = true; _pwMsg = ''; }),
                      icon: const Icon(Icons.lock_outline_rounded, size: 18),
                      label: const Text('Cambiar contraseña'),
                    ),
                  )
                else ...[
                  _PwField(
                    label: 'Contraseña actual',
                    onChanged: (v) => _pwForm['current'] = v,
                  ),
                  const SizedBox(height: 12),
                  _PwField(
                    label: 'Nueva contraseña',
                    onChanged: (v) => _pwForm['new'] = v,
                  ),
                  const SizedBox(height: 12),
                  _PwField(
                    label: 'Confirmar contraseña',
                    onChanged: (v) => _pwForm['confirm'] = v,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => setState(() { _showChangePw = false; _pwMsg = ''; }),
                          child: const Text('Cancelar'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _pwLoading ? null : _changePassword,
                          child: _pwLoading
                              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Text('Guardar'),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Cerrar sesión
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  useRootNavigator: true,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Cerrar sesión'),
                    content: const Text('¿Estás seguro que deseas salir?'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: Text('Salir', style: TextStyle(color: context.colors.error)),
                      ),
                    ],
                  ),
                );
                if (confirm == true && mounted) {
                  await ref.read(authProvider.notifier).logout();
                }
              },
              icon: Icon(Icons.logout_rounded, color: c.error, size: 18),
              label: Text('Cerrar sesión', style: TextStyle(color: c.error)),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: c.error.withOpacity(0.4)),
              ),
            ),
          ),

          const SizedBox(height: 40),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final isLight = Theme.of(context).brightness == Brightness.light;
    return Container(
      decoration: BoxDecoration(
        color: c.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: c.border),
        boxShadow: isLight
            ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 3))]
            : null,
      ),
      child: Column(
        children: children.asMap().entries.map((e) {
          return Column(
            children: [
              e.value,
              if (e.key < children.length - 1)
                Divider(height: 1, color: c.border),
            ],
          );
        }).toList(),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: c.textMuted)),
          const Spacer(),
          Text(value, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: c.textPrimary)),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final Widget child;
  const _Section({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textMuted, letterSpacing: 0.5)),
        const SizedBox(height: 10),
        child,
      ],
    );
  }
}

class _PwField extends StatefulWidget {
  final String label;
  final ValueChanged<String> onChanged;
  const _PwField({required this.label, required this.onChanged});

  @override
  State<_PwField> createState() => _PwFieldState();
}

class _PwFieldState extends State<_PwField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return TextField(
      obscureText: _obscure,
      onChanged: widget.onChanged,
      decoration: InputDecoration(
        labelText: widget.label,
        suffixIcon: IconButton(
          icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18),
          onPressed: () => setState(() => _obscure = !_obscure),
        ),
      ),
    );
  }
}
