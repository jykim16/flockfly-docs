import { FileText, MessageSquare, Send, Smile, X } from 'lucide-react';
import type { Flockdoc } from '../../types';

export function DetailsDrawer({ item, onClose }: { item: Flockdoc; onClose: () => void }) {
  return <aside className="details" aria-label="Document details">
    <header><span><FileText />{item.name}</span><button aria-label="Close details" onClick={onClose}><X /></button></header>
    <div className="drawer-tabs"><button className="active">Comments</button><button>Activity</button></div>
    <div className="thread">
      <div className="empty-thread"><MessageSquare /><strong>No comments yet</strong><span>Comments from people and agents will appear here.</span></div>
    </div>
    <div className="comment-box"><textarea aria-label="Add a comment" placeholder="Add a comment…" /><button aria-label="Add reaction"><Smile /></button><button aria-label="Send comment"><Send /></button></div>
  </aside>;
}
