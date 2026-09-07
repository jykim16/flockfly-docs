import { describe, expect, it } from 'vitest';
import { decodeWebAppOperation, encodeWebAppOperation, normalizeWebAppBundle, webAppOperation } from '../lib/webapp-operations';

describe('web app operations', () => {
  it('normalizes and round-trips a collaborative bundle', () => {
    const bundle = normalizeWebAppBundle({ entrypoint: 'index.html', files: { 'index.html': '<h1>Hello</h1>', 'styles.css': 'h1{}', 'app.js': 'console.log(1)' } });
    const operation = webAppOperation(bundle);
    expect(operation.kind).toBe('webapp.bundle.update');
    expect(decodeWebAppOperation(encodeWebAppOperation(operation))).toEqual(operation);
  });

  it('rejects traversal, unsupported files, and missing entrypoints', () => {
    expect(() => normalizeWebAppBundle({ entrypoint: '../index.html', files: { '../index.html': '' } })).toThrow();
    expect(() => normalizeWebAppBundle({ entrypoint: 'index.html', files: { 'index.html': '', 'secret.json': '{}' } })).toThrow();
    expect(() => normalizeWebAppBundle({ entrypoint: 'index.html', files: { 'main.html': '' } })).toThrow();
  });
});
