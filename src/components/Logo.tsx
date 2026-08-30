export function Logo({ compact = false }: { compact?: boolean }) {
  return <a className="brand" href="https://platform.flockfly.ai/" aria-label="Flockfly Platform">
    <img className="brand-mark" src={`${import.meta.env.BASE_URL}icon.png`} alt="" />
    {!compact && <span>Flockfly <span className="platform">Platform</span></span>}
  </a>;
}
