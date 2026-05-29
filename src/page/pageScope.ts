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
