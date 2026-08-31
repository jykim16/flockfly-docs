import { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Search } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { PlatformHeader } from './components/PlatformHeader';
import { PaperEditor } from './features/editor/PaperEditor';
import { RemoteEditor } from './features/editor/RemoteEditor';
import { SpreadsheetEditor } from './features/editor/SpreadsheetEditor';
import { FlockdocTable } from './features/workspace/FlockdocTable';
import { FolderBreadcrumb } from './features/workspace/FolderBreadcrumb';
import { consumeAuthTokenFromHash, FlockdocApi, getToken, googleSignInUrl, supportsPlatformSession } from './lib/api';
import { flockdocRoleLabel } from './lib/flockdoc-roles';
import { registerFlockdocWebMCP } from './lib/webmcp';
import { currentFlockdocPath, migrateLegacyFlockdocPath, navigateFlockdoc } from './lib/navigation';
import { loadWorkspace, saveWorkspace } from './lib/workspace-storage';
import { allPrefixes, immediatePrefixes, normalizePrefix, prefixName } from './lib/prefixes';
import type { Flockdoc, FlockdocInvitation, FlockdocType, WorkspaceFilter } from './types';
import './styles.css';

function routeFor(item: Flockdoc) { return `/flockdoc/${item.type}/${item.id}`; }
export default function App() {
  const [token] = useState(() => {
    const isAuthCallback = location.hash.startsWith('#/auth') || location.pathname === '/flockdoc/auth';
    const consumed = consumeAuthTokenFromHash(location.hash);
    if (isAuthCallback) history.replaceState(null, '', '/flockdoc/');
    return consumed ?? getToken();
  });
  const [items, setItems] = useState<Flockdoc[]>(() => loadWorkspace(localStorage));
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [filter, setFilter] = useState<WorkspaceFilter>('all');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [route, setRoute] = useState(currentFlockdocPath);
  const [syncStatus, setSyncStatus] = useState<'browser' | 'loading' | 'synced' | 'error'>('loading');
  const [authenticated, setAuthenticated] = useState(false);
  const [account, setAccount] = useState<{ email: string; entitled: boolean } | null>(null);
  const [invitations, setInvitations] = useState<FlockdocInvitation[]>([]);
  const api = useMemo(() => new FlockdocApi(token ?? undefined), [token]);
  const cloudApi = authenticated ? api : null;
  const itemsRef = useRef(items);
  const apiRef = useRef(cloudApi);

  useEffect(() => {
    const handler = () => { const next = currentFlockdocPath(); migrateLegacyFlockdocPath(); setRoute(next); };
    migrateLegacyFlockdocPath();
    addEventListener('popstate', handler);
    addEventListener('hashchange', handler);
    return () => { removeEventListener('popstate', handler); removeEventListener('hashchange', handler); };
  }, []);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { apiRef.current = cloudApi; }, [cloudApi]);
  useEffect(() => { saveWorkspace(items, localStorage); }, [items]);
  useEffect(() => {
    let active = true;
    if (!supportsPlatformSession()) {
      setSyncStatus('browser');
      return () => { active = false; };
    }
    setSyncStatus('loading');
    void api.session().then(session => {
      if (active) setAccount({ email: session.user.email, entitled: session.billing?.entitled === true });
      const shareToken = new URLSearchParams(location.search).get('share');
      const claim = shareToken ? api.claimShareLink(shareToken).then(() => {
        history.replaceState(null, '', location.pathname);
      }) : Promise.resolve();
      return claim.then(() => Promise.all([api.list(), api.listInvitations()]));
    }).then(async ([listed, pending]) => {
      const requestedId = currentFlockdocPath().match(/^\/flockdoc\/(?:paper|spreadsheet)\/([^/]+)/)?.[1];
      if (requestedId && !listed.flockdocs.some(item => item.id === requestedId)) {
        try { await api.joinPublic(requestedId); listed = await api.list(); } catch { /* Restricted documents remain hidden. */ }
      }
      return { flockdocs: listed.flockdocs, invitations: pending.invitations };
    }).then(({ flockdocs, invitations: pending }) => {
      if (!active) return;
      setAuthenticated(true);
      setItems(flockdocs);
      setInvitations(pending);
      setSyncStatus('synced');
    }).catch(error => {
      if (!active) return;
      setAuthenticated(false);
      setAccount(null);
      setSyncStatus(error instanceof Error && 'status' in error && [401, 403, 404].includes(Number(error.status)) ? 'browser' : 'error');
    });
    return () => { active = false; };
  }, [api]);
  useEffect(() => registerFlockdocWebMCP({ modelContext: document.modelContext, actions: {
    listFlockdocs: () => ({ flockdocs: itemsRef.current, prefixes: allPrefixes(itemsRef.current) }),
    createFlockdoc: async ({ name, type, prefix }) => {
      const remoteApi = apiRef.current;
      const targetPrefix = normalizePrefix(typeof prefix === 'string' ? prefix : '');
      const next = remoteApi
        ? (await remoteApi.create(String(name), type as FlockdocType, targetPrefix)).flockdoc
        : { id: crypto.randomUUID(), name: String(name), type: type as FlockdocType, prefix: targetPrefix, modifiedAt: 'Just now', collaborators: [] };
      setItems(current => [next, ...current]);
      return { flockdoc: next };
    },
    renameFlockdoc: async ({ id, name }) => {
      const remoteApi = apiRef.current;
      if (remoteApi) await remoteApi.rename(String(id), String(name));
      setItems(current => current.map(item => item.id === id ? { ...item, name: String(name) } : item));
      return { ok: true };
    },
    moveFlockdoc: async ({ id, prefix }) => {
      const remoteApi = apiRef.current;
      const targetPrefix = normalizePrefix(typeof prefix === 'string' ? prefix : '');
      const currentItem = itemsRef.current.find(item => item.id === id);
      const moved = remoteApi ? (await remoteApi.move(String(id), targetPrefix)).flockdoc : currentItem ? { ...currentItem, prefix: targetPrefix, modifiedAt: 'Just now' } : null;
      setItems(current => current.map(item => item.id === id && moved ? moved : item));
      return { flockdoc: moved };
    },
    deleteFlockdoc: async ({ id }) => {
      const remoteApi = apiRef.current;
      if (remoteApi) await remoteApi.trash(String(id));
      setItems(current => current.filter(item => item.id !== id));
      return { ok: true };
    },
  }}), []);

  const visibleItems = useMemo(() => items.filter(item => item.prefix === currentPrefix && (filter === 'all' || item.type === filter) && item.name.toLowerCase().includes(query.toLowerCase())), [currentPrefix, filter, items, query]);
  const visiblePrefixes = useMemo(() => immediatePrefixes(items, currentPrefix).filter(prefix => prefixName(prefix).toLowerCase().includes(query.toLowerCase())), [currentPrefix, items, query]);
  const knownPrefixes = useMemo(() => allPrefixes(items), [items]);
  const routeMatch = route.match(/^\/flockdoc\/(paper|spreadsheet)\/([^/]+)/);
  if (routeMatch) {
    const item = items.find(entry => entry.id === routeMatch[2]);
    const updateItem = (updates: Partial<Flockdoc>) => setItems(current => current.map(entry => entry.id === item?.id ? { ...entry, ...updates } : entry));
    if (item) return <div className="editor-app">
      <PlatformHeader account={account} />
      {cloudApi
        ? <RemoteEditor api={cloudApi} item={item} currentUserEmail={account?.email} onBack={() => navigateFlockdoc('/flockdoc/')} onUpdate={updateItem} />
        : item.type === 'paper'
          ? <PaperEditor key={item.id} item={item} onBack={() => navigateFlockdoc('/flockdoc/')} onRename={name => updateItem({ name, modifiedAt: 'Just now' })} onSnapshot={snapshot => updateItem({ snapshot, modifiedAt: 'Just now' })} />
          : <SpreadsheetEditor key={item.id} item={item} onBack={() => navigateFlockdoc('/flockdoc/')} onRename={name => updateItem({ name, modifiedAt: 'Just now' })} onSnapshot={snapshot => updateItem({ snapshot, modifiedAt: 'Just now' })} />}
    </div>;
  }

  const create = async (type: 'paper' | 'spreadsheet') => {
    setMenuOpen(false);
    const name = type === 'paper' ? 'Untitled Paper' : 'Untitled Spreadsheet';
    const item: Flockdoc = cloudApi
      ? (await cloudApi.create(name, type, currentPrefix)).flockdoc
      : { id: crypto.randomUUID(), name, type, prefix: currentPrefix, modifiedAt: 'Just now', collaborators: [] };
    setItems(current => [item, ...current]); navigateFlockdoc(routeFor(item));
  };

  const moveFlockdoc = async (item: Flockdoc, prefix: string) => {
    const targetPrefix = normalizePrefix(prefix);
    const moved = cloudApi ? (await cloudApi.move(item.id, targetPrefix)).flockdoc : { ...item, prefix: targetPrefix, modifiedAt: 'Just now' };
    setItems(current => current.map(entry => entry.id === item.id ? moved : entry));
  };
  const deleteFlockdoc = async (item: Flockdoc) => {
    if (cloudApi) await cloudApi.trash(item.id);
    setItems(current => current.filter(entry => entry.id !== item.id));
  };

  return <div className="app-shell">
    <PlatformHeader account={account} />
    <Sidebar menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(value => !value)} onCreate={create} />
    <main className="workspace">
      <header className="topbar"><label><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search papers and spreadsheets" /></label><button aria-label="Help"><HelpCircle /></button></header>
      <section className="workspace-content">
        {syncStatus === 'browser' ? <aside className="sync-banner"><div><strong>Keep your flockdocs on every device</strong><span>Sign in once on Flockfly to store Paper and Spreadsheet revisions securely.</span></div><a href={googleSignInUrl()}>Sign in to sync</a></aside> : null}
        {syncStatus === 'loading' ? <p className="sync-note">Loading your cloud workspace…</p> : null}
        {syncStatus === 'error' ? <p className="sync-note error">Cloud sync is unavailable. Your browser copy has not been removed.</p> : null}
        {cloudApi && invitations.length ? <aside className="flockdoc-invitations"><strong>Document invitations</strong>{invitations.map(invitation => <div key={invitation.id}><span><b>{invitation.flockdocName}</b> · {flockdocRoleLabel(invitation.role)}</span><button onClick={() => void cloudApi.respondToInvitation(invitation.id, 'decline').then(() => setInvitations(current => current.filter(item => item.id !== invitation.id)))}>Decline</button><button className="primary" onClick={() => void cloudApi.respondToInvitation(invitation.id, 'accept').then(() => Promise.all([cloudApi.list(), cloudApi.listInvitations()])).then(([listed, pending]) => { setItems(listed.flockdocs); setInvitations(pending.invitations); })}>Accept</button></div>)}</aside> : null}
        <div className="title-row"><h1>My workspace</h1></div>
        <FolderBreadcrumb prefix={currentPrefix} onNavigate={setCurrentPrefix} />
        <div className="filters">{([['all', 'All'], ['paper', 'Papers'], ['spreadsheet', 'Spreadsheets']] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <FlockdocTable items={visibleItems} prefixes={visiblePrefixes} allPrefixes={knownPrefixes} onOpenFolder={setCurrentPrefix} onMove={moveFlockdoc} onDelete={deleteFlockdoc} />
      </section>
    </main>
  </div>;
}
