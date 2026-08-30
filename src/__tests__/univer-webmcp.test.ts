import type { IWebMCPTool } from '../lib/univer-webmcp';

import { describe, expect, it, vi } from 'vitest';
import { registerUniverWebMCP } from '../lib/univer-webmcp';

class FakeModelContext {
    tools = new Map<string, IWebMCPTool>();

    registerTool(tool: IWebMCPTool, options?: { signal?: AbortSignal }) {
        this.tools.set(tool.name, tool);
        options?.signal?.addEventListener('abort', () => this.tools.delete(tool.name), { once: true });
    }
}

function createHarness(canEdit = true) {
    const range = {
        activate: vi.fn(),
        breakApart: vi.fn(),
        getA1Notation: vi.fn(() => 'A1:C2'),
        getBackgrounds: vi.fn(() => [['#ffffff', '#ffffff'], ['#ffffff', '#ffffff']]),
        getCellStyleData: vi.fn(() => ({ ff: 'Arial', fs: 11 })),
        getColumn: vi.fn(() => 0),
        getFontFamily: vi.fn(() => 'Arial'),
        getFontSize: vi.fn(() => 11),
        getHeight: vi.fn(() => 2),
        getHorizontalAlignments: vi.fn(() => [['left', 'left'], ['left', 'left']]),
        getLastColumn: vi.fn(() => 2),
        getLastRow: vi.fn(() => 1),
        getRange: vi.fn(() => ({ startRow: 0, endRow: 1, startColumn: 0, endColumn: 2 })),
        getRow: vi.fn(() => 0),
        getFormulas: vi.fn(() => [['', '=A1*2'], ['', '']]),
        getValues: vi.fn(() => [['Item', 2], ['Total', 4]]),
        getVerticalAlignments: vi.fn(() => [['top', 'top'], ['top', 'top']]),
        getWidth: vi.fn(() => 3),
        getWraps: vi.fn(() => [[false, false], [false, false]]),
        merge: vi.fn(),
        mergeAcross: vi.fn(),
        mergeVertically: vi.fn(),
        setBackground: vi.fn(),
        setBorder: vi.fn(),
        setFontFamily: vi.fn(),
        setFontColor: vi.fn(),
        setFontSize: vi.fn(),
        setFontWeight: vi.fn(),
        setHorizontalAlignment: vi.fn(),
        setNumberFormat: vi.fn(),
        setValues: vi.fn(),
        setVerticalAlignment: vi.fn(),
        setWrap: vi.fn(),
    };
    const demoSheet = {
        activate: vi.fn(),
        getColumnWidth: vi.fn(() => 88),
        getDataRange: vi.fn(() => range),
        getMaxColumns: vi.fn(() => 26),
        getMaxRows: vi.fn(() => 100),
        getMergedRanges: vi.fn(() => [range]),
        getRange: vi.fn((name?: string) => name === 'A1:B2'
            ? {
                ...range,
                getLastColumn: vi.fn(() => 1),
                getRange: vi.fn(() => ({ startRow: 0, endRow: 1, startColumn: 0, endColumn: 1 })),
                getWidth: vi.fn(() => 2),
            }
            : range),
        getRowHeight: vi.fn(() => 24),
        getSheetId: vi.fn(() => 'demo-id'),
        getSheetName: vi.fn(() => 'Demo'),
        hasHiddenGridLines: vi.fn(() => false),
        setColumnWidths: vi.fn(),
        setHiddenGridlines: vi.fn(),
        setName: vi.fn(),
        setRowHeightsForced: vi.fn(),
    };
    const otherSheet = {
        ...demoSheet,
        getSheetId: vi.fn(() => 'other-id'),
        getSheetName: vi.fn(() => 'Other'),
    };
    otherSheet.setName = vi.fn(() => otherSheet);
    const workbook = {
        create: vi.fn(() => otherSheet),
        duplicateSheet: vi.fn(() => otherSheet),
        getActiveSheet: vi.fn(() => demoSheet),
        getId: vi.fn(() => 'workbook-id'),
        getName: vi.fn(() => 'WebMCP workbook'),
        getSheetByName: vi.fn((name: string) => name === 'Demo' ? demoSheet : null),
        getSheets: vi.fn(() => [demoSheet, otherSheet]),
    };
    const univerAPI = {
        Enum: {
            BorderStyleTypes: { THIN: 'thin' },
            BorderType: { ALL: 'all' },
        },
        getActiveWorkbook: vi.fn(() => workbook),
    };
    const modelContext = new FakeModelContext();
    const ownerDocument = {
        defaultView: { AbortController },
        modelContext,
    } as unknown as Document;
    const cleanup = registerUniverWebMCP({ ownerDocument, univerAPI: univerAPI as never, canEdit });

    async function execute(name: string, input: Record<string, unknown> = {}) {
        const tool = modelContext.tools.get(name);
        if (!tool) {
            throw new Error(`Missing tool: ${name}`);
        }
        return tool.execute(input);
    }

    return { cleanup, demoSheet, execute, modelContext, range, workbook };
}

