import fs from 'node:fs/promises';
import path from 'node:path';

import { AppError } from '../../shared/errors/app-error';
import type { ArchiveOpenResult, ArchivePageData } from '../providers/archive/types';
import { ZipArchiveProvider } from '../providers/zip/zip-provider';

const zipProvider = new ZipArchiveProvider();
 
 /* 🖼️ [신규] 이미지 뷰어를 위한 직접 이미지 지원 매핑 */
 const IMAGE_EXTENSIONS = new Map([
   ['.png', 'image/png'],
   ['.jpg', 'image/jpeg'],
   ['.jpeg', 'image/jpeg'],
   ['.gif', 'image/gif'],
   ['.bmp', 'image/bmp'],
   ['.webp', 'image/webp']
 ]);
 
 function isImageFile(filePath: string): boolean {
   const ext = path.extname(filePath).toLowerCase();
   return IMAGE_EXTENSIONS.has(ext);
 }
 
 function getMimeType(filePath: string): string {
   const ext = path.extname(filePath).toLowerCase();
   return IMAGE_EXTENSIONS.get(ext) ?? 'application/octet-stream';
 }

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
    // 🚀 [신공] 단일 이미지 파일인 경우 가상 아카이브로 승화시켜 수용합니다!
    if (isImageFile(normalizedPath)) {
      const fileId = `${normalizedPath}|${stats.size}|${Math.trunc(stats.mtimeMs)}`;
      const baseName = path.basename(normalizedPath);
      return {
        meta: {
          title: baseName,
          totalPages: 1,
          hasEncryptedEntries: false,
          fileId,
          totalUncompressedSizeBytes: stats.size // 💾 [예외처리] 단일 파일은 원본 크기 자체가 총합임!
        },
        pages: [
          { index: 0, entryName: '__IMAGE_SINGLE_ENTRY__', displayName: baseName, sizeBytes: stats.size }
        ]
      };
    }
    throw new AppError('ZIP_OPEN_FAILED', 'Only .zip/.cbz/images are supported.');
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
    // 🚀 [신공] 단일 이미지 파일인 경우 즉석에서 바이트 어레이로 스트리밍 반환!
    if (isImageFile(normalizedPath)) {
      const buffer = await fs.readFile(normalizedPath);
      const arrayBuffer = buffer.buffer as ArrayBuffer;
      return {
        entryName,
        mimeType: getMimeType(normalizedPath),
        bytes: arrayBuffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) // ⚡ [최적화] 네이티브 버퍼 패스스루!
      };
    }
    throw new AppError('ZIP_OPEN_FAILED', 'Only .zip/.cbz/images are supported.');
  }

  await validateZipSignature(normalizedPath);

  return zipProvider.getPage(normalizedPath, entryName);
}
