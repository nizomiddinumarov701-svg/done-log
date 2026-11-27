/**
 * DoneLog Free GitHub Gist PC ↔ Phone Cloud Sync + Read-Only Share View loader.
 * Stores chore metadata, turn info, and member names in `donelog-sync-vault.json`,
 * and each Before/After photo proof as its own sibling file inside the same private Gist.
 */

import { DEFAULT_MEMBERS, DEFAULT_PRESETS } from './db.js';

const GITHUB_API = 'https://api.github.com';
export const GIST_FILENAME = 'donelog-sync-vault.json';
export const GIST_DESCRIPTION = 'DoneLog Chore & Proof Vault (Private — Do not delete)';
export const GITHUB_TOKEN_CREATE_URL =
  'https://github.com/settings/tokens/new?scopes=gist&description=DoneLog+Sync';

const PHOTO_FILE_PATTERN = /^photo_(?:before_)?[a-zA-Z0-9_-]+\.txt$/;

export function makePhotoFileName(entryId, slot = 'after') {
  const safe = String(entryId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || Date.now();
  return slot === 'before' ? `photo_before_${safe}.txt` : `photo_${safe}.txt`;
}

export function sanitizeEntries(rawEntries = []) {
  if (!Array.isArray(rawEntries)) return [];
  const list = [];
  for (const raw of rawEntries) {
    if (!raw || !raw.id || !raw.title) continue;
    const ts = Number(raw.timestamp) || Date.now();
    list.push({
      id: String(raw.id),
      title: String(raw.title).trim().slice(0, 120),
      note: String(raw.note || '').trim().slice(0, 300),
      icon: String(raw.icon || '✅').trim().slice(0, 8) || '✅',
      doneBy: raw.doneBy === 'brother' ? 'brother' : 'me',
      timestamp: ts,
      updatedAt: Number(raw.updatedAt || ts) || ts,
      photoFile:
        typeof raw.photoFile === 'string' && PHOTO_FILE_PATTERN.test(raw.photoFile)
          ? raw.photoFile
          : null,
      beforePhotoFile:
        typeof raw.beforePhotoFile === 'string' && PHOTO_FILE_PATTERN.test(raw.beforePhotoFile)
          ? raw.beforePhotoFile
          : null
    });
  }
  list.sort((a, b) => b.timestamp - a.timestamp);
  return list;
}

export function sanitizePresets(rawPresets) {
  if (!Array.isArray(rawPresets) || rawPresets.length === 0) return [...DEFAULT_PRESETS];
  const cleaned = rawPresets
    .filter((p) => p && typeof p.label === 'string' && p.label.trim())
    .slice(0, 50)
    .map((p, idx) => ({
      id: String(p.id || `preset-${idx}`),
      icon: String(p.icon || '✅').trim().slice(0, 8) || '✅',
      label: String(p.label).trim().slice(0, 50)
    }));
  return cleaned.length > 0 ? cleaned : [...DEFAULT_PRESETS];
}

export function sanitizeMembers(rawMembers) {
  if (!rawMembers || typeof rawMembers !== 'object') return { ...DEFAULT_MEMBERS };
  return {
    me: String(rawMembers.me || '').trim().slice(0, 24),
    brother: String(rawMembers.brother || '').trim().slice(0, 24)
  };
}

/**
 * Deterministic merge across PC and Phone:
 * - Honors deletion tombstones so deleted chores stay deleted.
 * - Keeps newer updatedAt if edited on either device.
 * - Preserves Before & After photos from both local and remote caches for surviving entries.
 */
export function mergeVaultStates(local, remote) {
  const deletedIds = { ...(remote.deletedIds || {}) };
  for (const [id, ts] of Object.entries(local.deletedIds || {})) {
    deletedIds[id] = Math.max(Number(deletedIds[id] || 0), Number(ts || 0));
  }

  const entryMap = new Map();
  for (const item of sanitizeEntries(remote.entries)) {
    if (deletedIds[item.id]) continue;
    entryMap.set(item.id, item);
  }
  for (const item of sanitizeEntries(local.entries)) {
    if (deletedIds[item.id]) continue;
    const prev = entryMap.get(item.id);
    if (!prev || item.updatedAt >= prev.updatedAt) {
      entryMap.set(item.id, item);
    }
  }

  const entries = Array.from(entryMap.values()).sort((a, b) => b.timestamp - a.timestamp);

  // Merge photos only for surviving entries (both After & Before slots)
  const neededPhotoFiles = new Set();
  for (const e of entries) {
    if (e.photoFile) neededPhotoFiles.add(e.photoFile);
    if (e.beforePhotoFile) neededPhotoFiles.add(e.beforePhotoFile);
  }

  const photos = new Map();
  if (remote.photos instanceof Map) {
    for (const [k, v] of remote.photos.entries()) {
      if (neededPhotoFiles.has(k) && v) photos.set(k, v);
    }
  }
  if (local.photos instanceof Map) {
    for (const [k, v] of local.photos.entries()) {
      if (neededPhotoFiles.has(k) && v && !photos.has(k)) photos.set(k, v);
    }
  }

  const localPresetTs = Number(local.presetsUpdatedAt) || 0;
  const remotePresetTs = Number(remote.presetsUpdatedAt) || 0;
  const useRemotePresets = remotePresetTs > localPresetTs;

  const localMemberTs = Number(local.membersUpdatedAt) || 0;
  const remoteMemberTs = Number(remote.membersUpdatedAt) || 0;
  const useRemoteMembers = remoteMemberTs > localMemberTs;

  return {
    entries,
    photos,
    presets: useRemotePresets ? sanitizePresets(remote.presets) : sanitizePresets(local.presets),
    presetsUpdatedAt: Math.max(localPresetTs, remotePresetTs),
    members: useRemoteMembers ? sanitizeMembers(remote.members) : sanitizeMembers(local.members),
    membersUpdatedAt: Math.max(localMemberTs, remoteMemberTs),
    deletedIds
  };
}

export function buildVaultJson({
  version = 1,
  entries,
  presets,
  presetsUpdatedAt,
  members,
  membersUpdatedAt,
  deletedIds
}) {
  return JSON.stringify(
    {
      app: 'DoneLog',
      schemaVersion: 2,
      version: Math.max(1, Number(version) || 1),
      updatedAt: Date.now(),
      presetsUpdatedAt: Number(presetsUpdatedAt) || 0,
      presets: sanitizePresets(presets),
      membersUpdatedAt: Number(membersUpdatedAt) || 0,
      members: sanitizeMembers(members),
      deletedIds: deletedIds || {},
      entries: sanitizeEntries(entries)
    },
    null,
    2
  );
}

async function fetchRawFileText(rawUrl) {
  const res = await fetch(rawUrl, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Could not download full file from GitHub (${res.status}).`);
  }
  return res.text();
}

async function hydrateGist(gistObj) {
  const files = gistObj && gistObj.files ? gistObj.files : {};
  const vaultFile = files[GIST_FILENAME];
  if (!vaultFile) {
    throw new Error(`Sync file "${GIST_FILENAME}" was not found inside this Gist.`);
  }

  const vaultText =
    vaultFile.truncated && vaultFile.raw_url
      ? await fetchRawFileText(vaultFile.raw_url)
      : String(vaultFile.content || '');

  let parsed;
  try {
    parsed = JSON.parse(vaultText);
  } catch {
    throw new Error('Could not parse DoneLog sync data from GitHub Gist.');
  }

  const entries = sanitizeEntries(parsed.entries);
  const presets = sanitizePresets(parsed.presets);
  const presetsUpdatedAt = Number(parsed.presetsUpdatedAt) || 0;
  const members = sanitizeMembers(parsed.members);
  const membersUpdatedAt = Number(parsed.membersUpdatedAt) || 0;
  const deletedIds =
    parsed.deletedIds && typeof parsed.deletedIds === 'object' ? parsed.deletedIds : {};

  const remotePhotoFiles = new Set();
  const photos = new Map();

  const truncatedFetches = [];
  for (const [filename, fileObj] of Object.entries(files)) {
    if (!PHOTO_FILE_PATTERN.test(filename) || !fileObj) continue;
    remotePhotoFiles.add(filename);
    if (!fileObj.truncated && typeof fileObj.content === 'string' && fileObj.content.startsWith('data:image/')) {
      photos.set(filename, fileObj.content);
    } else if (fileObj.truncated && fileObj.raw_url) {
      truncatedFetches.push(
        fetchRawFileText(fileObj.raw_url)
          .then((txt) => {
            if (txt.startsWith('data:image/')) photos.set(filename, txt);
          })
          .catch((err) => console.warn('Could not load truncated photo:', filename, err))
      );
    }
  }

  if (truncatedFetches.length > 0) {
    await Promise.all(truncatedFetches);
  }

  return {
    version: Math.max(1, Number(parsed.version) || 1),
    entries,
    photos,
    presets,
    presetsUpdatedAt,
    members,
    membersUpdatedAt,
    deletedIds,
    remotePhotoFiles,
    gistUrl: gistObj.html_url || `https://gist.github.com/${gistObj.id}`
  };
}

function findDoneLogGist(gists = []) {
  if (!Array.isArray(gists)) return null;
  const matches = gists.filter((g) => g && g.id && g.files && Boolean(g.files[GIST_FILENAME]));
  if (matches.length === 0) return null;
  matches.sort((a, b) => Date.parse(b.updated_at || 0) - Date.parse(a.updated_at || 0));
  return matches[0];
}

async function githubFetch(path, token, { method = 'GET', body = null } = {}) {
  const cleanToken = String(token || '').trim();
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (cleanToken) {
    headers.Authorization = `Bearer ${cleanToken}`;
  }
  if (body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    if (res.status === 401) {
      const err = new Error('Invalid or expired GitHub token. Please generate a token with "gist" permission.');
      err.status = 401;
      throw err;
    }
    if (res.status === 403) {
      const msg = (data && data.message) || '';
      const err = new Error(
        msg.toLowerCase().includes('rate limit')
          ? 'GitHub API rate limit reached — please wait a minute and try again.'
          : 'GitHub token is missing "gist" permission. Create a token with the "gist" box checked!'
      );
      err.status = 403;
      throw err;
    }
    if (res.status === 404) {
      const err = new Error('Sync Gist not found. Check the link or reconnect GitHub Sync.');
      err.status = 404;
      throw err;
    }
    const err = new Error((data && data.message) || `GitHub sync error (${res.status}).`);
    err.status = res.status;
    throw err;
  }

  return data;
}

export async function apiGistConnect({ token, localVault }) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) throw new Error('Please paste your GitHub Sync Token first.');

  const user = await githubFetch('/user', cleanToken);
  const username = (user && user.login) || 'github-user';

  const gists = await githubFetch('/gists?per_page=100', cleanToken);
  const existing = findDoneLogGist(gists);

  if (existing) {
    const fullGist = await githubFetch(`/gists/${encodeURIComponent(existing.id)}`, cleanToken);
    const snapshot = await hydrateGist(fullGist);
    return {
      created: false,
      username,
      gistId: fullGist.id,
      ...snapshot
    };
  }

  const files = {
    [GIST_FILENAME]: {
      content: buildVaultJson({
        version: 1,
        entries: localVault.entries,
        presets: localVault.presets,
        presetsUpdatedAt: localVault.presetsUpdatedAt,
        members: localVault.members,
        membersUpdatedAt: localVault.membersUpdatedAt,
        deletedIds: localVault.deletedIds
      })
    }
  };

  const remotePhotoFiles = new Set();
  for (const entry of localVault.entries) {
    for (const key of [entry.photoFile, entry.beforePhotoFile]) {
      if (key && localVault.photos.has(key)) {
        files[key] = { content: localVault.photos.get(key) };
        remotePhotoFiles.add(key);
      }
    }
  }

  const created = await githubFetch('/gists', cleanToken, {
    method: 'POST',
    body: {
      description: GIST_DESCRIPTION,
      public: false,
      files
    }
  });

  return {
    created: true,
    username,
    gistId: created.id,
    gistUrl: created.html_url || `https://gist.github.com/${created.id}`,
    version: 1,
    entries: sanitizeEntries(localVault.entries),
    photos: new Map(localVault.photos),
    presets: sanitizePresets(localVault.presets),
    presetsUpdatedAt: Number(localVault.presetsUpdatedAt) || 0,
    members: sanitizeMembers(localVault.members),
    membersUpdatedAt: Number(localVault.membersUpdatedAt) || 0,
    deletedIds: { ...(localVault.deletedIds || {}) },
    remotePhotoFiles
  };
}

