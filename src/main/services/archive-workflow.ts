import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

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

function runPowerShellCommand(command: string, envOverrides?: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      {
        env: {
          ...process.env,
          ...envOverrides
        },
        windowsHide: true
      }
    );

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
      reject(new AppError('UNKNOWN', `PowerShell command failed (${code}): ${stderr.trim()}`));
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
    await runPowerShellCommand('Expand-Archive -LiteralPath $env:ZIP_SRC -DestinationPath $env:ZIP_DST -Force', {
      ZIP_SRC: zipPath,
      ZIP_DST: tempExtractPath
    });

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

    await runPowerShellCommand('Set-Location -LiteralPath $env:ZIP_WORK; Compress-Archive -Path * -DestinationPath $env:ZIP_OUT -Force', {
      ZIP_WORK: tempExtractPath,
      ZIP_OUT: zipOutPath
    });

    if (overwriteEditedSource) {
      await fs.copyFile(zipOutPath, editedZipPath);
      await fs.rm(zipOutPath, { force: true });
    }

    return { editedZipPath };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

