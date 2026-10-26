import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role =
  | 'ADMIN_GENERAL'
  | 'ADMIN'
  | 'ENCARGADO_FABRICA'
  | 'ENCARGADO_SUCURSAL'
  | 'VENDEDOR';

export interface SessionUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  branchId: number | null;
  branchName?: string | null;
  avatarUrl?: string | null;
}

interface AuthState {
  token: string | null;
  user: SessionUser | null;
  setAuth: (token: string, user: SessionUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'colchones-auth' },
  ),
);

/** Menú lateral según rol (doc 5.12) */
export const MENU_BY_ROLE: Record<Role, { path: string; label: string }[]> = {
  ADMIN_GENERAL: [
    { path: '/', label: 'Dashboard' },
    { path: '/productos', label: 'Catálogo' },
    { path: '/ubicaciones', label: 'Ubicaciones' },
    { path: '/inventario', label: 'Inventario' },
    { path: '/transferencias', label: 'Transferencias' },
    { path: '/ventas', label: 'Ventas, Caja y Taller' },
    { path: '/clientes', label: 'Clientes y Terceros' },
    { path: '/reportes', label: 'Reportes' },
    { path: '/usuarios', label: 'Usuarios' },
    { path: '/auditoria', label: 'Auditoría' },
  ],
  ADMIN: [
    { path: '/', label: 'Dashboard' },
    { path: '/productos', label: 'Catálogo' },
    { path: '/ubicaciones', label: 'Ubicaciones' },
    { path: '/inventario', label: 'Inventario' },
    { path: '/transferencias', label: 'Transferencias' },
    { path: '/ventas', label: 'Ventas, Caja y Taller' },
    { path: '/clientes', label: 'Clientes y Terceros' },
    { path: '/reportes', label: 'Reportes' },
    { path: '/usuarios', label: 'Usuarios' },
    { path: '/auditoria', label: 'Auditoría' },
  ],
  ENCARGADO_FABRICA: [
    { path: '/', label: 'Dashboard' },
    { path: '/ventas?tab=produccion', label: 'Taller y Fabricación' },
    { path: '/productos', label: 'Catálogo' },
    { path: '/inventario', label: 'Inventario fábrica' },
    { path: '/transferencias', label: 'Transferencias' },
    { path: '/clientes', label: 'Proveedores y Terceros' },
    { path: '/reportes', label: 'Reportes fábrica' },
  ],
  ENCARGADO_SUCURSAL: [
    { path: '/', label: 'Dashboard' },
    { path: '/inventario', label: 'Inventario sucursal' },
    { path: '/transferencias', label: 'Recepciones' },
    { path: '/ventas', label: 'Ventas, Caja y Taller' },
    { path: '/clientes', label: 'Clientes y Proformas' },
    { path: '/reportes', label: 'Reportes sucursal' },
  ],
  VENDEDOR: [
    { path: '/', label: 'Dashboard' },
    { path: '/catalogo', label: 'Galería para clientes' },
    { path: '/ventas/nueva', label: 'Nueva venta' },
    { path: '/ventas', label: 'Ventas, Caja y Taller' },
    { path: '/inventario', label: 'Stock disponible' },
    { path: '/transferencias', label: 'Recepción de transferencias' },
    { path: '/clientes', label: 'Clientes y Proformas' },
    { path: '/reportes', label: 'Ranking' },
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN_GENERAL: 'Administrador General',
  ADMIN: 'Administrador',
  ENCARGADO_FABRICA: 'Encargado de Fábrica',
  ENCARGADO_SUCURSAL: 'Encargado de Sucursal',
  VENDEDOR: 'Vendedor',
};
