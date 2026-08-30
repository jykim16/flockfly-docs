import { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Link, MoreHorizontal, Search, Share2 } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { PlatformHeader } from './components/PlatformHeader';
import { PaperEditor } from './features/editor/PaperEditor';
import { SpreadsheetEditor } from './features/editor/SpreadsheetEditor';
import { DetailsDrawer } from './features/workspace/DetailsDrawer';
import { FlockdocTable } from './features/workspace/FlockdocTable';
import { registerFlockdocWebMCP } from './lib/webmcp';
import { loadWorkspace, saveWorkspace } from './lib/workspace-storage';
import type { Flockdoc, FlockdocType, WorkspaceFilter } from './types';
import './styles.css';

function routeFor(item: Flockdoc) { return `#/flockdoc/${item.type}/${item.id}`; }

export default function App() {
  const [items, setItems] = useState<Flockdoc[]>(() => loadWorkspace(localStorage));
  const [filter, setFilter] = useState<WorkspaceFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Flockdoc | undefined>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [route, setRoute] = useState(location.hash);
  const itemsRef = useRef(items);

  useEffect(() => { const handler = () => setRoute(location.hash); addEventListener('hashchange', handler); return () => removeEventListener('hashchange', handler); }, []);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { saveWorkspace(items, localStorage); }, [items]);
  useEffect(() => registerFlockdocWebMCP({ modelContext: document.modelContext, actions: {
    listFlockdocs: () => ({ flockdocs: itemsRef.current }),
    createFlockdoc: ({ name, type }) => { const next = { id: crypto.randomUUID(), name: String(name), type: type as FlockdocType, modifiedAt: 'Just now', collaborators: [] }; setItems(current => [next, ...current]); return { flockdoc: next }; },
    renameFlockdoc: ({ id, name }) => { setItems(current => current.map(item => item.id === id ? { ...item, name: String(name) } : item)); return { ok: true }; },
  }}), []);

  const visibleItems = useMemo(() => items.filter(item => (filter === 'all' || item.type === filter) && item.name.toLowerCase().includes(query.toLowerCase())), [filter, items, query]);
  const routeMatch = route.match(/^#\/flockdoc\/(paper|spreadsheet)\/([^/]+)/);
  if (routeMatch) {
    const item = items.find(entry => entry.id === routeMatch[2]);
    const updateItem = (updates: Partial<Flockdoc>) => setItems(current => current.map(entry => entry.id === item?.id ? { ...entry, ...updates } : entry));
    if (item) return <div className="editor-app">
      <PlatformHeader />
      {item.type === 'paper'
        ? <PaperEditor key={item.id} item={item} onBack={() => { location.hash = ''; }} onRename={name => updateItem({ name, modifiedAt: 'Just now' })} onSnapshot={snapshot => updateItem({ snapshot, modifiedAt: 'Just now' })} />
        : <SpreadsheetEditor key={item.id} item={item} onBack={() => { location.hash = ''; }} onRename={name => updateItem({ name, modifiedAt: 'Just now' })} onSnapshot={snapshot => updateItem({ snapshot, modifiedAt: 'Just now' })} />}
    </div>;
  }

  const create = (type: 'paper' | 'spreadsheet' | 'folder') => {
    setMenuOpen(false);
    if (type === 'folder') return;
    const item: Flockdoc = { id: crypto.randomUUID(), name: type === 'paper' ? 'Untitled Paper' : 'Untitled Spreadsheet', type, modifiedAt: 'Just now', collaborators: [] };
    setItems(current => [item, ...current]); location.hash = routeFor(item);
  };

  return <div className={`app-shell ${selected ? 'with-details' : ''}`}>
    <PlatformHeader />
    <Sidebar menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(value => !value)} onCreate={create} />
    <main className="workspace">
      <header className="topbar"><label><Search /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search papers and spreadsheets" /></label><button aria-label="Help"><HelpCircle /></button></header>
      <section className="workspace-content">
        <div className="title-row"><h1>My workspace</h1><div><button className="share"><Share2 />Share</button><button aria-label="Copy link"><Link /></button><button aria-label="More actions"><MoreHorizontal /></button></div></div>
        <div className="filters">{([['all', 'All'], ['paper', 'Papers'], ['spreadsheet', 'Spreadsheets']] as const).map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <FlockdocTable items={visibleItems} selectedId={selected?.id} onSelect={item => setSelected(item)} />
        <p className="open-hint">Double-click a Paper or Spreadsheet name to open it.</p>
      </section>
    </main>
    {selected && <DetailsDrawer item={selected} onClose={() => setSelected(undefined)} />}
  </div>;
}
