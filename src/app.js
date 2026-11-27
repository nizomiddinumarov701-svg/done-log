import {
  DEFAULT_MEMBERS,
  DEFAULT_PRESETS,
  loadLocalVault,
  saveLocalVault,
  loadSyncConfig,
  saveSyncConfig,
  loadSavedTheme,
  saveTheme,
  loadStampPref,
  saveStampPref,
  compressImage,
  applyTimestampWatermark
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
import {
  DEFAULT_PRESET_LABELS,
  TRANSLATIONS,
  loadSavedLang,
  saveLang,
  getLocale,
  getPresetDisplayLabel,
  formatCountLabel
} from './i18n.js';

const viewGistId = new URLSearchParams(window.location.search).get('view')?.trim() || '';
const isViewerMode = Boolean(viewGistId);

// State
const state = {
  entries: [],
  photos: new Map(), // photoFile -> dataUrl
  presets: [...DEFAULT_PRESETS],
  presetsUpdatedAt: 0,
  members: { ...DEFAULT_MEMBERS },
  membersUpdatedAt: 0,
  deletedIds: {},
  remotePhotoFiles: new Set(),

  syncConfig: isViewerMode ? null : loadSyncConfig(),
  syncBusy: false,
  syncError: '',
  lastFocusPullAt: 0,

  theme: loadSavedTheme(),
  lang: loadSavedLang(),
  stampEnabled: loadStampPref(),

  loading: false,
  selectedDoneBy: 'me',
  editDoneBy: 'me',
  selectedIcon: '✅',

  // Clean compressed originals + stamped/rendered versions for live preview
  pendingBeforeClean: null,
  pendingAfterClean: null,
  pendingBeforeFinal: null,
  pendingAfterFinal: null,

  scorePeriod: 'week', // 'today' | 'week' | 'all'
  range: 'all',
  whoFilter: 'all', // 'all' | 'me' | 'brother'
  search: '',
  photoOnly: false,

  // Active lightbox entry
  lightboxEntry: null,
  lightboxSlot: 'after'
};

// DOM references
const el = {
  themeColorMeta: document.getElementById('themeColorMeta'),
  brandSubtitle: document.getElementById('brandSubtitle'),
  syncPill: document.getElementById('syncPill'),
  btnLangToggle: document.getElementById('btnLangToggle'),
  langToggleLabel: document.getElementById('langToggleLabel'),
  btnThemeToggle: document.getElementById('btnThemeToggle'),
  themeToggleIcon: document.getElementById('themeToggleIcon'),
  btnSync: document.getElementById('btnSync'),
  btnSyncLabel: document.getElementById('btnSyncLabel'),
  btnShareBrother: document.getElementById('btnShareBrother'),
  btnShareLabel: document.getElementById('btnShareLabel'),
  btnCopySummary: document.getElementById('btnCopySummary'),
  btnCopyLabel: document.getElementById('btnCopyLabel'),
  btnBackup: document.getElementById('btnBackup'),
  btnBackupLabel: document.getElementById('btnBackupLabel'),

  // Scoreboard & Turns
  scoreboardTitle: document.getElementById('scoreboardTitle'),
  btnEditNames: document.getElementById('btnEditNames'),
  periodPills: document.querySelectorAll('.period-pill'),
  periodTodayBtn: document.getElementById('periodTodayBtn'),
  periodWeekBtn: document.getElementById('periodWeekBtn'),
  periodAllBtn: document.getElementById('periodAllBtn'),
  scoreNameMe: document.getElementById('scoreNameMe'),
  scoreNameBrother: document.getElementById('scoreNameBrother'),
  scoreCountMe: document.getElementById('scoreCountMe'),
  scoreCountBrother: document.getElementById('scoreCountBrother'),
  fairnessVerdict: document.getElementById('fairnessVerdict'),
  fairnessFillMe: document.getElementById('fairnessFillMe'),
  fairnessFillBrother: document.getElementById('fairnessFillBrother'),
  fairnessPctMe: document.getElementById('fairnessPctMe'),
  fairnessPctBrother: document.getElementById('fairnessPctBrother'),
  whoseTurnTitle: document.getElementById('whoseTurnTitle'),
  turnsGrid: document.getElementById('turnsGrid'),

  // Stats
  statTodayLabel: document.getElementById('statTodayLabel'),
  statWeekLabel: document.getElementById('statWeekLabel'),
  statTotalLabel: document.getElementById('statTotalLabel'),
  statPhotosLabel: document.getElementById('statPhotosLabel'),
  statToday: document.getElementById('statToday'),
  statWeek: document.getElementById('statWeek'),
  statTotal: document.getElementById('statTotal'),
  statPhotos: document.getElementById('statPhotos'),

  // Composer & Viewer
  composerAnchor: document.getElementById('composerAnchor'),
  viewerCard: document.getElementById('viewerCard'),
  viewerBadge: document.getElementById('viewerBadge'),
  viewerTitle: document.getElementById('viewerTitle'),
  viewerDesc: document.getElementById('viewerDesc'),
  btnRefreshView: document.getElementById('btnRefreshView'),
  btnExitView: document.getElementById('btnExitView'),

  composerCard: document.getElementById('composerCard'),
  logHeading: document.getElementById('logHeading'),
  liveClock: document.getElementById('liveClock'),
  whoDidItLabel: document.getElementById('whoDidItLabel'),
  whoBtns: document.querySelectorAll('[data-done-by]'),
  whoMeLabel: document.getElementById('whoMeLabel'),
  whoBrotherLabel: document.getElementById('whoBrotherLabel'),
  quickPickLabel: document.getElementById('quickPickLabel'),
  presetChips: document.getElementById('presetChips'),
  btnManagePresets: document.getElementById('btnManagePresets'),
  logForm: document.getElementById('logForm'),
  taskLabelText: document.getElementById('taskLabelText'),
  taskInput: document.getElementById('taskInput'),
  noteLabelText: document.getElementById('noteLabelText'),
  noteOptionalText: document.getElementById('noteOptionalText'),
  noteInput: document.getElementById('noteInput'),
  whenLabelText: document.getElementById('whenLabelText'),
  customTimeToggle: document.getElementById('customTimeToggle'),
  customTimeLabel: document.getElementById('customTimeLabel'),
  customTimeWrap: document.getElementById('customTimeWrap'),
  customTimeInput: document.getElementById('customTimeInput'),
  autoTimeHint: document.getElementById('autoTimeHint'),
  photosLabelText: document.getElementById('photosLabelText'),
  photosOptionalText: document.getElementById('photosOptionalText'),
  beforeSlotLabel: document.getElementById('beforeSlotLabel'),
  afterSlotLabel: document.getElementById('afterSlotLabel'),
  beforeDropzone: document.getElementById('beforeDropzone'),
  beforePhotoInput: document.getElementById('beforePhotoInput'),
  beforeEmpty: document.getElementById('beforeEmpty'),
  beforeTapHint: document.getElementById('beforeTapHint'),
  beforePreview: document.getElementById('beforePreview'),
  beforePreviewImg: document.getElementById('beforePreviewImg'),
  btnRemoveBefore: document.getElementById('btnRemoveBefore'),
  afterDropzone: document.getElementById('afterDropzone'),
  afterPhotoInput: document.getElementById('afterPhotoInput'),
  afterEmpty: document.getElementById('afterEmpty'),
  afterTapHint: document.getElementById('afterTapHint'),
  afterPreview: document.getElementById('afterPreview'),
  afterPreviewImg: document.getElementById('afterPreviewImg'),
  btnRemoveAfter: document.getElementById('btnRemoveAfter'),
  stampPhotoToggle: document.getElementById('stampPhotoToggle'),
  stampToggleLabel: document.getElementById('stampToggleLabel'),
  btnSubmitLog: document.getElementById('btnSubmitLog'),
  btnSubmitLabel: document.getElementById('btnSubmitLabel'),

  // History
  filterTabs: document.querySelectorAll('.filter-tab'),
  tabAll: document.getElementById('tabAll'),
  tabToday: document.getElementById('tabToday'),
  tabWeek: document.getElementById('tabWeek'),
  tabMonth: document.getElementById('tabMonth'),
  whoFilterTabs: document.querySelectorAll('.who-filter-tab'),
  whoFilterAll: document.getElementById('whoFilterAll'),
  whoFilterMe: document.getElementById('whoFilterMe'),
  whoFilterBrother: document.getElementById('whoFilterBrother'),
  searchInput: document.getElementById('searchInput'),
  photoOnlyToggle: document.getElementById('photoOnlyToggle'),
  withPhotoLabel: document.getElementById('withPhotoLabel'),
  loadingState: document.getElementById('loadingState'),
  loadingTitle: document.getElementById('loadingTitle'),
  loadingDesc: document.getElementById('loadingDesc'),
  timelineContainer: document.getElementById('timelineContainer'),
  emptyState: document.getElementById('emptyState'),
  emptyTitle: document.getElementById('emptyTitle'),
  emptyMessage: document.getElementById('emptyMessage'),

  mobileFab: document.getElementById('mobileFab'),
  mobileFabLabel: document.getElementById('mobileFabLabel'),

  // Names modal
  namesModal: document.getElementById('namesModal'),
  namesModalTitle: document.getElementById('namesModalTitle'),
  namesModalDesc: document.getElementById('namesModalDesc'),
  namesForm: document.getElementById('namesForm'),
  myNameLabel: document.getElementById('myNameLabel'),
  myNameInput: document.getElementById('myNameInput'),
  brotherNameLabel: document.getElementById('brotherNameLabel'),
  brotherNameInput: document.getElementById('brotherNameInput'),
  btnCancelNames: document.getElementById('btnCancelNames'),
  btnSaveNames: document.getElementById('btnSaveNames'),

  // Sync modal
  syncModal: document.getElementById('syncModal'),
  syncModalTitle: document.getElementById('syncModalTitle'),
  syncConnectedPanel: document.getElementById('syncConnectedPanel'),
  syncSetupPanel: document.getElementById('syncSetupPanel'),
  syncConnectedUser: document.getElementById('syncConnectedUser'),
  syncLastTime: document.getElementById('syncLastTime'),
  btnCopyTokenPhone: document.getElementById('btnCopyTokenPhone'),
  btnCopyBrotherLink: document.getElementById('btnCopyBrotherLink'),
  syncGistLink: document.getElementById('syncGistLink'),
  syncConnectedError: document.getElementById('syncConnectedError'),
  syncPhoneHeading: document.getElementById('syncPhoneHeading'),
  syncPhoneBody: document.getElementById('syncPhoneBody'),
  syncBrotherHeading: document.getElementById('syncBrotherHeading'),
  syncBrotherBody: document.getElementById('syncBrotherBody'),
  btnSyncDisconnect: document.getElementById('btnSyncDisconnect'),
  btnSyncNow: document.getElementById('btnSyncNow'),
  syncSetupDesc: document.getElementById('syncSetupDesc'),
  syncStep1Title: document.getElementById('syncStep1Title'),
  createTokenLink: document.getElementById('createTokenLink'),
  syncStep1Hint: document.getElementById('syncStep1Hint'),
  syncStep2Title: document.getElementById('syncStep2Title'),
  syncStep2Hint: document.getElementById('syncStep2Hint'),
  syncSetupError: document.getElementById('syncSetupError'),
  syncConnectForm: document.getElementById('syncConnectForm'),
  tokenLabelText: document.getElementById('tokenLabelText'),
  tokenScopeHint: document.getElementById('tokenScopeHint'),
  syncTokenInput: document.getElementById('syncTokenInput'),
  tokenPrivacyHint: document.getElementById('tokenPrivacyHint'),
  btnCancelSync: document.getElementById('btnCancelSync'),
  btnSyncConnect: document.getElementById('btnSyncConnect'),

  // Lightbox
  lightboxModal: document.getElementById('lightboxModal'),
  lightboxTabs: document.getElementById('lightboxTabs'),
  lightboxTabBefore: document.getElementById('lightboxTabBefore'),
  lightboxTabAfter: document.getElementById('lightboxTabAfter'),
  lightboxImg: document.getElementById('lightboxImg'),
  lightboxTitle: document.getElementById('lightboxTitle'),
  lightboxMeta: document.getElementById('lightboxMeta'),

  // Edit modal
  editModal: document.getElementById('editModal'),
  editModalTitle: document.getElementById('editModalTitle'),
  editForm: document.getElementById('editForm'),
  editId: document.getElementById('editId'),
  editWhoLabel: document.getElementById('editWhoLabel'),
  editWhoBtns: document.querySelectorAll('[data-edit-done-by]'),
  editWhoMeLabel: document.getElementById('editWhoMeLabel'),
  editWhoBrotherLabel: document.getElementById('editWhoBrotherLabel'),
  editTaskLabel: document.getElementById('editTaskLabel'),
  editTaskInput: document.getElementById('editTaskInput'),
  editNoteLabel: document.getElementById('editNoteLabel'),
  editNoteInput: document.getElementById('editNoteInput'),
  editTimeLabel: document.getElementById('editTimeLabel'),
  editTimeInput: document.getElementById('editTimeInput'),
  btnCancelEdit: document.getElementById('btnCancelEdit'),
  btnSaveEdit: document.getElementById('btnSaveEdit'),

  // Presets modal
  presetsModal: document.getElementById('presetsModal'),
  presetsModalTitle: document.getElementById('presetsModalTitle'),
  addPresetForm: document.getElementById('addPresetForm'),
  newPresetIcon: document.getElementById('newPresetIcon'),
  newPresetLabel: document.getElementById('newPresetLabel'),
  btnAddPreset: document.getElementById('btnAddPreset'),
  presetManageList: document.getElementById('presetManageList'),
  btnResetPresets: document.getElementById('btnResetPresets'),
  btnPresetsDone: document.getElementById('btnPresetsDone'),

  // Backup modal
  backupModal: document.getElementById('backupModal'),
  backupModalTitle: document.getElementById('backupModalTitle'),
  backupModalDesc: document.getElementById('backupModalDesc'),
  btnExportJson: document.getElementById('btnExportJson'),
  restoreBackupLabel: document.getElementById('restoreBackupLabel'),
  restoreBackupText: document.getElementById('restoreBackupText'),
  importJsonInput: document.getElementById('importJsonInput'),

  toast: document.getElementById('toast')
};

function t() {
  return TRANSLATIONS[state.lang] || TRANSLATIONS.en;
}

function getMemberName(role) {
  const dict = t();
  if (role === 'brother') {
    return state.members.brother || dict.brotherNameDefault;
  }
  return state.members.me || dict.myNameDefault;
}

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

// Theme & Language
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  el.themeToggleIcon.textContent = state.theme === 'dark' ? '☀️' : '🌙';
  el.themeColorMeta.setAttribute('content', state.theme === 'dark' ? '#0b1120' : '#0d9488');
}

