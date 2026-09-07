import { describe, expect, it } from 'vitest';
import { buildWebAppPreview } from '../lib/webapp-preview';

describe('web app preview', () => {
  it('inlines local CSS and JavaScript and injects the review bridge', () => {
    const html = buildWebAppPreview({
      entrypoint: 'index.html',
      files: {
        'index.html': '<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><button id="buy">Buy</button><script src="app.js"></script></body></html>',
        'styles.css': '#buy { color: red; }',
        'app.js': 'document.querySelector("#buy").dataset.ready = "yes";',
      },
    }, 'load-token');
    expect(html).toContain('#buy { color: red; }');
    expect(html).toContain('dataset.ready');
    expect(html).toContain('webapp.element.selected');
    expect(html).toContain('load-token');
    expect(html).toContain("default-src 'none'");
  });
});
