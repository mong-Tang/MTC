import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { path7za } from '7zip-bin';

import { AppError } from '../../shared/errors/app-error';

export type ZipEditRequest =
  | { kind: 'delete'; targetEntryName: string }
  | {
      kind: 'insert-after';
      afterEntryName: string;
      insertFileName: string;
      insertMimeType: string;
      insertBytes: number[];
    };

function run7zCommand(args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const normalized7za = path7za.replace('app.asar', 'app.asar.unpacked');
    const child = spawn(normalized7za, args, {
      cwd,
      windowsHide: true
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new AppError('UNKNOWN', `7-Zip command failed (${code}): ${stderr.trim()}`));
    });
  });
}

function resolveEntryPath(rootPath: string, entryName: string): string {
  const normalized = entryName.replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  return path.join(rootPath, ...segments);
}

function formatTimestamp(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(
    date.getSeconds()
  )}`;
}

function isEditedZipPath(filePath: string): boolean {
  const baseName = path.basename(filePath, path.extname(filePath));
  return /_edited_\d{8}_\d{6}(?:_\d+)?$/i.test(baseName);
}

async function resolveEditedZipPath(sourceZipPath: string): Promise<string> {
  const directory = path.dirname(sourceZipPath);
  const sourceBaseName = path.basename(sourceZipPath, path.extname(sourceZipPath));
  const stamp = formatTimestamp();

  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? '' : `_${index}`;
    const candidate = path.join(directory, `${sourceBaseName}_edited_${stamp}${suffix}.zip`);
    try {
      await fs.access(candidate);
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        return candidate;
      }
      throw error;
    }
  }

  throw new AppError('UNKNOWN', 'Unable to create unique edited zip path.');
}

async function resolveTempOverwritePath(targetZipPath: string): Promise<string> {
  const directory = path.dirname(targetZipPath);
  const targetBaseName = path.basename(targetZipPath, path.extname(targetZipPath));
  const stamp = formatTimestamp();

  for (let index = 0; index < 1000; index += 1) {
    const suffix = index === 0 ? '' : `_${index}`;
    const candidate = path.join(directory, `${targetBaseName}__editing_tmp_${stamp}${suffix}.zip`);
    try {
      await fs.access(candidate);
    } catch (error) {
      const fsError = error as NodeJS.ErrnoException;
      if (fsError.code === 'ENOENT') {
        return candidate;
      }
      throw error;
    }
  }

  throw new AppError('UNKNOWN', 'Unable to create temporary overwrite path.');
}

export async function applyZipEditInTemp(zipPath: string, request: ZipEditRequest): Promise<{ editedZipPath: string }> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'zip-edit-'));
  const tempExtractPath = path.join(tempRoot, 'work');
  await fs.mkdir(tempExtractPath, { recursive: true });

  try {
    await run7zCommand(['x', zipPath, `-o${tempExtractPath}`, '-y']);

    if (request.kind === 'delete') {
      const targetPath = resolveEntryPath(tempExtractPath, request.targetEntryName);
      await fs.rm(targetPath, { force: true });
    } else {
      const afterPath = resolveEntryPath(tempExtractPath, request.afterEntryName);
      const afterDirectory = path.dirname(afterPath);
      const afterExtension = path.extname(afterPath);
      const afterBaseName = path.basename(afterPath, afterExtension);
      const preferredExtension = path.extname(request.insertFileName) || afterExtension || '.png';
      let insertPath = path.join(afterDirectory, `${afterBaseName}--ins-01${preferredExtension}`);
      for (let index = 2; index < 1000; index += 1) {
        try {
          await fs.access(insertPath);
          insertPath = path.join(afterDirectory, `${afterBaseName}--ins-${String(index).padStart(2, '0')}${preferredExtension}`);
        } catch (error) {
          const fsError = error as NodeJS.ErrnoException;
          if (fsError.code === 'ENOENT') {
            break;
          }
          throw error;
        }
      }

      await fs.writeFile(insertPath, Buffer.from(request.insertBytes));
    }

    const overwriteEditedSource = isEditedZipPath(zipPath);
    const editedZipPath = overwriteEditedSource ? zipPath : await resolveEditedZipPath(zipPath);
    const zipOutPath = overwriteEditedSource ? await resolveTempOverwritePath(zipPath) : editedZipPath;

    await run7zCommand(['a', '-tzip', zipOutPath, '*'], tempExtractPath);

    if (overwriteEditedSource) {
      await fs.copyFile(zipOutPath, editedZipPath);
      await fs.rm(zipOutPath, { force: true });
    }

    return { editedZipPath };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

export async function convertArchiveToZipWorkflow(
  sourcePath: string,
  outputZipPath: string
): Promise<{ logs: string[] }> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'zip-convert-'));
  const tempExtractPath = path.join(tempRoot, 'extracted');
  await fs.mkdir(tempExtractPath, { recursive: true });

  const logs: string[] = [`[Start] Converting: ${path.basename(sourcePath)}`];

  try {
    logs.push('[Stage 1] Unpacking archive via 7-Zip Super Engine...');
    await run7zCommand(['x', sourcePath, `-o${tempExtractPath}`, '-y']);
    logs.push('-> Unpacked successfully with high efficiency.');

    logs.push('[Stage 2] Validating content...');
    const entries = await fs.readdir(tempExtractPath);
    logs.push(`-> Found ${entries.length} top-level items.`);

    logs.push('[Stage 3] Re-compressing using optimized 7-Zip algorithms...');
    await run7zCommand(['a', '-tzip', outputZipPath, '*'], tempExtractPath);
    logs.push(`-> Compression completed: ${path.basename(outputZipPath)}`);

    logs.push('[Done] Conversion finished successfully.');
    return { logs };
  } catch (error) {
    logs.push(`[Error] ${(error as Error).message}`);
    throw new AppError('UNKNOWN', logs.join('\n'));
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}


