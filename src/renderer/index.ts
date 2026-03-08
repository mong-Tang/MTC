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
  bytes: number[];
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
  bytes: number[];
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
  | 'image-fit-height';
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
  pageMoveToast: () => byId<HTMLDivElement>('page-move-toast'),
  sizeAdjustModal: () => byId<HTMLDivElement>('size-adjust-modal'),
  sizeAdjustTitle: () => byId<HTMLHeadingElement>('size-adjust-title'),
  sizeAdjustMessage: () => byId<HTMLDivElement>('size-adjust-message'),
  sizeAdjustCancel: () => byId<HTMLButtonElement>('size-adjust-cancel'),
  sizeAdjustOriginal: () => byId<HTMLButtonElement>('size-adjust-original'),
  sizeAdjustConfirm: () => byId<HTMLButtonElement>('size-adjust-confirm')
};

let pageMoveToastTimer: number | null = null;
let sizeAdjustChoiceResolver: ((choice: 'cancel' | 'original' | 'confirm') => void) | null = null;

function setSidebarListVisible(visible: boolean): void {
  elements.workspace().classList.toggle('sidebar-collapsed', !visible);
  elements.sidebarTitle().classList.toggle('hidden', !visible);
  elements.fileTree().classList.toggle('hidden', !visible);
  elements.sidebarDragLayer().classList.toggle('hidden', !visible);
}

function applySidebarVisibility(): void {
  setSidebarListVisible(state.showSidebarList && Boolean(state.currentFolderPath));
  reflowRenderedViewerImages();
  window.requestAnimationFrame(() => {
    reflowRenderedViewerImages();
  });
}

function getViewTitleKey(view: ViewMode): string {
  const mapping: Record<ViewMode, string> = {
    launcher: 'launcher.title',
    viewer: 'viewer.title',
    settings: 'tree.settings'
  };

  return mapping[view];
}

function switchView(view: ViewMode): void {
  state.currentView = view;
  elements.launcherView().classList.toggle('hidden', view !== 'launcher');
  elements.viewerView().classList.toggle('hidden', view !== 'viewer');
  elements.settingsView().classList.toggle('hidden', view !== 'settings');
  applySidebarVisibility();
  syncPageEditStateToMenu();
}

function renderGlobalError(): void {
  elements.globalError().textContent = state.activeError ? getErrorMessage(state.activeError) : '';
}

function clearError(): void {
  state.activeError = null;
  renderGlobalError();
}

function showError(error: SerializableAppError): void {
  state.activeError = error;
  renderGlobalError();
}

function normalizePathForCompare(filePath: string): string {
  return filePath.replace(/\//g, '\\').toLowerCase();
}

function isSamePath(left: string, right: string): boolean {
  return normalizePathForCompare(left) === normalizePathForCompare(right);
}

function getSelectedSidebarItem(): SidebarListItem | null {
  if (!state.selectedSidebarItemPath) {
    return null;
  }

  return state.sidebarItems.find((item) => isSamePath(item.path, state.selectedSidebarItemPath as string)) ?? null;
}

function getCurrentFilePathForTransfer(): string | null {
  const selected = getSelectedSidebarItem();
  if (selected) {
    return selected.path;
  }

  if (state.openedImage?.path) {
    return state.openedImage.path;
  }

  if (state.zipPath) {
    return state.zipPath;
  }

  return null;
}

function isOpenedFilePath(filePath: string): boolean {
  return (
    (!!state.zipPath && isSamePath(state.zipPath, filePath)) ||
    (!!state.openedImage?.path && isSamePath(state.openedImage.path, filePath))
  );
}

function setSelectedSidebarItem(itemPath: string | null): void {
  state.selectedSidebarItemPath = itemPath;
  syncFileSelectionStateToMenu();
  renderSidebarItems();
}

function syncFileEditStateToMenu(): void {
  window.appApi.updateFileEditState(state.fileTransferClipboard !== null);
}

function syncFileSelectionStateToMenu(): void {
  window.appApi.updateFileSelectionState(state.selectedSidebarItemPath !== null);
}

function canEditCurrentPage(): boolean {
  return state.currentView === 'viewer' && !!state.archive && !!state.archive.pages[state.currentPageIndex];
}

function canEditRightPage(): boolean {
  return (
    state.currentView === 'viewer' &&
    state.pageViewMode === 'double' &&
    !!state.archive &&
    !!state.archive.pages[state.currentPageIndex + 1]
  );
}

function syncPageEditStateToMenu(): void {
  window.appApi.updatePageEditState({
    canEditLeftPage: canEditCurrentPage(),
    canEditRightPage: canEditRightPage()
  });
}

function getNavigableSidebarItems(): SidebarListItem[] {
  const visibleItems = state.sidebarItems.filter((item) => item.type === 'zip' || item.type === 'image');
  const currentPath = getCurrentOpenedPathForBookNavigation();
  const sourceItems =
    currentPath && visibleItems.some((item) => isSamePath(item.path, currentPath))
      ? visibleItems
      : state.bookNavItems.filter((item) => item.type === 'zip' || item.type === 'image');

  if (!currentPath) {
    return sourceItems;
  }

  const currentItem = sourceItems.find((item) => isSamePath(item.path, currentPath));
  if (!currentItem) {
    return sourceItems;
  }

  const currentSeriesKey = getSeriesKeyFromName(currentItem.name);
  return sourceItems.filter((item) => item.type === currentItem.type && getSeriesKeyFromName(item.name) === currentSeriesKey);
}

function getSeriesKeyFromName(fileName: string): string {
  const normalized = fileName.replace(/\.[^.]+$/, '').toLowerCase().trim();
  const compacted = normalized.replace(/\s+/g, ' ').trim();
  const withoutTrailingParens = compacted.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const withoutVolumeLike = withoutTrailingParens.replace(/[\s._-]*\d+[a-z가-힣]*$/, '').trim();
  const withoutDecorators = withoutVolumeLike.replace(/[\s._-]+$/g, '').trim();
  return withoutDecorators || withoutTrailingParens || compacted || normalized;
}

function getCurrentOpenedPathForBookNavigation(): string | null {
  if (state.zipPath) {
    return state.zipPath;
  }

  if (state.openedImage?.path) {
    return state.openedImage.path;
  }

  return null;
}

function getCurrentOpenedBookIndex(): number {
  const currentPath = getCurrentOpenedPathForBookNavigation();
  if (!currentPath) {
    return -1;
  }

  const items = getNavigableSidebarItems();
  return items.findIndex((item) => isSamePath(item.path, currentPath));
}

function syncBookNavigationStateToMenu(): void {
  const index = getCurrentOpenedBookIndex();
  const items = getNavigableSidebarItems();
  const hasNavigable = items.length > 0 && index >= 0;

  window.appApi.updateBookNavState({
    canOpenPrevBook: hasNavigable && index > 0,
    canOpenNextBook: hasNavigable && index < items.length - 1
  });
}

function canOpenNextBookFromCurrent(): boolean {
  const index = getCurrentOpenedBookIndex();
  const items = getNavigableSidebarItems();
  return items.length > 0 && index >= 0 && index < items.length - 1;
}

function canOpenPrevBookFromCurrent(): boolean {
  const index = getCurrentOpenedBookIndex();
  const items = getNavigableSidebarItems();
  return items.length > 0 && index > 0;
}

async function refreshBookNavigationItemsFromCurrentFile(): Promise<void> {
  const currentPath = getCurrentOpenedPathForBookNavigation();
  if (!currentPath) {
    state.bookNavItems = [];
    syncBookNavigationStateToMenu();
    return;
  }

  const directoryPath = getDirectoryPath(currentPath);
  const result = await window.appApi.listFolderItems(directoryPath);
  if (!result.ok) {
    return;
  }

  state.bookNavItems = result.data;
  syncBookNavigationStateToMenu();
}

function setFileTransferClipboard(clipboard: FileTransferClipboard | null): void {
  state.fileTransferClipboard = clipboard;
  syncFileEditStateToMenu();
}

function setDragDebugText(text: string): void {
  state.dragDebugText = text;
}

function syncViewerStatusToMenu(statusText: string): void {
  window.appApi.updateViewerStatus(statusText);
}

function getCurrentOpenedFileName(): string {
  if (state.openedImage?.name) {
    return state.openedImage.name;
  }

  if (state.zipPath) {
    return state.zipPath.split(/[/\\]/).pop() ?? '';
  }

  return '';
}

function composeViewerStatusText(statusText: string): string {
  const fileName = getCurrentOpenedFileName();
  if (!fileName) {
    return statusText;
  }

  if (!statusText) {
    return fileName;
  }

  return `${fileName} | ${statusText}`;
}

function syncRecentItemsToMenu(): void {
  window.appApi.updateRecentMenu(
    state.recentItems.slice(0, 10).map((item) => ({
      zipPath: item.zipPath,
      title: item.title
    }))
  );
}

function persistViewerPreferences(): void {
  void window.appApi
    .updateAppSettings({
      locale: getLocale(),
      pageViewMode: state.pageViewMode,
      imageFitMode: state.imageFitMode,
      showSidebarList: state.showSidebarList,
      sidebarWidth: state.sidebarWidth
    })
    .catch((error) => {
      console.warn('[settings] failed to persist viewer preferences:', error);
    });
}

function setDropOverlayVisible(visible: boolean): void {
  elements.dropOverlay().classList.toggle('hidden', !visible);
}

function showPageMoveToast(step: number): void {
  if (!state.archive) {
    return;
  }

  const toast = elements.pageMoveToast();
  const delta = step > 0 ? `+${Math.abs(step)}` : `-${Math.abs(step)}`;
  toast.textContent = t('viewer.toast.move', {
    delta,
    current: state.currentPageIndex + 1,
    total: state.archive.meta.totalPages
  });
  toast.classList.remove('hidden');

  if (pageMoveToastTimer !== null) {
    window.clearTimeout(pageMoveToastTimer);
  }

  pageMoveToastTimer = window.setTimeout(() => {
    toast.classList.add('hidden');
    pageMoveToastTimer = null;
  }, 900);
}

function setSidebarDragLayerActive(active: boolean): void {
  elements.sidebarDragLayer().classList.toggle('active', active);
}

function isZipPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.zip');
}

