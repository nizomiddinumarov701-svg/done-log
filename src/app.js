import {
  DEFAULT_PRESETS,
  loadLocalVault,
  saveLocalVault,
  loadSyncConfig,
  saveSyncConfig,
  compressImage
} from './db.js';
import {
  GITHUB_TOKEN_CREATE_URL,
  makePhotoFileName,
  mergeVaultStates,
  apiGistConnect,
  apiGistPull,
  apiGistPush,
  apiGistReadPublicView
} from './sync.js';

const viewGistId = new URLSearchParams(window.location.search).get('view')?.trim() || '';
const isViewerMode = Boolean(viewGistId);

// State
const state = {
  entries: [],
  photos: new Map(), // photoFile -> dataUrl
  presets: [...DEFAULT_PRESETS],
  presetsUpdatedAt: 0,
  deletedIds: {},
  remotePhotoFiles: new Set(),

  syncConfig: isViewerMode ? null : loadSyncConfig(),
  syncBusy: false,
  syncError: '',
  lastFocusPullAt: 0,

  loading: false,
  selectedIcon: '✅',
  pendingPhoto: null,
  range: 'all',
  search: '',
  photoOnly: false
};

// DOM references
const el = {
  syncPill: document.getElementById('syncPill'),
  btnSync: document.getElementById('btnSync'),
  btnSyncLabel: document.getElementById('btnSyncLabel'),
  btnShareBrother: document.getElementById('btnShareBrother'),
  btnCopySummary: document.getElementById('btnCopySummary'),
  btnBackup: document.getElementById('btnBackup'),

  statToday: document.getElementById('statToday'),
  statWeek: document.getElementById('statWeek'),
  statTotal: document.getElementById('statTotal'),
  statPhotos: document.getElementById('statPhotos'),

  viewerCard: document.getElementById('viewerCard'),
  btnRefreshView: document.getElementById('btnRefreshView'),
  composerCard: document.getElementById('composerCard'),
  liveClock: document.getElementById('liveClock'),
  presetChips: document.getElementById('presetChips'),
  btnManagePresets: document.getElementById('btnManagePresets'),
  logForm: document.getElementById('logForm'),
  taskInput: document.getElementById('taskInput'),
  noteInput: document.getElementById('noteInput'),
  customTimeToggle: document.getElementById('customTimeToggle'),
  customTimeWrap: document.getElementById('customTimeWrap'),
  customTimeInput: document.getElementById('customTimeInput'),
  autoTimeHint: document.getElementById('autoTimeHint'),
  btnSubmitLog: document.getElementById('btnSubmitLog'),
  btnSubmitLabel: document.getElementById('btnSubmitLabel'),

  photoDropzone: document.getElementById('photoDropzone'),
  photoInput: document.getElementById('photoInput'),
  dropzoneEmpty: document.getElementById('dropzoneEmpty'),
  dropzonePreview: document.getElementById('dropzonePreview'),
  photoPreviewImg: document.getElementById('photoPreviewImg'),
  btnRemovePhoto: document.getElementById('btnRemovePhoto'),

  filterTabs: document.querySelectorAll('.filter-tab'),
  searchInput: document.getElementById('searchInput'),
  photoOnlyToggle: document.getElementById('photoOnlyToggle'),
  loadingState: document.getElementById('loadingState'),
  timelineContainer: document.getElementById('timelineContainer'),
  emptyState: document.getElementById('emptyState'),
  emptyTitle: document.getElementById('emptyTitle'),
  emptyMessage: document.getElementById('emptyMessage'),

  syncModal: document.getElementById('syncModal'),
  syncConnectedPanel: document.getElementById('syncConnectedPanel'),
  syncSetupPanel: document.getElementById('syncSetupPanel'),
  syncConnectedUser: document.getElementById('syncConnectedUser'),
  syncLastTime: document.getElementById('syncLastTime'),
  btnCopyTokenPhone: document.getElementById('btnCopyTokenPhone'),
  btnCopyBrotherLink: document.getElementById('btnCopyBrotherLink'),
  syncGistLink: document.getElementById('syncGistLink'),
  syncConnectedError: document.getElementById('syncConnectedError'),
  btnSyncDisconnect: document.getElementById('btnSyncDisconnect'),
  btnSyncNow: document.getElementById('btnSyncNow'),
  createTokenLink: document.getElementById('createTokenLink'),
  syncSetupError: document.getElementById('syncSetupError'),
  syncConnectForm: document.getElementById('syncConnectForm'),
  syncTokenInput: document.getElementById('syncTokenInput'),
  btnSyncConnect: document.getElementById('btnSyncConnect'),

  lightboxModal: document.getElementById('lightboxModal'),
  lightboxImg: document.getElementById('lightboxImg'),
  lightboxTitle: document.getElementById('lightboxTitle'),
  lightboxMeta: document.getElementById('lightboxMeta'),

  editModal: document.getElementById('editModal'),
  editForm: document.getElementById('editForm'),
  editId: document.getElementById('editId'),
  editTaskInput: document.getElementById('editTaskInput'),
  editNoteInput: document.getElementById('editNoteInput'),
  editTimeInput: document.getElementById('editTimeInput'),

  presetsModal: document.getElementById('presetsModal'),
  addPresetForm: document.getElementById('addPresetForm'),
  newPresetIcon: document.getElementById('newPresetIcon'),
  newPresetLabel: document.getElementById('newPresetLabel'),
  presetManageList: document.getElementById('presetManageList'),
  btnResetPresets: document.getElementById('btnResetPresets'),

  backupModal: document.getElementById('backupModal'),
  btnExportJson: document.getElementById('btnExportJson'),
  restoreBackupLabel: document.getElementById('restoreBackupLabel'),
  importJsonInput: document.getElementById('importJsonInput'),

  toast: document.getElementById('toast')
};

