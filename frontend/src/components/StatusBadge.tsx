const STYLES: Record<string, string> = {
  ACTIVA: 'bg-success/10 text-success',
  ANULADA: 'bg-danger/10 text-danger',
  PENDIENTE: 'bg-warning/15 text-warning',
  ENVIADA: 'bg-secondary/10 text-secondary',
  RECIBIDA: 'bg-success/10 text-success',
  CERRADA: 'bg-line text-muted',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STYLES[status] ?? 'bg-line text-muted'}`}>{status}</span>;
}
