import { ArrowLeft, Bold, Italic, Link, List, MessageSquare, Redo2, Share2, Undo2 } from 'lucide-react';
import type { Flockdoc } from '../../types';

export function PaperEditor({ item, onBack, onRename }: { item: Flockdoc; onBack: () => void; onRename: (name: string) => void }) {
  return <main className="editor-shell">
    <header className="editor-header"><button aria-label="Back to workspace" onClick={onBack}><ArrowLeft /></button><div><input className="document-title" aria-label="Paper name" value={item.name} onChange={event => onRename(event.target.value)} /><span>Saved in this browser session</span></div><button className="share"><Share2 /> Share</button><span className="avatar">Local</span></header>
    <div className="paper-toolbar"><button><Undo2 /></button><button><Redo2 /></button><i /><button><Bold /></button><button><Italic /></button><button><Link /></button><button><List /></button><span>100%</span><button className="comments"><MessageSquare /> Comments</button></div>
    <section className="paper-canvas"><article contentEditable suppressContentEditableWarning aria-label="Paper editor" data-placeholder="Start writing…" /></section>
  </main>;
}
