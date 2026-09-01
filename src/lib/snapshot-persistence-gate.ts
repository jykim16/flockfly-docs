function stableJson(value: unknown): string | undefined {
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'bigint') throw new TypeError('Flockdoc snapshots cannot contain bigint values.');
  if (typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    return `[${value.map(entry => stableJson(entry) ?? 'null').join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record).sort().flatMap(key => {
    const serialized = stableJson(record[key]);
    return serialized === undefined ? [] : [`${JSON.stringify(key)}:${serialized}`];
  });
  return `{${entries.join(',')}}`;
}

function snapshotFingerprint(snapshot: unknown): string {
  return stableJson(snapshot) ?? 'undefined';
}

export class SnapshotPersistenceGate {
  private baseline: string;

  constructor(snapshot: unknown) {
    this.baseline = snapshotFingerprint(snapshot);
  }

  hasChanged(snapshot: unknown): boolean {
    return snapshotFingerprint(snapshot) !== this.baseline;
  }

  accept(snapshot: unknown): void {
    this.baseline = snapshotFingerprint(snapshot);
  }

  async persistIfChanged<T>(snapshot: unknown, persist: () => Promise<T>): Promise<{ changed: false } | { changed: true; value: T }> {
    const fingerprint = snapshotFingerprint(snapshot);
    if (fingerprint === this.baseline) return { changed: false };
    const value = await persist();
    this.baseline = fingerprint;
    return { changed: true, value };
  }
}