// Toast
let toastTimer = null;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.classList.add('hidden');
  }, 2800);
}

// Date & Time helpers
function toLocalDatetimeInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getStartOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getStartOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d.getTime();
}

function getStartOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatFullDateTime(ts) {
  return new Date(ts).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatDayHeading(ts) {
  const date = new Date(ts);
  const now = new Date();
  const entryDay = getStartOfDay(date);
  const today = getStartOfDay(now);
  const yesterday = today - 86400000;

  if (entryDay === today) return 'Today';
  if (entryDay === yesterday) return 'Yesterday';

  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function formatRelativeTime(ts) {
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'Scheduled';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function updateLiveClock() {
  const now = new Date();
  el.liveClock.textContent = now.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getBrotherShareUrl() {
  if (!state.syncConfig?.gistId) return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?view=${encodeURIComponent(state.syncConfig.gistId)}`;
}

function getEntryPhotoUrl(entry) {
  if (!entry?.photoFile) return null;
  return state.photos.get(entry.photoFile) || null;
}

// Modals
function openModal(modalId) {
  document.getElementById(modalId)?.classList.remove('hidden');
}

function closeModal(modalId) {
  document.getElementById(modalId)?.classList.add('hidden');
}

document.addEventListener('click', (e) => {
  const closeTarget = e.target.closest('[data-close-modal]');
  if (closeTarget) {
    closeModal(closeTarget.getAttribute('data-close-modal'));
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ['syncModal', 'lightboxModal', 'editModal', 'presetsModal', 'backupModal'].forEach(closeModal);
  }
});

// Local persistence helper
function getCurrentVault() {
  return {
    entries: state.entries,
    photos: state.photos,
    presets: state.presets,
    presetsUpdatedAt: state.presetsUpdatedAt,
    deletedIds: state.deletedIds
  };
}

function applyVault(vault) {
  state.entries = vault.entries;
  state.photos = vault.photos;
  state.presets = vault.presets;
  state.presetsUpdatedAt = vault.presetsUpdatedAt;
  state.deletedIds = vault.deletedIds;
}

async function persistLocal() {
  if (isViewerMode) return;
  await saveLocalVault(getCurrentVault());
}

// Sync UI rendering
function renderSyncUI() {
  if (isViewerMode) {
    el.composerCard.classList.add('hidden');
    el.viewerCard.classList.remove('hidden');
    el.btnSync.classList.add('hidden');
    el.btnShareBrother.classList.add('hidden');
    el.restoreBackupLabel.classList.add('hidden');

    el.syncPill.textContent = state.syncError ? '⚠️ Load failed' : '👁️ Live view';
    el.syncPill.classList.toggle('synced', !state.syncError);
    el.syncPill.classList.toggle('error', Boolean(state.syncError));
    return;
  }

  el.composerCard.classList.remove('hidden');
  el.viewerCard.classList.add('hidden');
  el.btnSync.classList.remove('hidden');
  el.restoreBackupLabel.classList.remove('hidden');

  const cfg = state.syncConfig;
  if (cfg && cfg.gistId) {
    el.btnShareBrother.classList.remove('hidden');
    el.btnSync.classList.remove('btn-primary');
    el.btnSync.classList.add('btn-ghost');

    if (state.syncBusy) {
      el.syncPill.textContent = '⏳ Syncing...';
      el.syncPill.classList.remove('error');
      el.syncPill.classList.add('synced');
      el.btnSyncLabel.textContent = 'Syncing';
    } else if (state.syncError) {
      el.syncPill.textContent = '⚠️ Sync issue';
      el.syncPill.classList.remove('synced');
      el.syncPill.classList.add('error');
      el.btnSyncLabel.textContent = 'Sync';
    } else {
      el.syncPill.textContent = '☁️ GitHub synced';
      el.syncPill.classList.remove('error');
      el.syncPill.classList.add('synced');
      el.btnSyncLabel.textContent = 'Synced';
    }

    // Modal connected state
    el.syncConnectedPanel.classList.remove('hidden');
    el.syncSetupPanel.classList.add('hidden');
    el.syncConnectedUser.textContent = cfg.username
      ? `Connected as @${cfg.username}`
      : 'Connected to GitHub Gist';
    el.syncLastTime.textContent = cfg.lastSyncedAt
      ? `Last synced ${formatRelativeTime(cfg.lastSyncedAt)}`
      : 'Ready to sync';
    el.syncGistLink.href = cfg.gistUrl || `https://gist.github.com/${cfg.gistId}`;
    el.btnSyncNow.disabled = state.syncBusy;
    el.btnSyncNow.textContent = state.syncBusy ? '⏳ Syncing...' : '🔄 Sync Now';
    el.btnSyncDisconnect.disabled = state.syncBusy;

    if (state.syncError) {
      el.syncConnectedError.textContent = `⚠️ ${state.syncError}`;
      el.syncConnectedError.classList.remove('hidden');
    } else {
      el.syncConnectedError.classList.add('hidden');
    }
  } else {
    el.btnShareBrother.classList.add('hidden');
    el.btnSync.classList.remove('btn-ghost');
    el.btnSync.classList.add('btn-primary');
    el.btnSyncLabel.textContent = 'Sync';
    el.syncPill.textContent = 'Local mode';
    el.syncPill.classList.remove('synced', 'error');

    // Modal setup state
    el.syncConnectedPanel.classList.add('hidden');
    el.syncSetupPanel.classList.remove('hidden');
    el.btnSyncConnect.disabled = state.syncBusy;
    el.btnSyncConnect.textContent = state.syncBusy ? '⏳ Connecting...' : '☁️ Connect & Sync Now';

    if (state.syncError) {
      el.syncSetupError.textContent = `⚠️ ${state.syncError}`;
      el.syncSetupError.classList.remove('hidden');
    } else {
      el.syncSetupError.classList.add('hidden');
    }
  }
}

// GitHub Gist Sync engine
let pendingPush = false;

async function syncWithGitHub({ pushAfterMerge = false, silent = false } = {}) {
  if (isViewerMode || !state.syncConfig?.token || !state.syncConfig?.gistId) return;
  if (state.syncBusy) {
    if (pushAfterMerge) pendingPush = true;
    return;
  }

  state.syncBusy = true;
  state.syncError = '';
  renderSyncUI();

  try {
    const remote = await apiGistPull({
      token: state.syncConfig.token,
      gistId: state.syncConfig.gistId
    });
    state.remotePhotoFiles = remote.remotePhotoFiles;

    const beforeSig = JSON.stringify({
      e: state.entries,
      p: state.presets,
      d: state.deletedIds
    });
    const remoteSig = JSON.stringify({
      e: remote.entries,
      p: remote.presets,
      d: remote.deletedIds
    });

    const merged = mergeVaultStates(getCurrentVault(), remote);
    applyVault(merged);
    await persistLocal();

    const mergedSig = JSON.stringify({
      e: merged.entries,
      p: merged.presets,
      d: merged.deletedIds
    });

    // Push if caller mutated local state OR if local had offline changes not yet on remote
    const needsPush = pushAfterMerge || mergedSig !== remoteSig;
    let nextVersion = remote.version;
    let gistUrl = remote.gistUrl;

    if (needsPush) {
      const pushed = await apiGistPush({
        token: state.syncConfig.token,
        gistId: state.syncConfig.gistId,
        version: Math.max(state.syncConfig.version, remote.version) + 1,
        vault: merged,
        remotePhotoFiles: state.remotePhotoFiles
      });
      nextVersion = pushed.version;
      gistUrl = pushed.gistUrl;
      state.remotePhotoFiles = pushed.remotePhotoFiles;
    }

    state.syncConfig = {
      ...state.syncConfig,
      version: nextVersion,
      gistUrl,
      lastSyncedAt: Date.now()
    };
    saveSyncConfig(state.syncConfig);

    if (mergedSig !== beforeSig || !silent) {
      renderPresetChips();
      renderAll();
    }
    if (!silent) {
      showToast('Synced with GitHub!');
    }
  } catch (err) {
    console.error('GitHub sync failed:', err);
    state.syncError = err.message || 'Could not sync with GitHub.';
    if (!silent) {
      showToast(state.syncError);
    }
  } finally {
    state.syncBusy = false;
    renderSyncUI();
    if (pendingPush) {
      pendingPush = false;
      syncWithGitHub({ pushAfterMerge: true, silent: true });
    }
  }
}

async function loadBrotherView() {
  state.loading = true;
  state.syncError = '';
  renderSyncUI();
  renderTimeline();

  try {
    const remote = await apiGistReadPublicView(viewGistId);
    applyVault({
      entries: remote.entries,
      photos: remote.photos,
      presets: remote.presets,
      presetsUpdatedAt: remote.presetsUpdatedAt,
      deletedIds: remote.deletedIds
    });
  } catch (err) {
    console.error('Failed to load shared view:', err);
    state.syncError = err.message || 'Could not load shared chore log.';
    showToast(state.syncError);
  } finally {
    state.loading = false;
    renderAll();
  }
}

// Rendering Presets
function renderPresetChips() {
  el.presetChips.innerHTML = '';
  const currentText = el.taskInput.value.trim().toLowerCase();

  for (const preset of state.presets) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-chip';
    if (currentText && currentText === preset.label.toLowerCase()) {
      btn.classList.add('active');
    }
    btn.textContent = `${preset.icon} ${preset.label}`;
    btn.addEventListener('click', () => {
      el.taskInput.value = preset.label;
      state.selectedIcon = preset.icon;
      renderPresetChips();
      el.taskInput.focus();
    });
    el.presetChips.appendChild(btn);
  }
}

function renderPresetManager() {
  el.presetManageList.innerHTML = '';
  if (state.presets.length === 0) {
    const li = document.createElement('li');
    li.className = 'preset-manage-item';
    li.textContent = 'No quick-pick chores yet.';
    el.presetManageList.appendChild(li);
    return;
  }

  for (const preset of state.presets) {
    const li = document.createElement('li');
    li.className = 'preset-manage-item';

    const span = document.createElement('span');
    span.textContent = `${preset.icon} ${preset.label}`;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-action delete';
    delBtn.title = 'Remove preset';
    delBtn.setAttribute('aria-label', `Remove ${preset.label}`);
    delBtn.textContent = '×';
    delBtn.addEventListener('click', async () => {
      state.presets = state.presets.filter((p) => p.id !== preset.id);
      state.presetsUpdatedAt = Date.now();
      await persistLocal();
      renderPresetChips();
      renderPresetManager();
      syncWithGitHub({ pushAfterMerge: true, silent: true });
    });

    li.append(span, delBtn);
    el.presetManageList.appendChild(li);
  }
}

// Filtering
function getFilteredEntries() {
  const now = new Date();
  const todayStart = getStartOfDay(now);
  const weekStart = getStartOfWeek(now);
  const monthStart = getStartOfMonth(now);
  const q = state.search.trim().toLowerCase();

  return state.entries.filter((entry) => {
    if (state.range === 'today' && entry.timestamp < todayStart) return false;
    if (state.range === 'week' && entry.timestamp < weekStart) return false;
    if (state.range === 'month' && entry.timestamp < monthStart) return false;
    if (state.photoOnly && !getEntryPhotoUrl(entry)) return false;
    if (q) {
      const hay = `${entry.title} ${entry.note || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// Stats
function renderStats() {
  const now = new Date();
  const todayStart = getStartOfDay(now);
  const weekStart = getStartOfWeek(now);

  let todayCount = 0;
  let weekCount = 0;
  let photoCount = 0;

  for (const entry of state.entries) {
    if (entry.timestamp >= todayStart) todayCount++;
    if (entry.timestamp >= weekStart) weekCount++;
    if (getEntryPhotoUrl(entry)) photoCount++;
  }

  el.statToday.textContent = String(todayCount);
  el.statWeek.textContent = String(weekCount);
  el.statTotal.textContent = String(state.entries.length);
  el.statPhotos.textContent = String(photoCount);
}

// Timeline
function renderTimeline() {
  el.loadingState.classList.toggle('hidden', !state.loading);
  if (state.loading) {
    el.timelineContainer.innerHTML = '';
    el.emptyState.classList.add('hidden');
    return;
  }

  const filtered = getFilteredEntries();
  el.timelineContainer.innerHTML = '';

  if (filtered.length === 0) {
    el.emptyState.classList.remove('hidden');
    if (state.syncError && isViewerMode) {
      el.emptyTitle.textContent = 'Could not load shared log';
      el.emptyMessage.textContent = state.syncError;
    } else if (state.entries.length === 0) {
      el.emptyTitle.textContent = 'Nothing logged yet';
      el.emptyMessage.textContent = isViewerMode
        ? 'No chores have been logged yet.'
        : 'Log your first completed chore on the left — and connect free GitHub Sync to keep it backed up across your PC and phone forever.';
    } else {
      el.emptyTitle.textContent = 'No matching entries';
      el.emptyMessage.textContent = 'Try switching the date filter or clearing your search.';
    }
    return;
  }

  el.emptyState.classList.add('hidden');

  const groups = new Map();
  for (const entry of filtered) {
    const dayKey = getStartOfDay(new Date(entry.timestamp));
    if (!groups.has(dayKey)) {
      groups.set(dayKey, []);
    }
    groups.get(dayKey).push(entry);
  }

  for (const [dayKey, items] of groups.entries()) {
    const section = document.createElement('div');
    section.className = 'day-group';

    const header = document.createElement('div');
    header.className = 'day-header';

    const title = document.createElement('h3');
    title.className = 'day-title';
    title.textContent = formatDayHeading(dayKey);

    const count = document.createElement('span');
    count.className = 'day-count';
    count.textContent = `${items.length} ${items.length === 1 ? 'task' : 'tasks'}`;

    header.append(title, count);
    section.appendChild(header);

    for (const entry of items) {
      section.appendChild(createEntryCard(entry));
    }

    el.timelineContainer.appendChild(section);
  }
}

function createEntryCard(entry) {
  const card = document.createElement('article');
  card.className = 'entry-card';

  const iconBox = document.createElement('div');
  iconBox.className = 'entry-icon';
  iconBox.textContent = entry.icon || '✅';
  iconBox.setAttribute('aria-hidden', 'true');

  const body = document.createElement('div');
  body.className = 'entry-body';

  const top = document.createElement('div');
  top.className = 'entry-top';

  const title = document.createElement('h4');
  title.className = 'entry-title';
  title.textContent = entry.title;

  top.appendChild(title);

  if (!isViewerMode) {
    const actions = document.createElement('div');
    actions.className = 'entry-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'icon-action';
    editBtn.title = 'Edit entry';
    editBtn.setAttribute('aria-label', 'Edit entry');
    editBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener('click', () => openEditModal(entry));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-action delete';
    delBtn.title = 'Delete entry';
    delBtn.setAttribute('aria-label', 'Delete entry');
    delBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${entry.title}"?`)) return;
      state.entries = state.entries.filter((item) => item.id !== entry.id);
      state.deletedIds[entry.id] = Date.now();
      if (entry.photoFile) {
        state.photos.delete(entry.photoFile);
      }
      await persistLocal();
      renderAll();
      showToast('Entry deleted');
      syncWithGitHub({ pushAfterMerge: true, silent: true });
    });

    actions.append(editBtn, delBtn);
    top.appendChild(actions);
  }

  const meta = document.createElement('div');
  meta.className = 'entry-meta';

  const timeBadge = document.createElement('span');
  timeBadge.className = 'entry-time-badge';
  timeBadge.textContent = formatTime(entry.timestamp);
  timeBadge.title = formatFullDateTime(entry.timestamp);

  const rel = document.createElement('span');
  rel.textContent = `• ${formatRelativeTime(entry.timestamp)}`;

  meta.append(timeBadge, rel);
  body.append(top, meta);

  if (entry.note) {
    const note = document.createElement('p');
    note.className = 'entry-note';
    note.textContent = entry.note;
    body.appendChild(note);
  }

  const photoUrl = getEntryPhotoUrl(entry);
  if (photoUrl) {
    const photoWrap = document.createElement('div');
    photoWrap.className = 'entry-photo-wrap';

    const photoBtn = document.createElement('button');
    photoBtn.type = 'button';
    photoBtn.className = 'entry-photo-btn';
    photoBtn.setAttribute('aria-label', `View photo proof for ${entry.title}`);

    const img = document.createElement('img');
    img.src = photoUrl;
    img.alt = `Proof for ${entry.title}`;
    img.loading = 'lazy';

    const badge = document.createElement('span');
    badge.className = 'photo-badge';
    badge.textContent = '📷 Proof';

    photoBtn.append(img, badge);
    photoBtn.addEventListener('click', () => openLightbox(entry, photoUrl));
    photoWrap.appendChild(photoBtn);
    body.appendChild(photoWrap);
  }

  card.append(iconBox, body);
  return card;
}

