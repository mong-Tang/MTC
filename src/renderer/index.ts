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
  | 'file-copy'
  | 'file-cut'
  | 'file-paste'
  | 'file-cancel-transfer'
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
  selectedSidebarItemPath: string | null;
  fileTransferClipboard: FileTransferClipboard | null;
  pageViewMode: PageViewMode;
  imageFitMode: ImageFitMode;
  dragDebugText: string;
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
  selectedSidebarItemPath: null,
  fileTransferClipboard: null,
  pageViewMode: 'single',
  imageFitMode: 'auto',
  dragDebugText: 'drag: idle'
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
  dropOverlayText: () => byId<HTMLDivElement>('drop-overlay-text')
};

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

function getSelectedSidebarItem(): SidebarListItem | null {
  if (!state.selectedSidebarItemPath) {
    return null;
  }

  return state.sidebarItems.find((item) => item.path === state.selectedSidebarItemPath) ?? null;
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

function setSelectedSidebarItem(itemPath: string | null): void {
  state.selectedSidebarItemPath = itemPath;
  renderSidebarItems();
}

function syncFileEditStateToMenu(): void {
  window.appApi.updateFileEditState(state.fileTransferClipboard !== null);
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
      sidebarWidth: state.sidebarWidth
    })
    .catch((error) => {
      console.warn('[settings] failed to persist viewer preferences:', error);
    });
}

function setDropOverlayVisible(visible: boolean): void {
  elements.dropOverlay().classList.toggle('hidden', !visible);
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
  state.pageRenderToken += 1;
  state.queuedPageIndex = null;
  elements.viewerImage().innerHTML = '';
  syncViewerStatusToMenu('');
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
    syncViewerStatusToMenu(state.openedImage.name);
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
  syncViewerStatusToMenu(statusText);
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

async function openZipPath(zipPath: string): Promise<void> {
  clearError();
  resetOpenedContent();
  const result = await window.appApi.openZip(zipPath);
  if (!result.ok) {
    showError(result.error);
    return;
  }

  state.archive = result.data;
  state.zipPath = zipPath;
  state.currentPageIndex = await resolveInitialPageIndex(result.data.meta.fileId, result.data.meta.totalPages);
  switchView('viewer');
  requestViewerRender();
}

async function openImagePath(imagePath: string): Promise<void> {
  clearError();
  resetOpenedContent();
  const result = await window.appApi.openImage(imagePath);
  if (!result.ok) {
    showError(result.error);
    return;
  }

  state.openedImage = result.data;
  switchView('viewer');
  requestViewerRender();
}

async function openFilePath(filePath: string): Promise<void> {
  if (isZipPath(filePath)) {
    await openZipPath(filePath);
    return;
  }

  if (isImagePath(filePath)) {
    await openImagePath(filePath);
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
    button.classList.toggle('selected', state.selectedSidebarItemPath === item.path);
    button.title = item.name;
    button.innerHTML = `<span class="sidebar-list-name">${item.name}</span>`;
    button.addEventListener('click', () => {
      setSelectedSidebarItem(item.path);
    });
    button.addEventListener('dblclick', () => {
      setSelectedSidebarItem(item.path);
      if (item.type === 'zip' || item.type === 'image') {
        void openFilePath(item.path);
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
  state.selectedSidebarItemPath = null;
  renderSidebarItems();
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
  if (state.selectedSidebarItemPath && !state.sidebarItems.some((item) => item.path === state.selectedSidebarItemPath)) {
    state.selectedSidebarItemPath = null;
  }
  renderSidebarItems();
}

function handleFileCopyOrCut(mode: FileTransferMode): void {
  const sourcePath = getCurrentFilePathForTransfer();
  if (!sourcePath) {
    showError({ code: 'DROP_DEBUG', message: t('edit.file.noSelection') });
    return;
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
    switchView('viewer');
    return;
  }

  if (action === 'show-settings') {
    switchView('settings');
    return;
  }

  if (action === 'file-copy') {
    handleFileCopyOrCut('copy');
    return;
  }

  if (action === 'file-cut') {
    handleFileCopyOrCut('cut');
    return;
  }

  if (action === 'file-paste') {
    void handleFilePaste();
    return;
  }

  if (action === 'file-cancel-transfer') {
    handleFileTransferCancel();
    return;
  }

  if (action === 'view-single-page') {
    state.pageViewMode = 'single';
    persistViewerPreferences();
    requestViewerRender();
    return;
  }

  if (action === 'view-double-page') {
    state.pageViewMode = 'double';
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

function movePage(step: number): void {
  if (!state.archive) {
    return;
  }

  const stepSize = state.pageViewMode === 'double' ? 2 : 1;
  const nextIndex = state.currentPageIndex + (step * stepSize);
  if (nextIndex < 0 || nextIndex >= state.archive.meta.totalPages) {
    return;
  }

  state.currentPageIndex = nextIndex;
  requestViewerRender();
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
      handleFileCopyOrCut('copy');
      return;
    }
    if (normalizedKey === 'x') {
      event.preventDefault();
      handleFileCopyOrCut('cut');
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
    void openZipPath(zipPath);
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
  state.sidebarWidth = appSettings.sidebarWidth;
  switchView('launcher');
  bindEvents();
  renderAll();
  void syncRecentItems();
}

document.addEventListener('DOMContentLoaded', () => {
  void init();
});
