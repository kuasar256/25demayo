import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuthStore, MENU_BY_ROLE, ROLE_LABELS } from '../store/auth';
import { api } from '../lib/api';
import { 
  Menu, Sun, Moon, Bell, LogOut, Search, Crown, CheckCheck, Images,
  LayoutDashboard, Package, MapPin, Boxes, ArrowRightLeft, 
  ShoppingCart, ShoppingBag, Users, BarChart2, UserCog, ClipboardList, Wallet, ShieldCheck, Factory
} from 'lucide-react';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const ICON_MAP: Record<string, any> = {
  '/': LayoutDashboard,
  '/productos': Package,
  '/catalogo': Images,
  '/ubicaciones': MapPin,
  '/inventario': Boxes,
  '/transferencias': ArrowRightLeft,
  '/produccion': Factory,
  '/ventas?tab=produccion': Factory,
  '/ventas': ShoppingCart,
  '/ventas/nueva': ShoppingBag,
  '/caja': Wallet,
  '/garantias': ShieldCheck,
  '/clientes': Users,
  '/reportes': BarChart2,
  '/usuarios': UserCog,
  '/auditoria': ClipboardList,
};

const NOTIFICATION_ROUTES: Record<string, string> = {
  STOCK_CRITICO: '/inventario',
  TRANSFERENCIA_CREADA: '/transferencias',
  TRANSFERENCIA_RECIBIDA: '/transferencias',
  VENTA_ANULADA: '/ventas',
  PASSWORD_RESET_REQUEST: '/usuarios',
};

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const { data: unread = 0 } = useQuery<number>({
    queryKey: ['notifications-unread'],
    queryFn: async () => (await api.get('/notifications/unread-count')).data,
    refetchInterval: 30_000,
  });

  const {
    data: notifications = [],
    isLoading: notificationsLoading,
    isError: notificationsError,
  } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications')).data,
    enabled: notificationsOpen,
    refetchInterval: notificationsOpen ? 30_000 : false,
    staleTime: 10_000,
  });

  const refreshNotifications = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
  };

  const markRead = useMutation({
    mutationFn: (id: number) => api.patch(`/notifications/${id}/read`),
    onSuccess: refreshNotifications,
    onError: () => toast.error('No se pudo marcar la notificación como leída.'),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: refreshNotifications,
    onError: () => toast.error('No se pudieron marcar las notificaciones como leídas.'),
  });

  useEffect(() => {
    if (!notificationsOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [notificationsOpen]);

  const menu = user ? MENU_BY_ROLE[user.role] : [];

  return (
    <div className={`min-h-screen bg-page text-ink flex flex-col ${location.pathname === '/' ? 'flow-shell' : ''}`}>
      {/* Barra superior */}
      <header className="fixed top-0 inset-x-0 h-14 bg-white dark:bg-surface border-b border-line z-40 flex items-center gap-4 px-4 shadow-sm print:hidden">
        <button
          className="lg:hidden p-1 text-muted hover:text-ink transition"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Menú"
        >
          <Menu size={24} />
        </button>
        <div className="flex items-center gap-2 font-bold text-secondary">
          <span className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center shadow-sm">
            <Crown size={20} />
          </span>
          <span className="hidden sm:inline">COLCHONES 25 DE MAYO</span>
        </div>

        {/* Buscador global */}
        <div className="hidden md:flex flex-1 max-w-md mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            className="input pl-10 w-full"
            placeholder="Buscar producto, cliente, venta…"
          />
        </div>

        <div className="ml-auto flex items-center gap-4">
          <button onClick={() => setDark(!dark)} title="Cambiar tema" className="text-muted hover:text-secondary transition">
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Campana de notificaciones con contador */}
          <div className="relative" ref={notificationsRef}>
            <button
              className="relative text-muted hover:text-primary transition"
              title="Notificaciones"
              aria-label={`Notificaciones${unread > 0 ? `, ${unread} sin leer` : ''}`}
              aria-expanded={notificationsOpen}
              aria-haspopup="true"
              onClick={() => setNotificationsOpen((open) => !open)}
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1 border border-white dark:border-surface">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <section
                className="absolute right-0 top-10 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-white shadow-card dark:bg-surface"
                aria-label="Centro de notificaciones"
              >
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <h2 className="font-semibold">Notificaciones</h2>
                  <button
                    className="flex items-center gap-1 text-xs text-secondary hover:underline disabled:opacity-50 dark:text-secondary"
                    onClick={() => markAllRead.mutate()}
                    disabled={unread === 0 || markAllRead.isPending}
                  >
                    <CheckCheck size={14} />
                    Marcar todas como leídas
                  </button>
                </div>
                <div className="max-h-[min(24rem,70vh)] overflow-y-auto">
                  {notificationsLoading && (
                    <p className="px-4 py-6 text-center text-sm text-muted">Cargando notificaciones…</p>
                  )}
                  {notificationsError && (
                    <p className="px-4 py-6 text-center text-sm text-danger">
                      No se pudieron cargar las notificaciones.
                    </p>
                  )}
                  {!notificationsLoading && !notificationsError && notifications.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-muted">No tienes notificaciones.</p>
                  )}
                  {!notificationsLoading && !notificationsError && notifications.map((notification) => (
                    <button
                      key={notification.id}
                      className={`block w-full border-b border-line px-4 py-3 text-left transition hover:bg-page dark:hover:bg-elevated ${
                        notification.isRead ? 'opacity-70' : 'bg-primary/5'
                      }`}
                      onClick={() => {
                        if (!notification.isRead) markRead.mutate(notification.id);
                        const destination = NOTIFICATION_ROUTES[notification.type];
                        if (destination) {
                          setNotificationsOpen(false);
                          navigate(destination);
                        }
                      }}
                    >
                      <span className="flex items-start gap-2">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          notification.isRead ? 'bg-transparent' : 'bg-primary'
                        }`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{notification.title}</span>
                          <span className="mt-1 block text-xs text-muted">{notification.message}</span>
                          <time className="mt-2 block text-[11px] text-muted" dateTime={notification.createdAt}>
                            {new Date(notification.createdAt).toLocaleString('es-BO')}
                          </time>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="text-right leading-tight hidden sm:block">
            <NavLink to="/mi-perfil" className="hover:text-primary transition group">
              <p className="text-sm font-semibold group-hover:underline">{user?.fullName}</p>
              <p className="text-xs text-muted">{user ? ROLE_LABELS[user.role] : ''}</p>
            </NavLink>
          </div>
          <button onClick={logout} className="flex items-center gap-1 text-danger hover:opacity-80 transition ml-2" title="Salir">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Barra lateral y Área central */}
      <div className="flex flex-1 pt-14">
        <aside className={`
          fixed top-14 bottom-0 left-0 w-64 bg-white dark:bg-surface border-r border-line
          z-30 p-4 overflow-y-auto transition-transform lg:translate-x-0 shadow-lg lg:shadow-none
          print:hidden
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <nav className="space-y-1">
            {menu.map((item) => {
              const Icon = ICON_MAP[item.path] || Package;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-secondary/10 text-secondary dark:bg-secondary/20'
                        : 'text-ink hover:bg-page dark:hover:bg-elevated'
                    }`
                  }
                >
                  <Icon size={18} className="shrink-0" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        {/* Overlay para móvil */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 lg:pl-64 p-6 min-w-0 print:!p-0 print:!pl-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

