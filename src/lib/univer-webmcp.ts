import type { FUniver } from '@univerjs/core/facade';

const MAX_INPUT_LENGTH = 1024 * 1024;
const MAX_SHEET_ROWS = 10_000;
const MAX_SHEET_COLUMNS = 1_000;

const SPREADSHEET_GUIDE = `# Univer spreadsheet site tools

Use inspect_workbook before editing to learn the workbook and sheet names.
Ranges use A1 notation, for example A1:D10. Omit sheet to use the active sheet.
Use write_range with values_json containing a rectangular JSON array. Strings beginning with = are formulas.
Use format_range after writing values. Use merge_cells for title bands and layout blocks.
Prefer short, targeted calls and read the edited range back to verify it.`;

type SpreadsheetCellValue = boolean | number | string;

interface IWebMCPTextContent {
    type: 'text';
    text: string;
}

export interface IWebMCPResult {
    content: IWebMCPTextContent[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
}

export interface IWebMCPTool {
    name: string;
    title?: string;
    description: string;
    inputSchema?: Record<string, unknown>;
    annotations?: Record<string, boolean>;
    execute: (input: Record<string, unknown>) => Promise<IWebMCPResult>;
}

interface IWebMCPModelContext {
    registerTool: (tool: IWebMCPTool, options?: { signal?: AbortSignal }) => Promise<void> | void;
}

type WebMCPDocument = Document & {
    modelContext?: IWebMCPModelContext;
};

interface IRegisterUniverWebMCPOptions {
    ownerDocument: Document;
    univerAPI: FUniver;
}

const textResult = (
    text: string,
    options: Pick<IWebMCPResult, 'isError' | 'structuredContent'> = {}
): IWebMCPResult => ({
    content: [{ type: 'text', text }],
    ...options,
});

const errorResult = (message: string): IWebMCPResult => textResult(message, { isError: true });

const objectSchema = (properties: Record<string, unknown>, required: string[]) => ({
    type: 'object',
    properties,
    required,
    additionalProperties: false,
});

function nonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function parseMatrix(value: unknown): { matrix: SpreadsheetCellValue[][] } | { error: IWebMCPResult } {
    if (typeof value !== 'string') {
        return { error: errorResult('values_json must be a JSON string.') };
    }
    if (value.length > MAX_INPUT_LENGTH) {
        return { error: errorResult(`values_json exceeds the ${MAX_INPUT_LENGTH} character limit.`) };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch (error) {
        return { error: errorResult(`Invalid values_json: ${(error as Error).message}`) };
    }

    if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(Array.isArray)) {
        return { error: errorResult('values_json must decode to a non-empty two-dimensional array.') };
    }

    const matrix = parsed as unknown[][];
    const width = matrix[0].length;
    const isCellValue = (cell: unknown): cell is SpreadsheetCellValue =>
        ['boolean', 'number', 'string'].includes(typeof cell);
    if (width === 0 || matrix.some((row) => row.length !== width || row.some((cell) => !isCellValue(cell)))) {
        return { error: errorResult('values_json must be a rectangular matrix of strings, numbers, or booleans.') };
    }

    return { matrix: matrix as SpreadsheetCellValue[][] };
}

function parseRangeNames(range: unknown, rangesJson: unknown): { ranges: string[] } | { error: IWebMCPResult } {
    if (nonEmptyString(range)) return { ranges: [range] };
    if (typeof rangesJson !== 'string') {
        return { error: errorResult('Provide range or ranges_json.') };
    }
    if (rangesJson.length > MAX_INPUT_LENGTH) {
        return { error: errorResult(`ranges_json exceeds the ${MAX_INPUT_LENGTH} character limit.`) };
    }
    try {
        const parsed = JSON.parse(rangesJson);
        if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(nonEmptyString)) {
            return { error: errorResult('ranges_json must decode to a non-empty array of A1 range strings.') };
        }
        return { ranges: parsed };
    } catch (error) {
        return { error: errorResult(`Invalid ranges_json: ${(error as Error).message}`) };
    }
}

