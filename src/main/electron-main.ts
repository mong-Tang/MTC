import fs from 'node:fs';
import path from 'node:path';

import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, type MenuItemConstructorOptions } from 'electron';

import { registerIpcHandlers } from './ipc/ipc-handlers';
import { setLocale, t, type Locale } from '../shared/i18n/i18n';
import { defaultAppSettings, type AppSettings, type ImageFitMode, type PageViewMode } from '../shared/stores/app-settings';
import type { RecentItem } from '../shared/stores/reading-state';
import { getAppSettings, saveAppSettings } from './stores/app-settings-store';

let mainWindow: BrowserWindow | null = null;
let converterWindow: BrowserWindow | null = null;
let helpWindow: BrowserWindow | null = null;
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
type ConverterMenuAction = 'select-source' | 'select-output' | 'start-conversion' | 'toggle-log' | 'show-policy' | 'fmt-zip' | 'fmt-cbz';

let currentSettings: AppSettings = defaultAppSettings;
let currentPageViewMode: PageViewMode = currentSettings.pageViewMode;
let currentImageFitMode: ImageFitMode = currentSettings.imageFitMode;
let currentShowSidebarList = currentSettings.showSidebarList;
let currentViewerStatus = '';
let currentRecentItems: Array<Pick<RecentItem, 'zipPath' | 'title'>> = [];
let currentLocale: Locale = currentSettings.locale;
let currentHasFileTransferClipboard = false;
let currentHasFileSelection = false;
let currentCanEditLeftPage = false;
let currentCanEditRightPage = false;
let currentCanOpenPrevBook = false;
let currentCanOpenNextBook = false;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

function getFilePathFromArgs(argv: string[]): string | null {
  // Skip Electron's internal runner arguments
  const startIndex = app.isPackaged ? 1 : 2;
  for (let i = startIndex; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('-')) continue;
    
    // Skip common build scripts / runner configurations
    if (arg === '.' || arg.includes('node_modules') || arg.endsWith('.js') || arg.endsWith('.ts')) {
      continue;
    }

    try {
      const resolvedPath = path.resolve(arg);
      if (fs.existsSync(resolvedPath)) {
        const stat = fs.statSync(resolvedPath);
        if (stat.isFile() || stat.isDirectory()) {
          return resolvedPath;
        }
      }
    } catch {
      // Continue checking other arguments
    }
  }
  return null;
}

const initialFilePath = getFilePathFromArgs(process.argv);

function persistAppSettings(partial: Partial<AppSettings>, context: string): void {
  void saveAppSettings(partial)
    .then((saved) => {
      currentSettings = saved;
    })
    .catch((error) => {
      console.warn(`[settings] failed to persist (${context}):`, error);
    });
}

function createMainWindow(): BrowserWindow {
  const iconPath = path.join(app.getAppPath(), 'build', 'icon.ico');
  const appIcon = nativeImage.createFromPath(iconPath);

  const window = new BrowserWindow({
    x: currentSettings.windowBounds.x,
    y: currentSettings.windowBounds.y,
    width: currentSettings.windowBounds.width,
    height: currentSettings.windowBounds.height,
    minWidth: 1350,
    minHeight: 825,
    frame: false,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    window.loadURL(devUrl);
  } else {
    window.loadFile(path.join(app.getAppPath(), 'dist', 'renderer', 'index.html'));
  }
  if (currentSettings.isMaximized) {
    window.maximize();
  }
  return window;
}

function createConverterWindow(): BrowserWindow {
  const iconPath = path.join(app.getAppPath(), 'build', 'icon.ico');
  const appIcon = nativeImage.createFromPath(iconPath);

  const window = new BrowserWindow({
    width: 960,
    height: 700,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    parent: mainWindow ?? undefined,
    modal: true,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });


  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    window.loadURL(new URL('/converter.html', devUrl).href);
  } else {
    window.loadFile(path.join(app.getAppPath(), 'converter.html'));
  }
  window.on('closed', () => {
    converterWindow = null;
  });
  return window;
}