function isImagePath(filePath: string): boolean {
  return /\.(png|jpe?g|gif|bmp|webp)$/i.test(filePath);
}

function getDirectoryPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  if (index <= 0) {
    return filePath;
  }
  const directory = index === 2 && /^[A-Za-z]:/.test(normalized) ? normalized.slice(0, index + 1) : normalized.slice(0, index);
  return directory.replace(/\//g, '\\');
}

function decodeDroppedFileUri(uri: string): string | null {
  const trimmed = uri.trim();
  if (!trimmed.toLowerCase().startsWith('file://')) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const pathname = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:/.test(pathname)) {
      return pathname.slice(1);
    }
    return pathname || null;
  } catch {
    return null;
  }
}

function describeDataTransfer(dataTransfer: DataTransfer): string {
  const types = Array.from(dataTransfer.types ?? []).join(', ') || '(none)';
  const fileNames = Array.from(dataTransfer.files ?? [])
    .map((file) => {
      const legacyPath = (file as File & { path?: string }).path ?? '';
      return legacyPath || file.name;
    })
    .join(', ') || '(none)';
  const items = Array.from(dataTransfer.items ?? [])
    .map((item) => `${item.kind}:${item.type || '(empty)'}`)
    .join(', ') || '(none)';

  return `drop types=[${types}] items=[${items}] files=[${fileNames}]`;
}

function describeDragEvent(eventName: string, event: DragEvent): string {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) {
    return `drag: ${eventName} (no dataTransfer)`;
  }

  const types = Array.from(dataTransfer.types ?? []).join(', ') || '(none)';
  const fileCount = dataTransfer.files?.length ?? 0;
  const target = event.target instanceof Element
    ? `${event.target.tagName.toLowerCase()}${event.target.id ? `#${event.target.id}` : ''}${event.target.className ? `.${String(event.target.className).trim().replace(/\s+/g, '.')}` : ''}`
    : 'unknown';
  return `drag: ${eventName} target=[${target}] types=[${types}] files=${fileCount}`;
}

type DroppedEntryLike = {
  isDirectory?: boolean;
  isFile?: boolean;
  name?: string;
  fullPath?: string;
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => DroppedEntryLike | null;
};

type DroppedZipResolutionReason = 'zip-path-found' | 'directory-dropped' | 'zip-without-path' | 'non-zip-file' | 'no-file-payload';

interface DroppedZipResolution {
  zipPath: string | null;
  reason: DroppedZipResolutionReason;
  details: string[];
}

function getDroppedEntry(item: DataTransferItem): DroppedEntryLike | null {
  const itemWithEntry = item as DataTransferItemWithEntry;
  if (typeof itemWithEntry.webkitGetAsEntry !== 'function') {
    return null;
  }

  try {
    return itemWithEntry.webkitGetAsEntry();
  } catch {
    return null;
  }
}

function resolveDroppedZip(dataTransfer: DataTransfer): DroppedZipResolution {
  const itemFiles = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
  const files = itemFiles.length > 0 ? itemFiles : Array.from(dataTransfer.files);
  const details: string[] = [];
  let sawDirectory = false;
  let sawZipWithoutPath = false;
  let sawNonZipFile = false;

  for (const item of Array.from(dataTransfer.items ?? [])) {
    const entry = getDroppedEntry(item);
    if (entry?.isDirectory) {
      sawDirectory = true;
      details.push(`directory=${entry.name || entry.fullPath || '(unknown)'}`);
    }
  }

  for (const file of files) {
    const legacyPath = (file as File & { path?: string }).path ?? '';
    const resolvedPath = window.appApi.getPathForDroppedFile(file) || legacyPath;
    const candidatePath = resolvedPath || file.name;
    if (!candidatePath || !isZipPath(candidatePath)) {
      sawNonZipFile = true;
      details.push(`non-zip=${candidatePath || file.name || '(empty)'}`);
      continue;
    }

    if (!resolvedPath) {
      sawZipWithoutPath = true;
      details.push(`zip-without-path=${candidatePath}`);
      continue;
    }

    return {
      zipPath: resolvedPath,
      reason: 'zip-path-found',
      details: [`zip=${resolvedPath}`]
    };
  }

  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList) {
    for (const uri of uriList.split(/\r?\n/)) {
      const resolvedPath = decodeDroppedFileUri(uri);
      if (resolvedPath && isZipPath(resolvedPath)) {
        return {
          zipPath: resolvedPath,
          reason: 'zip-path-found',
          details: [`uri=${resolvedPath}`]
        };
      }
    }
  }

  const plainText = dataTransfer.getData('text/plain');
  if (plainText) {
    for (const value of plainText.split(/\r?\n/)) {
      const resolvedPath = decodeDroppedFileUri(value) ?? value.trim();
      if (resolvedPath && isZipPath(resolvedPath)) {
        return {
          zipPath: resolvedPath,
          reason: 'zip-path-found',
          details: [`text=${resolvedPath}`]
        };
      }
    }
  }

  if (sawDirectory) {
    return { zipPath: null, reason: 'directory-dropped', details };
  }
  if (sawZipWithoutPath) {
    return { zipPath: null, reason: 'zip-without-path', details };
  }
  if (sawNonZipFile) {
    return { zipPath: null, reason: 'non-zip-file', details };
  }
  return { zipPath: null, reason: 'no-file-payload', details };
}

