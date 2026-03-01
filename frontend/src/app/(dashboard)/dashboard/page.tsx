'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { reportsApi, devicesApi, accessApi, paymentsApi, unitsApi } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import {
  BuildingOfficeIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  ArrowsRightLeftIcon,
  CreditCardIcon,
  CpuChipIcon,
  LockOpenIcon,
  DocumentArrowUpIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface DashboardData {
  totalUnits: number;
  activeUsers: number;
  delinquentUnits: number;
  todayAccesses: number;
  monthPayments: { count: number; total: number };
  onlineDevices: number;
  monthPaidUnits: number;
}

interface Device {
  id: string;
  name: string;
  status: string;
  location?: string;
}

interface GateMessage {
  deviceId: string;
  text: string;
  ok: boolean;
}

interface CsvRow {
  unitId: string;
  identifier: string;
  amount: number;
  paid: boolean;
}

interface BulkResult {
  total: number;
  paid: number;
  pending: number;
  amount: number;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [opening, setOpening] = useState<string | null>(null);
  const [message, setMessage] = useState<GateMessage | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // CSV modal state
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvUnits, setCsvUnits] = useState<any[]>([]);
  const [csvMonth, setCsvMonth] = useState(new Date().getMonth() + 1);
  const [csvYear, setCsvYear] = useState(new Date().getFullYear());
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvResult, setCsvResult] = useState<BulkResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { role, user } = useAuthStore();
  const canOpen = role === 'ADMIN' || role === 'GUARD';
  const tenantName = user?.tenants?.[0]?.tenantName || 'Fraccionamiento';

  const loadData = useCallback(() => {
    reportsApi.dashboard()
      .then((res: any) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadDevices = useCallback(() => {
    if (!canOpen) return;
    devicesApi.list()
      .then((res: any) => {
        const list: Device[] = Array.isArray(res.data) ? res.data : (res.data || []);
        setDevices(list.filter((d) => d.status === 'ONLINE'));
      })
      .catch(console.error);
  }, [canOpen]);

  useEffect(() => {
    loadData();
    loadDevices();
  }, [loadData, loadDevices]);

  // Countdown del cooldown
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldowns((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const id in next) {
          if (next[id] > 0) { next[id]--; changed = true; }
          else delete next[id];
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = async (device: Device) => {
    if (opening || cooldowns[device.id]) return;
    setOpening(device.id);
    setMessage(null);
    try {
      const res: any = await accessApi.open({
        deviceId: device.id,
        method: 'APP',
        direction: 'ENTRY',
      });
      const granted = res.data?.granted ?? true;
      setMessage({
        deviceId: device.id,
        text: granted ? `✓ Acceso abierto — ${device.name}` : `✗ Acceso denegado — ${res.data?.reason || ''}`,
        ok: granted,
      });
      if (granted) setCooldowns((prev) => ({ ...prev, [device.id]: 30 }));
      loadData();
    } catch (err: any) {
      const is429 = err?.response?.status === 429 || err?.status === 429;
      setMessage({
        deviceId: device.id,
        text: is429 ? '⏱ Espera unos segundos antes de volver a abrir' : `Error: ${err?.message || 'No se pudo abrir'}`,
        ok: false,
      });
      if (is429) setCooldowns((prev) => ({ ...prev, [device.id]: 30 }));
    } finally {
      setOpening(null);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  // CSV: open modal and load units
  const openCsvModal = async () => {
    setCsvRows([]);
    setCsvFileName('');
    setCsvResult(null);
    setCsvLoading(false);
    setShowCsvModal(true);
    if (csvUnits.length === 0) {
      try {
        const res: any = await unitsApi.list('');
        setCsvUnits(res.data || []);
      } catch { /* ignore */ }
    }
  };

  // CSV: download template
  const downloadTemplate = () => {
    const rows = [['Fraccionamiento', 'Unidad', 'Monto', 'Pagado']];
    for (const u of csvUnits) {
      rows.push([tenantName, u.identifier, '0.00', 'N']);
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagos-${MONTHS[csvMonth - 1].toLowerCase()}-${csvYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV: parse uploaded file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setCsvResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const idxUnit = headers.findIndex(h => h.includes('unidad'));
      const idxMonto = headers.findIndex(h => h.includes('monto'));
      const idxPagado = headers.findIndex(h => h.includes('pagado'));
      if (idxUnit < 0 || idxMonto < 0 || idxPagado < 0) {
        alert('El CSV no tiene las columnas esperadas: Unidad, Monto, Pagado');
        return;
      }
      const unitMap: Record<string, string> = {};
      for (const u of csvUnits) unitMap[u.identifier.toLowerCase()] = u.id;

      const parsed: CsvRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const identifier = cols[idxUnit]?.trim() || '';
        const amount = parseFloat(cols[idxMonto]?.trim() || '0') || 0;
        const pagadoVal = (cols[idxPagado]?.trim() || 'N').toLowerCase();
        const paid = ['y', 'yes', 'si', 'sí', 's', '1', 'true'].includes(pagadoVal);
        const unitId = unitMap[identifier.toLowerCase()];
        if (!unitId) continue;
        parsed.push({ unitId, identifier, amount, paid });
      }
      setCsvRows(parsed);
    };
    reader.readAsText(file);
  };

  const handleBulkSubmit = async () => {
    if (csvRows.length === 0) return;
    setCsvLoading(true);
    try {
      const res: any = await paymentsApi.bulkPayments({
        month: csvMonth,
        year: csvYear,
        payments: csvRows,
      });
      setCsvResult(res.data);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar pagos');
    } finally {
      setCsvLoading(false);
    }
  };

  const paidPct = data && data.totalUnits > 0
    ? Math.round((data.monthPaidUnits / data.totalUnits) * 100)
    : 0;

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Resumen general del fraccionamiento" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="glass-card animate-pulse h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" subtitle="Resumen general del fraccionamiento" />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/unidades" className="block hover:scale-[1.02] transition-transform">
          <StatCard
            title="Unidades"
            value={data?.totalUnits || 0}
            subtitle="Total registradas"
            icon={BuildingOfficeIcon}
            color="blue"
          />
        </Link>
        <Link href="/usuarios" className="block hover:scale-[1.02] transition-transform">
          <StatCard
            title="Usuarios activos"
            value={data?.activeUsers || 0}
            subtitle="En el sistema"
            icon={UsersIcon}
            color="green"
          />
        </Link>
        <Link href="/morosos" className="block hover:scale-[1.02] transition-transform">
          <StatCard
            title="Morosos"
            value={data?.delinquentUnits || 0}
            subtitle="Unidades con adeudo"
            icon={ExclamationTriangleIcon}
            color="red"
          />
        </Link>
        <Link href="/bitacora" className="block hover:scale-[1.02] transition-transform">
          <StatCard
            title="Accesos hoy"
            value={data?.todayAccesses || 0}
            subtitle="Entradas y salidas"
            icon={ArrowsRightLeftIcon}
            color="purple"
          />
        </Link>
        <Link href="/pagos" className="block hover:scale-[1.02] transition-transform">
          <StatCard
            title="Pagos del mes"
            value={`$${(data?.monthPayments?.total || 0).toLocaleString()}`}
            subtitle={`${data?.monthPayments?.count || 0} pagos registrados`}
            icon={CreditCardIcon}
            color="green"
          />
        </Link>
        <Link href="/dispositivos" className="block hover:scale-[1.02] transition-transform">
          <StatCard
            title="Dispositivos en línea"
            value={data?.onlineDevices || 0}
            subtitle="Accesos conectados"
            icon={CpuChipIcon}
            color="blue"
          />
        </Link>
        <Link href="/pagos" className="block hover:scale-[1.02] transition-transform">
          <StatCard
            title="Cobertura de pagos"
            value={`${paidPct}%`}
            subtitle={`${data?.monthPaidUnits || 0} pagaron · ${(data?.totalUnits || 0) - (data?.monthPaidUnits || 0)} pendientes`}
            icon={CheckCircleIcon}
            color="amber"
          />
        </Link>
      </div>

      {/* Paneles de acción — solo ADMIN y GUARD */}
      {canOpen && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Control de acceso */}
          <div className="glass-card">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                <LockOpenIcon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">Control de acceso</h2>
                <p className="text-xs text-slate-500">Dispositivos en línea disponibles</p>
              </div>
              <button
                onClick={loadDevices}
                className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Actualizar
              </button>
            </div>

            {devices.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                No hay dispositivos en línea en este momento
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {devices.map((device) => {
                  const isOpening = opening === device.id;
                  const cooldown = cooldowns[device.id] || 0;
                  const disabled = !!opening || cooldown > 0;
                  const msg = message?.deviceId === device.id ? message : null;

                  return (
                    <div key={device.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{device.name}</p>
                        {device.location && (
                          <p className="text-xs text-slate-400">{device.location}</p>
                        )}
                      </div>

                      {msg && (
                        <p className={`text-xs font-medium ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                          {msg.text}
                        </p>
                      )}

                      <button
                        onClick={() => handleOpen(device)}
                        disabled={disabled}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all
                          ${disabled
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm hover:shadow-md'
                          }`}
                      >
                        {isOpening ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            Abriendo...
                          </>
                        ) : cooldown > 0 ? (
                          `Espera ${cooldown}s`
                        ) : (
                          <>
                            <LockOpenIcon className="w-4 h-4" />
                            Abrir acceso
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Registrar pagos CSV */}
          {role === 'ADMIN' && (
            <div className="glass-card flex flex-col">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                  <DocumentArrowUpIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800">Registrar pagos</h2>
                  <p className="text-xs text-slate-500">Carga masiva mediante archivo CSV</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center gap-4 py-4">
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-1">Descarga la plantilla, llénala y súbela</p>
                  <p className="text-xs text-slate-400">Columnas: Fraccionamiento, Unidad, Monto, Pagado</p>
                </div>
                <button
                  onClick={openCsvModal}
                  className="btn-primary flex items-center gap-2"
                >
                  <DocumentArrowUpIcon className="w-4 h-4" />
                  Cargar CSV de pagos
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal CSV */}
      <Modal isOpen={showCsvModal} onClose={() => setShowCsvModal(false)} title="Registrar pagos — CSV" size="lg">
        <div className="space-y-5">
          {/* Mes y año */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mes</label>
              <select className="input-field" value={csvMonth} onChange={(e) => setCsvMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Año</label>
              <select className="input-field" value={csvYear} onChange={(e) => setCsvYear(Number(e.target.value))}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Descargar plantilla */}
          <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-800">Plantilla CSV</p>
              <p className="text-xs text-blue-600">Incluye todas las unidades de {tenantName}</p>
            </div>
            <button
              onClick={downloadTemplate}
              disabled={csvUnits.length === 0}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Descargar
            </button>
          </div>

          {/* Subir CSV */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Subir CSV completado</label>
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <DocumentArrowUpIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              {csvFileName ? (
                <p className="text-sm text-slate-700 font-medium">{csvFileName}</p>
              ) : (
                <p className="text-sm text-slate-400">Haz clic para seleccionar archivo .csv</p>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          </div>

          {/* Preview */}
          {csvRows.length > 0 && !csvResult && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">
                Vista previa — {csvRows.filter(r => r.paid).length} pagos a registrar de {csvRows.length} unidades
              </p>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-500">Unidad</th>
                      <th className="px-3 py-2 text-right text-slate-500">Monto</th>
                      <th className="px-3 py-2 text-center text-slate-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium">{r.identifier}</td>
                        <td className="px-3 py-2 text-right">{r.paid ? `$${r.amount.toLocaleString()}` : '-'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={r.paid ? 'badge-success' : 'badge-warning'}>
                            {r.paid ? 'Pagado' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resultado */}
          {csvResult && (
            <div className="bg-emerald-50 rounded-xl p-4 space-y-2">
              <p className="font-semibold text-emerald-800">✓ Pagos registrados exitosamente</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-emerald-700">{csvResult.paid}</p>
                  <p className="text-xs text-emerald-600">Pagados</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-600">{csvResult.pending}</p>
                  <p className="text-xs text-slate-500">Pendientes</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-700">${csvResult.amount.toLocaleString()}</p>
                  <p className="text-xs text-emerald-600">Total cobrado</p>
                </div>
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowCsvModal(false)} className="btn-secondary">
              {csvResult ? 'Cerrar' : 'Cancelar'}
            </button>
            {!csvResult && (
              <button
                onClick={handleBulkSubmit}
                disabled={csvRows.filter(r => r.paid).length === 0 || csvLoading}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {csvLoading ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Procesando...</>
                ) : (
                  `Registrar ${csvRows.filter(r => r.paid).length} pagos`
                )}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
