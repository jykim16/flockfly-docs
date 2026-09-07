export interface WebAppBundle {
  entrypoint: string;
  files: Record<string, string>;
}

export interface WebAppOperation {
  protocolVersion: 1;
  kind: 'webapp.bundle.update';
  bundle: WebAppBundle;
}

const MAX_FILES = 200;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_BUNDLE_BYTES = 8 * 1024 * 1024;

export const DEFAULT_WEB_APP_BUNDLE: WebAppBundle = {
  entrypoint: 'index.html',
  files: {
    'index.html': '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Flockdoc Web App</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <main class="card">\n    <span class="eyebrow">Flockdoc Web App</span>\n    <h1>Build something remarkable.</h1>\n    <p>Edit the files, preview instantly, and select any element to leave feedback.</p>\n    <button id="hello">Try it</button>\n  </main>\n  <script src="app.js"></script>\n</body>\n</html>',
    'styles.css': ':root { font-family: Inter, system-ui, sans-serif; color: #102033; background: #edf5f5; }\n* { box-sizing: border-box; }\nbody { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 32px; }\n.card { width: min(620px, 100%); padding: 48px; border-radius: 20px; background: white; box-shadow: 0 24px 70px rgba(31, 45, 61, .12); }\n.eyebrow { color: #0f6f7b; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; }\nh1 { margin: 12px 0; font-size: clamp(36px, 7vw, 64px); line-height: .98; }\np { color: #5f7284; font-size: 18px; line-height: 1.6; }\nbutton { border: 0; border-radius: 10px; padding: 12px 18px; color: white; background: #0f6f7b; font: inherit; font-weight: 700; cursor: pointer; }',
    'app.js': 'document.querySelector("#hello")?.addEventListener("click", event => {\n  event.currentTarget.textContent = "It works!";\n});',
  },
};

export function isWebAppFilePath(path: string): boolean {
  if (!path || path.length > 240 || path.startsWith('/') || path.includes('\\') || path.includes('?') || path.includes('#')) return false;
  const parts = path.split('/');
  return parts.every(part => part && part !== '.' && part !== '..') && /\.(?:html|css|js)$/i.test(path);
}

export function normalizeWebAppBundle(value: unknown): WebAppBundle {
  const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<WebAppBundle> : {};
  const entrypoint = typeof candidate.entrypoint === 'string' ? candidate.entrypoint : DEFAULT_WEB_APP_BUNDLE.entrypoint;
  if (!isWebAppFilePath(entrypoint) || !entrypoint.toLowerCase().endsWith('.html')) throw new Error('entrypoint must be a relative .html path.');
  if (!candidate.files || typeof candidate.files !== 'object' || Array.isArray(candidate.files)) return structuredClone(DEFAULT_WEB_APP_BUNDLE);
  const entries = Object.entries(candidate.files);
  if (!entries.length || entries.length > MAX_FILES) throw new Error(`A Web App bundle must contain 1-${MAX_FILES} files.`);
  let totalBytes = 0;
  const files: Record<string, string> = {};
  for (const [path, content] of entries) {
    if (!isWebAppFilePath(path)) throw new Error(`Unsupported Web App file path: ${path}`);
    if (typeof content !== 'string') throw new Error(`Web App file ${path} must contain text.`);
    const bytes = new TextEncoder().encode(content).byteLength;
    if (bytes > MAX_FILE_BYTES) throw new Error(`Web App file ${path} exceeds 1 MB.`);
    totalBytes += bytes;
    files[path] = content;
  }
  if (totalBytes > MAX_BUNDLE_BYTES) throw new Error('Web App bundle exceeds 8 MB.');
  if (!(entrypoint in files)) throw new Error('entrypoint must name a file in the bundle.');
  return { entrypoint, files };
}

export function webAppOperation(bundle: unknown): WebAppOperation {
  return { protocolVersion: 1, kind: 'webapp.bundle.update', bundle: normalizeWebAppBundle(bundle) };
}

export function encodeWebAppOperation(operation: WebAppOperation): string {
  const bytes = new TextEncoder().encode(JSON.stringify(operation));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodeWebAppOperation(updateBase64: string): WebAppOperation | null {
  try {
    const binary = atob(updateBase64);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<WebAppOperation>;
    if (parsed.protocolVersion !== 1 || parsed.kind !== 'webapp.bundle.update') return null;
    return webAppOperation(parsed.bundle);
  } catch {
    return null;
  }
}
