export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="brand" aria-label="Flockfly Flockdoc">
    <img className="brand-mark" src="/icon.png" alt="" />
    {!compact && <span>Flockfly <em>Flockdoc</em></span>}
  </div>;
}
