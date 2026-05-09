declare function startNotificationTimer(): void;
declare function stopNotificationTimer(): void;
declare function setPageIndex(nextIndex: number): boolean;
declare function refreshBookNavigationItemsFromCurrentFile(): Promise<void>;
declare function getCurrentOpenedBookIndex(): number;
declare function getNavigableSidebarItems(): any[];
declare function setSelectedSidebarItem(path: string | null): void;
declare function openFilePath(filePath: string, options?: any): Promise<any>;
declare function canOpenNextBookFromCurrent(): boolean;
declare function canOpenPrevBookFromCurrent(): boolean;
declare function updateStatus(badgeText: string, statusText: string, type?: 'idle' | 'loading' | 'info' | 'success' | 'warn'): void;
declare function notifyAction(message: string): void;

// Keyboard & User Input Event Listeners
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
    if (normalizedKey === 'w') {
      event.preventDefault();
      handleMenuAction('close-file');
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

// HTML Menu state for active hover-sliding
let isHtmlMenuOpen = false;

function closeAllHtmlMenus(): void {
  document.querySelectorAll('.custom-menu-item').forEach((el) => {
    el.classList.remove('active');
  });
  isHtmlMenuOpen = false;
}

function showAllRecentsModal(): void {
  const modal = document.getElementById('all-recents-modal');
  const list = document.getElementById('all-recents-modal-list');
  const closeBtn = document.getElementById('all-recents-modal-close');
  if (!modal || !list || !closeBtn) return;

  list.innerHTML = '';

  state.recentItems.forEach((item) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'all-recents-modal-item';
    
    const dirParts = item.zipPath.replace(/\\/g, '/').split('/');
    const dirName = dirParts.length > 2 ? dirParts[dirParts.length - 2] : '';
    
    btn.innerHTML = `
      <span class="all-recents-modal-name">${item.title}</span>
      ${dirName ? `<span class="all-recents-modal-meta">${dirName}</span>` : ''}
    `;
    
    btn.addEventListener('click', () => {
      modal.classList.add('hidden');
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

  modal.classList.remove('hidden');

  const handleClose = () => {
    modal.classList.add('hidden');
    closeBtn.removeEventListener('click', handleClose);
  };
  closeBtn.addEventListener('click', handleClose);
}

function renderHtmlRecentSubmenu(): void {
  const container = document.getElementById('html-recent-submenu');
  if (!container) return;
  container.innerHTML = '';

  const items = state.recentItems.slice(0, 10);
  if (items.length === 0) {
    const emptyBtn = document.createElement('button');
    emptyBtn.type = 'button';
    emptyBtn.className = 'dropdown-item';
    emptyBtn.disabled = true;
    emptyBtn.textContent = t('launcher.recent.empty');
    container.appendChild(emptyBtn);
    return;
  }

  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dropdown-item';
    btn.title = item.zipPath;
    btn.textContent = item.title;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllHtmlMenus();
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
    container.appendChild(btn);
  });

  // If there are more than 10 recent items, append the "Show more..." button
  if (state.recentItems.length > 10) {
    const divider = document.createElement('div');
    divider.className = 'dropdown-separator';
    container.appendChild(divider);

    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'dropdown-item';
    moreBtn.style.color = 'var(--accent)';
    moreBtn.style.fontWeight = '700';
    moreBtn.textContent = '⏱️ 더 보기...';
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllHtmlMenus();
      showAllRecentsModal();
    });
    container.appendChild(moreBtn);
  }
}

