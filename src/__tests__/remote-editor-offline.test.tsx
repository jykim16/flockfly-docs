import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlockdocApi } from '../lib/api';
import { FlockdocOutbox } from '../lib/flockdoc-outbox';
import type { SpreadsheetOperation } from '../lib/spreadsheet-operations';
import type { Flockdoc } from '../types';
import { RemoteEditor } from '../features/editor/RemoteEditor';
import { mountSpreadsheet } from '../features/editor/univer/mount-spreadsheet';
import { mountPaper } from '../features/editor/univer/mount-paper';
import { encodePaperOperation, PaperCollaborationDocument } from '../lib/paper-collaboration';
import { DiagramEditor } from '../features/editor/DiagramEditor';
import { encodeDiagramOperation, type DiagramOperation } from '../lib/diagram-operations';
import { WebAppEditor } from '../features/editor/WebAppEditor';
import { encodeWebAppOperation, type WebAppOperation } from '../lib/webapp-operations';

const realtimeState = vi.hoisted(() => ({
  handlers: [] as Array<(event: unknown) => void | Promise<void>>,
}));

vi.mock('../features/editor/univer/mount-spreadsheet', () => ({ mountSpreadsheet: vi.fn() }));
vi.mock('../features/editor/univer/mount-paper', () => ({ mountPaper: vi.fn() }));
vi.mock('../features/editor/DiagramEditor', () => ({ DiagramEditor: vi.fn(() => <div aria-label="Diagram editor" />) }));
vi.mock('../features/editor/WebAppEditor', () => ({ WebAppEditor: vi.fn(() => <div aria-label="Web App editor" />) }));
vi.mock('../lib/flockdoc-realtime', () => ({
  getFlockdocRealtimeClientId: () => 'browser-1',
  FlockdocRealtimeRecovery: class { recover() { return Promise.resolve(); } },
  FlockdocRealtimeClient: class {
    constructor(_api: unknown, _flockdocId: string, _clientId: string, onEvent: (event: unknown) => void | Promise<void>) {
      realtimeState.handlers.push(onEvent);
    }
    start() { return Promise.resolve(); }
    stop() {}
  },
}));

const item: Flockdoc = {
  id: 'flockdoc-1',
  name: 'Forecast',
  type: 'spreadsheet',
  prefix: '',
  modifiedAt: 'Just now',
  collaborators: [],
  permissions: { canRead: true, canComment: true, canEdit: true, canShare: true, canDelete: true },
};

const paperItem: Flockdoc = { ...item, id: 'paper-1', name: 'Plan', type: 'paper' };
const diagramItem: Flockdoc = { ...item, id: 'diagram-1', name: 'Architecture', type: 'diagram' };
const webAppItem: Flockdoc = { ...item, id: 'webapp-1', name: 'Launch', type: 'webapp' };

beforeEach(() => {
  realtimeState.handlers = [];
  vi.clearAllMocks();
});

