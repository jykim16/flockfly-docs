import { ArrowLeft, Bold, ChevronDown, Italic, MessageSquare, Redo2, Share2, Undo2 } from 'lucide-react';
import type { Flockdoc } from '../../types';

const columns = Array.from({ length: 18 }, (_, index) => String.fromCharCode(65 + index));
const defaultRowCount = 40;

export function SpreadsheetEditor({ item, onBack, onRename }: { item: Flockdoc; onBack: () => void; onRename: (name: string) => void }) {
  return <main className="editor-shell sheet-editor">
    <header className="editor-header"><button aria-label="Back to workspace" onClick={onBack}><ArrowLeft /></button><div><input className="document-title" aria-label="Spreadsheet name" value={item.name} onChange={event => onRename(event.target.value)} /><span>Saved in this browser session</span></div><button className="share"><Share2 /> Share</button><span className="avatar">Local</span></header>
    <div className="sheet-menu"><button>File</button><button>Edit</button><button>View</button><button>Insert</button><button>Format</button><button>Data</button><button>Tools</button></div>
    <div className="sheet-toolbar"><button><Undo2 /></button><button><Redo2 /></button><i /><span>100% <ChevronDown /></span><button><Bold /></button><button><Italic /></button><span>Arial <ChevronDown /></span><span>10 <ChevronDown /></span><button className="comments"><MessageSquare /> Comments</button></div>
    <div className="formula"><span>A1</span><strong>fx</strong><input aria-label="Formula" /></div>
    <section className="spreadsheet-canvas" aria-label="Spreadsheet editor">
      <div className="sheet-tabs"><button className="active">Sheet 1</button></div>
      <div className="calendar-grid blank-sheet">{columns.map(column => <b key={column}>{column}</b>)}{Array.from({ length: columns.length * defaultRowCount }, (_, index) => <div key={index} contentEditable suppressContentEditableWarning />)}</div>
    </section>
  </main>;
}