function applyLanguage() {
  const dict = t();
  document.documentElement.lang = state.lang;
  el.langToggleLabel.textContent = state.lang.toUpperCase();

  el.brandSubtitle.textContent = dict.subtitle;
  el.btnShareLabel.textContent = dict.btnShareView;
  el.btnCopyLabel.textContent = dict.btnCopyList;
  el.btnBackupLabel.textContent = dict.btnBackup;

  el.scoreboardTitle.textContent = `🔄 ${dict.scoreboardTitle}`;
  el.btnEditNames.textContent = `✏️ ${dict.editNames}`;
  el.periodTodayBtn.textContent = dict.periodToday;
  el.periodWeekBtn.textContent = dict.periodWeek;
  el.periodAllBtn.textContent = dict.periodAll;
  el.whoseTurnTitle.textContent = dict.whoseTurnTitle;

  el.statTodayLabel.textContent = dict.statToday;
  el.statWeekLabel.textContent = dict.statWeek;
  el.statTotalLabel.textContent = dict.statTotal;
  el.statPhotosLabel.textContent = dict.statPhotos;

  el.viewerBadge.textContent = dict.viewerBadge;
  el.viewerTitle.textContent = dict.viewerTitle;
  el.viewerDesc.textContent = dict.viewerDesc;
  el.btnRefreshView.textContent = dict.btnRefreshView;
  el.btnExitView.textContent = dict.btnExitView;

  el.logHeading.textContent = dict.logHeading;
  el.whoDidItLabel.textContent = dict.whoDidIt;
  el.quickPickLabel.textContent = dict.quickPick;
  el.btnManagePresets.textContent = dict.editList;
  el.taskLabelText.textContent = dict.taskLabel;
  el.taskInput.placeholder = dict.taskPlaceholder;
  el.noteLabelText.textContent = dict.noteLabel;
  el.noteOptionalText.textContent = dict.optional;
  el.noteInput.placeholder = dict.notePlaceholder;
  el.whenLabelText.textContent = dict.whenLabel;
  el.customTimeLabel.textContent = dict.customTime;
  el.autoTimeHint.textContent = dict.autoTimeHint;
  el.photosLabelText.textContent = dict.photosLabel;
  el.photosOptionalText.textContent = dict.optional;
  el.beforeSlotLabel.textContent = dict.beforeSlot;
  el.afterSlotLabel.textContent = dict.afterSlot;
  el.beforeTapHint.textContent = dict.photoTapHint;
  el.afterTapHint.textContent = dict.photoTapHint;
  el.stampToggleLabel.textContent = dict.stampToggle;
  el.btnSubmitLabel.textContent = dict.btnMarkDone;
  el.mobileFabLabel.textContent = dict.fabLog;

  el.tabAll.textContent = dict.filterAll;
  el.tabToday.textContent = dict.filterToday;
  el.tabWeek.textContent = dict.filterWeek;
  el.tabMonth.textContent = dict.filterMonth;
  el.whoFilterAll.textContent = dict.whoAll;
  el.searchInput.placeholder = dict.searchPlaceholder;
  el.withPhotoLabel.textContent = dict.withPhoto;
  el.loadingTitle.textContent = dict.loadingTitle;
  el.loadingDesc.textContent = dict.loadingDesc;

  // Modals
  el.namesModalTitle.textContent = dict.namesModalTitle;
  el.namesModalDesc.textContent = dict.namesModalDesc;
  el.myNameLabel.textContent = dict.myNameLabel;
  el.myNameInput.placeholder = dict.myNameDefault;
  el.brotherNameLabel.textContent = dict.brotherNameLabel;
  el.brotherNameInput.placeholder = dict.brotherNameDefault;
  el.btnCancelNames.textContent = dict.cancel;
  el.btnSaveNames.textContent = dict.saveChanges;

  el.syncModalTitle.textContent = dict.syncModalTitle;
  el.btnCopyTokenPhone.textContent = dict.copyTokenPhone;
  el.btnCopyBrotherLink.textContent = dict.copyBrotherLink;
  el.syncGistLink.textContent = dict.privateGist;
  el.syncPhoneHeading.textContent = dict.syncPhoneHeading;
  el.syncPhoneBody.textContent = dict.syncPhoneBody;
  el.syncBrotherHeading.textContent = dict.syncBrotherHeading;
  el.syncBrotherBody.textContent = dict.syncBrotherBody;
  el.btnSyncDisconnect.textContent = dict.signOutDevice;
  el.syncSetupDesc.textContent = dict.syncSetupDesc;
  el.syncStep1Title.textContent = dict.syncStep1Title;
  el.createTokenLink.textContent = dict.createTokenBtn;
  el.syncStep1Hint.textContent = dict.syncStep1Hint;
  el.syncStep2Title.textContent = dict.syncStep2Title;
  el.syncStep2Hint.textContent = dict.syncStep2Hint;
  el.tokenLabelText.textContent = dict.tokenLabel;
  el.tokenScopeHint.textContent = dict.tokenScopeHint;
  el.tokenPrivacyHint.textContent = dict.tokenPrivacy;
  el.btnCancelSync.textContent = dict.cancel;

  el.lightboxTabBefore.textContent = dict.lightboxBefore;
  el.lightboxTabAfter.textContent = dict.lightboxAfter;

  el.editModalTitle.textContent = dict.editModalTitle;
  el.editWhoLabel.textContent = dict.whoDidIt;
  el.editTaskLabel.textContent = dict.taskLabel;
  el.editNoteLabel.textContent = dict.noteLabel;
  el.editTimeLabel.textContent = dict.dateTimeLabel;
  el.btnCancelEdit.textContent = dict.cancel;
  el.btnSaveEdit.textContent = dict.saveChanges;

  el.presetsModalTitle.textContent = dict.presetsModalTitle;
  el.newPresetLabel.placeholder = dict.presetPlaceholder;
  el.btnAddPreset.textContent = dict.add;
  el.btnResetPresets.textContent = dict.resetDefaults;
  el.btnPresetsDone.textContent = dict.done;

  el.backupModalTitle.textContent = dict.backupModalTitle;
  el.backupModalDesc.textContent = dict.backupModalDesc;
  el.btnExportJson.textContent = dict.downloadBackup;
  el.restoreBackupText.textContent = dict.restoreBackup;

  updateLiveClock();
  renderMemberLabels();
  renderPresetChips();
  renderAll();
}

