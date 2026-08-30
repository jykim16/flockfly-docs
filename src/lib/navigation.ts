const LEGACY_FLOCKDOC_PREFIX = '#/flockdoc/';

export function currentFlockdocPath(): string {
  return location.hash.startsWith(LEGACY_FLOCKDOC_PREFIX) ? location.hash.slice(1) : location.pathname;
}

export function migrateLegacyFlockdocPath(): void {
  if (location.hash.startsWith(LEGACY_FLOCKDOC_PREFIX)) {
    history.replaceState(null, '', location.hash.slice(1));
  }
}

export function navigateFlockdoc(path: string): void {
  history.pushState(null, '', path);
  dispatchEvent(new Event('popstate'));
}
