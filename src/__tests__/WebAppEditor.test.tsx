import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebAppEditor } from '../features/editor/WebAppEditor';

describe('WebAppEditor', () => {
  afterEach(() => document.body.classList.remove('webapp-app-fullscreen'));

  it('turns a sandbox element selection into a comment target', () => {
    render(<WebAppEditor item={{ id: 'app-1', name: 'Checkout', type: 'webapp', prefix: '', modifiedAt: 'Now', collaborators: [], snapshot: { entrypoint: 'index.html', files: { 'index.html': '<button id="buy">Buy</button>' } } }} onBack={vi.fn()} onRename={vi.fn()} onSnapshot={vi.fn()} />);
    const frame = screen.getByTitle('Web App preview') as HTMLIFrameElement;
    const token = frame.srcdoc.match(/var token=("[^"]+")/)?.[1];
    expect(token).toBeTruthy();
    act(() => window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, data: { kind: 'webapp.element.selected', token: JSON.parse(token!), anchor: { kind: 'webapp', selector: '#buy', tag: 'button', text: 'Buy' } } })));
    expect(screen.getByText(/<button> · Buy/)).toBeInTheDocument();
    expect(screen.getByLabelText('Comment')).toBeInTheDocument();
  });

  it('keeps interaction mode active when the preview reloads', () => {
    render(<WebAppEditor item={{ id: 'app-1', name: 'Checkout', type: 'webapp', prefix: '', modifiedAt: 'Now', collaborators: [], snapshot: { entrypoint: 'index.html', files: { 'index.html': '<button>Buy</button>' } } }} onBack={vi.fn()} onRename={vi.fn()} onSnapshot={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Interact' }));
    const frame = screen.getByTitle('Web App preview') as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, 'postMessage');
    fireEvent.load(frame);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ kind: 'webapp.mode', mode: 'interact' }), '*');
  });

  it('expands the rendered app to the full viewport and restores the editor', () => {
    render(<WebAppEditor item={{ id: 'app-1', name: 'Checkout', type: 'webapp', prefix: '', modifiedAt: 'Now', collaborators: [], snapshot: { entrypoint: 'index.html', files: { 'index.html': '<button>Buy</button>' } } }} onBack={vi.fn()} onRename={vi.fn()} onSnapshot={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'App full screen' }));
    expect(document.body).toHaveClass('webapp-app-fullscreen');
    expect(screen.getByRole('button', { name: 'Back to editor' })).toBeInTheDocument();
    expect(screen.getByTitle('Web App preview')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to editor' }));
    expect(document.body).not.toHaveClass('webapp-app-fullscreen');
  });
});
