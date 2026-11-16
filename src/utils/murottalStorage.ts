import { MurottalTrack } from '../types';

const DB_NAME = 'SDQuranMurottalDB';
const DB_VERSION = 1;
const STORE_NAME = 'custom_murottal_tracks';

function openMurottalDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported in this browser'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCustomMurottalTrack(track: MurottalTrack): Promise<void> {
  try {
    const db = await openMurottalDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(track);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error saving custom track to IndexedDB:', err);
    // Fallback to localStorage if small
    try {
      const existing = JSON.parse(localStorage.getItem('custom_murottal_tracks') || '[]');
      const filtered = existing.filter((t: MurottalTrack) => t.id !== track.id);
      localStorage.setItem('custom_murottal_tracks', JSON.stringify([track, ...filtered]));
    } catch (e) {
      console.warn('LocalStorage fallback failed:', e);
    }
  }
}

export async function getCustomMurottalTracks(): Promise<MurottalTrack[]> {
  try {
    const db = await openMurottalDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB read failed, trying localStorage:', err);
    try {
      return JSON.parse(localStorage.getItem('custom_murottal_tracks') || '[]');
    } catch {
      return [];
    }
  }
}

export async function deleteCustomMurottalTrack(trackId: string): Promise<void> {
  try {
    const db = await openMurottalDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(trackId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('IndexedDB delete error:', err);
    try {
      const existing = JSON.parse(localStorage.getItem('custom_murottal_tracks') || '[]');
      const filtered = existing.filter((t: MurottalTrack) => t.id !== trackId);
      localStorage.setItem('custom_murottal_tracks', JSON.stringify(filtered));
    } catch {}
  }
}
