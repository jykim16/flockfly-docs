import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Code2, Eye, Maximize2, MessageSquarePlus, Minimize2, MousePointer2, Play, Share2 } from 'lucide-react';
import type { Flockdoc, FlockdocComment } from '../../types';
import { buildWebAppPreview } from '../../lib/webapp-preview';
import { DEFAULT_WEB_APP_BUNDLE, normalizeWebAppBundle, type WebAppBundle } from '../../lib/webapp-operations';
import { registerWebAppWebMCP } from '../../lib/editor-webmcp';
import { EditorFocusModeControl } from './EditorFocusModeControl';

export interface WebAppAnchor extends Record<string, unknown> { kind: 'webapp'; selector: string; tag: string; text: string }

function isWebAppAnchor(value: unknown): value is WebAppAnchor {
  if (!value || typeof value !== 'object') return false;
  const anchor = value as Record<string, unknown>;
  return anchor.kind === 'webapp' && typeof anchor.selector === 'string' && anchor.selector.length > 0 && anchor.selector.length <= 1000
    && typeof anchor.tag === 'string' && anchor.tag.length <= 100 && typeof anchor.text === 'string' && anchor.text.length <= 500;
}

interface WebAppEditorProps {
  item: Flockdoc;
  onBack: () => void;
  onRename: (name: string) => void;
  onSnapshot: (snapshot: unknown) => void | Promise<void>;
  onWebAppBundleChange?: (bundle: WebAppBundle) => void | Promise<void>;
  remoteBundles?: Array<{ revision: number; bundle: WebAppBundle }>;
  onRemoteBundlesApplied?: (revision: number) => void;
  canEdit?: boolean;
  canComment?: boolean;
  canShare?: boolean;
  onShare?: () => void;
  loadComments?: () => Promise<FlockdocComment[]>;
  createComment?: (body: string, anchor: WebAppAnchor) => Promise<FlockdocComment>;
  persistenceStatus?: string;
}

