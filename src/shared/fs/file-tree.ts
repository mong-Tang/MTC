export type FileTreeNodeType = 'drive' | 'directory' | 'zip';

export interface FileTreeNode {
  name: string;
  path: string;
  type: FileTreeNodeType;
  hasChildren: boolean;
}

