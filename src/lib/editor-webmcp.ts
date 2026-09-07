import { normalizeDiagramScene, type DiagramScene, type ExcalidrawElement } from './diagram-operations';
import { normalizePresentationSnapshot, type PresentationSnapshot, type UniverSlide } from './presentation-operations';

interface EditorWebMCPTextContent {
  type: 'text';
  text: string;
}

export interface EditorWebMCPResult {
  content: EditorWebMCPTextContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface EditorWebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<EditorWebMCPResult> | EditorWebMCPResult;
}

interface EditorModelContext {
  registerTool: (tool: EditorWebMCPTool, options?: { signal?: AbortSignal }) => Promise<void> | void;
}

type EditorWebMCPDocument = Document & { modelContext?: EditorModelContext };

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const result = (message: string, structuredContent?: Record<string, unknown>): EditorWebMCPResult => ({
  content: [{ type: 'text', text: message }],
  ...(structuredContent ? { structuredContent } : {}),
});

function toolError(error: unknown): EditorWebMCPResult {
  return { ...result(error instanceof Error ? error.message : String(error)), isError: true };
}

function registerTools(ownerDocument: EditorWebMCPDocument, tools: EditorWebMCPTool[]): () => void {
  const controller = new AbortController();
  const modelContext = ownerDocument.modelContext;
  if (!modelContext) return () => controller.abort();
  const ownerConsole = ownerDocument.defaultView?.console ?? console;
  for (const tool of tools) {
    try {
      void Promise.resolve(modelContext.registerTool(tool, { signal: controller.signal })).catch(error => {
        ownerConsole.error(`Failed to register WebMCP tool "${tool.name}"`, error);
      });
    } catch (error) {
      ownerConsole.error(`Failed to register WebMCP tool "${tool.name}"`, error);
    }
  }
  return () => controller.abort();
}

interface RegisterPaperWebMCPOptions {
  ownerDocument: EditorWebMCPDocument;
  id: string;
  name: string;
  canEdit?: boolean;
  getText: () => string;
  writeText: (text: string) => void | Promise<void>;
}

export function registerPaperWebMCP({ ownerDocument, id, name, canEdit = true, getText, writeText }: RegisterPaperWebMCPOptions): () => void {
  const tools: EditorWebMCPTool[] = [
    {
      name: 'read_me',
      description: 'Describe the WebMCP tools available for the open Flockdoc Paper.',
      inputSchema: objectSchema({}),
      execute: () => result('Use inspect_document for metadata, read_document for the current text, and write_document to replace or append text when editing is allowed.'),
    },
    {
      name: 'inspect_document',
      description: 'Inspect the open Flockdoc Paper and report its identity and text length.',
      inputSchema: objectSchema({}),
      execute: () => {
        const text = getText();
        return result(`${name}: ${text.length} characters.`, { id, name, characterCount: text.length, canEdit });
      },
    },
    {
      name: 'read_document',
      description: 'Read all plain text from the open Flockdoc Paper.',
      inputSchema: objectSchema({}),
      execute: () => {
        const text = getText();
        return result(text || '(empty document)', { text });
      },
    },
  ];

  if (canEdit) tools.push({
    name: 'write_document',
    description: 'Replace all text in the open Flockdoc Paper or append text to its end. The edit is saved and shared with collaborators.',
    inputSchema: objectSchema({
      text: { type: 'string', description: 'The text to write.' },
      mode: { type: 'string', enum: ['replace', 'append'], description: 'Replace the document or append to it.' },
    }, ['text', 'mode']),
    execute: async input => {
      try {
        if (typeof input.text !== 'string') throw new Error('text must be a string.');
        if (input.mode !== 'replace' && input.mode !== 'append') throw new Error('mode must be replace or append.');
        const text = input.mode === 'append' ? `${getText()}${input.text}` : input.text;
        await writeText(text);
        return result(`Wrote ${text.length} characters to ${name}.`, { id, name, text, mode: input.mode });
      } catch (error) {
        return toolError(error);
      }
    },
  });

  return registerTools(ownerDocument, tools);
}

interface RegisterDiagramWebMCPOptions {
  ownerDocument: EditorWebMCPDocument;
  id: string;
  name: string;
  canEdit?: boolean;
  getScene: () => DiagramScene;
  writeScene: (scene: DiagramScene) => void | Promise<void>;
}

