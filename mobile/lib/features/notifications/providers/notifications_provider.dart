import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

class NotificationItem {
  final String id;
  final String type;
  final String title;
  final String body;
  final DateTime? readAt;
  final DateTime createdAt;

  const NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.readAt,
    required this.createdAt,
  });

  bool get isUnread => readAt == null;

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      readAt: json['readAt'] != null ? DateTime.parse(json['readAt'] as String) : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

final notificationsProvider = FutureProvider.autoDispose<List<NotificationItem>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/notifications');
  final list = res.data['data'] as List;
  return list.map((n) => NotificationItem.fromJson(n as Map<String, dynamic>)).toList();
});

final unreadCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final api = ref.watch(apiClientProvider);
  final res = await api.get('/notifications/unread-count');
  return res.data['data']['count'] as int;
});
