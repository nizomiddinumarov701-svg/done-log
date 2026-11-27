/**
 * Local IndexedDB storage for DoneLog entries (with turns & Before/After photos),
 * member names, presets, deletion tombstones, preferences, and image compression/watermarking.
 */

const DB_NAME = 'DoneLogVaultDB';
const DB_VERSION = 1;
const STORE_ENTRIES = 'entries';
const STORE_PHOTOS = 'photos';
const STORE_META = 'meta';
const SYNC_CONFIG_KEY = 'donelog_github_sync_v1';
const THEME_KEY = 'donelog_theme_v1';
const STAMP_PREF_KEY = 'donelog_stamp_v1';

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

export const DEFAULT_MEMBERS = { me: '', brother: '' };

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

function readAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
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
    const membersMeta = meta.get('members');

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
        doneBy: e.doneBy === 'brother' ? 'brother' : 'me',
        timestamp: Number(e.timestamp) || Date.now(),
        updatedAt: Number(e.updatedAt || e.timestamp) || Date.now(),
        photoFile: e.photoFile ? String(e.photoFile) : null,
        beforePhotoFile: e.beforePhotoFile ? String(e.beforePhotoFile) : null
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    const members =
      membersMeta?.value && typeof membersMeta.value === 'object'
        ? {
            me: String(membersMeta.value.me || '').trim().slice(0, 24),
            brother: String(membersMeta.value.brother || '').trim().slice(0, 24)
          }
        : { ...DEFAULT_MEMBERS };

    return {
      entries: sortedEntries,
      photos: photosMap,
      presets:
        Array.isArray(presetsMeta?.value) && presetsMeta.value.length > 0
          ? presetsMeta.value
          : [...DEFAULT_PRESETS],
      presetsUpdatedAt: Number(presetsMeta?.updatedAt) || 0,
      members,
      membersUpdatedAt: Number(membersMeta?.updatedAt) || 0,
      deletedIds: deletedMeta?.value && typeof deletedMeta.value === 'object' ? deletedMeta.value : {}
    };
  } catch (err) {
    console.warn('IndexedDB unavailable, falling back to in-memory session:', err);
    return {
      entries: [],
      photos: new Map(),
      presets: [...DEFAULT_PRESETS],
      presetsUpdatedAt: 0,
      members: { ...DEFAULT_MEMBERS },
      membersUpdatedAt: 0,
      deletedIds: {}
    };
  }
}

export async function saveLocalVault({
  entries,
  photos,
  presets,
  presetsUpdatedAt,
  members,
  membersUpdatedAt,
  deletedIds
}) {
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
          doneBy: e.doneBy === 'brother' ? 'brother' : 'me',
          timestamp: Number(e.timestamp) || Date.now(),
          updatedAt: Number(e.updatedAt || e.timestamp) || Date.now(),
          photoFile: e.photoFile || null,
          beforePhotoFile: e.beforePhotoFile || null
        });
      }

      photoStore.clear();
      for (const [key, dataUrl] of photos.entries()) {
        if (key && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
          photoStore.put({ key, dataUrl });
        }
      }

      metaStore.put({ key: 'presets', value: presets, updatedAt: Number(presetsUpdatedAt) || 0 });
      metaStore.put({
        key: 'members',
        value: members || { ...DEFAULT_MEMBERS },
        updatedAt: Number(membersUpdatedAt) || 0
      });
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

export function loadSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore
  }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function loadStampPref() {
  try {
    const saved = localStorage.getItem(STAMP_PREF_KEY);
    if (saved === 'false') return false;
  } catch {
    // ignore
  }
  return true;
}

export function saveStampPref(enabled) {
  try {
    localStorage.setItem(STAMP_PREF_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

/**
 * Compresses an uploaded image file to a lightweight JPEG data URL.
 */
export function compressImage(file, maxDimension = 1024, quality = 0.78) {
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

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Renders a crisp, camera-style timestamp watermark onto a compressed image data URL
 * (plus an optional top-left BEFORE/AFTER badge).
 */
export function applyTimestampWatermark(
  cleanDataUrl,
  { timestamp = Date.now(), tag = '', locale = undefined, quality = 0.78 } = {}
) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Could not apply timestamp watermark.'));
    img.onload = () => {
      const { width, height } = img;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const minDim = Math.min(width, height);
      const fontSize = Math.max(13, Math.min(26, Math.round(minDim * 0.032)));
      const padX = Math.round(fontSize * 0.75);
      const padY = Math.round(fontSize * 0.44);
      const margin = Math.max(10, Math.round(minDim * 0.025));

      const formattedDate = new Date(timestamp).toLocaleString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      const stampText = `✓ DoneLog  •  ${formattedDate}`;

      ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textBaseline = 'middle';

      const textMetrics = ctx.measureText(stampText);
      const boxW = Math.min(width - margin * 2, Math.ceil(textMetrics.width) + padX * 2);
      const boxH = fontSize + padY * 2;
      const boxX = width - boxW - margin;
      const boxY = height - boxH - margin;

      // Subtle translucent dark pill with crisp border
      ctx.save();
      drawRoundedRect(ctx, boxX, boxY, boxW, boxH, Math.round(boxH * 0.35));
      ctx.fillStyle = 'rgba(15, 23, 42, 0.74)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.07));
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.fillText(stampText, boxX + padX, boxY + boxH / 2 + 0.5, boxW - padX * 2);
      ctx.restore();

      // Optional top-left BEFORE / AFTER pill
      if (tag) {
        ctx.save();
        const tagFont = Math.max(12, Math.round(fontSize * 0.85));
        ctx.font = `800 ${tagFont}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        const tagText = String(tag).toUpperCase();
        const tagW = Math.ceil(ctx.measureText(tagText).width) + padX * 1.6;
        const tagH = tagFont + padY * 1.6;
        drawRoundedRect(ctx, margin, margin, tagW, tagH, Math.round(tagH * 0.35));
        ctx.fillStyle = tagText === 'AFTER' || tagText === 'ПОСЛЕ'
          ? 'rgba(13, 148, 136, 0.88)'
          : 'rgba(15, 23, 42, 0.78)';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, margin + padX * 0.8, margin + tagH / 2 + 0.5);
        ctx.restore();
      }

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = cleanDataUrl;
  });
}