function renderMemberLabels() {
  const me = getMemberName('me');
  const bro = getMemberName('brother');
  el.scoreNameMe.textContent = me;
  el.scoreNameBrother.textContent = bro;
  el.whoMeLabel.textContent = me;
  el.whoBrotherLabel.textContent = bro;
  el.editWhoMeLabel.textContent = me;
  el.editWhoBrotherLabel.textContent = bro;
  el.whoFilterMe.textContent = `🙋 ${me}`;
  el.whoFilterBrother.textContent = `👦 ${bro}`;
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
  return new Date(ts).toLocaleTimeString(getLocale(state.lang), { hour: 'numeric', minute: '2-digit' });
}

function formatFullDateTime(ts) {
  return new Date(ts).toLocaleString(getLocale(state.lang), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatDayHeading(ts) {
  const dict = t();
  const date = new Date(ts);
  const now = new Date();
  const entryDay = getStartOfDay(date);
  const today = getStartOfDay(now);
  const yesterday = today - 86400000;

  if (entryDay === today) return dict.today;
  if (entryDay === yesterday) return dict.yesterday;

  return date.toLocaleDateString(getLocale(state.lang), {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function formatRelativeTime(ts) {
  const dict = t();
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return dict.scheduled;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return dict.justNow;
  if (mins < 60) return state.lang === 'ru' ? `${mins}м назад` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return state.lang === 'ru' ? `${hours}ч назад` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return state.lang === 'ru' ? `${days}д назад` : `${days}d ago`;
  return new Date(ts).toLocaleDateString(getLocale(state.lang), { month: 'short', day: 'numeric' });
}

function updateLiveClock() {
  const now = new Date();
  el.liveClock.textContent = now.toLocaleString(getLocale(state.lang), {
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

function getEntryPhotos(entry) {
  return {
    before: entry?.beforePhotoFile ? state.photos.get(entry.beforePhotoFile) || null : null,
    after: entry?.photoFile ? state.photos.get(entry.photoFile) || null : null
  };
}

function entryHasAnyPhoto(entry) {
  const p = getEntryPhotos(entry);
  return Boolean(p.before || p.after);
}

// Normalize chore title across EN/RU built-in presets so turn tracking unites both languages
function getChoreCanonicalKey(title) {
  const norm = String(title || '').trim().toLowerCase();
  for (const id of Object.keys(DEFAULT_PRESET_LABELS.en)) {
    if (
      norm === DEFAULT_PRESET_LABELS.en[id].toLowerCase() ||
      norm === DEFAULT_PRESET_LABELS.ru[id].toLowerCase()
    ) {
      return `builtin:${id}`;
    }
  }
  return `custom:${norm}`;
}

function getChoreDisplayTitle(canonicalKey, fallbackTitle) {
  if (canonicalKey.startsWith('builtin:')) {
    const id = canonicalKey.slice('builtin:'.length);
    const translated = DEFAULT_PRESET_LABELS[state.lang]?.[id];
    if (translated) return translated;
  }
  return fallbackTitle;
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
    ['namesModal', 'syncModal', 'lightboxModal', 'editModal', 'presetsModal', 'backupModal'].forEach(
      closeModal
    );
  }
  if (!el.lightboxModal.classList.contains('hidden') && state.lightboxEntry) {
    if (e.key === 'ArrowLeft') switchLightboxSlot('before');
    if (e.key === 'ArrowRight') switchLightboxSlot('after');
  }
});

// Local persistence helper
function getCurrentVault() {
  return {
    entries: state.entries,
    photos: state.photos,
    presets: state.presets,
    presetsUpdatedAt: state.presetsUpdatedAt,
    members: state.members,
    membersUpdatedAt: state.membersUpdatedAt,
    deletedIds: state.deletedIds
  };
}

function applyVault(vault) {
  state.entries = vault.entries;
  state.photos = vault.photos;
  state.presets = vault.presets;
  state.presetsUpdatedAt = vault.presetsUpdatedAt;
  state.members = vault.members || { ...DEFAULT_MEMBERS };
  state.membersUpdatedAt = Number(vault.membersUpdatedAt) || 0;
  state.deletedIds = vault.deletedIds;
}

async function persistLocal() {
  if (isViewerMode) return;
  await saveLocalVault(getCurrentVault());
}

// Composer Who Selector
function setComposerDoneBy(role) {
  state.selectedDoneBy = role === 'brother' ? 'brother' : 'me';
  el.whoBtns.forEach((btn) => {
    const active = btn.dataset.doneBy === state.selectedDoneBy;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', String(active));
  });
}

function setEditDoneBy(role) {
  state.editDoneBy = role === 'brother' ? 'brother' : 'me';
  el.editWhoBtns.forEach((btn) => {
    const active = btn.dataset.editDoneBy === state.editDoneBy;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', String(active));
  });
}

// Scoreboard & Whose Turn Is Next
function renderScoreboard() {
  const dict = t();
  const now = new Date();
  const todayStart = getStartOfDay(now);
  const weekStart = getStartOfWeek(now);

  let meCount = 0;
  let brotherCount = 0;

  for (const entry of state.entries) {
    if (state.scorePeriod === 'today' && entry.timestamp < todayStart) continue;
    if (state.scorePeriod === 'week' && entry.timestamp < weekStart) continue;
    if (entry.doneBy === 'brother') brotherCount++;
    else meCount++;
  }

  const total = meCount + brotherCount;
  const mePct = total > 0 ? Math.round((meCount / total) * 100) : 50;
  const broPct = total > 0 ? 100 - mePct : 50;

  el.scoreCountMe.textContent = String(meCount);
  el.scoreCountBrother.textContent = String(brotherCount);
  el.fairnessFillMe.style.width = `${mePct}%`;
  el.fairnessFillBrother.style.width = `${broPct}%`;
  el.fairnessPctMe.textContent = `${mePct}%`;
  el.fairnessPctBrother.textContent = `${broPct}%`;

  const meName = getMemberName('me');
  const broName = getMemberName('brother');

  if (total === 0) {
    el.fairnessVerdict.textContent = dict.turnsNone;
  } else if (meCount === brotherCount) {
    el.fairnessVerdict.textContent = dict.turnsEven;
  } else if (meCount > brotherCount) {
    el.fairnessVerdict.textContent = dict.aheadBy(meName, broName, meCount - brotherCount);
  } else {
    el.fairnessVerdict.textContent = dict.aheadBy(broName, meName, brotherCount - meCount);
  }

  el.btnEditNames.classList.toggle('hidden', isViewerMode);
  renderWhoseTurn();
}

function renderWhoseTurn() {
  const dict = t();
  el.turnsGrid.innerHTML = '';

  // Find latest completion per canonical chore
  const latestByChore = new Map();
  for (const entry of state.entries) {
    const key = getChoreCanonicalKey(entry.title);
    const prev = latestByChore.get(key);
    if (!prev || entry.timestamp > prev.timestamp) {
      latestByChore.set(key, entry);
    }
  }

  if (latestByChore.size === 0) {
    const p = document.createElement('p');
    p.className = 'turns-empty-hint';
    p.textContent = dict.whoseTurnEmpty;
    el.turnsGrid.appendChild(p);
    return;
  }

  const sortedTurns = Array.from(latestByChore.entries())
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .slice(0, 12);

  for (const [key, lastEntry] of sortedTurns) {
    const nextRole = lastEntry.doneBy === 'me' ? 'brother' : 'me';
    const nextName = getMemberName(nextRole);
    const lastName = getMemberName(lastEntry.doneBy);
    const displayTitle = getChoreDisplayTitle(key, lastEntry.title);

    const card = document.createElement(isViewerMode ? 'div' : 'button');
    if (!isViewerMode) card.type = 'button';
    card.className = `turn-card${isViewerMode ? '' : ' clickable'}`;

    const titleEl = document.createElement('span');
    titleEl.className = 'turn-card-title';
    titleEl.textContent = `${lastEntry.icon || '✅'} ${displayTitle}`;

    const nextBadge = document.createElement('span');
    nextBadge.className = `turn-card-next ${nextRole === 'me' ? 'next-me' : 'next-brother'}`;
    nextBadge.textContent = dict.nextTurnBadge(nextName);

    const sub = document.createElement('span');
    sub.className = 'turn-card-sub';
    sub.textContent = dict.lastDoneBy(lastName, formatRelativeTime(lastEntry.timestamp));

    card.append(titleEl, nextBadge, sub);

    if (!isViewerMode) {
      card.addEventListener('click', () => {
        el.taskInput.value = displayTitle;
        state.selectedIcon = lastEntry.icon || '✅';
        setComposerDoneBy(nextRole);
        renderPresetChips();
        el.composerAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => el.taskInput.focus(), 200);
        showToast(dict.toastTurnPrefilled(displayTitle, nextName));
      });
    }

    el.turnsGrid.appendChild(card);
  }
}

// Sync UI rendering
function renderSyncUI() {
  const dict = t();
  if (isViewerMode) {
    el.composerCard.classList.add('hidden');
    el.viewerCard.classList.remove('hidden');
    el.btnSync.classList.add('hidden');
    el.btnShareBrother.classList.add('hidden');
    el.restoreBackupLabel.classList.add('hidden');
    el.mobileFab.classList.add('hidden');

    el.syncPill.textContent = state.syncError ? dict.loadFailed : dict.liveView;
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
      el.syncPill.textContent = dict.syncing;
      el.syncPill.classList.remove('error');
      el.syncPill.classList.add('synced');
      el.btnSyncLabel.textContent = dict.btnSyncing;
    } else if (state.syncError) {
      el.syncPill.textContent = dict.syncIssue;
      el.syncPill.classList.remove('synced');
      el.syncPill.classList.add('error');
      el.btnSyncLabel.textContent = dict.btnSync;
    } else {
      el.syncPill.textContent = dict.synced;
      el.syncPill.classList.remove('error');
      el.syncPill.classList.add('synced');
      el.btnSyncLabel.textContent = dict.btnSynced;
    }

    el.syncConnectedPanel.classList.remove('hidden');
    el.syncSetupPanel.classList.add('hidden');
    el.syncConnectedUser.textContent = cfg.username
      ? dict.connectedAs(cfg.username)
      : dict.connectedGeneric;
    el.syncLastTime.textContent = cfg.lastSyncedAt
      ? dict.lastSynced(formatRelativeTime(cfg.lastSyncedAt))
      : dict.readyToSync;
    el.syncGistLink.href = cfg.gistUrl || `https://gist.github.com/${cfg.gistId}`;
    el.btnSyncNow.disabled = state.syncBusy;
    el.btnSyncNow.textContent = state.syncBusy ? dict.syncing : dict.syncNow;
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
    el.btnSyncLabel.textContent = dict.btnSync;
    el.syncPill.textContent = dict.localMode;
    el.syncPill.classList.remove('synced', 'error');

    el.syncConnectedPanel.classList.add('hidden');
    el.syncSetupPanel.classList.remove('hidden');
    el.btnSyncConnect.disabled = state.syncBusy;
    el.btnSyncConnect.textContent = state.syncBusy ? dict.connecting : dict.connectAndSync;

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
      m: state.members,
      d: state.deletedIds
    });
    const remoteSig = JSON.stringify({
      e: remote.entries,
      p: remote.presets,
      m: remote.members,
      d: remote.deletedIds
    });

    const merged = mergeVaultStates(getCurrentVault(), remote);
    applyVault(merged);
    await persistLocal();

    const mergedSig = JSON.stringify({
      e: merged.entries,
      p: merged.presets,
      m: merged.members,
      d: merged.deletedIds
    });

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
      renderMemberLabels();
      renderPresetChips();
      renderAll();
    }
    if (!silent) {
      showToast(t().toastSynced);
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
      members: remote.members,
      membersUpdatedAt: remote.membersUpdatedAt,
      deletedIds: remote.deletedIds
    });
    renderMemberLabels();
  } catch (err) {
    console.error('Failed to load shared view:', err);
    state.syncError = err.message || 'Could not load shared chore log.';
    showToast(state.syncError);
  } finally {
    state.loading = false;
    renderAll();
  }
}

