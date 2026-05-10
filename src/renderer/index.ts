// All core interfaces, elements collection, state declarations, and i18n are now managed in state.ts for pure modular design.
declare function renderHtmlRecentSubmenu(): void;

let pageMoveToastTimer: number | null = null;
let notificationModalTimer: number | null = null;
let sizeAdjustChoiceResolver: ((choice: 'cancel' | 'original' | 'confirm') => void) | null = null;
let lastViewerStatusText = '';

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
  syncViewerStatusToMenu('');
  if (view === 'launcher') {
    renderLauncherRecentList();
  }
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

function updateMenuStates(): void {
  const isFileOpen = state.zipPath !== null || state.openedImage !== null;

  // Actions that strictly require a file to be open
  const fileActions = [
    'close-file', 'file-copy', 'file-cut', 'file-paste', 'file-delete', 'file-cancel-transfer',
    'edit-delete-left-page', 'edit-delete-right-page', 'edit-insert-after-current-page',
    'view-single-page', 'view-double-page',
    'move-prev-page', 'move-next-page', 'move-first-page', 'move-last-page',
    'move-prev-10-pages', 'move-next-10-pages', 'open-prev-book', 'open-next-book',
    'image-fit-auto', 'image-fit-actual', 'image-fit-width', 'image-fit-height'
  ];

  document.querySelectorAll('.dropdown-item').forEach((el) => {
    const btn = el as HTMLButtonElement;
    const action = btn.getAttribute('data-action');
    if (action && fileActions.includes(action)) {
      btn.disabled = !isFileOpen;
    }

    // Check submenu triggers
    const text = btn.textContent || '';
    if (text.includes('페이지 보기') || text.includes('이동') || text.includes('이미지 맞춤')) {
      btn.disabled = !isFileOpen;
      const parent = btn.closest('.dropdown-submenu-parent');
      if (parent) {
        parent.classList.toggle('disabled', !isFileOpen);
      }
    }
  });
}