export function WebAppEditor({ item, onBack, onRename, onSnapshot, onWebAppBundleChange, remoteBundles = [], onRemoteBundlesApplied, canEdit = true, canComment = true, canShare = true, onShare, loadComments, createComment, persistenceStatus }: WebAppEditorProps) {
  const [bundle, setBundle] = useState(() => normalizeWebAppBundle(item.snapshot ?? DEFAULT_WEB_APP_BUNDLE));
  const [selectedFile, setSelectedFile] = useState(bundle.entrypoint);
  const [view, setView] = useState<'preview' | 'code'>('preview');
  const [mode, setMode] = useState<'annotate' | 'interact'>('annotate');
  const [anchor, setAnchor] = useState<WebAppAnchor | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [comments, setComments] = useState<FlockdocComment[]>([]);
  const [status, setStatus] = useState(canEdit ? 'Saved' : 'View only');
  const [loadToken, setLoadToken] = useState(() => crypto.randomUUID());
  const [appFullscreen, setAppFullscreen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bundleRef = useRef(bundle); const commentsRef = useRef(comments);
  bundleRef.current = bundle; commentsRef.current = comments;
  const preview = useMemo(() => view === 'preview' ? buildWebAppPreview(bundle, loadToken) : '', [bundle, loadToken, view]);

  const saveBundle = async (next: WebAppBundle) => {
    setBundle(next); setStatus('Saving…');
    try { await (onWebAppBundleChange ? onWebAppBundleChange(next) : onSnapshot(next)); setStatus('Saved to Flockfly'); }
    catch { setStatus('Save failed — changes remain in this browser'); }
  };
  const saveBundleRef = useRef(saveBundle); saveBundleRef.current = saveBundle;

  useEffect(() => registerWebAppWebMCP({ ownerDocument: document, id: item.id, name: item.name, canEdit, getBundle: () => bundleRef.current, writeBundle: next => saveBundleRef.current(next), getComments: loadComments ?? (() => commentsRef.current) }), [canEdit, item.id, item.name, loadComments]);
  useEffect(() => {
    if (!loadComments) return;
    let active = true;
    const refresh = () => void loadComments().then(next => { if (active) setComments(next); }).catch(() => undefined);
    refresh(); const timer = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [loadComments]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.data?.kind !== 'webapp.element.selected' || event.data?.token !== loadToken || !isWebAppAnchor(event.data.anchor)) return;
      setAnchor(event.data.anchor);
    };
    addEventListener('message', receive); return () => removeEventListener('message', receive);
  }, [loadToken]);
  useEffect(() => { iframeRef.current?.contentWindow?.postMessage({ kind: 'webapp.mode', token: loadToken, mode }, '*'); }, [loadToken, mode]);
  useEffect(() => {
    document.body.classList.toggle('webapp-app-fullscreen', appFullscreen);
    if (!appFullscreen) return;
    const exitOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setAppFullscreen(false); };
    window.addEventListener('keydown', exitOnEscape);
    return () => { window.removeEventListener('keydown', exitOnEscape); document.body.classList.remove('webapp-app-fullscreen'); };
  }, [appFullscreen]);
  useEffect(() => {
    if (!remoteBundles.length) return;
    const latest = remoteBundles[remoteBundles.length - 1]; setBundle(normalizeWebAppBundle(latest.bundle)); setLoadToken(crypto.randomUUID());
    onRemoteBundlesApplied?.(latest.revision);
  }, [remoteBundles, onRemoteBundlesApplied]);

  const updateFile = (content: string) => setBundle(current => ({ ...current, files: { ...current.files, [selectedFile]: content } }));
  const persistCurrent = () => { if (canEdit) void saveBundle(normalizeWebAppBundle(bundle)); };
  const submitComment = async () => {
    if (!anchor || !commentBody.trim() || !createComment) return;
    const next = await createComment(commentBody.trim(), anchor); setComments(current => [...current, next]); setCommentBody(''); setAnchor(null);
  };
  const reveal = (comment: FlockdocComment) => {
    const selector = typeof comment.anchor.selector === 'string' ? comment.anchor.selector : '';
    if (selector) iframeRef.current?.contentWindow?.postMessage({ kind: 'webapp.reveal', token: loadToken, selector }, '*');
  };
  const openAppFullscreen = () => { setView('preview'); setMode('interact'); setAppFullscreen(true); };

  return <main className="editor-shell webapp-shell">
    <header className="editor-header"><button aria-label="Back to workspace" onClick={onBack}><ArrowLeft /></button><div><input className="document-title" aria-label="Web App name" value={item.name} disabled={!canEdit} onChange={event => onRename(event.target.value)} /><span>{persistenceStatus ?? status}</span></div><div className="editor-header-actions"><EditorFocusModeControl /><button className="share" disabled={!canShare || !onShare} onClick={onShare}><Share2 /> Share</button></div><span className="avatar">You</span></header>
    <div className="webapp-toolbar"><div className="segmented"><button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')}><Eye /> Preview</button><button className={view === 'code' ? 'active' : ''} onClick={() => setView('code')}><Code2 /> Code</button></div><div className="webapp-toolbar-actions"><div className="segmented review-mode"><button className={mode === 'annotate' ? 'active' : ''} onClick={() => setMode('annotate')}><MousePointer2 /> Annotate</button><button className={mode === 'interact' ? 'active' : ''} onClick={() => setMode('interact')}><Play /> Interact</button></div><button className="app-fullscreen-enter" onClick={openAppFullscreen}><Maximize2 /> App full screen</button></div></div>
    <section className="webapp-workbench">
      <aside className="webapp-files"><strong>Files</strong>{Object.keys(bundle.files).map(path => <button key={path} className={path === selectedFile ? 'active' : ''} onClick={() => { setSelectedFile(path); setView('code'); }}>{path}</button>)}</aside>
      <div className="webapp-canvas">{view === 'preview' ? <iframe ref={iframeRef} title="Web App preview" sandbox="allow-scripts allow-forms" srcDoc={preview} onLoad={() => iframeRef.current?.contentWindow?.postMessage({ kind: 'webapp.mode', token: loadToken, mode }, '*')} /> : <textarea aria-label={`Editing ${selectedFile}`} value={bundle.files[selectedFile]} disabled={!canEdit} onChange={event => updateFile(event.target.value)} onBlur={persistCurrent} spellCheck={false} />}</div>
      <aside className="webapp-comments"><h2>Comments</h2><p className="comment-hint">Choose Annotate, then select an element in the preview.</p>{anchor ? <div className="comment-composer"><span>&lt;{anchor.tag}&gt; · {anchor.text || anchor.selector}</span><textarea aria-label="Comment" value={commentBody} onChange={event => setCommentBody(event.target.value)} placeholder="Leave feedback for this element…" /><button disabled={!canComment || !createComment || !commentBody.trim()} onClick={() => void submitComment()}><MessageSquarePlus /> Comment</button></div> : null}<div className="comment-list">{comments.filter(comment => !comment.deletedAt).map(comment => <button key={comment.id} onClick={() => reveal(comment)}><span>{String(comment.anchor.selector ?? 'Element')}</span><p>{comment.body}</p>{comment.resolvedAt ? <small>Resolved</small> : null}</button>)}</div></aside>
    </section>
    {appFullscreen ? createPortal(<button className="app-fullscreen-exit" onClick={() => setAppFullscreen(false)}><Minimize2 /> Back to editor</button>, document.body) : null}
  </main>;
}