function describeDroppedZipResolution(resolution: DroppedZipResolution): string {
  const suffix = resolution.details.length > 0 ? ` details=[${resolution.details.join(', ')}]` : '';
  return `${resolution.reason}${suffix}`;
}

function hasFilePayload(event: DragEvent): boolean {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) {
    return false;
  }

  if (dataTransfer.files.length > 0) {
    return true;
  }

  if (Array.from(dataTransfer.items ?? []).some((item) => item.kind === 'file')) {
    return true;
  }

  return Array.from(dataTransfer.types).includes('Files');
}

function onDragEnter(event: DragEvent): void {
  setDragDebugText(describeDragEvent('enter', event));
  if (!hasFilePayload(event)) {
    return;
  }

  event.preventDefault();
  dragDepth += 1;
  setDropOverlayVisible(true);
  setSidebarDragLayerActive(true);
}

function onDragOver(event: DragEvent): void {
  setDragDebugText(describeDragEvent('over', event));
  if (!hasFilePayload(event)) {
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
  setDropOverlayVisible(true);
  setSidebarDragLayerActive(true);
}

function onDragLeave(event: DragEvent): void {
  setDragDebugText(describeDragEvent('leave', event));
  if (!hasFilePayload(event)) {
    return;
  }

  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    setDropOverlayVisible(false);
    setSidebarDragLayerActive(false);
    setDragDebugText('drag: idle');
  }
}

function onDrop(event: DragEvent): void {
  setDragDebugText(describeDragEvent('drop', event));
  if (!hasFilePayload(event)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  dragDepth = 0;
  setDropOverlayVisible(false);
  setSidebarDragLayerActive(false);

  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) {
    return;
  }

  const droppedZip = resolveDroppedZip(dataTransfer);
  if (!droppedZip.zipPath) {
    showError({
      code: 'DROP_DEBUG',
      message: `${t('error.zip.onlyZip')} (${describeDroppedZipResolution(droppedZip)}; ${describeDataTransfer(dataTransfer)})`
    });
    setDragDebugText(`drag: drop rejected [${describeDroppedZipResolution(droppedZip)}] (${describeDataTransfer(dataTransfer)})`);
    return;
  }

  void openZipPath(droppedZip.zipPath);
}

function bindDragListeners(target: EventTarget): void {
  if (boundDragTargets.has(target)) {
    return;
  }

  target.addEventListener('dragenter', (event) => onDragEnter(event as DragEvent), true);
  target.addEventListener('dragover', (event) => onDragOver(event as DragEvent), true);
  target.addEventListener('dragleave', (event) => onDragLeave(event as DragEvent), true);
  target.addEventListener('drop', (event) => onDrop(event as DragEvent), true);
  boundDragTargets.add(target);
}

