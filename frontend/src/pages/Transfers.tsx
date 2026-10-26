import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { StatusBadge } from '../components/StatusBadge';
import { PaginationControls } from '../components/PaginationControls';

export function TransfersPage() {
  const user = useAuthStore((s) => s.user);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: transferResults, isLoading, isError } = useQuery({
    queryKey: ['transfers', search, status, page, pageSize],
    queryFn: async () => (
      await api.get('/transfers', { params: { search, status: status || undefined, page, pageSize } })
    ).data,
  });
  const transfers = transferResults?.items ?? [];
  const { data: currentUser } = useQuery({
    queryKey: ['current-user', user?.id],
    queryFn: async () => (await api.get('/auth/me')).data,
    enabled: Boolean(user?.id && ['VENDEDOR', 'ENCARGADO_SUCURSAL'].includes(user.role)),
  });

  const canCreate = ['ADMIN_GENERAL', 'ADMIN', 'ENCARGADO_FABRICA'].includes(user?.role || '');
  const branchName = currentUser?.branch?.name ?? user?.branchName;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Transferencias</h1>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + Nueva Transferencia
          </button>
        )}
      </div>
      {['VENDEDOR', 'ENCARGADO_SUCURSAL'].includes(user?.role || '') && (
        <div className="card flex flex-wrap items-center gap-2 border border-secondary/20 bg-secondary/5">
          <span className="text-sm text-muted">Tu sucursal asignada:</span>
          <strong className="text-secondary">
            {branchName || (currentUser ? 'Sin sucursal asignada' : 'Cargando sucursal...')}
          </strong>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="input sm:max-w-sm"
          aria-label="Buscar transferencias"
          placeholder="Buscar por código, origen o destino..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          className="input sm:max-w-xs"
          aria-label="Filtrar transferencias por estado"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="ENVIADA">Enviadas</option>
          <option value="RECIBIDA">Recibidas</option>
          <option value="CERRADA">Cerradas</option>
        </select>
      </div>

      {isLoading ? <p className="text-muted">Cargando...</p> : isError ? (
        <p className="text-danger" role="alert">No se pudieron cargar las transferencias. Intente nuevamente.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-2">Código</th>
                <th className="py-2">Fecha</th>
                <th className="py-2">Origen</th>
                <th className="py-2">Destino</th>
                <th className="py-2">Estado</th>
                <th className="py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {(transfers ?? []).map((t: any) => (
                <tr key={t.id} className="border-b border-line/60 hover:bg-page/60">
                  <td className="py-2 font-medium">{t.code}</td>
                  <td className="py-2">{new Date(t.createdAt).toLocaleString('es-BO')}</td>
                  <td className="py-2">{t.sourceWarehouse?.name}</td>
                  <td className="py-2">
                    {t.destinationType === 'SUCURSAL' ? t.destinationBranch?.name : t.thirdParty?.name}
                    <span className="text-xs text-muted ml-1">({t.destinationType})</span>
                  </td>
                  <td className="py-2"><StatusBadge status={t.status} /></td>
                  <td className="py-2 text-right">
                    <button className="text-secondary font-medium hover:underline" onClick={() => setSelectedId(t.id)}>
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
              {transfers.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-muted">No se encontraron transferencias.</td></tr>
              )}
            </tbody>
          </table>
          <PaginationControls
            page={transferResults?.page ?? page}
            pageSize={transferResults?.pageSize ?? pageSize}
            total={transferResults?.total ?? 0}
            totalPages={transferResults?.totalPages ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}

      {showCreate && <CreateTransferModal onClose={() => setShowCreate(false)} />}
      {selectedId && <TransferDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

// ----------------- MODAL CREAR -----------------
function CreateTransferModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [destinationType, setDestinationType] = useState('SUCURSAL');
  const [destinationBranchId, setDestinationBranchId] = useState('');
  const [thirdPartyId, setThirdPartyId] = useState('');
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [formError, setFormError] = useState('');
  const [items, setItems] = useState<{ variantId: number; quantity: number }[]>([]);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [qty, setQty] = useState('1');

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await api.get('/catalog/products')).data });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: async () => (await api.get('/locations/warehouses')).data });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: async () => (await api.get('/locations/branches')).data });
  const { data: thirdParties } = useQuery({
    queryKey: ['third-parties'],
    queryFn: async () => (await api.get('/third-parties')).data,
    enabled: destinationType === 'TERCERO',
  });
  const { data: sourceStock, isLoading: stockLoading } = useQuery({
    queryKey: ['transfer-source-stock', sourceWarehouseId],
    queryFn: async () => (
      await api.get(`/inventory/stock?locationType=BODEGA&locationId=${sourceWarehouseId}`)
    ).data,
    enabled: Boolean(sourceWarehouseId),
  });
  const variants = (products ?? [])
    .filter((product: any) => product.isActive)
    .flatMap((product: any) => product.variants.map((variant: any) => ({ ...variant, productName: product.name })));

  const mut = useMutation({
    mutationFn: async (payload: any) => api.post('/transfers', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      onClose();
    },
  });

  const addItem = () => {
    const variantId = Number(selectedVariant);
    const quantity = Number(qty);
    const alreadyAdded = items.find((item) => item.variantId === variantId)?.quantity ?? 0;
    const available = sourceStock?.find((stockItem: any) => stockItem.variantId === variantId)?.quantity ?? 0;
    if (!sourceWarehouseId || stockLoading || !selectedVariant || !Number.isInteger(quantity) || quantity < 1) {
      setFormError('Seleccione una bodega, una variante y una cantidad entera mayor que cero.');
      return;
    }
    if (alreadyAdded + quantity > available) {
      setFormError(`Stock insuficiente. Disponible para esta variante: ${Math.max(0, available - alreadyAdded)}.`);
      return;
    }
    setFormError('');
    setItems((current) => {
      const existing = current.find((item) => item.variantId === variantId);
      return existing
        ? current.map((item) => item.variantId === variantId
          ? { ...item, quantity: item.quantity + quantity }
          : item)
        : [...current, { variantId, quantity }];
    });
    setSelectedVariant('');
    setQty('1');
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceWarehouseId) return setFormError('Seleccione la bodega de origen.');
    if (items.length === 0) return setFormError('Agregue al menos un producto.');
    if (destinationType === 'SUCURSAL' && !destinationBranchId) {
      return setFormError('Seleccione la sucursal de destino.');
    }
    if (destinationType === 'TERCERO' && !thirdPartyId) {
      return setFormError('Seleccione el tercero o distribuidor de destino.');
    }
    setFormError('');
    
    mut.mutate({
      sourceWarehouseId: Number(sourceWarehouseId),
      destinationType,
      destinationBranchId: destinationType === 'SUCURSAL' ? Number(destinationBranchId) : undefined,
      thirdPartyId: destinationType === 'TERCERO' ? Number(thirdPartyId) : undefined,
      items,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-card shadow-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-1">Nueva Transferencia de Salida</h2>
        <p className="text-sm text-muted mb-4">Los productos saldrán del stock de la Fábrica Central.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Bodega de origen</label>
              <select
                required
                className="input"
                value={sourceWarehouseId}
                onChange={(e) => {
                  setSourceWarehouseId(e.target.value);
                  setItems([]);
                  setFormError('');
                }}
              >
                <option value="">Seleccione bodega...</option>
                {(warehouses ?? []).map((warehouse: any) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
              {warehouses?.length === 0 && (
                <p className="mt-1 text-sm text-danger">No hay bodegas activas disponibles.</p>
              )}
            </div>
            <div>
              <label className="label">Tipo de Destino</label>
              <select className="input" value={destinationType} onChange={(e) => {
                setDestinationType(e.target.value);
                setDestinationBranchId('');
                setThirdPartyId('');
                setFormError('');
              }}>
                <option value="SUCURSAL">Sucursal Interna</option>
                <option value="TERCERO">Tercero / Distribuidor</option>
              </select>
            </div>
          </div>

          {destinationType === 'SUCURSAL' && (
            <div>
              <label className="label">Sucursal Destino</label>
              <select required className="input" value={destinationBranchId} onChange={(e) => setDestinationBranchId(e.target.value)}>
                <option value="">Seleccione sucursal...</option>
                {(branches || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          {destinationType === 'TERCERO' && (
            <div>
              <label className="label">Tercero / distribuidor</label>
              <select required className="input" value={thirdPartyId} onChange={(e) => setThirdPartyId(e.target.value)}>
                <option value="">Seleccione tercero...</option>
                {(thirdParties ?? []).map((thirdParty: any) => (
                  <option key={thirdParty.id} value={thirdParty.id}>{thirdParty.name}</option>
                ))}
              </select>
              {thirdParties?.length === 0 && (
                <p className="mt-1 text-sm text-danger">No hay terceros activos. Regístrelo primero en Clientes y terceros.</p>
              )}
            </div>
          )}

          <div className="border border-line p-4 rounded-lg bg-page/30">
            <h3 className="font-semibold mb-2">Agregar Productos</h3>
            <div className="flex gap-2 mb-4">
              <select className="input flex-1" value={selectedVariant} onChange={(e) => setSelectedVariant(e.target.value)}>
                <option value="">Seleccione variante...</option>
                {variants.map((variant: any) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.productName} — {variant.sku} — {variant.size}
                  </option>
                ))}
              </select>
              <input type="number" min="1" step="1" className="input w-24" value={qty} onChange={(e) => setQty(e.target.value)} />
              <button type="button" className="btn-secondary" onClick={addItem} disabled={!sourceWarehouseId || stockLoading}>
                {stockLoading ? 'Cargando…' : 'Agregar'}
              </button>
            </div>
            {!sourceWarehouseId && <p className="mb-3 text-xs text-muted">Seleccione una bodega para consultar existencias.</p>}

            <table className="w-full text-sm">
              <thead><tr className="border-b border-line"><th className="text-left">Producto</th><th className="text-right">Cant.</th><th></th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.variantId} className="border-b border-line/50">
                    <td>{variants.find((variant: any) => variant.id === it.variantId)?.productName} — {variants.find((variant: any) => variant.id === it.variantId)?.size}</td>
                    <td className="text-right font-bold">{it.quantity}</td>
                    <td className="text-right">
                      <button type="button" className="text-danger" onClick={() => setItems(items.filter((item) => item.variantId !== it.variantId))}>Quitar</button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={3} className="py-3 text-center text-muted">No se agregaron productos.</td></tr>}
              </tbody>
            </table>
          </div>

          {formError && <p role="alert" className="text-danger text-sm">{formError}</p>}
          {mut.isError && <p className="text-danger text-sm">{(mut.error as any).response?.data?.message || 'Error al crear transferencia'}</p>}
          
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" className="btn-tertiary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={mut.isPending || !warehouses?.length || !variants.length}>
              {mut.isPending ? 'Creando...' : 'Registrar Transferencia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------- MODAL DETALLE / ACCIONES -----------------
function TransferDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data: t, isLoading } = useQuery({
    queryKey: ['transfers', id],
    queryFn: async () => (await api.get(`/transfers/${id}`)).data,
  });

  const mutAction = useMutation({
    mutationFn: async ({ action, payload }: { action: string; payload?: any }) => 
      api.post(`/transfers/${id}/${action}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      onClose();
    },
  });

  // Estado para la confirmación de recepción en sucursal
  const [receipt, setReceipt] = useState<Record<number, { received: number; damaged: number }>>({});

  if (isLoading) return <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><p className="bg-white p-4 rounded">Cargando...</p></div>;
  if (!t) return null;

  const isFactory = ['ADMIN_GENERAL', 'ADMIN', 'ENCARGADO_FABRICA'].includes(user?.role || '');
  const isBranch = ['ADMIN_GENERAL', 'ADMIN', 'ENCARGADO_SUCURSAL', 'VENDEDOR'].includes(user?.role || '');
  const canConfirmReceipt = isBranch
    && t.destinationType === 'SUCURSAL'
    && (t.status === 'ENVIADA' || (user?.role === 'VENDEDOR' && t.status === 'PENDIENTE'));

  const handleConfirm = () => {
    const itemsPayload = t.items.map((i: any) => ({
      transferItemId: i.id,
      receivedQuantity: receipt[i.id]?.received ?? i.quantity,
      damagedQuantity: receipt[i.id]?.damaged ?? 0,
    }));
    mutAction.mutate({ action: 'confirm', payload: { items: itemsPayload } });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-card shadow-card p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold">Transferencia {t.code}</h2>
            <p className="text-muted text-sm">{new Date(t.createdAt).toLocaleString('es-BO')}</p>
          </div>
          <StatusBadge status={t.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm bg-page p-3 rounded">
          <div><span className="text-muted block">Origen:</span> {t.sourceWarehouse?.name}</div>
          <div>
            <span className="text-muted block">Destino:</span> 
            {t.destinationType === 'SUCURSAL' ? t.destinationBranch?.name : t.thirdParty?.name} ({t.destinationType})
          </div>
        </div>

        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-2">Producto / SKU</th>
              <th className="py-2 text-right">Enviado</th>
              {canConfirmReceipt && <th className="py-2 text-right">Recibido total</th>}
              {canConfirmReceipt && <th className="py-2 text-right text-danger">Dañado</th>}
              {(t.status === 'RECIBIDA' || t.status === 'CERRADA') && (
                <>
                  <th className="py-2 text-right text-success">Recibido</th>
                  <th className="py-2 text-right text-danger">Dañado</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {t.items.map((i: any) => (
              <tr key={i.id} className="border-b border-line/60">
                <td className="py-2 font-medium">{i.variant.sku}</td>
                <td className="py-2 text-right font-bold">{i.quantity}</td>
                
                {/* Formulario de recepción (solo sucursal cuando está enviada) */}
                {canConfirmReceipt && (
                  <>
                    <td className="py-2 text-right">
                      <input type="number" min="0" max={i.quantity} className="input w-20 text-right p-1" 
                        value={receipt[i.id]?.received ?? i.quantity} 
                        onChange={(e) => setReceipt({...receipt, [i.id]: { ...receipt[i.id], received: Math.min(i.quantity, Math.max(0, Number(e.target.value))) }})} 
                      />
                    </td>
                    <td className="py-2 text-right">
                      <input type="number" min="0" max={receipt[i.id]?.received ?? i.quantity} className="input w-20 text-right p-1 text-danger border-danger/30" 
                        value={receipt[i.id]?.damaged ?? 0} 
                        onChange={(e) => setReceipt({...receipt, [i.id]: { ...receipt[i.id], damaged: Math.min(receipt[i.id]?.received ?? i.quantity, Math.max(0, Number(e.target.value))) }})} 
                      />
                    </td>
                  </>
                )}

                {/* Vista de lo recibido (después de confirmar) */}
                {(t.status === 'RECIBIDA' || t.status === 'CERRADA') && (
                  <>
                    <td className="py-2 text-right text-success font-bold">{i.receivedQuantity}</td>
                    <td className="py-2 text-right text-danger">{i.damagedQuantity > 0 ? i.damagedQuantity : '-'}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {mutAction.isError && <p className="text-danger text-sm mb-4">{(mutAction.error as any).response?.data?.message || 'Error en la operación'}</p>}

        <div className="flex justify-between items-center mt-6 pt-4 border-t border-line">
          <button className="text-muted hover:text-ink" onClick={onClose}>Cerrar vista</button>
          <div className="flex gap-2">
            {t.status === 'PENDIENTE' && isFactory && (
              <button className="btn-secondary" onClick={() => mutAction.mutate({ action: 'send' })} disabled={mutAction.isPending}>
                Marcar como Enviada (Sale camión)
              </button>
            )}
            {canConfirmReceipt && (
              <button className="btn-primary" onClick={handleConfirm} disabled={mutAction.isPending}>
                {user?.role === 'VENDEDOR' && t.status === 'PENDIENTE'
                  ? 'Confirmar llegada y completar transferencia'
                  : 'Confirmar recepción en sucursal'}
              </button>
            )}
            {t.status === 'RECIBIDA' && isFactory && (
              <button className="btn-tertiary" onClick={() => mutAction.mutate({ action: 'close' })} disabled={mutAction.isPending}>
                Cerrar Transferencia (Archivo)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