function buildConverterWindowMenu(window: BrowserWindow): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: t('menu.file'),
      submenu: [
        {
          label: t('menu.converter.selectSource'),
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (!window.isDestroyed()) {
              window.webContents.send('converter:menu-action', 'select-source');
            }
          }
        },
        {
          label: t('menu.converter.selectOutput'),
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            if (!window.isDestroyed()) {
              window.webContents.send('converter:menu-action', 'select-output');
            }
          }
        },
        { type: 'separator' },
        {
          label: t('menu.window.close'),
          accelerator: 'CmdOrCtrl+W',
          click: () => window.close()
        }
      ]
    },
    {
      label: t('menu.edit'),
      submenu: [
        { label: t('menu.edit.undo') || 'Undo', role: 'undo' },
        { label: t('menu.edit.redo') || 'Redo', role: 'redo' },
        { type: 'separator' },
        { label: t('menu.edit.cut') || 'Cut', role: 'cut' },
        { label: t('menu.edit.copy') || 'Copy', role: 'copy' },
        { label: t('menu.edit.paste') || 'Paste', role: 'paste' },
        { label: t('menu.edit.selectAll') || 'Select All', role: 'selectAll' }
      ]
    },
    {
      label: t('menu.converter'),
      submenu: [
        {
          label: t('menu.converter.start'),
          accelerator: 'F5',
          click: () => {
            if (!window.isDestroyed()) {
              window.webContents.send('converter:menu-action', 'start-conversion');
            }
          }
        },
        {
          label: t('menu.converter.start') + ' (Sub)',
          accelerator: 'CmdOrCtrl+Enter',
          visible: false,
          click: () => {
            if (!window.isDestroyed()) {
              window.webContents.send('converter:menu-action', 'start-conversion');
            }
          }
        },
        { type: 'separator' },
        {
          label: t('menu.converter.showLog'),
          type: 'checkbox',
          checked: true,
          click: () => {
            if (!window.isDestroyed()) {
              window.webContents.send('converter:menu-action', 'toggle-log');
            }
          }
        }
      ]
    },
    {
      label: t('menu.help'),
      submenu: [
        {
          label: t('menu.converter.policy'),
          click: () => {
            if (!window.isDestroyed()) {
              window.webContents.send('converter:menu-action', 'show-policy');
            }
          }
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}

function sendConverterMenuAction(action: ConverterMenuAction): void {
  if (!converterWindow || converterWindow.isDestroyed()) {
    return;
  }

  converterWindow.webContents.send('converter:menu-action', action);
}

function openConverterWindow(): void {
  if (converterWindow && !converterWindow.isDestroyed()) {
    if (converterWindow.isMinimized()) {
      converterWindow.restore();
    }
    converterWindow.focus();
    return;
  }

  converterWindow = createConverterWindow();
}

function createHelpWindow(): BrowserWindow {
  const iconPath = path.join(app.getAppPath(), 'build', 'icon.ico');
  const appIcon = nativeImage.createFromPath(iconPath);

  const window = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    frame: false,
    parent: mainWindow ?? undefined,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.setMenuBarVisibility(false);
  window.setMenu(null);
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    const helpUrl = new URL('/help.html', devUrl);
    helpUrl.searchParams.set('lang', currentLocale);
    window.loadURL(helpUrl.href);
  } else {
    window.loadFile(path.join(app.getAppPath(), 'help.html'), { query: { lang: currentLocale } });
  }
  window.on('closed', () => {
    helpWindow = null;
  });
  return window;
}

function enforceHelpWindowMenuHidden(): void {
  if (!helpWindow || helpWindow.isDestroyed()) {
    return;
  }
  helpWindow.setMenuBarVisibility(false);
  helpWindow.setMenu(null);
}

function openHelpWindow(): void {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (helpWindow && !helpWindow.isDestroyed()) {
    if (devUrl) {
      const helpUrl = new URL('/help.html', devUrl);
      helpUrl.searchParams.set('lang', currentLocale);
      helpWindow.loadURL(helpUrl.href);
    } else {
      helpWindow.loadFile(path.join(app.getAppPath(), 'help.html'), { query: { lang: currentLocale } });
    }
    enforceHelpWindowMenuHidden();
    if (helpWindow.isMinimized()) {
      helpWindow.restore();
    }
    helpWindow.focus();
    return;
  }

  helpWindow = createHelpWindow();
}

function reloadHelpWindowForLocale(): void {
  if (!helpWindow || helpWindow.isDestroyed()) {
    return;
  }
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    const helpUrl = new URL('/help.html', devUrl);
    helpUrl.searchParams.set('lang', currentLocale);
    helpWindow.loadURL(helpUrl.href);
  } else {
    helpWindow.loadFile(path.join(app.getAppPath(), 'help.html'), { query: { lang: currentLocale } });
  }
  enforceHelpWindowMenuHidden();
}

