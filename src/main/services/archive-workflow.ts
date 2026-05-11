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

/**
 * 🛰️ [재귀적 파일 수집기] 지정된 디렉토리의 하위 모든 파일 경로를 깊이 우선 탐색하여 획득합니다.
 */
async function getAllFilesRecursive(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await getAllFilesRecursive(res));
    } else {
      files.push(res);
    }
  }
  return files;
}

/**
 * ⚡ [핵심 병합 엔진] 여러 개의 아카이브 및 이미지 파일들을 순서대로 읽어들여
 * 모든 이미지를 연속적인 번호로 재배열한 후, 단일 통합 아카이브로 병합합니다.
 */
export async function mergeArchivesWorkflow(
  sourcePaths: string[],
  outputZipPath: string,
  onProgress?: (event: { percent: number; message: string }) => void,
  comment?: string
): Promise<{ logs: string[] }> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mtc-merge-'));
  const logs: string[] = [`[Merge Started] Total sources: ${sourcePaths.length}`];
  
  const report = (percent: number, message: string) => {
    logs.push(message);
    if (onProgress) {
      onProgress({ percent: Math.min(Math.max(0, percent), 100), message });
    }
  };

  try {
    const unifiedDir = path.join(tempRoot, 'unified');
    await fs.mkdir(unifiedDir, { recursive: true });

    // 📝 [메시지 주입] 사용자가 작성한 메시지가 있다면 note.txt로 생성하여 통합 폴더에 자동 삽입!
    if (comment && comment.trim()) {
      await fs.writeFile(path.join(unifiedDir, 'note.txt'), comment.trim(), 'utf8');
      report(1, '[Note Added] User merge message recorded.');
    }
    
    let globalImageCounter = 1;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.avif'];

    report(2, `[Stage 1] Decompressing and collecting assets from ${sourcePaths.length} sources...`);

    for (let i = 0; i < sourcePaths.length; i++) {
      const src = sourcePaths[i];
      const ext = path.extname(src).toLowerCase();
      const baseName = path.basename(src);
      
      // 전체 작업의 약 60%를 추출 과정에 배당하여 프로그레션 연산
      const basePercent = 5;
      const stepSize = 65 / sourcePaths.length;
      const currentPercent = Math.floor(basePercent + (i * stepSize));

      report(currentPercent, `-> Processing [${i + 1}/${sourcePaths.length}]: ${baseName}`);
      
      const itemWorkDir = path.join(tempRoot, `item_${i}`);
      await fs.mkdir(itemWorkDir, { recursive: true });

      if (['.zip', '.cbz', '.rar', '.cbr', '.7z', '.tar'].includes(ext)) {
        try {
          await run7zCommand(['x', src, `-o${itemWorkDir}`, '-y']);
        } catch (e: any) {
          report(currentPercent, `   [Warning] Failed to fully extract ${baseName}. Skipping failed entry.`);
          continue;
        }
      } else if (imageExtensions.includes(ext)) {
        await fs.copyFile(src, path.join(itemWorkDir, baseName));
      } else {
        report(currentPercent, `   [Info] Skipping unsupported format: ${baseName}`);
        continue;
      }

      const rawFiles = await getAllFilesRecursive(itemWorkDir);
      const sortedFiles = rawFiles
        .filter(f => imageExtensions.includes(path.extname(f).toLowerCase()))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      // report(currentPercent, `   -> Found ${sortedFiles.length} valid images.`);

      for (const file of sortedFiles) {
        const fExt = path.extname(file);
        const paddedIndex = String(globalImageCounter).padStart(6, '0');
        const destFileName = `${paddedIndex}${fExt}`;
        const destPath = path.join(unifiedDir, destFileName);
        
        await fs.copyFile(file, destPath);
        globalImageCounter++;
      }
    }

    const finalImageCount = globalImageCounter - 1;
    report(75, `[Stage 2] Asset consolidation complete. Total gathered: ${finalImageCount} images.`);

    if (finalImageCount === 0) {
      throw new Error('No valid image assets found in provided sources to merge.');
    }

    report(80, `[Stage 3] Re-compressing into final output: ${path.basename(outputZipPath)}`);
    
    await run7zCommand(['a', '-tzip', outputZipPath, '*'], unifiedDir);
    
    report(100, `[Complete] Merged successfully. Saved to -> ${outputZipPath}`);
    
    return { logs };

  } catch (error: any) {
    const errMsg = error.message || String(error);
    logs.push(`[Fatal Error] ${errMsg}`);
    throw new AppError('UNKNOWN', logs.join('\n'));
  } finally {
    try {
      await fs.rm(tempRoot, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Failed to clean up merge temp directory', cleanupError);
    }
  }
}