function revokePageObjectUrl(): void {
  if (!state.pageObjectUrl) {
    return;
  }

  for (const objectUrl of state.pageObjectUrl.split('\n')) {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
  state.pageObjectUrl = null;
}

function resetOpenedContent(): void {
  revokePageObjectUrl();
  state.archive = null;
  state.openedImage = null;
  state.zipPath = null;
  state.currentPageIndex = 0;
  state.bookNavItems = [];
  state.pageRenderToken += 1;
  state.queuedPageIndex = null;
  elements.viewerImage().innerHTML = '';
  syncViewerStatusToMenu('');
  syncPageEditStateToMenu();
  syncBookNavigationStateToMenu();
}

function clearSidebarListContext(): void {
  state.currentFolderPath = null;
  state.sidebarItems = [];
  state.selectedSidebarItemPath = null;
  syncFileSelectionStateToMenu();
  syncBookNavigationStateToMenu();
}

function renderImageBytes(name: string, mimeType: string, bytes: number[]): void {
  const viewerImage = elements.viewerImage();
  const imageElement = document.createElement('img');
  const blob = new Blob([Uint8Array.from(bytes)], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  imageElement.src = objectUrl;
  imageElement.alt = name;
  imageElement.className = `viewer-image-content fit-${state.imageFitMode}`;
  imageElement.draggable = false;
  applyViewerImageSizing(imageElement, state.pageViewMode === 'double');

  revokePageObjectUrl();
  state.pageObjectUrl = objectUrl;

  viewerImage.innerHTML = '';
  viewerImage.appendChild(imageElement);
}

function getViewerImageClassName(forDoublePage: boolean): string {
  const fitMode = state.imageFitMode;
  return `viewer-image-content fit-${fitMode}${forDoublePage ? ' viewer-image-double' : ''}`;
}

function applyViewerImageSizing(imageElement: HTMLImageElement, forDoublePage: boolean): void {
  imageElement.style.height = '';
  imageElement.style.maxHeight = '';
  imageElement.style.width = '';
  imageElement.style.maxWidth = '';

  const viewerContainer = elements.viewerImage();
  const viewerHeight = Math.max(0, Math.floor(viewerContainer.clientHeight || elements.viewerView().clientHeight));
  const viewerWidth = Math.max(0, Math.floor(viewerContainer.clientWidth || elements.viewerView().clientWidth));
  const heightValue = `${viewerHeight}px`;
  const widthValue = `${forDoublePage ? Math.max(0, Math.floor((viewerWidth - 12) / 2)) : viewerWidth}px`;

  if (state.imageFitMode === 'height') {
    imageElement.style.height = heightValue;
    imageElement.style.maxHeight = 'none';
    imageElement.style.width = 'auto';
    imageElement.style.maxWidth = 'none';
    return;
  }

  if (state.imageFitMode === 'width') {
    imageElement.style.width = widthValue;
    imageElement.style.maxWidth = 'none';
    imageElement.style.height = 'auto';
    imageElement.style.maxHeight = 'none';
    return;
  }
}

function reflowRenderedViewerImages(): void {
  if (state.currentView !== 'viewer') {
    return;
  }

  const renderedImages = elements.viewerImage().querySelectorAll<HTMLImageElement>('img.viewer-image-content');
  if (renderedImages.length === 0) {
    return;
  }

  renderedImages.forEach((imageElement) => {
    const isDoublePageImage = imageElement.classList.contains('viewer-image-double');
    applyViewerImageSizing(imageElement, isDoublePageImage);
  });
}

async function renderZipPages(pages: ArchivePage[]): Promise<void> {
  const viewerImage = elements.viewerImage();
  viewerImage.innerHTML = '';
  const objectUrls: string[] = [];

  for (const page of pages) {
    const result = await window.appApi.getPage(state.zipPath as string, page.entryName);
    if (!result.ok) {
      showError(result.error);
      viewerImage.textContent = t('viewer.placeholder.loadFailed', { name: page.displayName });
      return;
    }

    const imageElement = document.createElement('img');
    const blob = new Blob([Uint8Array.from(result.data.bytes)], { type: result.data.mimeType });
    const objectUrl = URL.createObjectURL(blob);
    imageElement.src = objectUrl;
    imageElement.alt = page.displayName;
    imageElement.className = getViewerImageClassName(state.pageViewMode === 'double');
    imageElement.draggable = false;
    applyViewerImageSizing(imageElement, state.pageViewMode === 'double');
    viewerImage.appendChild(imageElement);
    objectUrls.push(objectUrl);
  }

  state.pageObjectUrl = objectUrls.join('\n');
}

function clampPageIndex(pageIndex: number, totalPages: number): number {
  if (totalPages <= 0) {
    return 0;
  }
  if (pageIndex < 0) {
    return 0;
  }
  if (pageIndex >= totalPages) {
    return totalPages - 1;
  }
  return pageIndex;
}

function buildRecentInput(): UpsertRecentInput | null {
  if (!state.archive || !state.zipPath) {
    return null;
  }

  return {
    fileId: state.archive.meta.fileId,
    zipPath: state.zipPath,
    title: state.archive.meta.title,
    lastPageIndex: state.currentPageIndex
  };
}

async function syncRecentItems(): Promise<void> {
  const result = await window.appApi.getRecent();
  if (!result.ok) {
    showError(result.error);
    return;
  }

  state.recentItems = result.data;
  syncRecentItemsToMenu();
}

async function resolveInitialPageIndex(fileId: string, totalPages: number): Promise<number> {
  const result = await window.appApi.getProgress(fileId);
  if (!result.ok) {
    showError(result.error);
    return 0;
  }

  if (result.data === null) {
    return 0;
  }

  return clampPageIndex(result.data, totalPages);
}

async function persistReadingState(): Promise<void> {
  if (state.skipRecentSyncOnce) {
    state.skipRecentSyncOnce = false;
    return;
  }

  const recentInput = buildRecentInput();
  if (!recentInput) {
    return;
  }

  const progressResult = await window.appApi.setProgress(recentInput.fileId, recentInput.lastPageIndex);
  if (!progressResult.ok) {
    showError(progressResult.error);
    return;
  }

  const recentResult = await window.appApi.upsertRecent(recentInput);
  if (!recentResult.ok) {
    showError(recentResult.error);
    return;
  }

  state.recentItems = recentResult.data;
  syncRecentItemsToMenu();
}

async function renderViewer(): Promise<void> {
  const viewerImage = elements.viewerImage();

  if (state.openedImage) {
    syncViewerStatusToMenu(composeViewerStatusText(''));
    clearError();
    renderImageBytes(state.openedImage.name, state.openedImage.mimeType, state.openedImage.bytes);
    return;
  }

  if (!state.archive || !state.zipPath) {
    viewerImage.textContent = t('viewer.placeholder.empty');
    syncViewerStatusToMenu('');
    return;
  }

  const currentPage = state.archive.pages[state.currentPageIndex];
  if (!currentPage) {
    viewerImage.textContent = t('viewer.placeholder.empty');
    syncViewerStatusToMenu('');
    return;
  }

  const pagesToRender =
    state.pageViewMode === 'double'
      ? state.archive.pages.slice(state.currentPageIndex, state.currentPageIndex + 2)
      : [currentPage];

  const statusText = t('viewer.status.detail', {
    current:
      pagesToRender.length === 2
        ? `${state.currentPageIndex + 1}-${state.currentPageIndex + pagesToRender.length}`
        : state.currentPageIndex + 1,
    total: state.archive.meta.totalPages,
    progress: Math.round(((state.currentPageIndex + pagesToRender.length) / state.archive.meta.totalPages) * 100)
  });
  syncViewerStatusToMenu(composeViewerStatusText(statusText));
  viewerImage.textContent = t('viewer.loading');

  const renderToken = ++state.pageRenderToken;
  clearError();
  revokePageObjectUrl();
  await renderZipPages(pagesToRender);
  if (renderToken !== state.pageRenderToken) {
    return;
  }
  void persistReadingState();
}

async function flushViewerRenderQueue(): Promise<void> {
  try {
    while (true) {
      state.queuedPageIndex = null;
      await renderViewer();

      if (state.queuedPageIndex === null) {
        return;
      }

      state.currentPageIndex = state.queuedPageIndex;
    }
  } finally {
    state.viewerRenderInFlight = false;
  }
}

function requestViewerRender(): void {
  if (state.viewerRenderInFlight) {
    state.queuedPageIndex = state.currentPageIndex;
    return;
  }

  state.viewerRenderInFlight = true;
  void flushViewerRenderQueue();
}

async function openZipPath(
  zipPath: string,
  options?: { preserveSidebarContext?: boolean; preferredPageIndex?: number; skipRecentUpdate?: boolean }
): Promise<{ ok: true } | { ok: false; errorCode: string }> {
  clearError();
  resetOpenedContent();
  const result = await window.appApi.openZip(zipPath);
  if (!result.ok) {
    showError(result.error);
    return { ok: false, errorCode: result.error.code };
  }

  state.archive = result.data;
  state.zipPath = zipPath;
  setSelectedSidebarItem(zipPath);
  if (typeof options?.preferredPageIndex === 'number') {
    const lastPageIndex = Math.max(0, result.data.meta.totalPages - 1);
    state.currentPageIndex = Math.max(0, Math.min(options.preferredPageIndex, lastPageIndex));
  } else {
    state.currentPageIndex = await resolveInitialPageIndex(result.data.meta.fileId, result.data.meta.totalPages);
  }
  if (!options?.preserveSidebarContext) {
    clearSidebarListContext();
  }
  syncBookNavigationStateToMenu();
  state.skipRecentSyncOnce = options?.skipRecentUpdate === true;
  switchView('viewer');
  requestViewerRender();
  void refreshBookNavigationItemsFromCurrentFile();
  return { ok: true };
}

async function openImagePath(imagePath: string, options?: { preserveSidebarContext?: boolean }): Promise<void> {
  clearError();
  resetOpenedContent();
  const result = await window.appApi.openImage(imagePath);
  if (!result.ok) {
    showError(result.error);
    return;
  }

  state.openedImage = result.data;
  setSelectedSidebarItem(imagePath);
  if (!options?.preserveSidebarContext) {
    clearSidebarListContext();
  }
  syncBookNavigationStateToMenu();
  switchView('viewer');
  requestViewerRender();
  void refreshBookNavigationItemsFromCurrentFile();
}

async function openFilePath(filePath: string, options?: { preserveSidebarContext?: boolean }): Promise<void> {
  if (isZipPath(filePath)) {
    await openZipPath(filePath, options);
    return;
  }

  if (isImagePath(filePath)) {
    await openImagePath(filePath, options);
    return;
  }

  showError({ code: 'CONVERTER_REQUIRED', message: t('error.archive.converterRequired', { name: filePath }) });
}

function renderSidebarItems(): void {
  const container = elements.fileTree();
  container.innerHTML = '';

  if (!state.currentFolderPath) {
    const empty = document.createElement('div');
    empty.className = 'tree-info';
    empty.textContent = t('sidebar.emptyFolder');
    container.appendChild(empty);
    return;
  }

  if (state.sidebarItems.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tree-info';
    empty.textContent = t('sidebar.emptyList');
    container.appendChild(empty);
    return;
  }

  state.sidebarItems.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sidebar-list-item';
    button.classList.toggle('selected', !!state.selectedSidebarItemPath && isSamePath(state.selectedSidebarItemPath, item.path));
    button.title = item.name;
    button.innerHTML = `<span class="sidebar-list-name">${item.name}</span>`;
    button.addEventListener('click', () => {
      setSelectedSidebarItem(item.path);
    });
    button.addEventListener('dblclick', () => {
      setSelectedSidebarItem(item.path);
      if (item.type === 'zip' || item.type === 'image') {
        void openFilePath(item.path, { preserveSidebarContext: true });
        return;
      }

      showError({ code: 'CONVERTER_REQUIRED', message: t('error.archive.converterRequired', { name: item.name }) });
    });
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      setSelectedSidebarItem(item.path);
      void window.appApi.showFileEditContextMenu().catch((error) => {
        showError({
          code: 'DROP_DEBUG',
          message: `${t('error.unknown')} (${String(error)})`
        });
      });
    });
    container.appendChild(button);
  });
}

