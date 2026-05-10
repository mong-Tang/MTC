import React, { useMemo, useState } from 'react';
import type { ConverterMode } from '../layout/ConverterPanel';
import type { ConverterSourceItem } from '../layout/ConverterPanel';
import type { CompressionPolicy } from '../layout/ConverterPanel';

interface ConverterFileListProps {
  mode: ConverterMode;
  outputFormat: 'zip' | 'cbz';
  compressionPolicy: CompressionPolicy;
  items: ConverterSourceItem[];
  onAdd: () => void;
  onAddAll: () => void;
  onClear: () => void;
  onRemoveItem: (path: string) => void;
}

const formatSize = (sizeBytes?: number): string => {
  if (typeof sizeBytes !== 'number' || Number.isNaN(sizeBytes)) return '-';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  if (sizeBytes < 1024 * 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

type SortKey = 'name' | 'size';
type SortDirection = 'asc' | 'desc';

const getCompressionRatioByExtension = (fileName: string): number => {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const archiveAndCompressed = new Set([
    'zip', 'cbz', '7z', 'rar', 'gz', 'bz2', 'xz',
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'mp3', 'aac', 'ogg', 'mp4', 'mkv', 'webm', 'pdf'
  ]);
  const rawImage = new Set(['bmp', 'tif', 'tiff']);
  const textLike = new Set(['txt', 'json', 'xml', 'html', 'css', 'js', 'ts', 'md', 'csv', 'log']);

  if (archiveAndCompressed.has(ext)) return 0.99;
  if (rawImage.has(ext)) return 0.55;
  if (textLike.has(ext)) return 0.35;
  return 0.75;
};

export const ConverterFileList: React.FC<ConverterFileListProps> = ({
  mode,
  outputFormat,
  compressionPolicy,
  items,
  onAdd,
  onAddAll,
  onClear,
  onRemoveItem
}) => {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sortedItems = useMemo(() => {
    if (!sortKey) return items;

    const withIndex = items.map((item, index) => ({ item, index }));
    withIndex.sort((left, right) => {
      let compare = 0;

      if (sortKey === 'name') {
        compare = left.item.name.localeCompare(right.item.name, 'ko');
      } else {
        const leftSize = left.item.sizeBytes ?? -1;
        const rightSize = right.item.sizeBytes ?? -1;
        compare = leftSize - rightSize;
      }

      if (compare === 0) {
        compare = left.index - right.index;
      }

      return sortDirection === 'asc' ? compare : -compare;
    });

    return withIndex.map((entry) => entry.item);
  }, [items, sortDirection, sortKey]);

  const handleSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection('asc');
  };

  const getSortIndicator = (targetKey: SortKey): string => {
    if (sortKey !== targetKey) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  const knownTotalSize = useMemo(
    () => items.reduce((sum, item) => sum + (typeof item.sizeBytes === 'number' ? item.sizeBytes : 0), 0),
    [items]
  );
  const unknownSizeCount = useMemo(
    () => items.filter((item) => typeof item.sizeBytes !== 'number').length,
    [items]
  );
  const allArchives = useMemo(
    () => items.length > 0 && items.every((item) => item.type === 'archive'),
    [items]
  );
  const effectivePolicy = useMemo(() => {
    if (compressionPolicy === 'auto') {
      return allArchives ? 'store' : 'compress';
    }
    return compressionPolicy;
  }, [allArchives, compressionPolicy]);
  const estimatedOutputSize = useMemo(() => {
    const compressedBody = items.reduce((sum, item) => {
      if (typeof item.sizeBytes !== 'number') return sum;
      const ratio = effectivePolicy === 'store' ? 1 : getCompressionRatioByExtension(item.name);
      return sum + item.sizeBytes * ratio;
    }, 0);
    const containerOverhead = (effectivePolicy === 'store' ? 28 : 64) * 1024 + items.length * 120;
    return Math.max(0, Math.round(compressedBody + containerOverhead));
  }, [effectivePolicy, items, outputFormat]);

  const expectedSizeText =
    unknownSizeCount === 0
      ? formatSize(estimatedOutputSize)
      : `${formatSize(estimatedOutputSize)} + ? (${unknownSizeCount}개 미확인)`;

  return (
    <section className="converter-section converter-file-list-section">
      <div className="converter-file-list-header">
        <h3 className="converter-section-title">{mode === 'merge' ? '입력 파일 목록' : '대상 파일'}</h3>
        <div className="converter-toolbar-actions">
          <span className="converter-source-count">선택 {items.length}</span>
          <button className="converter-mini-btn" type="button" onClick={onAdd}>
            + Add
          </button>
          <button className="converter-mini-btn" type="button" onClick={onAddAll}>
            Add All
          </button>
          <button className="converter-mini-btn" type="button" onClick={onClear}>
            Clear
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="converter-empty-list">
          <div className="converter-help-block">
            <p className="converter-section-text">
              {mode === 'merge' ? '병합할 파일을 순서대로 추가하세요.' : '분할할 파일 1개를 선택하세요.'}
            </p>
            <p className="converter-help-line">- Add All: 사이드바 목록 전체 추가</p>
            <p className="converter-help-line">- 사이드바 파일 클릭: 입력 목록에 추가/제거</p>
            <p className="converter-help-line">- + Add: 파일 선택창에서 직접 추가</p>
            <p className="converter-help-line">- Clear: 현재 입력 목록 비우기</p>
          </div>
        </div>
      ) : (
        <div className="converter-item-list">
          <div className="converter-item-table-head">
            <button
              type="button"
              className="converter-item-head-btn converter-item-head-name"
              onClick={() => handleSort('name')}
            >
              파일명{getSortIndicator('name')}
            </button>
            <button
              type="button"
              className="converter-item-head-btn converter-item-head-size"
              onClick={() => handleSort('size')}
            >
              크기{getSortIndicator('size')}
            </button>
          </div>
          <div className="converter-item-scroll">
            {sortedItems.map((item, index) => (
              <div
                key={item.path}
                className="converter-item-row"
                title={`${item.path}\n더블클릭으로 목록에서 제거`}
                onDoubleClick={() => onRemoveItem(item.path)}
              >
                <span className="converter-item-index">{index + 1}</span>
                <span className="converter-item-name">{item.name}</span>
                <span className="converter-item-size">{formatSize(item.sizeBytes)}</span>
              </div>
            ))}
          </div>
          <div className="converter-item-footer">
            <div className="converter-item-footer-text">
              <span className="converter-item-footer-label">예상 출력({outputFormat.toUpperCase()}, 압축률 추정)</span>
              <span className="converter-item-footer-sub">
                압축 정책: {effectivePolicy === 'store' ? '무압축' : '압축 적용'}
                {compressionPolicy === 'auto' ? ' (자동)' : ' (수동)'}
              </span>
              <span className="converter-item-footer-sub">입력 합계(원본): {formatSize(knownTotalSize)}</span>
            </div>
            <span className="converter-item-footer-value">{expectedSizeText}</span>
          </div>
        </div>
      )}
    </section>
  );
};
