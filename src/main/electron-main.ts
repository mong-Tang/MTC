import path from 'node:path';

import { app, BrowserWindow, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron';

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
type ConverterMenuAction = 'select-source' | 'select-output' | 'start-conversion' | 'toggle-log' | 'show-policy';

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

function createConverterWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 760,
    minHeight: 520,
    parent: mainWindow ?? undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.setMenu(buildConverterWindowMenu(window));
  window.loadFile(path.join(app.getAppPath(), 'converter.html'));
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
        { label: t('menu.converter.selectSource'), click: () => sendConverterMenuAction('select-source') },
        { label: t('menu.converter.selectOutput'), click: () => sendConverterMenuAction('select-output') },
        { type: 'separator' },
        {
          label: t('menu.window.close'),
          accelerator: 'CmdOrCtrl+W',
          click: () => window.close()
        }
      ]
    },
    {
      label: t('menu.converter'),
      submenu: [
        { label: t('menu.converter.start'), accelerator: 'F5', click: () => sendConverterMenuAction('start-conversion') },
        { type: 'separator' },
        { label: t('menu.converter.showLog'), type: 'checkbox', checked: true, click: () => sendConverterMenuAction('toggle-log') }
      ]
    },
    {
      label: t('menu.help'),
      submenu: [{ label: t('menu.converter.policy'), click: () => sendConverterMenuAction('show-policy') }]
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
  const window = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    parent: mainWindow ?? undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.setMenuBarVisibility(false);
  window.setMenu(null);
  window.loadFile(path.join(app.getAppPath(), 'help.html'), { query: { lang: currentLocale } });
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
  if (helpWindow && !helpWindow.isDestroyed()) {
    helpWindow.loadFile(path.join(app.getAppPath(), 'help.html'), { query: { lang: currentLocale } });
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
  helpWindow.loadFile(path.join(app.getAppPath(), 'help.html'), { query: { lang: currentLocale } });
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
    }
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
          label: t('tree.recent'),
          submenu: recentMenus
        },
        {
          label: t('menu.openFolder'),
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendMenuAction('open-folder')
        },
        { type: 'separator' },
        ...buildFileTransferMenuItems(),
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
        },
        { type: 'separator' },
        {
          label: t('menu.view.folderList'),
          type: 'checkbox',
          accelerator: 'CmdOrCtrl+B',
          checked: currentShowSidebarList,
          click: () => {
            currentShowSidebarList = !currentShowSidebarList;
            persistAppSettings({ showSidebarList: currentShowSidebarList }, 'toggle-folder-list');
            applyApplicationMenu();
            sendMenuAction('toggle-folder-list');
          }
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
            persistAppSettings({ locale: 'en' }, 'locale-en');
            reloadHelpWindowForLocale();
            applyApplicationMenu();
            sendLocaleSelected('en');
          }
        }
      ]
    },
    {
      label: t('menu.tools'),
      submenu: [
        {
          label: t('menu.tools.converter'),
          click: () => openConverterWindow()
        }
      ]
    },
    {
      label: t('menu.help'),
      submenu: [
        {
          label: t('menu.help.userGuide'),
          click: () => openHelpWindow()
        },
        { type: 'separator' },
        { label: t('menu.about'), role: 'about' }
      ]
    },
    ...quickViewMenus,
    {
      label: currentViewerStatus || t('viewer.status.empty'),
      enabled: false
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  enforceHelpWindowMenuHidden();
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
  currentShowSidebarList = currentSettings.showSidebarList;
  setLocale(currentLocale);
  registerIpcHandlers();
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

  ipcMain.handle('menu:popup-file-edit', (event) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        return false;
      }

      const menu = Menu.buildFromTemplate(buildFileTransferMenuItems());
      menu.popup({ window });
      return true;
    } catch (error) {
      console.warn('[menu] failed to popup file edit menu:', error);
      return false;
    }
  });

  ipcMain.handle('menu:popup-image-context', (event) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        return false;
      }

      const menu = Menu.buildFromTemplate([
        { label: t('menu.file'), submenu: buildFileContextMenuItems() },
        { type: 'separator' },
        ...buildFileEditMenuItems(),
        { type: 'separator' },
        ...buildImageFitContextMenuItems(),
        { type: 'separator' },
        { label: t('menu.view'), submenu: buildViewContextMenuItems() },
        { label: t('common.locale'), submenu: buildLocaleContextMenuItems() }
      ]);
      menu.popup({ window });
      return true;
    } catch (error) {
      console.warn('[menu] failed to popup image context menu:', error);
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