// Presets
function renderPresetChips() {
  el.presetChips.innerHTML = '';
  const currentText = el.taskInput.value.trim().toLowerCase();

  for (const preset of state.presets) {
    const displayLabel = getPresetDisplayLabel(preset, state.lang);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-chip';
    if (currentText && currentText === displayLabel.toLowerCase()) {
      btn.classList.add('active');
    }
    btn.textContent = `${preset.icon} ${displayLabel}`;
    btn.addEventListener('click', () => {
      el.taskInput.value = displayLabel;
      state.selectedIcon = preset.icon;
      renderPresetChips();
      el.taskInput.focus();
    });
    el.presetChips.appendChild(btn);
  }
}

function renderPresetManager() {
  const dict = t();
  el.presetManageList.innerHTML = '';
  if (state.presets.length === 0) {
    const li = document.createElement('li');
    li.className = 'preset-manage-item';
    li.textContent = dict.noPresets;
    el.presetManageList.appendChild(li);
    return;
  }

  for (const preset of state.presets) {
    const displayLabel = getPresetDisplayLabel(preset, state.lang);
    const li = document.createElement('li');
    li.className = 'preset-manage-item';

    const span = document.createElement('span');
    span.textContent = `${preset.icon} ${displayLabel}`;

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-action delete';
    delBtn.title = 'Remove preset';
    delBtn.setAttribute('aria-label', `Remove ${displayLabel}`);
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
    if (state.whoFilter !== 'all' && entry.doneBy !== state.whoFilter) return false;
    if (state.photoOnly && !entryHasAnyPhoto(entry)) return false;
    if (q) {
      const hay = `${entry.title} ${entry.note || ''} ${getMemberName(entry.doneBy)}`.toLowerCase();
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
    if (entryHasAnyPhoto(entry)) photoCount++;
  }

  el.statToday.textContent = String(todayCount);
  el.statWeek.textContent = String(weekCount);
  el.statTotal.textContent = String(state.entries.length);
  el.statPhotos.textContent = String(photoCount);
}

// Timeline
function renderTimeline() {
  const dict = t();
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
      el.emptyTitle.textContent = dict.loadFailed;
      el.emptyMessage.textContent = state.syncError;
    } else if (state.entries.length === 0) {
      el.emptyTitle.textContent = dict.emptyTitle;
      el.emptyMessage.textContent = isViewerMode ? dict.emptyDescViewer : dict.emptyDescOwner;
    } else {
      el.emptyTitle.textContent = dict.noMatchTitle;
      el.emptyMessage.textContent = dict.noMatchDesc;
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
    count.textContent = formatCountLabel(items.length, state.lang);

    header.append(title, count);
    section.appendChild(header);

    for (const entry of items) {
      section.appendChild(createEntryCard(entry));
    }

    el.timelineContainer.appendChild(section);
  }
}

