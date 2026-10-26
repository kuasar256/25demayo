import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { PaginationControls } from '../components/PaginationControls';

export function InventoryPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: stockResults, isLoading: loadingStock, isError: stockError } = useQuery({
    queryKey: ['stock', stockSearch, page, pageSize],
    queryFn: async () => (
      await api.get('/inventory/stock', { params: { search: stockSearch, page, pageSize } })
    ).data,
  });
  const stock = stockResults?.items ?? [];

  const { data: movementResults, isLoading: loadingMovements, isError: movementsError } = useQuery({
    queryKey: ['movements', movementSearch, page, pageSize],
    queryFn: async () => (
      await api.get('/inventory/movements', { params: { search: movementSearch, page, pageSize } })
    ).data,
    enabled: tab === 'movements',
  });
  const movements = movementResults?.items ?? [];

  const canEntry = ['ADMIN_GENERAL', 'ADMIN', 'ENCARGADO_FABRICA'].includes(user?.role || '');
  const canAdjust = ['ADMIN_GENERAL', 'ADMIN', 'ENCARGADO_FABRICA', 'ENCARGADO_SUCURSAL'].includes(user?.role || '');

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          {user?.role === 'ENCARGADO_FABRICA' ? 'Inventario de fábrica' : 'Inventario'}
        </h1>
        <div className="flex gap-2">
          {canEntry && (
            <button className="btn-secondary" onClick={() => setShowEntryModal(true)}>
              + Registrar Ingreso
            </button>
          )}
          {canAdjust && (
            <button className="btn-tertiary" onClick={() => setShowAdjustModal(true)}>
              Ajuste manual
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 border-b border-line mb-4">
        <button
          className={`pb-2 px-1 font-medium ${tab === 'stock' ? 'border-b-2 border-primary text-primary' : 'text-muted'}`}
          onClick={() => {
            setTab('stock');
            setPage(1);
          }}
        >
          Stock Actual
        </button>
        <button
          className={`pb-2 px-1 font-medium ${tab === 'movements' ? 'border-b-2 border-primary text-primary' : 'text-muted'}`}
          onClick={() => {
            setTab('movements');
            setPage(1);
          }}
        >
          Historial / Kardex
        </button>
      </div>

      {tab === 'stock' && (
        <>
        <input
          className="input sm:max-w-sm"
          aria-label="Buscar inventario"
          placeholder="Buscar por SKU, producto o tamaño..."
          value={stockSearch}
          onChange={(event) => {
            setStockSearch(event.target.value);
            setPage(1);
          }}
        />
        {loadingStock ? <p className="text-muted">Cargando stock…</p> : stockError ? (
          <p className="text-danger" role="alert">No se pudo cargar el inventario. Intente nuevamente.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  <th className="py-2">SKU</th>
                  <th className="py-2">Producto</th>
                  <th className="py-2">Ubicación</th>
                  <th className="py-2 text-right">Stock</th>
                  <th className="py-2 text-right">Mínimo</th>
                  <th className="py-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(stock ?? []).map((s: any) => {
                  const critical = s.quantity <= s.variant.minStock;
                  return (
                    <tr key={s.id} className="border-b border-line/60 hover:bg-page/60">
                      <td className="py-2 font-medium">{s.variant.sku}</td>
                      <td className="py-2">
                        {s.variant.product.name} — {s.variant.size}
                        {s.variant.color ? ` (${s.variant.color})` : ''}
                      </td>
                      <td className="py-2">{s.locationType} {s.locationId}</td>
                      <td className={`py-2 text-right font-bold ${critical ? 'text-danger' : ''}`}>
                        {s.quantity}
                      </td>
                      <td className="py-2 text-right text-muted">{s.variant.minStock}</td>
                      <td className="py-2 text-center">
                        {critical
                          ? <span className="badge bg-danger/10 text-danger">Crítico</span>
                          : <span className="badge bg-success/10 text-success">OK</span>}
                      </td>
                    </tr>
                  );
                })}
                {(stock ?? []).length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-muted">No hay existencias registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
        }
        {!loadingStock && !stockError && (
          <PaginationControls
            page={stockResults?.page ?? page}
            pageSize={stockResults?.pageSize ?? pageSize}
            total={stockResults?.total ?? 0}
            totalPages={stockResults?.totalPages ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
        </>
      )}

      {tab === 'movements' && (
        <>
        <input
          className="input sm:max-w-sm"
          aria-label="Buscar movimientos"
          placeholder="Buscar por SKU, producto, motivo o usuario..."
          value={movementSearch}
          onChange={(event) => {
            setMovementSearch(event.target.value);
            setPage(1);
          }}
        />
        {loadingMovements ? <p className="text-muted">Cargando movimientos…</p> : movementsError ? (
          <p className="text-danger" role="alert">No se pudo cargar el kardex. Intente nuevamente.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-line">
                  <th className="py-2">Fecha</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2">Variante</th>
                  <th className="py-2">Ubicación</th>
                  <th className="py-2 text-right">Cant.</th>
                  <th className="py-2">Motivo</th>
                  <th className="py-2">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {(movements ?? []).map((m: any) => {
                  const isPositive = m.quantity > 0;
                  return (
                    <tr key={m.id} className="border-b border-line/60 hover:bg-page/60">
                      <td className="py-2">{new Date(m.createdAt).toLocaleString('es-BO')}</td>
                      <td className="py-2"><span className="badge bg-page border border-line text-ink">{m.type}</span></td>
                      <td className="py-2">{m.variant.sku}</td>
                      <td className="py-2">{m.locationType} {m.locationId}</td>
                      <td className={`py-2 text-right font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
                        {isPositive ? '+' : ''}{m.quantity}
                      </td>
                      <td className="py-2 text-muted max-w-xs truncate">{m.reason || '-'}</td>
                      <td className="py-2">{m.user.fullName}</td>
                    </tr>
                  );
                })}
                {(movements ?? []).length === 0 && (
                  <tr><td colSpan={7} className="py-4 text-center text-muted">No hay movimientos recientes.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
        }
        {!loadingMovements && !movementsError && (
          <PaginationControls
            page={movementResults?.page ?? page}
            pageSize={movementResults?.pageSize ?? pageSize}
            total={movementResults?.total ?? 0}
            totalPages={movementResults?.totalPages ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
        </>
      )}

      {showEntryModal && <EntryModal onClose={() => setShowEntryModal(false)} />}
      {showAdjustModal && <AdjustModal onClose={() => setShowAdjustModal(false)} />}
    </div>
  );
}

// ---------------------- MODALES ----------------------

function EntryModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await api.get('/catalog/products')).data });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: async () => (await api.get('/locations/warehouses')).data });

  const mut = useMutation({
    mutationFn: async (payload: any) => api.post('/inventory/entries', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      onClose();
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouses || warehouses.length === 0) return alert('No se encontró la Fábrica Central en el sistema.');
    mut.mutate({
      variantId: Number(variantId),
      locationType: 'BODEGA',
      locationId: warehouses[0].id, // Auto-asigna a la Fábrica Única
      quantity: Number(quantity),
      reason: reason || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-card shadow-card p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Registrar Ingreso de Producción</h2>
        <p className="text-sm text-muted mb-4">El inventario se sumará a la Fábrica Central.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Variante de Producto</label>
            <select required className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              <option value="">Seleccione una variante...</option>
              {(products || []).flatMap((p: any) => p.variants).map((v: any) => (
                <option key={v.id} value={v.id}>{v.sku} - {v.size} {v.color ? `(${v.color})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Cantidad a ingresar</label>
            <input required type="number" min="1" className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div>
            <label className="label">Motivo (Opcional)</label>
            <input type="text" className="input" placeholder="Ej. Lote de producción #123" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {mut.isError && <p className="text-danger text-sm">{(mut.error as any).response?.data?.message || 'Error al registrar ingreso'}</p>}
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" className="btn-tertiary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={mut.isPending}>
              {mut.isPending ? 'Guardando...' : 'Confirmar Ingreso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdjustModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  
  const [variantId, setVariantId] = useState('');
  const [locationType, setLocationType] = useState(user?.role === 'ENCARGADO_SUCURSAL' ? 'SUCURSAL' : '');
  const [locationId, setLocationId] = useState(user?.role === 'ENCARGADO_SUCURSAL' ? String(user?.branchId) : '');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => (await api.get('/catalog/products')).data });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses'], queryFn: async () => (await api.get('/locations/warehouses')).data, enabled: locationType === 'BODEGA' });
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: async () => (await api.get('/locations/branches')).data, enabled: locationType === 'SUCURSAL' && user?.role !== 'ENCARGADO_SUCURSAL' });

  const mut = useMutation({
    mutationFn: async (payload: any) => api.post('/inventory/adjustments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      onClose();
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mut.mutate({
      variantId: Number(variantId),
      locationType,
      locationId: Number(locationId),
      quantity: Number(quantity),
      reason, // Obligatorio en backend
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-card shadow-card p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Ajuste Manual de Inventario</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Variante de Producto</label>
            <select required className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              <option value="">Seleccione una variante...</option>
              {(products || []).flatMap((p: any) => p.variants).map((v: any) => (
                <option key={v.id} value={v.id}>{v.sku} - {v.size} {v.color ? `(${v.color})` : ''}</option>
              ))}
            </select>
          </div>

          {user?.role !== 'ENCARGADO_SUCURSAL' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Tipo de Ubicación</label>
                <select required className="input" value={locationType} onChange={(e) => { 
                  setLocationType(e.target.value); 
                  if (e.target.value === 'BODEGA' && warehouses?.length > 0) {
                    setLocationId(String(warehouses[0].id));
                  } else {
                    setLocationId('');
                  }
                }}>
                  <option value="">Seleccione...</option>
                  <option value="BODEGA">Fábrica Central</option>
                  <option value="SUCURSAL">Sucursal</option>
                </select>
              </div>
              <div>
                <label className="label">Ubicación Exacta</label>
                <select required className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={!locationType || locationType === 'BODEGA'}>
                  {locationType === 'BODEGA' && <option value={locationId}>Almacén Principal</option>}
                  {locationType === 'SUCURSAL' && <option value="">Seleccione...</option>}
                  {locationType === 'SUCURSAL' && (branches || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="label">Cantidad (Usar negativo para restar)</label>
            <input required type="number" className="input" placeholder="Ej. -2 o 5" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <p className="text-xs text-muted mt-1">Si hubo una pérdida o daño físico, ingrese un valor negativo.</p>
          </div>
          <div>
            <label className="label">Motivo (Obligatorio)</label>
            <input required type="text" className="input" placeholder="Ej. Producto dañado por humedad" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          
          {mut.isError && <p className="text-danger text-sm">{(mut.error as any).response?.data?.message || 'Error al aplicar ajuste'}</p>}
          
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" className="btn-tertiary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={mut.isPending}>
              {mut.isPending ? 'Aplicando...' : 'Aplicar Ajuste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
