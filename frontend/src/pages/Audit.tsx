import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { auditActionLabel, auditModuleLabel, presentAudit } from '../lib/auditPresentation';
import { PaginationControls } from '../components/PaginationControls';

export function AuditPage() {
  const [userId, setUserId] = useState('');
  const [module, setModule] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: auditResults, isLoading, isError } = useQuery({
    queryKey: ['audit', userId, module, from, to, page, pageSize],
    queryFn: async () => (
      await api.get('/reports/audit', {
        params: {
          userId: userId || undefined,
          module: module || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          pageSize,
        },
      })
    ).data,
  });
  const logs = auditResults?.items ?? [];
  const invalidDates = Boolean(from && to && from > to);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Bitácora de Auditoría</h1>
      </div>

      <section className="card grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className="label">ID de usuario</span>
          <input
            className="input"
            type="number"
            min="1"
            value={userId}
            onChange={(event) => {
              setUserId(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          <span className="label">Módulo</span>
          <input
            className="input"
            maxLength={50}
            placeholder="Ej. sales"
            value={module}
            onChange={(event) => {
              setModule(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          <span className="label">Desde</span>
          <input
            className="input"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          <span className="label">Hasta</span>
          <input
            className="input"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </section>
      {invalidDates && <p className="text-danger" role="alert">La fecha inicial no puede ser posterior a la fecha final.</p>}

      {isLoading ? <p className="text-muted">Cargando...</p> : isError ? (
        <p className="text-danger" role="alert">No se pudo cargar la bitácora. Intente nuevamente.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-2">Fecha y Hora</th>
                <th className="py-2">Usuario</th>
                <th className="py-2">Acción</th>
                <th className="py-2">Módulo</th>
                <th className="py-2">Detalle / Cambios</th>
                <th className="py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {(logs ?? []).map((l: any) => (
                <tr key={l.id} className="border-b border-line/60 hover:bg-page/60">
                  <td className="py-2 text-muted">{new Date(l.createdAt).toLocaleString('es-BO')}</td>
                  <td className="py-2 font-medium">{l.user?.fullName || 'Sistema'}</td>
                  <td className="py-2">
                    <span className="badge bg-page border border-line text-ink">{auditActionLabel(l.action)}</span>
                  </td>
                  <td className="py-2">{auditModuleLabel(l.module)}{l.entityId != null && <span className="block text-xs text-muted">Registro #{l.entityId}</span>}</td>
                  <td className="py-3 text-sm max-w-sm min-w-60">
                    <AuditDetails entry={l} />
                  </td>
                  <td className="py-2 text-xs text-muted">{l.ip || '-'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-muted">No hay registros de auditoría.</td></tr>
              )}
            </tbody>
          </table>
          <PaginationControls
            page={auditResults?.page ?? page}
            pageSize={auditResults?.pageSize ?? pageSize}
            total={auditResults?.total ?? 0}
            totalPages={auditResults?.totalPages ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}

function AuditDetails({ entry }: { entry: { action: string; module: string; detail?: string | null } }) {
  const detail = presentAudit(entry);
  return <div className="space-y-2 whitespace-normal break-words">
    <p>{detail.summary}</p>
    {detail.fields.length > 0 && <details className="text-xs text-muted">
      <summary className="cursor-pointer text-primary">Ver campos de la operación</summary>
      <p className="mt-2 leading-relaxed">{detail.fields.join(', ')}.</p>
      <p className="mt-1">Este registro conserva los nombres de los campos, sin valores anteriores o nuevos.</p>
    </details>}
  </div>;
}
