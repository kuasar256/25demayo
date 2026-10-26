import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area, CartesianGrid, ComposedChart, Line, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Download, Printer, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

type ReportTab = 'sales' | 'products' | 'transfers';

interface ReportSale {
  id: number;
  code: string;
  status: string;
  total: number;
  createdAt: string;
  locationType: string;
  locationId: number;
  locationName: string;
  client: { fullName: string };
  seller: { id: number; fullName: string };
  branch: { name: string } | null;
  items: { quantity: number; unitPrice: number; variant: { sku: string; size: string; product: { name: string } } }[];
}

interface SalesReport {
  period: { from: string; to: string; previousFrom: string; previousTo: string };
  summary: {
    total: number;
    count: number;
    averageTicket: number;
    units: number;
    canceledCount: number;
    totalCost?: number;
    grossProfit?: number;
    profitMargin?: number;
  };
  comparison: { totalPercent: number | null; countPercent: number | null };
  daily: { date: string; total: number; count: number }[];
  byBranch: { name: string; total: number }[];
  bySeller: { id: number; name: string; total: number; count: number }[];
  topProducts: { sku: string; name: string; quantity: number; revenue: number }[];
  sales: ReportSale[];
}

interface Location {
  id: number;
  name: string;
}

const money = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('es-BO');
const dateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const firstOfMonth = () => {
  const date = new Date();
  date.setDate(1);
  return dateInputValue(date);
};
const today = () => dateInputValue(new Date());
const formatMoney = (value: number) => `Bs ${money.format(value)}`;
const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('es-BO');

