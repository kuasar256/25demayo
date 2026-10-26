import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

const DEPARTMENTS = ['Beni', 'Chuquisaca', 'Cochabamba', 'La Paz', 'Oruro', 'Pando', 'Potosí', 'Santa Cruz', 'Tarija'];

export function LocationsPage() {
  const user = useAuthStore((s) => s.user);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const isAdmin = ['ADMIN_GENERAL', 'ADMIN'].includes(user?.role || '');

  const { data: branches, isLoading, isError } = useQuery({
    queryKey: ['branches', 'management', isAdmin],
    queryFn: async () => (
      await api.get('/locations/branches', { params: isAdmin ? { includeInactive: true } : undefined })
    ).data,
  });

  const pageSize = 10;
  const filteredBranches = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return (branches ?? []).filter((branch: any) => {
      const matchesSearch = !normalizedSearch || [
        branch.name,
        branch.address,
        branch.department,
        branch.phone,
      ].some((value) => String(value ?? '').toLocaleLowerCase().includes(normalizedSearch));
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? branch.isActive : !branch.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [branches, search, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredBranches.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleBranches = filteredBranches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openCreate = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setShowModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sucursales</h1>
          <p className="text-sm text-muted">Gestión de sucursales (La Fábrica Central es fija y única).</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={openCreate}>
            + Nueva Sucursal
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className="input sm:max-w-sm"
            aria-label="Buscar sucursales"
            placeholder="Buscar por nombre, departamento, dirección o teléfono..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <select
            className="input sm:max-w-xs"
            aria-label="Filtrar sucursales por estado"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as typeof statusFilter);
              setPage(1);
            }}
          >
            <option value="all">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>
        </div>
      )}

      {isLoading ? <p className="text-muted">Cargando...</p> : isError ? (
        <p className="text-danger" role="alert">No se pudieron cargar las sucursales. Intente nuevamente.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-2">Nombre</th>
                <th className="py-2">Departamento</th>
                <th className="py-2">Dirección</th>
                <th className="py-2">Teléfono</th>
                <th className="py-2 text-center">Estado</th>
                <th className="py-2 text-right">Métricas</th>
                {isAdmin && <th className="py-2 text-right">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {visibleBranches.map((b: any) => (
                <tr key={b.id} className="border-b border-line/60 hover:bg-page/60">
                  <td className="py-2 font-medium">{b.name}</td>
                  <td className="py-2 text-muted">{b.department || 'Sin especificar'}</td>
                  <td className="py-2 text-muted">{b.address || '-'}</td>
                  <td className="py-2 text-muted">{b.phone || '-'}</td>
                  <td className="py-2 text-center">
                    <span className={`badge ${b.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                      {b.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="py-2 text-right text-xs text-muted">
                    {b._count?.users} usuarios<br/>
                    {b._count?.stocks} ítems stock
                  </td>
                  {isAdmin && (
                    <td className="py-2 text-right">
                      <button className="text-secondary font-medium hover:underline" onClick={() => openEdit(b)}>Editar</button>
                    </td>
                  )}
                </tr>
              ))}
              {visibleBranches.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-4 text-center text-muted">
                    {filteredBranches.length === 0 ? 'No hay sucursales que coincidan con los filtros.' : 'No hay sucursales en esta página.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {filteredBranches.length === 0
                ? '0 sucursales'
                : `Mostrando ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredBranches.length)} de ${filteredBranches.length}`}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="btn-tertiary"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Anterior
              </button>
              <span className="text-sm text-muted">Página {currentPage} de {totalPages}</span>
              <button
                className="btn-tertiary"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && <LocationModal item={editingItem} onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ------------------- MODAL CREAR / EDITAR SUCURSAL -------------------
function LocationModal({ item, onClose }: { item?: any, onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEditing = !!item;
  
  const [name, setName] = useState(item?.name || '');
  const [department, setDepartment] = useState(item?.department || '');
  const [address, setAddress] = useState(item?.address || '');
  const [phone, setPhone] = useState(item?.phone || '');
  const [isActive, setIsActive] = useState(item?.isActive ?? true);

  const mut = useMutation({
    mutationFn: async (payload: any) => {
      const endpoint = '/locations/branches';
      if (isEditing) return api.patch(`${endpoint}/${item.id}`, payload);
      return api.post(endpoint, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      onClose();
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { name, address, phone, department: department || null };
    if (isEditing) payload.isActive = isActive;
    mut.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-card shadow-card p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {isEditing ? 'Editar' : 'Nueva'} Sucursal
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Nombre</label>
            <input required type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="branch-department">Departamento</label>
            <select id="branch-department" className="input" value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="">Sin especificar</option>
              {DEPARTMENTS.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Dirección (Opcional)</label>
            <input type="text" className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="label">Teléfono (Opcional)</label>
            <input type="text" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          {isEditing && (
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
              <label htmlFor="isActive" className="font-medium text-ink">Sucursal Activa</label>
            </div>
          )}

          {mut.isError && <p className="text-danger text-sm">{(mut.error as any).response?.data?.message || 'Error al guardar'}</p>}
          
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" className="btn-tertiary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={mut.isPending}>
              {mut.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
