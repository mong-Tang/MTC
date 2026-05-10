import fs from 'node:fs/promises';
import path from 'node:path';

import { BrowserWindow, dialog, ipcMain, shell } from 'electron';

import { AppError } from '../../shared/errors/app-error';
import type { SerializableAppError } from '../../shared/ipc/ipc-result';
import type { UpsertRecentInput } from '../../shared/stores/reading-state';
import en from '../../locales/en.json';
import ko from '../../locales/ko.json';
import { applyZipEditInTemp, convertArchiveToZipWorkflow, type ZipEditRequest } from '../services/archive-workflow';
import { getZipPage, openZip } from '../services/zip-index-service';
import { getProgress, getRecentItems, removeRecentItemByZipPath, setProgress, upsertRecentItem } from '../stores/reading-state-store';

interface OpenFileDialogOptions {
  title: string;
  zipFilterName: string;
  imageFilterName: string;
  archiveFilterName?: string;
  defaultPath?: string;
  excludeZip?: boolean;
}

interface SidebarListItem {
  name: string;
  path: string;
  type: 'zip' | 'image' | 'archive';
  extension: string;
}

interface ImageOpenResult {
  path: string;
  name: string;
  mimeType: string;
  bytes: ArrayBuffer; // 🚀 [최적화] Array 대신 네이티브 바이너리!
}

const ZIP_EXTENSIONS = new Set(['.zip']);
const IMAGE_EXTENSIONS = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.bmp', 'image/bmp'],
  ['.webp', 'image/webp']
]);
const ARCHIVE_EXTENSIONS = new Set([
  '.zip', '.7z', '.rar', '.tar', '.gz', '.tgz', '.bz2', '.tbz2', '.xz', '.txz', '.iso', '.cbz', '.cbr',
  '.cab', '.wim', '.lzh', '.arj', '.chm', '.msi', '.dmg', '.z', '.cpio', '.xar', '.rpm', '.deb',
  '.vhd', '.vhdx', '.vdi', '.vmdk', '.squashfs', '.ext', '.fat', '.ntfs'
]);

function getSidebarItemType(filePath: string): SidebarListItem['type'] | null {
  const extension = path.extname(filePath).toLowerCase();
  if (ZIP_EXTENSIONS.has(extension)) {
    return 'zip';
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return 'image';
  }

  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return 'archive';
  }

  return null;
}

function toSerializableError(error: unknown): SerializableAppError {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof Error) {
    return { code: 'UNKNOWN', message: error.message };
  }

  return { code: 'UNKNOWN', message: 'Unknown error.' };
}


async function resolveUniquePath(destinationDirectory: string, baseName: string): Promise<string> {
  const extension = path.extname(baseName);
  const stem = path.basename(baseName, extension);

  for (let index = 0; index < 1000; index += 1) {
    const candidateName = index === 0 ? baseName : `${stem} (${index})${extension}`;
    const candidatePath = path.join(destinationDirectory, candidateName);
    try {
      await fs.access(candidatePath);
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        return candidatePath;
      }
      throw error;
    }
  }

  throw new AppError('UNKNOWN', `Unable to resolve unique destination for: ${baseName}`);
}

async function moveFileWithFallback(sourcePath: string, destinationPath: string): Promise<void> {
  try {
    await fs.rename(sourcePath, destinationPath);
    return;
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;
    if (fsError.code !== 'EXDEV') {
      throw error;
    }
  }

  await fs.copyFile(sourcePath, destinationPath);
  await fs.unlink(sourcePath);
}

