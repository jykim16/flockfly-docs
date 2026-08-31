import type { Flockdoc } from '../types';

export function normalizePrefix(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') return '';
  const segments = trimmed.split('/').map(segment => segment.trim()).filter(Boolean);
  if (segments.some(segment => segment === '.' || segment === '..')) throw new Error('Folder paths cannot contain . or .. segments.');
  const normalized = segments.join('/');
  if (normalized.length > 512) throw new Error('Folder paths must be 512 characters or fewer.');
  return normalized ? `${normalized}/` : '';
}

export function allPrefixes(items: Flockdoc[]): string[] {
  const prefixes = new Set<string>();
  for (const item of items) {
    const segments = item.prefix.split('/').filter(Boolean);
    for (let index = 1; index <= segments.length; index += 1) prefixes.add(`${segments.slice(0, index).join('/')}/`);
  }
  return [...prefixes].sort((left, right) => left.localeCompare(right));
}

export function immediatePrefixes(items: Flockdoc[], currentPrefix: string): string[] {
  const children = new Set<string>();
  for (const item of items) {
    if (!item.prefix.startsWith(currentPrefix) || item.prefix === currentPrefix) continue;
    const child = item.prefix.slice(currentPrefix.length).split('/')[0];
    if (child) children.add(`${currentPrefix}${child}/`);
  }
  return [...children].sort((left, right) => left.localeCompare(right));
}

export function prefixName(prefix: string): string {
  return prefix.split('/').filter(Boolean).at(-1) ?? '';
}
