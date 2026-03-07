import path from 'node:path';
import yauzl from 'yauzl';

import { AppError } from '../../../shared/errors/app-error';
import { viewerConfig } from '../../config/viewer-config';
import type { IArchiveProvider } from '../archive/archive-provider';
import type { ArchiveOpenResult, ArchivePage, ArchivePageData } from '../archive/types';

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const mimeTypesByExtension: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp'
};

function isDirectoryEntry(entryName: string): boolean {
  return entryName.endsWith('/');
}

function getExtension(entryName: string): string {
  return path.extname(entryName).replace('.', '').toLowerCase();
}

function isImageEntry(entryName: string): boolean {
  const ext = getExtension(entryName);
  return viewerConfig.supportedImageExtensions.includes(ext as (typeof viewerConfig.supportedImageExtensions)[number]);
}

function naturalSortEntries(a: string, b: string): number {
  return collator.compare(a, b);
}

function resolveMimeType(entryName: string): string {
  const ext = getExtension(entryName);
  return mimeTypesByExtension[ext] ?? 'application/octet-stream';
}

export class ZipArchiveProvider implements IArchiveProvider {
  canOpen(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.zip');
  }

  async open(filePath: string): Promise<ArchiveOpenResult> {
    const entryInfos = await this.readEntries(filePath);
    const imageEntries = entryInfos
      .filter((item) => !isDirectoryEntry(item.fileName))
      .filter((item) => isImageEntry(item.fileName))
      .sort((a, b) => naturalSortEntries(a.fileName, b.fileName));

    const pages: ArchivePage[] = imageEntries.map((entry, index) => ({
      index,
      entryName: entry.fileName,
      displayName: path.basename(entry.fileName)
    }));

    return {
      meta: {
        title: path.basename(filePath),
        totalPages: pages.length,
        hasEncryptedEntries: entryInfos.some((entry) => (entry.generalPurposeBitFlag & 0x1) !== 0),
        fileId: ''
      },
      pages
    };
  }

  async getPage(filePath: string, entryName: string): Promise<ArchivePageData> {
    const bytes = await this.readEntryBytes(filePath, entryName);
    return {
      entryName,
      mimeType: resolveMimeType(entryName),
      bytes: Array.from(bytes)
    };
  }

  private readEntries(filePath: string): Promise<yauzl.Entry[]> {
    return new Promise((resolve, reject) => {
      const entries: yauzl.Entry[] = [];

      yauzl.open(filePath, { lazyEntries: true, autoClose: true, decodeStrings: true }, (openErr, zipFile) => {
        if (openErr || !zipFile) {
          reject(new AppError('ZIP_CORRUPTED', openErr?.message ?? 'Failed to read ZIP central directory.'));
          return;
        }

        zipFile.readEntry();

        zipFile.on('entry', (entry) => {
          entries.push(entry);
          zipFile.readEntry();
        });

        zipFile.on('end', () => {
          resolve(entries);
        });

        zipFile.on('error', (error) => {
          reject(new AppError('ZIP_CORRUPTED', error.message));
        });
      });
    });
  }

  private readEntryBytes(filePath: string, targetEntryName: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const succeed = (value: Buffer, zipFile?: yauzl.ZipFile): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (zipFile) {
          zipFile.close();
        }
        resolve(value);
      };

      const fail = (error: AppError, zipFile?: yauzl.ZipFile): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (zipFile) {
          zipFile.close();
        }
        reject(error);
      };

      yauzl.open(filePath, { lazyEntries: true, autoClose: false, decodeStrings: true }, (openErr, zipFile) => {
        if (openErr || !zipFile) {
          fail(new AppError('ZIP_CORRUPTED', openErr?.message ?? 'Failed to read ZIP central directory.'));
          return;
        }

        let found = false;
        zipFile.readEntry();

        zipFile.on('entry', (entry) => {
          if (entry.fileName !== targetEntryName) {
            zipFile.readEntry();
            return;
          }

          if (isDirectoryEntry(entry.fileName)) {
            fail(new AppError('ZIP_PAGE_NOT_FOUND', 'Requested page entry is not a file.'), zipFile);
            return;
          }

          if ((entry.generalPurposeBitFlag & 0x1) !== 0) {
            fail(new AppError('ZIP_ENCRYPTED', 'Encrypted ZIP is not supported in v0.1.'), zipFile);
            return;
          }

          zipFile.openReadStream(entry, (streamErr, stream) => {
            if (streamErr || !stream) {
              fail(new AppError('ZIP_CORRUPTED', streamErr?.message ?? 'Failed to read page stream.'), zipFile);
              return;
            }

            const chunks: Buffer[] = [];
            stream.on('data', (chunk) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            stream.on('error', (error) => {
              fail(new AppError('ZIP_CORRUPTED', error.message), zipFile);
            });
            stream.on('end', () => {
              found = true;
              succeed(Buffer.concat(chunks), zipFile);
            });
          });
        });

        zipFile.on('end', () => {
          if (!found) {
            fail(new AppError('ZIP_PAGE_NOT_FOUND', 'Requested page entry was not found.'), zipFile);
          }
        });

        zipFile.on('error', (error) => {
          fail(new AppError('ZIP_CORRUPTED', error.message), zipFile);
        });
      });
    });
  }
}
