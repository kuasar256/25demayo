import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { StatusBadge } from '../components/StatusBadge';
import { Link, useSearchParams } from 'react-router-dom';
import { PaginationControls } from '../components/PaginationControls';
import { SaleTicketModal, SaleTicketData } from '../components/SaleTicketModal';
import { Printer, ShoppingCart, Wallet, ShieldCheck, Factory } from 'lucide-react';
import { CashRegisterPage } from './CashRegister';
import { WarrantyPage } from './Warranty';
import { ProductionPage } from './Production';

export function SalesPage() {
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'ventas';

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [hasPendingBalance, setHasPendingBalance] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: saleResults, isLoading, isError } = useQuery({
    queryKey: ['sales', search, status, deliveryStatus, hasPendingBalance, page, pageSize],
    queryFn: async () => (
      await api.get('/sales', {
        params: {
          search,
          status: status || undefined,
          deliveryStatus: deliveryStatus || undefined,
          hasPendingBalance: hasPendingBalance ? 'true' : undefined,
          page,
          pageSize,
        },
      })
    ).data,
    enabled: activeTab === 'ventas',
  });
  const sales = saleResults?.items ?? [];

  const canSell = ['VENDEDOR', 'ENCARGADO_SUCURSAL', 'ADMIN', 'ADMIN_GENERAL'].includes(user?.role || '');

  return (
    <div className="space-y-4">
      {/* Pestañas Principales del Módulo de Ventas */}
      <div className="flex border-b border-line gap-2 overflow-x-auto pb-px">
        <button
          onClick={() => setTab('ventas')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 ${
            activeTab === 'ventas'
              ? 'border-primary text-primary bg-primary/5 font-semibold'
              : 'border-transparent text-muted hover:text-text hover:bg-page/50'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Ventas y Pedidos</span>
        </button>

        <button
          onClick={() => setTab('caja')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 ${
            activeTab === 'caja'
              ? 'border-primary text-primary bg-primary/5 font-semibold'
              : 'border-transparent text-muted hover:text-text hover:bg-page/50'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Caja y Arqueo Diario</span>
        </button>

        <button
          onClick={() => setTab('garantias')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 ${
            activeTab === 'garantias'
              ? 'border-primary text-primary bg-primary/5 font-semibold'
              : 'border-transparent text-muted hover:text-text hover:bg-page/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Garantías y Post-Venta</span>
        </button>

        <button
          onClick={() => setTab('produccion')}
          className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm rounded-t-lg transition-colors border-b-2 ${
            activeTab === 'produccion'
              ? 'border-primary text-primary bg-primary/5 font-semibold'
              : 'border-transparent text-muted hover:text-text hover:bg-page/50'
          }`}
        >
          <Factory className="w-4 h-4" />
          <span>Pedidos a Fábrica / Taller</span>
        </button>
      </div>

      {activeTab === 'caja' && <CashRegisterPage />}
      {activeTab === 'garantias' && <WarrantyPage />}
      {activeTab === 'produccion' && <ProductionPage />}

      {activeTab === 'ventas' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">Historial de Ventas y Pedidos</h1>
            {canSell && (
              <Link to="/ventas/nueva" className="btn-primary inline-block">
                + Nueva Venta
              </Link>
            )}
          </div>


      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input sm:max-w-sm flex-1"
          aria-label="Buscar ventas"
          placeholder="Buscar por código, cliente, CI o vendedor..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className="input sm:max-w-xs"
          aria-label="Filtrar ventas por estado"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVA">Activas</option>
          <option value="ANULADA">Anuladas</option>
        </select>
        <select
          className="input sm:max-w-xs"
          aria-label="Filtrar por entrega"
          value={deliveryStatus}
          onChange={(event) => {
            setDeliveryStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas las entregas</option>
          <option value="ENTREGADO">Entregadas</option>
          <option value="PENDIENTE_ENTREGA">Por Entregar (A medida / Anticipo)</option>
        </select>
        <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer bg-page/70 border border-line py-2 px-3 rounded-lg">
          <input
            type="checkbox"
            checked={hasPendingBalance}
            onChange={(e) => {
              setHasPendingBalance(e.target.checked);
              setPage(1);
            }}
            className="rounded border-line text-primary focus:ring-primary"
          />
          <span>Solo con Saldo Pendiente</span>
        </label>
      </div>

      {isLoading ? <p className="text-muted">Cargando...</p> : isError ? (
        <p className="text-danger" role="alert">No se pudieron cargar las ventas. Intente nuevamente.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-2">Código</th>
                <th className="py-2">Fecha</th>
                <th className="py-2">Cliente</th>
                <th className="py-2">Vendedor</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2 text-center">Estado</th>
                <th className="py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {(sales ?? []).map((s: any) => (
                <tr key={s.id} className="border-b border-line/60 hover:bg-page/60">
                  <td className="py-2 font-medium">{s.code}</td>
                  <td className="py-2">{new Date(s.createdAt).toLocaleString('es-BO')}</td>
                  <td className="py-2">{s.client?.fullName} <span className="text-muted text-xs">({s.client?.ci})</span></td>
                  <td className="py-2">{s.seller?.fullName}</td>
                  <td className="py-2 text-right">
                    <span className="font-bold text-primary">Bs {s.total.toFixed(2)}</span>
                    {s.pendingBalance > 0 && (
                      <span className="block text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        Saldo: Bs {s.pendingBalance.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <StatusBadge status={s.status} />
                      {s.deliveryStatus === 'PENDIENTE_ENTREGA' && s.status === 'ACTIVA' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-secondary">
                          Por Entregar
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 text-right">
                    <button className="text-secondary font-medium hover:underline" onClick={() => setSelectedId(s.id)}>
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr><td colSpan={7} className="py-4 text-center text-muted">No se encontraron ventas.</td></tr>
              )}
            </tbody>
          </table>
          <PaginationControls
            page={saleResults?.page ?? page}
            pageSize={saleResults?.pageSize ?? pageSize}
            total={saleResults?.total ?? 0}
            totalPages={saleResults?.totalPages ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}

        {selectedId && <SaleDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}
      </div>
    )}
  </div>
);
}

// ----------------- MODAL DETALLE / ANULAR -----------------
function SaleDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [showPayBalance, setShowPayBalance] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('EFECTIVO');
  const [payNotes, setPayNotes] = useState('');
  const [markDeliveredCheck, setMarkDeliveredCheck] = useState(true);

  const { data: s, isLoading, isError, refetch } = useQuery({
    queryKey: ['sales', id],
    queryFn: async () => (await api.get(`/sales/${id}`)).data,
  });

  const mutCancel = useMutation({
    mutationFn: async (payload: { reason: string }) => api.post(`/sales/${id}/cancel`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
  });

  const mutPayBalance = useMutation({
    mutationFn: async () => (await api.post(`/sales/${id}/pay-balance`, {
      amount: Number(payAmount || s.pendingBalance),
      paymentMethod: payMethod,
      notes: payNotes,
      markDelivered: markDeliveredCheck,
    })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register'] });
      setShowPayBalance(false);
    },
  });

  const mutDeliver = useMutation({
    mutationFn: async () => (await api.patch(`/sales/${id}/deliver`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });

  if (isLoading) return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><p className="bg-white p-4 rounded">Cargando...</p></div>;
  if (isError || !s) return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="sale-detail-error" className="bg-white rounded-card shadow-card p-6 w-full max-w-md">
        <h2 id="sale-detail-error" className="text-lg font-bold mb-2">Detalle de la venta</h2>
        <p role="alert" className="text-danger mb-4">No se pudo cargar la venta. Comprueba tu conexión y tus permisos e intenta nuevamente.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-tertiary" onClick={onClose}>Cerrar</button>
          <button type="button" className="btn-primary" onClick={() => void refetch()}>Reintentar</button>
        </div>
      </div>
    </div>
  );

  const onCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return alert('Debe especificar un motivo de anulación');
    mutCancel.mutate({ reason });
  };


  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-card shadow-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">Venta {s.code}</h2>
                {s.paymentType === 'ANTICIPO' && (
                  <span className="badge bg-amber-100 text-amber-800 text-xs font-bold">PEDIDO CON ANTICIPO</span>
                )}
              </div>
              <p className="text-muted text-sm">{new Date(s.createdAt).toLocaleString('es-BO')}</p>
            </div>
            <StatusBadge status={s.status} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4 text-sm bg-page p-3 rounded">
            <div><span className="text-muted block">Cliente:</span> {s.client?.fullName} (CI: {s.client?.ci})</div>
            <div><span className="text-muted block">Vendedor / Ubicación:</span> {s.seller?.fullName} ({s.locationType} {s.locationId})</div>
            <div><span className="text-muted block">Método de Pago:</span> <span className="font-semibold text-primary">{s.paymentMethod || 'EFECTIVO'}</span></div>
          </div>

          {/* Estado de Anticipo y Entrega (Fase 3) */}
          {s.paymentType === 'ANTICIPO' && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3.5 mb-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <span className="text-muted text-xs block">Monto Total:</span>
                  <span className="font-bold text-ink">Bs {s.total.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted text-xs block">Anticipo Pagado:</span>
                  <span className="font-bold text-emerald-600">Bs {(s.amountPaid || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted text-xs block">Saldo Pendiente:</span>
                  <span className="font-bold text-amber-600 text-base">Bs {(s.pendingBalance || 0).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted text-xs block">Estado de Entrega:</span>
                  <span className={`badge text-xs font-bold ${s.deliveryStatus === 'ENTREGADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                    {s.deliveryStatus === 'ENTREGADO' ? '✓ Entregado' : '⏳ Por Entregar'}
                  </span>
                </div>
              </div>

              {s.deliveryStatus === 'PENDIENTE_ENTREGA' && s.pendingBalance <= 0 && (
                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between">
                  <span className="text-xs text-muted">El saldo está 100% cancelado. Listo para entregar físicamente.</span>
                  <button
                    onClick={() => mutDeliver.mutate()}
                    disabled={mutDeliver.isPending}
                    className="btn-primary py-1 px-3 text-xs"
                  >
                    {mutDeliver.isPending ? 'Guardando...' : 'Marcar como Entregado'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Formulario de Cobro de Saldo Pendiente */}
          {showPayBalance && s.status === 'ACTIVA' && s.pendingBalance > 0 && (
            <form onSubmit={(e) => { e.preventDefault(); mutPayBalance.mutate(); }} className="bg-page border border-line p-4 rounded-xl mb-4 space-y-3">
              <h3 className="font-bold text-primary text-sm">Registrar Cobro de Saldo Pendiente</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Monto a Cobrar (Bs):</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    max={s.pendingBalance}
                    required
                    defaultValue={s.pendingBalance}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="input w-full font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">Método de Cobro:</label>
                  <select className="input w-full" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="QR">QR Bancario</option>
                    <option value="TARJETA">Tarjeta</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="Notas o referencia de pago (opcional)..."
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="input w-full text-xs"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer text-ink">
                <input
                  type="checkbox"
                  checked={markDeliveredCheck}
                  onChange={(e) => setMarkDeliveredCheck(e.target.checked)}
                  className="rounded border-line text-primary focus:ring-primary"
                />
                <span>Marcar los productos como ENTREGADOS al cliente ahora</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-tertiary" onClick={() => setShowPayBalance(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={mutPayBalance.isPending}>
                  {mutPayBalance.isPending ? 'Registrando...' : 'Confirmar Cobro e Ingresar a Caja'}
                </button>
              </div>
            </form>
          )}

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2">Producto</th>
                <th className="py-2 text-right">Cant.</th>
                <th className="py-2 text-right">Precio Unit.</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {s.items.map((i: any) => (
                <tr key={i.id} className="border-b border-line/60">
                  <td className="py-2">
                    {i.variant.product.name} — {i.variant.size} <br/>
                    <span className="text-xs text-muted">SKU: {i.variant.sku}</span>
                  </td>
                  <td className="py-2 text-right">{i.quantity}</td>
                  <td className="py-2 text-right text-muted">Bs {i.unitPrice.toFixed(2)}</td>
                  <td className="py-2 text-right font-medium">Bs {(i.quantity * i.unitPrice).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-4 text-right font-bold text-lg">Total General:</td>
                <td className="py-4 text-right font-bold text-lg text-primary">Bs {s.total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          {s.status === 'ANULADA' && (
            <div className="bg-danger/10 text-danger p-3 rounded mb-4 text-sm border border-danger/30">
              <strong>Venta Anulada</strong> por {s.canceledBy?.fullName} el {new Date(s.canceledAt).toLocaleString('es-BO')} <br/>
              Motivo: {s.cancelReason}
            </div>
          )}

          {showCancel && s.status === 'ACTIVA' && (
            <form onSubmit={onCancel} className="bg-page border border-line p-4 rounded-lg mb-4">
              <h3 className="font-semibold text-danger mb-2">Anular Venta</h3>
              <p className="text-xs text-muted mb-4">Al anular la venta, el inventario de los productos se restituirá automáticamente a la sucursal.</p>
              <label className="label">Motivo de la anulación (Obligatorio)</label>
              <input required type="text" className="input mb-4" placeholder="Ej. El cliente se arrepintió, error de registro..." value={reason} onChange={(e) => setReason(e.target.value)} />
              
              {mutCancel.isError && <p className="text-danger text-sm mb-4">{(mutCancel.error as any).response?.data?.message || 'Error al anular la venta (Revise si han pasado menos de 24h o sus permisos)'}</p>}
              
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-tertiary" onClick={() => setShowCancel(false)}>Cancelar acción</button>
                <button type="submit" className="btn-primary bg-danger" disabled={mutCancel.isPending}>
                  {mutCancel.isPending ? 'Procesando...' : 'Confirmar Anulación'}
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap justify-between items-center gap-2 mt-6 pt-4 border-t border-line">
            <button className="text-muted hover:text-ink text-sm" onClick={onClose}>Cerrar vista</button>
            
            <div className="flex items-center gap-2">
              {s.status === 'ACTIVA' && s.pendingBalance > 0 && !showPayBalance && (
                <button
                  type="button"
                  onClick={() => setShowPayBalance(true)}
                  className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3 bg-amber-600 hover:bg-amber-700"
                >
                  Cobrar Saldo (Bs {s.pendingBalance.toFixed(2)})
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowTicket(true)}
                className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir / Comprobante
              </button>

              {s.status === 'ACTIVA' && !showCancel && (
                <button className="btn-tertiary text-danger hover:bg-danger/10 text-xs py-2 px-3" onClick={() => setShowCancel(true)}>
                  Anular Venta
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showTicket && (
        <SaleTicketModal
          sale={{
            code: s.code,
            createdAt: s.createdAt,
            clientName: s.client?.fullName,
            clientCi: s.client?.ci,
            clientPhone: s.client?.phone || undefined,
            sellerName: s.seller?.fullName,
            paymentMethod: s.paymentMethod || 'EFECTIVO',
            amountPaid: s.amountPaid,
            changeAmount: s.changeAmount,
            total: s.total,
            items: s.items.map((it: any) => ({
              name: it.variant.product.name,
              size: it.variant.size,
              sku: it.variant.sku,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              subtotal: it.quantity * it.unitPrice,
            })),
          }}
          onClose={() => setShowTicket(false)}
        />
      )}
    </>
  );
}
