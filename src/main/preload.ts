import { contextBridge, ipcRenderer, webUtils } from 'electron';

import type { ArchiveOpenResult, ArchivePageData } from './providers/archive/types';
import type { IpcResult } from '../shared/ipc/ipc-result';
import type { AppSettings } from '../shared/stores/app-settings';
import type { RecentItem, UpsertRecentInput } from '../shared/stores/reading-state';

interface OpenFileDialogOptions {
  title: string;
  zipFilterName: string;
  imageFilterName: string;
  archiveFilterName?: string;
  defaultPath?: string;
}

interface I18nDictionaries {
  ko: Record<string, string>;
  en: Record<string, string>;
}

interface MenuRecentItem {
  zipPath: string;
  title: string;
}

type Locale = 'ko' | 'en';
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

type SidebarItemType = 'zip' | 'image' | 'archive';

interface SidebarListItem {
  name: string;
  path: string;
  type: SidebarItemType;
  extension: string;
}

interface ImageOpenResult {
  path: string;
  name: string;
  mimeType: string;
  bytes: number[];
}

interface ConverterResult {
  outputPath: string;
  logs: string[];
}

type ZipEditRequest =
  | { kind: 'delete'; targetEntryName: string }
  | {
      kind: 'insert-after';
      afterEntryName: string;
      insertFileName: string;
      insertMimeType: string;
      insertBytes: number[];
    };

const api = {
  getI18nDictionaries: () => ipcRenderer.invoke('i18n:get-dictionaries') as Promise<I18nDictionaries>,
  getAppSettings: () => ipcRenderer.invoke('app:get-settings') as Promise<AppSettings>,
  updateAppSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('app:update-settings', settings) as Promise<AppSettings>,
  setAppLocale: (locale: Locale) => ipcRenderer.invoke('app:set-locale', locale) as Promise<boolean>,
  updateViewerStatus: (statusText: string) => ipcRenderer.send('menu:update-viewer-status', statusText),
  updateRecentMenu: (items: MenuRecentItem[]) => ipcRenderer.send('menu:update-recent-items', items),
  updateFileEditState: (hasTransferClipboard: boolean) =>
    ipcRenderer.send('menu:update-file-edit-state', hasTransferClipboard),
  updateFileSelectionState: (hasFileSelection: boolean) =>
    ipcRenderer.send('menu:update-file-selection-state', hasFileSelection),
  updatePageEditState: (state: { canEditLeftPage: boolean; canEditRightPage: boolean }) =>
    ipcRenderer.send('menu:update-page-edit-state', state),
  updateBookNavState: (state: { canOpenPrevBook: boolean; canOpenNextBook: boolean }) =>
    ipcRenderer.send('menu:update-book-nav-state', state),
  onMenuAction: (listener: (action: MenuAction) => void) => {
    const channel = 'menu:action';
    const handler = (_event: Electron.IpcRendererEvent, action: MenuAction) => listener(action);
    ipcRenderer.on(channel, handler);
    return () => {
        ipcRenderer.removeListener(channel, handler);
    };
  },
  openFileDialog: (options: OpenFileDialogOptions) => ipcRenderer.invoke('file:open-dialog', options) as Promise<string | null>,
  openFolderDialog: (title: string) => ipcRenderer.invoke('folder:open-dialog', title) as Promise<string | null>,
  transferFile: (sourcePath: string, destinationDirectory: string, mode: 'copy' | 'cut') =>
    ipcRenderer.invoke('file:transfer', sourcePath, destinationDirectory, mode) as Promise<IpcResult<string>>,
  deleteFile: (targetPath: string) => ipcRenderer.invoke('file:delete', targetPath) as Promise<IpcResult<boolean>>,
  listFolderItems: (folderPath: string) => ipcRenderer.invoke('folder:list-items', folderPath) as Promise<IpcResult<SidebarListItem[]>>,
  showFileEditContextMenu: () => ipcRenderer.invoke('menu:popup-file-edit') as Promise<boolean>,
  showImageContextMenu: () => ipcRenderer.invoke('menu:popup-image-context') as Promise<boolean>,
  openZip: (zipPath: string) => ipcRenderer.invoke('zip:open', zipPath) as Promise<IpcResult<ArchiveOpenResult>>,
  openImage: (imagePath: string) => ipcRenderer.invoke('image:open', imagePath) as Promise<IpcResult<ImageOpenResult>>,
  editZipPages: (zipPath: string, request: ZipEditRequest) =>
    ipcRenderer.invoke('zip:edit-pages', zipPath, request) as Promise<IpcResult<{ editedZipPath: string }>>,
  getPage: (zipPath: string, entryName: string) =>
    ipcRenderer.invoke('zip:get-page', zipPath, entryName) as Promise<IpcResult<ArchivePageData>>,
  getRecent: () => ipcRenderer.invoke('recent:get') as Promise<IpcResult<RecentItem[]>>,
  upsertRecent: (input: UpsertRecentInput) => ipcRenderer.invoke('recent:upsert', input) as Promise<IpcResult<RecentItem[]>>,
  removeRecentByPath: (zipPath: string) => ipcRenderer.invoke('recent:remove-by-path', zipPath) as Promise<IpcResult<RecentItem[]>>,
  getProgress: (fileId: string) => ipcRenderer.invoke('progress:get', fileId) as Promise<IpcResult<number | null>>,
  setProgress: (fileId: string, pageIndex: number) =>
    ipcRenderer.invoke('progress:set', fileId, pageIndex) as Promise<IpcResult<boolean>>,
  onOpenRecent: (listener: (zipPath: string) => void) => {
    const channel = 'menu:open-recent';
    const handler = (_event: Electron.IpcRendererEvent, zipPath: string) => listener(zipPath);
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  },
  onLocaleSelected: (listener: (locale: Locale) => void) => {
    const channel = 'menu:set-locale';
    const handler = (_event: Electron.IpcRendererEvent, locale: Locale) => listener(locale);
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  },
  onConverterMenuAction: (listener: (action: ConverterMenuAction) => void) => {
    const channel = 'converter:menu-action';
    const handler = (_event: Electron.IpcRendererEvent, action: ConverterMenuAction) => listener(action);
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  },
  convertArchiveToZip: (sourcePath: string, outputDirectory: string) =>
    ipcRenderer.invoke('converter:to-zip', sourcePath, outputDirectory) as Promise<IpcResult<ConverterResult>>,
  isFullscreen: () => ipcRenderer.invoke('window:is-fullscreen') as Promise<boolean>,
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen') as Promise<boolean>,
  exitFullscreen: () => ipcRenderer.invoke('window:exit-fullscreen') as Promise<boolean>,
  getPathForDroppedFile: (file: File) => webUtils.getPathForFile(file)
};

contextBridge.exposeInMainWorld('appApi', api);

export type AppApi = typeof api;