function getWorkbook(univerAPI: FUniver) {
    const workbook = univerAPI.getActiveWorkbook();
    if (!workbook) {
        throw new Error('No active spreadsheet workbook is available.');
    }
    return workbook;
}

function getSheet(univerAPI: FUniver, name: unknown) {
    const workbook = getWorkbook(univerAPI);
    if (name === undefined || name === null || name === '') {
        return workbook.getActiveSheet();
    }
    if (!nonEmptyString(name)) {
        throw new Error('sheet must be a non-empty string when provided.');
    }
    const sheet = workbook.getSheetByName(name);
    if (!sheet) {
        throw new Error(`Worksheet "${name}" was not found.`);
    }
    return sheet;
}

function toolError(error: unknown): IWebMCPResult {
    return errorResult(error instanceof Error ? error.message : String(error));
}

const sheetProperty = {
    type: 'string',
    description: 'Worksheet name. Omit to use the active worksheet.',
};
const rangeProperty = {
    type: 'string',
    description: 'A1 range notation, for example A1:D10.',
};

function createReadMeTool(): IWebMCPTool {
    return {
        name: 'read_me',
        description: 'Explains how to use the Univer spreadsheet site tools. Call this before editing.',
        inputSchema: objectSchema({}, []),
        annotations: { readOnlyHint: true },
        execute: async () => textResult(SPREADSHEET_GUIDE),
    };
}

function createInspectWorkbookTool(univerAPI: FUniver): IWebMCPTool {
    return {
        name: 'inspect_workbook',
        description: 'Inspects workbook and worksheet structure before reading or editing cells.',
        inputSchema: objectSchema({
            sheet: sheetProperty,
            include: {
                type: 'array',
                items: { type: 'string', enum: ['dimensions', 'used_range', 'merges', 'gridlines'] },
            },
        }, []),
        annotations: { readOnlyHint: true },
        execute: async ({ sheet: sheetName, include }) => {
            try {
                const workbook = getWorkbook(univerAPI);
                const includes = Array.isArray(include) ? include : [];
                const sheets = nonEmptyString(sheetName)
                    ? [getSheet(univerAPI, sheetName)]
                    : workbook.getSheets();
                const summary = {
                    workbook: { id: workbook.getId(), name: workbook.getName() },
                    activeSheet: workbook.getActiveSheet().getSheetName(),
                    sheets: sheets.map((sheet) => ({
                        id: sheet.getSheetId(),
                        name: sheet.getSheetName(),
                        ...(includes.includes('dimensions') && {
                            rows: sheet.getMaxRows(),
                            columns: sheet.getMaxColumns(),
                        }),
                        ...(includes.includes('used_range') && {
                            usedRange: sheet.getDataRange().getA1Notation(),
                        }),
                        ...(includes.includes('merges') && {
                            merges: sheet.getMergedRanges().map((range) => range.getA1Notation()),
                        }),
                        ...(includes.includes('gridlines') && {
                            showGridlines: !sheet.hasHiddenGridLines(),
                        }),
                    })),
                };
                return textResult(JSON.stringify(summary), { structuredContent: summary });
            } catch (error) {
                return toolError(error);
            }
        },
    };
}