export function registerDiagramWebMCP({ ownerDocument, id, name, canEdit = true, getScene, writeScene }: RegisterDiagramWebMCPOptions): () => void {
  const tools: EditorWebMCPTool[] = [
    {
      name: 'read_me',
      description: 'Describe the WebMCP tools available for the open Flockdoc Diagram.',
      inputSchema: objectSchema({}),
      execute: () => result('Use inspect_diagram for metadata, read_diagram for the Excalidraw scene, and the element mutation tools when editing is allowed.'),
    },
    {
      name: 'inspect_diagram',
      description: 'Inspect the open Flockdoc Diagram and report its identity and element count.',
      inputSchema: objectSchema({}),
      execute: () => {
        const scene = getScene();
        return result(`${name}: ${scene.elements.length} elements.`, { id, name, elementCount: scene.elements.length, canEdit });
      },
    },
    {
      name: 'read_diagram',
      description: 'Read the complete Excalidraw element scene from the open Flockdoc Diagram.',
      inputSchema: objectSchema({}),
      execute: () => {
        const scene = normalizeDiagramScene(getScene());
        return result(JSON.stringify(scene), { scene });
      },
    },
  ];

  if (canEdit) tools.push(
    {
      name: 'upsert_diagram_elements',
      description: 'Add or replace Excalidraw elements by id in the open Flockdoc Diagram. Provide complete Excalidraw element objects. The edit is saved and shared with collaborators.',
      inputSchema: objectSchema({ elements: { type: 'array', items: { type: 'object' } } }, ['elements']),
      execute: async input => {
        try {
          if (!Array.isArray(input.elements)) throw new Error('elements must be an array.');
          const incoming = normalizeDiagramScene({ elements: input.elements }).elements;
          const incomingIds = new Set(incoming.map(element => element.id));
          const current = normalizeDiagramScene(getScene()).elements.filter(element => !incomingIds.has(element.id));
          const scene = normalizeDiagramScene({ elements: [...current, ...incoming] });
          await writeScene(scene);
          return result(`Upserted ${incoming.length} elements in ${name}.`, { scene });
        } catch (error) {
          return toolError(error);
        }
      },
    },
    {
      name: 'delete_diagram_elements',
      description: 'Delete Excalidraw elements by id from the open Flockdoc Diagram. The edit is saved and shared with collaborators.',
      inputSchema: objectSchema({ ids: { type: 'array', items: { type: 'string' } } }, ['ids']),
      execute: async input => {
        try {
          if (!Array.isArray(input.ids) || input.ids.some(value => typeof value !== 'string')) throw new Error('ids must be an array of strings.');
          const ids = new Set(input.ids as string[]);
          const current = normalizeDiagramScene(getScene());
          const scene = normalizeDiagramScene({ elements: current.elements.filter((element: ExcalidrawElement) => !ids.has(element.id)) });
          await writeScene(scene);
          return result(`Deleted ${current.elements.length - scene.elements.length} elements from ${name}.`, { scene });
        } catch (error) {
          return toolError(error);
        }
      },
    },
  );

  return registerTools(ownerDocument, tools);
}

interface RegisterPresentationWebMCPOptions {
  ownerDocument: EditorWebMCPDocument;
  id: string;
  name: string;
  canEdit?: boolean;
  getSnapshot: () => unknown;
  writeSnapshot: (snapshot: PresentationSnapshot) => void | Promise<void>;
}

function presentationId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function presentationNumber(value: unknown, fallback: number, label: string, positive = false): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 10_000 || (positive && value <= 0)) {
    throw new Error(`${label} must be a ${positive ? 'positive ' : ''}finite number within the supported slide bounds.`);
  }
  return value;
}

function presentationColor(value: unknown, fallback: string, label: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !value.trim() || value.length > 100) throw new Error(`${label} must be a non-empty CSS color string.`);
  return value;
}

function presentationUrl(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('url must be a non-empty string.');
  if (value.startsWith('data:image/')) {
    if (value.length > 6 * 1024 * 1024) throw new Error('data:image URLs must be smaller than 6 MB.');
    return value;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    return url.toString();
  } catch {
    throw new Error('url must use http, https, or a data:image URL.');
  }
}

function presentationSlide(snapshot: PresentationSnapshot, slideId: unknown): UniverSlide {
  if (typeof slideId !== 'string' || !slideId) throw new Error('slideId is required.');
  const slide = snapshot.body.pages[slideId];
  if (!slide) throw new Error(`Slide "${slideId}" was not found.`);
  return slide;
}

