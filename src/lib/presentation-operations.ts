export type UniverSlide = Record<string, unknown> & { id: string; pageElements: Record<string, unknown> };

export type PresentationSnapshot = {
  id: string;
  title: string;
  pageSize: { width: number; height: number };
  body: { pages: Record<string, UniverSlide>; pageOrder: string[] };
};

export type PresentationOperation = {
  protocolVersion: 1;
  kind: 'presentation.univer.update';
  snapshot: PresentationSnapshot;
};

function blankSlide(id: string): UniverSlide {
  return {
    id,
    pageType: 0,
    zIndex: 10,
    title: id,
    description: '',
    pageBackgroundFill: { rgb: 'rgb(255,255,255)' },
    pageElements: {},
  };
}

export function normalizePresentationSnapshot(value: unknown, fallbackId = 'presentation', fallbackTitle = 'Untitled Presentation'): PresentationSnapshot {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<PresentationSnapshot> : {};
  const id = typeof candidate.id === 'string' && candidate.id ? candidate.id : fallbackId;
  const title = typeof candidate.title === 'string' && candidate.title ? candidate.title : fallbackTitle;
  const width = Number(candidate.pageSize?.width);
  const height = Number(candidate.pageSize?.height);
  const rawPages = candidate.body?.pages;
  const pages: Record<string, UniverSlide> = {};
  if (rawPages && typeof rawPages === 'object' && !Array.isArray(rawPages)) {
    for (const [key, rawSlide] of Object.entries(rawPages)) {
      if (!rawSlide || typeof rawSlide !== 'object' || Array.isArray(rawSlide)) continue;
      const slide = rawSlide as Partial<UniverSlide>;
      const slideId = typeof slide.id === 'string' && slide.id ? slide.id : key;
      pages[slideId] = { ...structuredClone(slide), id: slideId, pageElements: slide.pageElements && typeof slide.pageElements === 'object' && !Array.isArray(slide.pageElements) ? structuredClone(slide.pageElements) : {} };
    }
  }
  const requestedOrder = Array.isArray(candidate.body?.pageOrder) ? candidate.body.pageOrder : [];
  const pageOrder = requestedOrder.filter((pageId): pageId is string => typeof pageId === 'string' && Object.hasOwn(pages, pageId));
  for (const pageId of Object.keys(pages)) if (!pageOrder.includes(pageId)) pageOrder.push(pageId);
  if (!pageOrder.length) {
    const slideId = `${id}-slide-1`;
    pages[slideId] = blankSlide(slideId);
    pageOrder.push(slideId);
  }
  return {
    id,
    title,
    pageSize: { width: Number.isFinite(width) && width > 0 ? width : 960, height: Number.isFinite(height) && height > 0 ? height : 540 },
    body: { pages, pageOrder },
  };
}

export function presentationOperation(snapshot: unknown): PresentationOperation {
  return { protocolVersion: 1, kind: 'presentation.univer.update', snapshot: normalizePresentationSnapshot(snapshot) };
}

export function encodePresentationOperation(operation: PresentationOperation): string {
  const bytes = new TextEncoder().encode(JSON.stringify(operation));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodePresentationOperation(updateBase64: string): PresentationOperation | null {
  try {
    const binary = atob(updateBase64);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<PresentationOperation>;
    if (parsed.protocolVersion !== 1 || parsed.kind !== 'presentation.univer.update') return null;
    return presentationOperation(parsed.snapshot);
  } catch {
    return null;
  }
}
