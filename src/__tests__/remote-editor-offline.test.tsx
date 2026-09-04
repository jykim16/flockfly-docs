import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FlockdocApi } from '../lib/api';
import { FlockdocOutbox } from '../lib/flockdoc-outbox';
import type { SpreadsheetOperation } from '../lib/spreadsheet-operations';
import type { Flockdoc } from '../types';
import { RemoteEditor } from '../features/editor/RemoteEditor';
import { mountSpreadsheet } from '../features/editor/univer/mount-spreadsheet';

vi.mock('../features/editor/univer/mount-spreadsheet', () => ({ mountSpreadsheet: vi.fn() }));
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
});