async function ensureDirectoryExists(targetPath: string): Promise<void> {
  const stat = await fs.stat(targetPath);
  if (!stat.isDirectory()) {
    throw new AppError('UNKNOWN', `Output path is not a directory: ${targetPath}`);
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('i18n:get-dictionaries', () => {
    return { ko, en } as const;
  });

  ipcMain.handle('path:dirname', (_event, filePath: string) => {
    return path.dirname(filePath);
  });

  ipcMain.handle('path:basename', (_event, filePath: string) => {
    return path.basename(filePath);
  });

  ipcMain.handle('file:open-dialog', async (_event, options?: Partial<OpenFileDialogOptions>) => {
    const title = options?.title ?? '';
    const zipFilterName = options?.zipFilterName ?? '';
    const imageFilterName = options?.imageFilterName ?? '';
    const archiveFilterName = options?.archiveFilterName ?? '';
    const excludeZip = options?.excludeZip === true;
    
    const filters = [];
    
    if (zipFilterName.trim() && !excludeZip) {
      filters.push({ name: zipFilterName, extensions: ['zip', 'cbz'] });
    }
    
    if (archiveFilterName.trim()) {
      let baseArchiveExts = [
        'zip', 'cbz', 'cbr', 'rar', '7z', 'iso', 'tar', 'gz', // 주요 포맷 우선 배치
        'arj', 'bz2', 'cab', 'chm', 'cpio', 'deb', 'dmg', 'ext', 'fat', 'lzh', 'msi', 'ntfs',
        'rpm', 'squashfs', 'tbz2', 'tgz', 'txz', 'vdi', 'vhd', 'vhdx', 'vmdk', 'wim', 'xar', 'xz', 'z' // 나머지는 알파벳순 정렬
      ];
      if (excludeZip) {
        // Forcibly excise 'zip' and 'cbz' from the candidate array as per brilliant user request
        baseArchiveExts = baseArchiveExts.filter(ext => ext !== 'zip' && ext !== 'cbz');
      }
      filters.push({ name: archiveFilterName, extensions: baseArchiveExts });
    }
    
    if (imageFilterName.trim()) {
      filters.push({ name: imageFilterName, extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] });
    }

    const focusedWindow = BrowserWindow.getFocusedWindow();
    const dialogOptions: Electron.OpenDialogOptions = {
      title,
      defaultPath: options?.defaultPath,
      properties: ['openFile'],
      filters
    };
    const result = focusedWindow 
      ? await dialog.showOpenDialog(focusedWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('folder:open-dialog', async (_event, title: string) => {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const dialogOptions: Electron.OpenDialogOptions = {
      title,
      properties: ['openDirectory']
    };
    const result = focusedWindow 
      ? await dialog.showOpenDialog(focusedWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle('folder:list-items', async (_event, folderPath: string) => {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      const data: SidebarListItem[] = entries
        .filter((entry) => entry.isFile())
        .map((entry) => {
          const fullPath = path.join(folderPath, entry.name);
          const type = getSidebarItemType(fullPath);
          if (!type) {
            return null;
          }

          return {
            name: entry.name,
            path: fullPath,
            type,
            extension: path.extname(entry.name).toLowerCase()
          } satisfies SidebarListItem;
        })
        .filter((item): item is SidebarListItem => item !== null)
        .sort((left, right) => left.name.localeCompare(right.name, 'ko'));

      return { ok: true, data } as const;
    } catch (error) {
      return { ok: false, error: toSerializableError(error) } as const;
    }
  });

  ipcMain.handle('file:transfer', async (_event, sourcePath: string, destinationDirectory: string, mode: 'copy' | 'cut') => {
    try {
      const sourceStat = await fs.stat(sourcePath);
      if (!sourceStat.isFile()) {
        throw new AppError('UNKNOWN', `Source is not a file: ${sourcePath}`);
      }

      const destinationStat = await fs.stat(destinationDirectory);
      if (!destinationStat.isDirectory()) {
        throw new AppError('UNKNOWN', `Destination is not a directory: ${destinationDirectory}`);
      }

      const destinationPath = await resolveUniquePath(destinationDirectory, path.basename(sourcePath));
      if (mode === 'cut') {
        await moveFileWithFallback(sourcePath, destinationPath);
      } else {
        await fs.copyFile(sourcePath, destinationPath);
      }

      return { ok: true, data: destinationPath } as const;
    } catch (error) {
      return { ok: false, error: toSerializableError(error) } as const;
    }
  });

  ipcMain.handle('file:delete', async (_event, targetPath: string) => {
    try {
      const targetStat = await fs.stat(targetPath);
      if (!targetStat.isFile()) {
        throw new AppError('UNKNOWN', `Target is not a file: ${targetPath}`);
      }

      await shell.trashItem(targetPath);
      return { ok: true, data: true } as const;
    } catch (error) {
      return { ok: false, error: toSerializableError(error) } as const;
    }
  });

  ipcMain.handle('image:open', async (_event, imagePath: string) => {
    try {
      const extension = path.extname(imagePath).toLowerCase();
      const mimeType = IMAGE_EXTENSIONS.get(extension);
      if (!mimeType) {
        throw new AppError('UNKNOWN', `Unsupported image extension: ${extension}`);
      }

      const buffer = await fs.readFile(imagePath);
      const arrayBuffer = buffer.buffer as ArrayBuffer;
      const data: ImageOpenResult = {
        path: imagePath,
        name: path.basename(imagePath),
        mimeType,
        bytes: arrayBuffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) // ⚡ 순수 ArrayBuffer 추출!
      };

      return { ok: true, data } as const;
    } catch (error) {
      return { ok: false, error: toSerializableError(error) } as const;
    }
  });

  ipcMain.handle('zip:open', async (_event, zipPath: string) => {
    try {
      const data = await openZip(zipPath);
      return { ok: true, data } as const;
    } catch (error) {
      return { ok: false, error: toSerializableError(error) } as const;
    }
  });

  ipcMain.handle('zip:get-page', async (_event, zipPath: string, entryName: string) => {
    try {
      const data = await getZipPage(zipPath, entryName);
      return { ok: true, data } as const;
    } catch (error) {
      return { ok: false, error: toSerializableError(error) } as const;
    }
  });

  ipcMain.handle('zip:edit-pages', async (_event, zipPath: string, request: ZipEditRequest) => {
    try {
      const data = await applyZipEditInTemp(zipPath, request);
      return { ok: true, data } as const;
    } catch (error) {
      return { ok: false, error: toSerializableError(error) } as const;
    }
  });

  ipcMain.handle('recent:get', async () => {
    try {
      const data = await getRecentItems();
      return { ok: true, data } as const;
    } catch (error) {
      return { ok: false, error: toSerializableError(error) } as const;
    }
  });

  ipcMain.handle('recent:upsert', async (_event, input: UpsertRecentInput) => {
    try {
      const data = await upsertRecentItem(input);
      return { ok: true, data } as const;
    } catch (error) {
      return { ok: false, error: toSerializableError(error) } as const;
    }
  });

  ipcMain.handle('recent:remove-by-path', async (_event, zipPath: string) => {
    try {
      const data = await removeRecentItemByZipPath(zipPath);
      return { ok: true, data } as const;
    } catch (error) {
      return { ok: false, error: toSerializableError(error) } as const;
    }
  });

  ipcMain.handle('progress:get', async (_event, fileId: string) => {
    try {
      const data = await getProgress(fileId);
      return { ok: true, data } as const;
    } catch (error) {
      return { ok: false, error: toSerializableError(error) } as const;
    }
  });

  ipcMain.handle('progress:set', async (_event, fileId: string, pageIndex: number) => {
    try {
      await setProgress(fileId, pageIndex);
      return { ok: true, data: true } as const;
    } catch (error) {
      return { ok: false, error: toSerializableError(error) } as const;
    }
  });

  ipcMain.handle('converter:to-zip', async (_event, sourcePath: string, outputDirectory: string, targetExtension: string = '.zip', customFilename?: string) => {
    try {
      const sourceStat = await fs.stat(sourcePath);
      if (!sourceStat.isFile()) {
        throw new AppError('UNKNOWN', `Source is not a file: ${sourcePath}`);
      }

      await ensureDirectoryExists(outputDirectory);

      const sourceExtension = path.extname(sourcePath).toLowerCase();
      if (!ARCHIVE_EXTENSIONS.has(sourceExtension)) {
        throw new AppError('UNKNOWN', `Unsupported archive extension: ${sourceExtension}`);
      }

      const sourceBaseName = path.basename(sourcePath, path.extname(sourcePath));
      // [MAJOR UPGRADE] Utilize custom filename override if specified by the user!
      const effectiveBaseName = (customFilename && customFilename.trim()) ? customFilename.trim() : sourceBaseName;
      const destinationPath = await resolveUniquePath(outputDirectory, `${effectiveBaseName}${targetExtension}`);
      const logs: string[] = [`source: ${sourcePath}`, `output: ${destinationPath}`];



      const workflowResult = await convertArchiveToZipWorkflow(sourcePath, destinationPath);

      return {
        ok: true,
        data: {
          outputPath: destinationPath,
          logs: [...logs, ...workflowResult.logs]
        }
      } as const;
    } catch (error) {
      return { ok: false, error: toSerializableError(error) } as const;
    }
  });

  ipcMain.handle('window:is-fullscreen', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window?.isFullScreen() ?? false;
  });

  ipcMain.handle('window:toggle-fullscreen', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return false;
    }

    const nextValue = !window.isFullScreen();
    window.setFullScreen(nextValue);
    return nextValue;
  });

  ipcMain.handle('window:exit-fullscreen', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      return false;
    }

    window.setFullScreen(false);
    return false;
  });
}