describe('remote editor offline persistence', () => {
  it('accepts edits while offline and flushes the durable queue on reconnect', async () => {
    vi.mocked(mountSpreadsheet).mockReturnValue({ applySnapshot: vi.fn(), dispose: vi.fn() });
    const operation: SpreadsheetOperation = {
      protocolVersion: 1,
      kind: 'spreadsheet.cells.patch',
      sheetId: 'sheet-1',
      changes: [{ row: 1, column: 1, value: 'queued' }],
    };
    const api = {
      getState: vi.fn().mockResolvedValue({ flockdoc: item, revision: 4, snapshotRevision: 4, snapshot: null }),
      appendSpreadsheetOperation: vi.fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ revision: 5, duplicate: false }),
    } as unknown as FlockdocApi;
    const outbox = new FlockdocOutbox(localStorage, 'user@flockfly.ai');

    render(<RemoteEditor api={api} outbox={outbox} item={item} onBack={vi.fn()} onUpdate={vi.fn()} />);
    await waitFor(() => expect(mountSpreadsheet).toHaveBeenCalledOnce());
    const editor = vi.mocked(mountSpreadsheet).mock.lastCall![0];

    await act(async () => {
      await expect(editor.onSpreadsheetOperation?.(operation)).resolves.toBeUndefined();
    });
    expect(outbox.pending()).toHaveLength(1);
    expect(screen.getByText('Saved in browser — waiting for connection')).toBeInTheDocument();

    await act(async () => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(outbox.pending()).toEqual([]));
    expect(screen.queryByText('Saved in browser — waiting for connection')).not.toBeInTheDocument();
    expect(api.appendSpreadsheetOperation).toHaveBeenCalledTimes(2);
  });

  it('journals a multiline Paper edit and checkpoints the acknowledged state', async () => {
    const applySnapshot = vi.fn();
    vi.mocked(mountPaper).mockReturnValue({ applySnapshot, getSnapshot: vi.fn(), dispose: vi.fn() });
    const initial = { id: 'paper-1', body: { dataStream: 'hello\r\n', paragraphs: [{ startIndex: 5 }] } };
    const next = { id: 'paper-1', body: { dataStream: 'hello\rworld\r\n', paragraphs: [{ startIndex: 5 }, { startIndex: 11 }] } };
    const api = {
      getState: vi.fn()
        .mockResolvedValueOnce({ flockdoc: paperItem, revision: 0, snapshotRevision: 0, snapshot: initial })
        .mockResolvedValueOnce({ flockdoc: paperItem, revision: 1, snapshotRevision: 0, snapshot: initial }),
      appendPaperOperation: vi.fn().mockResolvedValue({ revision: 1, duplicate: false }),
      saveCheckpoint: vi.fn().mockResolvedValue({ revision: 2, duplicate: false, snapshotKey: 'snapshot-2' }),
    } as unknown as FlockdocApi;
    const outbox = new FlockdocOutbox(localStorage, 'paper-user@flockfly.ai');

    render(<RemoteEditor api={api} outbox={outbox} item={paperItem} onBack={vi.fn()} onUpdate={vi.fn()} />);
    await waitFor(() => expect(mountPaper).toHaveBeenCalledOnce());
    const editor = vi.mocked(mountPaper).mock.lastCall![0];
    await act(async () => { await editor.onPaperSnapshotChange?.(next); });

    expect(api.appendPaperOperation).toHaveBeenCalledOnce();
    expect(api.saveCheckpoint).toHaveBeenCalledWith('paper-1', 1, expect.any(String), expect.objectContaining({
      flockdocCollaboration: expect.objectContaining({ kind: 'paper.yjs.snapshot' }),
      univer: expect.objectContaining({ body: expect.objectContaining({ dataStream: 'hello\rworld\r\n' }) }),
    }), 'browser-1');
    expect(outbox.pending()).toEqual([]);
    expect(applySnapshot).not.toHaveBeenCalled();
  });

  it('persists a Paper title after the debounce', async () => {
    vi.mocked(mountPaper).mockReturnValue({ applySnapshot: vi.fn(), dispose: vi.fn() });
    const api = {
      getState: vi.fn().mockResolvedValue({ flockdoc: paperItem, revision: 0, snapshotRevision: 0, snapshot: null }),
      rename: vi.fn().mockResolvedValue({ flockdoc: { ...paperItem, name: 'Roadmap' } }),
    } as unknown as FlockdocApi;
    const outbox = new FlockdocOutbox(localStorage, 'title-user@flockfly.ai');

    render(<RemoteEditor api={api} outbox={outbox} item={paperItem} onBack={vi.fn()} onUpdate={vi.fn()} />);
    await waitFor(() => expect(mountPaper).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Paper name'), { target: { value: 'Roadmap' } });
    await waitFor(() => expect(api.rename).toHaveBeenCalledWith('paper-1', 'Roadmap'), { timeout: 1500 });
    expect(outbox.pending()).toEqual([]);
  });

  it('keeps a receiving Paper editor mounted through a remote operation and its checkpoint', async () => {
    const initial = { id: 'paper-1', body: { dataStream: 'hello world\r\n' } };
    const next = { id: 'paper-1', body: { dataStream: 'hello brave world\r\n' } };
    const source = new PaperCollaborationDocument('paper-1', initial);
    const operation = source.updateFromSnapshot(next)!;
    const applySnapshot = vi.fn<(snapshot: unknown) => void>();
    const applyPaperPatch = vi.fn<(patch: { index: number; deleteCount: number; insert: string }) => void>();
    vi.mocked(mountPaper).mockImplementation(() => ({ applySnapshot, applyPaperPatch, dispose: vi.fn() }));
    let stateReads = 0;
    const api = {
      getState: vi.fn().mockImplementation(() => Promise.resolve(stateReads++ < 1
        ? { flockdoc: paperItem, revision: 0, snapshotRevision: 0, snapshot: initial }
        : { flockdoc: paperItem, revision: 2, snapshotRevision: 2, snapshot: source.checkpoint() })),
    } as unknown as FlockdocApi;

    render(<RemoteEditor
      api={api}
      outbox={new FlockdocOutbox(localStorage, 'receiver@flockfly.ai')}
      item={paperItem}
      onBack={vi.fn()}
      onUpdate={vi.fn()}
    />);
    await waitFor(() => expect(mountPaper).toHaveBeenCalledOnce());
    expect(realtimeState.handlers).toHaveLength(1);

    const committedUpdate = {
      protocolVersion: 1 as const,
      kind: 'update.committed' as const,
      eventId: 'update-1',
      flockdocId: 'paper-1',
      clientId: 'remote-author',
      actor: { type: 'user' as const, id: 'user-2', displayName: 'Writer' },
      occurredAt: new Date().toISOString(),
      revision: 1,
      idempotencyKey: 'operation-1',
      updateBase64: encodePaperOperation(operation),
    };
    const committedCheckpoint = {
      ...committedUpdate,
      kind: 'revision.committed' as const,
      eventId: 'checkpoint-2',
      revision: 2,
      idempotencyKey: 'checkpoint-2',
      snapshotKey: 'snapshot-2',
    };
    await act(async () => {
      await realtimeState.handlers[0](committedUpdate);
      await realtimeState.handlers[0](committedCheckpoint);
    });

    await waitFor(() => expect(applyPaperPatch).toHaveBeenCalledWith({
      index: 6,
      deleteCount: 0,
      insert: 'brave ',
    }));
    expect(applySnapshot).not.toHaveBeenCalled();
    expect(api.getState).toHaveBeenCalledOnce();
  });

  it('journals and checkpoints a Diagram scene through the durable outbox', async () => {
    const api = {
      getState: vi.fn().mockResolvedValue({ flockdoc: diagramItem, revision: 0, snapshotRevision: 0, snapshot: { elements: [] } }),
      appendDiagramOperation: vi.fn().mockResolvedValue({ revision: 1, duplicate: false }),
      saveCheckpoint: vi.fn().mockResolvedValue({ revision: 2, duplicate: false, snapshotKey: 'diagram-snapshot-2' }),
    } as unknown as FlockdocApi;
    const outbox = new FlockdocOutbox(localStorage, 'diagram-user@flockfly.ai');

    render(<RemoteEditor api={api} outbox={outbox} item={diagramItem} onBack={vi.fn()} onUpdate={vi.fn()} />);
    await waitFor(() => expect(DiagramEditor).toHaveBeenCalled());
    const editor = vi.mocked(DiagramEditor).mock.lastCall![0];
    const scene = { elements: [{ id: 'box-1', type: 'rectangle' }] };
    await act(async () => { await editor.onDiagramSceneChange?.(scene); });

    expect(api.appendDiagramOperation).toHaveBeenCalledWith('diagram-1', expect.any(String), 'browser-1', {
      protocolVersion: 1,
      kind: 'diagram.excalidraw.update',
      scene,
    });
    expect(api.saveCheckpoint).toHaveBeenCalledWith('diagram-1', 1, expect.any(String), scene, 'browser-1');
    expect(outbox.pending()).toEqual([]);
  });

  it('delivers a remote Diagram scene without replacing the editor', async () => {
    const api = {
      getState: vi.fn().mockResolvedValue({ flockdoc: diagramItem, revision: 0, snapshotRevision: 0, snapshot: { elements: [] } }),
    } as unknown as FlockdocApi;
    render(<RemoteEditor api={api} outbox={new FlockdocOutbox(localStorage, 'diagram-receiver@flockfly.ai')} item={diagramItem} onBack={vi.fn()} onUpdate={vi.fn()} />);
    await waitFor(() => expect(DiagramEditor).toHaveBeenCalled());
    const operation: DiagramOperation = {
      protocolVersion: 1,
      kind: 'diagram.excalidraw.update',
      scene: { elements: [{ id: 'arrow-1', type: 'arrow' }] },
    };
    await act(async () => realtimeState.handlers[0]({
      protocolVersion: 1,
      kind: 'update.committed',
      eventId: 'diagram-update-1',
      flockdocId: 'diagram-1',
      clientId: 'remote-author',
      actor: { type: 'user', id: 'user-2', displayName: 'Architect' },
      occurredAt: new Date().toISOString(),
      revision: 1,
      idempotencyKey: 'diagram-operation-1',
      updateBase64: encodeDiagramOperation(operation),
    }));

    await waitFor(() => expect(vi.mocked(DiagramEditor).mock.lastCall![0].remoteScenes).toEqual([
      { revision: 1, scene: operation.scene },
    ]));
  });

  it('journals, checkpoints, and receives Web App bundles', async () => {
    const initial = { entrypoint: 'index.html', files: { 'index.html': '<h1>Launch</h1>' } };
    const next = { entrypoint: 'index.html', files: { 'index.html': '<h1>Ready</h1>', 'app.js': 'console.log(1)' } };
    const api = {
      getState: vi.fn().mockResolvedValue({ flockdoc: webAppItem, revision: 0, snapshotRevision: 0, snapshot: initial }),
      appendWebAppOperation: vi.fn().mockResolvedValue({ revision: 1, duplicate: false }),
      saveCheckpoint: vi.fn().mockResolvedValue({ revision: 2, duplicate: false, snapshotKey: 'webapp-snapshot-2' }),
      listComments: vi.fn().mockResolvedValue({ comments: [] }),
    } as unknown as FlockdocApi;
    const outbox = new FlockdocOutbox(localStorage, 'webapp-user@flockfly.ai');
    render(<RemoteEditor api={api} outbox={outbox} item={webAppItem} onBack={vi.fn()} onUpdate={vi.fn()} />);
    await waitFor(() => expect(WebAppEditor).toHaveBeenCalled());
    await act(async () => { await vi.mocked(WebAppEditor).mock.lastCall![0].onWebAppBundleChange?.(next); });
    expect(api.appendWebAppOperation).toHaveBeenCalledWith('webapp-1', expect.any(String), 'browser-1', expect.objectContaining({ kind: 'webapp.bundle.update', bundle: next }));
    expect(api.saveCheckpoint).toHaveBeenCalledWith('webapp-1', 1, expect.any(String), next, 'browser-1');

    const operation: WebAppOperation = { protocolVersion: 1, kind: 'webapp.bundle.update', bundle: next };
    await act(async () => realtimeState.handlers[0]({
      protocolVersion: 1, kind: 'update.committed', eventId: 'webapp-update-3', flockdocId: 'webapp-1',
      clientId: 'remote-author', actor: { type: 'user', id: 'user-2', displayName: 'Designer' }, occurredAt: new Date().toISOString(),
      revision: 3, idempotencyKey: 'webapp-operation-3', updateBase64: encodeWebAppOperation(operation),
    }));
    await waitFor(() => expect(vi.mocked(WebAppEditor).mock.lastCall![0].remoteBundles).toEqual([{ revision: 3, bundle: next }]));
  });
});
