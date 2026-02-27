'use client';

import { useEffect, useState } from 'react';
import { accessApi } from '@/services/api';
import PageHeader from '@/components/ui/PageHeader';
import DataTable from '@/components/ui/DataTable';

export default function BitacoraPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ method: '', from: '', to: '' });

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.method) params.set('method', filters.method);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    accessApi.logs(params.toString())
      .then((res: any) => setLogs(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const methodLabels: Record<string, string> = {
    APP: 'Aplicación', QR: 'Código QR', GUARD_OVERRIDE: 'Guardia', REMOTE: 'Remoto', EXIT_SENSOR: 'Sensor',
  };

  const columns = [
    {
      key: 'createdAt',
      header: 'Fecha / Hora',
      render: (row: any) => new Date(row.createdAt).toLocaleString('es-MX'),
    },
    { key: 'unit', header: 'Unidad', render: (row: any) => row.unit?.identifier || '-' },
    { key: 'user', header: 'Usuario', render: (row: any) => row.user ? `${row.user.firstName} ${row.user.lastName}` : '-' },
    { key: 'method', header: 'Método', render: (row: any) => methodLabels[row.method] || row.method },
    {
      key: 'direction',
      header: 'Dirección',
      render: (row: any) => (
        <span className={row.direction === 'ENTRY' ? 'badge-info' : 'badge-warning'}>
          {row.direction === 'ENTRY' ? 'Entrada' : 'Salida'}
        </span>
      ),
    },
    {
      key: 'granted',
      header: 'Resultado',
      render: (row: any) => (
        <span className={row.granted ? 'badge-success' : 'badge-danger'}>
          {row.granted ? 'Concedido' : 'Denegado'}
        </span>
      ),
    },
    { key: 'device', header: 'Dispositivo', render: (row: any) => row.device?.name || '-' },
    { key: 'visitorName', header: 'Visitante', render: (row: any) => row.visitorName || '-' },
  ];

  return (
    <div>
      <PageHeader title="Bitácora de Accesos" subtitle="Registro de entradas y salidas" />

      <div className="flex gap-4 mb-6 flex-wrap">
        <select
          className="input-field w-48"
          value={filters.method}
          onChange={(e) => setFilters({ ...filters, method: e.target.value })}
        >
          <option value="">Todos los métodos</option>
          <option value="APP">Aplicación</option>
          <option value="QR">Código QR</option>
          <option value="GUARD_OVERRIDE">Guardia</option>
          <option value="REMOTE">Remoto</option>
        </select>
        <input
          type="date"
          className="input-field w-44"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
        />
        <input
          type="date"
          className="input-field w-44"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
        />
      </div>

      <DataTable columns={columns} data={logs} loading={loading} emptyMessage="No hay registros de acceso" />
    </div>
  );
}