function setupHtmlDropdownEvents(): void {
  const menuItems = document.querySelectorAll('.custom-menu-item');

  menuItems.forEach((item) => {
    const trigger = item.querySelector('.custom-menu-trigger');
    
    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = item.classList.contains('active');
      closeAllHtmlMenus();
      
      if (!isActive) {
        item.classList.add('active');
        isHtmlMenuOpen = true;
        if (item.id === 'menu-item-file') {
          renderHtmlRecentSubmenu();
        }
      }
    });

    trigger?.addEventListener('mouseenter', () => {
      if (isHtmlMenuOpen) {
        document.querySelectorAll('.custom-menu-item').forEach((el) => {
          el.classList.remove('active');
        });
        item.classList.add('active');
        if (item.id === 'menu-item-file') {
          renderHtmlRecentSubmenu();
        }
      }
    });
  });

  // Delegate action clicks inside custom dropdowns
  document.querySelectorAll('.custom-dropdown').forEach((dropdown) => {
    dropdown.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.dropdown-item') as HTMLButtonElement | null;
      if (!btn) return;

      const action = btn.getAttribute('data-action') as MenuAction | null;
      const locale = btn.getAttribute('data-locale') as Locale | null;
      const tool = btn.getAttribute('data-tool');
      const help = btn.getAttribute('data-help');

      if (action) {
        e.stopPropagation();
        closeAllHtmlMenus();
        handleMenuAction(action);
      } else if (locale) {
        e.stopPropagation();
        closeAllHtmlMenus();
        applyLocaleFromMenu(locale);
        renderAll();
      } else if (tool === 'converter') {
        e.stopPropagation();
        closeAllHtmlMenus();
        // Trigger converter window opening via preload API (using exist any hook safely)
        void (window.appApi as any).showMenuTools?.();
      } else if (help === 'user-guide') {
        e.stopPropagation();
        closeAllHtmlMenus();
        void (window.appApi as any).showMenuHelp?.();
      } else if (help === 'about') {
        e.stopPropagation();
        closeAllHtmlMenus();
        void (window.appApi as any).showMenuHelp?.();
      }
    });
  });

  // Close menus when clicking outside
  document.addEventListener('click', () => {
    closeAllHtmlMenus();
  });
}

