import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_client.dart';
import 'auth_provider.dart';

// ── Emergency Contact Model ─────────────────────────────────────────────────

class EmergencyContact {
  final String instance;
  final String number;

  const EmergencyContact({required this.instance, required this.number});

  factory EmergencyContact.fromJson(Map<String, dynamic> j) => EmergencyContact(
    instance: j['instance'] as String? ?? '',
    number:   j['number']   as String? ?? '',
  );
}

// ── Payment Config Models ───────────────────────────────────────────────────

class BankAccount {
  final String bankName;
  final String accountHolder;
  final String? clabe;
  final String? accountNumber;
  final String? referenceTemplate;

  const BankAccount({
    required this.bankName,
    required this.accountHolder,
    this.clabe,
    this.accountNumber,
    this.referenceTemplate,
  });

  factory BankAccount.fromJson(Map<String, dynamic> j) => BankAccount(
    bankName: j['bankName'] as String? ?? '',
    accountHolder: j['accountHolder'] as String? ?? '',
    clabe: j['clabe'] as String?,
    accountNumber: j['accountNumber'] as String?,
    referenceTemplate: j['referenceTemplate'] as String?,
  );
}

class AdditionalCharge {
  final String name;
  final double amount;
  final String? dueDate;
  final String? description;

  const AdditionalCharge({
    required this.name,
    required this.amount,
    this.dueDate,
    this.description,
  });

  factory AdditionalCharge.fromJson(Map<String, dynamic> j) => AdditionalCharge(
    name: j['name'] as String? ?? '',
    amount: (j['amount'] as num?)?.toDouble() ?? 0,
    dueDate: j['dueDate'] as String?,
    description: j['description'] as String?,
  );
}

class PaymentConfig {
  final double monthlyAmount;
  final String currency;
  final String paymentConcept;
  final int dueDayOfMonth;
  final int gracePeriodDays;
  final List<BankAccount> bankAccounts;
  final List<AdditionalCharge> additionalCharges;

  const PaymentConfig({
    this.monthlyAmount = 0,
    this.currency = 'MXN',
    this.paymentConcept = 'Cuota de mantenimiento',
    this.dueDayOfMonth = 5,
    this.gracePeriodDays = 5,
    this.bankAccounts = const [],
    this.additionalCharges = const [],
  });

  factory PaymentConfig.fromJson(Map<String, dynamic> j) {
    final accounts = (j['bankAccounts'] as List?)
        ?.map((e) => BankAccount.fromJson(e as Map<String, dynamic>))
        .toList() ?? [];
    final charges = (j['additionalCharges'] as List?)
        ?.map((e) => AdditionalCharge.fromJson(e as Map<String, dynamic>))
        .toList() ?? [];
    return PaymentConfig(
      monthlyAmount: (j['monthlyAmount'] as num?)?.toDouble() ?? 0,
      currency: j['currency'] as String? ?? 'MXN',
      paymentConcept: j['paymentConcept'] as String? ?? 'Cuota de mantenimiento',
      dueDayOfMonth: (j['dueDayOfMonth'] as num?)?.toInt() ?? 5,
      gracePeriodDays: (j['gracePeriodDays'] as num?)?.toInt() ?? 5,
      bankAccounts: accounts,
      additionalCharges: charges,
    );
  }

  bool get hasInfo => bankAccounts.isNotEmpty || monthlyAmount > 0;
}

// ── ServiceQR Config ────────────────────────────────────────────────────────

class ServiceQrConfig {
  final bool enabled;
  final String? deviceId;
  final List<String> services;
  final bool guardCanApprove;
  final bool adminCanApprove;
  final bool showResidentPhone;
  final int requestTtlMinutes;
  final int rotateDays;

  const ServiceQrConfig({
    this.enabled = false,
    this.deviceId,
    this.services = const [],
    this.guardCanApprove = true,
    this.adminCanApprove = true,
    this.showResidentPhone = false,
    this.requestTtlMinutes = 15,
    this.rotateDays = 7,
  });

  factory ServiceQrConfig.fromJson(Map<String, dynamic> j) => ServiceQrConfig(
    enabled:           j['enabled']           as bool? ?? false,
    deviceId:          j['deviceId']          as String?,
    services:          (j['services'] as List?)?.map((e) => e.toString()).toList() ?? [],
    guardCanApprove:   j['guardCanApprove']   as bool? ?? true,
    adminCanApprove:   j['adminCanApprove']   as bool? ?? true,
    showResidentPhone: j['showResidentPhone'] as bool? ?? false,
    requestTtlMinutes: (j['requestTtlMinutes'] as num?)?.toInt() ?? 15,
    rotateDays:        (j['rotateDays']        as num?)?.toInt() ?? 7,
  );
}