async function openFolderPath(folderPath: string): Promise<void> {
  clearError();
  resetOpenedContent();
  const result = await window.appApi.listFolderItems(folderPath);
  if (!result.ok) {
    showError(result.error);
    return;
  }

  state.currentFolderPath = folderPath;
  state.sidebarItems = result.data;
  state.bookNavItems = result.data;
  setSelectedSidebarItem(null);
  syncBookNavigationStateToMenu();
  state.showSidebarList = true;
  persistViewerPreferences();
  switchView('launcher');
}

async function refreshCurrentFolderItems(): Promise<void> {
  if (!state.currentFolderPath) {
    return;
  }

  const result = await window.appApi.listFolderItems(state.currentFolderPath);
  if (!result.ok) {
    showError(result.error);
    return;
  }

  state.sidebarItems = result.data;
  state.bookNavItems = result.data;
  if (state.selectedSidebarItemPath && !state.sidebarItems.some((item) => isSamePath(item.path, state.selectedSidebarItemPath as string))) {
    setSelectedSidebarItem(null);
    syncBookNavigationStateToMenu();
    return;
  }
  syncBookNavigationStateToMenu();
  renderSidebarItems();
}

function confirmAction(message: string): boolean {
  return window.confirm(message);
}

function notifyAction(message: string): void {
  window.alert(message);
}

