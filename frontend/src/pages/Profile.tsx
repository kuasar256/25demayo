import { useState } from 'react';
import { useAuthStore, ROLE_LABELS } from '../store/auth';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import { Camera, User as UserIcon, KeyRound, ShieldCheck } from 'lucide-react';

export function ProfilePage() {
  const { user, token, setAuth } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const [requestingPassword, setRequestingPassword] = useState(false);

  // Estados para cambio de contraseña
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/upload/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const avatarUrl = data.url;
      await api.patch('/users/me', { avatarUrl });
      
      // Update local store
      if (user && token) {
        setAuth(token, { ...user, avatarUrl });
      }
      toast.success('Foto de perfil actualizada');
    } catch {
      toast.error('Error al subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Ingresa tu contraseña actual.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas nuevas no coinciden.');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      toast.success(res.data?.message || 'Contraseña actualizada con éxito');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al actualizar contraseña.';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!user) return;
    setRequestingPassword(true);
    try {
      await api.post('/auth/recover', { email: user.email });
      toast.success('Solicitud enviada al administrador. Coordina con él para recibir tu nueva contraseña.');
    } catch {
      toast.error('No se pudo enviar la solicitud. Inténtalo de nuevo.');
    } finally {
      setRequestingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Mi Perfil</h1>
      <p className="text-sm text-muted mb-6">Consulta tu información institucional y administra tu seguridad y credenciales.</p>

      <div className="card flex flex-col md:flex-row gap-8 items-start">
        {/* Avatar Section */}
        <div className="flex flex-col items-center gap-4 min-w-[200px]">
          <div className="relative">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-40 h-40 rounded-full object-cover shadow-md border-4 border-white dark:border-surface" />
            ) : (
              <div className="w-40 h-40 rounded-full bg-primary flex items-center justify-center text-white text-6xl font-bold shadow-md border-4 border-white dark:border-surface">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            
            <label className="absolute bottom-2 right-2 bg-white text-ink p-2 rounded-full shadow-lg cursor-pointer hover:bg-page transition border border-line">
              <Camera size={20} />
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
          </div>
          
          <div className="text-center">
            <h2 className="font-bold text-lg">{ROLE_LABELS[user.role]}</h2>
            <p className="text-sm text-muted">{user.role}</p>
          </div>
          
          <label className="btn-secondary text-sm px-6 py-2 cursor-pointer w-full text-center">
            {uploading ? 'Subiendo...' : 'Cambiar foto'}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
          </label>
          <p className="text-[10px] text-muted">JPEG o PNG (máximo 5 MB)</p>
        </div>

        {/* Info Section */}
        <div className="flex-1 space-y-6 w-full">
          <div>
            <h3 className="font-bold text-lg mb-1 flex items-center justify-between">
              Información Institucional
              <span className="badge bg-page text-muted border border-line font-normal flex items-center gap-1">
                <UserIcon size={12} /> Sólo lectura
              </span>
            </h3>
            <p className="text-xs text-muted mb-4">Estos datos son administrados por el Administrador.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Nombre completo</p>
              <p className="font-medium mt-1">{user.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Correo / Usuario</p>
              <p className="font-medium mt-1">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Rol Institucional</p>
              <p className="font-medium mt-1">{ROLE_LABELS[user.role]}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase font-semibold">Área asignada</p>
              <p className="font-medium mt-1">{user.branchId ? `Sucursal ID: ${user.branchId}` : 'Fábrica / Dirección General'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs text-muted uppercase font-semibold">Estado de la cuenta</p>
              <p className="font-medium mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success"></span> Activo (Sesión JWT Segura)
              </p>
            </div>
          </div>

          {/* Seguridad y Contraseña */}
          <div className="pt-6 border-t border-line mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-base flex items-center gap-2">
                  <ShieldCheck size={18} className="text-secondary" />
                  Seguridad de la Cuenta
                </h4>
                <p className="text-xs text-muted">Actualiza tu contraseña periódicamente para mayor protección.</p>
              </div>
              <button
                type="button"
                className="btn-secondary text-xs flex items-center gap-1.5"
                onClick={() => setShowPasswordForm(!showPasswordForm)}
              >
                <KeyRound size={14} />
                {showPasswordForm ? 'Ocultar formulario' : 'Cambiar contraseña'}
              </button>
            </div>

            {showPasswordForm && (
              <form onSubmit={handlePasswordChange} className="bg-page/50 dark:bg-elevated p-4 rounded-lg border border-line space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted uppercase mb-1">Contraseña Actual</label>
                  <input
                    type="password"
                    className="input w-full text-sm"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Introduce tu contraseña actual"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase mb-1">Nueva Contraseña</label>
                    <input
                      type="password"
                      className="input w-full text-sm"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted uppercase mb-1">Confirmar Nueva Contraseña</label>
                    <input
                      type="password"
                      className="input w-full text-sm"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la nueva contraseña"
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary text-xs"
                    disabled={savingPassword}
                  >
                    {savingPassword ? 'Guardando…' : 'Guardar nueva contraseña'}
                  </button>
                </div>
              </form>
            )}

            <div className="pt-2 text-xs text-muted flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>¿Olvidaste tu contraseña o necesitas asistencia del administrador?</span>
              <button
                type="button"
                className="text-xs text-secondary hover:underline self-start sm:self-auto"
                onClick={requestPasswordReset}
                disabled={requestingPassword}
              >
                {requestingPassword ? 'Enviando solicitud…' : 'Solicitar al administrador'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