// ── Modelo ─────────────────────────────────────────────────────────────────

class TenantConfig {
  final bool showResidentAccessButton;
  final bool showVisitorAccessButton;
  final bool showExitButton;
  final bool quickQrEnabled;
  final int quickQrDurationHours;
  final int quickQrMaxUses;
  final String uiTheme; // "DARK" | "LIGHT"
  final String? residentEntryDeviceId;
  final String? residentExitDeviceId;
  final String? visitorEntryDeviceId;
  final String? visitorExitDeviceId;
  final PaymentConfig paymentConfig;
  final List<EmergencyContact> emergencyContacts;
  final ServiceQrConfig serviceQrConfig;

  const TenantConfig({
    this.showResidentAccessButton = false,
    this.showVisitorAccessButton = false,
    this.showExitButton = false,
    this.quickQrEnabled = false,
    this.quickQrDurationHours = 2,
    this.quickQrMaxUses = 3,
    this.uiTheme = 'DARK',
    this.residentEntryDeviceId,
    this.residentExitDeviceId,
    this.visitorEntryDeviceId,
    this.visitorExitDeviceId,
    this.paymentConfig = const PaymentConfig(),
    this.emergencyContacts = const [],
    this.serviceQrConfig = const ServiceQrConfig(),
  });

  factory TenantConfig.fromJson(Map<String, dynamic> settings) {
    final flags = (settings['featureFlags'] is Map)
        ? settings['featureFlags'] as Map<String, dynamic>
        : <String, dynamic>{};

    String? ne(dynamic v) { final s = v as String?; return (s != null && s.isNotEmpty) ? s : null; }

    final pc = (settings['paymentConfig'] is Map)
        ? PaymentConfig.fromJson(settings['paymentConfig'] as Map<String, dynamic>)
        : const PaymentConfig();

    final emergencyContacts = (settings['emergencyNumbers'] is List)
        ? (settings['emergencyNumbers'] as List)
            .whereType<Map>()
            .map((e) => EmergencyContact.fromJson(Map<String, dynamic>.from(e)))
            .toList()
        : <EmergencyContact>[];

    final svcQr = (settings['serviceQrConfig'] is Map)
        ? ServiceQrConfig.fromJson(settings['serviceQrConfig'] as Map<String, dynamic>)
        : const ServiceQrConfig();

    return TenantConfig(
      showResidentAccessButton: flags['showResidentAccessButton'] as bool? ?? false,
      showVisitorAccessButton:  flags['showVisitorAccessButton']  as bool? ?? false,
      showExitButton:           flags['showExitButton']           as bool? ?? false,
      quickQrEnabled:           flags['quickQrEnabled']           as bool? ?? false,
      quickQrDurationHours:     (flags['quickQrDurationHours']    as num?)?.toInt() ?? 2,
      quickQrMaxUses:           (flags['quickQrMaxUses']          as num?)?.toInt() ?? 3,
      uiTheme:                  settings['uiTheme']               as String? ?? 'DARK',
      residentEntryDeviceId:    ne(flags['residentEntryDeviceId']),
      residentExitDeviceId:     ne(flags['residentExitDeviceId']),
      visitorEntryDeviceId:     ne(flags['visitorEntryDeviceId']),
      visitorExitDeviceId:      ne(flags['visitorExitDeviceId']),
      paymentConfig:            pc,
      emergencyContacts:        emergencyContacts,
      serviceQrConfig:          svcQr,
    );
  }

  bool get isLight => uiTheme == 'LIGHT';
}

// ── Provider ───────────────────────────────────────────────────────────────

final tenantConfigProvider = FutureProvider.autoDispose<TenantConfig>((ref) async {
  final auth = ref.watch(authProvider);
  if (!auth.isAuthenticated || auth.tenantId == null) {
    return const TenantConfig();
  }
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get('/config/tenant');
    final data = res.data['data'];
    final settings = (data['settings'] is Map)
        ? data['settings'] as Map<String, dynamic>
        : <String, dynamic>{};
    return TenantConfig.fromJson(settings);
  } catch (_) {
    return const TenantConfig();
  }
});
