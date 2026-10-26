import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore, Role } from './store/auth';
import { Layout } from './components/Layout';
import { api } from './lib/api';

const LoginPage = lazy(() => import('./pages/Login').then(({ LoginPage }) => ({ default: LoginPage })));
const DashboardPage = lazy(() => import('./pages/Dashboard').then(({ DashboardPage }) => ({ default: DashboardPage })));
const ProductsPage = lazy(() => import('./pages/Products').then(({ ProductsPage }) => ({ default: ProductsPage })));
const SellerCatalogPage = lazy(() => import('./pages/SellerCatalog').then(({ SellerCatalogPage }) => ({ default: SellerCatalogPage })));
const InventoryPage = lazy(() => import('./pages/Inventory').then(({ InventoryPage }) => ({ default: InventoryPage })));
const LocationsPage = lazy(() => import('./pages/Locations').then(({ LocationsPage }) => ({ default: LocationsPage })));
const NewSalePage = lazy(() => import('./pages/NewSale').then(({ NewSalePage }) => ({ default: NewSalePage })));
const SalesPage = lazy(() => import('./pages/Sales').then(({ SalesPage }) => ({ default: SalesPage })));
const TransfersPage = lazy(() => import('./pages/Transfers').then(({ TransfersPage }) => ({ default: TransfersPage })));
const UsersPage = lazy(() => import('./pages/Users').then(({ UsersPage }) => ({ default: UsersPage })));
const ClientsPage = lazy(() => import('./pages/Clients').then(({ ClientsPage }) => ({ default: ClientsPage })));
const ReportsPage = lazy(() => import('./pages/Reports').then(({ ReportsPage }) => ({ default: ReportsPage })));
const AuditPage = lazy(() => import('./pages/Audit').then(({ AuditPage }) => ({ default: AuditPage })));
const ProfilePage = lazy(() => import('./pages/Profile').then(({ ProfilePage }) => ({ default: ProfilePage })));
const CashRegisterPage = lazy(() => import('./pages/CashRegister').then(({ CashRegisterPage }) => ({ default: CashRegisterPage })));
const WarrantyPage = lazy(() => import('./pages/Warranty').then(({ WarrantyPage }) => ({ default: WarrantyPage })));
const ProductionPage = lazy(() => import('./pages/Production').then(({ ProductionPage }) => ({ default: ProductionPage })));

/** Guard para proteger rutas por rol */
function RoleRoute({ roles, children }: { roles: Role[]; children: JSX.Element }) {
  const user = useAuthStore((s) => s.user);
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);

  // Verificación proactiva de la sesión JWT al cargar la aplicación
  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          if (res.data) {
            setAuth(token, res.data);
          }
        })
        .catch(() => {
          // El interceptor de axios en api.ts maneja el 401 y realiza logout
        });
    }
  }, [token, setAuth]);

  return (
    <>
      <Toaster position="top-right" />
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-muted">Cargando…</div>}>
        {!token ? (
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/productos" element={<ProductsPage />} />
              <Route
                path="/catalogo"
                element={
                  <RoleRoute roles={['ADMIN_GENERAL', 'ADMIN', 'VENDEDOR']}>
                    <SellerCatalogPage />
                  </RoleRoute>
                }
              />
              <Route path="/inventario" element={<InventoryPage />} />
              <Route
                path="/ventas"
                element={
                  <RoleRoute roles={['ADMIN_GENERAL', 'ADMIN', 'ENCARGADO_FABRICA', 'ENCARGADO_SUCURSAL', 'VENDEDOR']}>
                    <SalesPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/ventas/nueva"
                element={
                  <RoleRoute roles={['ADMIN_GENERAL', 'ADMIN', 'ENCARGADO_SUCURSAL', 'VENDEDOR']}>
                    <NewSalePage />
                  </RoleRoute>
                }
              />
              <Route path="/caja" element={<Navigate to="/ventas?tab=caja" replace />} />
              <Route path="/garantias" element={<Navigate to="/ventas?tab=garantias" replace />} />
              <Route path="/produccion" element={<Navigate to="/ventas?tab=produccion" replace />} />
              <Route path="/ubicaciones" element={<LocationsPage />} />
              <Route path="/transferencias" element={<TransfersPage />} />
              <Route path="/clientes" element={<ClientsPage />} />
              <Route path="/reportes" element={<ReportsPage />} />
              <Route
                path="/usuarios"
                element={
                  <RoleRoute roles={['ADMIN_GENERAL', 'ADMIN']}>
                    <UsersPage />
                  </RoleRoute>
                }
              />
              <Route
                path="/auditoria"
                element={
                  <RoleRoute roles={['ADMIN_GENERAL', 'ADMIN']}>
                    <AuditPage />
                  </RoleRoute>
                }
              />
              <Route path="/mi-perfil" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </Suspense>
    </>
  );
}