function createEntryCard(entry) {
  const dict = t();
  const isBrother = entry.doneBy === 'brother';
  const card = document.createElement('article');
  card.className = 'entry-card';

  const iconBox = document.createElement('div');
  iconBox.className = `entry-icon${isBrother ? ' icon-brother' : ''}`;
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
    editBtn.title = dict.editModalTitle;
    editBtn.setAttribute('aria-label', dict.editModalTitle);
    editBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener('click', () => openEditModal(entry));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'icon-action delete';
    delBtn.title = 'Delete';
    delBtn.setAttribute('aria-label', 'Delete');
    delBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
    delBtn.addEventListener('click', async () => {
      if (!confirm(dict.confirmDelete(entry.title))) return;
      state.entries = state.entries.filter((item) => item.id !== entry.id);
      state.deletedIds[entry.id] = Date.now();
      if (entry.photoFile) state.photos.delete(entry.photoFile);
      if (entry.beforePhotoFile) state.photos.delete(entry.beforePhotoFile);
      await persistLocal();
      renderAll();
      showToast(dict.toastDeleted);
      syncWithGitHub({ pushAfterMerge: true, silent: true });
    });

    actions.append(editBtn, delBtn);
    top.appendChild(actions);
  }

  const meta = document.createElement('div');
  meta.className = 'entry-meta';

  const whoPill = document.createElement('span');
  whoPill.className = `who-pill ${isBrother ? 'brother' : 'me'}`;
  whoPill.textContent = `${isBrother ? '👦' : '🙋'} ${getMemberName(entry.doneBy)}`;

  const timeBadge = document.createElement('span');
  timeBadge.className = 'entry-time-badge';
  timeBadge.textContent = formatTime(entry.timestamp);
  timeBadge.title = formatFullDateTime(entry.timestamp);

  const rel = document.createElement('span');
  rel.textContent = `• ${formatRelativeTime(entry.timestamp)}`;

  meta.append(whoPill, timeBadge, rel);
  body.append(top, meta);

  if (entry.note) {
    const note = document.createElement('p');
    note.className = 'entry-note';
    note.textContent = entry.note;
    body.appendChild(note);
  }

  const { before, after } = getEntryPhotos(entry);
  if (before && after) {
    // Side-by-side Before -> After comparison strip
    const wrap = document.createElement('div');
    wrap.className = 'entry-photo-wrap';

    const pair = document.createElement('div');
    pair.className = 'entry-photo-pair';

    const btnBefore = makePhotoThumbButton(before, dict.badgeBefore, false, () =>
      openLightbox(entry, 'before')
    );
    const arrow = document.createElement('span');
    arrow.className = 'pair-arrow';
    arrow.textContent = '→';
    arrow.setAttribute('aria-hidden', 'true');
    const btnAfter = makePhotoThumbButton(after, dict.badgeAfter, true, () =>
      openLightbox(entry, 'after')
    );

    pair.append(btnBefore, arrow, btnAfter);
    wrap.appendChild(pair);
    body.appendChild(wrap);
  } else if (after || before) {
    const wrap = document.createElement('div');
    wrap.className = 'entry-photo-wrap';
    const slot = after ? 'after' : 'before';
    const url = after || before;
    const badgeText = after ? dict.badgeProof : dict.badgeBefore;
    wrap.appendChild(makePhotoThumbButton(url, badgeText, false, () => openLightbox(entry, slot)));
    body.appendChild(wrap);
  }

  card.append(iconBox, body);
  return card;
}