async function readImageDimensions(name: string, mimeType: string, bytes: number[]): Promise<ImageDimensions> {
  const blob = new Blob([Uint8Array.from(bytes)], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();
    return {
      width: image.naturalWidth,
      height: image.naturalHeight
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function resizeImageBytesToTarget(
  source: OpenedImageFile,
  target: ImageDimensions
): Promise<{ mimeType: string; bytes: number[] }> {
  const blob = new Blob([Uint8Array.from(source.bytes)], { type: source.mimeType });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context unavailable');
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, target.width, target.height);

    const outputMime = source.mimeType || 'image/png';
    const resizedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (!value) {
          reject(new Error('Failed to create resized image blob'));
          return;
        }
        resolve(value);
      }, outputMime);
    });
    const buffer = await resizedBlob.arrayBuffer();
    return {
      mimeType: outputMime,
      bytes: Array.from(new Uint8Array(buffer))
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function showSizeAdjustModal(payload: {
  title: string;
  message: string;
  confirmLabel: string;
  originalLabel: string;
  cancelLabel: string;
}): Promise<'cancel' | 'original' | 'confirm'> {
  elements.sizeAdjustTitle().textContent = payload.title;
  elements.sizeAdjustMessage().textContent = payload.message;
  elements.sizeAdjustConfirm().textContent = payload.confirmLabel;
  elements.sizeAdjustOriginal().textContent = payload.originalLabel;
  elements.sizeAdjustCancel().textContent = payload.cancelLabel;
  elements.sizeAdjustModal().classList.remove('hidden');

  return new Promise((resolve) => {
    sizeAdjustChoiceResolver = resolve;
  });
}

function resolveSizeAdjustModal(choice: 'cancel' | 'original' | 'confirm'): void {
  const resolver = sizeAdjustChoiceResolver;
  if (!resolver) {
    return;
  }

  sizeAdjustChoiceResolver = null;
  elements.sizeAdjustModal().classList.add('hidden');
  resolver(choice);
}

function getCurrentArchivePage(): ArchivePage | null {
  if (!state.archive) {
    return null;
  }

  return state.archive.pages[state.currentPageIndex] ?? null;
}

async function handleEditedZipCreated(sourceZipPath: string, editedZipPath: string, preferredPageIndex: number): Promise<void> {
  state.currentFolderPath = getDirectoryPath(sourceZipPath);
  state.showSidebarList = true;
  persistViewerPreferences();
  applySidebarVisibility();
  await refreshCurrentFolderItems();

  if (sourceZipPath === editedZipPath) {
    await openZipPath(editedZipPath, {
      preserveSidebarContext: true,
      preferredPageIndex,
      skipRecentUpdate: true
    });
  }
}

async function handleDeletePageRequest(target: 'left' | 'right'): Promise<void> {
  if (!state.archive || !state.zipPath) {
    showError({ code: 'DROP_DEBUG', message: t('edit.page.noPage') });
    return;
  }

  if (target === 'right' && !canEditRightPage()) {
    showError({ code: 'DROP_DEBUG', message: t('edit.page.noPage') });
    return;
  }

  const pageIndex = target === 'right' ? state.currentPageIndex + 1 : state.currentPageIndex;
  const currentPage = state.archive.pages[pageIndex];
  if (!currentPage) {
    showError({ code: 'DROP_DEBUG', message: t('edit.page.noPage') });
    return;
  }

  const confirmed = confirmAction(
    t('dialog.confirm.pageDelete', {
      name: currentPage.displayName,
      page: pageIndex + 1
    })
  );
  if (!confirmed) {
    return;
  }

  const preferredPageIndex = state.currentPageIndex;
  const editResult = await window.appApi.editZipPages(state.zipPath, {
    kind: 'delete',
    targetEntryName: currentPage.entryName
  });
  if (!editResult.ok) {
    const failureMessage = t('dialog.error.pageEditFailed', { reason: editResult.error.message });
    showError({
      code: 'DROP_DEBUG',
      message: failureMessage
    });
    notifyAction(failureMessage);
    return;
  }

  const isEditedZipUpdated = state.zipPath === editResult.data.editedZipPath;
  notifyAction(
    t(isEditedZipUpdated ? 'dialog.info.pageEditUpdated' : 'dialog.info.pageEditCompleted', {
      path: editResult.data.editedZipPath
    })
  );
  await handleEditedZipCreated(state.zipPath, editResult.data.editedZipPath, preferredPageIndex);
}

async function handleInsertAfterCurrentPageRequest(): Promise<void> {
  const currentPage = getCurrentArchivePage();
  if (!currentPage || !state.zipPath) {
    showError({ code: 'DROP_DEBUG', message: t('edit.page.noPage') });
    return;
  }

  const insertPath = await window.appApi.openFileDialog({
    title: t('dialog.insertPage.title'),
    zipFilterName: '',
    imageFilterName: t('dialog.openImage.filterImage'),
    defaultPath: getDirectoryPath(state.zipPath)
  });
  if (!insertPath) {
    return;
  }

  if (!isImagePath(insertPath)) {
    showError({ code: 'DROP_DEBUG', message: t('edit.page.onlyImage') });
    return;
  }

  const currentPageDataResult = await window.appApi.getPage(state.zipPath, currentPage.entryName);
  if (!currentPageDataResult.ok) {
    showError(currentPageDataResult.error);
    return;
  }

  const insertImageResult = await window.appApi.openImage(insertPath);
  if (!insertImageResult.ok) {
    showError(insertImageResult.error);
    return;
  }

  const currentPageDimensions = await readImageDimensions(
    currentPage.displayName,
    currentPageDataResult.data.mimeType,
    currentPageDataResult.data.bytes
  );
  const insertImageDimensions = await readImageDimensions(
    insertImageResult.data.name,
    insertImageResult.data.mimeType,
    insertImageResult.data.bytes
  );

  let adjustedInsert = {
    name: insertImageResult.data.name,
    mimeType: insertImageResult.data.mimeType,
    bytes: insertImageResult.data.bytes
  };

  const isSizeDifferent =
    currentPageDimensions.width !== insertImageDimensions.width ||
    currentPageDimensions.height !== insertImageDimensions.height;

  if (isSizeDifferent) {
    const resized = await resizeImageBytesToTarget(insertImageResult.data, currentPageDimensions);
    const choice = await showSizeAdjustModal({
      title: t('dialog.sizeAdjust.title'),
      message: t('dialog.sizeAdjust.message', {
        currentSize: `${currentPageDimensions.width}x${currentPageDimensions.height}`,
        insertSize: `${insertImageDimensions.width}x${insertImageDimensions.height}`
      }),
      confirmLabel: t('common.confirm'),
      originalLabel: t('dialog.sizeAdjust.keepOriginal'),
      cancelLabel: t('common.cancel')
    });

    if (choice === 'cancel') {
      return;
    }

    if (choice === 'confirm') {
      adjustedInsert = {
        name: insertImageResult.data.name,
        mimeType: resized.mimeType,
        bytes: resized.bytes
      };
    }
  }

  const insertName = insertPath.split(/[/\\]/).pop() ?? insertPath;
  const confirmed = confirmAction(
    t('dialog.confirm.pageInsertAfter', {
      currentName: currentPage.displayName,
      insertName
    })
  );
  if (!confirmed) {
    return;
  }

  const preferredPageIndex = state.currentPageIndex;
  const editResult = await window.appApi.editZipPages(state.zipPath, {
    kind: 'insert-after',
    afterEntryName: currentPage.entryName,
    insertFileName: adjustedInsert.name,
    insertMimeType: adjustedInsert.mimeType,
    insertBytes: adjustedInsert.bytes
  });
  if (!editResult.ok) {
    const failureMessage = t('dialog.error.pageEditFailed', { reason: editResult.error.message });
    showError({
      code: 'DROP_DEBUG',
      message: failureMessage
    });
    notifyAction(failureMessage);
    return;
  }

  const isEditedZipUpdated = state.zipPath === editResult.data.editedZipPath;
  notifyAction(
    t(isEditedZipUpdated ? 'dialog.info.pageEditUpdatedWithSize' : 'dialog.info.pageEditCompletedWithSize', {
      mode: isSizeDifferent && adjustedInsert.bytes !== insertImageResult.data.bytes ? t('dialog.sizeAdjust.applied') : t('dialog.sizeAdjust.notApplied'),
      path: editResult.data.editedZipPath
    })
  );
  await handleEditedZipCreated(state.zipPath, editResult.data.editedZipPath, preferredPageIndex);
}

async function handleFileCopyOrCut(mode: FileTransferMode): Promise<void> {
  const sourcePath = getCurrentFilePathForTransfer();
  if (!sourcePath) {
    showError({ code: 'DROP_DEBUG', message: t('edit.file.noSelection') });
    return;
  }

  if (mode === 'cut') {
    const selectedName = getSelectedSidebarItem()?.name ?? sourcePath.split(/[/\\]/).pop() ?? sourcePath;
    const confirmed = confirmAction(t('dialog.confirm.fileCut', { name: selectedName }));
    if (!confirmed) {
      return;
    }
  }

  const selected = getSelectedSidebarItem();
  const sourceName = selected?.name ?? sourcePath.split(/[/\\]/).pop() ?? sourcePath;
  setFileTransferClipboard({
    sourcePath,
    sourceName,
    mode
  });
  clearError();
}

function handleFileTransferCancel(): void {
  setFileTransferClipboard(null);
  clearError();
}

async function handleFilePaste(): Promise<void> {
  if (!state.fileTransferClipboard) {
    showError({ code: 'DROP_DEBUG', message: t('edit.file.clipboardEmpty') });
    return;
  }

  const confirmMessage =
    state.fileTransferClipboard.mode === 'cut'
      ? t('dialog.confirm.fileMoveApply', { name: state.fileTransferClipboard.sourceName })
      : t('dialog.confirm.fileCopyApply', { name: state.fileTransferClipboard.sourceName });
  const confirmed = confirmAction(confirmMessage);
  if (!confirmed) {
    return;
  }

  const destinationDirectory = await window.appApi.openFolderDialog(t('dialog.selectPasteTarget.title'));
  if (!destinationDirectory) {
    return;
  }

  const transfer = await window.appApi.transferFile(
    state.fileTransferClipboard.sourcePath,
    destinationDirectory,
    state.fileTransferClipboard.mode
  );
  if (!transfer.ok) {
    showError(transfer.error);
    return;
  }

  if (state.fileTransferClipboard.mode === 'cut') {
    setFileTransferClipboard(null);
  }
  await refreshCurrentFolderItems();
}

async function handleFileDelete(): Promise<void> {
  const selected = getSelectedSidebarItem();
  if (!selected) {
    showError({ code: 'DROP_DEBUG', message: t('edit.file.noSelection') });
    return;
  }

  const confirmed = confirmAction(t('dialog.confirm.fileDelete', { name: selected.name }));
  if (!confirmed) {
    return;
  }

  const result = await window.appApi.deleteFile(selected.path);
  if (!result.ok) {
    showError(result.error);
    return;
  }

  if (state.fileTransferClipboard?.sourcePath === selected.path) {
    setFileTransferClipboard(null);
  }

  if (isOpenedFilePath(selected.path)) {
    resetOpenedContent();
    switchView('launcher');
  }

  setSelectedSidebarItem(null);
  await refreshCurrentFolderItems();
  clearError();
}

async function handleOpenFileClick(): Promise<void> {
  clearError();
  const filePath = await window.appApi.openFileDialog({
    title: t('dialog.openFile.title'),
    zipFilterName: t('dialog.openZip.filterZip'),
    imageFilterName: t('dialog.openImage.filterImage')
  });

  if (!filePath) {
    return;
  }

  await openFilePath(filePath);
}

async function handleOpenFolderClick(): Promise<void> {
  clearError();
  const folderPath = await window.appApi.openFolderDialog(t('dialog.openFolder.title'));
  if (!folderPath) {
    return;
  }

  await openFolderPath(folderPath);
}

function handleMenuAction(action: MenuAction): void {
  if (action === 'open-file') {
    void handleOpenFileClick();
    return;
  }

  if (action === 'open-folder') {
    void handleOpenFolderClick();
    return;
  }

  if (action === 'show-launcher') {
    switchView('launcher');
    return;
  }

  if (action === 'show-viewer') {
    switchView(state.currentView === 'launcher' ? 'viewer' : 'launcher');
    return;
  }

  if (action === 'show-settings') {
    switchView('settings');
    return;
  }

  if (action === 'toggle-folder-list') {
    state.showSidebarList = !state.showSidebarList;
    applySidebarVisibility();
    persistViewerPreferences();
    return;
  }

  if (action === 'open-prev-book') {
    void openAdjacentBook(-1);
    return;
  }

  if (action === 'open-next-book') {
    void openAdjacentBook(1);
    return;
  }

  if (handleViewerNavigationAction(action)) {
    return;
  }

  if (action === 'file-copy') {
    void handleFileCopyOrCut('copy');
    return;
  }

  if (action === 'file-cut') {
    void handleFileCopyOrCut('cut');
    return;
  }

  if (action === 'file-paste') {
    void handleFilePaste();
    return;
  }

  if (action === 'file-delete') {
    void handleFileDelete();
    return;
  }

  if (action === 'file-cancel-transfer') {
    handleFileTransferCancel();
    return;
  }

  if (action === 'edit-delete-left-page') {
    void handleDeletePageRequest('left');
    return;
  }

  if (action === 'edit-delete-right-page') {
    void handleDeletePageRequest('right');
    return;
  }

  if (action === 'edit-insert-after-current-page') {
    void handleInsertAfterCurrentPageRequest();
    return;
  }

  if (action === 'view-single-page') {
    state.pageViewMode = 'single';
    syncPageEditStateToMenu();
    persistViewerPreferences();
    requestViewerRender();
    return;
  }

  if (action === 'view-double-page') {
    state.pageViewMode = 'double';
    syncPageEditStateToMenu();
    persistViewerPreferences();
    requestViewerRender();
    return;
  }

  if (action === 'image-fit-auto') {
    state.imageFitMode = 'auto';
    persistViewerPreferences();
    requestViewerRender();
    return;
  }

  if (action === 'image-fit-actual') {
    state.imageFitMode = 'actual';
    persistViewerPreferences();
    requestViewerRender();
    return;
  }

  if (action === 'image-fit-width') {
    state.imageFitMode = 'width';
    persistViewerPreferences();
    requestViewerRender();
    return;
  }

  if (action === 'image-fit-height') {
    state.imageFitMode = 'height';
    persistViewerPreferences();
    requestViewerRender();
  }
}

function setPageIndex(nextIndex: number): boolean {
  if (!state.archive) {
    return false;
  }

  if (nextIndex < 0 || nextIndex >= state.archive.meta.totalPages) {
    return false;
  }

  const previousIndex = state.currentPageIndex;
  if (previousIndex === nextIndex) {
    return false;
  }

  state.currentPageIndex = nextIndex;
  requestViewerRender();
  showPageMoveToast(nextIndex - previousIndex);
  syncPageEditStateToMenu();
  return true;
}

function movePage(step: number): boolean {
  if (!state.archive) {
    return false;
  }

  const stepSize = state.pageViewMode === 'double' ? 2 : 1;
  const nextIndex = state.currentPageIndex + (step * stepSize);
  const moved = setPageIndex(nextIndex);
  if (!moved && step > 0 && nextIndex >= state.archive.meta.totalPages) {
    void handleAdvanceBeyondLastPage();
  }
  if (!moved && step < 0 && nextIndex < 0) {
    void handleRetreatBeforeFirstPage();
  }
  return moved;
}

function moveToFirstPage(): boolean {
  return setPageIndex(0);
}

function moveToLastPage(): boolean {
  if (!state.archive) {
    return false;
  }

  return setPageIndex(state.archive.meta.totalPages - 1);
}

function isViewerPageNavigationAvailable(): boolean {
  return state.currentView === 'viewer' && !!state.archive;
}

async function openAdjacentBook(step: -1 | 1): Promise<void> {
  await refreshBookNavigationItemsFromCurrentFile();
  const index = getCurrentOpenedBookIndex();
  const items = getNavigableSidebarItems();
  if (index < 0) {
    return;
  }

  const nextIndex = index + step;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return;
  }

  const next = items[nextIndex];
  setSelectedSidebarItem(next.path);
  await openFilePath(next.path, { preserveSidebarContext: true });
}

