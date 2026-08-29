import { Bot, ExternalLink, FileText, Send, Smile, X } from 'lucide-react';
import { Avatar } from '../../components/Avatar';
import { initialComments, people } from '../../data';
import type { Flockdoc } from '../../types';

export function DetailsDrawer({ item, onClose }: { item: Flockdoc; onClose: () => void }) {
  return <aside className="details" aria-label="Document details">
    <header><span><FileText />{item.name}</span><button aria-label="Close details" onClick={onClose}><X /></button></header>
    <div className="drawer-tabs"><button className="active">Comments</button><button>Activity</button></div>
    <div className="thread">
      {initialComments.map(comment => <div className="comment" key={comment.id}><Avatar person={comment.author} /><div><p><strong>{comment.author.name}</strong><time>{comment.createdAt}</time></p><div>{comment.body}</div><small>Like　 Reply</small>{comment.replies?.map(reply => <div className="reply" key={reply.id}><Avatar person={reply.author} small /><div><p><strong>{reply.author.name}</strong><time>{reply.createdAt}</time></p><div>{reply.body}</div><small>Like　 Reply</small></div></div>)}</div></div>)}
      <div className="agent-entry"><Avatar person={people.agent} /><div><p><strong>Flockdoc Agent</strong><em>Agent</em></p><div>Generated draft executive summary based on the product brief and Q3 Operating Plan.</div><button><FileText />Executive summary (draft)<ExternalLink /></button></div></div>
    </div>
    <div className="comment-box"><textarea aria-label="Add a comment" placeholder="Add a comment…" /><button aria-label="Add reaction"><Smile /></button><button aria-label="Send comment"><Send /></button></div>
  </aside>;
}
