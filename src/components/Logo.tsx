export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="brand" aria-label="Flockdoc"><span className="brand-mark">F</span>{!compact && <span>Flockdoc</span>}</div>;
}
