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

async function validateZipSignature(filePath: string): Promise<void> {
  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(filePath, 'r');
    const header = Buffer.alloc(4);
    const { bytesRead } = await handle.read(header, 0, 4, 0);
    if (bytesRead < 4) {
      throw new AppError('ZIP_INVALID_FORMAT', 'The file is too small to be a valid ZIP/CBZ.');
    }

    const signature = header.toString('binary');
    const validSignatures = new Set(['PK\x03\x04', 'PK\x05\x06', 'PK\x07\x08']);
    if (!validSignatures.has(signature)) {
      throw new AppError('ZIP_INVALID_FORMAT', 'The file does not have a valid ZIP signature.');
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw mapFsError(error);
  } finally {
    await handle?.close().catch(() => {
      // ignore close errors
    });
  }
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
    throw new AppError('ZIP_OPEN_FAILED', 'Only .zip/.cbz is supported in v0.1.');
  }

  await validateZipSignature(normalizedPath);

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
    throw new AppError('ZIP_OPEN_FAILED', 'Only .zip/.cbz is supported in v0.1.');
  }

  await validateZipSignature(normalizedPath);

  return zipProvider.getPage(normalizedPath, entryName);
}
