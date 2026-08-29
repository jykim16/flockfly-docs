import { ArrowLeft, Bold, Italic, Link, List, MessageSquare, Redo2, Share2, Undo2 } from 'lucide-react';
import type { Flockdoc } from '../../types';

export function PaperEditor({ item, onBack }: { item: Flockdoc; onBack: () => void }) {
  return <main className="editor-shell">
    <header className="editor-header"><button aria-label="Back to workspace" onClick={onBack}><ArrowLeft /></button><div><strong>{item.name}</strong><span>Saved to Flockdoc</span></div><button className="share"><Share2 /> Share</button><span className="avatar">JK</span></header>
    <div className="paper-toolbar"><button><Undo2 /></button><button><Redo2 /></button><i /><button><Bold /></button><button><Italic /></button><button><Link /></button><button><List /></button><span>100%</span><button className="comments"><MessageSquare /> Comments</button></div>
    <section className="paper-canvas"><article contentEditable suppressContentEditableWarning aria-label="Paper editor">
      <h1>Product launch brief</h1><p className="lead">A shared source of truth for the team and the agents helping bring our next product to market.</p><h2>Market opportunity</h2><p>The addressable market is expanding as teams adopt collaborative AI workflows. Our initial focus is on product and operations teams that need people and agents to work within the same trusted document.</p><h2>Launch goals</h2><ul><li>Make every decision discoverable and attributable.</li><li>Reduce handoffs between research, planning, and execution.</li><li>Give agents safe, role-scoped access to the working document.</li></ul>
    </article></section>
  </main>;
}
