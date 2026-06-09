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

class UpdateBanner extends ConsumerWidget {
  const UpdateBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final versionAsync = ref.watch(appVersionProvider);

    return versionAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (info) {
        if (!info.hasUpdate) return const SizedBox.shrink();

        final c = context.colors;
        return GestureDetector(
          onTap: () => _openDownload(info.downloadUrl),
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

  Future<void> _openDownload(String url) async {
    if (url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
