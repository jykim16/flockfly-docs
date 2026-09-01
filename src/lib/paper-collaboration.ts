import * as Y from 'yjs';

export type PaperYjsOperation = {
  protocolVersion: 1;
  kind: 'paper.yjs.update';
  updateBase64: string;
};

export type PaperTextPatch = { index: number; deleteCount: number; insert: string };

type PaperCheckpoint = {
  flockdocCollaboration: { protocolVersion: 1; kind: 'paper.yjs.snapshot'; stateBase64: string };
  univer: Record<string, unknown>;
};

const LOCAL_ORIGIN = Symbol('paper-local');
const BOOTSTRAP_ORIGIN = Symbol('paper-bootstrap');

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function cloneRecord(value: unknown, fallback: Record<string, unknown>): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return structuredClone(fallback);
  return structuredClone(value as Record<string, unknown>);
}

function bodyText(snapshot: Record<string, unknown>): string {
  const body = snapshot.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return '\r\n';
  return typeof (body as Record<string, unknown>).dataStream === 'string'
    ? (body as Record<string, unknown>).dataStream as string
    : '\r\n';
}

function withBodyText(snapshot: Record<string, unknown>, text: string): Record<string, unknown> {
  const next = structuredClone(snapshot);
  const body = next.body && typeof next.body === 'object' && !Array.isArray(next.body)
    ? next.body as Record<string, unknown>
    : {};
  next.body = { ...body, dataStream: text };
  return next;
}

function stableClientId(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

function diffText(before: string, after: string): PaperTextPatch | null {
  if (before === after) return null;
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix
    && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
  return {
    index: prefix,
    deleteCount: before.length - prefix - suffix,
    insert: after.slice(prefix, after.length - suffix),
  };
}

function isCheckpoint(value: unknown): value is PaperCheckpoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const collaboration = record.flockdocCollaboration;
  return !!collaboration && typeof collaboration === 'object' && !Array.isArray(collaboration)
    && (collaboration as Record<string, unknown>).protocolVersion === 1
    && (collaboration as Record<string, unknown>).kind === 'paper.yjs.snapshot'
    && typeof (collaboration as Record<string, unknown>).stateBase64 === 'string'
    && !!record.univer && typeof record.univer === 'object' && !Array.isArray(record.univer);
}

export function encodePaperOperation(operation: PaperYjsOperation): string {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(operation)));
}

export function decodePaperOperation(value: string): PaperYjsOperation | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(base64ToBytes(value))) as Record<string, unknown>;
    if (parsed.protocolVersion !== 1 || parsed.kind !== 'paper.yjs.update' || typeof parsed.updateBase64 !== 'string' || !parsed.updateBase64) return null;
    base64ToBytes(parsed.updateBase64);
    return { protocolVersion: 1, kind: 'paper.yjs.update', updateBase64: parsed.updateBase64 };
  } catch {
    return null;
  }
}

export class PaperCollaborationDocument {
  private document = new Y.Doc();
  private textType = this.document.getText('body');
  private metadata = this.document.getMap<string>('metadata');

  constructor(private readonly id: string, source: unknown) {
    this.reset(source);
  }

  get text(): string { return this.textType.toString(); }

  reset(source: unknown): void {
    this.document.destroy();
    this.document = new Y.Doc();
    this.textType = this.document.getText('body');
    this.metadata = this.document.getMap<string>('metadata');
    if (isCheckpoint(source)) {
      Y.applyUpdate(this.document, base64ToBytes(source.flockdocCollaboration.stateBase64), BOOTSTRAP_ORIGIN);
      return;
    }
    const fallback = { id: this.id, body: { dataStream: '\r\n' } };
    const univer = cloneRecord(source, fallback);
    const bootstrap = new Y.Doc();
    bootstrap.clientID = stableClientId(`flockdoc-paper:${this.id}`);
    bootstrap.getText('body').insert(0, bodyText(univer));
    bootstrap.getMap<string>('metadata').set('univer', JSON.stringify(univer));
    Y.applyUpdate(this.document, Y.encodeStateAsUpdate(bootstrap), BOOTSTRAP_ORIGIN);
    bootstrap.destroy();
  }

  updateFromSnapshot(value: unknown): PaperYjsOperation | null {
    const next = cloneRecord(value, this.snapshot());
    const updates: Uint8Array[] = [];
    const listener = (update: Uint8Array, origin: unknown) => { if (origin === LOCAL_ORIGIN) updates.push(update); };
    this.document.on('update', listener);
    this.document.transact(() => {
      const patch = diffText(this.text, bodyText(next));
      if (patch?.deleteCount) this.textType.delete(patch.index, patch.deleteCount);
      if (patch?.insert) this.textType.insert(patch.index, patch.insert);
      this.metadata.set('univer', JSON.stringify(next));
    }, LOCAL_ORIGIN);
    this.document.off('update', listener);
    if (!updates.length) return null;
    return { protocolVersion: 1, kind: 'paper.yjs.update', updateBase64: bytesToBase64(Y.mergeUpdates(updates)) };
  }

  applyOperation(operation: PaperYjsOperation): PaperTextPatch | null {
    const before = this.text;
    Y.applyUpdate(this.document, base64ToBytes(operation.updateBase64));
    return diffText(before, this.text);
  }

  snapshot(): Record<string, unknown> {
    const encoded = this.metadata.get('univer');
    let template: Record<string, unknown> = { id: this.id, body: { dataStream: '\r\n' } };
    if (encoded) {
      try { template = cloneRecord(JSON.parse(encoded), template); } catch { /* keep the safe fallback */ }
    }
    return withBodyText(template, this.text);
  }

  checkpoint(): PaperCheckpoint {
    return {
      flockdocCollaboration: { protocolVersion: 1, kind: 'paper.yjs.snapshot', stateBase64: bytesToBase64(Y.encodeStateAsUpdate(this.document)) },
      univer: this.snapshot(),
    };
  }
}

export function paperSnapshotForEditor(value: unknown): unknown {
  return isCheckpoint(value) ? value.univer : value;
}
