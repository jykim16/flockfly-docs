import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Flockdoc } from '../types';
import { PaperEditor } from '../features/editor/PaperEditor';
import { SpreadsheetEditor } from '../features/editor/SpreadsheetEditor';
import { mountPaper } from '../features/editor/univer/mount-paper';
import { mountSpreadsheet } from '../features/editor/univer/mount-spreadsheet';

vi.mock('../features/editor/univer/mount-paper', () => ({ mountPaper: vi.fn() }));
vi.mock('../features/editor/univer/mount-spreadsheet', () => ({ mountSpreadsheet: vi.fn() }));

const baseItem: Flockdoc = {
  id: 'flockdoc_1',
  name: 'Plan',
  type: 'paper',
  modifiedAt: 'Just now',
  prefix: '',
  collaborators: [],
  snapshot: { revision: 1 },
};

const editorProps = {
  onBack: vi.fn(),
  onRename: vi.fn(),
  onSnapshot: vi.fn(),
};

describe('remote editor snapshot refresh', () => {
  it('updates Paper through its mounted adapter without replacing the editor shell', async () => {
    const applySnapshot = vi.fn();
    vi.mocked(mountPaper).mockReturnValue({ applySnapshot, dispose: vi.fn() });
    const view = render(<PaperEditor item={baseItem} {...editorProps} />);
    await waitFor(() => expect(mountPaper).toHaveBeenCalledOnce());
    const host = view.getByLabelText('Paper editor');

    view.rerender(<PaperEditor item={{ ...baseItem, snapshot: { revision: 2 } }} {...editorProps} />);

    await waitFor(() => expect(applySnapshot).toHaveBeenCalledWith({ revision: 2 }));
    expect(view.getByLabelText('Paper editor')).toBe(host);
    expect(mountPaper).toHaveBeenCalledOnce();
  });

  it('updates Spreadsheet through its mounted adapter without replacing the editor shell', async () => {
    const applySnapshot = vi.fn();
    const applySpreadsheetOperation = vi.fn();
    vi.mocked(mountSpreadsheet).mockReturnValue({ applySnapshot, applySpreadsheetOperation, dispose: vi.fn() });
    const item = { ...baseItem, type: 'spreadsheet' as const };
    const view = render(<SpreadsheetEditor item={item} {...editorProps} />);
    await waitFor(() => expect(mountSpreadsheet).toHaveBeenCalledOnce());
    const host = view.getByLabelText('Spreadsheet editor');

    view.rerender(<SpreadsheetEditor item={{ ...item, snapshot: { revision: 2 } }} {...editorProps} />);

    await waitFor(() => expect(applySnapshot).toHaveBeenCalledWith({ revision: 2 }));
    const operation = {
      protocolVersion: 1 as const,
      kind: 'spreadsheet.cells.patch' as const,
      sheetId: 'sheet-1',
      changes: [{ row: 0, column: 0, value: 'Remote' }],
    };
    view.rerender(<SpreadsheetEditor item={{ ...item, snapshot: { revision: 2 } }} {...editorProps} remoteOperation={{ revision: 3, operation }} />);
    await waitFor(() => expect(applySpreadsheetOperation).toHaveBeenCalledWith(operation));
    expect(view.getByLabelText('Spreadsheet editor')).toBe(host);
    expect(mountSpreadsheet).toHaveBeenCalledOnce();
  });

  it('writes an authoritative Univer snapshot when checkpoint compaction is requested', async () => {
    const snapshot = { id: 'flockdoc_1', sheets: { 'sheet-1': { name: 'Plan' } } };
    const getSnapshot = vi.fn(() => snapshot);
    const onSnapshot = vi.fn().mockResolvedValue(undefined);
    vi.mocked(mountSpreadsheet).mockReturnValue({ applySnapshot: vi.fn(), getSnapshot, dispose: vi.fn() });
    const item = { ...baseItem, type: 'spreadsheet' as const };
    const view = render(<SpreadsheetEditor item={item} {...editorProps} onSnapshot={onSnapshot} />);
    await waitFor(() => expect(mountSpreadsheet).toHaveBeenCalledOnce());

    view.rerender(<SpreadsheetEditor item={item} {...editorProps} onSnapshot={onSnapshot} checkpointRevision={100} />);

    await waitFor(() => expect(onSnapshot).toHaveBeenCalledWith(snapshot));
    expect(getSnapshot).toHaveBeenCalledOnce();
  });
});