let persistWindowStateTimer: NodeJS.Timeout | null = null;

function queuePersistWindowState(window: BrowserWindow): void {
  if (persistWindowStateTimer) {
    clearTimeout(persistWindowStateTimer);
  }

  persistWindowStateTimer = setTimeout(() => {
    const bounds = window.isMaximized() ? window.getNormalBounds() : window.getBounds();
    persistAppSettings({
      windowBounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      },
      isMaximized: window.isMaximized()
    }, 'window-state');
  }, 120);
}

function sendMenuAction(action: MenuAction): void {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  targetWindow.webContents.send('menu:action', action);
}

function sendOpenRecent(zipPath: string): void {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  targetWindow.webContents.send('menu:open-recent', zipPath);
}

function sendLocaleSelected(locale: Locale): void {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
  if (!targetWindow || targetWindow.isDestroyed()) {
    return;
  }

  targetWindow.webContents.send('menu:set-locale', locale);
}

function withShortcutLabel(label: string, shortcut: string): string {
  return label;
}

function acceleratorForLocale(shortcut: string): string | undefined {
  return shortcut;
}

function withHomeEndHint(label: string, key: 'Home' | 'End'): string {
  return `${label} (${key})`;
}

function buildFileEditMenuItems(): MenuItemConstructorOptions[] {
  const leftPageDeleteLabel =
    currentPageViewMode === 'single' ? t('menu.edit.pageDelete') : t('menu.edit.pageDeleteLeft');

  return [
    {
      label: leftPageDeleteLabel,
      enabled: currentCanEditLeftPage,
      click: () => sendMenuAction('edit-delete-left-page')
    },
    {
      label: t('menu.edit.pageDeleteRight'),
      enabled: currentCanEditRightPage,
      click: () => sendMenuAction('edit-delete-right-page')
    },
    {
      label: t('menu.edit.pageInsertAfter'),
      enabled: currentCanEditLeftPage,
      click: () => sendMenuAction('edit-insert-after-current-page')
    }
  ];
}

function buildFileTransferMenuItems(): MenuItemConstructorOptions[] {
  return [
    {
      label: t('menu.edit.copy'),
      accelerator: 'CmdOrCtrl+C',
      enabled: currentHasFileSelection,
      click: () => sendMenuAction('file-copy')
    },
    {
      label: t('menu.edit.cut'),
      accelerator: 'CmdOrCtrl+X',
      enabled: currentHasFileSelection,
      click: () => sendMenuAction('file-cut')
    },
    {
      label: t('menu.edit.paste'),
      accelerator: 'CmdOrCtrl+V',
      enabled: currentHasFileTransferClipboard,
      click: () => sendMenuAction('file-paste')
    },
    {
      label: t('menu.edit.deleteFile'),
      enabled: currentHasFileSelection,
      click: () => sendMenuAction('file-delete')
    },
    { type: 'separator' },
    {
      label: t('menu.edit.cancelTransfer'),
      accelerator: 'Escape',
      enabled: currentHasFileTransferClipboard,
      click: () => sendMenuAction('file-cancel-transfer')
    }
  ];
}

function buildFileContextMenuItems(): MenuItemConstructorOptions[] {
  const recentMenus: MenuItemConstructorOptions[] =
    currentRecentItems.length > 0
      ? currentRecentItems.slice(0, 10).map((item) => ({
          label: item.title || item.zipPath,
          click: () => sendOpenRecent(item.zipPath)
        }))
      : [{ label: t('launcher.recent.empty'), enabled: false }];

  return [
    {
      label: t('menu.openFile'),
      accelerator: 'CmdOrCtrl+O',
      click: () => sendMenuAction('open-file')
    },
    {
      label: t('tree.recent'),
      submenu: recentMenus
    },
    {
      label: t('menu.openFolder'),
      accelerator: 'CmdOrCtrl+Shift+O',
      click: () => sendMenuAction('open-folder')
    },
    { type: 'separator' },
    ...buildFileTransferMenuItems()
  ];
}

