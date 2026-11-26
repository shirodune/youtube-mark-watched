// src/page/pageScope.ts

export function extractVideoId(href: string): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, 'https://www.youtube.com');
  } catch {
    return null;
  }
  if (url.pathname !== '/watch') return null;
  return url.searchParams.get('v');
}

// SPEC §2 scope.
const ACTIVE_PATHS = new Set([
  '/',
  '/feed/subscriptions',
  '/watch',
  '/playlist',
  '/feed/history',
  '/feed/you',
]);

export function isActiveSurface(pathname: string): boolean {
  if (ACTIVE_PATHS.has(pathname)) {
    return true;
  }
  if (
    pathname.startsWith('/@') ||
    pathname.startsWith('/channel/') ||
    pathname.startsWith('/c/') ||
    pathname.startsWith('/user/')
  ) {
    return true;
  }
  return false;
}
