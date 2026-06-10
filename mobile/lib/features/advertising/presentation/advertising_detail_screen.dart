import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_colors_scheme.dart';

class AdvertisingDetailScreen extends StatelessWidget {
  final Map<String, dynamic> ad;
  const AdvertisingDetailScreen({super.key, required this.ad});

  @override
  Widget build(BuildContext context) {
    final c           = context.colors;
    final imageUrl     = ad['imageUrl']     as String? ?? '';
    final businessName = ad['businessName'] as String? ?? '';
    final phone        = ad['phone']        as String? ?? '';
    final whatsapp     = ad['whatsapp']     as String? ?? '';
    final address      = ad['address']      as String? ?? '';
    final website      = ad['website']      as String? ?? '';
    final description  = ad['description']  as String? ?? '';

    return Scaffold(
      backgroundColor: c.bgMain,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: imageUrl.isNotEmpty ? 260 : 0,
            pinned: true,
            backgroundColor: c.bgSurface,
            iconTheme: IconThemeData(color: c.textPrimary),
            flexibleSpace: imageUrl.isNotEmpty
                ? FlexibleSpaceBar(
                    background: CachedNetworkImage(
                      imageUrl: imageUrl,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(color: c.bgCard),
                      errorWidget: (_, __, ___) => Container(
                        color: c.bgCard,
                        child: Icon(Icons.image_not_supported_rounded,
                            size: 48, color: c.textMuted),
                      ),
                    ),
                  )
                : null,
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(businessName,
                      style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          color: c.textPrimary)),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(description,
                        style: TextStyle(
                            fontSize: 15, color: c.textSecondary, height: 1.5)),
                  ],
                  const SizedBox(height: 24),
                  // Acciones
                  if (phone.isNotEmpty)
                    _ActionTile(
                      icon: Icons.phone_rounded,
                      label: 'Llamar',
                      subtitle: phone,
                      color: Colors.green,
                      onTap: () => _launchUrl('tel:${phone.replaceAll(RegExp(r'[^\d+]'), '')}'),
                    ),
                  if (whatsapp.isNotEmpty || phone.isNotEmpty)
                    _ActionTile(
                      svgAsset: 'assets/icons/whatsapp.svg',
                      label: 'WhatsApp',
                      subtitle: whatsapp.isNotEmpty ? whatsapp : phone,
                      color: const Color(0xFF25D366),
                      onTap: () {
                        String clean = (whatsapp.isNotEmpty ? whatsapp : phone).replaceAll(RegExp(r'[^\d]'), '');
                        if (clean.length == 10) clean = '52$clean';
                        _launchUrl('https://wa.me/$clean');
                      },
                    ),
                  if (address.isNotEmpty)
                    _ActionTile(
                      icon: Icons.location_on_rounded,
                      label: 'Cómo llegar',
                      subtitle: address,
                      color: Colors.blue,
                      onTap: () => _launchUrl(
                        'https://maps.google.com/?q=${Uri.encodeComponent(address)}',
                      ),
                    ),
                  if (website.isNotEmpty)
                    _ActionTile(
                      icon: Icons.language_rounded,
                      label: 'Sitio web',
                      subtitle: website,
                      color: c.primary,
                      onTap: () {
                        final url = website.startsWith('http') ? website : 'https://$website';
                        _launchUrl(url);
                      },
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

class _ActionTile extends StatelessWidget {
  final IconData? icon;
  final String? svgAsset;
  final String label;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ActionTile({
    this.icon,
    this.svgAsset,
    required this.label,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: c.bgCard,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: c.border),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: svgAsset != null
                  ? SvgPicture.asset(svgAsset!, colorFilter: ColorFilter.mode(color, BlendMode.srcIn), width: 20, height: 20)
                  : Icon(icon!, color: color, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: c.textPrimary)),
                  Text(subtitle,
                      style: TextStyle(fontSize: 13, color: c.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: c.textMuted),
          ],
        ),
      ),
    );
  }
}
