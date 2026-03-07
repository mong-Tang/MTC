import fs from 'node:fs/promises';
import path from 'node:path';

import { AppError } from '../../shared/errors/app-error';
import type { ArchiveOpenResult, ArchivePageData } from '../providers/archive/types';
import { ZipArchiveProvider } from '../providers/zip/zip-provider';

const zipProvider = new ZipArchiveProvider();

function mapFsError(error: unknown): AppError {
  if (!(error instanceof Error)) {
    return new AppError('UNKNOWN', 'Unknown filesystem error.');
  }

  const fsError = error as NodeJS.ErrnoException;

  if (fsError.code === 'ENOENT') {
    return new AppError('FILE_NOT_FOUND', 'ZIP file was not found.');
  }

  if (fsError.code === 'EACCES' || fsError.code === 'EPERM') {
    return new AppError('FILE_ACCESS_DENIED', 'ZIP file access was denied.');
  }

  return new AppError('UNKNOWN', fsError.message);
}

export async function openZip(filePath: string): Promise<ArchiveOpenResult> {
  const normalizedPath = path.resolve(filePath);
  let stats: Awaited<ReturnType<typeof fs.stat>>;

  try {
    await fs.access(normalizedPath);
    stats = await fs.stat(normalizedPath);
  } catch (error) {
    throw mapFsError(error);
  }

  if (!zipProvider.canOpen(normalizedPath)) {
    throw new AppError('ZIP_OPEN_FAILED', 'Only .zip is supported in v0.1.');
  }

  const result = await zipProvider.open(normalizedPath);

  if (result.meta.hasEncryptedEntries) {
    throw new AppError('ZIP_ENCRYPTED', 'Encrypted ZIP is not supported in v0.1.');
  }

  if (result.meta.totalPages === 0) {
    throw new AppError('ZIP_NO_IMAGE', 'No supported image in ZIP.');
  }

  const fileId = `${normalizedPath}|${stats.size}|${Math.trunc(stats.mtimeMs)}`;
  return {
    ...result,
    meta: {
      ...result.meta,
      fileId
    }
  };
}

export async function getZipPage(filePath: string, entryName: string): Promise<ArchivePageData> {
  const normalizedPath = path.resolve(filePath);

  try {
    await fs.access(normalizedPath);
  } catch (error) {
    throw mapFsError(error);
  }

  if (!zipProvider.canOpen(normalizedPath)) {
    throw new AppError('ZIP_OPEN_FAILED', 'Only .zip is supported in v0.1.');
  }

  return zipProvider.getPage(normalizedPath, entryName);
}