describe('Univer WebMCP', () => {
    it('registers only read tools when the caller cannot edit', () => {
        const { cleanup, modelContext } = createHarness(false);
        expect([...modelContext.tools.keys()]).toEqual(['read_me', 'inspect_workbook', 'read_range']);
        cleanup();
    });

    it('registers spreadsheet tools and unregisters them on cleanup', () => {
        const { cleanup, modelContext } = createHarness();

        expect([...modelContext.tools.keys()]).toEqual([
            'read_me',
            'inspect_workbook',
            'read_range',
            'write_range',
            'format_range',
            'merge_cells',
            'modify_grid',
            'manage_sheet',
            'create_sheet',
        ]);

        cleanup();
        expect(modelContext.tools.size).toBe(0);
    });

    it('is a no-op when WebMCP is unavailable', () => {
        const ownerDocument = { defaultView: { AbortController } } as unknown as Document;

        expect(() => registerUniverWebMCP({
            ownerDocument,
            univerAPI: { getActiveWorkbook: vi.fn() } as never,
        })).not.toThrow();
    });

    it('describes the active workbook', async () => {
        const { execute } = createHarness();

        const result = await execute('inspect_workbook');

        expect(result.structuredContent).toEqual({
            workbook: { id: 'workbook-id', name: 'WebMCP workbook' },
            activeSheet: 'Demo',
            sheets: [
                { id: 'demo-id', name: 'Demo' },
                { id: 'other-id', name: 'Other' },
            ],
        });
    });

    it('reads values and formulas from a named sheet range', async () => {
        const { execute, range } = createHarness();

        const result = await execute('read_range', { sheet: 'Demo', range: 'A1:B2' });

        expect(range.getValues).toHaveBeenCalledOnce();
        expect(result.structuredContent).toEqual({
            sheet: 'Demo',
            range: 'A1:B2',
            values: [['Item', 2], ['Total', 4]],
            formulas: [['', '=A1*2'], ['', '']],
        });
    });

    it('reads styles, merges, and dimensions when requested', async () => {
        const { execute } = createHarness();

        const result = await execute('read_range', {
            sheet: 'Demo',
            range: 'A1:C2',
            include: ['values', 'styles', 'merges', 'row_heights', 'column_widths'],
        });

        expect(result.structuredContent).toMatchObject({
            sheet: 'Demo',
            range: 'A1:C2',
            values: [['Item', 2], ['Total', 4]],
            merges: ['A1:C2'],
            rowHeights: [24, 24],
            columnWidths: [88, 88, 88],
            styles: {
                topLeft: {
                    font_family: 'Arial',
                    font_size: 11,
                },
            },
        });
    });

    it('writes and activates a rectangular range', async () => {
        const { execute, range } = createHarness();
        const values = [['Product', 'Revenue'], ['Notebook', 2400]];

        const result = await execute('write_range', {
            sheet: 'Demo',
            range: 'A1:B2',
            values_json: JSON.stringify(values),
        });

        expect(range.setValues).toHaveBeenCalledWith(values);
        expect(range.activate).toHaveBeenCalledOnce();
        expect(result.structuredContent).toEqual({ sheet: 'Demo', range: 'A1:B2', cellsWritten: 4 });
    });

    it.each([
        ['malformed JSON', '{'],
        ['an object', '{}'],
        ['a ragged matrix', '[[1,2],[3]]'],
    ])('rejects %s without changing cells', async (_label, valuesJson) => {
        const { execute, range } = createHarness();

        const result = await execute('write_range', {
            range: 'A1:B2',
            values_json: valuesJson,
        });

        expect(result.isError).toBe(true);
        expect(range.setValues).not.toHaveBeenCalled();
    });

    it('rejects a payload whose dimensions do not match the declared range', async () => {
        const { execute, range } = createHarness();

        const result = await execute('write_range', {
            range: 'A1:C2',
            values_json: JSON.stringify([['A', 'B']]),
        });

        expect(result.isError).toBe(true);
        expect(range.setValues).not.toHaveBeenCalled();
    });

    it('formats and activates a range', async () => {
        const { execute, range } = createHarness();

        await execute('format_range', {
            range: 'A1:B1',
            background_color: '#1d4ed8',
            font_color: '#ffffff',
            font_weight: 'bold',
            number_format: '$#,##0.00',
        });

        expect(range.setBackground).toHaveBeenCalledWith('#1d4ed8');
        expect(range.setFontColor).toHaveBeenCalledWith('#ffffff');
        expect(range.setFontWeight).toHaveBeenCalledWith('bold');
        expect(range.setNumberFormat).toHaveBeenCalledWith('$#,##0.00');
        expect(range.activate).toHaveBeenCalledOnce();
    });

    it('applies layout formatting using the range dimensions', async () => {
        const { demoSheet, execute, range } = createHarness();

        await execute('format_range', {
            range: 'A1:C2',
            font_family: 'Arial',
            font_size: 24,
            horizontal_alignment: 'center',
            vertical_alignment: 'middle',
            wrap_text: true,
            border_style: 'thin',
            border_color: '#666666',
            row_height: 72,
            column_width: 120,
        });

        expect(range.setFontFamily).toHaveBeenCalledWith('Arial');
        expect(range.setFontSize).toHaveBeenCalledWith(24);
        expect(range.setHorizontalAlignment).toHaveBeenCalledWith('center');
        expect(range.setVerticalAlignment).toHaveBeenCalledWith('middle');
        expect(range.setWrap).toHaveBeenCalledWith(true);
        expect(range.setBorder).toHaveBeenCalledWith('all', 'thin', '#666666');
        expect(demoSheet.setRowHeightsForced).toHaveBeenCalledWith(0, 2, 72);
        expect(demoSheet.setColumnWidths).toHaveBeenCalledWith(0, 3, 120);
        expect(range.activate).toHaveBeenCalledOnce();
    });

    it('formats multiple discontiguous ranges in one call', async () => {
        const { execute, range } = createHarness();

        await execute('format_range', {
            ranges_json: JSON.stringify(['A1:C1', 'D1:F1']),
            font_weight: 'bold',
        });

        expect(range.setFontWeight).toHaveBeenCalledTimes(2);
    });

    it('merges and activates a range', async () => {
        const { execute, range } = createHarness();

        const result = await execute('merge_cells', { sheet: 'Demo', range: 'A1:C2' });

        expect(range.merge).toHaveBeenCalledOnce();
        expect(range.activate).toHaveBeenCalledOnce();
        expect(result.structuredContent).toEqual({ sheet: 'Demo', range: 'A1:C2' });
    });

    it('modifies grid geometry through one operation tool', async () => {
        const { demoSheet, execute, range } = createHarness();

        await execute('modify_grid', { operation: 'merge', range: 'A1:C2' });
        await execute('modify_grid', { operation: 'set_row_height', range: 'A1:C2', size: 72 });
        await execute('modify_grid', { operation: 'set_column_width', range: 'A1:C2', size: 120 });

        expect(range.merge).toHaveBeenCalledOnce();
        expect(demoSheet.setRowHeightsForced).toHaveBeenCalledWith(0, 2, 72);
        expect(demoSheet.setColumnWidths).toHaveBeenCalledWith(0, 3, 120);
    });

    it('manages sheet activation and gridlines', async () => {
        const { demoSheet, execute } = createHarness();

        await execute('manage_sheet', { operation: 'activate', sheet: 'Demo' });
        await execute('manage_sheet', { operation: 'set_gridlines', sheet: 'Demo', show_gridlines: false });

        expect(demoSheet.activate).toHaveBeenCalledOnce();
        expect(demoSheet.setHiddenGridlines).toHaveBeenCalledWith(true);
    });

    it('duplicates and renames a worksheet', async () => {
        const { execute, workbook } = createHarness();

        const result = await execute('manage_sheet', { operation: 'duplicate', sheet: 'Demo', name: 'Copy' });

        expect(workbook.duplicateSheet).toHaveBeenCalledOnce();
        expect(result.structuredContent).toMatchObject({ operation: 'duplicate', sheet: 'Demo', name: 'Other' });
    });

    it('creates and activates a worksheet', async () => {
        const { execute, workbook } = createHarness();

        const result = await execute('create_sheet', { name: 'Forecast', rows: 60, columns: 12 });

        expect(workbook.create).toHaveBeenCalledWith('Forecast', 60, 12);
        expect(result.structuredContent).toEqual({ name: 'Other', rows: 60, columns: 12 });
    });
});
