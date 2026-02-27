'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import { tenantsApi } from '@/services/api';
import PageHeader from '@/components/ui/PageHeader';
import Modal from '@/components/ui/Modal';
import StatCard from '@/components/ui/StatCard';
import {
  BuildingOffice2Icon,
  UsersIcon,
  BuildingOfficeIcon,
  CpuChipIcon,
  PlusIcon,
  PencilIcon,
  EyeIcon,
  XCircleIcon,
  CheckCircleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface TenantStats {
  totalTenants: number;
  totalUsers: number;
  totalUnits: number;
  totalDevices: number;
}

export default function FraccionamientosPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [tenants, setTenants] = useState<any[]>([]);
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    address: '',
    phone: '',
    email: '',
    adminEmail: '',
    adminPassword: '',
    adminFirstName: '',
    adminLastName: '',
    adminPhone: '',
  });

  // Proteger: solo superAdmin
  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const load = () => {
    setLoading(true);
    Promise.all([
      tenantsApi.list(),
      tenantsApi.stats(),
    ])
      .then(([tenantsRes, statsRes]: any[]) => {
        setTenants(tenantsRes.data || []);
        setStats(statsRes.data || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (name: string) => {
    setForm({ ...form, name, slug: generateSlug(name) });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await tenantsApi.createWithAdmin(form);
      setShowCreateModal(false);
      setForm({ name: '', slug: '', address: '', phone: '', email: '', adminEmail: '', adminPassword: '', adminFirstName: '', adminLastName: '', adminPhone: '' });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al crear fraccionamiento');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (tenant: any) => {
    try {
      if (tenant.isActive) await tenantsApi.deactivate(tenant.id);
      else await tenantsApi.activate(tenant.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleDelete = async (tenant: any) => {
    if (!confirm(`¿ELIMINAR PERMANENTEMENTE "${tenant.name}" y todos sus datos? Esta acción NO se puede deshacer.`)) return;
    if (!confirm(`Confirmación final: ¿Eliminar fraccionamiento "${tenant.name}"?`)) return;
    try {
      await tenantsApi.remove(tenant.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  };

  const handleViewDetail = async (tenant: any) => {
    try {
      const res: any = await tenantsApi.get(tenant.id);
      setSelectedTenant(res.data);
      setShowDetailModal(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  };

  if (!user?.isSuperAdmin) return null;

  return (
    <div>
      <PageHeader
        title="Fraccionamientos"
        subtitle="Gestión multiempresa - Panel Super Administrador"
        action={
          <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-5 h-5" />
            Nuevo fraccionamiento
          </button>
        }
      />

      {/* Stats globales */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard title="Fraccionamientos" value={stats.totalTenants} icon={BuildingOffice2Icon} color="amber" />
          <StatCard title="Usuarios totales" value={stats.totalUsers} icon={UsersIcon} color="blue" />
          <StatCard title="Unidades totales" value={stats.totalUnits} icon={BuildingOfficeIcon} color="green" />
          <StatCard title="Dispositivos totales" value={stats.totalDevices} icon={CpuChipIcon} color="purple" />
        </div>
      )}

      {/* Lista de fraccionamientos */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="glass-card animate-pulse h-28" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {tenants.length === 0 ? (
            <div className="glass-card text-center py-12">
              <BuildingOffice2Icon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-lg">No hay fraccionamientos creados</p>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary mt-4">
                Crear el primero
              </button>
            </div>
          ) : (
            tenants.map((tenant: any) => (
              <div key={tenant.id} className="glass-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center">
                      <BuildingOffice2Icon className="w-7 h-7 text-primary-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-slate-800">{tenant.name}</h3>
                        <span className={tenant.isActive ? 'badge-success' : 'badge-danger'}>
                          {tenant.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">{tenant.address || 'Sin dirección'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        slug: <span className="font-mono">{tenant.slug}</span>
                        {tenant.email && <> &middot; {tenant.email}</>}
                        {tenant.phone && <> &middot; {tenant.phone}</>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Contadores */}
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <div className="text-center">
                        <p className="font-bold text-lg text-slate-700">{tenant._count?.users || 0}</p>
                        <p className="text-xs">Usuarios</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-lg text-slate-700">{tenant._count?.units || 0}</p>
                        <p className="text-xs">Unidades</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-lg text-slate-700">{tenant._count?.devices || 0}</p>
                        <p className="text-xs">Dispositivos</p>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleViewDetail(tenant)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Ver detalle"
                      >
                        <EyeIcon className="w-5 h-5 text-slate-500" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(tenant)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title={tenant.isActive ? 'Desactivar' : 'Activar'}
                      >
                        {tenant.isActive
                          ? <XCircleIcon className="w-5 h-5 text-yellow-500" />
                          : <CheckCircleIcon className="w-5 h-5 text-green-500" />
                        }
                      </button>
                      <button
                        onClick={() => handleDelete(tenant)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar permanentemente"
                      >
                        <TrashIcon className="w-5 h-5 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal Crear Fraccionamiento */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nuevo Fraccionamiento" size="lg">
        <form onSubmit={handleCreate} className="space-y-6">
          {/* Datos del fraccionamiento */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Datos del fraccionamiento</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                  <input className="input-field" value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Residencial Las Flores" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Slug (URL) *</label>
                  <input className="input-field font-mono text-sm" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="las-flores" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                <input className="input-field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Calle, Colonia, Ciudad, Estado" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                  <input className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input className="input-field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* Datos del administrador */}
          <div className="border-t border-slate-100 pt-6">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Administrador del fraccionamiento</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                  <input className="input-field" value={form.adminFirstName} onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Apellido *</label>
                  <input className="input-field" value={form.adminLastName} onChange={(e) => setForm({ ...form, adminLastName: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email del admin *</label>
                  <input className="input-field" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña *</label>
                  <input className="input-field" type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} required minLength={6} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono del admin</label>
                <input className="input-field" value={form.adminPhone} onChange={(e) => setForm({ ...form, adminPhone: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={creating} className="btn-primary">
              {creating ? 'Creando...' : 'Crear fraccionamiento'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Detalle */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title={selectedTenant?.name || 'Detalle'}>
        {selectedTenant && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400">Slug</p>
                <p className="font-mono text-sm">{selectedTenant.slug}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Estado</p>
                <span className={selectedTenant.isActive ? 'badge-success' : 'badge-danger'}>
                  {selectedTenant.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400">Dirección</p>
                <p className="text-sm">{selectedTenant.address || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-sm">{selectedTenant.email || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Teléfono</p>
                <p className="text-sm">{selectedTenant.phone || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Creado</p>
                <p className="text-sm">{new Date(selectedTenant.createdAt).toLocaleDateString('es-MX')}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Estadísticas</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{selectedTenant._count?.users || 0}</p>
                  <p className="text-xs text-blue-500">Usuarios</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{selectedTenant._count?.units || 0}</p>
                  <p className="text-xs text-green-500">Unidades</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-purple-700">{selectedTenant._count?.devices || 0}</p>
                  <p className="text-xs text-purple-500">Dispositivos</p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">Tenant ID</p>
              <p className="font-mono text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">{selectedTenant.id}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
