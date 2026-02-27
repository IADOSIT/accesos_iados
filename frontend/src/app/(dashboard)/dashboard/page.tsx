'use client';

import { useEffect, useState } from 'react';
import { reportsApi } from '@/services/api';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import {
  BuildingOfficeIcon,
  UsersIcon,
  ExclamationTriangleIcon,
  ArrowsRightLeftIcon,
  CreditCardIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';

interface DashboardData {
  totalUnits: number;
  activeUsers: number;
  delinquentUnits: number;
  todayAccesses: number;
  monthPayments: { count: number; total: number };
  onlineDevices: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    reportsApi.dashboard()
      .then((res: any) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Resumen general del fraccionamiento" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card animate-pulse h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Resumen general del fraccionamiento" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Unidades"
          value={data?.totalUnits || 0}
          subtitle="Total registradas"
          icon={BuildingOfficeIcon}
          color="blue"
        />
        <StatCard
          title="Usuarios activos"
          value={data?.activeUsers || 0}
          subtitle="En el sistema"
          icon={UsersIcon}
          color="green"
        />
        <StatCard
          title="Morosos"
          value={data?.delinquentUnits || 0}
          subtitle="Unidades con adeudo"
          icon={ExclamationTriangleIcon}
          color="red"
        />
        <StatCard
          title="Accesos hoy"
          value={data?.todayAccesses || 0}
          subtitle="Entradas y salidas"
          icon={ArrowsRightLeftIcon}
          color="purple"
        />
        <StatCard
          title="Pagos del mes"
          value={`$${(data?.monthPayments?.total || 0).toLocaleString()}`}
          subtitle={`${data?.monthPayments?.count || 0} pagos registrados`}
          icon={CreditCardIcon}
          color="green"
        />
        <StatCard
          title="Dispositivos en línea"
          value={data?.onlineDevices || 0}
          subtitle="Accesos conectados"
          icon={CpuChipIcon}
          color="blue"
        />
      </div>
    </div>
  );
}
