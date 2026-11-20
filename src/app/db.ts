// Offline-first persistence (TEC-4): IndexedDB via idb-keyval.
import { createStore, get, set, del, keys } from 'idb-keyval';

const stateStore = createStore('pixel-birder', 'state');
const photoStore = createStore('pixel-birder-photos', 'photos');
const refStore = createStore('pixel-birder-ref', 'ref');

export const loadState = <T>() => get<T>('game', stateStore);
export const saveState = (v: unknown) => set('game', v, stateStore);

export const putPhoto = (id: string, blob: Blob) => set(id, blob, photoStore);
export const getPhoto = (id: string) => get<Blob>(id, photoStore);
export const deletePhoto = (id: string) => del(id, photoStore);
export const photoKeys = () => keys(photoStore);

export const getRef = <T>(id: string) => get<T>(id, refStore);
export const putRef = (id: string, v: unknown) => set(id, v, refStore);

const urlCache = new Map<string, string>();
export async function photoURL(id: string | null): Promise<string | null> {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id)!;
  const b = await getPhoto(id);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  urlCache.set(id, u);
  return u;
}
export function forgetPhotoURL(id: string) {
  const u = urlCache.get(id);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(id);
}
