import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { AppError } from '../../shared/errors/app-error';
import type { FileTreeNode } from '../../shared/fs/file-tree';

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const execFileAsync = promisify(execFile);
const explorerAdvancedRegistryPath = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced';
const windowsHiddenDirectoryNames = new Set(
  ['system volume information', '$recycle.bin', 'config.msi', 'programdata', 'recovery', 'onedrivetemp'].map((name) =>
    name.toLowerCase()
  )
);
const knownRootJunkDirectoryNames = new Set(['$getcurrent', '$winre_backup_partition.marker'].map((name) => name.toLowerCase()));

interface ExplorerVisibilityPolicy {
  showHidden: boolean;
  showProtectedOperatingSystemFiles: boolean;
}

interface WindowsEntryVisibility {
  isHidden: boolean;
  isSystem: boolean;
}

let cachedExplorerVisibilityPolicy: ExplorerVisibilityPolicy | null = null;
let cachedExplorerVisibilityPolicyAt = 0;

function mapFsError(error: unknown): AppError {
  if (!(error instanceof Error)) {
    return new AppError('UNKNOWN', 'Unknown filesystem error.');
  }

  const fsError = error as NodeJS.ErrnoException;
  if (fsError.code === 'ENOENT') {
    return new AppError('FILE_NOT_FOUND', 'Path was not found.');
  }

  if (fsError.code === 'EACCES' || fsError.code === 'EPERM') {
    return new AppError('FILE_ACCESS_DENIED', 'Access denied.');
  }

  return new AppError('UNKNOWN', fsError.message);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function resolveDriveRoot(driveLetter: string): string {
  return `${driveLetter}:\\`;
}

export async function getRootNodes(): Promise<FileTreeNode[]> {
  if (process.platform === 'win32') {
    const driveChecks = Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));
    const roots: FileTreeNode[] = [];

    for (const driveLetter of driveChecks) {
      const rootPath = resolveDriveRoot(driveLetter);
      if (!(await pathExists(rootPath))) {
        continue;
      }

      roots.push({
        name: `${driveLetter}:`,
        path: rootPath,
        type: 'drive',
        hasChildren: true
      });
    }

    return roots;
  }

  return [
    {
      name: '/',
      path: '/',
      type: 'directory',
      hasChildren: true
    }
  ];
}

function compareNodes(a: FileTreeNode, b: FileTreeNode): number {
  const typeOrder = (node: FileTreeNode): number => {
    if (node.type === 'directory') {
      return 0;
    }
    if (node.type === 'zip') {
      return 1;
    }
    return 2;
  };

  const orderDiff = typeOrder(a) - typeOrder(b);
  if (orderDiff !== 0) {
    return orderDiff;
  }

  return collator.compare(a.name, b.name);
}

function isZipFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.zip');
}

function isDriveRoot(targetPath: string): boolean {
  return /^[A-Za-z]:\\$/.test(targetPath);
}

function shouldHideRootJunkDirectory(name: string, parentPath: string, isDirectory: boolean): boolean {
  if (!isDirectory || !isDriveRoot(parentPath)) {
    return false;
  }

  const lowerName = name.toLowerCase();
  if (knownRootJunkDirectoryNames.has(lowerName)) {
    return true;
  }

  if (/^[!@#$%^&()_+=\-[\]{};',.]+[A-Za-z0-9]{4,}$/.test(name)) {
    return true;
  }

  if (/^[A-Z0-9]{6,12}$/.test(name) && /\d/.test(name)) {
    return true;
  }

  if (/^[()!@#$%^&*_+=-][A-Z0-9]{5,12}$/i.test(name) && /\d/.test(name)) {
    return true;
  }

  return false;
}

async function getExplorerVisibilityPolicy(): Promise<ExplorerVisibilityPolicy> {
  if (process.platform !== 'win32') {
    return {
      showHidden: false,
      showProtectedOperatingSystemFiles: false
    };
  }

  const now = Date.now();
  if (cachedExplorerVisibilityPolicy && now - cachedExplorerVisibilityPolicyAt < 5000) {
    return cachedExplorerVisibilityPolicy;
  }

  if (process.platform !== 'win32') {
    return {
      showHidden: false,
      showProtectedOperatingSystemFiles: false
    };
  }

  try {
    const command = [
      `$props = Get-ItemProperty -Path 'Registry::${explorerAdvancedRegistryPath}' -ErrorAction Stop;`,
      `[PSCustomObject]@{`,
      `  Hidden = [int]($props.Hidden);`,
      `  ShowSuperHidden = [int]($props.ShowSuperHidden)`,
      `} | ConvertTo-Json -Compress`
    ].join(' ');

    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      windowsHide: true,
      encoding: 'utf8'
    });
    const parsed = JSON.parse(stdout.trim()) as { Hidden?: number; ShowSuperHidden?: number };
    cachedExplorerVisibilityPolicy = {
      showHidden: parsed.Hidden === 1,
      showProtectedOperatingSystemFiles: parsed.ShowSuperHidden === 1
    };
    cachedExplorerVisibilityPolicyAt = now;
    return cachedExplorerVisibilityPolicy;
  } catch {
    cachedExplorerVisibilityPolicy = {
      showHidden: false,
      showProtectedOperatingSystemFiles: false
    };
    cachedExplorerVisibilityPolicyAt = now;
    return cachedExplorerVisibilityPolicy;
  }
}