function openLightbox(entry, photoUrl) {
  el.lightboxImg.src = photoUrl;
  el.lightboxTitle.textContent = `${entry.icon || '✅'} ${entry.title}`;
  el.lightboxMeta.textContent = `Completed ${formatFullDateTime(entry.timestamp)}${entry.note ? ` — ${entry.note}` : ''}`;
  openModal('lightboxModal');
}

function openEditModal(entry) {
  el.editId.value = entry.id;
  el.editTaskInput.value = entry.title;
  el.editNoteInput.value = entry.note || '';
  el.editTimeInput.value = toLocalDatetimeInputValue(new Date(entry.timestamp));
  openModal('editModal');
  el.editTaskInput.focus();
}

function renderAll() {
  renderSyncUI();
  renderStats();
  renderTimeline();
}

// Photo Handling
async function handlePhotoFile(file) {
  if (!file) return;
  try {
    const compressed = await compressImage(file);
    state.pendingPhoto = compressed;
    el.photoPreviewImg.src = compressed;
    el.dropzoneEmpty.classList.add('hidden');
    el.dropzonePreview.classList.remove('hidden');
  } catch (err) {
    showToast(err.message || 'Could not load photo');
  }
}

function clearPendingPhoto() {
  state.pendingPhoto = null;
  el.photoInput.value = '';
  el.photoPreviewImg.src = '';
  el.dropzonePreview.classList.add('hidden');
  el.dropzoneEmpty.classList.remove('hidden');
}

