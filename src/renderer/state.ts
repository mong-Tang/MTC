interface ArchivePage {
  index: number;
  entryName: string;
  displayName: string;
}

interface ArchiveMeta {
  title: string;
  totalPages: number;
  hasEncryptedEntries: boolean;
  fileId: string;
}

interface ArchiveOpenResult {
  meta: ArchiveMeta;
  pages: ArchivePage[];
}

interface ArchivePageData {
  entryName: string;
  mimeType: string;
  bytes: ArrayBuffer;
}

interface SerializableAppError {
  code: string;
  message: string;
}

interface RecentItem {
  fileId: string;
  zipPath: string;
  title: string;
  lastPageIndex: number;
  lastOpenedAt: string;
}

interface UpsertRecentInput {
  fileId: string;
  zipPath: string;
  title: string;
  lastPageIndex: number;
}

type SidebarItemType = 'zip' | 'image' | 'archive';
type PageViewMode = 'single' | 'double';
type ImageFitMode = 'auto' | 'actual' | 'width' | 'height';
type FileTransferMode = 'copy' | 'cut';

interface SidebarListItem {
  name: string;
  path: string;
  type: SidebarItemType;
  extension: string;
}

interface OpenedImageFile {
  path: string;
  name: string;
  mimeType: string;
  bytes: ArrayBuffer;
}

interface ImageDimensions {
  width: number;
  height: number;
}

interface FileTransferClipboard {
  sourcePath: string;
  sourceName: string;
  mode: FileTransferMode;
}

type Locale = 'ko' | 'en';
type I18nParams = Record<string, string | number>;
type I18nDictionary = Record<string, string>;
type I18nDictionaries = Record<Locale, I18nDictionary>;
type MenuAction =
  | 'open-file'
  | 'open-folder'
  | 'close-file'
  | 'show-launcher'
  | 'show-viewer'
  | 'show-settings'
  | 'toggle-folder-list'
  | 'move-prev-page'
  | 'move-next-page'
  | 'move-prev-10-pages'
  | 'move-next-10-pages'
  | 'open-prev-book'
  | 'open-next-book'
  | 'move-first-page'
  | 'move-last-page'
  | 'file-copy'
  | 'file-cut'
  | 'file-delete'
  | 'file-paste'
  | 'file-cancel-transfer'
  | 'edit-delete-left-page'
  | 'edit-delete-right-page'
  | 'edit-insert-after-current-page'
  | 'view-single-page'
  | 'view-double-page'
  | 'image-fit-auto'
  | 'image-fit-actual'
  | 'image-fit-width'
  | 'image-fit-height'
  | 'theme-light'
  | 'theme-dark'
  | 'theme-system';
type ViewMode = 'launcher' | 'viewer' | 'settings';

const dictionaries: I18nDictionaries = {
  ko: {},
  en: {}
};

let currentLocale: Locale = 'ko';

function t(key: string, params?: I18nParams): string {
  const fallbackLocale: Locale = currentLocale === 'ko' ? 'en' : 'ko';
  const source = dictionaries[currentLocale]?.[key] ?? dictionaries[fallbackLocale]?.[key] ?? key;

  if (source === key) {
    console.warn(`[i18n] missing key: ${key}`);
  }

  if (!params) {
    return source;
  }

  return Object.entries(params).reduce((acc, [paramKey, value]) => acc.replaceAll(`{${paramKey}}`, String(value)), source);
}

function getLocale(): Locale {
  return currentLocale;
}

function setLocale(locale: Locale): void {
  currentLocale = locale;
  void window.appApi.setAppLocale(locale).catch((error) => {
    console.warn('[i18n] failed to sync app locale:', error);
  });
  void window.appApi.updateAppSettings({ locale }).catch((error) => {
    console.warn('[settings] failed to persist locale:', error);
  });
}

function applyLocaleFromMenu(locale: Locale): void {
  currentLocale = locale;
}

function isDictionary(candidate: unknown): candidate is I18nDictionary {
  return !!candidate && typeof candidate === 'object' && Object.values(candidate as Record<string, unknown>).every((value) => typeof value === 'string');
}

function isI18nDictionaries(candidate: unknown): candidate is I18nDictionaries {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const value = candidate as Record<string, unknown>;
  return isDictionary(value.ko) && isDictionary(value.en);
}

async function loadI18nDictionaries(): Promise<void> {
  try {
    const loaded = await window.appApi.getI18nDictionaries();
    if (!isI18nDictionaries(loaded)) {
      throw new Error('Invalid i18n payload.');
    }

    dictionaries.ko = loaded.ko;
    dictionaries.en = loaded.en;
  } catch (error) {
    console.warn('[i18n] failed to load dictionaries:', error);
  }
}

interface AppState {
  currentView: ViewMode;
  archive: ArchiveOpenResult | null;
  openedImage: OpenedImageFile | null;
  zipPath: string | null;
  currentPageIndex: number;
  recentItems: RecentItem[];
  pageObjectUrl: string | null;
  pageRenderToken: number;
  activeError: SerializableAppError | null;
  viewerRenderInFlight: boolean;
  queuedPageIndex: number | null;
  sidebarWidth: number;
  currentFolderPath: string | null;
  sidebarItems: SidebarListItem[];
  bookNavItems: SidebarListItem[];
  selectedSidebarItemPath: string | null;
  fileTransferClipboard: FileTransferClipboard | null;
  pageViewMode: PageViewMode;
  imageFitMode: ImageFitMode;
  showSidebarList: boolean;
  dragDebugText: string;
  skipRecentSyncOnce: boolean;
}

