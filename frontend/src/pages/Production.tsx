import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { 
  Factory, Plus, Search, Clock, CheckCircle2, AlertTriangle, 
  ArrowRight, User, MapPin, Calendar, X, Sparkles, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';

export function ProductionPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);

  const canManage = ['ADMIN_GENERAL', 'ADMIN', 'ENCARGADO_FABRICA'].includes(user?.role || '');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['production', search, statusFilter, priorityFilter],
    queryFn: async () => (
      await api.get('/production', {
        params: {
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
        },
      })
    ).data,
  });

  const mutStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return (await api.patch(`/production/${id}/status`, { status })).data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['production'] });
      toast.success(`Orden actualizada a ${variables.status}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Error al actualizar estado');
    },
  });

  // Métricas rápidas
  const counts = {
    pending: orders.filter((o: any) => o.status === 'PENDIENTE').length,
    inProgress: orders.filter((o: any) => o.status === 'EN_PROCESO').length,
    completed: orders.filter((o: any) => o.status === 'TERMINADO').length,
    urgent: orders.filter((o: any) => o.priority === 'URGENTE' && o.status !== 'TERMINADO').length,
  };

  const priorityColors: Record<string, string> = {
    URGENTE: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-300',
    ALTA: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-300',
    NORMAL: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-secondary border-blue-300',
    BAJA: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300',
  };

  const statusBadges: Record<string, { label: string; color: string; icon: any }> = {
    PENDIENTE: { label: 'En Cola / Pendiente', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300', icon: Clock },
    EN_PROCESO: { label: 'En Fabricación', color: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300', icon: Factory },
    TERMINADO: { label: 'Terminado / Listo', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300', icon: CheckCircle2 },
    CANCELADO: { label: 'Cancelado', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: X },
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Factory className="text-primary w-7 h-7" />
            Órdenes de Fabricación y Producción
          </h1>
          <p className="text-sm text-muted">
            Control de confección de colchones a pedido y reposición de planta.
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="btn-primary flex items-center justify-center gap-1.5"
        >
          <Plus size={18} /> Nueva Orden
        </button>
      </div>

      {/* Tarjetas de Métricas de Fábrica */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card border-l-4 border-l-amber-500 bg-page/40 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Clock size={14} className="text-amber-500" /> En Cola / Espera
          </span>
          <p className="mt-1 text-2xl font-bold text-ink">{counts.pending}</p>
          <p className="text-xs text-muted">Pendientes de corte y armado</p>
        </div>

        <div className="card border-l-4 border-l-sky-500 bg-sky-50/20 dark:bg-sky-950/10 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
            <Factory size={14} className="text-sky-500" /> En Producción
          </span>
          <p className="mt-1 text-2xl font-bold text-sky-600 dark:text-sky-400">{counts.inProgress}</p>
          <p className="text-xs text-muted">En costura y tapizado</p>
        </div>

        <div className="card border-l-4 border-l-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-emerald-500" /> Terminados
          </span>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{counts.completed}</p>
          <p className="text-xs text-muted">Listos para entrega a sucursales</p>
        </div>

        <div className="card border-l-4 border-l-red-500 bg-red-50/20 dark:bg-red-950/10 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-300 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-red-500" /> Urgentes
          </span>
          <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{counts.urgent}</p>
          <p className="text-xs text-muted">Prioridad urgente sin terminar</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center gap-3 bg-page/50 p-3 rounded-xl border border-line">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input
            type="text"
            className="input pl-9 w-full text-sm"
            placeholder="Buscar por código OF, modelo, cliente o notas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input text-sm w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="EN_PROCESO">En Proceso</option>
          <option value="TERMINADO">Terminados</option>
          <option value="CANCELADO">Cancelados</option>
        </select>

        <select
          className="input text-sm w-auto"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="">Todas las prioridades</option>
          <option value="URGENTE">Urgente</option>
          <option value="ALTA">Alta</option>
          <option value="NORMAL">Normal</option>
          <option value="BAJA">Baja</option>
        </select>
      </div>

      {/* Listado de Órdenes */}
      {isLoading ? (
        <div className="py-12 text-center text-muted">Cargando órdenes de producción...</div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12 space-y-2">
          <Factory className="w-12 h-12 text-muted mx-auto opacity-40" />
          <h3 className="font-bold text-ink">No hay órdenes de fabricación registradas</h3>
          <p className="text-sm text-muted">
            Crea una nueva orden desde el botón superior o genera una venta con anticipo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((order: any) => {
            const statusConfig = statusBadges[order.status] || statusBadges.PENDIENTE;
            const StatusIcon = statusConfig.icon;
            const isCompleted = order.status === 'TERMINADO';
            const isCanceled = order.status === 'CANCELADO';

            return (
              <div
                key={order.id}
                className="card p-4 flex flex-col justify-between border border-line hover:shadow-md transition-shadow relative overflow-hidden"
              >
                {/* Cabecera de la tarjeta */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono font-bold text-base text-primary">{order.code}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityColors[order.priority] || priorityColors.NORMAL}`}>
                        {order.priority}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${statusConfig.color}`}>
                        <StatusIcon size={12} />
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Datos del Producto a Fabricar */}
                  <div className="bg-page/70 p-3 rounded-lg border border-line/60 mb-3 space-y-1">
                    <h4 className="font-bold text-ink text-sm">
                      {order.variant?.product?.name}
                    </h4>
                    <p className="text-xs text-muted">
                      {order.variant?.size} {order.variant?.color ? `· ${order.variant?.color}` : ''}
                    </p>
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-line/50 font-medium">
                      <span className="text-muted">Cantidad a fabricar:</span>
                      <span className="font-bold text-ink text-sm">{order.quantity} un.</span>
                    </div>
                  </div>

                  {/* Notas o especificaciones personalizadas */}
                  {order.customNotes && (
                    <div className="mb-3 text-xs bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200/50 text-amber-900 dark:text-amber-200">
                      <strong>Especificación:</strong> {order.customNotes}
                    </div>
                  )}

                  {/* Datos de origen y destino */}
                  <div className="space-y-1 text-xs text-muted mb-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={13} className="shrink-0" />
                      <span>Destino: <strong>{order.branch?.name || 'Stock Fábrica'}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User size={13} className="shrink-0" />
                      <span>Solicitado por: {order.requestedBy?.fullName}</span>
                    </div>
                    {order.targetDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="shrink-0 text-amber-500" />
                        <span>Entrega límite: <strong>{new Date(order.targetDate).toLocaleDateString('es-BO')}</strong></span>
                      </div>
                    )}
                    {order.sale && (
                      <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 py-1 px-2 rounded mt-1">
                        Pedido de cliente: {order.sale.client?.fullName} (Venta: {order.sale.code})
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones de Flujo de Trabajo (Fábrica / Administrador) */}
                {canManage && !isCompleted && !isCanceled && (
                  <div className="pt-3 border-t border-line flex items-center justify-between gap-2 mt-auto">
                    {order.status === 'PENDIENTE' && (
                      <button
                        onClick={() => mutStatus.mutate({ id: order.id, status: 'EN_PROCESO' })}
                        disabled={mutStatus.isPending}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 w-full justify-center text-sky-700 border-sky-300 hover:bg-sky-50"
                      >
                        <Factory size={14} /> Iniciar Producción →
                      </button>
                    )}

                    {order.status === 'EN_PROCESO' && (
                      <button
                        onClick={() => mutStatus.mutate({ id: order.id, status: 'TERMINADO' })}
                        disabled={mutStatus.isPending}
                        className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-xs py-1.5 px-3 flex items-center gap-1 w-full justify-center"
                      >
                        <CheckCircle2 size={14} /> Marcar Terminado ✓
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nueva Orden de Fabricación */}
      {showNewModal && <NewProductionOrderModal onClose={() => setShowNewModal(false)} />}
    </div>
  );
}

// ========== MODAL NUEVA ORDEN DE FABRICACIÓN ==========
function NewProductionOrderModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [branchId, setBranchId] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [targetDate, setTargetDate] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => (await api.get('/catalog/products')).data,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/locations/branches')).data,
  });

  const allVariants = products.flatMap((p: any) =>
    (p.variants ?? []).map((v: any) => ({
      ...v,
      productName: p.name,
    }))
  );

  const createMut = useMutation({
    mutationFn: async () => {
      if (!variantId) throw new Error('Selecciona un modelo y medida.');
      return (await api.post('/production', {
        variantId: Number(variantId),
        quantity: Number(quantity),
        branchId: branchId ? Number(branchId) : undefined,
        priority,
        targetDate: targetDate || undefined,
        customNotes: customNotes.trim() || undefined,
      })).data;
    },
    onSuccess: () => {
      toast.success('Orden de fabricación enviada al taller correctamente.');
      queryClient.invalidateQueries({ queryKey: ['production'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.message || 'Error al crear orden'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-card shadow-card w-full max-w-lg my-8 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Factory className="text-primary w-5 h-5" /> Nueva Orden de Fabricación
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-page rounded-full text-muted"><X size={20} /></button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="p-5 space-y-4">
          <div>
            <label className="label">Colchón / Producto a Fabricar *</label>
            <select
              required
              className="input w-full"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            >
              <option value="">Selecciona modelo y medida...</option>
              {allVariants.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.productName} — {v.size} {v.color ? `· ${v.color}` : ''} ({v.sku})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Cantidad *</label>
              <input
                required
                type="number"
                min="1"
                className="input w-full"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div>
              <label className="label">Prioridad *</label>
              <select className="input w-full" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="BAJA">Baja</option>
                <option value="NORMAL">Normal</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente 🔥</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Sucursal Destino</label>
              <select className="input w-full" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Fábrica / Stock General</option>
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Fecha Límite Deseada</label>
              <input
                type="date"
                className="input w-full"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Notas y Especificaciones Especiales</label>
            <textarea
              className="input w-full"
              rows={3}
              placeholder="Ej. Espuma D-30 firme, tela jackard acolchada, ribete plateado..."
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-line">
            <button type="button" className="btn-tertiary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={createMut.isPending || !variantId}>
              {createMut.isPending ? 'Enviando...' : 'Crear Orden de Fabricación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