function makePhotoThumbButton(src, badgeText, isAfterAccent, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'entry-photo-btn';

  const img = document.createElement('img');
  img.src = src;
  img.alt = badgeText;
  img.loading = 'lazy';

  const badge = document.createElement('span');
  badge.className = `photo-badge${isAfterAccent ? ' badge-after' : ''}`;
  badge.textContent = badgeText;

  btn.append(img, badge);
  btn.addEventListener('click', onClick);
  return btn;
}

// Dual Lightbox
function openLightbox(entry, initialSlot = 'after') {
  const { before, after } = getEntryPhotos(entry);
  state.lightboxEntry = entry;

  const hasBoth = Boolean(before && after);
  el.lightboxTabs.classList.toggle('hidden', !hasBoth);

  const resolvedSlot = initialSlot === 'before' && before ? 'before' : after ? 'after' : 'before';
  switchLightboxSlot(resolvedSlot);

  const whoLabel = `${entry.doneBy === 'brother' ? '👦' : '🙋'} ${getMemberName(entry.doneBy)}`;
  el.lightboxTitle.textContent = `${entry.icon || '✅'} ${entry.title}`;
  el.lightboxMeta.textContent = `${t().lightboxCompleted(whoLabel, formatFullDateTime(entry.timestamp))}${
    entry.note ? ` — ${entry.note}` : ''
  }`;
  openModal('lightboxModal');
}

function switchLightboxSlot(slot) {
  if (!state.lightboxEntry) return;
  const { before, after } = getEntryPhotos(state.lightboxEntry);
  if (slot === 'before' && !before) return;
  if (slot === 'after' && !after) return;

  state.lightboxSlot = slot;
  el.lightboxImg.src = slot === 'before' ? before : after;
  el.lightboxTabBefore.classList.toggle('active', slot === 'before');
  el.lightboxTabAfter.classList.toggle('active', slot === 'after');
}

function openEditModal(entry) {
  el.editId.value = entry.id;
  el.editTaskInput.value = entry.title;
  el.editNoteInput.value = entry.note || '';
  el.editTimeInput.value = toLocalDatetimeInputValue(new Date(entry.timestamp));
  setEditDoneBy(entry.doneBy);
  openModal('editModal');
  el.editTaskInput.focus();
}

function renderAll() {
  renderSyncUI();
  renderScoreboard();
  renderStats();
  renderTimeline();
}

// Photo Handling + Live Watermark Preview
function getPendingTimestamp() {
  if (el.customTimeToggle.checked && el.customTimeInput.value) {
    const parsed = new Date(el.customTimeInput.value).getTime();
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

async function refreshPhotoPreviews() {
  const ts = getPendingTimestamp();
  const isPair = Boolean(state.pendingBeforeClean && state.pendingAfterClean);
  const dict = t();
  const locale = getLocale(state.lang);

  if (state.pendingBeforeClean) {
    state.pendingBeforeFinal = state.stampEnabled
      ? await applyTimestampWatermark(state.pendingBeforeClean, {
          timestamp: ts,
          tag: isPair ? dict.badgeBefore : '',
          locale
        })
      : state.pendingBeforeClean;
    el.beforePreviewImg.src = state.pendingBeforeFinal;
    el.beforeEmpty.classList.add('hidden');
    el.beforePreview.classList.remove('hidden');
  } else {
    state.pendingBeforeFinal = null;
    el.beforePreviewImg.src = '';
    el.beforePreview.classList.add('hidden');
    el.beforeEmpty.classList.remove('hidden');
  }

  if (state.pendingAfterClean) {
    state.pendingAfterFinal = state.stampEnabled
      ? await applyTimestampWatermark(state.pendingAfterClean, {
          timestamp: ts,
          tag: isPair ? dict.badgeAfter : '',
          locale
        })
      : state.pendingAfterClean;
    el.afterPreviewImg.src = state.pendingAfterFinal;
    el.afterEmpty.classList.add('hidden');
    el.afterPreview.classList.remove('hidden');
  } else {
    state.pendingAfterFinal = null;
    el.afterPreviewImg.src = '';
    el.afterPreview.classList.add('hidden');
    el.afterEmpty.classList.remove('hidden');
  }
}

async function handlePhotoFile(slot, file) {
  if (!file) return;
  try {
    const compressed = await compressImage(file);
    if (slot === 'before') {
      state.pendingBeforeClean = compressed;
    } else {
      state.pendingAfterClean = compressed;
    }
    await refreshPhotoPreviews();
  } catch (err) {
    showToast(err.message || 'Could not load photo');
  }
}

function clearPendingPhotos() {
  state.pendingBeforeClean = null;
  state.pendingAfterClean = null;
  state.pendingBeforeFinal = null;
  state.pendingAfterFinal = null;
  el.beforePhotoInput.value = '';
  el.afterPhotoInput.value = '';
  el.beforePreviewImg.src = '';
  el.afterPreviewImg.src = '';
  el.beforePreview.classList.add('hidden');
  el.beforeEmpty.classList.remove('hidden');
  el.afterPreview.classList.add('hidden');
  el.afterEmpty.classList.remove('hidden');
}

function bindPhotoDropzone(dropzone, input, removeBtn, slot) {
  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('.btn-icon-remove')) return;
    input.click();
  });

  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) handlePhotoFile(slot, file);
  });

  removeBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    input.value = '';
    if (slot === 'before') state.pendingBeforeClean = null;
    else state.pendingAfterClean = null;
    await refreshPhotoPreviews();
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) handlePhotoFile(slot, file);
  });
}