const state: AppState = {
  currentView: 'launcher',
  archive: null,
  openedImage: null,
  zipPath: null,
  currentPageIndex: 0,
  recentItems: [],
  pageObjectUrl: null,
  pageRenderToken: 0,
  activeError: null,
  viewerRenderInFlight: false,
  queuedPageIndex: null,
  sidebarWidth: 260,
  currentFolderPath: null,
  sidebarItems: [],
  bookNavItems: [],
  selectedSidebarItemPath: null,
  fileTransferClipboard: null,
  pageViewMode: 'single',
  imageFitMode: 'auto',
  showSidebarList: false,
  dragDebugText: 'drag: idle',
  skipRecentSyncOnce: false
};

let dragDepth = 0;
const boundDragTargets = new WeakSet<EventTarget>();

function getErrorMessage(error: SerializableAppError): string {
  if (error.code === 'DROP_DEBUG' || error.code === 'CONVERTER_REQUIRED') {
    return error.message;
  }

  const mapping: Record<string, string> = {
    FILE_NOT_FOUND: 'error.fileNotFound',
    FILE_ACCESS_DENIED: 'error.fileAccessDenied',
    ZIP_INVALID_FORMAT: 'error.zip.invalidFormat',
    ZIP_CORRUPTED: 'error.zip.corrupted',
    ZIP_ENCRYPTED: 'error.zip.encrypted',
    ZIP_NO_IMAGE: 'error.zip.noImage',
    ZIP_PAGE_NOT_FOUND: 'error.zip.pageNotFound',
    UNSUPPORTED_FILE_TYPE: 'error.zip.onlyZip',
    ZIP_OPEN_FAILED: 'error.zip.openFailed',
    UNKNOWN: 'error.unknown'
  };

  const key = mapping[error.code] ?? 'error.unknown';
  return t(key);
}

function isArchiveValidationError(errorCode: string): boolean {
  return (
    errorCode === 'ZIP_CORRUPTED' ||
    errorCode === 'ZIP_INVALID_FORMAT' ||
    errorCode === 'ZIP_ENCRYPTED' ||
    errorCode === 'ZIP_NO_IMAGE' ||
    errorCode === 'ZIP_OPEN_FAILED' ||
    errorCode === 'FILE_NOT_FOUND' ||
    errorCode === 'FILE_ACCESS_DENIED'
  );
}

function showArchiveValidationModal(error: SerializableAppError): void {
  window.alert(getErrorMessage(error));
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }
  return element as T;
}

const elements = {
  sidebar: () => document.querySelector('.sidebar') as HTMLElement,
  sidebarTitle: () => byId<HTMLDivElement>('sidebar-title'),
  sidebarDragLayer: () => byId<HTMLDivElement>('sidebar-drag-layer'),
  fileTree: () => byId<HTMLDivElement>('file-tree'),
  workspace: () => byId<HTMLElement>('workspace'),
  launcherView: () => byId<HTMLDivElement>('view-launcher'),
  viewerView: () => byId<HTMLDivElement>('view-viewer'),
  settingsView: () => byId<HTMLDivElement>('view-settings'),
  viewerImage: () => byId<HTMLDivElement>('viewer-image'),
  settingsPlaceholder: () => byId<HTMLDivElement>('settings-placeholder'),
  globalError: () => byId<HTMLDivElement>('global-error'),
  dropOverlay: () => byId<HTMLDivElement>('drop-overlay'),
  splitter: () => byId<HTMLDivElement>('splitter'),
  dropOverlayText: () => byId<HTMLDivElement>('drop-overlay-text'),
  notificationModal: () => byId<HTMLDivElement>('notification-modal'),
  notificationModalText: () => byId<HTMLDivElement>('notification-modal-text'),
  sizeAdjustModal: () => byId<HTMLDivElement>('size-adjust-modal'),
  sizeAdjustTitle: () => byId<HTMLHeadingElement>('size-adjust-title'),
  sizeAdjustMessage: () => byId<HTMLDivElement>('size-adjust-message'),
  sizeAdjustCancel: () => byId<HTMLButtonElement>('size-adjust-cancel'),
  sizeAdjustOriginal: () => byId<HTMLButtonElement>('size-adjust-original'),
  sizeAdjustConfirm: () => byId<HTMLButtonElement>('size-adjust-confirm'),
  // Launcher
  launcherWordmark: () => document.getElementById('launcher-wordmark') as HTMLElement | null,
  launcherTagline: () => document.getElementById('launcher-tagline') as HTMLElement | null,
  launcherBtnOpenFile: () => document.getElementById('launcher-btn-open-file') as HTMLButtonElement | null,
  launcherBtnOpenFolder: () => document.getElementById('launcher-btn-open-folder') as HTMLButtonElement | null,
  launcherRecentLabel: () => document.getElementById('launcher-recent-label') as HTMLElement | null,
  launcherRecentList: () => document.getElementById('launcher-recent-list') as HTMLUListElement | null,
  launcherRecentEmpty: () => document.getElementById('launcher-recent-empty') as HTMLElement | null,
  // Status Bar
  statusBar: () => document.getElementById('custom-status-bar') as HTMLElement | null,
  statusLeft: () => document.getElementById('status-left-text') as HTMLElement | null,
  statusBadge: () => document.getElementById('status-badge') as HTMLElement | null,
  statusRight: () => document.getElementById('status-right') as HTMLElement | null
};
