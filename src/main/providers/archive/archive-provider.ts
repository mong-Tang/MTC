import type { ArchiveOpenResult, ArchivePageData } from './types';

export interface IArchiveProvider {
  canOpen(filePath: string): boolean;
  open(filePath: string): Promise<ArchiveOpenResult>;
  getPage(filePath: string, entryName: string): Promise<ArchivePageData>;
}