function nextElementZIndex(slide: UniverSlide): number {
  return Math.max(20, ...Object.values(slide.pageElements).map(element => {
    const zIndex = element && typeof element === 'object' ? Number((element as Record<string, unknown>).zIndex) : 0;
    return Number.isFinite(zIndex) ? zIndex : 0;
  })) + 1;
}

const geometrySchema = {
  x: { type: 'number', description: 'Horizontal position in slide units.' },
  y: { type: 'number', description: 'Vertical position in slide units.' },
  width: { type: 'number', description: 'Positive width in slide units.' },
  height: { type: 'number', description: 'Positive height in slide units.' },
};

export function registerPresentationWebMCP({ ownerDocument, id, name, canEdit = true, getSnapshot, writeSnapshot }: RegisterPresentationWebMCPOptions): () => void {
  const current = () => normalizePresentationSnapshot(getSnapshot(), id, name);
  const tools: EditorWebMCPTool[] = [
    {
      name: 'read_me',
      description: 'Describe the WebMCP tools available for the open Flockdoc Presentation.',
      inputSchema: objectSchema({}),
      execute: () => result('Use create_slide, add_slide_text, add_slide_shape, and add_slide_image to author content. Use update_slide_element or delete_slide_elements to revise it. Low-level deck and slide replacement tools are also available when needed.'),
    },
    {
      name: 'inspect_presentation',
      description: 'Inspect the open Flockdoc Presentation and report its identity and slide count.',
      inputSchema: objectSchema({}),
      execute: () => {
        const snapshot = current();
        return result(`${name}: ${snapshot.body.pageOrder.length} slides.`, { id, name, slideCount: snapshot.body.pageOrder.length, canEdit });
      },
    },
    {
      name: 'read_presentation',
      description: 'Read the complete Univer snapshot for the open Flockdoc Presentation.',
      inputSchema: objectSchema({}),
      execute: () => { const snapshot = current(); return result(JSON.stringify(snapshot), { snapshot }); },
    },
  ];

  if (canEdit) tools.push(
    {
      name: 'replace_presentation',
      description: 'Replace the complete Univer snapshot for the open Flockdoc Presentation. The edit is saved and shared with collaborators.',
      inputSchema: objectSchema({ snapshot: { type: 'object' } }, ['snapshot']),
      execute: async input => {
        try {
          const snapshot = normalizePresentationSnapshot(input.snapshot, id, name);
          await writeSnapshot(snapshot);
          return result(`Replaced ${name} with ${snapshot.body.pageOrder.length} slides.`, { snapshot });
        } catch (error) { return toolError(error); }
      },
    },
    {
      name: 'create_slide',
      description: 'Create a blank slide without constructing a Univer slide object. Returns the generated slide ID. The edit is saved and shared with collaborators.',
      inputSchema: objectSchema({
        title: { type: 'string', description: 'Optional internal slide title.' },
        position: { type: 'integer', minimum: 0, description: 'Optional zero-based insertion position.' },
        background: { type: 'string', description: 'Optional CSS background color.' },
      }),
      execute: async input => {
        try {
          const snapshot = current();
          if (input.title !== undefined && typeof input.title !== 'string') throw new Error('title must be a string.');
          if (input.position !== undefined && typeof input.position !== 'number') throw new Error('position must be a valid zero-based insertion position.');
          const position = input.position === undefined ? snapshot.body.pageOrder.length : input.position;
          if (!Number.isSafeInteger(position) || position < 0 || position > snapshot.body.pageOrder.length) throw new Error('position must be a valid zero-based insertion position.');
          const slideId = presentationId('slide');
          snapshot.body.pages[slideId] = {
            id: slideId, pageType: 0, zIndex: 10, title: typeof input.title === 'string' ? input.title : slideId,
            description: '', pageBackgroundFill: { rgb: presentationColor(input.background, 'rgb(255,255,255)', 'background') }, pageElements: {},
          };
          snapshot.body.pageOrder.splice(position, 0, slideId);
          await writeSnapshot(snapshot);
          return result(`Created slide ${slideId} in ${name}.`, { slideId, snapshot });
        } catch (error) { return toolError(error); }
      },
    },
    {
      name: 'upsert_slides',
      description: 'Add or replace complete Univer slide objects by id. The edit is saved and shared with collaborators.',
      inputSchema: objectSchema({ slides: { type: 'array', items: { type: 'object' } } }, ['slides']),
      execute: async input => {
        try {
          if (!Array.isArray(input.slides)) throw new Error('slides must be an array.');
          const slides = input.slides as UniverSlide[];
          if (slides.some(slide => !slide || typeof slide !== 'object' || typeof slide.id !== 'string' || !slide.id)) throw new Error('Each slide requires an id.');
          const snapshot = current();
          for (const slide of slides) {
            snapshot.body.pages[slide.id] = { ...structuredClone(slide), pageElements: slide.pageElements && typeof slide.pageElements === 'object' ? structuredClone(slide.pageElements) : {} };
            if (!snapshot.body.pageOrder.includes(slide.id)) snapshot.body.pageOrder.push(slide.id);
          }
          await writeSnapshot(snapshot);
          return result(`Upserted ${slides.length} slides in ${name}.`, { snapshot });
        } catch (error) { return toolError(error); }
      },
    },
    {
      name: 'delete_slides',
      description: 'Delete slides by id from the open Flockdoc Presentation. The edit is saved and shared with collaborators.',
      inputSchema: objectSchema({ ids: { type: 'array', items: { type: 'string' } } }, ['ids']),
      execute: async input => {
        try {
          if (!Array.isArray(input.ids) || input.ids.some(value => typeof value !== 'string')) throw new Error('ids must be an array of strings.');
          const snapshot = current();
          const previousCount = snapshot.body.pageOrder.length;
          const ids = new Set(input.ids as string[]);
          for (const slideId of ids) delete snapshot.body.pages[slideId];
          snapshot.body.pageOrder = snapshot.body.pageOrder.filter(slideId => !ids.has(slideId));
          const normalized = normalizePresentationSnapshot(snapshot, id, name);
          await writeSnapshot(normalized);
          return result(`Deleted ${previousCount - snapshot.body.pageOrder.length} slides from ${name}.`, { snapshot: normalized });
        } catch (error) { return toolError(error); }
      },
    },
    {
      name: 'add_slide_text',
      description: 'Add a positioned, formatted text box to a slide. Returns the generated element ID. The edit is saved and shared with collaborators.',
      inputSchema: objectSchema({
        slideId: { type: 'string' }, text: { type: 'string' }, ...geometrySchema,
        fontSize: { type: 'number', description: 'Font size in points.' }, color: { type: 'string', description: 'CSS text color.' },
        bold: { type: 'boolean' }, italic: { type: 'boolean' }, title: { type: 'string', description: 'Accessible element title.' },
      }, ['slideId', 'text']),
      execute: async input => {
        try {
          if (typeof input.text !== 'string' || !input.text) throw new Error('text must be a non-empty string.');
          if (input.title !== undefined && typeof input.title !== 'string') throw new Error('title must be a string.');
          if (input.bold !== undefined && typeof input.bold !== 'boolean') throw new Error('bold must be a boolean.');
          if (input.italic !== undefined && typeof input.italic !== 'boolean') throw new Error('italic must be a boolean.');
          const snapshot = current();
          const slide = presentationSlide(snapshot, input.slideId);
          const elementId = presentationId('text');
          slide.pageElements[elementId] = {
            id: elementId, zIndex: nextElementZIndex(slide), left: presentationNumber(input.x, 80, 'x'), top: presentationNumber(input.y, 60, 'y'),
            width: presentationNumber(input.width, 640, 'width', true), height: presentationNumber(input.height, 80, 'height', true),
            title: typeof input.title === 'string' ? input.title : 'Text', description: '', type: 2,
            richText: { text: input.text, fs: presentationNumber(input.fontSize, 30, 'fontSize', true), cl: { rgb: presentationColor(input.color, 'rgb(51,51,51)', 'color') }, bl: input.bold ? 1 : 0, it: input.italic ? 1 : 0 },
          };
          await writeSnapshot(snapshot);
          return result(`Added text ${elementId} to slide ${slide.id}.`, { slideId: slide.id, elementId, snapshot });
        } catch (error) { return toolError(error); }
      },
    },
    {
      name: 'add_slide_shape',
      description: 'Add a rectangle, rounded rectangle, or ellipse to a slide. Returns the generated element ID. The edit is saved and shared with collaborators.',
      inputSchema: objectSchema({
        slideId: { type: 'string' }, shape: { type: 'string', enum: ['rect', 'roundRect', 'ellipse'] }, ...geometrySchema,
        fill: { type: 'string', description: 'CSS fill color.' }, stroke: { type: 'string', description: 'CSS outline color.' },
        strokeWidth: { type: 'number' }, radius: { type: 'number', description: 'Corner radius for rounded rectangles.' }, title: { type: 'string' },
      }, ['slideId', 'shape']),
      execute: async input => {
        try {
          if (input.shape !== 'rect' && input.shape !== 'roundRect' && input.shape !== 'ellipse') throw new Error('shape must be rect, roundRect, or ellipse.');
          if (input.title !== undefined && typeof input.title !== 'string') throw new Error('title must be a string.');
          const snapshot = current();
          const slide = presentationSlide(snapshot, input.slideId);
          const elementId = presentationId('shape');
          const width = presentationNumber(input.width, 240, 'width', true);
          const height = presentationNumber(input.height, 160, 'height', true);
          slide.pageElements[elementId] = {
            id: elementId, zIndex: nextElementZIndex(slide), left: presentationNumber(input.x, 100, 'x'), top: presentationNumber(input.y, 160, 'y'), width, height,
            title: typeof input.title === 'string' ? input.title : 'Shape', description: '', type: 0,
            shape: { shapeType: input.shape, text: '', shapeProperties: {
              shapeBackgroundFill: { rgb: presentationColor(input.fill, '#dcecff', 'fill') },
              outline: { outlineFill: { rgb: presentationColor(input.stroke, '#24527a', 'stroke') }, weight: presentationNumber(input.strokeWidth, 1, 'strokeWidth', true) },
              ...(input.shape === 'ellipse' ? { radius: Math.min(width, height) / 2 } : input.shape === 'roundRect' ? { radius: presentationNumber(input.radius, 18, 'radius', true) } : {}),
            } },
          };
          await writeSnapshot(snapshot);
          return result(`Added ${input.shape} ${elementId} to slide ${slide.id}.`, { slideId: slide.id, elementId, snapshot });
        } catch (error) { return toolError(error); }
      },
    },
    {
      name: 'add_slide_image',
      description: 'Add an http, https, or data-image to a slide with explicit bounds and alternative text. Returns the generated element ID. The edit is saved and shared with collaborators.',
      inputSchema: objectSchema({ slideId: { type: 'string' }, url: { type: 'string' }, alt: { type: 'string' }, ...geometrySchema }, ['slideId', 'url']),
      execute: async input => {
        try {
          if (input.alt !== undefined && typeof input.alt !== 'string') throw new Error('alt must be a string.');
          const snapshot = current();
          const slide = presentationSlide(snapshot, input.slideId);
          const elementId = presentationId('image');
          const url = presentationUrl(input.url);
          slide.pageElements[elementId] = {
            id: elementId, zIndex: nextElementZIndex(slide), left: presentationNumber(input.x, 120, 'x'), top: presentationNumber(input.y, 120, 'y'),
            width: presentationNumber(input.width, 400, 'width', true), height: presentationNumber(input.height, 260, 'height', true),
            title: typeof input.alt === 'string' ? input.alt : 'Image', description: typeof input.alt === 'string' ? input.alt : '', type: 1,
            image: { imageProperties: { contentUrl: url, sourceUrl: url } },
          };
          await writeSnapshot(snapshot);
          return result(`Added image ${elementId} to slide ${slide.id}.`, { slideId: slide.id, elementId, snapshot });
        } catch (error) { return toolError(error); }
      },
    },
    {
      name: 'update_slide_element',
      description: 'Update common geometry or content properties of an existing slide element. The edit is saved and shared with collaborators.',
      inputSchema: objectSchema({
        slideId: { type: 'string' }, elementId: { type: 'string' }, ...geometrySchema, text: { type: 'string' },
        fontSize: { type: 'number' }, color: { type: 'string' }, bold: { type: 'boolean' }, italic: { type: 'boolean' },
        fill: { type: 'string' }, stroke: { type: 'string' }, strokeWidth: { type: 'number' }, url: { type: 'string' }, alt: { type: 'string' },
      }, ['slideId', 'elementId']),
      execute: async input => {
        try {
          const snapshot = current();
          const slide = presentationSlide(snapshot, input.slideId);
          if (typeof input.elementId !== 'string' || !slide.pageElements[input.elementId]) throw new Error(`Element "${String(input.elementId)}" was not found.`);
          const element = slide.pageElements[input.elementId] as Record<string, unknown>;
          for (const [inputKey, elementKey, positive] of [['x', 'left', false], ['y', 'top', false], ['width', 'width', true], ['height', 'height', true]] as const) {
            if (input[inputKey] !== undefined) element[elementKey] = presentationNumber(input[inputKey], Number(element[elementKey]), inputKey, positive);
          }
          if (input.text !== undefined || input.fontSize !== undefined || input.color !== undefined || input.bold !== undefined || input.italic !== undefined) {
            if (element.type !== 2) throw new Error('Text properties can only update a text element.');
            const richText = element.richText && typeof element.richText === 'object' ? element.richText as Record<string, unknown> : {};
            element.richText = richText;
            if (input.text !== undefined) { if (typeof input.text !== 'string') throw new Error('text must be a string.'); richText.text = input.text; }
            if (input.fontSize !== undefined) richText.fs = presentationNumber(input.fontSize, Number(richText.fs), 'fontSize', true);
            if (input.color !== undefined) richText.cl = { rgb: presentationColor(input.color, 'rgb(51,51,51)', 'color') };
            if (input.bold !== undefined) { if (typeof input.bold !== 'boolean') throw new Error('bold must be a boolean.'); richText.bl = input.bold ? 1 : 0; }
            if (input.italic !== undefined) { if (typeof input.italic !== 'boolean') throw new Error('italic must be a boolean.'); richText.it = input.italic ? 1 : 0; }
          }
          if (input.fill !== undefined || input.stroke !== undefined || input.strokeWidth !== undefined) {
            if (element.type !== 0) throw new Error('Shape properties can only update a shape element.');
            const shape = element.shape && typeof element.shape === 'object' ? element.shape as Record<string, unknown> : {};
            const properties = shape.shapeProperties && typeof shape.shapeProperties === 'object' ? shape.shapeProperties as Record<string, unknown> : {};
            element.shape = shape;
            shape.shapeProperties = properties;
            if (input.fill !== undefined) properties.shapeBackgroundFill = { rgb: presentationColor(input.fill, '#dcecff', 'fill') };
            const outline = properties.outline && typeof properties.outline === 'object' ? properties.outline as Record<string, unknown> : {};
            if (input.stroke !== undefined) outline.outlineFill = { rgb: presentationColor(input.stroke, '#24527a', 'stroke') };
            if (input.strokeWidth !== undefined) outline.weight = presentationNumber(input.strokeWidth, Number(outline.weight), 'strokeWidth', true);
            properties.outline = outline;
          }
          if (input.url !== undefined || input.alt !== undefined) {
            if (element.type !== 1) throw new Error('Image properties can only update an image element.');
            if (input.url !== undefined) { const url = presentationUrl(input.url); element.image = { imageProperties: { contentUrl: url, sourceUrl: url } }; }
            if (input.alt !== undefined) { if (typeof input.alt !== 'string') throw new Error('alt must be a string.'); element.title = input.alt; element.description = input.alt; }
          }
          await writeSnapshot(snapshot);
          return result(`Updated element ${input.elementId} on slide ${slide.id}.`, { slideId: slide.id, elementId: input.elementId, snapshot });
        } catch (error) { return toolError(error); }
      },
    },
    {
      name: 'delete_slide_elements',
      description: 'Delete one or more content elements by ID from a slide. The edit is saved and shared with collaborators.',
      inputSchema: objectSchema({ slideId: { type: 'string' }, ids: { type: 'array', items: { type: 'string' } } }, ['slideId', 'ids']),
      execute: async input => {
        try {
          if (!Array.isArray(input.ids) || input.ids.some(value => typeof value !== 'string')) throw new Error('ids must be an array of strings.');
          const snapshot = current();
          const slide = presentationSlide(snapshot, input.slideId);
          let deleted = 0;
          for (const elementId of input.ids as string[]) if (Object.hasOwn(slide.pageElements, elementId)) { delete slide.pageElements[elementId]; deleted += 1; }
          await writeSnapshot(snapshot);
          return result(`Deleted ${deleted} elements from slide ${slide.id}.`, { slideId: slide.id, deleted, snapshot });
        } catch (error) { return toolError(error); }
      },
    },
  );
  return registerTools(ownerDocument, tools);
}
