interface AuditEntry { action: string; module: string; detail?: string | null }

const modules: Record<string, string> = {
  auth: 'Autenticación', sales: 'Ventas', inventory: 'Inventario', transfers: 'Transferencias',
  users: 'Usuarios', clients: 'Clientes y terceros', catalog: 'Catálogo', locations: 'Ubicaciones',
  reports: 'Reportes', audit: 'Auditoría', production: 'Taller', 'cash-register': 'Caja',
  notifications: 'Notificaciones', quotations: 'Cotizaciones', upload: 'Archivos',
};
const actions: Record<string, string> = {
  LOGIN: 'Inicio de sesión', LOGOUT: 'Cierre de sesión', GOOGLE_LOGIN: 'Acceso con Google',
  LOGIN_FAILED: 'Acceso fallido', LOGIN_BLOCKED: 'Acceso bloqueado', LOGIN_INACTIVE: 'Cuenta inactiva',
  POST: 'Creación', PATCH: 'Actualización', PUT: 'Actualización', DELETE: 'Eliminación',
  PASSWORD_CHANGED: 'Cambio de contraseña', PASSWORD_RESET: 'Restablecimiento de contraseña',
  ACCOUNT_LOCKED: 'Bloqueo de cuenta', PASSWORD_CHANGE_FAILED: 'Cambio de contraseña fallido',
};
const fields: Record<string, string> = {
  email: 'Correo electrónico', fullName: 'Nombre completo', name: 'Nombre', role: 'Rol',
  quantity: 'Cantidad', minStock: 'Stock mínimo', price: 'Precio', total: 'Total', status: 'Estado',
  reason: 'Motivo', locationId: 'Ubicación', locationType: 'Tipo de ubicación', productId: 'Producto',
  variantId: 'Variante', clientId: 'Cliente', items: 'Productos', amount: 'Importe',
  paymentMethod: 'Forma de pago', phone: 'Teléfono', address: 'Dirección', ci: 'CI',
};
export const auditModuleLabel = (value: string) => modules[value] || value;
export const auditActionLabel = (value: string) => actions[value] || value.replace(/_/g, ' ');

export function presentAudit(entry: AuditEntry): { summary: string; fields: string[] } {
  let metadata: Record<string, unknown> = {};
  let text = '';
  if (entry.detail) {
    try {
      const parsed: unknown = JSON.parse(entry.detail);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
      else if (typeof parsed === 'string') text = parsed;
    } catch {
      // Older records may contain a JSON payload truncated by the server.
      if (!entry.detail.trim().startsWith('{')) text = entry.detail;
    }
  }
  const path = typeof metadata.url === 'string' ? metadata.url.split('?')[0].replace(/\/$/, '') : '';
  const operation = path.split('/').pop();
  const auth = entry.module === 'auth';
  const summaries: Record<string, string> = {
    LOGIN: 'Inicio de sesión exitoso.', GOOGLE_LOGIN: 'Inicio de sesión exitoso con Google.',
    LOGOUT: 'Cierre de sesión finalizado.', LOGIN_FAILED: 'Intento de inicio de sesión fallido.',
    LOGIN_BLOCKED: 'Acceso rechazado: cuenta bloqueada.', LOGIN_INACTIVE: 'Acceso rechazado: cuenta desactivada.',
  };
  let summary = summaries[entry.action];
  if (!summary && auth && entry.action === 'POST') {
    summary = ({ login: 'Inicio de sesión exitoso.', logout: 'Cierre de sesión finalizado.',
      'forgot-password': 'Solicitud de recuperación de contraseña registrada.',
      'reset-password': 'Restablecimiento de contraseña completado.',
      'change-password': 'Cambio de contraseña completado.',
    } as Record<string, string>)[operation || ''];
  }
  if (!summary && !auth) {
    summary = ({ confirm: 'Recepción confirmada.', receive: 'Recepción confirmada.',
      cancel: 'Anulación registrada.', close: 'Cierre registrado.', open: 'Apertura registrada.',
      adjust: 'Ajuste de inventario registrado.', send: 'Envío registrado.',
    } as Record<string, string>)[operation || ''];
  }
  const verb = ({ POST: 'Registro creado', PATCH: 'Registro actualizado', PUT: 'Registro actualizado', DELETE: 'Registro eliminado' } as Record<string, string>)[entry.action];
  const fallback = verb ? `${verb} en ${auditModuleLabel(entry.module).toLocaleLowerCase('es')}.` : `${auditActionLabel(entry.action)} registrado en ${auditModuleLabel(entry.module).toLocaleLowerCase('es')}.`;
  const keys = Array.isArray(metadata.bodyKeys) ? metadata.bodyKeys.filter((key): key is string => typeof key === 'string') : [];
  return {
    summary: text || summary || fallback,
    // The audit stores field names, not previous/new values. Do not imply otherwise.
    fields: auth ? [] : keys.filter((key) => !/password|token|secret|credential/i.test(key)).map((key) => fields[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')),
  };
}
