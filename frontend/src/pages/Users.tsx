import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore, ROLE_LABELS } from '../store/auth';
import { Copy, Eye, EyeOff, KeyRound, MessageCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { PaginationControls } from '../components/PaginationControls';

function normalizeCredentialPart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');
}

function randomFourDigits() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(1000 + (random[0] % 9000));
}

function generatePasswordOptions(fullName: string, role: string, branchName: string) {
  const firstName = normalizeCredentialPart(fullName.trim().split(/\s+/)[0] ?? '').toLowerCase();
  const roleCodes: Record<string, string> = {
    ADMIN_GENERAL: 'AG',
    ADMIN: 'ADM',
    ENCARGADO_FABRICA: 'EF',
    ENCARGADO_SUCURSAL: 'ES',
    VENDEDOR: 'VEN',
  };
  const roleCode = roleCodes[role] ?? 'USR';
  const branchCode = normalizeCredentialPart(branchName).toUpperCase().slice(0, 3);
  const contextCode = branchCode || roleCode;
  const digits = [randomFourDigits(), randomFourDigits(), randomFourDigits()];

  return [
    `${firstName}${roleCode.toLowerCase()}${contextCode}${digits[0]}`,
    `${contextCode}${firstName}${roleCode.toLowerCase()}${digits[1]}`,
    `${firstName}${contextCode}${roleCode.toLowerCase()}${digits[2]}`,
  ];
}

