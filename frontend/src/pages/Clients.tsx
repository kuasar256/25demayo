import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { PaginationControls } from '../components/PaginationControls';
import {
  Users,
  Truck,
  FileText,
  Search,
  Plus,
  Eye,
  Printer,
  Share2,
  CheckCircle,
  Clock,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function ClientsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'clients';

  const setTab = (newTab: string) => {
    setSearchParams({ tab: newTab });
  };

  // State: Clientes
  const [clientSearch, setClientSearch] = useState('');
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(25);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<number | null>(null);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

  // State: Proveedores
  const [supplierCategory, setSupplierCategory] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);

  // State: Cotizaciones
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteStatus, setQuoteStatus] = useState('');
  const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);
  const [viewingQuote, setViewingQuote] = useState<any>(null);

  // Queries
  const { data: clientResults, isLoading: loadingClients } = useQuery({
    queryKey: ['clients', clientSearch, clientPage, clientPageSize],
    queryFn: async () => (await api.get('/clients', { params: { search: clientSearch, page: clientPage, pageSize: clientPageSize } })).data,
    enabled: tab === 'clients',
  });
  const clients = clientResults?.items ?? [];

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ['third-parties', supplierCategory],
    queryFn: async () => (await api.get('/third-parties', { params: { category: supplierCategory || undefined } })).data,
    enabled: tab === 'suppliers',
  });

  const { data: quotations = [], isLoading: loadingQuotations } = useQuery({
    queryKey: ['quotations', quoteSearch, quoteStatus],
    queryFn: async () => (await api.get('/quotations', { params: { search: quoteSearch, status: quoteStatus || undefined } })).data,
    enabled: tab === 'quotations',
  });

  const canManage = ['ADMIN_GENERAL', 'ADMIN', 'ENCARGADO_FABRICA'].includes(user?.role || '');

  // Filtered suppliers locally by search text
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const q = supplierSearch.toLowerCase();
    return suppliers.filter(
      (s: any) =>
        s.name?.toLowerCase().includes(q) ||
        s.contact?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.nit?.toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearch]);

  return (
    <div className="space-y-6">
      {/* Pestañas Principales */}
      <div className="flex border-b border-line gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setTab('clients')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 ${
            tab === 'clients'
              ? 'border-primary text-primary bg-primary/5 font-semibold'
              : 'border-transparent text-muted hover:text-text hover:bg-page/50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Clientes (Particulares y Mayoristas)</span>
        </button>

        <button
          onClick={() => setTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 ${
            tab === 'suppliers'
              ? 'border-primary text-primary bg-primary/5 font-semibold'
              : 'border-transparent text-muted hover:text-text hover:bg-page/50'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Proveedores de Materia Prima</span>
        </button>

        <button
          onClick={() => setTab('quotations')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 ${
            tab === 'quotations'
              ? 'border-primary text-primary bg-primary/5 font-semibold'
              : 'border-transparent text-muted hover:text-text hover:bg-page/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Cotizaciones y Proformas</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: CLIENTES */}
      {/* ============================================================== */}
      {tab === 'clients' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Gestión de Clientes</h1>
              <p className="text-sm text-muted">Historial de compras, saldos y garantías por cliente</p>
            </div>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => {
                setEditingClient(null);
                setShowClientModal(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Nuevo Cliente
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted" />
              <input
                className="input pl-9"
                placeholder="Buscar por CI o Nombre..."
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setClientPage(1);
                }}
              />
            </div>
          </div>

          {loadingClients ? (
            <p className="text-muted">Cargando clientes...</p>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted border-b border-line">
                    <th className="py-2.5">CI</th>
                    <th className="py-2.5">Nombre Completo</th>
                    <th className="py-2.5">Teléfono / WhatsApp</th>
                    <th className="py-2.5 text-center">Compras Realizadas</th>
                    <th className="py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c: any) => (
                    <tr key={c.id} className="border-b border-line/60 hover:bg-page/60">
                      <td className="py-2.5 font-semibold">{c.ci}</td>
                      <td className="py-2.5">{c.fullName}</td>
                      <td className="py-2.5 text-muted">
                        {c.phone ? (
                          <a
                            href={`https://wa.me/591${c.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {c.phone}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2.5 text-center">
                        <span className="badge bg-primary/10 text-primary font-medium">
                          {c._count?.sales ?? 0} ventas
                        </span>
                      </td>
                      <td className="py-2.5 text-right space-x-2">
                        <button
                          className="text-primary font-medium hover:underline text-xs"
                          onClick={() => setSelectedClientForHistory(c.id)}
                        >
                          Historial
                        </button>
                        <button
                          className="text-secondary font-medium hover:underline text-xs"
                          onClick={() => {
                            setEditingClient(c);
                            setShowClientModal(true);
                          }}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted">
                        No se encontraron clientes registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <PaginationControls
                page={clientResults?.page ?? clientPage}
                pageSize={clientResults?.pageSize ?? clientPageSize}
                total={clientResults?.total ?? 0}
                totalPages={clientResults?.totalPages ?? 0}
                onPageChange={setClientPage}
                onPageSizeChange={(sz) => {
                  setClientPageSize(sz);
                  setClientPage(1);
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: PROVEEDORES DE MATERIA PRIMA */}
      {/* ============================================================== */}
      {tab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Proveedores de Materia Prima</h1>
              <p className="text-sm text-muted">
                Catálogo de proveedores para espumas, telas, resortes Bonnell/Pocket, madera y suministros
              </p>
            </div>
            {canManage && (
              <button
                className="btn-primary flex items-center gap-2"
                onClick={() => {
                  setEditingSupplier(null);
                  setShowSupplierModal(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Nuevo Proveedor
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted" />
              <input
                className="input pl-9"
                placeholder="Buscar proveedor por nombre, contacto o CI/NIT..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
              />
            </div>

            <select
              className="input max-w-xs"
              value={supplierCategory}
              onChange={(e) => setSupplierCategory(e.target.value)}
            >
              <option value="">Todas las Categorías de Insumo</option>
              <option value="ESPUMAS">Espumas Poliuretano (D20, D25, D33)</option>
              <option value="TELAS">Telas Jackard y Punto</option>
              <option value="RESORTES">Estructuras Resortes (Bonnell / Pocket)</option>
              <option value="MADERA">Madera y Marcos Somier</option>
              <option value="ADHESIVOS">Adhesivos, Químicos y Pegamentos</option>
              <option value="ACCESORIOS">Hilos, Cintas y Embalaje</option>
              <option value="LOGISTICA">Transporte y Logística</option>
              <option value="OTRO">Otros Insumos</option>
            </select>
          </div>

          {loadingSuppliers ? (
            <p className="text-muted">Cargando proveedores...</p>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted border-b border-line">
                    <th className="py-2.5">Razón Social / Proveedor</th>
                    <th className="py-2.5">Insumo Principal</th>
                    <th className="py-2.5">Contacto</th>
                    <th className="py-2.5">Teléfono / WhatsApp</th>
                    <th className="py-2.5">CI / NIT</th>
                    <th className="py-2.5 text-center">Estado</th>
                    <th className="py-2.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((s: any) => (
                    <tr key={s.id} className="border-b border-line/60 hover:bg-page/60">
                      <td className="py-2.5 font-medium">
                        <div>{s.name}</div>
                        {s.address && (
                          <span className="text-xs text-muted flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-muted" /> {s.address}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <span className="badge bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
                          {s.category || 'GENERAL'}
                        </span>
                      </td>
                      <td className="py-2.5">{s.contact || '-'}</td>
                      <td className="py-2.5 text-muted">
                        {s.phone ? (
                          <a
                            href={`https://wa.me/591${s.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {s.phone}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-2.5 text-muted">{s.nit || '-'}</td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`badge text-xs ${
                            s.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                          }`}
                        >
                          {s.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        {canManage && (
                          <button
                            className="text-secondary font-medium hover:underline text-xs"
                            onClick={() => {
                              setEditingSupplier(s);
                              setShowSupplierModal(true);
                            }}
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredSuppliers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted">
                        No se encontraron proveedores registrados con estos filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: COTIZACIONES Y PROFORMAS */}
      {/* ============================================================== */}
      {tab === 'quotations' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Cotizaciones y Proformas</h1>
              <p className="text-sm text-muted">
                Emisión de cotizaciones formales para hoteles, distribuidores y licitaciones
              </p>
            </div>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => setShowNewQuoteModal(true)}
            >
              <Plus className="w-4 h-4" />
              Nueva Cotización
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted" />
              <input
                className="input pl-9"
                placeholder="Buscar por código (COT-...) o cliente..."
                value={quoteSearch}
                onChange={(e) => setQuoteSearch(e.target.value)}
              />
            </div>

            <select
              className="input max-w-xs"
              value={quoteStatus}
              onChange={(e) => setQuoteStatus(e.target.value)}
            >
              <option value="">Todos los Estados</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="APROBADA">Aprobadas</option>
              <option value="RECHAZADA">Rechazadas</option>
              <option value="CONVERTIDA_A_VENTA">Convertidas a Venta</option>
            </select>
          </div>

          {loadingQuotations ? (
            <p className="text-muted">Cargando cotizaciones...</p>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted border-b border-line">
                    <th className="py-2.5">Código</th>
                    <th className="py-2.5">Cliente / Institución</th>
                    <th className="py-2.5">Fecha y Validez</th>
                    <th className="py-2.5 text-center">Ítems</th>
                    <th className="py-2.5 text-right">Total Ofertado</th>
                    <th className="py-2.5 text-center">Estado</th>
                    <th className="py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q: any) => {
                    const daysLeft = Math.ceil(
                      (new Date(q.createdAt).getTime() + q.validDays * 86400000 - Date.now()) / 86400000
                    );
                    const isExpired = daysLeft < 0;

                    return (
                      <tr key={q.id} className="border-b border-line/60 hover:bg-page/60">
                        <td className="py-2.5 font-mono font-bold text-primary">{q.code}</td>
                        <td className="py-2.5">
                          <div className="font-semibold">{q.clientName}</div>
                          {q.clientCi && <span className="text-xs text-muted">CI/NIT: {q.clientCi}</span>}
                        </td>
                        <td className="py-2.5 text-xs text-muted">
                          <div>{new Date(q.createdAt).toLocaleDateString('es-BO')}</div>
                          <span
                            className={`inline-block mt-0.5 font-medium ${
                              isExpired ? 'text-danger' : 'text-emerald-700'
                            }`}
                          >
                            {isExpired ? 'Oferta vencida' : `Vence en ${daysLeft} días`}
                          </span>
                        </td>
                        <td className="py-2.5 text-center">
                          <span className="badge bg-page font-medium">
                            {q.items?.reduce((sum: number, it: any) => sum + it.quantity, 0) || 0} unid.
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-bold text-ink">
                          Bs {q.total.toFixed(2)}
                        </td>
                        <td className="py-2.5 text-center">
                          <span
                            className={`badge text-xs font-semibold ${
                              q.status === 'APROBADA'
                                ? 'bg-emerald-100 text-emerald-800'
                                : q.status === 'CONVERTIDA_A_VENTA'
                                ? 'bg-blue-100 text-blue-800'
                                : q.status === 'RECHAZADA'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {q.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right space-x-1.5">
                          <button
                            title="Ver e Imprimir Proforma"
                            className="btn-secondary px-2.5 py-1 text-xs inline-flex items-center gap-1"
                            onClick={() => setViewingQuote(q)}
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Proforma
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {quotations.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted">
                        No se han registrado cotizaciones todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: HISTORIAL DE COMPRAS DE CLIENTE */}
      {/* ============================================================== */}
      {selectedClientForHistory !== null && (
        <ClientHistoryModal
          id={selectedClientForHistory}
          onClose={() => setSelectedClientForHistory(null)}
        />
      )}

      {/* ============================================================== */}
      {/* MODAL: CREAR / EDITAR CLIENTE */}
      {/* ============================================================== */}
      {showClientModal && (
        <ClientEditModal
          item={editingClient}
          onClose={() => {
            setShowClientModal(false);
            setEditingClient(null);
          }}
        />
      )}

      {/* ============================================================== */}
      {/* MODAL: CREAR / EDITAR PROVEEDOR */}
      {/* ============================================================== */}
      {showSupplierModal && (
        <SupplierEditModal
          item={editingSupplier}
          onClose={() => {
            setShowSupplierModal(false);
            setEditingSupplier(null);
          }}
        />
      )}

      {/* ============================================================== */}
      {/* MODAL: NUEVA COTIZACIÓN */}
      {/* ============================================================== */}
      {showNewQuoteModal && (
        <NewQuotationModal onClose={() => setShowNewQuoteModal(false)} />
      )}

      {/* ============================================================== */}
      {/* MODAL: VER / IMPRIMIR / COMPARTIR PROFORMA */}
      {/* ============================================================== */}
      {viewingQuote && (
        <QuotationViewModal
          quotation={viewingQuote}
          onClose={() => setViewingQuote(null)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// MODAL: HISTORIAL DE COMPRAS
// ----------------------------------------------------------------------
function ClientHistoryModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: client, isLoading, isError } = useQuery({
    queryKey: ['clients', id, 'history'],
    queryFn: async () => (await api.get(`/clients/${id}`)).data,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto" aria-label="Historial del cliente">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Historial de Compras y Garantías</h2>
            {client && (
              <p className="text-sm text-muted">
                {client.fullName} · CI: <span className="font-semibold text-ink">{client.ci}</span> · Tel: {client.phone || 'S/N'}
              </p>
            )}
          </div>
          <button type="button" className="btn-tertiary" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {isLoading && <p className="text-muted">Cargando historial…</p>}
        {isError && <p role="alert" className="text-danger">No se pudo cargar el historial del cliente.</p>}

        {client && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 bg-page p-3 rounded-lg text-sm">
              <div>
                <span className="text-xs text-muted block">Total Ventas Registradas</span>
                <span className="text-lg font-bold text-primary">{client.sales?.length || 0}</span>
              </div>
              <div>
                <span className="text-xs text-muted block">Monto Total Invertido</span>
                <span className="text-lg font-bold text-emerald-600">
                  Bs {(client.sales?.reduce((s: number, v: any) => s + (v.total || 0), 0) || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted block">Saldo Pendiente Global</span>
                <span className="text-lg font-bold text-amber-600">
                  Bs {(client.sales?.reduce((s: number, v: any) => s + (v.pendingBalance || 0), 0) || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="py-2">Fecha</th>
                    <th className="py-2">Código Venta</th>
                    <th className="py-2">Tipo / Pago</th>
                    <th className="py-2">Estado Entrega</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(client.sales ?? []).map((sale: any) => (
                    <tr key={sale.id} className="border-b border-line/60">
                      <td className="py-2 text-xs">{new Date(sale.createdAt).toLocaleString('es-BO')}</td>
                      <td className="py-2 font-mono font-bold text-primary">{sale.code}</td>
                      <td className="py-2 text-xs">
                        <span className="badge bg-page">{sale.paymentType || 'CONTADO'}</span>
                      </td>
                      <td className="py-2 text-xs">
                        <span
                          className={`badge ${
                            sale.deliveryStatus === 'ENTREGADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {sale.deliveryStatus || 'ENTREGADO'}
                        </span>
                      </td>
                      <td className="py-2 text-right font-bold">Bs {sale.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(client.sales ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-muted">
                        No hay compras registradas para este cliente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------
// MODAL: CREAR / EDITAR CLIENTE
// ----------------------------------------------------------------------
function ClientEditModal({ item, onClose }: { item?: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEditing = !!item;
  const [ci, setCi] = useState(item?.ci || '');
  const [fullName, setFullName] = useState(item?.fullName || '');
  const [phone, setPhone] = useState(item?.phone || '');

  const mut = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditing) return api.patch(`/clients/${item.id}`, payload);
      return api.post('/clients', payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Cliente actualizado' : 'Cliente registrado');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar cliente');
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate({ ci, fullName, phone });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-card shadow-card p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Cédula de Identidad (CI)</label>
            <input
              required
              type="text"
              className="input"
              value={ci}
              onChange={(e) => setCi(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Nombre Completo</label>
            <input
              required
              type="text"
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Teléfono o WhatsApp (Opcional)</label>
            <input
              type="text"
              className="input"
              placeholder="Ej. 70012345"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" className="btn-tertiary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={mut.isPending}>
              {mut.isPending ? 'Guardando...' : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MODAL: CREAR / EDITAR PROVEEDOR
// ----------------------------------------------------------------------
function SupplierEditModal({ item, onClose }: { item?: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEditing = !!item;

  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState(item?.category || 'ESPUMAS');
  const [contact, setContact] = useState(item?.contact || '');
  const [phone, setPhone] = useState(item?.phone || '');
  const [email, setEmail] = useState(item?.email || '');
  const [address, setAddress] = useState(item?.address || '');
  const [nit, setNit] = useState(item?.nit || '');
  const [isActive, setIsActive] = useState(item ? item.isActive : true);

  const mut = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditing) return api.patch(`/third-parties/${item.id}`, payload);
      return api.post('/third-parties', payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Proveedor actualizado' : 'Proveedor creado');
      queryClient.invalidateQueries({ queryKey: ['third-parties'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al guardar proveedor');
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate({
      name,
      type: 'PROVEEDOR',
      category,
      contact,
      phone,
      email,
      address,
      nit,
      ...(isEditing ? { isActive } : {}),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-card shadow-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {isEditing ? 'Editar Proveedor de Insumo' : 'Nuevo Proveedor de Materia Prima'}
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Razón Social / Empresa</label>
            <input
              required
              type="text"
              placeholder="Ej. Espumas Poliflex S.R.L."
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de Materia Prima</label>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="ESPUMAS">Espumas Poliuretano</option>
                <option value="TELAS">Telas Jackard & Punto</option>
                <option value="RESORTES">Estructuras de Resortes</option>
                <option value="MADERA">Madera & Tableros</option>
                <option value="ADHESIVOS">Adhesivos & Químicos</option>
                <option value="ACCESORIOS">Hilos, Cintas y Embalaje</option>
                <option value="LOGISTICA">Transporte & Logística</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div>
              <label className="label">CI / NIT (Opcional)</label>
              <input
                type="text"
                placeholder="Ej. 10283746 o NIT"
                className="input"
                value={nit}
                onChange={(e) => setNit(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Persona de Contacto</label>
              <input
                type="text"
                placeholder="Ej. Lic. Carlos Méndez"
                className="input"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Teléfono o Celular</label>
              <input
                type="text"
                placeholder="Ej. 75012345"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Correo Electrónico (Opcional)</label>
            <input
              type="email"
              placeholder="ventas@proveedor.com"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Dirección o Ubicación del Depósito</label>
            <input
              type="text"
              placeholder="Ej. Parque Industrial Mz. 12, Santa Cruz"
              className="input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {isEditing && (
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="supplier-active"
                className="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <label htmlFor="supplier-active" className="text-sm font-medium">
                Proveedor Activo en el Sistema
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button type="button" className="btn-tertiary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={mut.isPending}>
              {mut.isPending ? 'Guardando...' : 'Guardar Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MODAL: NUEVA COTIZACIÓN / PROFORMA COMERCIAL
// ----------------------------------------------------------------------
function NewQuotationModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();

  const [clientName, setClientName] = useState('');
  const [clientCi, setClientCi] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [validDays, setValidDays] = useState(15);
  const [notes, setNotes] = useState('Condiciones: Pago 50% anticipo y 50% contra entrega. Incluye transporte en radio urbano.');

  interface QuoteItem {
    variantId: number;
    name: string;
    size: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }

  const [items, setItems] = useState<QuoteItem[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  // Cargar catálogo de productos y variantes
  const { data: products = [] } = useQuery({
    queryKey: ['catalog', 'products'],
    queryFn: async () => (await api.get('/catalog/products')).data,
  });

  // Lista aplanada de todas las variantes disponibles
  const allVariants = useMemo(() => {
    const list: any[] = [];
    for (const p of products) {
      for (const v of p.variants || []) {
        list.push({
          ...v,
          productName: p.name,
          categoryName: p.category?.name,
        });
      }
    }
    return list;
  }, [products]);

  const handleAddVariant = () => {
    if (!selectedVariantId) return;
    const variant = allVariants.find((v) => v.id === Number(selectedVariantId));
    if (!variant) return;

    // Verificar si ya existe en la lista
    const existingIndex = items.findIndex((it) => it.variantId === variant.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].subtotal = updated[existingIndex].quantity * updated[existingIndex].unitPrice;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          variantId: variant.id,
          name: variant.productName,
          size: variant.size,
          quantity: 1,
          unitPrice: variant.price,
          subtotal: variant.price,
        },
      ]);
    }
    setSelectedVariantId('');
  };

  const handleUpdateItem = (index: number, field: 'quantity' | 'unitPrice', val: number) => {
    const updated = [...items];
    updated[index][field] = val;
    updated[index].subtotal = Math.round(updated[index].quantity * updated[index].unitPrice * 100) / 100;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const grandTotal = items.reduce((sum, it) => sum + it.subtotal, 0);

  const mutCreateQuote = useMutation({
    mutationFn: async (payload: any) => (await api.post('/quotations', payload)).data,
    onSuccess: () => {
      toast.success('Cotización generada correctamente');
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al crear cotización');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      return toast.error('Debe agregar al menos un colchón o producto a la cotización.');
    }
    mutCreateQuote.mutate({
      clientName,
      clientCi,
      clientPhone,
      clientEmail,
      validDays: Number(validDays),
      notes,
      items: items.map((it) => ({
        variantId: it.variantId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-card shadow-card p-6 w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          Nueva Cotización / Proforma Comercial
        </h2>
        <p className="text-xs text-muted mb-4">
          Genere una propuesta económica oficial con precios por volumen para clientes o licitaciones.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-page p-3 rounded-xl border border-line/60">
            <div>
              <label className="label text-xs">Nombre del Cliente o Empresa *</label>
              <input
                required
                type="text"
                placeholder="Ej. Hotel Camino Real / Juan Pérez"
                className="input text-sm"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">CI o NIT (Opcional)</label>
              <input
                type="text"
                placeholder="Ej. 10238475023"
                className="input text-sm"
                value={clientCi}
                onChange={(e) => setClientCi(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Teléfono / WhatsApp</label>
              <input
                type="text"
                placeholder="Ej. 77012345"
                className="input text-sm"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs">Validez de la Oferta (Días)</label>
              <input
                required
                type="number"
                min="1"
                className="input text-sm"
                value={validDays}
                onChange={(e) => setValidDays(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Selector de Productos */}
          <div className="space-y-2">
            <label className="label text-xs font-bold text-ink">Agregar Colchón o Producto</label>
            <div className="flex gap-2">
              <select
                className="input flex-1 text-sm"
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
              >
                <option value="">Seleccione un modelo y medida...</option>
                {allVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.productName} · {v.size} {v.type ? `(${v.type})` : ''} — Precio lista: Bs {v.price}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary text-xs flex items-center gap-1"
                onClick={handleAddVariant}
                disabled={!selectedVariantId}
              >
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>
          </div>

          {/* Tabla de ítems con precio ajustable */}
          <div className="border border-line rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-page border-b border-line text-muted">
                <tr>
                  <th className="py-2 px-3 text-left">Modelo & Medida</th>
                  <th className="py-2 px-3 text-center w-20">Cant.</th>
                  <th className="py-2 px-3 text-right w-32">Precio Unit. (Bs)</th>
                  <th className="py-2 px-3 text-right w-28">Subtotal (Bs)</th>
                  <th className="py-2 px-2 text-center w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className="border-b border-line/60">
                    <td className="py-2 px-3 font-medium">
                      <div>{it.name}</div>
                      <span className="text-muted text-[11px]">{it.size}</span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min="1"
                        className="input text-xs py-1 px-1.5 text-center w-16"
                        value={it.quantity}
                        onChange={(e) => handleUpdateItem(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="input text-xs py-1 px-1.5 text-right w-24"
                        value={it.unitPrice}
                        onChange={(e) => handleUpdateItem(idx, 'unitPrice', Math.max(0, Number(e.target.value)))}
                      />
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-ink">
                      Bs {it.subtotal.toFixed(2)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-danger hover:text-danger/80 font-bold text-sm"
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted">
                      No hay productos agregados a la cotización aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center bg-primary/5 p-3 rounded-xl border border-primary/20">
            <span className="font-semibold text-ink text-sm">TOTAL OFERTADO:</span>
            <span className="text-xl font-bold text-primary">Bs {grandTotal.toFixed(2)}</span>
          </div>

          <div>
            <label className="label text-xs">Observaciones y Condiciones Comerciales</label>
            <textarea
              rows={2}
              className="input text-xs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-tertiary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={mutCreateQuote.isPending}
            >
              <CheckCircle className="w-4 h-4" />
              {mutCreateQuote.isPending ? 'Guardando...' : 'Crear Cotización'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MODAL: VISTA E IMPRESIÓN DE PROFORMA (FORMATO A4 / TICKET / WHATSAPP)
// ----------------------------------------------------------------------
function QuotationViewModal({ quotation, onClose }: { quotation: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutStatus = useMutation({
    mutationFn: async (status: string) =>
      (await api.patch(`/quotations/${quotation.id}/status`, { status })).data,
    onSuccess: (updated) => {
      toast.success(`Estado actualizado a: ${updated.status}`);
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    if (!quotation.clientPhone) {
      return toast.error('La cotización no tiene un número de teléfono registrado.');
    }

    const itemsSummary = quotation.items
      ?.map(
        (it: any) =>
          `• ${it.quantity}x ${it.variant?.product?.name || 'Colchón'} (${it.variant?.size || ''}) a Bs ${it.unitPrice.toFixed(2)}`
      )
      .join('\n');

    const msg = encodeURIComponent(
      `Estimado(a) *${quotation.clientName}*,\n` +
        `Le saludamos de *Colchones 25 de Mayo*.\n\n` +
        `Adjuntamos el resumen de su *Cotización ${quotation.code}*:\n` +
        `${itemsSummary}\n\n` +
        `*TOTAL OFERTADO: Bs ${quotation.total.toFixed(2)}*\n` +
        `Validez de la oferta: *${quotation.validDays} días*.\n\n` +
        `Para confirmar su pedido o consultar opciones de pago, responda a este mensaje.\n¡Gracias por su preferencia!`
    );

    const cleanPhone = quotation.clientPhone.replace(/\D/g, '');
    window.open(`https://wa.me/591${cleanPhone}?text=${msg}`, '_blank');
  };

  const handleConvertToSale = () => {
    mutStatus.mutate('CONVERTIDA_A_VENTA');
    navigate('/ventas/nueva');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-card shadow-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        {/* Barra superior de acciones */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-line print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-lg text-primary">{quotation.code}</span>
            <span className="badge text-xs bg-page font-bold">{quotation.status}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleWhatsApp}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              WhatsApp
            </button>
            <button
              onClick={handlePrint}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button onClick={onClose} className="btn-tertiary text-xs">
              Cerrar
            </button>
          </div>
        </div>

        {/* CONTENIDO IMPRIMIBLE DE LA PROFORMA */}
        <div className="space-y-4 print:p-0">
          {/* Encabezado Institucional */}
          <div className="text-center pb-3 border-b-2 border-primary/30">
            <h1 className="text-xl font-black tracking-wide text-ink uppercase">
              Colchones 25 de Mayo
            </h1>
            <p className="text-xs text-muted">Fábrica de Colchones, Somieres y Espumas de Alta Densidad</p>
            <div className="mt-2 inline-block px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-full uppercase tracking-wider">
              Cotización y Proforma Comercial
            </div>
          </div>

          {/* Datos del Cliente y Emisión */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-page/70 p-3 rounded-lg border border-line/60">
            <div>
              <span className="text-muted block">Cliente / Razón Social:</span>
              <strong className="text-ink text-sm">{quotation.clientName}</strong>
              {quotation.clientCi && (
                <div className="text-muted">CI / NIT: {quotation.clientCi}</div>
              )}
            </div>
            <div className="text-right">
              <span className="text-muted block">Fecha de Emisión:</span>
              <strong>{new Date(quotation.createdAt).toLocaleDateString('es-BO')}</strong>
              <div className="text-muted">
                Validez: <strong>{quotation.validDays} días calendario</strong>
              </div>
            </div>
          </div>

          {/* Tabla de Productos Cotizados */}
          <table className="w-full text-xs border border-line rounded-lg overflow-hidden">
            <thead className="bg-page border-b border-line text-muted">
              <tr>
                <th className="py-2 px-3 text-left">Cant.</th>
                <th className="py-2 px-3 text-left">Descripción del Modelo</th>
                <th className="py-2 px-3 text-right">P. Unitario</th>
                <th className="py-2 px-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items?.map((it: any, i: number) => (
                <tr key={i} className="border-b border-line/60">
                  <td className="py-2 px-3 font-bold text-center w-12">{it.quantity}</td>
                  <td className="py-2 px-3">
                    <div className="font-semibold text-ink">
                      {it.variant?.product?.name || 'Colchón a Medida'}
                    </div>
                    <span className="text-muted text-[11px]">
                      Medida: {it.variant?.size || 'Estándar'} {it.variant?.type ? `· ${it.variant.type}` : ''}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-medium">Bs {it.unitPrice.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right font-bold text-ink">
                    Bs {it.subtotal.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="flex justify-between items-center bg-primary/10 p-3.5 rounded-lg border border-primary/20">
            <span className="font-bold text-sm text-ink">MONTO TOTAL OFERTADO:</span>
            <span className="text-2xl font-black text-primary">
              Bs {quotation.total.toFixed(2)}
            </span>
          </div>

          {/* Notas y Condiciones */}
          {quotation.notes && (
            <div className="text-xs bg-page p-3 rounded-lg border border-line/60">
              <span className="font-bold block text-ink mb-1">Condiciones y Observaciones:</span>
              <p className="text-muted whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          )}

          {/* Firmas al pie */}
          <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs text-muted">
            <div className="border-t border-line pt-2">
              <p className="font-semibold text-ink">Colchones 25 de Mayo</p>
              <p>Firma y Sello Comercial</p>
            </div>
            <div className="border-t border-line pt-2">
              <p className="font-semibold text-ink">{quotation.clientName}</p>
              <p>Conforme / Aceptación del Cliente</p>
            </div>
          </div>
        </div>

        {/* Acciones inferiores de flujo comercial */}
        <div className="mt-6 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Cambiar estado:</span>
            <select
              className="input text-xs py-1"
              value={quotation.status}
              onChange={(e) => mutStatus.mutate(e.target.value)}
            >
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="APROBADA">APROBADA</option>
              <option value="RECHAZADA">RECHAZADA</option>
              <option value="CONVERTIDA_A_VENTA">CONVERTIDA A VENTA</option>
            </select>
          </div>

          {quotation.status !== 'CONVERTIDA_A_VENTA' && (
            <button
              onClick={handleConvertToSale}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4" />
              Convertir a Venta Oficial
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