function createReadRangeTool(univerAPI: FUniver): IWebMCPTool {
    return {
        name: 'read_range',
        description: 'Reads values, formulas, styles, merges, and grid dimensions from an A1 range.',
        inputSchema: objectSchema({
            sheet: sheetProperty,
            range: rangeProperty,
            include: {
                type: 'array',
                items: { type: 'string', enum: ['values', 'formulas', 'styles', 'merges', 'row_heights', 'column_widths'] },
                default: ['values', 'formulas'],
            },
        }, ['range']),
        annotations: { readOnlyHint: true },
        execute: async ({ sheet: sheetName, range: rangeName, include }) => {
            if (!nonEmptyString(rangeName)) {
                return errorResult('range must be a non-empty A1 notation string.');
            }
            try {
                const sheet = getSheet(univerAPI, sheetName);
                const range = sheet.getRange(rangeName);
                const includes = Array.isArray(include) ? include : ['values', 'formulas'];
                const rangeRect = range.getRange();
                const intersects = (other: ReturnType<typeof range.getRange>) => !(
                    other.endRow < rangeRect.startRow
                    || other.startRow > rangeRect.endRow
                    || other.endColumn < rangeRect.startColumn
                    || other.startColumn > rangeRect.endColumn
                );
                const data = {
                    sheet: sheet.getSheetName(),
                    range: rangeName,
                    ...(includes.includes('values') && { values: range.getValues() }),
                    ...(includes.includes('formulas') && { formulas: range.getFormulas() }),
                    ...(includes.includes('styles') && {
                        styles: {
                            topLeft: {
                                background_color: range.getBackgrounds()[0]?.[0],
                                font_family: range.getFontFamily(),
                                font_size: range.getFontSize(),
                                horizontal_align: range.getHorizontalAlignments()[0]?.[0],
                                vertical_align: range.getVerticalAlignments()[0]?.[0],
                                wrap: range.getWraps()[0]?.[0],
                                raw: range.getCellStyleData(),
                            },
                            backgroundColors: range.getBackgrounds(),
                            horizontalAlignments: range.getHorizontalAlignments(),
                            verticalAlignments: range.getVerticalAlignments(),
                            wraps: range.getWraps(),
                        },
                    }),
                    ...(includes.includes('merges') && {
                        merges: sheet.getMergedRanges()
                            .filter((mergedRange) => intersects(mergedRange.getRange()))
                            .map((mergedRange) => mergedRange.getA1Notation()),
                    }),
                    ...(includes.includes('row_heights') && {
                        rowHeights: Array.from(
                            { length: rangeRect.endRow - rangeRect.startRow + 1 },
                            (_, index) => sheet.getRowHeight(rangeRect.startRow + index)
                        ),
                    }),
                    ...(includes.includes('column_widths') && {
                        columnWidths: Array.from(
                            { length: rangeRect.endColumn - rangeRect.startColumn + 1 },
                            (_, index) => sheet.getColumnWidth(rangeRect.startColumn + index)
                        ),
                    }),
                };
                return textResult(JSON.stringify(data), { structuredContent: data });
            } catch (error) {
                return toolError(error);
            }
        },
    };
}

function createWriteRangeTool(univerAPI: FUniver): IWebMCPTool {
    return {
        name: 'write_range',
        title: 'Write Spreadsheet Range',
        description: 'Writes a rectangular JSON matrix to an A1 range and selects the edited cells.',
        inputSchema: objectSchema({
            sheet: sheetProperty,
            range: rangeProperty,
            ranges_json: { type: 'string', description: 'JSON array of A1 ranges that receive the same formatting.' },
            values_json: {
                type: 'string',
                description: 'Rectangular JSON array, such as [["Item","Total"],["A",42]]. Formula strings begin with =.',
            },
        }, ['range', 'values_json']),
        annotations: { readOnlyHint: false },
        execute: async ({ sheet: sheetName, range: rangeName, values_json: valuesJson }) => {
            if (!nonEmptyString(rangeName)) return errorResult('range must be a non-empty A1 notation string.');
            const parsed = parseMatrix(valuesJson);
            if ('error' in parsed) return parsed.error;
            try {
                const sheet = getSheet(univerAPI, sheetName);
                const range = sheet.getRange(rangeName);
                if (parsed.matrix.length !== range.getHeight() || parsed.matrix[0].length !== range.getWidth()) {
                    return errorResult(
                        `values_json dimensions ${parsed.matrix.length}x${parsed.matrix[0].length} do not match range ${rangeName} dimensions ${range.getHeight()}x${range.getWidth()}.`
                    );
                }
                range.setValues(parsed.matrix);
                range.activate();
                const data = {
                    sheet: sheet.getSheetName(),
                    range: rangeName,
                    cellsWritten: parsed.matrix.length * parsed.matrix[0].length,
                };
                return textResult(`Wrote ${data.cellsWritten} cells to ${data.sheet}!${rangeName}.`, {
                    structuredContent: data,
                });
            } catch (error) {
                return toolError(error);
            }
        },
    };
}