export function UsersPage() {
  const user = useAuthStore((s) => s.user);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [resettingItem, setResettingItem] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: userResults, isLoading, isError } = useQuery({
    queryKey: ['users', search, status, page, pageSize],
    queryFn: async () => (
      await api.get('/users', { params: { search, status: status || undefined, page, pageSize } })
    ).data,
  });
  const users = userResults?.items ?? [];

  const isAdmin = ['ADMIN_GENERAL', 'ADMIN'].includes(user?.role || '');

  const openCreate = () => {
    setEditingItem(null);
    setResettingItem(null);
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setResettingItem(null);
    setShowModal(true);
  };

  const openResetPassword = (item: any) => {
    setEditingItem(null);
    setResettingItem(item);
    setShowModal(true);
  };

  const queryClient = useQueryClient();
  const toggleStatusMut = useMutation({
    mutationFn: async ({ id, isActive }: { id: number, isActive: boolean }) => api.patch(`/users/${id}/status`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
        {isAdmin && (
          <button className="btn-primary" onClick={openCreate}>
            + Nuevo Usuario
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="input sm:max-w-sm"
          aria-label="Buscar usuarios"
          placeholder="Buscar por nombre, correo o sucursal..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className="input sm:max-w-xs"
          aria-label="Filtrar usuarios por estado"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {isLoading ? <p className="text-muted">Cargando...</p> : isError ? (
        <p className="text-danger" role="alert">No se pudieron cargar los usuarios. Intente nuevamente.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-2">Nombre</th>
                <th className="py-2">Email</th>
                <th className="py-2">Rol</th>
                <th className="py-2">Sucursal</th>
                <th className="py-2 text-center">Estado</th>
                {isAdmin && <th className="py-2 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u: any) => (
                <tr key={u.id} className="border-b border-line/60 hover:bg-page/60">
                  <td className="py-2 font-medium">{u.fullName}</td>
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">
                    <span className="badge bg-secondary/10 text-secondary">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}</span>
                  </td>
                  <td className="py-2 text-muted">{u.branch?.name || '-'}</td>
                  <td className="py-2 text-center">
                    <button 
                      onClick={() => toggleStatusMut.mutate({ id: u.id, isActive: !u.isActive })}
                      disabled={!isAdmin || u.id === user?.id}
                      className={`badge ${u.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'} ${isAdmin && u.id !== user?.id ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                    >
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  {isAdmin && (
                    <td className="py-2 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button className="text-secondary font-medium hover:underline" onClick={() => openEdit(u)}>Editar</button>
                        <button
                          className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
                          onClick={() => openResetPassword(u)}
                          title={`Asignar nueva contraseña a ${u.fullName}`}
                        >
                          <KeyRound size={15} /> Nueva contraseña
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={isAdmin ? 6 : 5} className="py-4 text-center text-muted">No se encontraron usuarios.</td></tr>
              )}
            </tbody>
          </table>
          <PaginationControls
            page={userResults?.page ?? page}
            pageSize={userResults?.pageSize ?? pageSize}
            total={userResults?.total ?? 0}
            totalPages={userResults?.totalPages ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}

      {showModal && (
        <UserModal
          key={`${resettingItem?.id ?? editingItem?.id ?? 'new'}-${resettingItem ? 'reset' : editingItem ? 'edit' : 'create'}`}
          item={resettingItem ?? editingItem}
          resetPassword={!!resettingItem}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ------------------- MODAL CREAR / EDITAR -------------------
function UserModal({ item, resetPassword = false, onClose }: { item?: any, resetPassword?: boolean, onClose: () => void }) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isEditing = !!item;
  const isResettingPassword = resetPassword && isEditing;
  
  const [fullName, setFullName] = useState(item?.fullName || '');
  const [email, setEmail] = useState(item?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState(item?.role || 'VENDEDOR');
  const [branchId, setBranchId] = useState(item?.branchId ? String(item.branchId) : '');
  const [passwordOptions, setPasswordOptions] = useState<string[]>([]);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/locations/branches')).data,
  });
  const selectedBranch = branches?.find((branch: any) => String(branch.id) === branchId);

  useEffect(() => {
    if ((isEditing && !isResettingPassword) || !fullName.trim()) {
      setPasswordOptions([]);
      return;
    }
    if (['ENCARGADO_SUCURSAL', 'VENDEDOR'].includes(role) && !selectedBranch) {
      setPasswordOptions([]);
      return;
    }
    const generated = generatePasswordOptions(fullName, role, selectedBranch?.name ?? '');
    setPasswordOptions(generated);
    setPassword(generated[0]);
  }, [fullName, role, selectedBranch?.name, isEditing, isResettingPassword]);

  const mut = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditing) {
        return api.patch(`/users/${item.id}`, payload);
      }
      return api.post('/users', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (!isEditing || isResettingPassword) {
        setCreatedCredentials({ email, password });
      } else {
        onClose();
      }
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isResettingPassword) {
      if (!password) return alert('Selecciona o escribe una nueva contraseña.');
      mut.mutate({ password });
      return;
    }
    const payload: any = { fullName, email, role };
    if (password) payload.password = password;
    if (role === 'ENCARGADO_SUCURSAL' || role === 'VENDEDOR') {
      if (!branchId) return alert('Debe seleccionar una sucursal para este rol');
      payload.branchId = Number(branchId);
    } else {
      payload.branchId = null;
    }
    mut.mutate(payload);
  };

  const isGeneralAdmin = currentUser?.role === 'ADMIN_GENERAL';
  const regeneratePasswordOptions = () => {
    const generated = generatePasswordOptions(fullName, role, selectedBranch?.name ?? '');
    setPasswordOptions(generated);
    setPassword(generated[0]);
    setShowPassword(false);
  };

  const copyCredentials = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error('No se pudo copiar. Selecciona el texto y cópialo manualmente.');
    }
  };

  if (createdCredentials) {
    const shareMessage = `Credenciales de acceso\nSistema: Colchones\nCorreo: ${createdCredentials.email}\nNueva contraseña: ${createdCredentials.password}`;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-card shadow-card p-6 w-full max-w-md space-y-4">
          <div>
            <h2 className="text-xl font-bold">{isResettingPassword ? 'Nueva contraseña asignada' : 'Usuario creado'}</h2>
            <p className="mt-1 text-sm text-muted">
              Comparte {isResettingPassword ? 'la nueva contraseña' : 'estas credenciales'} de forma privada con el usuario.
            </p>
          </div>
          <div>
            <label className="label">Correo de acceso</label>
            <div className="flex gap-2">
              <input readOnly className="input" value={createdCredentials.email} />
              <button type="button" className="btn-secondary" aria-label="Copiar correo" onClick={() => copyCredentials(createdCredentials.email, 'Correo')}>
                <Copy size={18} />
              </button>
            </div>
          </div>
          <div>
            <label className="label">Contraseña</label>
            <div className="flex gap-2">
              <input readOnly className="input font-mono" value={createdCredentials.password} />
              <button type="button" className="btn-secondary" aria-label="Copiar contraseña" onClick={() => copyCredentials(createdCredentials.password, 'Contraseña')}>
                <Copy size={18} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => copyCredentials(shareMessage, 'Credenciales')}>
              <Copy size={17} /> Copiar todo
            </button>
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, '_blank', 'noopener,noreferrer')}
            >
              <MessageCircle size={17} /> WhatsApp
            </button>
            <button type="button" className="btn-primary" onClick={onClose}>Finalizar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-card shadow-card p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {isResettingPassword ? 'Asignar nueva contraseña' : `${isEditing ? 'Editar' : 'Nuevo'} Usuario`}
        </h2>
        {isResettingPassword && (
          <p className="mb-4 text-sm text-muted">
            Usuario: <strong className="text-ink">{fullName}</strong> ({email})
          </p>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          {!isResettingPassword && (
            <>
              <div>
                <label className="label">Nombre Completo</label>
                <input required type="text" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="label">Correo Electrónico</label>
                <input required type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className="label">
              {isResettingPassword ? 'Nueva contraseña' : 'Contraseña'}
              {isEditing && !isResettingPassword && <span className="text-xs text-muted font-normal">(Dejar en blanco para no cambiar)</span>}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required={!isEditing || isResettingPassword}
                className="input pr-11"
                autoComplete={isEditing ? 'new-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-ink"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {(!isEditing || isResettingPassword) && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted">Elige una opción basada en nombre, rol y sucursal, con 4 dígitos aleatorios.</p>
                  <button
                    type="button"
                    className="shrink-0 text-secondary hover:text-primary"
                    onClick={regeneratePasswordOptions}
                    disabled={!fullName.trim() || (['ENCARGADO_SUCURSAL', 'VENDEDOR'].includes(role) && !selectedBranch)}
                    aria-label="Generar otras contraseñas"
                    title="Generar otras contraseñas"
                  >
                    <RefreshCw size={17} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {passwordOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs transition ${
                        password === option ? 'border-secondary bg-secondary/10 text-secondary' : 'border-line text-ink hover:border-secondary/50'
                      }`}
                      onClick={() => { setPassword(option); setShowPassword(false); }}
                      aria-pressed={password === option}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {!isResettingPassword && (
            <>
          <div>
            <label className="label">Rol</label>
            <select required className="input" value={role} onChange={(e) => { setRole(e.target.value); setBranchId(''); }}>
              {isGeneralAdmin && <option value="ADMIN_GENERAL">Administrador General</option>}
              {isGeneralAdmin && <option value="ADMIN">Administrador</option>}
              <option value="ENCARGADO_FABRICA">Encargado de Fábrica</option>
              <option value="ENCARGADO_SUCURSAL">Encargado de Sucursal</option>
              <option value="VENDEDOR">Vendedor</option>
            </select>
          </div>

          {(role === 'ENCARGADO_SUCURSAL' || role === 'VENDEDOR') && (
            <div>
              <label className="label">Asignar a Sucursal</label>
              <select required className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Seleccione sucursal...</option>
                {(branches || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {!isEditing && (
            <p className="rounded-lg bg-page p-3 text-xs text-muted">
              Correo de acceso: <strong className="text-ink">{email || 'Escribe el correo real del usuario'}</strong>.
              El sistema no inventa correos; debe ser una dirección válida que pertenezca al usuario.
            </p>
          )}
            </>
          )}
          {(!isEditing || isResettingPassword) && password && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              Guarda y comparte la contraseña de forma privada. Como incluye datos del usuario y solo 4 dígitos aleatorios, es fácil de recordar, pero menos segura que una contraseña larga y única.
            </p>
          )}

          {mut.isError && <p className="text-danger text-sm">{(mut.error as any).response?.data?.message || 'Error al guardar usuario'}</p>}
          
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" className="btn-tertiary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={mut.isPending}>
              {mut.isPending ? 'Guardando...' : isResettingPassword ? 'Asignar contraseña' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
