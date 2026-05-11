export interface ArchivePage {
  index: number;
  entryName: string;
  displayName: string;
  sizeBytes?: number;
}

export interface ArchiveMeta {
  title: string;
  totalPages: number;
  hasEncryptedEntries: boolean;
  fileId: string;
  totalUncompressedSizeBytes?: number; // 🧬 [신규 데이터] 아카이브 내부 파일 전체 압축 해제 크기 총합!
}

export interface ArchiveOpenResult {
  meta: ArchiveMeta;
  pages: ArchivePage[];
}

export interface ArchivePageData {
  entryName: string;
  mimeType: string;
  bytes: ArrayBuffer;
}
