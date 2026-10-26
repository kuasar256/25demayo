interface Props {
  label: string;
  value: string | number;
  accent?: 'primary' | 'secondary';
  hint?: string;
}

/** Tarjeta de métrica con número grande (doc 6.4.4) */
export function MetricCard({ label, value, accent = 'secondary', hint }: Props) {
  return (
    <div className={`card border-l-4 ${accent === 'primary' ? 'border-l-primary' : 'border-l-secondary'}`}>
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}