async function getWindowsEntryVisibilityMap(parentPath: string): Promise<Map<string, WindowsEntryVisibility>> {
  if (process.platform !== 'win32') {
    return new Map();
  }

  try {
    const command = [
      `$items = Get-ChildItem -LiteralPath '${parentPath.replace(/'/g, "''")}' -Force -ErrorAction SilentlyContinue;`,
      `$hidden = $items | Where-Object {`,
      `  $_.PSIsContainer`,
      `} | ForEach-Object {`,
      `  [PSCustomObject]@{`,
      `    Name = $_.Name;`,
      `    Hidden = [bool]($_.Attributes -band [System.IO.FileAttributes]::Hidden);`,
      `    System = [bool]($_.Attributes -band [System.IO.FileAttributes]::System)`,
      `  }`,
      `};`,
      `$hidden | ConvertTo-Json -Compress`
    ].join(' ');

    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      windowsHide: true,
      encoding: 'utf8'
    });

    const trimmed = stdout.trim();
    if (!trimmed) {
      return new Map();
    }

    const parsed = JSON.parse(trimmed) as
      | { Name: string; Hidden: boolean; System: boolean }
      | Array<{ Name: string; Hidden: boolean; System: boolean }>;
    const items = Array.isArray(parsed) ? parsed : [parsed];

    return new Map(
      items.map((item) => [
        item.Name.toLowerCase(),
        {
          isHidden: item.Hidden,
          isSystem: item.System
        }
      ])
    );
  } catch {
    return new Map();
  }
}

function shouldHideEntry(
  name: string,
  parentPath: string,
  isDirectory: boolean,
  entryVisibility: WindowsEntryVisibility | undefined,
  policy: ExplorerVisibilityPolicy
): boolean {
  if (!name || name === '.' || name === '..') {
    return true;
  }

  if (name.startsWith('.')) {
    return true;
  }

  if (process.platform !== 'win32') {
    return false;
  }

  const lowerName = name.toLowerCase();
  if (shouldHideRootJunkDirectory(name, parentPath, isDirectory)) {
    return true;
  }

  if (lowerName.startsWith('$')) {
    return true;
  }

  if (isDirectory && windowsHiddenDirectoryNames.has(lowerName)) {
    return true;
  }

  if (entryVisibility?.isSystem && !policy.showProtectedOperatingSystemFiles) {
    return true;
  }

  if (entryVisibility?.isHidden && !policy.showHidden) {
    return true;
  }

  return false;
}

export async function getChildNodes(parentPath: string): Promise<FileTreeNode[]> {
  const normalizedPath = path.resolve(parentPath);

  try {
    const stat = await fs.stat(normalizedPath);
    if (!stat.isDirectory()) {
      throw new AppError('FILE_NOT_FOUND', 'Requested path is not a directory.');
    }

    const [dirents, entryVisibilityMap, policy] = await Promise.all([
      fs.readdir(normalizedPath, { withFileTypes: true }),
      getWindowsEntryVisibilityMap(normalizedPath),
      getExplorerVisibilityPolicy()
    ]);
    const nodes: FileTreeNode[] = [];

    for (const dirent of dirents) {
      const entryVisibility = entryVisibilityMap.get(dirent.name.toLowerCase());
      if (shouldHideEntry(dirent.name, normalizedPath, dirent.isDirectory(), entryVisibility, policy)) {
        continue;
      }

      if (dirent.isDirectory()) {
        nodes.push({
          name: dirent.name,
          path: path.join(normalizedPath, dirent.name),
          type: 'directory',
          hasChildren: true
        });
        continue;
      }

      if (dirent.isFile() && isZipFileName(dirent.name)) {
        nodes.push({
          name: dirent.name,
          path: path.join(normalizedPath, dirent.name),
          type: 'zip',
          hasChildren: false
        });
      }
    }

    return nodes.sort(compareNodes);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw mapFsError(error);
  }
}
