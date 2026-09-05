import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlockdocApi } from '../lib/api';
import { FlockdocOutbox } from '../lib/flockdoc-outbox';
import type { SpreadsheetOperation } from '../lib/spreadsheet-operations';
import type { Flockdoc } from '../types';
import { RemoteEditor } from '../features/editor/RemoteEditor';
import { mountSpreadsheet } from '../features/editor/univer/mount-spreadsheet';
import { mountPaper } from '../features/editor/univer/mount-paper';

vi.mock('../features/editor/univer/mount-spreadsheet', () => ({ mountSpreadsheet: vi.fn() }));
vi.mock('../features/editor/univer/mount-paper', () => ({ mountPaper: vi.fn() }));
vi.mock('../lib/flockdoc-realtime', () => ({
  getFlockdocRealtimeClientId: () => 'browser-1',
  FlockdocRealtimeRecovery: class { recover() { return Promise.resolve(); } },
  FlockdocRealtimeClient: class { start() { return Promise.resolve(); } stop() {} },
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

beforeEach(() => vi.clearAllMocks());

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
});
