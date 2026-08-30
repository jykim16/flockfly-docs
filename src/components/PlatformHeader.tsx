import { Logo } from './Logo';

const platformSections = [
  ['Skills', '#/skills'],
  ['Routers', '#/routers'],
  ['Sessions', '#/sessions'],
] as const;

export interface PlatformAccount {
  email: string;
  entitled: boolean;
}

export function PlatformHeader({ account, workspaceLabel = 'Preview workspace' }: { account?: PlatformAccount | null; workspaceLabel?: string }) {
  return <header className="platform-header" aria-label="Flockfly platform navigation">
    <Logo />
    <nav aria-label="Platform">
      {platformSections.map(([section, route]) => <a key={section} href={`https://platform.flockfly.ai/${route}`}>{section}</a>)}
      <a href="/flockdoc/" aria-current="page">Flockdoc</a>
      <a href="https://platform.flockfly.ai/#/getting-started">Getting started</a>
    </nav>
    <div className="spacer" />
    {account
      ? <a href="https://platform.flockfly.ai/#/account" className="user-chip">
          {account.email}
          {account.entitled ? <span className="tag pro-badge">Pro</span> : null}
        </a>
      : <div className="user-chip"><span>{workspaceLabel}</span></div>}
  </header>;
}