function syncPageEditStateToMenu(): void {
  window.appApi.updatePageEditState({
    canEditLeftPage: canEditCurrentPage(),
    canEditRightPage: canEditRightPage()
  });

  // Sync direct header toggles on the right
  const singleBtn = document.getElementById('header-btn-single');
  const doubleBtn = document.getElementById('header-btn-double');
  if (singleBtn && doubleBtn) {
    singleBtn.classList.toggle('active', state.pageViewMode === 'single');
    doubleBtn.classList.toggle('active', state.pageViewMode === 'double');
  }

  // Update dynamic menu active/inactive states based on file loaded state
  updateMenuStates();
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

function getBookNavigationStatusHint(): string {
  const currentPath = getCurrentOpenedPathForBookNavigation();
  if (!currentPath) {
    return '';
  }

  const items = getNavigableSidebarItems();
  const index = items.findIndex((item) => isSamePath(item.path, currentPath));
  if (items.length <= 1 || index < 0) {
    return t('viewer.status.bookNav.noSeries');
  }

  const canOpenPrevBook = index > 0;
  const canOpenNextBook = index < items.length - 1;
  if (!canOpenPrevBook && canOpenNextBook) {
    return t('viewer.status.bookNav.first');
  }

  if (canOpenPrevBook && !canOpenNextBook) {
    return t('viewer.status.bookNav.last');
  }

  return '';
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

function updateStatus(badgeText: string, statusText: string, type: 'idle' | 'loading' | 'info' | 'success' | 'warn' = 'idle'): void {
  const badge = elements.statusBadge();
  const text = elements.statusLeft();
  if (badge && text) {
    badge.textContent = badgeText;
    badge.className = `status-badge ${type}`;
    text.textContent = statusText;
  }
}

function syncViewerStatusToMenu(statusText: string): void {
  window.appApi.updateViewerStatus(statusText);

  if (statusText) {
    lastViewerStatusText = statusText;
  }

  const statusRight = elements.statusRight();
  const activeStatusText = statusText || lastViewerStatusText;

  if (state.currentView === 'viewer' && state.archive) {
    updateStatus('열람 중', getCurrentOpenedFileName(), 'info');
    if (statusRight) {
      statusRight.textContent = `${state.currentPageIndex + 1} / ${state.archive.meta.totalPages} 쪽${activeStatusText ? ` | ${activeStatusText}` : ''}`;
    }
  } else if (state.currentView === 'viewer' && state.openedImage) {
    updateStatus('이미지', getCurrentOpenedFileName(), 'info');
    if (statusRight) {
      statusRight.textContent = activeStatusText || '이미지 보기';
    }
  } else {
    updateStatus('대기 중', '파일을 선택하거나 드롭해 주세요.', 'idle');
    if (statusRight) {
      statusRight.textContent = '';
    }
  }
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
  const bookNavigationHint = getBookNavigationStatusHint();
  if (!fileName) {
    return statusText;
  }

  if (!statusText) {
    return bookNavigationHint ? `${fileName} | ${bookNavigationHint}` : fileName;
  }

  return bookNavigationHint ? `${fileName} | ${statusText} | ${bookNavigationHint}` : `${fileName} | ${statusText}`;
}

function syncRecentItemsToMenu(): void {
  window.appApi.updateRecentMenu(
    state.recentItems.slice(0, 10).map((item) => ({
      zipPath: item.zipPath,
      title: item.title
    }))
  );
  if (typeof renderHtmlRecentSubmenu === 'function') {
    renderHtmlRecentSubmenu();
  }
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

  const delta = step > 0 ? `+${Math.abs(step)}` : `-${Math.abs(step)}`;
  const message = t('viewer.toast.move', {
    delta,
    current: state.currentPageIndex + 1,
    total: state.archive.meta.totalPages
  });

  updateStatus('이동', message, 'loading');

  if (pageMoveToastTimer !== null) {
    window.clearTimeout(pageMoveToastTimer);
  }

  pageMoveToastTimer = window.setTimeout(() => {
    syncViewerStatusToMenu('');
    pageMoveToastTimer = null;
  }, 1200);
}

function setSidebarDragLayerActive(active: boolean): void {
  elements.sidebarDragLayer().classList.toggle('active', active);
}

let busyCursorDepth = 0;

function setBusyCursor(active: boolean): void {
  busyCursorDepth = Math.max(0, busyCursorDepth + (active ? 1 : -1));
  document.body.style.cursor = busyCursorDepth > 0 ? 'wait' : '';
}

function isZipPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.zip');
}

function isCbzPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.cbz');
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

// Image decoding, double-buffering image preloading, sizing calculations, and rendering schedules are now entirely managed in viewer.ts

function clearSidebarListContext(): void {
  state.currentFolderPath = null;
  state.sidebarItems = [];
  state.selectedSidebarItemPath = null;
  syncFileSelectionStateToMenu();
  syncBookNavigationStateToMenu();
}

async function openZipPath(
  zipPath: string,
  options?: { preserveSidebarContext?: boolean; preferredPageIndex?: number; skipRecentUpdate?: boolean; suppressError?: boolean }
): Promise<{ ok: true } | { ok: false; error: SerializableAppError }> {
  clearError();
  resetOpenedContent();
  const result = await window.appApi.openZip(zipPath);
  if (!result.ok) {
    if (!options?.suppressError) {
      showError(result.error);
    }
    return { ok: false, error: result.error };
  }

  state.archive = result.data;
  state.zipPath = zipPath;
  if (typeof options?.preferredPageIndex === 'number') {
    const lastPageIndex = Math.max(0, result.data.meta.totalPages - 1);
    state.currentPageIndex = Math.max(0, Math.min(options.preferredPageIndex, lastPageIndex));
  } else {
    state.currentPageIndex = await resolveInitialPageIndex(result.data.meta.fileId, result.data.meta.totalPages);
  }

  if (!options?.preserveSidebarContext) {
    const folderPath = getDirectoryPath(zipPath);
    const folderResult = await window.appApi.listFolderItems(folderPath);
    if (folderResult.ok) {
      state.currentFolderPath = folderPath;
      state.sidebarItems = folderResult.data;
      state.bookNavItems = folderResult.data;
    } else {
      clearSidebarListContext();
    }
  }

  setSelectedSidebarItem(zipPath);
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

  if (!options?.preserveSidebarContext) {
    const folderPath = getDirectoryPath(imagePath);
    const folderResult = await window.appApi.listFolderItems(folderPath);
    if (folderResult.ok) {
      state.currentFolderPath = folderPath;
      state.sidebarItems = folderResult.data;
      state.bookNavItems = folderResult.data;
    } else {
      clearSidebarListContext();
    }
  }

  setSelectedSidebarItem(imagePath);
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

  if (isCbzPath(filePath)) {
    const convertFirst = await confirmAction(t('dialog.confirm.cbzPreferZip', { name: filePath }));
    if (convertFirst) {
      setBusyCursor(true);
      try {
        const result = await window.appApi.convertArchiveToZip(filePath, getDirectoryPath(filePath));
        if (!result.ok) {
          if (isArchiveValidationError(result.error.code)) {
            showArchiveValidationModal(result.error);
          } else {
            showError(result.error);
          }
          return;
        }
        await openZipPath(result.data.outputPath, options);
      } finally {
        setBusyCursor(false);
      }
      return;
    }

    const openResult = await openZipPath(filePath, { ...options, suppressError: true });
    if (!openResult.ok) {
      if (isArchiveValidationError(openResult.error.code)) {
        showArchiveValidationModal(openResult.error);
      } else {
        showError(openResult.error);
      }
    }
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
      if (item.type === 'zip' || item.type === 'image' || item.type === 'archive') {
        void openFilePath(item.path, { preserveSidebarContext: true });
        return;
      }
    });
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      setSelectedSidebarItem(item.path);
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

function confirmAction(message: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const modal = document.getElementById('custom-confirm-modal');
    const msgEl = document.getElementById('confirm-modal-message');
    const confirmBtn = document.getElementById('confirm-modal-confirm');
    const cancelBtn = document.getElementById('confirm-modal-cancel');

    if (!modal || !msgEl || !confirmBtn || !cancelBtn) {
      resolve(window.confirm(message));
      return;
    }

    msgEl.textContent = message;
    modal.classList.remove('hidden');

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      modal.classList.add('hidden');
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
  });
}

