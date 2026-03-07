export interface ArchivePage {
  index: number;
  entryName: string;
  displayName: string;
}

export interface ArchiveMeta {
  title: string;
  totalPages: number;
  hasEncryptedEntries: boolean;
  fileId: string;
}

export interface ArchiveOpenResult {
  meta: ArchiveMeta;
  pages: ArchivePage[];
}

export interface ArchivePageData {
  entryName: string;
  mimeType: string;
  bytes: number[];
}