async function handleAdvanceBeyondLastPage(): Promise<void> {
  await refreshBookNavigationItemsFromCurrentFile();
  if (canOpenNextBookFromCurrent()) {
    const confirmed = confirmAction(t('dialog.confirm.openNextBook'));
    if (confirmed) {
      void openAdjacentBook(1);
    }
    return;
  }

  notifyAction(t('dialog.info.noNextBook'));
}

async function handleRetreatBeforeFirstPage(): Promise<void> {
  await refreshBookNavigationItemsFromCurrentFile();
  if (canOpenPrevBookFromCurrent()) {
    const confirmed = confirmAction(t('dialog.confirm.openPrevBook'));
    if (confirmed) {
      void openAdjacentBook(-1);
    }
    return;
  }

  notifyAction(t('dialog.info.atDocumentStart'));
}

function handleViewerNavigationAction(action: MenuAction): boolean {
  if (!isViewerPageNavigationAvailable()) {
    return false;
  }

  if (action === 'move-prev-page') {
    return movePage(-1);
  }

  if (action === 'move-next-page') {
    return movePage(1);
  }

  if (action === 'move-prev-10-pages') {
    return movePage(-10);
  }

  if (action === 'move-next-10-pages') {
    return movePage(10);
  }

  if (action === 'move-first-page') {
    return moveToFirstPage();
  }

  if (action === 'move-last-page') {
    return moveToLastPage();
  }

  return false;
}

async function handleEsc(): Promise<void> {
  const isFullscreen = await window.appApi.isFullscreen();
  if (isFullscreen) {
    await window.appApi.exitFullscreen();
    return;
  }

  switchView('launcher');
}