export async function apiGistPull({ token, gistId }) {
  const fullGist = await githubFetch(`/gists/${encodeURIComponent(gistId)}`, token);
  return hydrateGist(fullGist);
}

export async function apiGistPush({ token, gistId, version, vault, remotePhotoFiles = new Set() }) {
  const nextVersion = Math.max(1, Number(version) || 1);
  const files = {
    [GIST_FILENAME]: {
      content: buildVaultJson({
        version: nextVersion,
        entries: vault.entries,
        presets: vault.presets,
        presetsUpdatedAt: vault.presetsUpdatedAt,
        members: vault.members,
        membersUpdatedAt: vault.membersUpdatedAt,
        deletedIds: vault.deletedIds
      })
    }
  };

  const activePhotoFiles = new Set();
  for (const entry of vault.entries) {
    for (const key of [entry.photoFile, entry.beforePhotoFile]) {
      if (!key) continue;
      activePhotoFiles.add(key);
      if (!remotePhotoFiles.has(key) && vault.photos.has(key)) {
        files[key] = { content: vault.photos.get(key) };
      }
    }
  }

  for (const oldFile of remotePhotoFiles) {
    if (!activePhotoFiles.has(oldFile)) {
      files[oldFile] = null;
    }
  }

  const updated = await githubFetch(`/gists/${encodeURIComponent(gistId)}`, token, {
    method: 'PATCH',
    body: {
      description: GIST_DESCRIPTION,
      files
    }
  });

  const nextRemotePhotos = new Set();
  if (updated && updated.files) {
    for (const filename of Object.keys(updated.files)) {
      if (PHOTO_FILE_PATTERN.test(filename)) nextRemotePhotos.add(filename);
    }
  } else {
    for (const k of activePhotoFiles) nextRemotePhotos.add(k);
  }

  return {
    version: nextVersion,
    gistUrl: (updated && updated.html_url) || `https://gist.github.com/${gistId}`,
    remotePhotoFiles: nextRemotePhotos
  };
}

export async function apiGistReadPublicView(gistId) {
  const cleanId = String(gistId || '').trim();
  if (!/^[a-f0-9]{16,64}$/i.test(cleanId)) {
    throw new Error('Invalid share link.');
  }
  const fullGist = await githubFetch(`/gists/${encodeURIComponent(cleanId)}`, '');
  return hydrateGist(fullGist);
}
