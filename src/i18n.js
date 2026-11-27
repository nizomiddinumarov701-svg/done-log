/**
 * Bilingual EN / RU translations and formatting helpers for DoneLog.
 */

const LANG_STORAGE_KEY = 'donelog_lang_v1';

export const DEFAULT_PRESET_LABELS = {
  en: {
    dishes: 'Washed dishes',
    trash: 'Took out trash',
    sweep: 'Swept / Vacuumed',
    laundry: 'Did laundry',
    groceries: 'Bought groceries',
    cook: 'Cooked meal',
    bathroom: 'Cleaned bathroom',
    kitchen: 'Cleaned kitchen',
    bedroom: 'Cleaned bedroom'
  },
  ru: {
    dishes: 'Помыл посуду',
    trash: 'Вынес мусор',
    sweep: 'Подмёл / Пропылесосил',
    laundry: 'Постирал вещи',
    groceries: 'Купил продукты',
    cook: 'Приготовил еду',
    bathroom: 'Убрался в ванной',
    kitchen: 'Убрался на кухне',
    bedroom: 'Убрался в спальне'
  }
};

export const TRANSLATIONS = {
  en: {
    subtitle: 'Track turns, chores & photo proof',
    localMode: 'Local mode',
    synced: '☁️ GitHub synced',
    syncing: '⏳ Syncing...',
    syncIssue: '⚠️ Sync issue',
    liveView: '👁️ Live view',
    loadFailed: '⚠️ Load failed',
    btnSync: 'Sync',
    btnSynced: 'Synced',
    btnSyncing: 'Syncing',
    btnShareView: 'Share View',
    btnCopyList: 'Copy List',
    btnBackup: 'Backup',
    statToday: 'Done Today',
    statWeek: 'This Week',
    statTotal: 'Total Logged',
    statPhotos: 'Photo Proofs',

    // Fairness & Turns
    scoreboardTitle: 'Turn Tracker & Fairness',
    editNames: 'Edit names',
    periodWeek: 'This Week',
    periodToday: 'Today',
    periodAll: 'All Time',
    turnsEven: '⚖️ Perfectly even!',
    turnsNone: '✨ Log a chore to start tracking turns',
    aheadBy: (leader, trailing, diff) => `🔥 ${trailing} owes ${diff} ${diff === 1 ? 'turn' : 'turns'} (${leader} leads)`,
    whoseTurnTitle: 'Whose Turn Is Next?',
    whoseTurnEmpty: 'Log any chore and DoneLog will automatically track whose turn is next.',
    nextTurnBadge: (name) => `👉 ${name}'s turn`,
    lastDoneBy: (name, when) => `Last: ${name} • ${when}`,
    notLoggedYet: 'Not logged yet',

    // Viewer card
    viewerBadge: '👁️ View-Only Proof Mode',
    viewerTitle: 'Verified Chore History',
    viewerDesc: "You're viewing a live read-only chore log with timestamps, turn scoreboard, and photo proofs. Tap any photo to inspect it full-screen.",
    btnRefreshView: '🔄 Refresh Latest',
    btnExitView: 'Open My Own DoneLog →',

    // Composer
    logHeading: 'Log What Was Done',
    whoDidIt: 'Who did this?',
    quickPick: 'Quick pick',
    editList: 'Edit list',
    taskLabel: 'Task / Chore',
    taskPlaceholder: 'e.g., Washed all the dishes',
    noteLabel: 'Details / Note',
    optional: '(optional)',
    notePlaceholder: 'e.g., Also wiped the stove and put dishes away',
    whenLabel: 'When was it done?',
    customTime: 'Set custom time',
    autoTimeHint: 'Automatically saves the exact current date & time.',
    photosLabel: 'Photo Proof',
    beforeSlot: 'Before (optional)',
    afterSlot: 'After / Proof',
    photoTapHint: 'Tap or drop photo',
    stampToggle: '🕒 Stamp date & time watermark on photos',
    btnMarkDone: 'Mark as Done',
    btnSaving: 'Saving...',
    fabLog: '+ Log Chore',

    // History controls
    filterAll: 'All',
    filterToday: 'Today',
    filterWeek: 'This Week',
    filterMonth: 'This Month',
    whoAll: 'Everyone',
    searchPlaceholder: 'Search chores or notes...',
    withPhoto: '📷 With photo',
    loadingTitle: 'Loading chore log...',
    loadingDesc: 'Fetching saved chores and photo proofs from GitHub Gist.',
    emptyTitle: 'Nothing logged yet',
    emptyDescOwner: 'Log your first completed chore on the left — and connect free GitHub Sync to keep it backed up across your PC and phone forever.',
    emptyDescViewer: 'No chores have been logged yet.',
    noMatchTitle: 'No matching entries',
    noMatchDesc: 'Try switching the filter or clearing your search.',
    taskSingular: 'task',
    taskPlural: 'tasks',
    today: 'Today',
    yesterday: 'Yesterday',
    justNow: 'Just now',
    scheduled: 'Scheduled',
    badgeBefore: 'BEFORE',
    badgeAfter: 'AFTER',
    badgeProof: '📷 Proof',
    doneByPrefix: 'By',

    // Modals
    syncModalTitle: '☁️ Free GitHub PC ↔ Phone Sync',
    connectedAs: (u) => `Connected as @${u}`,
    connectedGeneric: 'Connected to GitHub Gist',
    lastSynced: (when) => `Last synced ${when}`,
    readyToSync: 'Ready to sync',
    copyTokenPhone: '📋 Copy Token for Phone',
    copyBrotherLink: "👁️ Copy Brother's View Link",
    privateGist: 'Private Gist ↗',
    syncPhoneHeading: 'To connect your phone:',
    syncPhoneBody: 'Open this same DoneLog link on your phone, tap ☁️ Sync, and paste your same GitHub Sync Token — your private vault and photos sync automatically!',
    syncBrotherHeading: 'To show your brother (read-only):',
    syncBrotherBody: "Tap 👁️ Copy Brother's View Link above and send it to him. He can see all chores, turns, timestamps, and photo proofs without logging in — and cannot edit or delete anything.",
    signOutDevice: 'Sign Out on This Device',
    syncNow: '🔄 Sync Now',
    syncSetupDesc: 'Sync your chores, turns, timestamps, presets, and Before/After photo proofs across PC and phone using a private GitHub Gist — 100% free forever!',
    syncStep1Title: 'Use your existing LifeQuest gist token or create a free GitHub Sync Token (only checks gist):',
    createTokenBtn: '🔑 Create GitHub Token ↗',
    syncStep1Hint: 'Set Expiration to No expiration (or 1 year), click Generate token, and copy the ghp_... code. DoneLog creates its own separate vault file so it never affects LifeQuest.',
    syncStep2Title: 'Paste it below on PC & Phone',
    syncStep2Hint: 'First device creates your private vault; your second device auto-finds and syncs everything with the same token!',
    tokenLabel: 'GitHub Sync Token',
    tokenScopeHint: '(gist scope)',
    tokenPrivacy: "🔒 Stored only inside this browser and talks directly to GitHub's official API.",
    cancel: 'Cancel',
    connectAndSync: '☁️ Connect & Sync Now',
    connecting: '⏳ Connecting...',

    editModalTitle: 'Edit Entry',
    dateTimeLabel: 'Date & Time',
    saveChanges: 'Save Changes',

    namesModalTitle: 'Turn Tracker Names',
    namesModalDesc: 'Customize the names shown on the Turn Tracker & Fairness Scoreboard.',
    myNameLabel: 'Your Name',
    brotherNameLabel: "Brother's Name",
    myNameDefault: 'Me',
    brotherNameDefault: 'Brother',

    presetsModalTitle: 'Quick-Pick Chores',
    presetPlaceholder: 'Add new chore (e.g., Watered plants)',
    add: 'Add',
    resetDefaults: 'Reset defaults',
    done: 'Done',
    noPresets: 'No quick-pick chores yet.',

    backupModalTitle: 'Backup & Restore',
    backupModalDesc: 'Download a full JSON backup of all your chores, turns, and photo proofs, or restore one anytime.',
    downloadBackup: 'Download Backup (.json)',
    restoreBackup: 'Restore from Backup (.json)',

    // Lightbox
    lightboxCompleted: (who, when) => `${who} • ${when}`,
    lightboxBefore: 'Before',
    lightboxAfter: 'After',

    // Toasts & confirms
    toastEnterTask: 'Please enter what was done',
    toastLoggedSynced: 'Logged & syncing to GitHub!',
    toastLoggedLocal: 'Logged! Connect ☁️ Sync to back up across devices',
    toastUpdated: 'Entry updated',
    toastDeleted: 'Entry deleted',
    toastNamesSaved: 'Names updated!',
    toastPresetAdded: 'Added quick-pick chore',
    toastDefaultsRestored: 'Defaults restored',
    toastNothingToCopy: 'Nothing to copy yet',
    toastCopiedItems: (n) => `Copied ${n} ${n === 1 ? 'item' : 'items'} to clipboard`,
    toastCopiedBrother: "Copied Brother's View Link! (Read-only)",
    toastCopiedToken: 'Copied GitHub Sync Token for your phone!',
    toastClipboardErr: 'Could not access clipboard',
    toastBackupDone: 'Backup downloaded',
    toastBackupRestored: 'Backup restored!',
    toastInvalidBackup: 'Invalid backup file',
    toastSynced: 'Synced with GitHub!',
    toastSignedOut: 'Signed out on this device',
    toastConnectFirst: 'Connect GitHub Sync first to get a share link',
    toastTurnPrefilled: (chore, who) => `Ready to log "${chore}" for ${who}`,
    confirmDelete: (title) => `Delete "${title}"?`,
    confirmSignOut: 'Sign out of GitHub Sync on this device? Your local chores stay here and your private Gist stays safe on GitHub.',
    confirmRestore: (n) => `Restore ${n} entries? This will replace your current list.`,
    copyHeader: '✅ Chore Log & Turn Summary:'
  },

  ru: {
    subtitle: 'Учёт очереди, дел и фото-отчётов',
    localMode: 'Локально',
    synced: '☁️ GitHub синхр.',
    syncing: '⏳ Синхронизация...',
    syncIssue: '⚠️ Ошибка синхр.',
    liveView: '👁️ Просмотр',
    loadFailed: '⚠️ Ошибка загрузки',
    btnSync: 'Синхр.',
    btnSynced: 'Синхр.',
    btnSyncing: 'Синхр...',
    btnShareView: 'Поделиться',
    btnCopyList: 'Копировать',
    btnBackup: 'Бэкап',
    statToday: 'Сегодня',
    statWeek: 'За неделю',
    statTotal: 'Всего дел',
    statPhotos: 'С фото',

    scoreboardTitle: 'Очередь и счёт',
    editNames: 'Имена',
    periodWeek: 'Неделя',
    periodToday: 'Сегодня',
    periodAll: 'За всё время',
    turnsEven: '⚖️ Поровну!',
    turnsNone: '✨ Добавьте дело, чтобы считать очередь',
    aheadBy: (leader, trailing, diff) => `🔥 ${leader} впереди на ${diff} (${trailing} догоняет)`,
    whoseTurnTitle: 'Чья очередь следующая?',
    whoseTurnEmpty: 'Запишите любое дело — DoneLog сам подскажет, чья очередь следующая.',
    nextTurnBadge: (name) => `👉 Очередь: ${name}`,
    lastDoneBy: (name, when) => `Последний раз: ${name} • ${when}`,
    notLoggedYet: 'Ещё не делали',

    viewerBadge: '👁️ Режим просмотра',
    viewerTitle: 'Подтверждённый список дел',
    viewerDesc: 'Вы просматриваете список выполненных дел с точным временем, счётом очереди и фото-доказательствами. Нажмите на фото, чтобы открыть на весь экран.',
    btnRefreshView: '🔄 Обновить',
    btnExitView: 'Открыть мой DoneLog →',

    logHeading: 'Записать выполненное дело',
    whoDidIt: 'Кто сделал?',
    quickPick: 'Быстрый выбор',
    editList: 'Изменить',
    taskLabel: 'Дело / задача',
    taskPlaceholder: 'например, Помыл всю посуду',
    noteLabel: 'Комментарий',
    optional: '(необязательно)',
    notePlaceholder: 'например, ещё протёр плиту и убрал посуду',
    whenLabel: 'Когда выполнено?',
    customTime: 'Указать время',
    autoTimeHint: 'Автоматически сохраняет точные дату и время.',
    photosLabel: 'Фото-доказательство',
    beforeSlot: 'До (необязательно)',
    afterSlot: 'После / Фото',
    photoTapHint: 'Нажмите или перетащите',
    stampToggle: '🕒 Штамп даты и времени на фото',
    btnMarkDone: 'Отметить выполненным',
    btnSaving: 'Сохранение...',
    fabLog: '+ Записать дело',

    filterAll: 'Все',
    filterToday: 'Сегодня',
    filterWeek: 'Неделя',
    filterMonth: 'Месяц',
    whoAll: 'Все',
    searchPlaceholder: 'Поиск дел и заметок...',
    withPhoto: '📷 С фото',
    loadingTitle: 'Загрузка списка...',
    loadingDesc: 'Получаем дела и фото из GitHub Gist.',
    emptyTitle: 'Пока ничего нет',
    emptyDescOwner: 'Запишите первое дело слева — и подключите бесплатную синхронизацию с GitHub, чтобы данные хранились на ПК и телефоне.',
    emptyDescViewer: 'Пока не записано ни одного дела.',
    noMatchTitle: 'Ничего не найдено',
    noMatchDesc: 'Попробуйте сменить фильтр или очистить поиск.',
    taskSingular: 'дело',
    taskPlural: 'дел',
    today: 'Сегодня',
    yesterday: 'Вчера',
    justNow: 'Только что',
    scheduled: 'Запланировано',
    badgeBefore: 'ДО',
    badgeAfter: 'ПОСЛЕ',
    badgeProof: '📷 Фото',
    doneByPrefix: 'Сделал:',

    syncModalTitle: '☁️ Бесплатная синхронизация ПК ↔ Телефон',
    connectedAs: (u) => `Подключено как @${u}`,
    connectedGeneric: 'Подключено к GitHub Gist',
    lastSynced: (when) => `Синхронизировано: ${when}`,
    readyToSync: 'Готово к синхронизации',
    copyTokenPhone: '📋 Скопировать токен',
    copyBrotherLink: '👁️ Ссылка для брата',
    privateGist: 'Открыть Gist ↗',
    syncPhoneHeading: 'Чтобы подключить телефон:',
    syncPhoneBody: 'Откройте эту же ссылку DoneLog на телефоне, нажмите ☁️ Синхр. и вставьте тот же GitHub-токен — дела и фото синхронизируются автоматически!',
    syncBrotherHeading: 'Чтобы показать брату (только просмотр):',
    syncBrotherBody: 'Нажмите 👁️ Ссылка для брата и отправьте ему. Он увидит все дела, очередь, время и фото без входа — и не сможет ничего удалить или изменить.',
    signOutDevice: 'Выйти на этом устройстве',
    syncNow: '🔄 Синхронизировать',
    syncSetupDesc: 'Синхронизируйте дела, очередь, время и фото «До / После» между ПК и телефоном через приватный GitHub Gist — полностью бесплатно навсегда!',
    syncStep1Title: 'Используйте ваш токен от LifeQuest или создайте бесплатный GitHub-токен (нужна только галочка gist):',
    createTokenBtn: '🔑 Создать GitHub-токен ↗',
    syncStep1Hint: 'Выберите срок действия No expiration (или 1 год), нажмите Generate token и скопируйте код ghp_... DoneLog хранит данные в отдельном файле и не мешает LifeQuest.',
    syncStep2Title: 'Вставьте токен на ПК и телефоне',
    syncStep2Hint: 'Первое устройство создаст приватное хранилище, а второе найдёт его автоматически по тому же токену!',
    tokenLabel: 'GitHub Sync Token',
    tokenScopeHint: '(права gist)',
    tokenPrivacy: '🔒 Хранится только в этом браузере и обращается напрямую к официальному API GitHub.',
    cancel: 'Отмена',
    connectAndSync: '☁️ Подключить и синхронизировать',
    connecting: '⏳ Подключение...',

    editModalTitle: 'Редактировать запись',
    dateTimeLabel: 'Дата и время',
    saveChanges: 'Сохранить',

    namesModalTitle: 'Имена участников',
    namesModalDesc: 'Настройте имена для таблицы очереди и счёта.',
    myNameLabel: 'Ваше имя',
    brotherNameLabel: 'Имя брата',
    myNameDefault: 'Я',
    brotherNameDefault: 'Брат',

    presetsModalTitle: 'Быстрые дела',
    presetPlaceholder: 'Новое дело (например, Полил цветы)',
    add: 'Добавить',
    resetDefaults: 'Сбросить',
    done: 'Готово',
    noPresets: 'Список пуст.',

    backupModalTitle: 'Резервная копия',
    backupModalDesc: 'Скачайте полную копию всех дел, очереди и фото в JSON или восстановите из файла.',
    downloadBackup: 'Скачать бэкап (.json)',
    restoreBackup: 'Восстановить из файла (.json)',

    lightboxCompleted: (who, when) => `${who} • ${when}`,
    lightboxBefore: 'До',
    lightboxAfter: 'После',

    toastEnterTask: 'Введите, что было сделано',
    toastLoggedSynced: 'Сохранено и отправлено в GitHub!',
    toastLoggedLocal: 'Сохранено! Подключите ☁️ Синхр. для переноса на телефон',
    toastUpdated: 'Запись обновлена',
    toastDeleted: 'Запись удалена',
    toastNamesSaved: 'Имена обновлены!',
    toastPresetAdded: 'Дело добавлено в список',
    toastDefaultsRestored: 'Список восстановлен',
    toastNothingToCopy: 'Пока нечего копировать',
    toastCopiedItems: (n) => `Скопировано записей: ${n}`,
    toastCopiedBrother: 'Ссылка для брата скопирована! (Только просмотр)',
    toastCopiedToken: 'Токен скопирован для телефона!',
    toastClipboardErr: 'Нет доступа к буферу обмена',
    toastBackupDone: 'Бэкап скачан',
    toastBackupRestored: 'Бэкап восстановлен!',
    toastInvalidBackup: 'Неверный файл бэкапа',
    toastSynced: 'Синхронизировано с GitHub!',
    toastSignedOut: 'Выход выполнен на этом устройстве',
    toastConnectFirst: 'Сначала подключите GitHub Синхр., чтобы получить ссылку',
    toastTurnPrefilled: (chore, who) => `Готово: «${chore}» — ${who}`,
    confirmDelete: (title) => `Удалить «${title}»?`,
    confirmSignOut: 'Выйти из GitHub Sync на этом устройстве? Локальные записи останутся здесь, а приватный Gist — на GitHub.',
    confirmRestore: (n) => `Восстановить записей: ${n}? Текущий список будет заменён.`,
    copyHeader: '✅ Список выполненных дел:'
  }
};

export function loadSavedLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'ru') return saved;
  } catch {
    // ignore
  }
  return 'en';
}

export function saveLang(lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignore
  }
}

export function getLocale(lang) {
  return lang === 'ru' ? 'ru-RU' : 'en-US';
}

export function getPresetDisplayLabel(preset, lang) {
  const dict = DEFAULT_PRESET_LABELS[lang];
  if (dict && preset?.id && dict[preset.id]) {
    const enDefault = DEFAULT_PRESET_LABELS.en[preset.id];
    const ruDefault = DEFAULT_PRESET_LABELS.ru[preset.id];
    // Translate only if the user hasn't renamed this built-in preset to something custom
    if (preset.label === enDefault || preset.label === ruDefault) {
      return dict[preset.id];
    }
  }
  return preset?.label || '';
}

export function formatCountLabel(count, lang) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  if (lang !== 'ru') {
    return `${count} ${count === 1 ? dict.taskSingular : dict.taskPlural}`;
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} дело`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} дела`;
  return `${count} дел`;
}
