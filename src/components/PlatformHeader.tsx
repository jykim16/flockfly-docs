import { Logo } from './Logo';

const platformSections = ['Skills', 'Routers', 'Sessions'] as const;

export function PlatformHeader() {
  return <header className="platform-header" aria-label="Flockfly platform navigation">
    <Logo />
    <nav aria-label="Platform">
      {platformSections.map(section => <a key={section} href={`https://platform.flockfly.ai/${section.toLowerCase()}`}>{section}</a>)}
      <a className="active" href="#" aria-current="page">Flockdoc</a>
    </nav>
    <div className="user-chip"><i aria-hidden="true" /><span>jkim@flockfly.ai</span></div>
  </header>;
}
