import path from 'node:path';

import { app, BrowserWindow, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron';

import { registerIpcHandlers } from './ipc/ipc-handlers';
import { setLocale, t, type Locale } from '../shared/i18n/i18n';
import { defaultAppSettings, type AppSettings, type ImageFitMode, type PageViewMode } from '../shared/stores/app-settings';
import type { RecentItem } from '../shared/stores/reading-state';
import { getAppSettings, saveAppSettings } from './stores/app-settings-store';

let mainWindow: BrowserWindow | null = null;
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

let currentSettings: AppSettings = defaultAppSettings;
let currentPageViewMode: PageViewMode = currentSettings.pageViewMode;
let currentImageFitMode: ImageFitMode = currentSettings.imageFitMode;
let currentViewerStatus = '';
let currentRecentItems: Array<Pick<RecentItem, 'zipPath' | 'title'>> = [];
let currentLocale: Locale = currentSettings.locale;
let currentHasFileTransferClipboard = false;
const gotSingleInstanceLock = app.requestSingleInstanceLock();

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
  const window = new BrowserWindow({
    x: currentSettings.windowBounds.x,
    y: currentSettings.windowBounds.y,
    width: currentSettings.windowBounds.width,
    height: currentSettings.windowBounds.height,
    minWidth: 900,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile(path.join(app.getAppPath(), 'index.html'));
  if (currentSettings.isMaximized) {
    window.maximize();
  }
  return window;
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

function buildFileEditMenuItems(): MenuItemConstructorOptions[] {
  return [
    {
      label: t('menu.edit.copy'),
      accelerator: 'CmdOrCtrl+C',
      click: () => sendMenuAction('file-copy')
    },
    {
      label: t('menu.edit.cut'),
      accelerator: 'CmdOrCtrl+X',
      click: () => sendMenuAction('file-cut')
    },
    {
      label: t('menu.edit.paste'),
      accelerator: 'CmdOrCtrl+V',
      enabled: currentHasFileTransferClipboard,
      click: () => sendMenuAction('file-paste')
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

function applyApplicationMenu(): void {
  const quickViewMenus: MenuItemConstructorOptions[] = [
    {
      label: currentPageViewMode === 'single' ? `✓ ${t('menu.view.singlePage')}` : t('menu.view.singlePage'),
      click: () => {
        currentPageViewMode = 'single';
        persistAppSettings({ pageViewMode: 'single' }, 'quick-view-single');
        applyApplicationMenu();
        sendMenuAction('view-single-page');
      }
    },
    {
      label: currentPageViewMode === 'double' ? `✓ ${t('menu.view.doublePage')}` : t('menu.view.doublePage'),
      click: () => {
        currentPageViewMode = 'double';
        persistAppSettings({ pageViewMode: 'double' }, 'quick-view-double');
        applyApplicationMenu();
        sendMenuAction('view-double-page');
      }
    }
  ];

  const recentMenus: MenuItemConstructorOptions[] =
    currentRecentItems.length > 0
      ? currentRecentItems.slice(0, 10).map((item) => ({
          label: item.title || item.zipPath,
          click: () => sendOpenRecent(item.zipPath)
        }))
      : [{ label: t('launcher.recent.empty'), enabled: false }];

  const template: MenuItemConstructorOptions[] = [
    {
      label: t('menu.file'),
      submenu: [
        {
          label: t('menu.openFile'),
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('open-file')
        },
        {
          label: t('menu.openFolder'),
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendMenuAction('open-folder')
        },
        { type: 'separator' },
        {
          label: t('tree.recent'),
          submenu: recentMenus
        },
        { type: 'separator' },
        {
          label: t('tree.library'),
          click: () => sendMenuAction('show-launcher')
        },
        {
          label: t('tree.viewer'),
          click: () => sendMenuAction('show-viewer')
        },
        {
          label: t('tree.settings'),
          click: () => sendMenuAction('show-settings')
        },
        { type: 'separator' },
        {
          label: t('menu.exit'),
          role: process.platform === 'darwin' ? 'close' : 'quit'
        }
      ]
    },
    {
      label: t('menu.edit'),
      submenu: buildFileEditMenuItems()
    },
    {
      label: t('menu.view'),
      submenu: [
        {
          label: t('menu.view.pageMode'),
          submenu: [
            {
              label: t('menu.view.singlePage'),
              type: 'checkbox',
              checked: currentPageViewMode === 'single',
              click: () => {
                currentPageViewMode = 'single';
                persistAppSettings({ pageViewMode: 'single' }, 'view-menu-single');
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
                persistAppSettings({ pageViewMode: 'double' }, 'view-menu-double');
                applyApplicationMenu();
                sendMenuAction('view-double-page');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: t('menu.view.imageFit'),
          submenu: [
            {
              label: t('menu.view.imageFitAuto'),
              type: 'checkbox',
              checked: currentImageFitMode === 'auto',
              click: () => {
                currentImageFitMode = 'auto';
                persistAppSettings({ imageFitMode: 'auto' }, 'image-fit-auto');
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
                persistAppSettings({ imageFitMode: 'actual' }, 'image-fit-actual');
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
                persistAppSettings({ imageFitMode: 'width' }, 'image-fit-width');
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
                persistAppSettings({ imageFitMode: 'height' }, 'image-fit-height');
                applyApplicationMenu();
                sendMenuAction('image-fit-height');
              }
            }
          ]
        }
      ]
    },
    {
      label: t('common.locale'),
      submenu: [
        {
          label: 'ko',
          type: 'radio',
          checked: currentLocale === 'ko',
          click: () => {
            currentLocale = 'ko';
            setLocale('ko');
            persistAppSettings({ locale: 'ko' }, 'locale-ko');
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
            persistAppSettings({ locale: 'en' }, 'locale-en');
            applyApplicationMenu();
            sendLocaleSelected('en');
          }
        }
      ]
    },
    {
      label: t('menu.window'),
      submenu: [
        { label: t('menu.window.minimize'), role: 'minimize' },
        { label: t('menu.window.zoom'), role: 'zoom' },
        { type: 'separator' },
        { label: t('menu.window.close'), role: 'close' }
      ]
    },
    {
      label: t('menu.help'),
      submenu: [{ label: t('menu.about'), role: 'about' }]
    },
    ...quickViewMenus,
    {
      label: currentViewerStatus || t('viewer.status.empty'),
      enabled: false
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!gotSingleInstanceLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
});

app.whenReady().then(async () => {
  currentSettings = await getAppSettings();
  currentLocale = currentSettings.locale;
  currentPageViewMode = currentSettings.pageViewMode;
  currentImageFitMode = currentSettings.imageFitMode;
  setLocale(currentLocale);
  registerIpcHandlers();
  ipcMain.handle('app:get-settings', () => currentSettings);
  ipcMain.handle('app:update-settings', async (_event, partial: Partial<AppSettings>) => {
    currentSettings = await saveAppSettings(partial);
    currentLocale = currentSettings.locale;
    currentPageViewMode = currentSettings.pageViewMode;
    currentImageFitMode = currentSettings.imageFitMode;
    setLocale(currentLocale);
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
    applyApplicationMenu();
    return true;
  });

  ipcMain.handle('menu:popup-file-edit', (event) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        return false;
      }

      const menu = Menu.buildFromTemplate(buildFileEditMenuItems());
      menu.popup({ window });
      return true;
    } catch (error) {
      console.warn('[menu] failed to popup file edit menu:', error);
      return false;
    }
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
