type PaginationControlsProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function PaginationControls({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const pageCount = Math.max(totalPages, 1);

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted">
          {total === 0
            ? '0 registros'
            : `Mostrando ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`}
        </p>
        <label className="flex items-center gap-2 text-sm text-muted">
          Filas:
          <select
            className="input w-auto py-1"
            aria-label="Filas por página"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-tertiary"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Anterior
        </button>
        <span className="text-sm text-muted">Página {page} de {pageCount}</span>
        <button
          type="button"
          className="btn-tertiary"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
