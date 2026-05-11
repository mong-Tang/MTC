import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { ConverterMode } from '../layout/ConverterPanel';
import type { ConverterSourceItem } from '../layout/ConverterPanel';
import type { CompressionPolicy } from '../layout/ConverterPanel';

interface ConverterFileListProps {
  mode: ConverterMode;
  outputFormat: 'zip' | 'cbz';
  compressionPolicy: CompressionPolicy;
  items: ConverterSourceItem[];
  hasSidebarItems: boolean;
  selectedPaths: Set<string>;
  onToggleSelection: React.Dispatch<React.SetStateAction<Set<string>>>;
  onAdd: () => void;
  onAddAll: () => void;
  onClear: () => void;
  onRemoveItems: (paths: string[]) => void;
}

const IconMenu = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="8" x2="20" y2="8" />
    <line x1="4" y1="16" x2="20" y2="16" />
  </svg>
);

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const IconLayer = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
    <polyline points="2 17 12 22 22 17"></polyline>
    <polyline points="2 12 12 17 22 12"></polyline>
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

const IconXCircle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="15" y1="9" x2="9" y2="15"></line>
    <line x1="9" y1="9" x2="15" y2="15"></line>
  </svg>
);

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
  hasSidebarItems,
  selectedPaths,
  onToggleSelection,
  onAdd,
  onAddAll,
  onClear,
  onRemoveItems
}) => {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // 🎛️ New Interaction States
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // 🖱️ Context Menu States
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number }>({ 
    visible: false, 
    x: 0, 
    y: 0 
  });

  // Auto-clear selection when items count changes (items got removed etc)
  useEffect(() => {
    const validPaths = new Set(items.map(i => i.path));
    onToggleSelection(prev => {
      const next = new Set<string>();
      prev.forEach(p => {
        if (validPaths.has(p)) next.add(p);
      });
      // Only trigger state update if count actually changed to prevent loop?
      if (next.size !== prev.size) return next;
      return prev;
    });
  }, [items, onToggleSelection]);

  // Handle Menu Outside Clicks
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [isMenuOpen]);

  // 🖱️ Handle Context Menu Lifecycle (Global Close)
  useEffect(() => {
    if (!contextMenu.visible) return;
    const closeMenu = () => setContextMenu({ visible: false, x: 0, y: 0 });
    
    // Close on any regular click or window resize
    window.addEventListener('click', closeMenu);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('contextmenu', closeMenu); // Close if right click occurs outside container boundary handled by propagate
    
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
    };
  }, [contextMenu.visible]);

  const handleRowClick = (path: string, e: React.MouseEvent) => {
    onToggleSelection(prev => {
      const next = new Set(prev);
      if (e.ctrlKey || e.metaKey) {
        // Multi-selection with Ctrl toggle
        if (next.has(path)) next.delete(path);
        else next.add(path);
      } else {
        // Single selection, or toggle if only one is selected and it is this one
        if (next.has(path) && next.size === 1) {
          next.clear();
        } else {
          next.clear();
          next.add(path);
        }
      }
      return next;
    });
  };

  // 🖱️ Global/Item Context Menu Handler
  const handleOpenContextMenu = (e: React.MouseEvent, targetPath?: string) => {
    e.preventDefault();
    e.stopPropagation(); // Kill propagation so parent container doesn't override item handler
    
    setMenuOpen(false); // Close the button menu if open

    // 💎 Premium UX: If right-clicking a non-selected item, select ONLY that item first!
    if (targetPath && !selectedPaths.has(targetPath)) {
      onToggleSelection(new Set([targetPath]));
    }
    
    // Smart viewport clamping
    let px = e.clientX;
    let py = e.clientY;
    const approxWidth = 180;
    const approxHeight = 200;
    
    if (px + approxWidth > window.innerWidth) px = px - approxWidth;
    if (py + approxHeight > window.innerHeight) py = py - approxHeight;
    
    setContextMenu({
      visible: true,
      x: px,
      y: py
    });
  };

  const handleBatchDelete = () => {
    if (selectedPaths.size === 0) return;
    onRemoveItems(Array.from(selectedPaths));
    onToggleSelection(new Set());
    setMenuOpen(false);
    setContextMenu({ visible: false, x: 0, y: 0 }); // Ensure context menu closes too
  };

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

  // 🧬 Shared Menu Content Blueprint
  const renderMenuItems = (closeSource: () => void) => (
    <>
      <div className="converter-dropdown-title">목록 편집</div>
      
      <button 
        className="converter-dropdown-item"
        onClick={() => { onAdd(); closeSource(); }}
      >
        <IconPlus /> <span>+ Add</span>
      </button>
      
      <div className="converter-dropdown-divider" />
      
      <button 
        className="converter-dropdown-item"
        disabled={!hasSidebarItems}
        onClick={() => { onAddAll(); closeSource(); }}
      >
        <IconLayer /> <span>Add All</span>
      </button>
      
      <button 
        className="converter-dropdown-item"
        disabled={items.length === 0}
        onClick={() => { onClear(); closeSource(); }}
      >
        <IconXCircle /> <span>Clear</span>
      </button>
      
      <div className="converter-dropdown-divider" />
      
      <button 
        className="converter-dropdown-item danger"
        disabled={selectedPaths.size === 0}
        onClick={handleBatchDelete}
      >
        <IconTrash /> <span>Delete ({selectedPaths.size})</span>
      </button>
    </>
  );

  return (
    <section className="converter-section converter-file-list-section">
      <div className="converter-file-list-header">
        <h3 className="converter-section-title">{mode === 'merge' ? '입력 파일 목록' : '대상 파일'}</h3>
        <div className="converter-toolbar-actions">
          
          <div className="converter-menu-wrapper" ref={menuRef}>
            <button 
              className="converter-mini-btn" 
              type="button"
              onClick={() => setMenuOpen(!isMenuOpen)}
              style={{ padding: '0 8px' }}
            >
              <IconMenu />
            </button>
            
            {isMenuOpen && (
              <div className="converter-dropdown-menu">
                {renderMenuItems(() => setMenuOpen(false))}
              </div>
            )}
          </div>

        </div>
      </div>
      {items.length === 0 ? (
        <div 
          className="converter-empty-list"
          onContextMenu={(e) => handleOpenContextMenu(e)} // Allow "Add" context in empty space
        >
          <div className="converter-help-block">
            <p className="converter-section-text">
              {mode === 'merge' ? '병합할 파일을 순서대로 추가하세요.' : '분할할 파일 1개를 선택하세요.'}
            </p>
            <p className="converter-help-line">- 사이드바 목록에서 햄버거 메뉴의 [Add All] 사용</p>
            <p className="converter-help-line">- 사이드바 파일 클릭: 입력 목록에 추가/제거</p>
            <p className="converter-help-line">- [+ Add]: 탐색기에서 직접 파일 추가</p>
            <p className="converter-help-line">- 행 선택 후 [Delete]: 선택한 파일 목록 제거</p>
          </div>
        </div>
      ) : (
        <div className="converter-item-list">
          <div className="converter-item-table-head">
            <span className="converter-item-head-index" />
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
          <div 
            className="converter-item-scroll"
            onContextMenu={(e) => handleOpenContextMenu(e)} // Catch clicks in empty area below rows
          >
            {sortedItems.map((item, index) => {
              const isSelected = selectedPaths.has(item.path);
              return (
                <div
                  key={item.path}
                  className={`converter-item-row ${isSelected ? 'selected' : ''}`}
                  title={`${item.path}\n클릭하여 선택 (Delete 키 또는 메뉴로 삭제)`}
                  onClick={(e) => handleRowClick(item.path, e)}
                  onDoubleClick={() => onRemoveItems([item.path])}
                  onContextMenu={(e) => handleOpenContextMenu(e, item.path)} // Item-specific context menu + auto-select
                >
                  <span className="converter-item-index">{index + 1}</span>
                  <span className="converter-item-name">{item.name}</span>
                  <span className="converter-item-size">{formatSize(item.sizeBytes)}</span>
                </div>
              );
            })}
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

      {/* 🖱️ Floating Context Menu Engine */}
      {contextMenu.visible && (
        <div 
          className="converter-dropdown-menu context-menu-float" 
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            right: 'auto', // Wipe out CSS absolute 'right: 0'
            margin: 0,
            transformOrigin: 'top left',
            zIndex: 9999,
            // Minor visual tuning for hovering standalone:
            boxShadow: '0 15px 35px rgba(0,0,0,0.6), 0 5px 15px rgba(0,0,0,0.3)', 
            animation: 'dropdownFadeIn 0.12s cubic-bezier(0,0,0.2,1)' 
          }}
          onClick={(e) => e.stopPropagation()} // Prevent self-close when clicking inside
        >
          {renderMenuItems(() => setContextMenu({ visible: false, x: 0, y: 0 }))}
        </div>
      )}
    </section>
  );
};