async function copyText(text, successMsg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg);
  } catch {
    showToast(t().toastClipboardErr);
  }
}

// Event Listeners
function setupEventListeners() {
  el.createTokenLink.href = GITHUB_TOKEN_CREATE_URL;
  el.stampPhotoToggle.checked = state.stampEnabled;

  // Theme & Language toggles
  el.btnThemeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    saveTheme(state.theme);
    applyTheme();
  });

  el.btnLangToggle.addEventListener('click', () => {
    state.lang = state.lang === 'en' ? 'ru' : 'en';
    saveLang(state.lang);
    applyLanguage();
    if (state.pendingBeforeClean || state.pendingAfterClean) {
      refreshPhotoPreviews();
    }
  });

  // Scoreboard period switcher
  el.periodPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      el.periodPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.scorePeriod = pill.dataset.scorePeriod;
      renderScoreboard();
    });
  });

  // Edit member names modal
  el.btnEditNames.addEventListener('click', () => {
    el.myNameInput.value = state.members.me || '';
    el.brotherNameInput.value = state.members.brother || '';
    openModal('namesModal');
    el.myNameInput.focus();
  });

  el.namesForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    state.members = {
      me: el.myNameInput.value.trim().slice(0, 24),
      brother: el.brotherNameInput.value.trim().slice(0, 24)
    };
    state.membersUpdatedAt = Date.now();
    await persistLocal();
    closeModal('namesModal');
    renderMemberLabels();
    renderAll();
    showToast(t().toastNamesSaved);
    syncWithGitHub({ pushAfterMerge: true, silent: true });
  });

  // Composer Who selector
  el.whoBtns.forEach((btn) => {
    btn.addEventListener('click', () => setComposerDoneBy(btn.dataset.doneBy));
  });

  el.editWhoBtns.forEach((btn) => {
    btn.addEventListener('click', () => setEditDoneBy(btn.dataset.editDoneBy));
  });

  // Lightbox Before / After tabs
  el.lightboxTabBefore.addEventListener('click', () => switchLightboxSlot('before'));
  el.lightboxTabAfter.addEventListener('click', () => switchLightboxSlot('after'));

  // Mobile FAB
  el.mobileFab.addEventListener('click', () => {
    el.composerAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => el.taskInput.focus(), 250);
  });

  const updateMobileFab = () => {
    if (isViewerMode || window.innerWidth > 900) {
      el.mobileFab.classList.add('hidden');
      return;
    }
    const rect = el.composerCard.getBoundingClientRect();
    el.mobileFab.classList.toggle('hidden', rect.bottom > 80);
  };
  window.addEventListener('scroll', updateMobileFab, { passive: true });
  window.addEventListener('resize', updateMobileFab, { passive: true });

  // Viewer mode refresh
  el.btnRefreshView.addEventListener('click', () => loadBrotherView());

  // Sync modal
  el.btnSync.addEventListener('click', () => {
    state.syncError = '';
    el.syncTokenInput.value = '';
    renderSyncUI();
    openModal('syncModal');
    if (!state.syncConfig?.gistId) {
      setTimeout(() => el.syncTokenInput.focus(), 40);
    }
  });

  el.btnShareBrother.addEventListener('click', () => {
    const url = getBrotherShareUrl();
    if (!url) {
      showToast(t().toastConnectFirst);
      return;
    }
    copyText(url, t().toastCopiedBrother);
  });

  el.btnCopyTokenPhone.addEventListener('click', () => {
    if (state.syncConfig?.token) {
      copyText(state.syncConfig.token, t().toastCopiedToken);
    }
  });

  el.btnCopyBrotherLink.addEventListener('click', () => {
    const url = getBrotherShareUrl();
    if (url) copyText(url, t().toastCopiedBrother);
  });

  el.btnSyncNow.addEventListener('click', () => {
    syncWithGitHub({ pushAfterMerge: true, silent: false });
  });

  el.btnSyncDisconnect.addEventListener('click', () => {
    if (!confirm(t().confirmSignOut)) return;
    state.syncConfig = null;
    state.syncError = '';
    state.remotePhotoFiles = new Set();
    saveSyncConfig(null);
    renderSyncUI();
    showToast(t().toastSignedOut);
  });

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
      renderMemberLabels();
      renderPresetChips();
      renderAll();
      showToast(t().toastSynced);
    } catch (err) {
      console.error('GitHub Sync connect failed:', err);
      state.syncError = err.message || 'Could not connect to GitHub.';
    } finally {
      state.syncBusy = false;
      renderSyncUI();
    }
  });

  // Task input, custom time & watermark
  el.taskInput.addEventListener('input', () => {
    const val = el.taskInput.value.trim().toLowerCase();
    const matched = state.presets.find(
      (p) => getPresetDisplayLabel(p, state.lang).toLowerCase() === val || p.label.toLowerCase() === val
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
    if (state.pendingBeforeClean || state.pendingAfterClean) {
      refreshPhotoPreviews();
    }
  });

  el.customTimeInput.addEventListener('change', () => {
    if (state.pendingBeforeClean || state.pendingAfterClean) {
      refreshPhotoPreviews();
    }
  });

  el.stampPhotoToggle.addEventListener('change', () => {
    state.stampEnabled = el.stampPhotoToggle.checked;
    saveStampPref(state.stampEnabled);
    if (state.pendingBeforeClean || state.pendingAfterClean) {
      refreshPhotoPreviews();
    }
  });

  bindPhotoDropzone(el.beforeDropzone, el.beforePhotoInput, el.btnRemoveBefore, 'before');
  bindPhotoDropzone(el.afterDropzone, el.afterPhotoInput, el.btnRemoveAfter, 'after');

  // Submit new entry
  el.logForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dict = t();
    const title = el.taskInput.value.trim();
    if (!title) {
      el.taskInput.focus();
      showToast(dict.toastEnterTask);
      return;
    }

    el.btnSubmitLog.disabled = true;
    el.btnSubmitLabel.textContent = dict.btnSaving;

    try {
      const timestamp = getPendingTimestamp();
      if (state.pendingBeforeClean || state.pendingAfterClean) {
        await refreshPhotoPreviews();
      }

      const id = crypto.randomUUID
        ? crypto.randomUUID()
        : `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      let beforePhotoFile = null;
      let photoFile = null;

      if (state.pendingBeforeFinal) {
        beforePhotoFile = makePhotoFileName(id, 'before');
        state.photos.set(beforePhotoFile, state.pendingBeforeFinal);
      }
      if (state.pendingAfterFinal) {
        photoFile = makePhotoFileName(id, 'after');
        state.photos.set(photoFile, state.pendingAfterFinal);
      }

      const entry = {
        id,
        title,
        note: el.noteInput.value.trim(),
        icon: state.selectedIcon || '✅',
        doneBy: state.selectedDoneBy,
        timestamp,
        updatedAt: Date.now(),
        photoFile,
        beforePhotoFile
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
      clearPendingPhotos();
      renderPresetChips();
      renderAll();

      showToast(state.syncConfig?.gistId ? dict.toastLoggedSynced : dict.toastLoggedLocal);
      syncWithGitHub({ pushAfterMerge: true, silent: true });
    } finally {
      el.btnSubmitLog.disabled = false;
      el.btnSubmitLabel.textContent = dict.btnMarkDone;
    }
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
      doneBy: state.editDoneBy,
      timestamp: Number.isNaN(newTs) ? entry.timestamp : newTs,
      updatedAt: Date.now()
    };

    state.entries = state.entries.map((item) => (item.id === id ? updated : item));
    state.entries.sort((a, b) => b.timestamp - a.timestamp);
    await persistLocal();
    closeModal('editModal');
    renderAll();
    showToast(t().toastUpdated);
    syncWithGitHub({ pushAfterMerge: true, silent: true });
  });

  // History Filters
  el.filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      el.filterTabs.forEach((tb) => {
        tb.classList.remove('active');
        tb.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.range = tab.dataset.range;
      renderTimeline();
    });
  });

  el.whoFilterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      el.whoFilterTabs.forEach((tb) => tb.classList.remove('active'));
      tab.classList.add('active');
      state.whoFilter = tab.dataset.who;
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
    showToast(t().toastPresetAdded);
    syncWithGitHub({ pushAfterMerge: true, silent: true });
  });

  el.btnResetPresets.addEventListener('click', async () => {
    state.presets = [...DEFAULT_PRESETS];
    state.presetsUpdatedAt = Date.now();
    await persistLocal();
    renderPresetChips();
    renderPresetManager();
    showToast(t().toastDefaultsRestored);
    syncWithGitHub({ pushAfterMerge: true, silent: true });
  });

  // Copy Summary
  el.btnCopySummary.addEventListener('click', () => {
    const dict = t();
    const filtered = getFilteredEntries();
    if (filtered.length === 0) {
      showToast(dict.toastNothingToCopy);
      return;
    }

    let meCnt = 0;
    let broCnt = 0;
    for (const item of filtered) {
      if (item.doneBy === 'brother') broCnt++;
      else meCnt++;
    }

    const lines = [
      dict.copyHeader,
      `📊 ${getMemberName('me')}: ${meCnt}  |  ${getMemberName('brother')}: ${broCnt}`,
      ''
    ];
    for (const entry of filtered) {
      const when = formatFullDateTime(entry.timestamp);
      const who = getMemberName(entry.doneBy);
      const { before, after } = getEntryPhotos(entry);
      const photoTag =
        before && after
          ? ' [📸 Before & After]'
          : before || after
            ? ' [📷 Photo proof]'
            : '';
      lines.push(`• ${entry.icon || '✅'} ${entry.title} (${who}) — ${when}${photoTag}`);
      if (entry.note) {
        lines.push(`  Note: ${entry.note}`);
      }
    }

    copyText(lines.join('\n'), dict.toastCopiedItems(filtered.length));
  });

  // Backup / Restore
  el.btnBackup.addEventListener('click', () => openModal('backupModal'));

  el.btnExportJson.addEventListener('click', () => {
    const exportedEntries = state.entries.map((entry) => {
      const { before, after } = getEntryPhotos(entry);
      return {
        id: entry.id,
        title: entry.title,
        note: entry.note,
        icon: entry.icon,
        doneBy: entry.doneBy,
        timestamp: entry.timestamp,
        updatedAt: entry.updatedAt,
        photo: after,
        beforePhoto: before
      };
    });

    const payload = {
      app: 'DoneLog',
      version: 2,
      exportedAt: new Date().toISOString(),
      members: state.members,
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
    showToast(t().toastBackupDone);
  });

  el.importJsonInput.addEventListener('change', async () => {
    const dict = t();
    const file = el.importJsonInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.entries)) {
        throw new Error('Invalid backup file');
      }
      if (!confirm(dict.confirmRestore(data.entries.length))) {
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
        let beforePhotoFile = null;
        if (typeof raw.photo === 'string' && raw.photo.startsWith('data:image/')) {
          photoFile = makePhotoFileName(id, 'after');
          nextPhotos.set(photoFile, raw.photo);
        }
        if (typeof raw.beforePhoto === 'string' && raw.beforePhoto.startsWith('data:image/')) {
          beforePhotoFile = makePhotoFileName(id, 'before');
          nextPhotos.set(beforePhotoFile, raw.beforePhoto);
        }
        nextEntries.push({
          id,
          title: String(raw.title).trim().slice(0, 120),
          note: String(raw.note || '').trim().slice(0, 300),
          icon: String(raw.icon || '✅').trim().slice(0, 8) || '✅',
          doneBy: raw.doneBy === 'brother' ? 'brother' : 'me',
          timestamp: Number(raw.timestamp) || now,
          updatedAt: now,
          photoFile,
          beforePhotoFile
        });
      }
      nextEntries.sort((a, b) => b.timestamp - a.timestamp);

      const nextIds = new Set(nextEntries.map((x) => x.id));
      for (const old of state.entries) {
        if (!nextIds.has(old.id)) state.deletedIds[old.id] = now;
      }
      for (const id of nextIds) delete state.deletedIds[id];

      state.entries = nextEntries;
      state.photos = nextPhotos;
      if (Array.isArray(data.presets) && data.presets.length > 0) {
        state.presets = data.presets;
        state.presetsUpdatedAt = now;
      }
      if (data.members && typeof data.members === 'object') {
        state.members = {
          me: String(data.members.me || '').trim().slice(0, 24),
          brother: String(data.members.brother || '').trim().slice(0, 24)
        };
        state.membersUpdatedAt = now;
      }

      await persistLocal();
      renderMemberLabels();
      renderPresetChips();
      renderAll();
      closeModal('backupModal');
      showToast(dict.toastBackupRestored);
      syncWithGitHub({ pushAfterMerge: true, silent: true });
    } catch {
      showToast(dict.toastInvalidBackup);
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
  applyTheme();
  setupEventListeners();
  setInterval(updateLiveClock, 15000);

  if (isViewerMode) {
    applyLanguage();
    await loadBrotherView();
    return;
  }

  const local = await loadLocalVault();
  applyVault(local);
  applyLanguage();

  if (state.syncConfig?.token && state.syncConfig?.gistId) {
    state.lastFocusPullAt = Date.now();
    syncWithGitHub({ pushAfterMerge: false, silent: true });
  }
}

init();
