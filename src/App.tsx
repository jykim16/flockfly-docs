import { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Search, Share2 } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { PlatformHeader } from './components/PlatformHeader';
import { PaperEditor } from './features/editor/PaperEditor';
import { RemoteEditor } from './features/editor/RemoteEditor';
import { SpreadsheetEditor } from './features/editor/SpreadsheetEditor';
import { DiagramEditor } from './features/editor/DiagramEditor';
import { WebAppEditor } from './features/editor/WebAppEditor';
import { FlockdocTable } from './features/workspace/FlockdocTable';
import { FolderBreadcrumb } from './features/workspace/FolderBreadcrumb';
import { WorkspaceShareDialog } from './features/sharing/WorkspaceShareDialog';
import { consumeAuthTokenFromHash, FlockdocApi, getToken, googleSignInUrl, supportsPlatformSession } from './lib/api';
import { migrateAnonymousWorkspace } from './lib/anonymous-migration';
import { flockdocRoleLabel } from './lib/flockdoc-roles';
import { FlockdocOutbox } from './lib/flockdoc-outbox';
import { registerFlockdocWebMCP } from './lib/webmcp';
import { currentFlockdocPath, migrateLegacyFlockdocPath, navigateFlockdoc } from './lib/navigation';
import { loadWorkspace, saveWorkspace } from './lib/workspace-storage';
import { allPrefixes, immediatePrefixes, normalizePrefix, prefixName } from './lib/prefixes';
import type { Flockdoc, FlockdocInvitation, FlockdocType, FlockdocWorkspace, WorkspaceFilter } from './types';
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
  const [workspaces, setWorkspaces] = useState<FlockdocWorkspace[]>([{ id: 'local', name: 'My workspace', isDefault: true, canCreate: true, canShare: false, canManageAccess: false }]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('local');
  const [workspaceView, setWorkspaceView] = useState<'active' | 'trash'>('active');
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [filter, setFilter] = useState<WorkspaceFilter>('all');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [route, setRoute] = useState(currentFlockdocPath);
  const [syncStatus, setSyncStatus] = useState<'browser' | 'loading' | 'synced' | 'error'>('loading');
  const [authenticated, setAuthenticated] = useState(false);
  const [outbox, setOutbox] = useState<FlockdocOutbox | null>(null);
  const [account, setAccount] = useState<{ email: string; entitled: boolean } | null>(null);
  const [invitations, setInvitations] = useState<FlockdocInvitation[]>([]);
  const [workspaceShareOpen, setWorkspaceShareOpen] = useState(false);
  const api = useMemo(() => new FlockdocApi(token ?? undefined), [token]);
  const cloudApi = authenticated ? api : null;
  const itemsRef = useRef(items);
  const apiRef = useRef(cloudApi);
  const selectedWorkspaceRef = useRef(selectedWorkspaceId);

  useEffect(() => {
    const handler = () => { const next = currentFlockdocPath(); migrateLegacyFlockdocPath(); setRoute(next); };
    migrateLegacyFlockdocPath();
    addEventListener('popstate', handler);
    addEventListener('hashchange', handler);
    return () => { removeEventListener('popstate', handler); removeEventListener('hashchange', handler); };
  }, []);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { apiRef.current = cloudApi; }, [cloudApi]);
  useEffect(() => { selectedWorkspaceRef.current = selectedWorkspaceId; }, [selectedWorkspaceId]);
  useEffect(() => { if (!authenticated) saveWorkspace(items, localStorage); }, [authenticated, items]);
  useEffect(() => {
    let active = true;
    if (!supportsPlatformSession()) {
      setSyncStatus('browser');
      return () => { active = false; };
    }
    setSyncStatus('loading');
    void api.session().then(async session => {
      if (active) setAccount({ email: session.user.email, entitled: session.billing?.entitled === true });
      await migrateAnonymousWorkspace(api, localStorage, session.user.email);
      const shareToken = new URLSearchParams(location.search).get('share');
      const claim = shareToken ? api.claimShareLink(shareToken).then(() => {
        history.replaceState(null, '', location.pathname);
      }) : Promise.resolve();
      const workspaceResult = await api.listWorkspaces();
      const defaultWorkspace = workspaceResult.workspaces.find(workspace => workspace.isDefault) ?? workspaceResult.workspaces[0];
      if (!defaultWorkspace) throw new Error('No Flockdoc workspace is available.');
      const [listed, pending] = await claim.then(() => Promise.all([api.list(defaultWorkspace.id), api.listInvitations()]));
      return { accountId: session.user.email, listed, pending, workspaces: workspaceResult.workspaces, defaultWorkspaceId: defaultWorkspace.id };
    }).then(async ({ accountId, listed, pending, workspaces: availableWorkspaces, defaultWorkspaceId }) => {
      const requestedId = currentFlockdocPath().match(/^\/flockdoc\/(?:paper|spreadsheet|diagram|webapp)\/([^/]+)/)?.[1];
      let flockdocs = listed.flockdocs;
      let openedFlockdoc = requestedId ? flockdocs.find(item => item.id === requestedId) : undefined;
      if (requestedId && !openedFlockdoc) {
        try { openedFlockdoc = (await api.getState(requestedId)).flockdoc; }
        catch { try { await api.joinPublic(requestedId); openedFlockdoc = (await api.getState(requestedId)).flockdoc; } catch { /* Restricted documents remain hidden. */ } }
      }
      const openedWorkspace = openedFlockdoc?.collectionId
        ? availableWorkspaces.find(workspace => workspace.id === openedFlockdoc.collectionId)
        : undefined;
      const openedWorkspaceId = openedWorkspace?.id ?? defaultWorkspaceId;
      if (openedWorkspaceId !== defaultWorkspaceId) {
        flockdocs = (await api.list(openedWorkspaceId)).flockdocs;
        if (openedFlockdoc && !flockdocs.some(item => item.id === openedFlockdoc.id)) flockdocs.push(openedFlockdoc);
      } else if (openedFlockdoc && !flockdocs.some(item => item.id === openedFlockdoc.id)) {
        flockdocs.push(openedFlockdoc);
      }
      return { accountId, flockdocs, invitations: pending.invitations, workspaces: availableWorkspaces, initialWorkspaceId: openedWorkspaceId };
    }).then(({ accountId, flockdocs, invitations: pending, workspaces: availableWorkspaces, initialWorkspaceId }) => {
      if (!active) return;
      setAuthenticated(true);
      setOutbox(new FlockdocOutbox(localStorage, accountId));
      setItems(flockdocs);
      setWorkspaces(availableWorkspaces);
      setSelectedWorkspaceId(initialWorkspaceId);
      setInvitations(pending);
      setSyncStatus('synced');
    }).catch(error => {
      if (!active) return;
      setAuthenticated(false);
      setOutbox(null);
      setAccount(null);
      setItems(loadWorkspace(localStorage));
      setWorkspaces([{ id: 'local', name: 'My workspace', isDefault: true, canCreate: true, canShare: false, canManageAccess: false }]);
      setSelectedWorkspaceId('local');
      setSyncStatus(error instanceof Error && 'status' in error && [401, 403, 404].includes(Number(error.status)) ? 'browser' : 'error');
    });
    return () => { active = false; };
  }, [api]);
  useEffect(() => {
    if (!cloudApi || !outbox) return;
    const flush = () => { void outbox.flush(cloudApi).catch(() => undefined); };
    flush();
    addEventListener('online', flush);
    return () => removeEventListener('online', flush);
  }, [cloudApi, outbox]);
  useEffect(() => registerFlockdocWebMCP({ modelContext: document.modelContext, actions: {
    listFlockdocs: () => ({ flockdocs: itemsRef.current, prefixes: allPrefixes(itemsRef.current) }),
    openFlockdoc: ({ id }) => {
      const item = itemsRef.current.find(entry => entry.id === String(id));
      if (!item) throw new Error(`Flockdoc "${String(id)}" is not available in this workspace.`);
      const path = routeFor(item);
      navigateFlockdoc(path);
      return { opened: true, path };
    },
    createFlockdoc: async ({ name, type, prefix }) => {
      const remoteApi = apiRef.current;
      const targetPrefix = normalizePrefix(typeof prefix === 'string' ? prefix : '');
      const next = remoteApi
        ? (await remoteApi.create(String(name), type as FlockdocType, targetPrefix, selectedWorkspaceRef.current)).flockdoc
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
      setItems(current => current.map(item => item.id === id ? { ...item, trashedAt: new Date().toISOString() } : item));
      return { ok: true };
    },
  }}), []);

  const itemsInView = useMemo(() => items.filter(item => workspaceView === 'trash' ? item.trashedAt != null : item.trashedAt == null), [items, workspaceView]);
  const visibleItems = useMemo(() => itemsInView.filter(item => item.prefix === currentPrefix && (filter === 'all' || item.type === filter) && item.name.toLowerCase().includes(query.toLowerCase())), [currentPrefix, filter, itemsInView, query]);
  const visiblePrefixes = useMemo(() => immediatePrefixes(itemsInView, currentPrefix).filter(prefix => prefixName(prefix).toLowerCase().includes(query.toLowerCase())), [currentPrefix, itemsInView, query]);
  const knownPrefixes = useMemo(() => allPrefixes(itemsInView), [itemsInView]);
  const selectedWorkspace = workspaces.find(workspace => workspace.id === selectedWorkspaceId) ?? workspaces[0];
  const routeMatch = route.match(/^\/flockdoc\/(paper|spreadsheet|diagram|webapp)\/([^/]+)/);
  if (routeMatch) {
    const item = items.find(entry => entry.id === routeMatch[2]);
    const editorWorkspace = workspaces.find(workspace => workspace.id === item?.collectionId) ?? selectedWorkspace;
    const updateItem = (updates: Partial<Flockdoc>) => setItems(current => current.map(entry => entry.id === item?.id ? { ...entry, ...updates } : entry));
    if (item) return <div className="editor-app">
      <PlatformHeader account={account} />
      {cloudApi && outbox
        ? <RemoteEditor api={cloudApi} outbox={outbox} item={item} currentUserEmail={account?.email} workspaceName={editorWorkspace?.name ?? 'My workspace'} onBack={() => navigateFlockdoc('/flockdoc/')} onUpdate={updateItem} />
        : item.type === 'paper'
          ? <PaperEditor key={item.id} item={item} workspaceName={editorWorkspace?.name} persistenceStatus="Saved in this browser" onBack={() => navigateFlockdoc('/flockdoc/')} onRename={name => updateItem({ name, modifiedAt: 'Just now' })} onSnapshot={snapshot => updateItem({ snapshot, modifiedAt: 'Just now' })} />
          : item.type === 'spreadsheet'
            ? <SpreadsheetEditor key={item.id} item={item} workspaceName={editorWorkspace?.name} persistenceStatus="Saved in this browser" onBack={() => navigateFlockdoc('/flockdoc/')} onRename={name => updateItem({ name, modifiedAt: 'Just now' })} onSnapshot={snapshot => updateItem({ snapshot, modifiedAt: 'Just now' })} />
            : item.type === 'diagram'
              ? <DiagramEditor key={item.id} item={item} workspaceName={editorWorkspace?.name} persistenceStatus="Saved in this browser" onBack={() => navigateFlockdoc('/flockdoc/')} onRename={name => updateItem({ name, modifiedAt: 'Just now' })} onSnapshot={snapshot => updateItem({ snapshot, modifiedAt: 'Just now' })} />
              : <WebAppEditor key={item.id} item={item} workspaceName={editorWorkspace?.name} persistenceStatus="Saved in this browser" onBack={() => navigateFlockdoc('/flockdoc/')} onRename={name => updateItem({ name, modifiedAt: 'Just now' })} onSnapshot={snapshot => updateItem({ snapshot, modifiedAt: 'Just now' })} />}
    </div>;
  }

  const create = async (type: FlockdocType) => {
    setMenuOpen(false);
    const name = type === 'paper' ? 'Untitled Paper' : type === 'spreadsheet' ? 'Untitled Spreadsheet' : type === 'diagram' ? 'Untitled Diagram' : 'Untitled Web App';
    const item: Flockdoc = cloudApi
      ? (await cloudApi.create(name, type, currentPrefix, selectedWorkspaceId)).flockdoc
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
    setItems(current => current.map(entry => entry.id === item.id ? { ...entry, trashedAt: new Date().toISOString() } : entry));
  };
  const removeFlockdoc = async (item: Flockdoc) => {
    if (cloudApi) await cloudApi.removeFromWorkspace(item.id);
    setItems(current => current.filter(entry => entry.id !== item.id));
  };
  const restoreFlockdoc = async (item: Flockdoc) => {
    const restored = cloudApi ? (await cloudApi.restore(item.id)).flockdoc : { ...item, trashedAt: null };
    setItems(current => current.map(entry => entry.id === item.id ? restored : entry));
  };
  const selectWorkspace = async (id: string) => {
    setCurrentPrefix(''); setWorkspaceView('active'); setSelectedWorkspaceId(id); setWorkspaceShareOpen(false);
    if (cloudApi) { setSyncStatus('loading'); setItems((await cloudApi.list(id)).flockdocs); setSyncStatus('synced'); }
  };
  const selectTrash = async () => {
    setCurrentPrefix(''); setWorkspaceView('trash'); setWorkspaceShareOpen(false);
    if (cloudApi) { setSyncStatus('loading'); setItems((await cloudApi.list(selectedWorkspaceId, 'trash')).flockdocs); setSyncStatus('synced'); }
  };
  return <div className="app-shell">
    <PlatformHeader account={account} />
    <Sidebar menuOpen={menuOpen} workspaces={workspaces} selectedWorkspaceId={selectedWorkspaceId} view={workspaceView} canCreate={selectedWorkspace?.canCreate ?? false} onToggleMenu={() => setMenuOpen(value => !value)} onCreate={create} onSelectWorkspace={id => void selectWorkspace(id)} onSelectTrash={() => void selectTrash()} />
    <main className="workspace">
      <header className="topbar"><label><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search flockdocs" /></label><button aria-label="Help"><HelpCircle /></button></header>
      <section className="workspace-content">
        {syncStatus === 'browser' ? <aside className="sync-banner"><div><strong>Keep your flockdocs on every device</strong><span>Sign in once on Flockfly to store Paper, Spreadsheet, Diagram, and Web App revisions securely.</span></div><a href={googleSignInUrl()}>Sign in to sync</a></aside> : null}
        {syncStatus === 'loading' ? <p className="sync-note">Loading your cloud workspace…</p> : null}
        {syncStatus === 'error' ? <p className="sync-note error">Cloud sync is unavailable. Your browser copy has not been removed.</p> : null}
        {cloudApi && invitations.length ? <aside className="flockdoc-invitations"><strong>Document invitations</strong>{invitations.map(invitation => <div key={invitation.id}><span><b>{invitation.flockdocName}</b> · {flockdocRoleLabel(invitation.role)}</span><button onClick={() => void cloudApi.respondToInvitation(invitation.id, 'decline').then(() => setInvitations(current => current.filter(item => item.id !== invitation.id)))}>Decline</button><button className="primary" onClick={() => void cloudApi.respondToInvitation(invitation.id, 'accept').then(() => Promise.all([cloudApi.list(selectedWorkspaceId), cloudApi.listInvitations()])).then(([listed, pending]) => { setItems(listed.flockdocs); setInvitations(pending.invitations); })}>Accept</button></div>)}</aside> : null}
        <div className="title-row"><h1>{workspaceView === 'trash' ? 'Trash' : selectedWorkspace?.name ?? 'My workspace'}</h1>{workspaceView === 'active' && cloudApi && selectedWorkspace?.canShare ? <button type="button" className="workspace-share-button" onClick={() => setWorkspaceShareOpen(true)}><Share2 />Share workspace</button> : null}</div>
        {workspaceShareOpen && cloudApi && selectedWorkspace ? <WorkspaceShareDialog api={cloudApi} workspace={selectedWorkspace} currentUserEmail={account?.email} onClose={() => setWorkspaceShareOpen(false)} /> : null}
        <FolderBreadcrumb workspaceName={selectedWorkspace?.name ?? 'My workspace'} prefix={currentPrefix} onNavigate={setCurrentPrefix} />
        <div className="filters">{([['all', 'All'], ['paper', 'Papers'], ['spreadsheet', 'Spreadsheets'], ['diagram', 'Diagrams'], ['webapp', 'Web Apps']] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <FlockdocTable items={visibleItems} prefixes={visiblePrefixes} allPrefixes={knownPrefixes} onOpenFolder={setCurrentPrefix} onMove={moveFlockdoc} onDelete={deleteFlockdoc} onRemove={removeFlockdoc} onRestore={restoreFlockdoc} view={workspaceView} />
      </section>
    </main>
  </div>;
}