function createFormatRangeTool(univerAPI: FUniver): IWebMCPTool {
    return {
        name: 'format_range',
        title: 'Format Spreadsheet Range',
        description: 'Applies cell presentation formatting to an A1 range and selects the formatted cells.',
        inputSchema: objectSchema({
            sheet: sheetProperty,
            range: rangeProperty,
            ranges_json: { type: 'string', description: 'JSON array of A1 ranges that receive the same formatting.' },
            background_color: { type: 'string', description: 'CSS color, preferably #RRGGBB.' },
            font_color: { type: 'string', description: 'CSS color, preferably #RRGGBB.' },
            font_weight: { type: 'string', enum: ['normal', 'bold'] },
            font_family: { type: 'string', description: 'Font family such as Arial.' },
            font_size: { type: 'number', exclusiveMinimum: 0, maximum: 200 },
            font_style: { type: 'string', enum: ['normal', 'italic'] },
            text_decoration: { type: 'string', enum: ['none', 'underline', 'line-through'] },
            horizontal_align: { type: 'string', enum: ['left', 'center', 'right', 'normal'] },
            vertical_align: { type: 'string', enum: ['top', 'middle', 'bottom'] },
            wrap: { type: 'boolean' },
            text_rotation: { type: 'number', minimum: -90, maximum: 90 },
            shrink_to_fit: { type: 'boolean' },
            borders: {
                type: 'object',
                properties: {
                    top: { type: 'string', enum: ['none', 'thin', 'medium', 'thick', 'dashed', 'dotted', 'double'] },
                    bottom: { type: 'string', enum: ['none', 'thin', 'medium', 'thick', 'dashed', 'dotted', 'double'] },
                    left: { type: 'string', enum: ['none', 'thin', 'medium', 'thick', 'dashed', 'dotted', 'double'] },
                    right: { type: 'string', enum: ['none', 'thin', 'medium', 'thick', 'dashed', 'dotted', 'double'] },
                    inner_horizontal: { type: 'string', enum: ['none', 'thin', 'medium', 'thick', 'dashed', 'dotted', 'double'] },
                    inner_vertical: { type: 'string', enum: ['none', 'thin', 'medium', 'thick', 'dashed', 'dotted', 'double'] },
                    all: { type: 'string', enum: ['none', 'thin', 'medium', 'thick', 'dashed', 'dotted', 'double'] },
                    color: { type: 'string' },
                },
                additionalProperties: false,
            },
            // Backward-compatible aliases for the first WebMCP prototype.
            horizontal_alignment: { type: 'string', enum: ['left', 'center', 'right'] },
            vertical_alignment: { type: 'string', enum: ['top', 'middle', 'bottom'] },
            wrap_text: { type: 'boolean' },
            border_style: { type: 'string', enum: ['thin', 'medium', 'thick', 'dashed', 'dotted'] },
            border_color: { type: 'string', description: 'CSS color for all borders, preferably #RRGGBB.' },
            row_height: { type: 'number', exclusiveMinimum: 0, maximum: 1000, description: 'Height in pixels for rows intersecting the range.' },
            column_width: { type: 'number', exclusiveMinimum: 0, maximum: 1000, description: 'Width in pixels for columns intersecting the range.' },
            number_format: { type: 'string', description: 'Number format such as $#,##0.00 or 0.0%.' },
        }, []),
        annotations: { readOnlyHint: false },
        execute: async (input) => {
            const { sheet: sheetName } = input;
            const parsedRanges = parseRangeNames(input.range, input.ranges_json);
            if ('error' in parsedRanges) return parsedRanges.error;
            const formatKeys = [
                'background_color',
                'font_color',
                'font_weight',
                'font_family',
                'font_size',
                'font_style',
                'text_decoration',
                'horizontal_align',
                'vertical_align',
                'wrap',
                'text_rotation',
                'shrink_to_fit',
                'borders',
                'horizontal_alignment',
                'vertical_alignment',
                'wrap_text',
                'border_style',
                'border_color',
                'row_height',
                'column_width',
                'number_format',
            ] as const;
            if (!formatKeys.some((key) => input[key] !== undefined)) {
                return errorResult('Provide at least one formatting option.');
            }
            try {
                const sheet = getSheet(univerAPI, sheetName);
                for (const rangeName of parsedRanges.ranges) {
                    const range = sheet.getRange(rangeName);
                    if (nonEmptyString(input.background_color)) range.setBackground(input.background_color);
                    if (nonEmptyString(input.font_color)) range.setFontColor(input.font_color);
                    if (input.font_weight === 'normal' || input.font_weight === 'bold') range.setFontWeight(input.font_weight);
                    if (nonEmptyString(input.font_family)) range.setFontFamily(input.font_family);
                    if (typeof input.font_size === 'number' && input.font_size > 0 && input.font_size <= 200) {
                        range.setFontSize(input.font_size);
                    }
                    if (input.font_style === 'normal' || input.font_style === 'italic') range.setFontStyle(input.font_style);
                    if (input.text_decoration === 'none' || input.text_decoration === 'underline' || input.text_decoration === 'line-through') {
                        range.setFontLine(input.text_decoration);
                    }
                    const horizontalAlign = input.horizontal_align ?? input.horizontal_alignment;
                    if (horizontalAlign === 'left' || horizontalAlign === 'center' || horizontalAlign === 'normal' || horizontalAlign === 'right') {
                        range.setHorizontalAlignment(horizontalAlign === 'right' ? 'normal' : horizontalAlign);
                    }
                    const verticalAlign = input.vertical_align ?? input.vertical_alignment;
                    if (verticalAlign === 'top' || verticalAlign === 'middle' || verticalAlign === 'bottom') {
                        range.setVerticalAlignment(verticalAlign);
                    }
                    const wrap = input.wrap ?? input.wrap_text;
                    if (typeof wrap === 'boolean') range.setWrap(wrap);
                    if (typeof input.text_rotation === 'number' && input.text_rotation >= -90 && input.text_rotation <= 90) {
                        range.setTextRotation(input.text_rotation);
                    }
                    if (typeof input.shrink_to_fit === 'boolean') range.setShrinkToFit(input.shrink_to_fit);
                    const borderStyleMap = {
                        none: univerAPI.Enum.BorderStyleTypes.NONE,
                        thin: univerAPI.Enum.BorderStyleTypes.THIN,
                        medium: univerAPI.Enum.BorderStyleTypes.MEDIUM,
                        thick: univerAPI.Enum.BorderStyleTypes.THICK,
                        dashed: univerAPI.Enum.BorderStyleTypes.DASHED,
                        dotted: univerAPI.Enum.BorderStyleTypes.DOTTED,
                        double: univerAPI.Enum.BorderStyleTypes.DOUBLE,
                    };
                    if (input.borders && typeof input.borders === 'object' && !Array.isArray(input.borders)) {
                        const borders = input.borders as Record<string, unknown>;
                        const borderTypeMap = {
                            top: univerAPI.Enum.BorderType.TOP,
                            bottom: univerAPI.Enum.BorderType.BOTTOM,
                            left: univerAPI.Enum.BorderType.LEFT,
                            right: univerAPI.Enum.BorderType.RIGHT,
                            inner_horizontal: univerAPI.Enum.BorderType.HORIZONTAL,
                            inner_vertical: univerAPI.Enum.BorderType.VERTICAL,
                            all: univerAPI.Enum.BorderType.ALL,
                        };
                        for (const [key, borderType] of Object.entries(borderTypeMap)) {
                            const styleName = borders[key];
                            if (typeof styleName === 'string' && styleName in borderStyleMap) {
                                range.setBorder(
                                    borderType,
                                    borderStyleMap[styleName as keyof typeof borderStyleMap],
                                    nonEmptyString(borders.color) ? borders.color : undefined
                                );
                            }
                        }
                    }
                    if (nonEmptyString(input.border_style) || nonEmptyString(input.border_color)) {
                        const borderStyleName = nonEmptyString(input.border_style) ? input.border_style : 'thin';
                        const borderStyle = borderStyleName in borderStyleMap
                            ? borderStyleMap[borderStyleName as keyof typeof borderStyleMap]
                            : borderStyleMap.thin;
                        range.setBorder(univerAPI.Enum.BorderType.ALL, borderStyle, nonEmptyString(input.border_color) ? input.border_color : undefined);
                    }
                    const { startRow, endRow, startColumn, endColumn } = range.getRange();
                    if (typeof input.row_height === 'number' && input.row_height > 0 && input.row_height <= 1000) {
                        sheet.setRowHeightsForced(startRow, endRow - startRow + 1, input.row_height);
                    }
                    if (typeof input.column_width === 'number' && input.column_width > 0 && input.column_width <= 1000) {
                        sheet.setColumnWidths(startColumn, endColumn - startColumn + 1, input.column_width);
                    }
                    if (nonEmptyString(input.number_format)) range.setNumberFormat(input.number_format);
                    range.activate();
                }
                const data = { sheet: sheet.getSheetName(), ranges: parsedRanges.ranges };
                return textResult(`Formatted ${parsedRanges.ranges.length} range(s) in ${data.sheet}.`, { structuredContent: data });
            } catch (error) {
                return toolError(error);
            }
        },
    };
}

