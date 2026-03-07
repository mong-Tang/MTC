import fs from 'node:fs/promises';
import path from 'node:path';

import { app } from 'electron';

import { AppError } from '../../shared/errors/app-error';
import type { RecentItem, UpsertRecentInput } from '../../shared/stores/reading-state';

interface ProgressEntry {
  pageIndex: number;
  updatedAt: string;
}

type ProgressMap = Record<string, ProgressEntry>;

const recentFileName = 'recent.json';
const progressFileName = 'progress.json';
const maxRecentItems = 10;

function getUserDataDirectory(): string {
  return app.getPath('userData');
}

function getRecentFilePath(): string {
  return path.join(getUserDataDirectory(), recentFileName);
}

function getProgressFilePath(): string {
  return path.join(getUserDataDirectory(), progressFileName);
}

async function ensureStorageDirectory(): Promise<void> {
  await fs.mkdir(getUserDataDirectory(), { recursive: true });
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

  try {
    await fs.writeFile(tempPath, payload, 'utf8');
    try {
      await fs.rename(tempPath, filePath);
    } catch {
      await fs.rm(filePath, { force: true });
      await fs.rename(tempPath, filePath);
    }
  } catch {
    throw new AppError('UNKNOWN', `Failed to write JSON file: ${filePath}`);
  }
}

export async function getRecentItems(): Promise<RecentItem[]> {
  const recentItems = await readJsonFile<RecentItem[]>(getRecentFilePath(), []);
  if (!Array.isArray(recentItems)) {
    return [];
  }
  return recentItems.slice(0, maxRecentItems);
}

export async function upsertRecentItem(input: UpsertRecentInput): Promise<RecentItem[]> {
  const previousItems = await getRecentItems();
  const nowIso = new Date().toISOString();

  const nextItem: RecentItem = {
    fileId: input.fileId,
    zipPath: input.zipPath,
    title: input.title,
    lastPageIndex: input.lastPageIndex,
    lastOpenedAt: nowIso
  };

  const deduplicated = previousItems.filter((item) => item.fileId !== input.fileId);
  const nextItems = [nextItem, ...deduplicated].slice(0, maxRecentItems);
  await writeJsonAtomic(getRecentFilePath(), nextItems);
  return nextItems;
}

export async function getProgress(fileId: string): Promise<number | null> {
  const progressMap = await readJsonFile<ProgressMap>(getProgressFilePath(), {});
  const entry = progressMap[fileId];
  if (!entry) {
    return null;
  }
  return entry.pageIndex;
}

export async function setProgress(fileId: string, pageIndex: number): Promise<void> {
  const progressMap = await readJsonFile<ProgressMap>(getProgressFilePath(), {});
  progressMap[fileId] = {
    pageIndex,
    updatedAt: new Date().toISOString()
  };
  await writeJsonAtomic(getProgressFilePath(), progressMap);
}
