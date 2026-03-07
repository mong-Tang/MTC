export interface RecentItem {
  fileId: string;
  zipPath: string;
  title: string;
  lastPageIndex: number;
  lastOpenedAt: string;
}

export interface UpsertRecentInput {
  fileId: string;
  zipPath: string;
  title: string;
  lastPageIndex: number;
}
