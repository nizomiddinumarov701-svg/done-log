/**
 * Local IndexedDB storage for DoneLog entries, photos, presets, and deletion tombstones,
 * plus client-side image compression.
 */

const DB_NAME = 'DoneLogVaultDB';
const DB_VERSION = 1;
const STORE_ENTRIES = 'entries';
const STORE_PHOTOS = 'photos';
const STORE_META = 'meta';
const SYNC_CONFIG_KEY = 'donelog_github_sync_v1';

export const DEFAULT_PRESETS = [
  { id: 'dishes', icon: '🍽️', label: 'Washed dishes' },
  { id: 'trash', icon: '🗑️', label: 'Took out trash' },
  { id: 'sweep', icon: '🧹', label: 'Swept / Vacuumed' },
  { id: 'laundry', icon: '🧺', label: 'Did laundry' },
  { id: 'groceries', icon: '🛒', label: 'Bought groceries' },
  { id: 'cook', icon: '🍳', label: 'Cooked meal' },
  { id: 'bathroom', icon: '🚿', label: 'Cleaned bathroom' },
  { id: 'kitchen', icon: '🧽', label: 'Cleaned kitchen' },
  { id: 'bedroom', icon: '🛏️', label: 'Cleaned bedroom' }
];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
        const store = db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadLocalVault() {
  try {
    const db = await openDB();
    const [entries, photoRows, metaRows] = await Promise.all([
      readAll(db, STORE_ENTRIES),
      readAll(db, STORE_PHOTOS),
      readAll(db, STORE_META)
    ]);

    const meta = new Map(metaRows.map((r) => [r.key, r]));
    const presetsMeta = meta.get('presets');
    const deletedMeta = meta.get('deletedIds');

    const photosMap = new Map();
    for (const row of photoRows) {
      if (row && row.key && typeof row.dataUrl === 'string') {
        photosMap.set(row.key, row.dataUrl);
      }
    }

    const sortedEntries = (entries || [])
      .map((e) => ({
        id: String(e.id),
        title: String(e.title || ''),
        note: String(e.note || ''),
        icon: String(e.icon || '✅'),
        timestamp: Number(e.timestamp) || Date.now(),
        updatedAt: Number(e.updatedAt || e.timestamp) || Date.now(),
        photoFile: e.photoFile ? String(e.photoFile) : null
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    return {
      entries: sortedEntries,
      photos: photosMap,
      presets: Array.isArray(presetsMeta?.value) && presetsMeta.value.length > 0
        ? presetsMeta.value
        : [...DEFAULT_PRESETS],
      presetsUpdatedAt: Number(presetsMeta?.updatedAt) || 0,
      deletedIds: deletedMeta?.value && typeof deletedMeta.value === 'object' ? deletedMeta.value : {}
    };
  } catch (err) {
    console.warn('IndexedDB unavailable, falling back to in-memory session:', err);
    return {
      entries: [],
      photos: new Map(),
      presets: [...DEFAULT_PRESETS],
      presetsUpdatedAt: 0,
      deletedIds: {}
    };
  }
}

function readAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalVault({ entries, photos, presets, presetsUpdatedAt, deletedIds }) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_ENTRIES, STORE_PHOTOS, STORE_META], 'readwrite');
      const entryStore = tx.objectStore(STORE_ENTRIES);
      const photoStore = tx.objectStore(STORE_PHOTOS);
      const metaStore = tx.objectStore(STORE_META);

      entryStore.clear();
      for (const e of entries) {
        entryStore.put({
          id: e.id,
          title: e.title,
          note: e.note || '',
          icon: e.icon || '✅',
          timestamp: Number(e.timestamp) || Date.now(),
          updatedAt: Number(e.updatedAt || e.timestamp) || Date.now(),
          photoFile: e.photoFile || null
        });
      }

      photoStore.clear();
      for (const [key, dataUrl] of photos.entries()) {
        if (key && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
          photoStore.put({ key, dataUrl });
        }
      }

      metaStore.put({ key: 'presets', value: presets, updatedAt: Number(presetsUpdatedAt) || 0 });
      metaStore.put({ key: 'deletedIds', value: deletedIds || {} });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not write local IndexedDB vault:', err);
  }
}

export function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.token !== 'string' || !parsed.token.trim()) return null;
    return {
      token: parsed.token.trim(),
      username: String(parsed.username || ''),
      gistId: String(parsed.gistId || ''),
      gistUrl: String(parsed.gistUrl || ''),
      version: Math.max(1, Number(parsed.version) || 1),
      lastSyncedAt: Number(parsed.lastSyncedAt) || 0
    };
  } catch {
    return null;
  }
}

export function saveSyncConfig(config) {
  try {
    if (!config) {
      localStorage.removeItem(SYNC_CONFIG_KEY);
    } else {
      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
    }
  } catch (err) {
    console.warn('Could not persist sync config in localStorage:', err);
  }
}

/**
 * Compresses an uploaded image file to a crisp, lightweight JPEG data URL
 * so photos upload quickly to GitHub Gist and fit comfortably under inline limits.
 */
export function compressImage(file, maxDimension = 1024, quality = 0.76) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