async function copyText(text, successMsg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg);
  } catch {
    showToast('Could not access clipboard');
  }
}

// Event Listeners
function setupEventListeners() {
  el.createTokenLink.href = GITHUB_TOKEN_CREATE_URL;

  // Viewer mode refresh
  el.btnRefreshView.addEventListener('click', () => loadBrotherView());

  // Open Sync modal
  el.btnSync.addEventListener('click', () => {
    state.syncError = '';
    el.syncTokenInput.value = '';
    renderSyncUI();
    openModal('syncModal');
    if (!state.syncConfig?.gistId) {
      setTimeout(() => el.syncTokenInput.focus(), 40);
    }
  });

  // Quick Share View button in header
  el.btnShareBrother.addEventListener('click', () => {
    const url = getBrotherShareUrl();
    if (!url) {
      showToast('Connect GitHub Sync first to get a share link');
      return;
    }
    copyText(url, "Copied Brother's View Link! (Read-only)");
  });

  // Sync modal buttons
  el.btnCopyTokenPhone.addEventListener('click', () => {
    if (state.syncConfig?.token) {
      copyText(state.syncConfig.token, 'Copied GitHub Sync Token for your phone!');
    }
  });

  el.btnCopyBrotherLink.addEventListener('click', () => {
    const url = getBrotherShareUrl();
    if (url) {
      copyText(url, "Copied Brother's View Link! (Read-only)");
    }
  });

  el.btnSyncNow.addEventListener('click', () => {
    syncWithGitHub({ pushAfterMerge: true, silent: false });
  });

  el.btnSyncDisconnect.addEventListener('click', () => {
    if (!confirm('Sign out of GitHub Sync on this device? Your local chores stay here and your private Gist stays safe on GitHub.')) {
      return;
    }
    state.syncConfig = null;
    state.syncError = '';
    state.remotePhotoFiles = new Set();
    saveSyncConfig(null);
    renderSyncUI();
    showToast('Signed out on this device');
  });

  // Connect GitHub Sync form
  el.syncConnectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = el.syncTokenInput.value.trim();
    if (!token) return;

    state.syncBusy = true;
    state.syncError = '';
    renderSyncUI();

    try {
      const result = await apiGistConnect({
        token,
        localVault: getCurrentVault()
      });

      state.remotePhotoFiles = result.remotePhotoFiles;

      if (!result.created) {
        // Existing vault found! Merge local + remote and push merged back if local added anything
        const merged = mergeVaultStates(getCurrentVault(), result);
        applyVault(merged);
        await persistLocal();

        const pushed = await apiGistPush({
          token,
          gistId: result.gistId,
          version: result.version + 1,
          vault: merged,
          remotePhotoFiles: state.remotePhotoFiles
        });
        state.remotePhotoFiles = pushed.remotePhotoFiles;

        state.syncConfig = {
          token,
          username: result.username,
          gistId: result.gistId,
          gistUrl: pushed.gistUrl,
          version: pushed.version,
          lastSyncedAt: Date.now()
        };
      } else {
        state.syncConfig = {
          token,
          username: result.username,
          gistId: result.gistId,
          gistUrl: result.gistUrl,
          version: 1,
          lastSyncedAt: Date.now()
        };
      }

      saveSyncConfig(state.syncConfig);
      el.syncTokenInput.value = '';
      renderPresetChips();
      renderAll();
      showToast(
        result.created
          ? `Connected as @${result.username}! Private vault created`
          : `Connected as @${result.username}! Chores synced`
      );
    } catch (err) {
      console.error('GitHub Sync connect failed:', err);
      state.syncError = err.message || 'Could not connect to GitHub.';
    } finally {
      state.syncBusy = false;
      renderSyncUI();
    }
  });

  // Task input & custom time
  el.taskInput.addEventListener('input', () => {
    const matched = state.presets.find(
      (p) => p.label.toLowerCase() === el.taskInput.value.trim().toLowerCase()
    );
    state.selectedIcon = matched ? matched.icon : '✅';
    renderPresetChips();
  });

  el.customTimeToggle.addEventListener('change', () => {
    const useCustom = el.customTimeToggle.checked;
    el.customTimeWrap.classList.toggle('hidden', !useCustom);
    el.autoTimeHint.classList.toggle('hidden', useCustom);
    if (useCustom && !el.customTimeInput.value) {
      el.customTimeInput.value = toLocalDatetimeInputValue(new Date());
    }
  });

  // Photo dropzone
  el.photoDropzone.addEventListener('click', (e) => {
    if (e.target.closest('#btnRemovePhoto')) return;
    el.photoInput.click();
  });

  el.photoDropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.photoInput.click();
    }
  });

  el.photoInput.addEventListener('change', () => {
    const file = el.photoInput.files?.[0];
    if (file) handlePhotoFile(file);
  });

  el.btnRemovePhoto.addEventListener('click', (e) => {
    e.stopPropagation();
    clearPendingPhoto();
  });

  el.photoDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.photoDropzone.classList.add('drag-over');
  });

  el.photoDropzone.addEventListener('dragleave', () => {
    el.photoDropzone.classList.remove('drag-over');
  });

  el.photoDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.photoDropzone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) handlePhotoFile(file);
  });

  // Submit new entry
  el.logForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = el.taskInput.value.trim();
    if (!title) {
      el.taskInput.focus();
      showToast('Please enter what you did');
      return;
    }

    let timestamp = Date.now();
    if (el.customTimeToggle.checked && el.customTimeInput.value) {
      const parsed = new Date(el.customTimeInput.value).getTime();
      if (!Number.isNaN(parsed)) timestamp = parsed;
    }

    const id = crypto.randomUUID
      ? crypto.randomUUID()
      : `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    let photoFile = null;
    if (state.pendingPhoto) {
      photoFile = makePhotoFileName(id);
      state.photos.set(photoFile, state.pendingPhoto);
    }

    const entry = {
      id,
      title,
      note: el.noteInput.value.trim(),
      icon: state.selectedIcon || '✅',
      timestamp,
      updatedAt: Date.now(),
      photoFile
    };

    state.entries.unshift(entry);
    state.entries.sort((a, b) => b.timestamp - a.timestamp);
    await persistLocal();

    // Reset form
    el.taskInput.value = '';
    el.noteInput.value = '';
    state.selectedIcon = '✅';
    el.customTimeToggle.checked = false;
    el.customTimeWrap.classList.add('hidden');
    el.autoTimeHint.classList.remove('hidden');
    el.customTimeInput.value = '';
    clearPendingPhoto();
    renderPresetChips();
    renderAll();

    showToast(
      state.syncConfig?.gistId
        ? 'Logged & syncing to GitHub!'
        : 'Logged! Connect ☁️ Sync to back up across devices'
    );
    syncWithGitHub({ pushAfterMerge: true, silent: true });
  });

  // Edit entry submit
  el.editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = el.editId.value;
    const entry = state.entries.find((item) => item.id === id);
    if (!entry) return;

    const newTitle = el.editTaskInput.value.trim();
    if (!newTitle) return;

    const newTs = new Date(el.editTimeInput.value).getTime();
    const updated = {
      ...entry,
      title: newTitle,
      note: el.editNoteInput.value.trim(),
      timestamp: Number.isNaN(newTs) ? entry.timestamp : newTs,
      updatedAt: Date.now()
    };

    state.entries = state.entries.map((item) => (item.id === id ? updated : item));
    state.entries.sort((a, b) => b.timestamp - a.timestamp);
    await persistLocal();
    closeModal('editModal');
    renderAll();
    showToast('Entry updated');
    syncWithGitHub({ pushAfterMerge: true, silent: true });
  });

  // Filters
  el.filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      el.filterTabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.range = tab.dataset.range;
      renderTimeline();
    });
  });

  el.searchInput.addEventListener('input', () => {
    state.search = el.searchInput.value;
    renderTimeline();
  });

  el.photoOnlyToggle.addEventListener('change', () => {
    state.photoOnly = el.photoOnlyToggle.checked;
    renderTimeline();
  });

  // Manage Presets
  el.btnManagePresets.addEventListener('click', () => {
    renderPresetManager();
    openModal('presetsModal');
    el.newPresetLabel.focus();
  });

  el.addPresetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = el.newPresetLabel.value.trim();
    const icon = el.newPresetIcon.value.trim() || '✅';
    if (!label) return;

    state.presets.push({
      id: `preset-${Date.now()}`,
      icon,
      label
    });
    state.presetsUpdatedAt = Date.now();
    await persistLocal();
    el.newPresetLabel.value = '';
    el.newPresetIcon.value = '✅';
    renderPresetChips();
    renderPresetManager();
    showToast('Added quick-pick chore');
    syncWithGitHub({ pushAfterMerge: true, silent: true });
  });

  el.btnResetPresets.addEventListener('click', async () => {
    state.presets = [...DEFAULT_PRESETS];
    state.presetsUpdatedAt = Date.now();
    await persistLocal();
    renderPresetChips();
    renderPresetManager();
    showToast('Defaults restored');
    syncWithGitHub({ pushAfterMerge: true, silent: true });
  });

  // Copy Summary
  el.btnCopySummary.addEventListener('click', () => {
    const filtered = getFilteredEntries();
    if (filtered.length === 0) {
      showToast('Nothing to copy yet');
      return;
    }

    const lines = ['✅ What I Have Done:', ''];
    for (const entry of filtered) {
      const when = formatFullDateTime(entry.timestamp);
      const photoTag = getEntryPhotoUrl(entry) ? ' [📷 Photo proof]' : '';
      lines.push(`• ${entry.icon || '✅'} ${entry.title} — ${when}${photoTag}`);
      if (entry.note) {
        lines.push(`  Note: ${entry.note}`);
      }
    }

    copyText(lines.join('\n'), `Copied ${filtered.length} ${filtered.length === 1 ? 'item' : 'items'} to clipboard`);
  });

  // Backup / Restore
  el.btnBackup.addEventListener('click', () => openModal('backupModal'));

  el.btnExportJson.addEventListener('click', () => {
    const exportedEntries = state.entries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      note: entry.note,
      icon: entry.icon,
      timestamp: entry.timestamp,
      updatedAt: entry.updatedAt,
      photo: getEntryPhotoUrl(entry)
    }));

    const payload = {
      app: 'DoneLog',
      exportedAt: new Date().toISOString(),
      presets: state.presets,
      entries: exportedEntries
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `donelog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded');
  });

  el.importJsonInput.addEventListener('change', async () => {
    const file = el.importJsonInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.entries)) {
        throw new Error('Invalid backup file');
      }
      if (!confirm(`Restore ${data.entries.length} entries? This will replace your current list.`)) {
        el.importJsonInput.value = '';
        return;
      }

      const nextPhotos = new Map();
      const nextEntries = [];
      const now = Date.now();
      for (const raw of data.entries) {
        if (!raw || !raw.title) continue;
        const id = String(raw.id || `entry-${now}-${Math.random().toString(16).slice(2)}`);
        let photoFile = null;
        if (typeof raw.photo === 'string' && raw.photo.startsWith('data:image/')) {
          photoFile = makePhotoFileName(id);
          nextPhotos.set(photoFile, raw.photo);
        }
        nextEntries.push({
          id,
          title: String(raw.title).trim().slice(0, 120),
          note: String(raw.note || '').trim().slice(0, 300),
          icon: String(raw.icon || '✅').trim().slice(0, 8) || '✅',
          timestamp: Number(raw.timestamp) || now,
          updatedAt: now,
          photoFile
        });
      }
      nextEntries.sort((a, b) => b.timestamp - a.timestamp);

      // Mark replaced old entries as deleted so merge doesn't resurrect them
      const nextIds = new Set(nextEntries.map((x) => x.id));
      for (const old of state.entries) {
        if (!nextIds.has(old.id)) {
          state.deletedIds[old.id] = now;
        }
      }
      for (const id of nextIds) {
        delete state.deletedIds[id];
      }

      state.entries = nextEntries;
      state.photos = nextPhotos;
      if (Array.isArray(data.presets) && data.presets.length > 0) {
        state.presets = data.presets;
        state.presetsUpdatedAt = now;
      }

      await persistLocal();
      renderPresetChips();
      renderAll();
      closeModal('backupModal');
      showToast('Backup restored!');
      syncWithGitHub({ pushAfterMerge: true, silent: true });
    } catch {
      showToast('Invalid backup file');
    } finally {
      el.importJsonInput.value = '';
    }
  });

  // Auto-pull when returning to tab on PC or Phone
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (isViewerMode) return;
    if (!state.syncConfig?.gistId) return;
    if (Date.now() - state.lastFocusPullAt < 20000) return;
    state.lastFocusPullAt = Date.now();
    syncWithGitHub({ pushAfterMerge: false, silent: true });
  });
}

// Init
async function init() {
  updateLiveClock();
  setInterval(updateLiveClock, 15000);
  setupEventListeners();

  if (isViewerMode) {
    await loadBrotherView();
    return;
  }

  const local = await loadLocalVault();
  applyVault(local);
  renderPresetChips();
  renderAll();

  if (state.syncConfig?.token && state.syncConfig?.gistId) {
    state.lastFocusPullAt = Date.now();
    syncWithGitHub({ pushAfterMerge: false, silent: true });
  }
}

init();
