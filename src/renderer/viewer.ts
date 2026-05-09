// Premium Image Decoding & Smooth Buffering Viewer Engine
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

async function renderImageBytes(name: string, mimeType: string, bytes: number[]): Promise<void> {
  const viewerImage = elements.viewerImage();
  const imageElement = document.createElement('img');
  imageElement.decoding = 'async';

  const blob = new Blob([Uint8Array.from(bytes)], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);

  imageElement.src = objectUrl;
  imageElement.alt = name;
  imageElement.className = `viewer-image-content fit-${state.imageFitMode}`;
  imageElement.draggable = false;
  applyViewerImageSizing(imageElement, state.pageViewMode === 'double');

  try {
    // Wait until the image is fully decoded in memory to prevent blank flashes!
    await imageElement.decode();
  } catch (e) {
    console.warn('Image decode error, falling back', e);
  }

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
    imageElement.style.height = viewerHeight > 0 ? heightValue : '100%';
    imageElement.style.maxHeight = 'none';
    imageElement.style.width = 'auto';
    imageElement.style.maxWidth = 'none';
    return;
  }

  if (state.imageFitMode === 'width') {
    imageElement.style.width = forDoublePage ? (viewerWidth > 0 ? widthValue : 'calc(50% - 8px)') : '100%';
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
  const objectUrls: string[] = [];
  const preloadedImages: HTMLImageElement[] = [];

  // Fetch and decode everything in the background buffer first!
  for (const page of pages) {
    const result = await window.appApi.getPage(state.zipPath as string, page.entryName);
    if (!result.ok) {
      showError(result.error);
      viewerImage.textContent = t('viewer.placeholder.loadFailed', { name: page.displayName });
      return;
    }

    const imageElement = document.createElement('img');
    imageElement.decoding = 'async';
    const blob = new Blob([Uint8Array.from(result.data.bytes)], { type: result.data.mimeType });
    const objectUrl = URL.createObjectURL(blob);
    imageElement.src = objectUrl;
    imageElement.alt = page.displayName;
    imageElement.className = getViewerImageClassName(state.pageViewMode === 'double');
    imageElement.draggable = false;
    applyViewerImageSizing(imageElement, state.pageViewMode === 'double');

    try {
      // Warm up and decode fully into GPU memory before doing any DOM switching!
      await imageElement.decode();
    } catch (e) {
      console.warn('Zip page image pre-decode failed', e);
    }

    preloadedImages.push(imageElement);
    objectUrls.push(objectUrl);
  }

  // DOUBLE BUFFER SWAP: Only replace DOM elements at the exact microsecond everything is decoded!
  viewerImage.innerHTML = '';
  preloadedImages.forEach((img) => viewerImage.appendChild(img));

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
  renderLauncherRecentList();
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

  // Only display full loading placeholder on absolute initial load (when DOM is completely empty) to prevent page-to-page black flashes!
  if (viewerImage.children.length === 0) {
    viewerImage.textContent = t('viewer.loading');
  }

  const renderToken = ++state.pageRenderToken;
  clearError();
  // Delay revoke to guarantee previous page holds during the background decode phase!
  const previousPageUrls = state.pageObjectUrl;
  await renderZipPages(pagesToRender);
  if (renderToken !== state.pageRenderToken) {
    return;
  }

  // Safely revoke older URLs only AFTER the new double-buffered page is firmly visual
  if (previousPageUrls && previousPageUrls !== state.pageObjectUrl) {
    for (const url of previousPageUrls.split('\n')) {
      if (url) URL.revokeObjectURL(url);
    }
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