function startNotificationTimer(): void {
  if (notificationModalTimer !== null) {
    window.clearTimeout(notificationModalTimer);
  }
  notificationModalTimer = window.setTimeout(() => {
    elements.notificationModal().classList.add('hidden');
    notificationModalTimer = null;
  }, 3000);
}

function stopNotificationTimer(): void {
  if (notificationModalTimer !== null) {
    window.clearTimeout(notificationModalTimer);
    notificationModalTimer = null;
  }
}

function notifyAction(message: string): void {
  const modal = elements.notificationModal();
  const textEl = elements.notificationModalText();
  const panel = modal.querySelector('.notification-modal-panel') as HTMLDivElement;

  stopNotificationTimer();



  textEl.textContent = message;
  modal.classList.remove('hidden');

  startNotificationTimer();
}

async function readImageDimensions(name: string, mimeType: string, bytes: ArrayBuffer): Promise<ImageDimensions> {
  const blob = new Blob([bytes], { type: mimeType });
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
): Promise<{ mimeType: string; bytes: ArrayBuffer }> {
  const blob = new Blob([source.bytes], { type: source.mimeType });
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
      bytes: buffer // ArrayBuffer
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

  const confirmed = await confirmAction(
    t('dialog.confirm.pageDelete', {
      name: currentPage.displayName,
      page: pageIndex + 1
    })
  );
  if (!confirmed) {
    return;
  }

  const preferredPageIndex = state.currentPageIndex;
  setBusyCursor(true);
  const editResult = await window.appApi
    .editZipPages(state.zipPath, {
      kind: 'delete',
      targetEntryName: currentPage.entryName
    })
    .finally(() => {
      setBusyCursor(false);
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
  const confirmed = await confirmAction(
    t('dialog.confirm.pageInsertAfter', {
      currentName: currentPage.displayName,
      insertName
    })
  );
  if (!confirmed) {
    return;
  }

  const preferredPageIndex = state.currentPageIndex;
  setBusyCursor(true);
  const editResult = await window.appApi
    .editZipPages(state.zipPath, {
      kind: 'insert-after',
      afterEntryName: currentPage.entryName,
      insertFileName: adjustedInsert.name,
      insertMimeType: adjustedInsert.mimeType,
      insertBytes: adjustedInsert.bytes
    })
    .finally(() => {
      setBusyCursor(false);
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
    const confirmed = await confirmAction(t('dialog.confirm.fileCut', { name: selectedName }));
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
  const confirmed = await confirmAction(confirmMessage);
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

  const confirmed = await confirmAction(t('dialog.confirm.fileDelete', { name: selected.name }));
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

// handleMenuAction has been migrated to events.ts for cohesive event-action coupling

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

// Keydown event bindings and escape behaviors are managed inside events.ts

function renderStaticText(): void {
  document.title = t('app.title');
  elements.sidebarTitle().textContent = t('sidebar.title');
  elements.dropOverlayText().textContent = t('drop.openZip');
  elements.settingsPlaceholder().textContent = t('settings.placeholder');
  const wordmark = elements.launcherWordmark();
  if (wordmark) { wordmark.textContent = t('app.title'); }
  const recentLabel = elements.launcherRecentLabel();
  if (recentLabel) { recentLabel.textContent = t('launcher.recent.title'); }
  const btnFile = elements.launcherBtnOpenFile();
  if (btnFile) {
    const icon = btnFile.querySelector('svg')?.outerHTML ?? '';
    btnFile.innerHTML = `${icon} ${t('menu.openFile')}`;
  }
  const btnFolder = elements.launcherBtnOpenFolder();
  if (btnFolder) {
    const icon = btnFolder.querySelector('svg')?.outerHTML ?? '';
    btnFolder.innerHTML = `${icon} ${t('menu.openFolder')}`;
  }

  // Translate custom HTML Menubar buttons & inner dropdown static items
  const fileTrigger = document.querySelector('#menu-item-file .custom-menu-trigger');
  if (fileTrigger) fileTrigger.textContent = t('menu.file');
  const editTrigger = document.querySelector('#menu-item-edit .custom-menu-trigger');
  if (editTrigger) editTrigger.textContent = t('menu.edit');
  const viewTrigger = document.querySelector('#menu-item-view .custom-menu-trigger');
  if (viewTrigger) viewTrigger.textContent = t('menu.view');
  const localeTrigger = document.querySelector('#menu-item-locale .custom-menu-trigger');
  if (localeTrigger) localeTrigger.textContent = t('common.locale');
  const toolsTrigger = document.querySelector('#menu-item-tools .custom-menu-trigger');
  if (toolsTrigger) toolsTrigger.textContent = t('menu.tools');
  const helpTrigger = document.querySelector('#menu-item-help .custom-menu-trigger');
  if (helpTrigger) helpTrigger.textContent = t('menu.help');

  // Inner item translations
  const itemOpenFile = document.querySelector('[data-action="open-file"] .dropdown-text');
  if (itemOpenFile) itemOpenFile.textContent = t('menu.openFile');
  const itemOpenFolder = document.querySelector('[data-action="open-folder"] .dropdown-text');
  if (itemOpenFolder) itemOpenFolder.textContent = t('menu.openFolder');
  const itemCloseFile = document.querySelector('[data-action="close-file"] .dropdown-text');
  if (itemCloseFile) itemCloseFile.textContent = t('menu.closeFile') || '파일 닫기';
  
  // Recent items label
  const recentParentTrigger = document.querySelector('#menu-item-file .dropdown-submenu-parent .submenu-trigger .dropdown-text');
  if (recentParentTrigger) recentParentTrigger.textContent = t('launcher.recent.title');

  // File Transfer Actions
  const itemFileCopy = document.querySelector('[data-action="file-copy"] .dropdown-text');
  if (itemFileCopy) itemFileCopy.textContent = t('menu.edit.copy');
  const itemFileCut = document.querySelector('[data-action="file-cut"] .dropdown-text');
  if (itemFileCut) itemFileCut.textContent = t('menu.edit.cut');
  const itemFilePaste = document.querySelector('[data-action="file-paste"] .dropdown-text');
  if (itemFilePaste) itemFilePaste.textContent = t('menu.edit.paste');
  const itemFileDelete = document.querySelector('[data-action="file-delete"] .dropdown-text');
  if (itemFileDelete) itemFileDelete.textContent = t('menu.edit.deleteFile');
  const itemFileCancel = document.querySelector('[data-action="file-cancel-transfer"] .dropdown-text');
  if (itemFileCancel) itemFileCancel.textContent = t('menu.edit.cancelTransfer');

  // Page Editing
  const itemDeleteLeft = document.querySelector('[data-action="edit-delete-left-page"] .dropdown-text');
  if (itemDeleteLeft) {
    itemDeleteLeft.textContent = state.pageViewMode === 'single' ? t('menu.edit.pageDelete') : t('menu.edit.pageDeleteLeft');
  }
  const itemDeleteRight = document.querySelector('[data-action="edit-delete-right-page"] .dropdown-text');
  if (itemDeleteRight) itemDeleteRight.textContent = t('menu.edit.pageDeleteRight');
  const itemInsertAfter = document.querySelector('[data-action="edit-insert-after-current-page"] .dropdown-text');
  if (itemInsertAfter) itemInsertAfter.textContent = t('menu.edit.pageInsertAfter');

  // View & Page mode
  const pageModeTrigger = document.querySelector('#menu-item-view .dropdown-submenu-parent:first-of-type .submenu-trigger .dropdown-text');
  if (pageModeTrigger) pageModeTrigger.textContent = t('menu.view.pageMode');
  const itemSingle = document.querySelector('[data-action="view-single-page"] .dropdown-text');
  if (itemSingle) itemSingle.textContent = t('menu.view.singlePage');
  const itemDouble = document.querySelector('[data-action="view-double-page"] .dropdown-text');
  if (itemDouble) itemDouble.textContent = t('menu.view.doublePage');
  
  const itemShowViewer = document.querySelector('[data-action="show-viewer"] .dropdown-text');
  if (itemShowViewer) itemShowViewer.textContent = t('tree.viewer');

  // Navigation (Move)
  const moveTrigger = document.querySelector('#menu-item-view .dropdown-submenu-parent:nth-of-type(2) .submenu-trigger .dropdown-text');
  if (moveTrigger) moveTrigger.textContent = t('menu.view.move');
  const itemMovePrev = document.querySelector('[data-action="move-prev-page"] .dropdown-text');
  if (itemMovePrev) itemMovePrev.textContent = t('menu.view.movePrevPage');
  const itemMoveNext = document.querySelector('[data-action="move-next-page"] .dropdown-text');
  if (itemMoveNext) itemMoveNext.textContent = t('menu.view.moveNextPage');
  const itemMoveFirst = document.querySelector('[data-action="move-first-page"] .dropdown-text');
  if (itemMoveFirst) itemMoveFirst.textContent = t('menu.view.moveFirstPage');
  const itemMoveLast = document.querySelector('[data-action="move-last-page"] .dropdown-text');
  if (itemMoveLast) itemMoveLast.textContent = t('menu.view.moveLastPage');
  const itemMovePrev10 = document.querySelector('[data-action="move-prev-10-pages"] .dropdown-text');
  if (itemMovePrev10) itemMovePrev10.textContent = t('menu.view.movePrev10');
  const itemMoveNext10 = document.querySelector('[data-action="move-next-10-pages"] .dropdown-text');
  if (itemMoveNext10) itemMoveNext10.textContent = t('menu.view.moveNext10');
  const itemOpenPrevBook = document.querySelector('[data-action="open-prev-book"] .dropdown-text');
  if (itemOpenPrevBook) itemOpenPrevBook.textContent = t('menu.view.openPrevBook');
  const itemOpenNextBook = document.querySelector('[data-action="open-next-book"] .dropdown-text');
  if (itemOpenNextBook) itemOpenNextBook.textContent = t('menu.view.openNextBook');

  const itemToggleList = document.querySelector('[data-action="toggle-folder-list"] .dropdown-text');
  if (itemToggleList) itemToggleList.textContent = t('menu.view.folderList');

  // Image Fit
  const fitParentTrigger = document.querySelector('#menu-item-view .dropdown-submenu-parent:last-of-type .submenu-trigger .dropdown-text');
  if (fitParentTrigger) fitParentTrigger.textContent = t('menu.view.imageFit');
  const itemFitAuto = document.querySelector('[data-action="image-fit-auto"] .dropdown-text');
  if (itemFitAuto) itemFitAuto.textContent = t('menu.view.imageFitAuto');
  const itemFitActual = document.querySelector('[data-action="image-fit-actual"] .dropdown-text');
  if (itemFitActual) itemFitActual.textContent = t('menu.view.imageFitActual');
  const itemFitWidth = document.querySelector('[data-action="image-fit-width"] .dropdown-text');
  if (itemFitWidth) itemFitWidth.textContent = t('menu.view.imageFitWidth');
  const itemFitHeight = document.querySelector('[data-action="image-fit-height"] .dropdown-text');
  if (itemFitHeight) itemFitHeight.textContent = t('menu.view.imageFitHeight');

  const itemToolConv = document.querySelector('[data-tool="converter"] .dropdown-text');
  if (itemToolConv) itemToolConv.textContent = t('menu.tools.converter');
  const itemHelpGuide = document.querySelector('[data-help="user-guide"] .dropdown-text');
  if (itemHelpGuide) itemHelpGuide.textContent = t('menu.help.userGuide');
  const itemHelpAbout = document.querySelector('[data-help="about"] .dropdown-text');
  if (itemHelpAbout) itemHelpAbout.textContent = t('menu.about');
}

function clampSidebarWidth(width: number): number {
  return Math.min(520, Math.max(180, width));
}

function applySidebarWidth(): void {
  elements.workspace().style.setProperty('--sidebar-width', `${clampSidebarWidth(state.sidebarWidth)}px`);
}

function renderLauncherRecentList(): void {
  const list = elements.launcherRecentList();
  const emptyEl = elements.launcherRecentEmpty();
  if (!list) { return; }

  // Remove all items except the empty placeholder
  Array.from(list.children).forEach((child) => {
    if (child.id !== 'launcher-recent-empty') {
      child.remove();
    }
  });

  const items = state.recentItems.slice(0, 5);
  if (items.length === 0) {
    if (emptyEl) {
      emptyEl.textContent = t('launcher.recent.empty');
      emptyEl.classList.remove('hidden');
    }
    return;
  }

  if (emptyEl) { emptyEl.classList.add('hidden'); }

  items.forEach((item) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'launcher-recent-item';
    btn.title = item.zipPath;

    const iconSvg = `<svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 3.5A1.5 1.5 0 013.5 2h4.086a1.5 1.5 0 011.06.44l.915.914A1.5 1.5 0 0010.62 4H12.5A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z" stroke="currentColor" stroke-width="1.3"/></svg>`;
    const dirParts = item.zipPath.replace(/\\/g, '/').split('/');
    const dirName = dirParts.length > 2 ? dirParts[dirParts.length - 2] : '';

    btn.innerHTML = [
      `<span class="launcher-recent-icon">${iconSvg}</span>`,
      `<span class="launcher-recent-info">`,
      `  <span class="launcher-recent-name">${item.title}</span>`,
      dirName ? `  <span class="launcher-recent-meta">${dirName}</span>` : '',
      `</span>`,
      item.lastPageIndex > 0
        ? `<span class="launcher-recent-page">p.${item.lastPageIndex + 1}</span>`
        : ''
    ].join('');

    btn.addEventListener('click', () => {
      void (async () => {
        const openResult = await openZipPath(item.zipPath, { suppressError: true });
        if (!openResult.ok && openResult.error.code === 'FILE_NOT_FOUND') {
          const removeResult = await window.appApi.removeRecentByPath(item.zipPath);
          if (removeResult.ok) {
            state.recentItems = removeResult.data;
            syncRecentItemsToMenu();
            renderLauncherRecentList();
          }
        }
      })();
    });

    li.appendChild(btn);
    list.appendChild(li);
  });
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
  renderLauncherRecentList();
  requestViewerRender();
  switchView(state.currentView);
}

// All dropdown interactions, window listeners, pointer splitters, and application init() logic are now managed inside events.ts
