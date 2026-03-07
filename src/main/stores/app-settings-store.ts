import fs from 'node:fs/promises';
import path from 'node:path';

import { app } from 'electron';

import { AppError } from '../../shared/errors/app-error';
import { defaultAppSettings, type AppSettings } from '../../shared/stores/app-settings';

const settingsFileName = 'app-settings.json';
let cachedSettings: AppSettings | null = null;
let settingsWriteQueue: Promise<void> = Promise.resolve();
const writeRetryDelaysMs = [40, 120, 260];

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), settingsFileName);
}

async function ensureStorageDirectory(): Promise<void> {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableWriteError(error: unknown): boolean {
  const fsError = error as NodeJS.ErrnoException;
  return fsError?.code === 'EPERM' || fsError?.code === 'EBUSY' || fsError?.code === 'EACCES';
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    const fsError = error as NodeJS.ErrnoException;
    if (fsError.code === 'ENOENT') {
      return fallback;
    }
    throw new AppError('UNKNOWN', `Failed to read JSON file: ${filePath}`);
  }
}

async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await ensureStorageDirectory();
  const tempPath = `${filePath}.tmp`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  let lastError: unknown;

  for (let attempt = 0; attempt <= writeRetryDelaysMs.length; attempt += 1) {
    try {
      await fs.writeFile(tempPath, payload, 'utf8');
      try {
        await fs.rename(tempPath, filePath);
      } catch {
        await fs.rm(filePath, { force: true });
        await fs.rename(tempPath, filePath);
      }
      return;
    } catch (error) {
      lastError = error;
      if (!isRetryableWriteError(error) || attempt >= writeRetryDelaysMs.length) {
        break;
      }
      await sleep(writeRetryDelaysMs[attempt]);
    }
  }

  const fsError = lastError as NodeJS.ErrnoException;
  const code = fsError?.code ? ` (${fsError.code})` : '';
  throw new AppError('UNKNOWN', `Failed to write JSON file: ${filePath}${code}`);
}

function sanitizeSettings(candidate: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    locale: candidate?.locale === 'en' ? 'en' : 'ko',
    pageViewMode: candidate?.pageViewMode === 'double' ? 'double' : 'single',
    imageFitMode:
      candidate?.imageFitMode === 'actual' ||
      candidate?.imageFitMode === 'width' ||
      candidate?.imageFitMode === 'height'
        ? candidate.imageFitMode
        : 'auto',
    sidebarWidth:
      typeof candidate?.sidebarWidth === 'number' && Number.isFinite(candidate.sidebarWidth)
        ? Math.min(520, Math.max(180, candidate.sidebarWidth))
        : defaultAppSettings.sidebarWidth,
    windowBounds: {
      x: typeof candidate?.windowBounds?.x === 'number' ? candidate.windowBounds.x : defaultAppSettings.windowBounds.x,
      y: typeof candidate?.windowBounds?.y === 'number' ? candidate.windowBounds.y : defaultAppSettings.windowBounds.y,
      width:
        typeof candidate?.windowBounds?.width === 'number' && Number.isFinite(candidate.windowBounds.width)
          ? Math.max(900, candidate.windowBounds.width)
          : defaultAppSettings.windowBounds.width,
      height:
        typeof candidate?.windowBounds?.height === 'number' && Number.isFinite(candidate.windowBounds.height)
          ? Math.max(640, candidate.windowBounds.height)
          : defaultAppSettings.windowBounds.height
    },
    isMaximized: candidate?.isMaximized === true
  };
}

async function loadSettingsFromDisk(): Promise<AppSettings> {
  const loaded = await readJsonFile<Partial<AppSettings>>(getSettingsFilePath(), defaultAppSettings);
  return sanitizeSettings(loaded);
}

export async function getAppSettings(): Promise<AppSettings> {
  await settingsWriteQueue;
  if (cachedSettings) {
    return cachedSettings;
  }

  const sanitized = await loadSettingsFromDisk();
  cachedSettings = sanitized;
  return sanitized;
}

export async function saveAppSettings(nextSettings: Partial<AppSettings>): Promise<AppSettings> {
  let resolved: AppSettings = cachedSettings ?? defaultAppSettings;

  settingsWriteQueue = settingsWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const previous = cachedSettings ?? (await loadSettingsFromDisk());
      const merged = sanitizeSettings({
        ...previous,
        ...nextSettings,
        windowBounds: {
          ...previous.windowBounds,
          ...nextSettings.windowBounds
        }
      });

      await writeJsonAtomic(getSettingsFilePath(), merged);
      cachedSettings = merged;
      resolved = merged;
    });

  await settingsWriteQueue;
  return resolved;
}