function bindEvents(): void {
  // Bind Custom HTML Dropdown interactions
  setupHtmlDropdownEvents();

  // Direct Page View Toggles (1쪽/2쪽)
  document.getElementById('header-btn-single')?.addEventListener('click', () => {
    handleMenuAction('view-single-page');
  });
  document.getElementById('header-btn-double')?.addEventListener('click', () => {
    handleMenuAction('view-double-page');
  });

  // Premium Window Controls
  document.getElementById('win-btn-minimize')?.addEventListener('click', () => {
    window.appApi.minimizeWindow();
  });
  document.getElementById('win-btn-maximize')?.addEventListener('click', () => {
    window.appApi.maximizeWindow();
  });
  document.getElementById('win-btn-close')?.addEventListener('click', () => {
    window.appApi.closeWindow();
  });

  // Launcher buttons
  elements.launcherBtnOpenFile()?.addEventListener('click', () => {
    handleMenuAction('open-file');
  });
  elements.launcherBtnOpenFolder()?.addEventListener('click', () => {
    handleMenuAction('open-folder');
  });

  const unsubscribeMenuAction = window.appApi.onMenuAction((action) => {
    handleMenuAction(action);
  });
  const unsubscribeOpenRecent = window.appApi.onOpenRecent((zipPath) => {
    void (async () => {
      const openResult = await openZipPath(zipPath, { suppressError: true });
      if (openResult.ok || openResult.error.code !== 'FILE_NOT_FOUND') {
        return;
      }

      const removeResult = await window.appApi.removeRecentByPath(zipPath);
      if (!removeResult.ok) {
        showError(removeResult.error);
        return;
      }

      state.recentItems = removeResult.data;
      syncRecentItemsToMenu();
      renderLauncherRecentList();
    })();
  });
  const unsubscribeLocaleSelected = window.appApi.onLocaleSelected((locale) => {
    applyLocaleFromMenu(locale);
    renderAll();
  });
  let splitterDragging = false;
  let viewerResizeRafId: number | null = null;

  elements.fileTree().addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  elements.sidebar().addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  elements.viewerImage().addEventListener('contextmenu', (event) => {
    event.preventDefault();
    window.appApi.showViewerContextMenu();
  });

  let notificationDragging = false;
  let notificationIsHovered = false;
  let notificationDragStartX = 0;
  let notificationDragStartY = 0;
  let notificationModalCurrentX = 0;
  let notificationModalCurrentY = 0;

  const notificationModalEl = elements.notificationModal();
  const notificationPanelEl = notificationModalEl.querySelector('.notification-modal-panel') as HTMLDivElement;

  const savedX = localStorage.getItem('notificationModalX');
  const savedY = localStorage.getItem('notificationModalY');
  if (savedX !== null && savedY !== null) {
    notificationPanelEl.style.left = `${savedX}px`;
    notificationPanelEl.style.top = `${savedY}px`;
  }

  notificationPanelEl.addEventListener('mouseenter', () => {
    notificationIsHovered = true;
    stopNotificationTimer();
  });

  notificationPanelEl.addEventListener('mouseleave', () => {
    notificationIsHovered = false;
    if (!notificationDragging) {
      startNotificationTimer();
    }
  });

  notificationPanelEl.addEventListener('mousedown', (event) => {
    stopNotificationTimer();

    notificationDragging = true;
    notificationDragStartX = event.clientX;
    notificationDragStartY = event.clientY;

    notificationModalCurrentX = parseFloat(notificationPanelEl.style.left) || 0;
    notificationModalCurrentY = parseFloat(notificationPanelEl.style.top) || 0;

    notificationPanelEl.style.transition = 'none';
    notificationPanelEl.style.cursor = 'grabbing';
    event.preventDefault();
  });

  window.addEventListener('mousemove', (event) => {
    if (!notificationDragging) {
      return;
    }

    const deltaX = event.clientX - notificationDragStartX;
    const deltaY = event.clientY - notificationDragStartY;

    const targetX = notificationModalCurrentX + deltaX;
    const targetY = notificationModalCurrentY + deltaY;

    notificationPanelEl.style.left = `${targetX}px`;
    notificationPanelEl.style.top = `${targetY}px`;
  });

  window.addEventListener('mouseup', () => {
    if (!notificationDragging) {
      return;
    }

    notificationDragging = false;
    notificationPanelEl.style.transition = '';
    notificationPanelEl.style.cursor = 'move';

    localStorage.setItem('notificationModalX', notificationPanelEl.style.left.replace('px', ''));
    localStorage.setItem('notificationModalY', notificationPanelEl.style.top.replace('px', ''));

    if (!notificationIsHovered) {
      startNotificationTimer();
    }
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

  let lastWheelPageFlipTime = 0;

  elements.viewerView().addEventListener(
    'wheel',
    (event) => {
      if (event.shiftKey) {
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
        return;
      }

      // No shift key: Smart mouse wheel page navigation!
      if (state.currentView !== 'viewer' || !state.archive) {
        return;
      }

      const container = elements.viewerImage();
      const deltaY = event.deltaY;
      const isScrollable = container.scrollHeight > container.clientHeight;

      if (deltaY > 0) {
        const isAtBottom = !isScrollable || (container.scrollTop + container.clientHeight >= container.scrollHeight - 12);
        if (isAtBottom) {
          const now = Date.now();
          if (now - lastWheelPageFlipTime > 350) {
            lastWheelPageFlipTime = now;
            movePage(1);
          }
          event.preventDefault();
        }
      } else if (deltaY < 0) {
        const isAtTop = !isScrollable || (container.scrollTop <= 12);
        if (isAtTop) {
          const now = Date.now();
          if (now - lastWheelPageFlipTime > 350) {
            lastWheelPageFlipTime = now;
            movePage(-1);
          }
          event.preventDefault();
        }
      }
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

function handleMenuAction(action: MenuAction): void {
  if (action === 'open-file') {
    void handleOpenFileClick();
    return;
  }

  if (action === 'open-folder') {
    void handleOpenFolderClick();
    return;
  }

  if (action === 'close-file') {
    resetOpenedContent();
    switchView('launcher');
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
    return;
  }

  if (action === 'theme-light') {
    document.body.setAttribute('data-theme', 'light');
    void window.appApi.updateAppSettings({ theme: 'light' });
    return;
  }

  if (action === 'theme-dark') {
    document.body.setAttribute('data-theme', 'dark');
    void window.appApi.updateAppSettings({ theme: 'dark' });
    return;
  }

  if (action === 'theme-system') {
    document.body.setAttribute('data-theme', 'system');
    void window.appApi.updateAppSettings({ theme: 'system' });
    return;
  }
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
  document.body.setAttribute('data-theme', appSettings.theme || 'dark');
  switchView('launcher');
  bindEvents();
  renderAll();
  void syncRecentItems();

  // Theme Integrity Guard & Live UI Toast Warning
  try {
    const testStyle = getComputedStyle(document.documentElement);
    if (!testStyle.getPropertyValue('--bg').trim() || testStyle.getPropertyValue('--bg').trim() === 'Canvas') {
      updateStatus('경고', '테마 정합성 오류로 인해 안전 다크모드 환경으로 구동되었습니다.', 'warn');
    }
  } catch (err) {
    console.warn('[Theme] Check bypassed:', err);
  }
}

function movePage(step: number): boolean {
  if (!state.archive) {
    return false;
  }

  const stepSize = state.pageViewMode === 'double' ? 2 : 1;
  const nextIndex = state.currentPageIndex + (step * stepSize);
  
  // 끝 범위(마지막 페이지)를 넘어서 전진하려는 경우
  if (step > 0 && nextIndex >= state.archive.meta.totalPages) {
    const lastPage = state.archive.meta.totalPages - 1;
    // 아직 마지막 페이지에 도달하지 않은 미완의 상태라면, 마지막 쪽으로 먼저 완벽 안착시킴
    if (state.currentPageIndex < lastPage) {
      return setPageIndex(lastPage);
    } else {
      void handleAdvanceBeyondLastPage();
      return false;
    }
  }

  // 시작 범위(첫 페이지)를 넘어서 후진하려는 경우
  if (step < 0 && nextIndex < 0) {
    // 아직 첫 페이지에 도달하지 않은 상태라면, 첫 쪽으로 먼저 완벽 복귀시킴
    if (state.currentPageIndex > 0) {
      return setPageIndex(0);
    } else {
      void handleRetreatBeforeFirstPage();
      return false;
    }
  }

  return setPageIndex(nextIndex);
}

function moveToFirstPage(): boolean {
  if (!state.archive) {
    return false;
  }

  if (state.currentPageIndex === 0) {
    void handleRetreatBeforeFirstPage();
    return false;
  }

  return setPageIndex(0);
}

function moveToLastPage(): boolean {
  if (!state.archive) {
    return false;
  }

  const lastPage = state.archive.meta.totalPages - 1;
  if (state.currentPageIndex === lastPage) {
    void handleAdvanceBeyondLastPage();
    return false;
  }

  return setPageIndex(lastPage);
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
    const confirmed = await confirmAction(t('dialog.confirm.openNextBook'));
    if (confirmed) {
      updateStatus('다음 권', '다음 권으로 이동합니다...', 'loading');
      void openAdjacentBook(1);
    }
    return;
  }

  updateStatus('알림', '마지막 권입니다.', 'warn');
  notifyAction(t('dialog.info.noNextBook'));
}

async function handleRetreatBeforeFirstPage(): Promise<void> {
  await refreshBookNavigationItemsFromCurrentFile();
  if (canOpenPrevBookFromCurrent()) {
    const confirmed = await confirmAction(t('dialog.confirm.openPrevBook'));
    if (confirmed) {
      updateStatus('이전 권', '이전 권으로 이동합니다...', 'loading');
      void openAdjacentBook(-1);
    }
    return;
  }

  updateStatus('알림', '첫 번째 권입니다.', 'warn');
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

document.addEventListener('DOMContentLoaded', () => {
  void init();
});