async function handleKeyDown(event: KeyboardEvent): Promise<void> {
  if (event.shiftKey && event.key === 'PageUp') {
    event.preventDefault();
    await openAdjacentBook(-1);
    return;
  }

  if (event.shiftKey && event.key === 'PageDown') {
    event.preventDefault();
    await openAdjacentBook(1);
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    if (state.fileTransferClipboard) {
      handleFileTransferCancel();
      return;
    }
    await handleEsc();
    return;
  }

  if (event.ctrlKey || event.metaKey) {
    const normalizedKey = event.key.toLowerCase();
    if (normalizedKey === 'c') {
      event.preventDefault();
      void handleFileCopyOrCut('copy');
      return;
    }
    if (normalizedKey === 'x') {
      event.preventDefault();
      void handleFileCopyOrCut('cut');
      return;
    }
    if (normalizedKey === 'v') {
      event.preventDefault();
      await handleFilePaste();
      return;
    }
  }

  if (state.currentView !== 'viewer') {
    return;
  }

  if (!state.archive) {
    return;
  }

  if (event.key === 'ArrowRight' || event.key === ' ') {
    event.preventDefault();
    movePage(1);
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    movePage(-1);
    return;
  }

  if (event.key === 'PageDown') {
    event.preventDefault();
    movePage(10);
    return;
  }

  if (event.key === 'PageUp') {
    event.preventDefault();
    movePage(-10);
    return;
  }

  if (event.key === 'Home') {
    event.preventDefault();
    moveToFirstPage();
    return;
  }

  if (event.key === 'End') {
    event.preventDefault();
    moveToLastPage();
    return;
  }
}

function renderStaticText(): void {
  document.title = t('app.title');
  elements.sidebarTitle().textContent = t('sidebar.title');
  elements.dropOverlayText().textContent = t('drop.openZip');
  elements.settingsPlaceholder().textContent = t('settings.placeholder');
}

function clampSidebarWidth(width: number): number {
  return Math.min(520, Math.max(180, width));
}

function applySidebarWidth(): void {
  elements.workspace().style.setProperty('--sidebar-width', `${clampSidebarWidth(state.sidebarWidth)}px`);
}

function renderAll(): void {
  renderStaticText();
  applySidebarWidth();
  syncFileEditStateToMenu();
  syncFileSelectionStateToMenu();
  syncPageEditStateToMenu();
  syncBookNavigationStateToMenu();
  renderGlobalError();
  renderSidebarItems();
  requestViewerRender();
  switchView(state.currentView);
}

function bindEvents(): void {
  const unsubscribeMenuAction = window.appApi.onMenuAction((action) => {
    handleMenuAction(action);
  });
  const unsubscribeOpenRecent = window.appApi.onOpenRecent((zipPath) => {
    void (async () => {
      const openResult = await openZipPath(zipPath);
      if (openResult.ok || openResult.errorCode !== 'FILE_NOT_FOUND') {
        return;
      }

      const name = zipPath.split(/[/\\]/).pop() ?? zipPath;
      notifyAction(t('recent.missingRemoved', { name }));

      const removeResult = await window.appApi.removeRecentByPath(zipPath);
      if (!removeResult.ok) {
        showError(removeResult.error);
        return;
      }

      state.recentItems = removeResult.data;
      syncRecentItemsToMenu();
    })();
  });
  const unsubscribeLocaleSelected = window.appApi.onLocaleSelected((locale) => {
    applyLocaleFromMenu(locale);
    renderAll();
  });
  let splitterDragging = false;
  let viewerResizeRafId: number | null = null;

  const openFileEditContextMenu = (): void => {
    void window.appApi.showFileEditContextMenu().catch((error) => {
      showError({
        code: 'DROP_DEBUG',
        message: `${t('error.unknown')} (${String(error)})`
      });
    });
  };

  elements.fileTree().addEventListener('contextmenu', (event) => {
    event.preventDefault();
    openFileEditContextMenu();
  });

  elements.sidebar().addEventListener('contextmenu', (event) => {
    event.preventDefault();
    openFileEditContextMenu();
  });

  elements.viewerImage().addEventListener('contextmenu', (event) => {
    event.preventDefault();
    void window.appApi.showImageContextMenu().catch((error) => {
      showError({
        code: 'DROP_DEBUG',
        message: `${t('error.unknown')} (${String(error)})`
      });
    });
  });

  elements.sizeAdjustCancel().addEventListener('click', () => {
    resolveSizeAdjustModal('cancel');
  });
  elements.sizeAdjustOriginal().addEventListener('click', () => {
    resolveSizeAdjustModal('original');
  });
  elements.sizeAdjustConfirm().addEventListener('click', () => {
    resolveSizeAdjustModal('confirm');
  });

  elements.splitter().addEventListener('pointerdown', (event) => {
    splitterDragging = true;
    elements.splitter().classList.add('dragging');
    elements.splitter().setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  elements.splitter().addEventListener('pointermove', (event) => {
    if (!splitterDragging) {
      return;
    }

    state.sidebarWidth = clampSidebarWidth(event.clientX);
    applySidebarWidth();
    reflowRenderedViewerImages();
  });

  const stopSplitterDrag = (event?: PointerEvent): void => {
    if (!splitterDragging) {
      return;
    }

    splitterDragging = false;
    elements.splitter().classList.remove('dragging');
    if (event) {
      elements.splitter().releasePointerCapture(event.pointerId);
    }

    persistViewerPreferences();
  };

  elements.splitter().addEventListener('pointerup', (event) => stopSplitterDrag(event));
  elements.splitter().addEventListener('pointercancel', (event) => stopSplitterDrag(event));

  elements.viewerView().addEventListener(
    'wheel',
    (event) => {
      if (!event.shiftKey) {
        return;
      }

      const container = document.querySelector('.content-pane') as HTMLElement | null;
      if (!container) {
        return;
      }

      const canScrollHorizontally = container.scrollWidth > container.clientWidth;
      if (!canScrollHorizontally) {
        return;
      }

      container.scrollLeft += event.deltaY !== 0 ? event.deltaY : event.deltaX;
      event.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener('keydown', (event) => {
    void handleKeyDown(event);
  });

  window.addEventListener('resize', () => {
    if (viewerResizeRafId !== null) {
      window.cancelAnimationFrame(viewerResizeRafId);
    }

    viewerResizeRafId = window.requestAnimationFrame(() => {
      viewerResizeRafId = null;
      reflowRenderedViewerImages();
    });
  });

  const dragTargets = new Set<EventTarget>([
    window,
    document,
    document.documentElement,
    document.body,
    elements.workspace(),
    document.querySelector('.sidebar') as HTMLElement,
    document.querySelector('.content-pane') as HTMLElement,
    elements.sidebarDragLayer(),
    elements.fileTree(),
    elements.launcherView(),
    elements.viewerView(),
    elements.settingsView()
  ]);

  for (const target of dragTargets) {
    if (target) {
      bindDragListeners(target);
    }
  }

  window.addEventListener('beforeunload', () => {
    if (sizeAdjustChoiceResolver) {
      resolveSizeAdjustModal('cancel');
    }
    if (pageMoveToastTimer !== null) {
      window.clearTimeout(pageMoveToastTimer);
      pageMoveToastTimer = null;
    }
    revokePageObjectUrl();
    unsubscribeMenuAction();
    unsubscribeOpenRecent();
    unsubscribeLocaleSelected();
  });
}

async function init(): Promise<void> {
  document.getElementById('sidebar-subtitle')?.remove();
  await loadI18nDictionaries();
  const appSettings = await window.appApi.getAppSettings();
  currentLocale = appSettings.locale;
  state.pageViewMode = appSettings.pageViewMode;
  state.imageFitMode = appSettings.imageFitMode;
  state.showSidebarList = appSettings.showSidebarList;
  state.sidebarWidth = appSettings.sidebarWidth;
  applySidebarVisibility();
  switchView('launcher');
  bindEvents();
  renderAll();
  void syncRecentItems();
}

document.addEventListener('DOMContentLoaded', () => {
  void init();
});