function createMergeCellsTool(univerAPI: FUniver): IWebMCPTool {
    return {
        name: 'merge_cells',
        title: 'Merge Spreadsheet Cells',
        description: 'Merges an A1 range into one cell and selects the merged range.',
        inputSchema: objectSchema({ sheet: sheetProperty, range: rangeProperty }, ['range']),
        annotations: { readOnlyHint: false },
        execute: async ({ sheet: sheetName, range: rangeName }) => {
            if (!nonEmptyString(rangeName)) return errorResult('range must be a non-empty A1 notation string.');
            try {
                const sheet = getSheet(univerAPI, sheetName);
                const range = sheet.getRange(rangeName);
                range.merge();
                range.activate();
                const data = { sheet: sheet.getSheetName(), range: rangeName };
                return textResult(`Merged ${data.sheet}!${rangeName}.`, { structuredContent: data });
            } catch (error) {
                return toolError(error);
            }
        },
    };
}

function createModifyGridTool(univerAPI: FUniver): IWebMCPTool {
    return {
        name: 'modify_grid',
        title: 'Modify Spreadsheet Grid',
        description: 'Changes grid geometry: merge/unmerge cells or resize rows and columns.',
        inputSchema: objectSchema({
            sheet: sheetProperty,
            operation: {
                type: 'string',
                enum: ['merge', 'merge_across', 'merge_vertically', 'unmerge', 'set_row_height', 'set_column_width'],
            },
            range: rangeProperty,
            ranges_json: { type: 'string', description: 'JSON array of A1 ranges for a batched grid operation.' },
            size: { type: 'number', exclusiveMinimum: 0, maximum: 1000, description: 'Size in pixels for resize operations.' },
        }, ['operation']),
        annotations: { readOnlyHint: false },
        execute: async ({ sheet: sheetName, operation, range: rangeName, ranges_json: rangesJson, size }) => {
            const parsedRanges = parseRangeNames(rangeName, rangesJson);
            if ('error' in parsedRanges) return parsedRanges.error;
            try {
                const sheet = getSheet(univerAPI, sheetName);
                for (const targetRangeName of parsedRanges.ranges) {
                    const range = sheet.getRange(targetRangeName);
                    const { startRow, endRow, startColumn, endColumn } = range.getRange();
                    if (operation === 'merge') {
                        range.merge();
                    } else if (operation === 'merge_across') {
                        range.mergeAcross();
                    } else if (operation === 'merge_vertically') {
                        range.mergeVertically();
                    } else if (operation === 'unmerge') {
                        range.breakApart();
                    } else if (operation === 'set_row_height' && typeof size === 'number' && size > 0 && size <= 1000) {
                        sheet.setRowHeightsForced(startRow, endRow - startRow + 1, size);
                    } else if (operation === 'set_column_width' && typeof size === 'number' && size > 0 && size <= 1000) {
                        sheet.setColumnWidths(startColumn, endColumn - startColumn + 1, size);
                    } else {
                        return errorResult('Provide a supported operation and a positive size for resize operations.');
                    }
                    range.activate();
                }
                const data = { sheet: sheet.getSheetName(), ranges: parsedRanges.ranges, operation };
                return textResult(`Applied ${String(operation)} to ${parsedRanges.ranges.length} range(s) in ${data.sheet}.`, { structuredContent: data });
            } catch (error) {
                return toolError(error);
            }
        },
    };
}

