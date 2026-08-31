import { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Search } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { PlatformHeader } from './components/PlatformHeader';
import { PaperEditor } from './features/editor/PaperEditor';
import { RemoteEditor } from './features/editor/RemoteEditor';
import { SpreadsheetEditor } from './features/editor/SpreadsheetEditor';
import { FlockdocTable } from './features/workspace/FlockdocTable';
import { CreateFolderDialog } from './features/workspace/CreateFolderDialog';
import { FolderBreadcrumb } from './features/workspace/FolderBreadcrumb';
import { consumeAuthTokenFromHash, FlockdocApi, getToken, googleSignInUrl, supportsPlatformSession } from './lib/api';
import { registerFlockdocWebMCP } from './lib/webmcp';
import { currentFlockdocPath, migrateLegacyFlockdocPath, navigateFlockdoc } from './lib/navigation';
import { loadFolders, loadWorkspace, saveFolders, saveWorkspace } from './lib/workspace-storage';
import type { Flockdoc, FlockdocFolder, FlockdocType, WorkspaceFilter } from './types';
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
  const [folders, setFolders] = useState<FlockdocFolder[]>(() => loadFolders(localStorage));
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [filter, setFilter] = useState<WorkspaceFilter>('all');
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [route, setRoute] = useState(currentFlockdocPath);
  const [syncStatus, setSyncStatus] = useState<'browser' | 'loading' | 'synced' | 'error'>('loading');
  const [authenticated, setAuthenticated] = useState(false);
  const [account, setAccount] = useState<{ email: string; entitled: boolean } | null>(null);
  const api = useMemo(() => new FlockdocApi(token ?? undefined), [token]);
  const cloudApi = authenticated ? api : null;
  const itemsRef = useRef(items);
  const foldersRef = useRef(folders);
  const apiRef = useRef(cloudApi);

  useEffect(() => {
    const handler = () => { const next = currentFlockdocPath(); migrateLegacyFlockdocPath(); setRoute(next); };
    migrateLegacyFlockdocPath();
    addEventListener('popstate', handler);
    addEventListener('hashchange', handler);
    return () => { removeEventListener('popstate', handler); removeEventListener('hashchange', handler); };
  }, []);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { foldersRef.current = folders; }, [folders]);
  useEffect(() => { apiRef.current = cloudApi; }, [cloudApi]);
  useEffect(() => { saveWorkspace(items, localStorage); }, [items]);
  useEffect(() => { saveFolders(folders, localStorage); }, [folders]);
  useEffect(() => {
    let active = true;
    if (!supportsPlatformSession()) {
      setSyncStatus('browser');
      return () => { active = false; };
    }
    setSyncStatus('loading');
    void api.session().then(session => {
      if (active) setAccount({ email: session.user.email, entitled: session.billing?.entitled === true });
      return Promise.all([api.list(), api.listFolders()]);
    }).then(([{ flockdocs }, { folders: cloudFolders }]) => {
      if (!active) return;
      setAuthenticated(true);
      setItems(flockdocs);
      setFolders(cloudFolders);
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
    listFlockdocs: () => ({ flockdocs: itemsRef.current, folders: foldersRef.current }),
    createFlockdoc: async ({ name, type, parentFolderId }) => {
      const remoteApi = apiRef.current;
      const targetFolderId = typeof parentFolderId === 'string' ? parentFolderId : null;
      const next = remoteApi
        ? (await remoteApi.create(String(name), type as FlockdocType, targetFolderId)).flockdoc
        : { id: crypto.randomUUID(), name: String(name), type: type as FlockdocType, parentFolderId: targetFolderId, modifiedAt: 'Just now', collaborators: [] };
      setItems(current => [next, ...current]);
      return { flockdoc: next };
    },
    renameFlockdoc: async ({ id, name }) => {
      const remoteApi = apiRef.current;
      if (remoteApi) await remoteApi.rename(String(id), String(name));
      setItems(current => current.map(item => item.id === id ? { ...item, name: String(name) } : item));
      return { ok: true };
    },
    createFolder: async ({ name, parentFolderId }) => {
      const remoteApi = apiRef.current;
      const targetFolderId = typeof parentFolderId === 'string' ? parentFolderId : null;
      const next = remoteApi
        ? (await remoteApi.createFolder(String(name), targetFolderId)).folder
        : { id: crypto.randomUUID(), name: String(name), parentFolderId: targetFolderId, modifiedAt: 'Just now' };
      setFolders(current => [next, ...current]);
      return { folder: next };
    },
    moveFlockdoc: async ({ id, parentFolderId }) => {
      const remoteApi = apiRef.current;
      const targetFolderId = typeof parentFolderId === 'string' ? parentFolderId : null;
      const moved = remoteApi ? (await remoteApi.move(String(id), targetFolderId)).flockdoc : null;
      setItems(current => current.map(item => item.id === id ? (moved ?? { ...item, parentFolderId: targetFolderId, modifiedAt: 'Just now' }) : item));
      return { flockdoc: moved ?? itemsRef.current.find(item => item.id === id) };
    },
    deleteFlockdoc: async ({ id }) => {
      const remoteApi = apiRef.current;
      if (remoteApi) await remoteApi.trash(String(id));
      setItems(current => current.filter(item => item.id !== id));
      return { ok: true };
    },
  }}), []);

  const visibleItems = useMemo(() => items.filter(item => (item.parentFolderId ?? null) === currentFolderId && (filter === 'all' || item.type === filter) && item.name.toLowerCase().includes(query.toLowerCase())), [currentFolderId, filter, items, query]);
  const visibleFolders = useMemo(() => folders.filter(folder => (folder.parentFolderId ?? null) === currentFolderId && folder.name.toLowerCase().includes(query.toLowerCase())), [currentFolderId, folders, query]);
  const folderPath = useMemo(() => {
    const path: FlockdocFolder[] = [];
    const seen = new Set<string>();
    let id = currentFolderId;
    while (id && !seen.has(id)) { seen.add(id); const folder = folders.find(entry => entry.id === id); if (!folder) break; path.unshift(folder); id = folder.parentFolderId ?? null; }
    return path;
  }, [currentFolderId, folders]);
  const routeMatch = route.match(/^\/flockdoc\/(paper|spreadsheet)\/([^/]+)/);
  if (routeMatch) {
    const item = items.find(entry => entry.id === routeMatch[2]);
    const updateItem = (updates: Partial<Flockdoc>) => setItems(current => current.map(entry => entry.id === item?.id ? { ...entry, ...updates } : entry));
    if (item) return <div className="editor-app">
      <PlatformHeader account={account} />
      {cloudApi
        ? <RemoteEditor api={cloudApi} item={item} onBack={() => navigateFlockdoc('/flockdoc/')} onUpdate={updateItem} />
        : item.type === 'paper'
          ? <PaperEditor key={item.id} item={item} onBack={() => navigateFlockdoc('/flockdoc/')} onRename={name => updateItem({ name, modifiedAt: 'Just now' })} onSnapshot={snapshot => updateItem({ snapshot, modifiedAt: 'Just now' })} />
          : <SpreadsheetEditor key={item.id} item={item} onBack={() => navigateFlockdoc('/flockdoc/')} onRename={name => updateItem({ name, modifiedAt: 'Just now' })} onSnapshot={snapshot => updateItem({ snapshot, modifiedAt: 'Just now' })} />}
    </div>;
  }

  const create = async (type: 'paper' | 'spreadsheet' | 'folder') => {
    setMenuOpen(false);
    if (type === 'folder') { setFolderDialogOpen(true); return; }
    const name = type === 'paper' ? 'Untitled Paper' : 'Untitled Spreadsheet';
    const item: Flockdoc = cloudApi
      ? (await cloudApi.create(name, type, currentFolderId)).flockdoc
      : { id: crypto.randomUUID(), name, type, parentFolderId: currentFolderId, modifiedAt: 'Just now', collaborators: [] };
    setItems(current => [item, ...current]); navigateFlockdoc(routeFor(item));
  };

  const createFolder = async (name: string) => {
    const folder = cloudApi
      ? (await cloudApi.createFolder(name, currentFolderId)).folder
      : { id: crypto.randomUUID(), name, parentFolderId: currentFolderId, modifiedAt: 'Just now' };
    setFolders(current => [folder, ...current]);
    setFolderDialogOpen(false);
  };
  const moveFlockdoc = async (item: Flockdoc, parentFolderId: string | null) => {
    const moved = cloudApi ? (await cloudApi.move(item.id, parentFolderId)).flockdoc : { ...item, parentFolderId, modifiedAt: 'Just now' };
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
        <div className="title-row"><h1>My workspace</h1></div>
        <FolderBreadcrumb folders={folderPath} onNavigate={setCurrentFolderId} />
        <div className="filters">{([['all', 'All'], ['paper', 'Papers'], ['spreadsheet', 'Spreadsheets']] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <FlockdocTable items={visibleItems} folders={visibleFolders} allFolders={folders} onOpenFolder={setCurrentFolderId} onMove={moveFlockdoc} onDelete={deleteFlockdoc} />
      </section>
    </main>
    {folderDialogOpen && <CreateFolderDialog onCreate={createFolder} onCancel={() => setFolderDialogOpen(false)} />}
  </div>;
}
