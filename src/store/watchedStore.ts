// src/store/watchedStore.ts
const KEY = 'ymw:watched';

async function readSet(): Promise<Set<string>> {
  const got = await chrome.storage.local.get(KEY);
  const arr = (got[KEY] as string[] | undefined) ?? [];
  return new Set(arr);
}

export async function getAll(): Promise<Set<string>> {
  return readSet();
}

export async function isMarked(videoId: string): Promise<boolean> {
  return (await readSet()).has(videoId);
}

export async function add(videoId: string): Promise<void> {
  const set = await readSet();
  if (set.has(videoId)) return;
  set.add(videoId);
  await chrome.storage.local.set({ [KEY]: [...set] });
}