export function ReportsPage() {
  const user = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<ReportTab>('sales');
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [location, setLocation] = useState('');

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'ADMIN_GENERAL';
  const isSeller = user?.role === 'VENDEDOR';
  const canSeeTransfers = isAdmin || user?.role === 'ENCARGADO_FABRICA';
  const canSeeSellerBreakdown = isAdmin || user?.role === 'ENCARGADO_SUCURSAL';

  const { data: branches = [] } = useQuery<Location[]>({
    queryKey: ['report-locations', 'branches'],
    queryFn: async () => (await api.get('/locations/branches')).data,
    enabled: isAdmin,
  });
  const { data: warehouses = [] } = useQuery<Location[]>({
    queryKey: ['report-locations', 'warehouses'],
    queryFn: async () => (await api.get('/locations/warehouses')).data,
    enabled: isAdmin,
  });

  const locationParams = useMemo(() => {
    if (!location) return {};
    const [locationType, id] = location.split(':');
    return { locationType, locationId: Number(id) };
  }, [location]);

  const {
    data: report,
    isLoading: loadingSales,
    isError: salesError,
    refetch: refetchSales,
  } = useQuery<SalesReport>({
    queryKey: ['reports', 'sales', from, to, locationParams],
    queryFn: async () => (await api.get('/reports/sales', {
      params: { from, to, ...locationParams },
    })).data,
    enabled: tab !== 'transfers' || !canSeeTransfers,
  });

  const {
    data: transfers = [],
    isLoading: loadingTransfers,
    isError: transfersError,
    refetch: refetchTransfers,
  } = useQuery<any[]>({
    queryKey: ['reports', 'transfers'],
    queryFn: async () => (await api.get('/reports/transfers')).data,
    enabled: tab === 'transfers' && canSeeTransfers,
  });

  const displayedTabs: { id: ReportTab; label: string }[] = [
    { id: 'sales', label: 'Ventas y tendencias' },
    { id: 'products', label: 'Productos' },
    ...(canSeeTransfers ? [{ id: 'transfers' as const, label: 'Transferencias' }] : []),
  ];

  const invalidDates = from > to;
  const exportCsv = () => {
    if (!report) return;
    const headers = ['Fecha', 'Código', 'Estado', 'Cliente', 'Vendedor', 'Ubicación', 'Unidades', 'Total (Bs)'];
    const rows = report.sales.map((sale) => [
      new Date(sale.createdAt).toLocaleString('es-BO'),
      sale.code,
      sale.status,
      sale.client.fullName,
      sale.seller.fullName,
      sale.locationName,
      sale.items.reduce((sum, item) => sum + item.quantity, 0),
      sale.total.toFixed(2),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-ventas-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-print space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Análisis del negocio</p>
          <h1 className="mt-1 text-3xl font-bold">Reportes</h1>
          <p className="mt-1 text-sm text-muted">
            Consulta ventas, tendencias, productos y movimientos para tomar decisiones claras.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button
            className="btn-tertiary inline-flex items-center gap-2"
            onClick={() => window.print()}
          >
            <Printer size={17} /> Imprimir
          </button>
          {tab !== 'transfers' && (
            <button
              className="btn-secondary inline-flex items-center gap-2"
              disabled={!report?.sales.length}
              onClick={exportCsv}
            >
              <Download size={17} /> Descargar CSV
            </button>
          )}
        </div>
      </header>

      <section className="no-print card grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr_auto]">
        <label>
          <span className="label">Desde</span>
          <input className="input" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label>
          <span className="label">Hasta</span>
          <input className="input" type="date" value={to} min={from} max={today()} onChange={(event) => setTo(event.target.value)} />
        </label>
        {isAdmin ? (
          <label>
            <span className="label">Sucursal o bodega</span>
            <select className="input" value={location} onChange={(event) => setLocation(event.target.value)}>
              <option value="">Todas las ubicaciones</option>
              <optgroup label="Sucursales">
                {branches.map((branch) => (
                  <option key={`branch-${branch.id}`} value={`SUCURSAL:${branch.id}`}>{branch.name}</option>
                ))}
              </optgroup>
              <optgroup label="Bodegas">
                {warehouses.map((warehouse) => (
                  <option key={`warehouse-${warehouse.id}`} value={`BODEGA:${warehouse.id}`}>{warehouse.name}</option>
                ))}
              </optgroup>
            </select>
          </label>
        ) : (
          <div className="text-sm text-muted">
            <span className="label">Alcance del reporte</span>
            {isSeller ? 'Tus ventas de tu sucursal' : user?.role === 'ENCARGADO_SUCURSAL' ? 'Ventas de tu sucursal' : 'Ventas de fábrica'}
          </div>
        )}
        <button
          className="btn-primary inline-flex items-center justify-center gap-2"
          disabled={invalidDates || loadingSales}
          onClick={() => void refetchSales()}
        >
          <RefreshCw size={16} className={loadingSales ? 'animate-spin' : ''} /> Actualizar
        </button>
        {invalidDates && <p className="text-sm text-danger sm:col-span-2 lg:col-span-4">La fecha inicial debe ser anterior o igual a la fecha final.</p>}
      </section>

      <nav className="no-print flex gap-5 overflow-x-auto border-b border-line" aria-label="Secciones de reportes">
        {displayedTabs.map((item) => (
          <button
            key={item.id}
            className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-semibold transition ${
              tab === item.id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-ink'
            }`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'transfers' && canSeeTransfers ? (
        <TransfersReport
          transfers={transfers}
          loading={loadingTransfers}
          error={transfersError}
          onRetry={() => void refetchTransfers()}
        />
      ) : (
        <>
          {loadingSales && <p className="py-10 text-center text-muted">Preparando reporte del periodo…</p>}
          {salesError && (
            <div className="card text-center">
              <p className="text-danger">No se pudo cargar el reporte. Revisa tu conexión e inténtalo otra vez.</p>
              <button className="btn-secondary mt-4" onClick={() => void refetchSales()}>Reintentar</button>
            </div>
          )}
          {!loadingSales && !salesError && report && (
            <>
              <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                <h2 className="text-lg font-bold">{tab === 'sales' ? 'Resumen de ventas' : 'Rendimiento de productos'}</h2>
                <p className="text-sm text-muted">
                  {formatDate(report.period.from)} – {formatDate(report.period.to)}
                  <span className="print-only"> · Comparado con {formatDate(report.period.previousFrom)} – {formatDate(report.period.previousTo)}</span>
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Metric title="Ingresos netos" value={formatMoney(report.summary.total)} change={report.comparison.totalPercent} accent="primary" />
                <Metric title="Ventas completadas" value={number.format(report.summary.count)} change={report.comparison.countPercent} accent="secondary" />
                <Metric title="Promedio por venta" value={formatMoney(report.summary.averageTicket)} accent="success" />
                <Metric title="Unidades vendidas" value={number.format(report.summary.units)} accent="warning" />
                <Metric title="Ventas anuladas" value={number.format(report.summary.canceledCount)} accent="danger" />
              </div>

              {isAdmin && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="card border-l-4 border-l-blue-500 bg-page/40 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">Costo Fab. Total</span>
                    <p className="mt-1 text-2xl font-bold text-ink">{formatMoney(report.summary.totalCost ?? 0)}</p>
                    <p className="mt-1 text-xs text-muted">Costo de fabricación de unidades vendidas</p>
                  </div>
                  <div className="card border-l-4 border-l-emerald-500 bg-emerald-50/40 p-4 dark:bg-emerald-950/20">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Ganancia Bruta Real</span>
                    <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(report.summary.grossProfit ?? 0)}</p>
                    <p className="mt-1 text-xs text-muted">Ingresos netos menos costo de fabricación</p>
                  </div>
                  <div className="card border-l-4 border-l-purple-500 bg-purple-50/40 p-4 dark:bg-purple-950/20">
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">Margen de Rentabilidad</span>
                    <p className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">{(report.summary.profitMargin ?? 0).toFixed(1)}%</p>
                    <p className="mt-1 text-xs text-muted">Margen sobre el total vendido en el periodo</p>
                  </div>
                </div>
              )}

              {tab === 'sales' ? (
                <SalesOverview report={report} canSeeSellerBreakdown={canSeeSellerBreakdown} />
              ) : (
                <ProductsOverview products={report.topProducts} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Metric({
  title,
  value,
  change,
  accent,
}: {
  title: string;
  value: string;
  change?: number | null;
  accent: string;
}) {
  const isPositive = change !== null && change !== undefined && change >= 0;
  const accentBorder: Record<string, string> = {
    primary: 'border-primary',
    secondary: 'border-secondary',
    success: 'border-success',
    warning: 'border-warning',
    danger: 'border-danger',
  };
  return (
    <article className={`card border-l-4 ${accentBorder[accent]}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {change !== undefined && (
        <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${
          change === null ? 'text-muted' : isPositive ? 'text-success' : 'text-danger'
        }`}>
          {change === null ? 'Sin periodo previo comparable' : (
            <>
              {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Math.abs(change).toFixed(1)}% vs. periodo anterior
            </>
          )}
        </p>
      )}
    </article>
  );
}

function SalesOverview({
  report,
  canSeeSellerBreakdown,
}: {
  report: SalesReport;
  canSeeSellerBreakdown: boolean;
}) {
  return (
    <>
      <section className="card">
        <div className="mb-5 flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-bold">Evolución de ingresos</h3>
            <p className="text-xs text-muted">Ventas completadas por día</p>
          </div>
          <span className="text-xs text-muted">Moneda: bolivianos (Bs)</span>
        </div>
        <div className="h-72 w-full">
          {report.daily.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={report.daily} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="salesReportFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#07038C" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#07038C" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--theme-line, #E5E7EB)" />
                <XAxis dataKey="date" tickFormatter={(value: string) => formatDate(value).slice(0, 5)} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="revenue" tickFormatter={(value: number) => number.format(value)} width={72} tick={{ fontSize: 12 }} />
                <YAxis yAxisId="sales" orientation="right" allowDecimals={false} width={40} tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(value) => formatDate(String(value))}
                  formatter={(value, name) => name === 'count'
                    ? [`${number.format(Number(value))} ventas`, 'Operaciones']
                    : [formatMoney(Number(value)), 'Ingresos']}
                />
                <Legend formatter={(value) => value === 'total' ? 'Ingresos (Bs)' : 'Ventas'} />
                <Area yAxisId="revenue" type="monotone" dataKey="total" name="total" stroke="#07038C" strokeWidth={3} fill="url(#salesReportFill)" activeDot={{ r: 5 }} />
                <Line yAxisId="sales" type="monotone" dataKey="count" name="count" stroke="#F20732" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border-2 border-dashed border-line text-sm text-muted">
              No hay ventas completadas en este periodo.
            </div>
          )}
        </div>
      </section>

      <div className={`grid grid-cols-1 gap-6 ${canSeeSellerBreakdown ? 'xl:grid-cols-2' : ''}`}>
        <section className="card overflow-x-auto">
          <h3 className="mb-1 font-bold">Ingresos por ubicación</h3>
          <p className="mb-4 text-xs text-muted">Desglose de ventas completadas en el periodo.</p>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Sucursal / ubicación</th><th className="py-2 text-right">Ingresos</th></tr></thead>
            <tbody>
              {report.byBranch.map((branch) => (
                <tr key={branch.name} className="border-b border-line/60">
                  <td className="py-3 font-medium">{branch.name}</td>
                  <td className="py-3 text-right font-bold text-primary">{formatMoney(branch.total)}</td>
                </tr>
              ))}
              {!report.byBranch.length && <tr><td colSpan={2} className="py-5 text-center text-muted">Sin datos para mostrar.</td></tr>}
            </tbody>
          </table>
        </section>

        {canSeeSellerBreakdown && (
          <section className="card overflow-x-auto">
            <h3 className="mb-1 font-bold">Rendimiento de vendedores</h3>
            <p className="mb-4 text-xs text-muted">Ordenado por ingresos completados.</p>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Vendedor</th><th className="py-2 text-right">Ventas</th><th className="py-2 text-right">Ingresos</th></tr></thead>
              <tbody>
                {report.bySeller.map((seller) => (
                  <tr key={seller.id} className="border-b border-line/60">
                    <td className="py-3 font-medium">{seller.name}</td>
                    <td className="py-3 text-right">{seller.count}</td>
                    <td className="py-3 text-right font-bold text-primary">{formatMoney(seller.total)}</td>
                  </tr>
                ))}
                {!report.bySeller.length && <tr><td colSpan={3} className="py-5 text-center text-muted">Sin ventas en el periodo.</td></tr>}
              </tbody>
            </table>
          </section>
        )}
      </div>

      <section className="card overflow-x-auto">
        <h3 className="mb-1 font-bold">Detalle de ventas</h3>
        <p className="mb-4 text-xs text-muted">
        Mostrando {number.format(report.sales.length)} de {number.format(report.summary.count + report.summary.canceledCount)} operaciones del periodo.
        {report.sales.length >= 500 && ' La tabla y el CSV muestran como máximo 500 operaciones.'}
        </p>
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2">Fecha</th><th className="py-2">Código</th><th className="py-2">Cliente</th>
              <th className="py-2">Vendedor</th><th className="py-2">Ubicación</th><th className="py-2 text-right">Unidades</th><th className="py-2 text-right">Total</th><th className="py-2 text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            {report.sales.map((sale) => (
              <tr key={sale.id} className="border-b border-line/60">
                <td className="py-2">{new Date(sale.createdAt).toLocaleDateString('es-BO')}</td>
                <td className="py-2 font-medium">{sale.code}</td>
                <td className="py-2">{sale.client.fullName}</td>
                <td className="py-2">{sale.seller.fullName}</td>
                <td className="py-2">{sale.locationName}</td>
                <td className="py-2 text-right">{sale.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                <td className="py-2 text-right font-bold">{formatMoney(sale.total)}</td>
                <td className="py-2 text-center">
                  <span className={`badge ${sale.status === 'ACTIVA' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                    {sale.status === 'ACTIVA' ? 'Completada' : 'Anulada'}
                  </span>
                </td>
              </tr>
            ))}
            {!report.sales.length && <tr><td colSpan={8} className="py-6 text-center text-muted">No hay operaciones en este periodo.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}

function ProductsOverview({ products }: { products: SalesReport['topProducts'] }) {
  const highestQuantity = Math.max(...products.map((product) => product.quantity), 1);
  return (
    <section className="card overflow-x-auto">
      <h3 className="mb-1 font-bold">Productos más vendidos</h3>
      <p className="mb-5 text-xs text-muted">Ranking por unidades y los ingresos que generó cada variante.</p>
      <table className="w-full min-w-[650px] text-sm">
        <thead><tr className="border-b border-line text-left text-muted"><th className="py-2">#</th><th className="py-2">SKU</th><th className="py-2">Producto</th><th className="py-2">Unidades</th><th className="py-2 text-right">Ingresos</th></tr></thead>
        <tbody>
          {products.map((product, index) => (
            <tr key={product.sku} className="border-b border-line/60">
              <td className="py-3 font-bold text-muted">{index + 1}</td>
              <td className="py-3 font-medium">{product.sku}</td>
              <td className="py-3">
                <span className="mb-1 block">{product.name}</span>
                <span className="block h-1.5 rounded-full bg-primary/15" style={{ width: `${Math.max(8, (product.quantity / highestQuantity) * 100)}%` }} />
              </td>
              <td className="py-3">{number.format(product.quantity)}</td>
              <td className="py-3 text-right font-bold text-primary">{formatMoney(product.revenue)}</td>
            </tr>
          ))}
          {!products.length && <tr><td colSpan={5} className="py-8 text-center text-muted">No hay productos vendidos en el periodo seleccionado.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

function TransfersReport({
  transfers,
  loading,
  error,
  onRetry,
}: {
  transfers: any[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const counts = transfers.reduce<Record<string, number>>((result, transfer) => {
    result[transfer.status] = (result[transfer.status] ?? 0) + 1;
    return result;
  }, {});

  if (loading) return <p className="py-10 text-center text-muted">Cargando transferencias…</p>;
  if (error) return (
    <div className="card text-center">
      <p className="text-danger">No se pudieron cargar las transferencias.</p>
      <button className="btn-secondary mt-4" onClick={onRetry}>Reintentar</button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {['PENDIENTE', 'ENVIADA', 'RECIBIDA', 'CERRADA'].map((status) => (
          <article key={status} className="card">
            <p className="text-xs font-bold uppercase text-muted">{status}</p>
            <p className="mt-2 text-3xl font-bold">{counts[status] ?? 0}</p>
          </article>
        ))}
      </div>
      <section className="card overflow-x-auto">
        <h3 className="mb-1 font-bold">Últimas transferencias</h3>
        <p className="mb-4 text-xs text-muted">Resumen de estados y hasta las 200 transferencias más recientes.</p>
        <table className="w-full min-w-[620px] text-sm">
          <thead><tr className="border-b border-line text-left text-muted"><th className="py-2">Código</th><th className="py-2">Fecha</th><th className="py-2">Origen</th><th className="py-2">Destino</th><th className="py-2 text-right">Ítems</th><th className="py-2 text-center">Estado</th></tr></thead>
          <tbody>
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="border-b border-line/60">
                <td className="py-3 font-medium">{transfer.code}</td>
                <td className="py-3">{new Date(transfer.createdAt).toLocaleDateString('es-BO')}</td>
                <td className="py-3">{transfer.sourceWarehouse?.name ?? 'Bodega'}</td>
                <td className="py-3">{transfer.destinationType === 'SUCURSAL' ? transfer.destinationBranch?.name : (transfer.thirdParty?.name ?? 'Tercero')}</td>
                <td className="py-3 text-right">{transfer.items?.length ?? 0}</td>
                <td className="py-3 text-center"><span className="badge bg-page text-ink">{transfer.status}</span></td>
              </tr>
            ))}
            {!transfers.length && <tr><td colSpan={6} className="py-6 text-center text-muted">No hay transferencias registradas.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
