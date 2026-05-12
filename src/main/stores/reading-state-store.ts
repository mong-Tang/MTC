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
const maxRecentItems = 15;

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

  // 🧹 [유저 특명: 중복 숙청] 폴더와 파일은 개념적으로 하나씩만 존재해야 함!
  const deduplicated = previousItems.filter((item) => {
    // 1️⃣ 물리적 동일 객체 제거
    if (item.fileId === input.fileId || item.zipPath === input.zipPath) return false;

    // 2️⃣ 상호 포함 관계 파괴 (폴더와 그 내부 파일의 공존을 불허함)
    const inputIsFolder = !/\.[a-zA-Z0-9]+$/.test(input.zipPath); // 확장자가 없으면 폴더로 간주하는 명품 룰베이스!
    const itemIsFolder = !/\.[a-zA-Z0-9]+$/.test(item.zipPath);

    // ✅ 폴더가 들어올 때 -> 기존에 있던 그 하위 파일들을 가차없이 처단!
    if (inputIsFolder && item.zipPath.startsWith(input.zipPath)) {
      return false;
    }

    // ✅ 파일이 들어올 때 -> 이미 상위 폴더가 기록에 있다면, 신규 파일 기록을 거부하여 폴더의 권위를 유지!
    // (다만, 이번 파일 로딩이 폴더 기록으로 귀결될 거라면 애초에 input이 폴더일 것이므로, 이 경우는 개별 파일로 굳이 넣을 때만 발동)
    if (!inputIsFolder && itemIsFolder && input.zipPath.startsWith(item.zipPath)) {
      return false; // 폴더가 이미 존재하므로, 굳이 파일을 따로 추가 기록하지 않음! (폴더 최우선주의)
    }

    return true; // 안전한 생존자
  });

  const nextItems = [nextItem, ...deduplicated].slice(0, maxRecentItems);
  await writeJsonAtomic(getRecentFilePath(), nextItems);
  return nextItems;
}

export async function removeRecentItemByZipPath(zipPath: string): Promise<RecentItem[]> {
  const previousItems = await getRecentItems();
  const nextItems = previousItems.filter((item) => item.zipPath !== zipPath).slice(0, maxRecentItems);
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