function buildViewContextMenuItems(): MenuItemConstructorOptions[] {
  return [
    {
      label: t('menu.view.pageMode'),
      submenu: [
        {
          label: t('menu.view.singlePage'),
          type: 'checkbox',
          checked: currentPageViewMode === 'single',
          click: () => {
            currentPageViewMode = 'single';
            persistAppSettings({ pageViewMode: 'single' }, 'context-view-menu-single');
            applyApplicationMenu();
            sendMenuAction('view-single-page');
          }
        },
        {
          label: t('menu.view.doublePage'),
          type: 'checkbox',
          checked: currentPageViewMode === 'double',
          click: () => {
            currentPageViewMode = 'double';
            persistAppSettings({ pageViewMode: 'double' }, 'context-view-menu-double');
            applyApplicationMenu();
            sendMenuAction('view-double-page');
          }
        }
      ]
    },
    {
      label: t('tree.viewer'),
      click: () => sendMenuAction('show-viewer')
    },
    { type: 'separator' },
    {
      label: t('menu.view.move'),
      submenu: [
        {
          label: withShortcutLabel(t('menu.view.movePrevPage'), 'Left'),
          accelerator: acceleratorForLocale('Left'),
          click: () => sendMenuAction('move-prev-page')
        },
        {
          label: withShortcutLabel(t('menu.view.moveNextPage'), 'Right'),
          accelerator: acceleratorForLocale('Right'),
          click: () => sendMenuAction('move-next-page')
        },
        { type: 'separator' },
        {
          label: withHomeEndHint(withShortcutLabel(t('menu.view.moveFirstPage'), 'Home'), 'Home'),
          accelerator: acceleratorForLocale('Home'),
          click: () => sendMenuAction('move-first-page')
        },
        {
          label: withHomeEndHint(withShortcutLabel(t('menu.view.moveLastPage'), 'End'), 'End'),
          accelerator: acceleratorForLocale('End'),
          click: () => sendMenuAction('move-last-page')
        },
        { type: 'separator' },
        {
          label: withShortcutLabel(t('menu.view.movePrev10'), 'PageUp'),
          accelerator: acceleratorForLocale('PageUp'),
          click: () => sendMenuAction('move-prev-10-pages')
        },
        {
          label: withShortcutLabel(t('menu.view.moveNext10'), 'PageDown'),
          accelerator: acceleratorForLocale('PageDown'),
          click: () => sendMenuAction('move-next-10-pages')
        },
        { type: 'separator' },
        {
          label: withShortcutLabel(t('menu.view.openPrevBook'), 'Shift+PageUp'),
          accelerator: acceleratorForLocale('Shift+PageUp'),
          enabled: currentCanOpenPrevBook,
          click: () => sendMenuAction('open-prev-book')
        },
        {
          label: withShortcutLabel(t('menu.view.openNextBook'), 'Shift+PageDown'),
          accelerator: acceleratorForLocale('Shift+PageDown'),
          enabled: currentCanOpenNextBook,
          click: () => sendMenuAction('open-next-book')
        }
      ]
    },
    { type: 'separator' },
    {
      label: t('menu.view.folderList'),
      type: 'checkbox',
      accelerator: 'CmdOrCtrl+B',
      checked: currentShowSidebarList,
      click: () => {
        currentShowSidebarList = !currentShowSidebarList;
        persistAppSettings({ showSidebarList: currentShowSidebarList }, 'context-toggle-folder-list');
        applyApplicationMenu();
        sendMenuAction('toggle-folder-list');
      }
    },
    { type: 'separator' },
    ...buildImageFitContextMenuItems(),
    { type: 'separator' },
    ...buildFileEditMenuItems()
  ];
}