function createManageSheetTool(univerAPI: FUniver): IWebMCPTool {
    return {
        name: 'manage_sheet',
        title: 'Manage Worksheet',
        description: 'Creates or activates a worksheet and controls sheet-level presentation settings.',
        inputSchema: objectSchema({
            operation: { type: 'string', enum: ['create', 'duplicate', 'rename', 'activate', 'set_gridlines'] },
            sheet: sheetProperty,
            name: { type: 'string', description: 'Worksheet name for create, duplicate, or rename.' },
            rows: { type: 'integer', minimum: 1, maximum: MAX_SHEET_ROWS, default: 100 },
            columns: { type: 'integer', minimum: 1, maximum: MAX_SHEET_COLUMNS, default: 26 },
            show_gridlines: { type: 'boolean' },
        }, ['operation']),
        annotations: { readOnlyHint: false },
        execute: async ({ operation, sheet: sheetName, name, rows = 100, columns = 26, show_gridlines: showGridlines }) => {
            try {
                if (operation === 'create') {
                    if (!nonEmptyString(name)) return errorResult('name must be a non-empty string for create.');
                    if (!Number.isInteger(rows) || Number(rows) < 1 || Number(rows) > MAX_SHEET_ROWS) {
                        return errorResult(`rows must be an integer between 1 and ${MAX_SHEET_ROWS}.`);
                    }
                    if (!Number.isInteger(columns) || Number(columns) < 1 || Number(columns) > MAX_SHEET_COLUMNS) {
                        return errorResult(`columns must be an integer between 1 and ${MAX_SHEET_COLUMNS}.`);
                    }
                    const created = getWorkbook(univerAPI).create(name.trim(), Number(rows), Number(columns));
                    created.activate();
                    const data = { operation, name: created.getSheetName(), rows: Number(rows), columns: Number(columns) };
                    return textResult(`Created worksheet "${data.name}".`, { structuredContent: data });
                }
                if (operation === 'duplicate') {
                    if (!nonEmptyString(name)) return errorResult('name must be a non-empty string for duplicate.');
                    const source = getSheet(univerAPI, sheetName);
                    const duplicated = getWorkbook(univerAPI).duplicateSheet(source).setName(name.trim());
                    duplicated.activate();
                    const data = { operation, sheet: source.getSheetName(), name: duplicated.getSheetName() };
                    return textResult(`Duplicated worksheet "${data.sheet}" as "${data.name}".`, { structuredContent: data });
                }
                const sheet = getSheet(univerAPI, sheetName);
                if (operation === 'rename' && nonEmptyString(name)) {
                    sheet.setName(name.trim());
                } else if (operation === 'activate') {
                    sheet.activate();
                } else if (operation === 'set_gridlines' && typeof showGridlines === 'boolean') {
                    sheet.setHiddenGridlines(!showGridlines);
                } else {
                    return errorResult('Provide a supported operation and its required options.');
                }
                const data = { operation, sheet: sheet.getSheetName() };
                return textResult(`Applied ${String(operation)} to worksheet "${data.sheet}".`, { structuredContent: data });
            } catch (error) {
                return toolError(error);
            }
        },
    };
}

