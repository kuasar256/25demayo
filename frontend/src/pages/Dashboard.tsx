import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check,
  Layers3, Package, Plus, RefreshCw, Sparkles, Truck, TriangleAlert } from 'lucide-react';
import { api } from '../lib/api';
import { ROLE_LABELS, useAuthStore } from '../store/auth';
import './dashboard.css';

interface StockAlert { sku: string; locationType: string; locationId: number; quantity: number; minStock: number }
interface TopProduct { name: string; quantity: number; imageUrl: string | null }
interface DashboardData {
  salesToday: { total: number; count: number }; salesMonth: { total: number; count: number };
  pendingTransfers: number; criticalStock: StockAlert[]; topProducts: TopProduct[];
}
interface PeriodReport {
  daily: { date: string; total: number; count: number }[];
  summary: { total: number; count: number; averageTicket: number; units: number };
  comparison: { totalPercent: number | null };
  sales: { id: number; code: string; total: number; status: string; client: { fullName: string } }[];
}
interface Notice { id: number; type: string; title: string; message: string; createdAt: string }
const money = (value: number) => `Bs ${new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
const number = (value: number) => new Intl.NumberFormat('es-BO').format(value);
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });
const colors = ['var(--flow-accent)', 'var(--flow-violet)', 'var(--flow-mint)', 'var(--flow-rose)', 'var(--flow-amber)'];

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [period, setPeriod] = useState<7 | 30>(30);
  const today = dateKey(new Date());
  const range = useMemo(() => {
    const start = new Date(`${today}T12:00:00`);
    start.setDate(start.getDate() - period + 1);
    return { from: dateKey(start), to: today };
  }, [today, period]);
  const salesRole = user?.role !== 'ENCARGADO_FABRICA';
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard', user?.id, user?.role],
    queryFn: async () => (await api.get('/reports/dashboard')).data,
  });
  const report = useQuery<PeriodReport>({
    queryKey: ['dashboard-period', user?.id, user?.role, range.from, range.to],
    queryFn: async () => (await api.get('/reports/sales', { params: range })).data,
  });
  const notices = useQuery<Notice[]>({
    queryKey: ['notifications'], queryFn: async () => (await api.get('/notifications')).data,
    staleTime: 30_000,
  });
  const alerts = data?.criticalStock ?? [];
  const products = data?.topProducts ?? [];
  const comparison = report.data?.comparison.totalPercent;
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || 'Bienvenido';
  const refresh = () => { void refetch(); void report.refetch(); void notices.refetch(); };

  return (
    <div className="flow-dashboard">
      <header className="flow-heading">
        <div>
          <span className="flow-eyebrow"><span /> TU NEGOCIO, EN PERSPECTIVA</span>
          <h1>Un buen día comienza aquí, <em>{firstName}.</em></h1>
          <p>Una mirada a tus ventas, tus productos y lo que necesita tu atención.</p>
        </div>
        <div className="flow-heading-actions">
          <button className="flow-icon-button" onClick={refresh} aria-label="Actualizar dashboard" disabled={isLoading || report.isFetching}>
            <RefreshCw size={17} className={isLoading || report.isFetching ? 'animate-spin' : ''} />
          </button>
          <Link className="flow-action" to={salesRole ? '/ventas/nueva' : '/produccion'}>
            <Plus size={17} />{salesRole ? 'Nueva venta' : 'Ir al taller'}
          </Link>
        </div>
      </header>

      <div className="flow-context">
        <span><span className="flow-context-dot" />{user ? ROLE_LABELS[user.role] : 'Resumen operativo'}</span>
        <span><CalendarDays size={14} />{new Date(`${today}T12:00:00`).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>

      {isError && <div className="flow-error" role="alert">No se pudo cargar el resumen. <button onClick={() => void refetch()}>Volver a intentar</button></div>}

      <div className="flow-body">
        <div className="flow-main">
          <section className={`flow-metrics ${!salesRole ? 'flow-metrics-two' : ''}`} aria-label="Indicadores del negocio">
            {salesRole && <Metric label="Ventas de hoy" value={isError ? '—' : money(data?.salesToday.total ?? 0)} hint={`${number(data?.salesToday.count ?? 0)} ventas activas`} currency="Bs" tone="blue" loading={isLoading} />}
            {salesRole && <Metric label="Acumulado del mes" value={isError ? '—' : money(data?.salesMonth.total ?? 0)} hint={`${number(data?.salesMonth.count ?? 0)} operaciones este mes`} icon={Layers3} tone="violet" loading={isLoading} />}
            <Metric label="Transferencias" value={isError ? '—' : number(data?.pendingTransfers ?? 0)} hint="Pendientes o en camino" icon={Truck} tone="mint" loading={isLoading} href="/transferencias" />
            <Metric label="Stock por revisar" value={isError ? '—' : number(alerts.length)} hint="Existencias en el mínimo o por debajo" icon={TriangleAlert} tone={alerts.length ? 'rose' : 'mint'} loading={isLoading} href="/inventario" />
          </section>

          <section className="flow-panel flow-chart-panel">
            <div className="flow-panel-heading">
              <div><span className="flow-kicker">EL PULSO DE TU NEGOCIO</span><h2>Evolución de ventas</h2></div>
              <div className="flow-segment" aria-label="Periodo de ventas">
                {([7, 30] as const).map((days) => <button key={days} aria-pressed={period === days} onClick={() => setPeriod(days)}>{days} días</button>)}
              </div>
            </div>
            <div className="flow-chart-summary">
              <strong>{report.isLoading ? '…' : report.data ? money(report.data.summary.total) : '—'}</strong>
              {report.data && comparison != null && <span className={`flow-change ${comparison < 0 ? 'negative' : ''}`}>
                {comparison < 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}{Math.abs(comparison).toFixed(1)} % <span>vs. periodo anterior</span>
              </span>}
              {report.data && comparison == null && <span className="flow-small-muted">Sin base comparativa anterior</span>}
            </div>
            <div className="flow-chart">
              {report.isLoading ? <div className="flow-skeleton" aria-label="Cargando gráfico" /> : report.isError ? (
                <div className="flow-empty">No se pudo cargar la evolución de ventas.<button onClick={() => void report.refetch()}>Reintentar</button></div>
              ) : report.data?.daily.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.data.daily} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                    <defs><linearGradient id="flowRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--flow-chart-blue)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--flow-chart-blue)" stopOpacity={0.015} /></linearGradient></defs>
                    <CartesianGrid stroke="var(--flow-grid)" strokeDasharray="3 6" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={36} axisLine={false} tickLine={false} tick={{ fill: 'var(--flow-muted)', fontSize: 11 }} dy={8} />
                    <YAxis width={56} axisLine={false} tickLine={false} tick={{ fill: 'var(--flow-muted)', fontSize: 11 }} tickFormatter={(value: number) => value >= 1000 ? `${number(value / 1000)}k` : number(value)} />
                    <Tooltip content={<RevenueTooltip />} cursor={{ stroke: 'var(--flow-chart-blue)', strokeDasharray: '4 4' }} />
                    <Area name="Ventas" type="monotone" dataKey="total" stroke="var(--flow-chart-blue)" strokeWidth={2.5} fill="url(#flowRevenueFill)" activeDot={{ r: 5, fill: 'var(--flow-chart-blue)', stroke: 'var(--flow-panel)', strokeWidth: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="flow-empty">Todavía no hay información para este periodo.</div>}
            </div>
            <div className="flow-chart-footer"><span><i />Ventas registradas en bolivianos</span><Link to="/reportes">Explorar reportes <ArrowUpRight size={14} /></Link></div>
          </section>

          <div className="flow-lower-grid">
            <section className="flow-panel">
              <div className="flow-panel-heading"><div><span className="flow-kicker">ÚLTIMAS OPERACIONES</span><h2>Ventas recientes</h2></div><Link className="flow-subtle-link" to="/ventas">Ver todas <ArrowUpRight size={14} /></Link></div>
              {report.isLoading ? <div className="flow-list-skeleton" /> : report.data?.sales.length ? (
                <div className="flow-table-wrap"><table className="flow-table"><thead><tr><th>Venta / cliente</th><th>Importe</th><th>Estado</th></tr></thead><tbody>
                  {report.data.sales.slice(0, 4).map((sale) => <tr key={sale.id}><td><strong>{sale.code}</strong><span>{sale.client?.fullName || 'Cliente'}</span></td><td>{money(sale.total)}</td><td><span className={`flow-status ${sale.status === 'ANULADA' ? 'cancelled' : ''}`}><i />{sale.status === 'ANULADA' ? 'Anulada' : 'Activa'}</span></td></tr>)}
                </tbody></table></div>
              ) : <div className="flow-empty flow-compact">{report.isError ? 'No se pudieron cargar las ventas.' : 'Sin ventas en el periodo seleccionado.'}</div>}
            </section>

            <section className="flow-panel">
              <div className="flow-panel-heading"><div><span className="flow-kicker">LO QUE MÁS SE MUEVE</span><h2>Productos destacados</h2></div><Package size={18} className="flow-muted-icon" /></div>
              <div className="flow-products">{isLoading ? <div className="flow-list-skeleton" /> : products.length ? products.map((product, index) => (
                <div className="flow-product" key={`${product.name}-${index}`}>
                  <div className="flow-product-icon" style={{ color: colors[index % colors.length] }}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <Package size={17} />}</div>
                  <div className="flow-product-content"><div><span title={product.name}>{product.name}</span><strong>{number(product.quantity)} <small>un.</small></strong></div><div className="flow-progress"><span style={{ width: `${products[0].quantity ? product.quantity / products[0].quantity * 100 : 0}%`, background: colors[index % colors.length] }} /></div></div>
                </div>
              )) : <div className="flow-empty flow-compact">{isError ? 'No se pudieron cargar los productos.' : 'Los productos más vendidos aparecerán aquí.'}</div>}</div>
              <div className="flow-panel-note">Según las unidades vendidas durante el mes actual.</div>
            </section>
          </div>

          {alerts.length > 0 && <section className="flow-panel flow-stock-panel">
            <div className="flow-panel-heading"><div><span className="flow-kicker">ATENCIÓN A LOS DETALLES</span><h2><TriangleAlert size={17} />Inventario por reponer</h2></div><Link className="flow-subtle-link" to="/inventario">Ver inventario <ArrowUpRight size={14} /></Link></div>
            <div className="flow-table-wrap"><table className="flow-table"><thead><tr><th>Producto</th><th>Ubicación</th><th>Disponible</th><th>Mínimo</th></tr></thead><tbody>
              {alerts.slice(0, 5).map((stock, i) => <tr key={`${stock.sku}-${stock.locationId}-${i}`}><td><strong>{stock.sku}</strong></td><td>{stock.locationType === 'SUCURSAL' ? 'Sucursal' : 'Bodega'} · {stock.locationId}</td><td className="flow-stock-count">{stock.quantity}</td><td>{stock.minStock}</td></tr>)}
            </tbody></table></div>
          </section>}
        </div>

        <aside className="flow-rail" aria-label="Actividad del negocio">
          <section className="flow-spotlight"><div className="flow-spotlight-orbit" aria-hidden="true"><Layers3 size={34} /></div><span className="flow-kicker">MENOS RUIDO. MÁS CLARIDAD.</span><h2>Cada detalle cuenta.<br />Tu fábrica, en orden.</h2><Link to="/inventario">Revisar existencias <ArrowRight size={16} /></Link></section>
          <section className="flow-panel flow-activity"><div className="flow-panel-heading"><div><span className="flow-kicker">LO MÁS RECIENTE</span><h2>Actividad</h2></div><Sparkles size={17} className="flow-muted-icon" /></div>
            {notices.isLoading ? <div className="flow-list-skeleton" /> : notices.data?.length ? <div className="flow-activity-list">{notices.data.slice(0, 3).map((notice) => <div className="flow-activity-item" key={notice.id}>
              <span className={`flow-activity-icon ${notice.type === 'STOCK_CRITICO' ? 'alert' : ''}`}>{notice.type === 'STOCK_CRITICO' ? <TriangleAlert size={14} /> : notice.type.startsWith('TRANSFERENCIA') ? <Truck size={14} /> : <Check size={14} />}</span>
              <div><strong>{notice.title}</strong><p title={notice.message}>{notice.message}</p><time dateTime={notice.createdAt}>{new Date(notice.createdAt).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>
            </div>)}</div> : <div className="flow-empty flow-compact">{notices.isError ? 'No se pudo cargar la actividad.' : 'Todo tranquilo. No tienes notificaciones.'}</div>}
          </section>
        </aside>
      </div>
      <footer className="flow-page-footer"><span>COLCHONES 25 DE MAYO</span><span>Una visión clara para decidir mejor.</span></footer>
    </div>
  );
}

function Metric({ label, value, hint, icon: Icon, tone, loading, href, currency }: { label: string; value: string; hint: string; icon?: typeof Package; currency?: string; tone: string; loading: boolean; href?: string }) {
  const content = <><div className="flow-metric-top"><span>{label}</span><span className={`flow-metric-icon ${tone}`}>{currency ? <span className="text-sm font-bold" aria-label="Bolivianos">{currency}</span> : Icon ? <Icon size={19} /> : null}</span></div><strong className={loading ? 'flow-value-loading' : ''}>{loading ? '…' : value}</strong><p>{hint}</p>{href && <ArrowUpRight className="flow-metric-arrow" size={15} />}</>;
  return href ? <Link to={href} className="flow-panel flow-metric">{content}</Link> : <div className="flow-panel flow-metric">{content}</div>;
}

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value?: number; payload?: { count: number } }[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return <div className="flow-tooltip"><span>{shortDate(String(label))}</span><strong>{money(Number(payload[0].value ?? 0))}</strong><small>{payload[0].payload?.count ?? 0} ventas</small></div>;
}
