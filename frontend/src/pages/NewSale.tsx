import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { SaleTicketModal, SaleTicketData } from '../components/SaleTicketModal';
import { Banknote, QrCode, CreditCard, Layers } from 'lucide-react';

interface CartItem {
  variantId: number;
  sku: string;
  name: string;
  details: string;
  price: number;
  quantity: number;
  maxStock: number;
  isSellable: boolean;
  warrantySeal?: string;
}

/**
 * Registro de venta (Flujo 3 del doc):
 * buscar cliente por CI (autocompletar o crear) →
 * seleccionar productos → verificar stock → confirmar.
 */
export function NewSalePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [ci, setCi] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [clientFound, setClientFound] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [variantId, setVariantId] = useState(() => searchParams.get('variantId') ?? '');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [checkingStock, setCheckingStock] = useState(false);

  // Estados de métodos de pago y caja
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'QR' | 'TARJETA' | 'MIXTO'>('EFECTIVO');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [ticketData, setTicketData] = useState<SaleTicketData | null>(null);

  // Estados de venta con anticipo / pedido a medida (Fase 3)
  const [paymentType, setPaymentType] = useState<'CONTADO' | 'ANTICIPO'>('CONTADO');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [createProductionOrder, setCreateProductionOrder] = useState(true);
  const [customProductionNotes, setCustomProductionNotes] = useState('');

  // Búsqueda por CI con autocompletado
  const {
    data: ciMatches,
    isFetching: searchingClients,
    isError: clientSearchError,
  } = useQuery({
    queryKey: ['client-search', ci.trim()],
    queryFn: async () => (await api.get('/clients/search', { params: { ci: ci.trim() } })).data,
    enabled: ci.trim().length >= 3 && !clientFound,
  });

  useEffect(() => {
    if (ciMatches?.length === 1 && ciMatches[0].ci === ci.trim()) {
      setName(ciMatches[0].fullName);
      setPhone(ciMatches[0].phone ?? '');
      setClientFound(true);
    }
  }, [ciMatches, ci]);

  // Obtener bodegas para administradores (ventas desde fábrica)
  const {
    data: warehouses,
    isLoading: warehousesLoading,
    isError: warehousesError,
  } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => (await api.get('/locations/warehouses')).data,
    enabled: !user?.branchId,
  });

  const saleLocationType = user?.branchId ? 'SUCURSAL' : 'BODEGA';
  const saleLocationId = user?.branchId || warehouses?.[0]?.id;
  const locationLoading = !user?.branchId && warehousesLoading;
  const noWarehouse = !user?.branchId && !warehousesLoading && !warehousesError && !saleLocationId;

  // Stock disponible en la ubicación del vendedor (o fábrica para administradores)
  const {
    data: stock,
    isLoading: stockLoading,
    isError: stockError,
    error: stockQueryError,
    refetch: refetchStock,
  } = useQuery({
    queryKey: ['stock', 'sale', saleLocationType, saleLocationId],
    queryFn: async () => {
      if (!saleLocationId) return [];
      return (await api.get('/inventory/stock', {
        params: { locationType: saleLocationType, locationId: saleLocationId }
      })).data;
    },
    enabled: !!saleLocationId,
  });

  const sellable = useMemo(
    () =>
      (stock ?? [])
        .filter((s: any) =>
          s.quantity > 0 &&
          s.variant.isActive &&
          s.variant.product.isActive
        )
        .map((s: any) => ({
          variantId: s.variantId,
          sku: s.variant.sku,
          name: s.variant.product.name,
          details: [
            s.variant.size,
            s.variant.color,
            s.variant.height,
            s.variant.type,
          ].filter(Boolean).join(' · '),
          price: s.variant.price,
          available: s.quantity,
        })),
    [stock],
  );
  const selectedProduct = sellable.find((p: any) => p.variantId === Number(variantId));
  useEffect(() => {
    if (!variantId || stockLoading || stockError || !stock) return;
    if (!sellable.some((product: any) => product.variantId === Number(variantId))) {
      setVariantId('');
    }
  }, [variantId, stockLoading, stockError, stock, sellable]);
  const existingCartQuantity = cart.find((item) => item.variantId === selectedProduct?.variantId)?.quantity ?? 0;
  const remainingStock = selectedProduct ? selectedProduct.available - existingCartQuantity : 0;
  const stockErrorMessage =
    (stockQueryError as any)?.response?.data?.message ??
    (stockQueryError as any)?.message ??
    'No se pudo cargar el inventario de esta ubicación.';

  function addItem() {
    const item = selectedProduct;
    if (!item) return;
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      setError('La cantidad debe ser un número entero mayor que cero.');
      return;
    }
    if (quantity > remainingStock) {
      setError(`Solo puedes agregar ${remainingStock} unidad(es) más de este producto.`);
      return;
    }
    setError('');
    setCart((prev) => {
      const existing = prev.find((p) => p.variantId === item.variantId);
      if (existing) {
        return prev.map((p) =>
          p.variantId === item.variantId
            ? { ...p, quantity: p.quantity + quantity }
            : p,
        );
      }
      return [...prev, {
        variantId: item.variantId, sku: item.sku, name: item.name, details: item.details,
        price: item.price, quantity, maxStock: item.available, isSellable: true,
      }];
    });
    setVariantId('');
    setQuantity(1);
  }

  function updateCartQuantity(variantId: number, delta: number) {
    setCart((items) =>
      items
        .map((item) => {
          if (item.variantId !== variantId) return item;
          const nextQuantity = item.quantity + delta;
          if (nextQuantity < 1 || nextQuantity > item.maxStock) return item;
          return { ...item, quantity: nextQuantity };
        }),
    );
    setError('');
  }

  const total = cart.reduce((a, p) => a + p.price * p.quantity, 0);
  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartHasUnavailableItems = cart.some(
    (item) => !item.isSellable || item.quantity > item.maxStock,
  );

  function updateCartFromStock(stockItems: any[]) {
    setCart((items) =>
      items.map((item) => {
        const currentVariant = stockItems.find((stockItem) => stockItem.variantId === item.variantId);
        return {
          ...item,
          maxStock: currentVariant?.quantity ?? 0,
          isSellable: Boolean(currentVariant?.variant.isActive && currentVariant.variant.product.isActive),
          price: currentVariant?.variant.price ?? item.price,
        };
      }),
    );
  }

  const effectivePaid = paymentType === 'ANTICIPO'
    ? (depositAmount ? parseFloat(depositAmount) : 0)
    : (amountPaid ? parseFloat(amountPaid) : total);
  const pendingBalance = paymentType === 'ANTICIPO' ? Math.max(0, total - effectivePaid) : 0;
  const changeAmount = paymentMethod === 'EFECTIVO' && paymentType === 'CONTADO' ? Math.max(0, effectivePaid - total) : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!saleLocationId) throw new Error('Cargando ubicación, espere...');
      const res = await api.post('/sales', {
        locationType: saleLocationType,
        locationId: saleLocationId,
        clientCi: ci.trim(),
        clientName: name.trim(),
        clientPhone: phone.trim(),
        paymentMethod,
        paymentType,
        amountPaid: effectivePaid,
        pendingBalance,
        changeAmount,
        deliveryStatus: paymentType === 'ANTICIPO' ? 'PENDIENTE_ENTREGA' : 'ENTREGADO',
        deliveryDate: deliveryDate || undefined,
        createProductionOrder: paymentType === 'ANTICIPO' && createProductionOrder,
        customNotes: customProductionNotes || undefined,
        notes: paymentNotes.trim() || undefined,
        items: cart.map((p) => ({
          variantId: p.variantId,
          quantity: p.quantity,
          expectedUnitPrice: p.price,
          warrantySeal: p.warrantySeal?.trim() || undefined,
        })),
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['seller-catalog'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register'] });
      queryClient.invalidateQueries({ queryKey: ['production'] });
      setShowConfirmation(false);

      // Abrir ticket de venta
      setTicketData({
        code: data.code,
        createdAt: data.createdAt,
        clientName: name.trim(),
        clientCi: ci.trim(),
        clientPhone: phone.trim() || undefined,
        sellerName: user?.fullName,
        paymentMethod: paymentType === 'ANTICIPO' ? `${paymentMethod} (ANTICIPO - Saldo: Bs ${pendingBalance.toFixed(2)})` : paymentMethod,
        amountPaid: effectivePaid,
        changeAmount,
        total,
        items: cart.map((c) => ({
          name: c.name,
          size: c.details,
          sku: c.sku,
          quantity: c.quantity,
          unitPrice: c.price,
          subtotal: c.price * c.quantity,
        })),
      });
    },
    onError: async (err: any) => {
      const message = err.response?.data?.message ?? 'Error al registrar la venta.';
      if (err.response?.status === 409) {
        const latestStock = await refetchStock();
        if (latestStock.isError || !latestStock.data) {
          setError(`${message} No se pudo actualizar el carrito; vuelve a intentarlo.`);
          return;
        }
        updateCartFromStock(latestStock.data);
        setError(`${message} Se actualizó el carrito; revisa disponibilidad y el nuevo total antes de confirmar.`);
        return;
      }
      setError(message);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ci.trim() || !name.trim()) {
      setError('Ingresa el CI y el nombre completo del cliente.');
      return;
    }
    if (cart.length === 0) return;
    setError('');
    setShowConfirmation(true);
  }

  async function confirmSale() {
    if (checkingStock || mutation.isPending) return;
    setCheckingStock(true);
    setError('');
    try {
      const latestStock = await refetchStock();
      if (latestStock.isError || !latestStock.data) {
        setError('No se pudo verificar el stock actualizado. Inténtalo de nuevo.');
        return;
      }

      const unavailableItems = cart.flatMap((item) => {
        const currentVariant = latestStock.data.find((stockItem: any) => stockItem.variantId === item.variantId);
        const available = currentVariant?.quantity ?? 0;
        const stillSellable = currentVariant?.variant.isActive && currentVariant.variant.product.isActive;
        return !stillSellable || available < item.quantity
          ? [`${item.name} (${item.sku}): ${!stillSellable ? 'la variante ya no está disponible' : `pediste ${item.quantity}, quedan ${available}`}.`]
          : [];
      });
      const changedPrices = cart.flatMap((item) => {
        const currentVariant = latestStock.data.find((stockItem: any) => stockItem.variantId === item.variantId)?.variant;
        return currentVariant && currentVariant.price !== item.price
          ? [`${item.name} (${item.sku}): el precio cambió de Bs ${item.price.toFixed(2)} a Bs ${currentVariant.price.toFixed(2)}.`]
          : [];
      });
      if (unavailableItems.length > 0 || changedPrices.length > 0) {
        updateCartFromStock(latestStock.data);
        setError([
          ...(unavailableItems.length > 0
            ? [`El inventario cambió y no se registró la venta. Corrige el carrito: ${unavailableItems.join(' ')}`]
            : []),
          ...(changedPrices.length > 0
            ? [`Se actualizaron los precios. Revisa el nuevo total antes de confirmar: ${changedPrices.join(' ')}`]
            : []),
        ].join(' '));
        return;
      }

      mutation.mutate();
    } finally {
      setCheckingStock(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Nueva venta</h1>

      {/* Cliente por CI */}
      <div className="card space-y-4">
        <h2 className="font-semibold">Cliente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <label className="label">CI *</label>
            <input className="input" required value={ci}
              onChange={(e) => {
                setCi(e.target.value);
                setName('');
                setPhone('');
                setClientFound(false);
                setError('');
              }}
              placeholder="1234567" />
            {searchingClients && (
              <p className="mt-1 text-xs text-muted">Buscando cliente…</p>
            )}
            {clientSearchError && (
              <p role="alert" className="mt-1 text-xs text-danger">No se pudo buscar el CI. Puedes continuar ingresando los datos del cliente.</p>
            )}
            {!searchingClients && !clientSearchError && ci.trim().length >= 3 && !clientFound && ciMatches?.length === 0 && (
              <p className="mt-1 text-xs text-muted">No encontramos ese CI. Completa el nombre para registrar al cliente con la venta.</p>
            )}
            {!clientFound && ciMatches?.length > 0 && (
              <ul className="absolute z-10 w-full card mt-1 p-1 max-h-40 overflow-y-auto">
                {ciMatches.map((c: any) => (
                  <li key={c.id}>
                    <button type="button" className="w-full text-left px-2 py-1.5 rounded hover:bg-page text-sm"
                      onClick={() => { setCi(c.ci); setName(c.fullName); setPhone(c.phone ?? ''); setClientFound(true); }}>
                      <strong>{c.ci}</strong> — {c.fullName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="label">Nombre completo *</label>
            <input className="input" required value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="Nombre del cliente" />
          </div>
          <div>
            <label className="label">Teléfono</label>
            <input className="input" value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(''); }}
              placeholder="70000000" />
          </div>
        </div>
        {clientFound && (
          <p className="text-xs text-success">✓ Cliente existente autocompletado por CI</p>
        )}
      </div>

      {/* Productos */}
      <div className="card space-y-4">
        <h2 className="font-semibold">Productos</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="label">Producto</label>
            <select
              className="input"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              disabled={locationLoading || warehousesError || noWarehouse || stockLoading || stockError || !saleLocationId || sellable.length === 0}
            >
              <option value="">
                {locationLoading ? 'Cargando bodega…' :
                  warehousesError ? 'Error al cargar bodegas' :
                    noWarehouse ? 'No hay bodegas activas disponibles' :
                      stockLoading ? 'Cargando productos…' :
                  stockError ? 'Error al cargar inventario' :
                        !saleLocationId ? 'No hay ubicación de venta asignada' :
                          sellable.length === 0 ? 'No hay productos con stock disponible' : 'Seleccionar…'}
              </option>
              {sellable.map((p: any) => (
                <option key={p.variantId} value={p.variantId}>
                  {p.name} — {p.details} · SKU {p.sku} — Bs {p.price} (disp. {p.available})
                </option>
              ))}
            </select>
            {selectedProduct && (
              <p className="mt-1 text-xs text-muted">
                Disponible para agregar: {remainingStock} de {selectedProduct.available}
              </p>
            )}
          </div>
          <div className="w-28">
            <label className="label">Cantidad</label>
            <input className="input" type="number" min={1} max={selectedProduct ? remainingStock : undefined} step={1} value={quantity}
              onChange={(e) => setQuantity(+e.target.value)} />
          </div>
          {stockError && (
            <p role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
              {stockErrorMessage}
            </p>
          )}
          {warehousesError && (
            <p role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
              No se pudieron cargar las bodegas para esta venta. Actualiza la página o contacta al administrador.
            </p>
          )}
          <button type="button" className="btn-secondary" onClick={addItem}
            disabled={!selectedProduct || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > remainingStock}>
            Agregar
          </button>
        </div>

        {cart.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-2">Producto</th>
                <th className="py-2 text-right">Precio</th>
                <th className="py-2 text-center">Cantidad</th>
                <th className="py-2 text-right">Subtotal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.variantId} className="border-b border-line/60">
                  <td className="py-2">
                    <span className="block font-medium">{item.name} — {item.details}</span>
                    <span className="text-xs text-muted">SKU: {item.sku}</span>
                    {(!item.isSellable || item.quantity > item.maxStock) && (
                      <span className="block text-xs text-danger" role="status">
                        {!item.isSellable ? 'Variante desactivada; quítala del carrito.' : `Stock actualizado: máximo ${item.maxStock}.`}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right">Bs {item.price}</td>
                  <td className="py-2">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        className="btn-tertiary h-8 w-8 p-0"
                        onClick={() => updateCartQuantity(item.variantId, -1)}
                        disabled={item.quantity <= 1}
                        aria-label={`Reducir cantidad de ${item.name}`}
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center font-medium" aria-live="polite">{item.quantity}</span>
                      <button
                        type="button"
                        className="btn-tertiary h-8 w-8 p-0"
                        onClick={() => updateCartQuantity(item.variantId, 1)}
                        disabled={item.quantity >= item.maxStock}
                        aria-label={`Aumentar cantidad de ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                    <span className="block text-center text-[11px] text-muted">máx. {item.maxStock}</span>
                  </td>
                  <td className="py-2 text-right font-medium">Bs {item.price * item.quantity}</td>
                  <td className="py-2 text-right">
                    <button type="button" className="text-danger text-xs"
                      onClick={() => {
                        setCart(cart.filter((p) => p.variantId !== item.variantId));
                        setError('');
                      }}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-3 text-right font-bold">Total ({totalUnits} unidades)</td>
                <td className="py-3 text-right font-bold text-lg text-primary">Bs {total.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}

        {error && <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}
      </div>

      <button className="btn-primary text-base py-3 px-6 shadow-md" disabled={cart.length === 0 || mutation.isPending}>
        Continuar al Cobro (Efectivo / QR / Tarjeta) →
      </button>

      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="sale-confirmation-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-card bg-white p-6 shadow-card dark:bg-surface"
          >
            <h2 id="sale-confirmation-title" className="text-xl font-bold">Revisar y confirmar venta</h2>
            <p className="mt-1 text-sm text-muted">Verifica los datos. El inventario se descontará al registrar la venta.</p>

            <dl className="mt-5 grid grid-cols-1 gap-3 rounded-lg bg-page p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Cliente</dt>
                <dd className="font-medium">{name.trim()}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">CI</dt>
                <dd className="font-medium">{ci.trim()}</dd>
              </div>
              {phone.trim() && (
                <div>
                  <dt className="text-xs text-muted">Teléfono</dt>
                  <dd className="font-medium">{phone.trim()}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted">Ubicación de venta</dt>
                <dd className="font-medium">
                  {saleLocationType === 'SUCURSAL' ? user?.branchName || `Sucursal ${saleLocationId}` : warehouses?.[0]?.name || 'Bodega'}
                </dd>
              </div>
            </dl>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="py-2">Producto</th>
                    <th className="py-2 text-right">Cant.</th>
                    <th className="py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={item.variantId} className="border-b border-line/60">
                      <td className="py-2">
                        <span className="block font-medium">{item.name} — {item.details}</span>
                        <span className="text-xs text-muted">SKU: {item.sku} · Bs {item.price} c/u</span>
                        <div className="mt-1 flex items-center gap-1.5">
                          <label className="text-[11px] text-muted whitespace-nowrap">Sello de Garantía:</label>
                          <input
                            type="text"
                            placeholder="Opcional (ej. SL-2026-01)"
                            value={item.warrantySeal || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCart((prev) => prev.map((p, i) => i === idx ? { ...p, warrantySeal: val } : p));
                            }}
                            className="input py-0.5 px-2 text-xs w-44"
                          />
                        </div>
                      </td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">Bs {(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="py-3 text-right font-bold">Total</td>
                    <td className="py-3 text-right text-lg font-bold text-primary">Bs {total.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-5 border-t border-line pt-4">
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">Modalidad de Venta</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType('CONTADO')}
                    className={`py-2 px-3 rounded-xl border text-sm font-semibold transition-all ${
                      paymentType === 'CONTADO'
                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                        : 'border-line text-muted hover:bg-page'
                    }`}
                  >
                    📦 Venta al Contado (Entrega Inmediata)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType('ANTICIPO')}
                    className={`py-2 px-3 rounded-xl border text-sm font-semibold transition-all ${
                      paymentType === 'ANTICIPO'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 shadow-sm'
                        : 'border-line text-muted hover:bg-page'
                    }`}
                  >
                    📝 Pedido con Anticipo (A Medida / Por Entregar)
                  </button>
                </div>
              </div>

              {/* Si es pedido con anticipo */}
              {paymentType === 'ANTICIPO' && (
                <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3.5 space-y-3 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      Monto de Anticipo recibido (Bs): *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      max={total}
                      placeholder={`Ej. ${(total * 0.5).toFixed(0)}`}
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="input w-full sm:w-40 text-right font-bold text-amber-700"
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm pt-2 border-t border-amber-200/60 dark:border-amber-800/40">
                    <span className="text-muted font-medium">Saldo pendiente a cobrar contra entrega:</span>
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      Bs {pendingBalance.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/40">
                    <div>
                      <label className="text-[11px] font-medium text-muted block mb-1">Fecha estimada de entrega:</label>
                      <input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="input text-xs w-full py-1"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted block mb-1">Especificación fabricación (tela, etc.):</label>
                      <input
                        type="text"
                        placeholder="Ej. Espuma D-30, tela jackard..."
                        value={customProductionNotes}
                        onChange={(e) => setCustomProductionNotes(e.target.value)}
                        className="input text-xs w-full py-1"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={createProductionOrder}
                      onChange={(e) => setCreateProductionOrder(e.target.checked)}
                      className="rounded border-line text-primary focus:ring-primary"
                    />
                    <span>Generar Orden de Fabricación automática para el taller/fábrica</span>
                  </label>
                </div>
              )}

              <h4 className="text-sm font-semibold mb-3">Método de Pago para el Cobro ({paymentType === 'ANTICIPO' ? 'Anticipo' : 'Total'})</h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  { id: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
                  { id: 'QR', label: 'QR Bancario', icon: QrCode },
                  { id: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
                  { id: 'MIXTO', label: 'Mixto / Otro', icon: Layers },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPaymentMethod(id as any)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all ${
                      paymentMethod === id
                        ? 'border-primary bg-primary/10 text-primary shadow-sm font-semibold'
                        : 'border-line text-muted hover:bg-page'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {paymentMethod === 'EFECTIVO' && paymentType === 'CONTADO' && (
                <div className="bg-page/70 border border-line rounded-xl p-3.5 space-y-3 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-medium text-muted">Monto recibido del cliente (Bs):</label>
                    <input
                      type="number"
                      step="any"
                      min={total}
                      placeholder={`Ej. ${total}`}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="input w-full sm:w-40 text-right font-semibold"
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm pt-2 border-t border-line/60">
                    <span className="text-muted font-medium">Cambio / Vuelto a entregar:</span>
                    <span className="text-lg font-bold text-emerald-600">
                      Bs {changeAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <input
                  type="text"
                  placeholder="Notas adicionales o referencia de pago (opcional)..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="input w-full text-xs"
                />
              </div>
            </div>

            {error && <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowConfirmation(false)}
                disabled={checkingStock || mutation.isPending}
              >
                Volver a editar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmSale}
                disabled={checkingStock || mutation.isPending || cartHasUnavailableItems}
              >
                {checkingStock ? 'Verificando stock…' :
                  mutation.isPending ? 'Registrando…' : 'Cobrar y Emitir Comprobante'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Modal de Comprobante / Ticket Térmico & WhatsApp */}
      {ticketData && (
        <SaleTicketModal
          sale={ticketData}
          onClose={() => {
            setTicketData(null);
            navigate('/ventas');
          }}
        />
      )}
    </form>
  );
}
