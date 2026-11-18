const DB_NAME = 'sd_quran_bell_audio_store';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;
export const IDB_AUDIO_PREFIX = 'idb-audio://';

function openAudioDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di browser ini.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Gagal membuka penyimpanan audio lokal.'));
  });
}

export async function saveAudioBlobToIDB(id: string, blobOrDataUrl: Blob | string): Promise<string> {
  let blob: Blob;
  if (typeof blobOrDataUrl === 'string') {
    const res = await fetch(blobOrDataUrl);
    blob = await res.blob();
  } else {
    blob = blobOrDataUrl;
  }

  const db = await openAudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(blob, id);
    tx.oncomplete = () => {
      db.close();
      resolve(`${IDB_AUDIO_PREFIX}${id}`);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Gagal menyimpan audio rekaman ke IndexedDB.'));
    };
  });
}

export async function getAudioBlobFromIDB(idOrRef: string): Promise<Blob | null> {
  const key = idOrRef.startsWith(IDB_AUDIO_PREFIX)
    ? idOrRef.slice(IDB_AUDIO_PREFIX.length)
    : idOrRef;

  const db = await openAudioDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as Blob) || null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error('Gagal membaca audio rekaman dari IndexedDB.'));
    };
  });
}

export async function deleteAudioBlobFromIDB(idOrRef: string): Promise<void> {
  if (!idOrRef || !idOrRef.startsWith(IDB_AUDIO_PREFIX)) return;
  const key = idOrRef.slice(IDB_AUDIO_PREFIX.length);
  try {
    const db = await openAudioDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  } catch {
    // Ignore cleanup errors
  }
}
