import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Search, ShieldCheck, ShieldAlert, Calendar, User, Phone, MapPin, Receipt, Clock, Printer } from 'lucide-react';
import { SaleTicketModal, SaleTicketData } from '../components/SaleTicketModal';

export function WarrantyPage() {
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [ticketData, setTicketData] = useState<SaleTicketData | null>(null);

  const { data: sales, isLoading, isFetching } = useQuery({
    queryKey: ['warranty-check', activeQuery],
    queryFn: async () => {
      if (!activeQuery.trim()) return [];
      const res = await api.get('/sales/warranty', { params: { query: activeQuery.trim() } });
      return res.data;
    },
    enabled: activeQuery.trim().length > 0,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveQuery(searchInput.trim());
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'No especificado';
    return new Date(dateStr).toLocaleDateString('es-BO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getRemainingTimeText = (expiresAtStr?: string | null, isValid?: boolean) => {
    if (!expiresAtStr) return 'Sin fecha de vencimiento';
    const exp = new Date(expiresAtStr).getTime();
    const now = new Date().getTime();
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

    if (isValid) {
      if (diffDays > 365) {
        const years = Math.floor(diffDays / 365);
        const remMonths = Math.floor((diffDays % 365) / 30);
        return `Vence en ${years} ${years === 1 ? 'año' : 'años'}${remMonths > 0 ? ` y ${remMonths} m` : ''} (${diffDays} días)`;
      }
      return `Vence en ${diffDays} días`;
    } else {
      const pastDays = Math.abs(diffDays);
      return `Expiró hace ${pastDays} días`;
    }
  };

  const handlePrintTicket = (sale: any) => {
    setTicketData({
      code: sale.code,
      createdAt: sale.createdAt,
      clientName: sale.client?.fullName || 'Cliente General',
      clientCi: sale.client?.ci || '',
      clientPhone: sale.client?.phone,
      sellerName: sale.seller?.fullName || 'Vendedor',
      paymentMethod: sale.paymentMethod || 'EFECTIVO',
      amountPaid: sale.amountPaid || sale.total,
      changeAmount: sale.changeAmount || 0,
      total: sale.total,
      items: (sale.items || []).map((it: any) => ({
        name: it.variant?.product?.name || 'Producto',
        size: [it.variant?.size, it.variant?.color].filter(Boolean).join(' · '),
        sku: it.variant?.sku || '',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        subtotal: it.unitPrice * it.quantity,
      })),
    });
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="text-primary w-7 h-7" />
          Servicio Post-Venta y Garantías
        </h1>
        <p className="text-sm text-muted">
          Consulta la vigencia de garantía y validez de colchones por CI del cliente, código de venta o sello precintado.
        </p>
      </div>

      {/* Barra de Búsqueda */}
      <div className="card bg-page/40 p-4 border border-line">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              type="text"
              className="input pl-10 w-full font-medium"
              placeholder="Ingresa CI del cliente, código de nota (ej. VEN-001) o Sello..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={!searchInput.trim() || isFetching}
            className="btn-primary flex items-center justify-center gap-2 px-6"
          >
            {isFetching ? 'Buscando...' : 'Consultar Garantía'}
          </button>
        </form>
      </div>

      {/* Resultados */}
      {isLoading ? (
        <div className="text-center py-12 text-muted">Buscando registros de garantía...</div>
      ) : activeQuery && (!sales || sales.length === 0) ? (
        <div className="card text-center py-12 space-y-3">
          <ShieldAlert className="w-12 h-12 text-muted mx-auto opacity-40" />
          <h3 className="text-lg font-bold text-ink">No se encontraron ventas para &ldquo;{activeQuery}&rdquo;</h3>
          <p className="text-sm text-muted max-w-md mx-auto">
            Verifica que el número de CI, código de venta o sello esté escrito correctamente.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(sales ?? []).map((sale: any) => (
            <div key={sale.id} className="card p-0 overflow-hidden border border-line shadow-sm">
              {/* Encabezado de Venta */}
              <div className="bg-page/70 p-4 border-b border-line flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink text-base">{sale.code}</span>
                      <span className="text-xs text-muted">({formatDate(sale.createdAt)})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted mt-0.5">
                      <span className="flex items-center gap-1">
                        <User size={13} /> {sale.client?.fullName} (CI: {sale.client?.ci})
                      </span>
                      {sale.client?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={13} /> {sale.client?.phone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin size={13} /> {sale.branch?.name || 'Venta directa'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-ink">Total: Bs {sale.total.toFixed(2)}</span>
                  <button
                    onClick={() => handlePrintTicket(sale)}
                    className="btn-secondary py-1 px-3 text-xs flex items-center gap-1.5"
                    title="Reimprimir o enviar ticket por WhatsApp"
                  >
                    <Printer size={14} /> Ticket
                  </button>
                </div>
              </div>

              {/* Items con estado de garantía */}
              <div className="p-4 space-y-3">
                <h4 className="text-xs font-bold text-muted uppercase tracking-wider">
                  Productos Registrados y Cobertura
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sale.items.map((item: any) => {
                    const isValid = item.isWarrantyValid;
                    const years = item.variant?.warrantyYears ?? 1;

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                          isValid
                            ? 'bg-emerald-50/30 border-emerald-200 dark:bg-emerald-950/10 dark:border-emerald-800/40'
                            : 'bg-red-50/30 border-red-200 dark:bg-red-950/10 dark:border-red-800/40'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h5 className="font-bold text-ink text-sm">
                                {item.variant?.product?.name}
                              </h5>
                              <p className="text-xs text-muted">
                                {item.variant?.size} {item.variant?.color ? `· ${item.variant?.color}` : ''}
                              </p>
                              <p className="text-[11px] text-muted mt-0.5">
                                SKU: {item.variant?.sku} · Cantidad: {item.quantity} un.
                              </p>
                            </div>

                            {/* Badge Vigente o Vencida */}
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                                isValid
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300'
                              }`}
                            >
                              {isValid ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                              {isValid ? 'GARANTÍA VIGENTE' : 'GARANTÍA VENCIDA'}
                            </span>
                          </div>

                          {/* Sello de garantía si se registró */}
                          {item.warrantySeal && (
                            <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/80 dark:bg-black/30 border border-line text-xs font-medium text-ink">
                              <span className="text-muted">Sello/Precinto:</span>
                              <span className="font-bold font-mono text-primary">{item.warrantySeal}</span>
                            </div>
                          )}
                        </div>

                        {/* Fechas de vigencia */}
                        <div className="mt-3 pt-3 border-t border-line/60 flex flex-wrap items-center justify-between text-xs gap-2">
                          <span className="flex items-center gap-1 text-muted">
                            <Calendar size={13} />
                            Vence: <strong className="text-ink">{formatDate(item.warrantyExpiresAt)}</strong> ({years} {years === 1 ? 'año' : 'años'})
                          </span>

                          <span className={`font-medium flex items-center gap-1 ${isValid ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            <Clock size={12} />
                            {getRemainingTimeText(item.warrantyExpiresAt, isValid)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticket Modal para Reimpresión o WhatsApp */}
      {ticketData && (
        <SaleTicketModal sale={ticketData} onClose={() => setTicketData(null)} />
      )}
    </div>
  );
}
