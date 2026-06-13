import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/network/api_client.dart';
import '../../core/constants/app_colors_scheme.dart';

class AppVersionInfo {
  final String version;
  final int buildNumber;
  final String downloadUrl;
  final String releaseNotes;
  final bool mandatory;
  final bool hasUpdate;

  const AppVersionInfo({
    required this.version,
    required this.buildNumber,
    required this.downloadUrl,
    this.releaseNotes = '',
    this.mandatory = false,
    this.hasUpdate = false,
  });
}

final appVersionProvider = FutureProvider.autoDispose<AppVersionInfo>((ref) async {
  try {
    final api     = ref.watch(apiClientProvider);
    final pkgInfo = await PackageInfo.fromPlatform();

    final res  = await api.get('/app-version');
    final data = res.data['data'] as Map<String, dynamic>;

    final remoteVersion = data['version'] as String? ?? '0.0.0';
    final remoteBuild   = (data['buildNumber'] as num?)?.toInt() ?? 0;
    final localBuild    = int.tryParse(pkgInfo.buildNumber) ?? 0;

    final hasUpdate = remoteBuild > localBuild;

    return AppVersionInfo(
      version:      remoteVersion,
      buildNumber:  remoteBuild,
      downloadUrl:  data['downloadUrl'] as String? ?? '',
      releaseNotes: data['releaseNotes'] as String? ?? '',
      mandatory:    data['mandatory'] as bool? ?? false,
      hasUpdate:    hasUpdate,
    );
  } catch (_) {
    return const AppVersionInfo(version: '', buildNumber: 0, downloadUrl: '');
  }
});

class UpdateBanner extends ConsumerStatefulWidget {
  const UpdateBanner({super.key});

  @override
  ConsumerState<UpdateBanner> createState() => _UpdateBannerState();
}

class _UpdateBannerState extends ConsumerState<UpdateBanner> {
  bool _dialogShown = false;

  @override
  Widget build(BuildContext context) {
    final versionAsync = ref.watch(appVersionProvider);

    return versionAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (info) {
        if (!info.hasUpdate) return const SizedBox.shrink();

        // Mandatory: bloquear con diálogo persistente
        if (info.mandatory && !_dialogShown) {
          _dialogShown = true;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _showMandatoryDialog(context, info);
          });
        }

        final c = context.colors;
        return GestureDetector(
          onTap: () => _showInstallDialog(context, info),
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [c.primary, c.primaryDark],
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.system_update_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Actualización disponible',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        'Versión ${info.version} — Toca para descargar',
                        style: const TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.download_rounded, color: Colors.white),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showInstallDialog(BuildContext context, AppVersionInfo info) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Actualización disponible'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Versión ${info.version} lista para instalar.'),
            if (info.releaseNotes.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(info.releaseNotes, style: const TextStyle(fontSize: 13)),
            ],
            const SizedBox(height: 16),
            _PlayProtectHint(),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Después'),
          ),
          FilledButton.icon(
            onPressed: () {
              Navigator.pop(ctx);
              _openDownload(info.downloadUrl);
            },
            icon: const Icon(Icons.download_rounded),
            label: const Text('Descargar'),
          ),
        ],
      ),
    );
  }

  void _showMandatoryDialog(BuildContext context, AppVersionInfo info) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => PopScope(
        canPop: false,
        child: AlertDialog(
          title: const Text('Actualización requerida'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('La versión ${info.version} es obligatoria. Debes actualizar para continuar.'),
              if (info.releaseNotes.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(info.releaseNotes, style: const TextStyle(fontSize: 13)),
              ],
              const SizedBox(height: 16),
              _PlayProtectHint(),
            ],
          ),
          actions: [
            FilledButton.icon(
              onPressed: () => _openDownload(info.downloadUrl),
              icon: const Icon(Icons.download_rounded),
              label: const Text('Descargar e instalar'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openDownload(String url) async {
    if (url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

// ── Guía de Play Protect ────────────────────────────────────────────────────

class _PlayProtectHint extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.amber.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.amber.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(Icons.shield_outlined, color: Colors.amber.shade700, size: 16),
            const SizedBox(width: 6),
            Text(
              'Si Android bloquea la instalación:',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Colors.amber.shade800,
              ),
            ),
          ]),
          const SizedBox(height: 6),
          _Step('1', 'Toca "Más información" en la advertencia de Play Protect'),
          _Step('2', 'Toca "Instalar de todas formas"'),
          _Step('3', 'Confirma que confías en la fuente'),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  final String number;
  final String text;
  const _Step(this.number, this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 18,
            height: 18,
            margin: const EdgeInsets.only(top: 1, right: 6),
            decoration: BoxDecoration(
              color: Colors.amber.shade700,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(number,
                  style: const TextStyle(
                      fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
            ),
          ),
          Expanded(
            child: Text(text, style: TextStyle(fontSize: 12, color: Colors.amber.shade900)),
          ),
        ],
      ),
    );
  }
}