function buildImageFitContextMenuItems(): MenuItemConstructorOptions[] {
  return [
    {
      label: t('menu.view.imageFitAuto'),
      type: 'checkbox',
      checked: currentImageFitMode === 'auto',
      click: () => {
        currentImageFitMode = 'auto';
        persistAppSettings({ imageFitMode: 'auto' }, 'context-image-fit-auto');
        applyApplicationMenu();
        sendMenuAction('image-fit-auto');
      }
    },
    {
      label: t('menu.view.imageFitActual'),
      type: 'checkbox',
      checked: currentImageFitMode === 'actual',
      click: () => {
        currentImageFitMode = 'actual';
        persistAppSettings({ imageFitMode: 'actual' }, 'context-image-fit-actual');
        applyApplicationMenu();
        sendMenuAction('image-fit-actual');
      }
    },
    {
      label: t('menu.view.imageFitWidth'),
      type: 'checkbox',
      checked: currentImageFitMode === 'width',
      click: () => {
        currentImageFitMode = 'width';
        persistAppSettings({ imageFitMode: 'width' }, 'context-image-fit-width');
        applyApplicationMenu();
        sendMenuAction('image-fit-width');
      }
    },
    {
      label: t('menu.view.imageFitHeight'),
      type: 'checkbox',
      checked: currentImageFitMode === 'height',
      click: () => {
        currentImageFitMode = 'height';
        persistAppSettings({ imageFitMode: 'height' }, 'context-image-fit-height');
        applyApplicationMenu();
        sendMenuAction('image-fit-height');
      }
    }
  ];
}

function buildLocaleContextMenuItems(): MenuItemConstructorOptions[] {
  return [
    {
      label: 'ko',
      type: 'radio',
      checked: currentLocale === 'ko',
      click: () => {
        currentLocale = 'ko';
        setLocale('ko');
        persistAppSettings({ locale: 'ko' }, 'context-locale-ko');
        reloadHelpWindowForLocale();
        applyApplicationMenu();
        sendLocaleSelected('ko');
      }
    },
    {
      label: 'en',
      type: 'radio',
      checked: currentLocale === 'en',
      click: () => {
        currentLocale = 'en';
        setLocale('en');
        persistAppSettings({ locale: 'en' }, 'context-locale-en');
        reloadHelpWindowForLocale();
        applyApplicationMenu();
        sendLocaleSelected('en');
      }
    }
  ];
}

function applyApplicationMenu(): void {
  Menu.setApplicationMenu(null);
}

if (!gotSingleInstanceLock) {
  app.quit();
}

app.on('second-instance', (event, commandLine) => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();

  const filePath = getFilePathFromArgs(commandLine);
  if (filePath) {
    mainWindow.webContents.send('menu:open-recent', filePath);
  }
});