function createSheetTool(univerAPI: FUniver): IWebMCPTool {
    return {
        name: 'create_sheet',
        title: 'Create Worksheet',
        description: 'Creates and activates a worksheet in the visible workbook.',
        inputSchema: objectSchema({
            name: { type: 'string' },
            rows: { type: 'integer', minimum: 1, maximum: MAX_SHEET_ROWS, default: 100 },
            columns: { type: 'integer', minimum: 1, maximum: MAX_SHEET_COLUMNS, default: 26 },
        }, ['name']),
        annotations: { readOnlyHint: false },
        execute: async ({ name, rows = 100, columns = 26 }) => {
            if (!nonEmptyString(name)) return errorResult('name must be a non-empty string.');
            if (!Number.isInteger(rows) || Number(rows) < 1 || Number(rows) > MAX_SHEET_ROWS) {
                return errorResult(`rows must be an integer between 1 and ${MAX_SHEET_ROWS}.`);
            }
            if (!Number.isInteger(columns) || Number(columns) < 1 || Number(columns) > MAX_SHEET_COLUMNS) {
                return errorResult(`columns must be an integer between 1 and ${MAX_SHEET_COLUMNS}.`);
            }
            try {
                const sheet = getWorkbook(univerAPI).create(name.trim(), Number(rows), Number(columns));
                sheet.activate();
                const data = { name: sheet.getSheetName(), rows: Number(rows), columns: Number(columns) };
                return textResult(`Created worksheet "${data.name}".`, { structuredContent: data });
            } catch (error) {
                return toolError(error);
            }
        },
    };
}

function createSpreadsheetTools(univerAPI: FUniver): IWebMCPTool[] {
    return [
        createReadMeTool(),
        createInspectWorkbookTool(univerAPI),
        createReadRangeTool(univerAPI),
        createWriteRangeTool(univerAPI),
        createFormatRangeTool(univerAPI),
        createMergeCellsTool(univerAPI),
        createModifyGridTool(univerAPI),
        createManageSheetTool(univerAPI),
        createSheetTool(univerAPI),
    ];
}

export function registerUniverWebMCP({ ownerDocument, univerAPI }: IRegisterUniverWebMCPOptions): () => void {
    const modelContext = (ownerDocument as WebMCPDocument).modelContext;
    const ownerWindow = ownerDocument.defaultView;
    if (!modelContext || !ownerWindow) return () => {};

    const controller = new ownerWindow.AbortController();
    const tools = createSpreadsheetTools(univerAPI);

    for (const tool of tools) {
        try {
            void Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch((error) => {
                ownerWindow.console.error(`Failed to register WebMCP tool "${tool.name}"`, error);
            });
        } catch (error) {
            ownerWindow.console.error(`Failed to register WebMCP tool "${tool.name}"`, error);
        }
    }

    return () => controller.abort();
}