app.whenReady().then(async () => {
  let dragOffset = { x: 0, y: 0 }; // 🛰️ [JS 드래그 엔진] 변위 계산용 메모리 캐시
  app.setAppUserModelId('com.mongtang.zipbookviewer');
  currentSettings = await getAppSettings();
  currentLocale = currentSettings.locale;
  currentPageViewMode = currentSettings.pageViewMode;
  currentImageFitMode = currentSettings.imageFitMode;
  currentShowSidebarList = currentSettings.showSidebarList;
  setLocale(currentLocale);
  registerIpcHandlers();
  ipcMain.handle('app:get-initial-file', () => initialFilePath);
  ipcMain.handle('app:get-settings', () => currentSettings);
  ipcMain.handle('app:update-settings', async (_event, partial: Partial<AppSettings>) => {
    currentSettings = await saveAppSettings(partial);
    currentLocale = currentSettings.locale;
    currentPageViewMode = currentSettings.pageViewMode;
    currentImageFitMode = currentSettings.imageFitMode;
    currentShowSidebarList = currentSettings.showSidebarList;
    setLocale(currentLocale);
    reloadHelpWindowForLocale();
    applyApplicationMenu();
    return currentSettings;
  });

  ipcMain.handle('app:set-locale', (_event, locale: Locale) => {
    if (locale !== 'ko' && locale !== 'en') {
      return false;
    }

    currentLocale = locale;
    setLocale(locale);
    persistAppSettings({ locale }, 'ipc-set-locale');
    reloadHelpWindowForLocale();
    applyApplicationMenu();
    return true;
  });

  ipcMain.on('window:drag-start', (event, data: { screenX: number; screenY: number }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    const bounds = win.getBounds();
    dragOffset = { x: data.screenX - bounds.x, y: data.screenY - bounds.y };
  });

  ipcMain.on('window:drag-move', (event, data: { screenX: number; screenY: number }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isMaximized()) return; // 🛡️ 최대화 상태에서는 이동 방지
    win.setBounds(
      {
        x: Math.floor(data.screenX - dragOffset.x),
        y: Math.floor(data.screenY - dragOffset.y),
        width: win.getBounds().width,
        height: win.getBounds().height
      },
      false // ⚡ 플리커 방지를 위한 애니메이션 비활성화
    );
  });

  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.on('window:show-viewer-context-menu', (event) => {
    const menu = Menu.buildFromTemplate(buildViewContextMenuItems());
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (targetWindow) {
      menu.popup({ window: targetWindow });
    }
  });

  ipcMain.on('window:open-converter', () => {
    openConverterWindow();
  });

  ipcMain.on('window:open-help', () => {
    openHelpWindow();
  });

  // 📐 [특명: 자동 밀착 리사이징 엔진]
  ipcMain.on('window:fit-to-image', (event, data: { imageAspectRatio: number; sidebarWidth: number; chromeHeight: number }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;

    const { imageAspectRatio, sidebarWidth, chromeHeight } = data;
    if (!imageAspectRatio || imageAspectRatio <= 0) return;

    // 🚀 [원상 복구] 최대화 상태인 경우 즉시 해제 후 축소 계산 돌입
    if (win.isMaximized()) {
      win.unmaximize();
    }

    // 📏 UI 전용 점유 면적 계산 (크롬 패딩)
    // 💡 [초정밀 진화] 하드코딩된 상수를 완전히 폐지하고, React가 실시간 측정하여 전달한 
    // 사이드바 가변폭(리사이저 2px 포함) 및 크롬 유휴높이를 100% 그대로 추종하여 틈새 여백을 원천 제거합니다!
    const CHROME_HEIGHT = typeof chromeHeight === 'number' ? chromeHeight : 26; 
    const SIDEBAR_WIDTH = typeof sidebarWidth === 'number' ? sidebarWidth : 0;

    // 🧭 현재 윈도우의 위치/크기 및 속해있는 모니터의 활용 가능 영역 확보
    const bounds = win.getBounds();
    const currentDisplay = screen.getDisplayMatching(bounds);
    const workArea = currentDisplay.workArea;

    // 실질적으로 이미지가 그려지는 내부 캔버스의 현재 크기
    const canvasW = bounds.width - SIDEBAR_WIDTH;
    const canvasH = bounds.height - CHROME_HEIGHT;
    if (canvasW <= 0 || canvasH <= 0) return;

    const canvasAspectRatio = canvasW / canvasH;

    let targetCanvasW = canvasW;
    let targetCanvasH = canvasH;

    if (canvasAspectRatio > imageAspectRatio) {
      // 📐 [케이스 A] 캔버스가 가로로 더 뚱뚱함 (좌우 여백 잔존)
      // -> 세로 길이를 기준으로 가로폭을 이미지 폭만큼 축소!
      targetCanvasW = targetCanvasH * imageAspectRatio;
    } else {
      // 📐 [케이스 B] 캔버스가 세로로 더 길쭉함 (위아래 여백 잔존)
      // -> 가로 너비를 기준으로 세로높이를 이미지 길이만큼 축소!
      targetCanvasH = targetCanvasW / imageAspectRatio;
    }

    // 전체 윈도우의 최종 요구 규격 조립
    let finalWinW = Math.round(targetCanvasW + SIDEBAR_WIDTH);
    let finalWinH = Math.round(targetCanvasH + CHROME_HEIGHT);

    // 🛡️ [유저 특명 최우선 순위] 최소 하한선 락다운! (1350 * 825)
    finalWinW = Math.max(finalWinW, 1350);
    finalWinH = Math.max(finalWinH, 825);

    // 🧱 [안전장치] 현재 모니터 작업 영역을 초과하지 못하도록 상한 제어
    if (finalWinW > workArea.width) {
      finalWinW = workArea.width;
      const derivedCanvasW = finalWinW - SIDEBAR_WIDTH;
      const derivedCanvasH = derivedCanvasW / imageAspectRatio;
      finalWinH = Math.round(derivedCanvasH + CHROME_HEIGHT);
    }

    if (finalWinH > workArea.height) {
      finalWinH = workArea.height;
      const derivedCanvasH = finalWinH - CHROME_HEIGHT;
      const derivedCanvasW = derivedCanvasH * imageAspectRatio;
      finalWinW = Math.round(derivedCanvasW + SIDEBAR_WIDTH);
    }

    // 🛡️ 상한 조정 과정에서 혹시 다시 최소선 밑으로 내려가지 않는지 2중 방어
    finalWinW = Math.max(finalWinW, 1350);
    finalWinH = Math.max(finalWinH, 825);

    // 🧭 [중력 센터링] 기존 창의 정중앙 좌표를 물리적 회전축으로 유지하며 리사이즈
    const centerX = bounds.x + Math.floor(bounds.width / 2);
    const centerY = bounds.y + Math.floor(bounds.height / 2);

    let newX = centerX - Math.floor(finalWinW / 2);
    let newY = centerY - Math.floor(finalWinH / 2);

    // 🗺️ 모니터 사각지대(화면 밖) 이탈 방어 로직
    if (newX < workArea.x) newX = workArea.x;
    if (newY < workArea.y) newY = workArea.y;
    if (newX + finalWinW > workArea.x + workArea.width) {
      newX = workArea.x + workArea.width - finalWinW;
    }
    if (newY + finalWinH > workArea.y + workArea.height) {
      newY = workArea.y + workArea.height - finalWinH;
    }

    // 🚀 리사이즈 전격 시행 (트랜지션 효과 true)
    win.setBounds({
      x: newX,
      y: newY,
      width: finalWinW,
      height: finalWinH
    }, true);
  });

  mainWindow = createMainWindow();
  mainWindow.on('move', () => queuePersistWindowState(mainWindow as BrowserWindow));
  mainWindow.on('resize', () => queuePersistWindowState(mainWindow as BrowserWindow));
  mainWindow.on('maximize', () => queuePersistWindowState(mainWindow as BrowserWindow));
  mainWindow.on('unmaximize', () => queuePersistWindowState(mainWindow as BrowserWindow));
  applyApplicationMenu();

  ipcMain.on('menu:update-viewer-status', (_event, statusText: string) => {
    currentViewerStatus = statusText;
    applyApplicationMenu();
  });

  ipcMain.on('menu:update-recent-items', (_event, items: Array<Pick<RecentItem, 'zipPath' | 'title'>>) => {
    currentRecentItems = items.slice(0, 10);
    applyApplicationMenu();
  });

  ipcMain.on('menu:update-file-edit-state', (_event, hasTransferClipboard: boolean) => {
    currentHasFileTransferClipboard = hasTransferClipboard;
    applyApplicationMenu();
  });

  ipcMain.on('menu:update-file-selection-state', (_event, hasFileSelection: boolean) => {
    currentHasFileSelection = hasFileSelection;
    applyApplicationMenu();
  });

  ipcMain.on('menu:update-page-edit-state', (_event, state: { canEditLeftPage: boolean; canEditRightPage: boolean }) => {
    currentCanEditLeftPage = state?.canEditLeftPage === true;
    currentCanEditRightPage = state?.canEditRightPage === true;
    applyApplicationMenu();
  });

  ipcMain.on('menu:update-book-nav-state', (_event, state: { canOpenPrevBook: boolean; canOpenNextBook: boolean }) => {
    currentCanOpenPrevBook = state?.canOpenPrevBook === true;
    currentCanOpenNextBook = state?.canOpenNextBook === true;
    applyApplicationMenu();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
      mainWindow.on('move', () => queuePersistWindowState(mainWindow as BrowserWindow));
      mainWindow.on('resize', () => queuePersistWindowState(mainWindow as BrowserWindow));
      mainWindow.on('maximize', () => queuePersistWindowState(mainWindow as BrowserWindow));
      mainWindow.on('unmaximize', () => queuePersistWindowState(mainWindow as BrowserWindow));
      applyApplicationMenu();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
