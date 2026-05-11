import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { ConverterMode } from '../layout/ConverterPanel';
import type { ConverterSourceItem } from '../layout/ConverterPanel';
import type { CompressionPolicy } from '../layout/ConverterPanel';
import { EmptyState, EmptyStateHelpLine } from '../ui/EmptyState';

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
  // 🛰️ [신규] 분할 모드용 통신 관제 연동 프로퍼티
  canExecute?: boolean;
  disabledReason?: string | null;
  onExecute?: () => void;
  progressPercent?: number;
  executionLogs?: string[];
  isProcessing?: boolean;
  elapsedTime?: number; // ⏱️ [정밀 연결] 타이머 맥동 수신
}

// ⏱️ 시간 형식화 도우미 (MM:SS)
const formatTimer = (seconds: number): string => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

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
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="15" y1="9" x2="9" y2="15"></line>
    <line x1="9" y1="9" x2="15" y2="15"></line>
  </svg>
);

const IconChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const IconEye = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

const IconEyeOff = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
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
  onRemoveItems,
  canExecute = false,
  disabledReason = null,
  onExecute = () => { },
  progressPercent = 0,
  executionLogs = [],
  isProcessing = false,
  elapsedTime = 0
}) => {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // 📂 [신규] 내부 파일 리스트 모드용 상태 엔진
  const [viewingInternalPath, setViewingInternalPath] = useState<string | null>(null);
  const [internalPages, setInternalPages] = useState<any[]>([]);
  const [selectedInternalIndices, setSelectedInternalIndices] = useState<Set<number>>(new Set()); // 🎯 [신규] 내부 리스트 개별 행 선택 추적기!
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null); // 🖼️ [신규] 내부 이미지 미리보기 메모리 주소 보관소!

  // 🧹 [초기화] 외부 파일 목록이 바뀌거나 화면 모드가 바뀌면 즉시 내부 보기 탈출 및 선택/프리뷰 해제!
  useEffect(() => {
    setViewingInternalPath(null);
    setInternalPages([]);
    setSelectedInternalIndices(new Set());

    if (previewImageUrl) {
      URL.revokeObjectURL(previewImageUrl);
      setPreviewImageUrl(null);
    }
  }, [items, mode]);

  const handleViewInternalList = async (filePath: string) => {
    // 🔄 [토글 매커니즘] 이미 펼쳐져 있다면 닫고 종료하여 유연한 작동 보장!
    if (viewingInternalPath === filePath) {
      setViewingInternalPath(null);
      setInternalPages([]);
      return;
    }

    try {
      // ⏳ [시각적 피드백] 데이터 파싱 개시 즉시 전체 커서를 대기 상태(Wait)로 치환!
      document.body.classList.add('is-processing');

      const appApi = (window as any).appApi;
      if (!appApi || typeof appApi.openZip !== 'function') return;

      const result = await appApi.openZip(filePath);
      if (result.ok) {
        setInternalPages(result.data.pages);
        setViewingInternalPath(filePath);
      } else {
        alert(`내부 파일을 불러오는데 실패했습니다.\n${result.error?.message || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('[System] Failed to load internal archive list:', error);
    } finally {
      // 🏁 [임무 완수] 작업 종료 즉시 대기 해제, 커서 정상화!
      document.body.classList.remove('is-processing');
    }
  };

  // 📐 게이지 수학 계산 (Radius 40)
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progressPercent / 100) * circ;


  // 🎛️ New Interaction States
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number }>({
    visible: false,
    x: 0,
    y: 0
  });

  const terminalRef = useRef<HTMLDivElement>(null);

  // 📜 [자동 스크롤 매직] 로그가 갱신될 때마다 바닥으로 강제 스크롤 (ConverterOptions와 통일!)
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [executionLogs]);

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

  // 🎯 [신규] 내부 파일 행 클릭/선택 엔진
  const handleInternalRowClick = (pageIndex: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 부모 클릭으로 상위 전파 차단

    setSelectedInternalIndices((prev) => {
      const next = new Set(prev);
      if (e.ctrlKey || e.metaKey) {
        if (next.has(pageIndex)) next.delete(pageIndex);
        else next.add(pageIndex);
      } else {
        if (next.has(pageIndex) && next.size === 1) {
          next.clear();
        } else {
          next.clear();
          next.add(pageIndex);
        }
      }
      return next;
    });
  };

  // 🖼️ [신규] 내부 이미지 고속 미리보기 핸들러!
  const handleInternalRowDoubleClick = async (page: any) => {
    if (!viewingInternalPath) return;

    try {
      const appApi = (window as any).appApi;
      if (!appApi || typeof appApi.getPage !== 'function') return;

      // 🛸 백엔드 API를 통해 원본 이미지 버퍼 즉각 탈환!
      const response = await appApi.getPage(viewingInternalPath, page.entryName);
      if (response.ok && response.data) {
        const { bytes, mimeType } = response.data;

        // 🧹 이전 메모리 객체는 즉시 소거하여 메모리 누수 방지벽 구축!
        if (previewImageUrl) {
          URL.revokeObjectURL(previewImageUrl);
        }

        // 🧬 고속 네이티브 Blob 생성으로 제로 레이턴시 화상 노출!
        const blob = new Blob([bytes], { type: mimeType || 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        setPreviewImageUrl(url);
      }
    } catch (error) {
      console.error('Failed to load internal image preview:', error);
    }
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
    () => items.reduce((sum, item) => {
      const val = item.uncompressedSizeBytes ?? item.sizeBytes;
      return sum + (typeof val === 'number' ? val : 0);
    }, 0),
    [items]
  );
  const knownTotalPages = useMemo(
    () => items.reduce((sum, item) => sum + (typeof item.totalPages === 'number' ? item.totalPages : 0), 0),
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

  // 🎹 [글로벌 키보드 액셀러레이터] 엔터 키로 초신속 프리뷰/진입 발동!
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 🚫 인풋 박스나 콤보박스 활성 시에는 시스템 본연의 동작 보존!
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      // 🔓 [실행 보조] 엔터 키 핸들링
      if (e.key === 'Enter') {
        // 🔥 시나리오 1: 내부 리스트 탐색 중일 때 (이미지 퀵 프리뷰!)
        if (viewingInternalPath && internalPages.length > 0 && selectedInternalIndices.size > 0) {
          e.preventDefault();
          // 선택된 항목들 중 가장 상단(첫 번째) 항목을 픽업!
          const firstIdx = Array.from(selectedInternalIndices).sort((a, b) => a - b)[0];
          const page = internalPages[firstIdx];
          if (page) {
            void handleInternalRowDoubleClick(page);
          }
          return;
        }

        // 📦 시나리오 2: 외부 리스트 탐색 중일 때 (아카이브 내부 파고들기!)
        if (mode === 'split' && !viewingInternalPath && selectedPaths.size === 1) {
          e.preventDefault();
          const rootPath = Array.from(selectedPaths)[0];
          void handleViewInternalList(rootPath);
          return;
        }
      }

      // 🧭 [광역 항해 엔진] 리스트 방향키 & 페이지 업다운 이동 통합 지원!
      const isArrowDown = e.key === 'ArrowDown';
      const isArrowUp = e.key === 'ArrowUp';
      const isPageDown = e.key === 'PageDown';
      const isPageUp = e.key === 'PageUp';

      if (isArrowDown || isArrowUp || isPageDown || isPageUp) {
        e.preventDefault();
        const isForward = isArrowDown || isPageDown;
        // 페이지 단위는 통상적인 리스트 점프 감성(10단위) 적용!
        const jumpStep = (isPageDown || isPageUp) ? 10 : 1;

        // 🟢 A단계: 내부 리스트 모드에서의 내비게이션
        if (viewingInternalPath && internalPages.length > 0) {
          setSelectedInternalIndices((prev) => {
            let nextIdx = 0;
            if (prev.size === 0) {
              nextIdx = isForward ? 0 : internalPages.length - 1;
            } else {
              const arr = Array.from(prev).sort((a, b) => a - b);
              // 진행 방향에 따라 끝단 앵커 피벗 설정
              const pivot = isForward ? arr[arr.length - 1] : arr[0];
              const finalStep = isForward ? jumpStep : -jumpStep;
              nextIdx = Math.max(0, Math.min(internalPages.length - 1, pivot + finalStep));
            }
            return new Set([nextIdx]);
          });

          // 🏎️ 초정밀 뷰포트 추적
          setTimeout(() => {
            const elements = document.querySelectorAll('.converter-item-row.selected');
            const activeTarget = elements[elements.length - 1];
            activeTarget?.scrollIntoView({ block: 'nearest' });
          }, 10);
          return;
        }

        // 🟣 B단계: 외부(루트) 아카이브 목록에서의 내비게이션
        if (!viewingInternalPath && sortedItems.length > 0) {
          let nextIdx = 0;
          const selectedArr = Array.from(selectedPaths);

          if (selectedArr.length === 0) {
            nextIdx = isForward ? 0 : sortedItems.length - 1;
          } else {
            // 기존 선택 목록 중 진행방향에 가장 가까운 피벗 경로 획득
            const pivotPath = isForward ? selectedArr[selectedArr.length - 1] : selectedArr[0];
            const pivotPos = sortedItems.findIndex(i => i.path === pivotPath);

            // 안전 밸브: 찾을 수 없는 경우 첫단/끝단으로 부드러운 복귀
            const basePos = pivotPos === -1 ? (isForward ? -1 : sortedItems.length) : pivotPos;
            const finalStep = isForward ? jumpStep : -jumpStep;
            nextIdx = Math.max(0, Math.min(sortedItems.length - 1, basePos + finalStep));
          }

          const targetPath = sortedItems[nextIdx].path;
          onToggleSelection(new Set([targetPath]));

          // 뷰포트 추적
          setTimeout(() => {
            const elements = document.querySelectorAll('.converter-item-row.selected');
            elements[elements.length - 1]?.scrollIntoView({ block: 'nearest' });
          }, 10);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    viewingInternalPath,
    internalPages,
    selectedInternalIndices,
    selectedPaths,
    mode,
    handleInternalRowDoubleClick,
    handleViewInternalList,
    sortedItems,
    onToggleSelection,
    setSelectedInternalIndices
  ]);

  // 🧬 Shared Menu Content Blueprint
  const renderMenuItems = (closeSource: () => void) => {
    const isSingle = selectedPaths.size === 1;
    const targetPath = isSingle ? Array.from(selectedPaths)[0] : null;
    const isOpen = targetPath ? viewingInternalPath === targetPath : false;

    // 🎯 실행 가능 조건 규격화
    const canToggleList = mode === 'split' && isSingle && !!targetPath;

    return (
      <>
        <div className="converter-dropdown-title">목록 편집</div>

        {/* 🔮 [컨텍스트 고정] 숨김 대신 '비활성화' 처리하여 항상 유저 인지 가능하도록 구현! */}
        {mode === 'split' && (
          <>
            <button
              className="converter-dropdown-item"
              style={canToggleList ? { color: 'var(--accent)', fontWeight: 600 } : {}}
              disabled={!canToggleList}
              title={!canToggleList ? "대상을 하나 선택해야 리스트를 볼 수 있습니다." : ""}
              onClick={() => {
                if (targetPath) {
                  handleViewInternalList(targetPath);
                  closeSource();
                }
              }}
            >
              {isOpen ? <IconEyeOff /> : <IconEye />}
              <span>{isOpen ? '리스트 닫기' : '리스트 보기'}</span>
            </button>
            <div className="converter-dropdown-divider" />
          </>
        )}

        <button
          className="converter-dropdown-item"
          onClick={() => { onAdd(); closeSource(); }}
        >
          <IconPlus /> <span>+ Add</span>
        </button>

        <div className="converter-dropdown-divider" />

        <button
          className="converter-dropdown-item"
          disabled={mode === 'split' || !hasSidebarItems}
          title={mode === 'split' ? "분할 모드에서는 다중 추가가 비활성화됩니다." : ""}
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

        {/* 🗑️ [중복 제거] 분할 모드에서는 Clear 버튼만으로 충분하므로 Delete(Redundant) 숨김 처리! */}
        {mode !== 'split' && (
          <>
            <div className="converter-dropdown-divider" />
            <button
              className="converter-dropdown-item danger"
              disabled={selectedPaths.size === 0}
              onClick={handleBatchDelete}
            >
              <IconTrash /> <span>Delete ({selectedPaths.size})</span>
            </button>
          </>
        )}
      </>
    );
  };

  const activeViewingItem = viewingInternalPath ? items.find((i) => i.path === viewingInternalPath) : null;

  return (
    <section
      className="converter-section converter-file-list-section"
      style={{
        width: '420px',
        height: '580px',
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
    >
      <div className="converter-file-list-header">
        <h3 className="converter-section-title">
          {mode === 'merge' ? '입력 파일 목록' : (
            <>
              <span
                title={activeViewingItem?.name}
                style={activeViewingItem ? {
                  maxWidth: '320px',
                  display: 'inline-block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  verticalAlign: 'bottom'
                } : {}}
              >
                {activeViewingItem?.name || '대상 파일'}
              </span>
              {activeViewingItem && (
                <span style={{ fontWeight: 'normal', opacity: 0.8, marginLeft: '6px' }}>
                  - 내부리스트
                </span>
              )}
            </>
          )}
        </h3>
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
        <EmptyState
          height={100}
          onContextMenu={(e) => handleOpenContextMenu(e)}
        >
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
            {mode === 'merge' ? '병합할 파일을 순서대로 추가하세요.' : '분할할 파일 1개를 선택하세요.'}
          </p>
          <EmptyStateHelpLine>- 사이드바 목록에서 햄버거 메뉴의 [Add All] 사용</EmptyStateHelpLine>
          <EmptyStateHelpLine>- 사이드바 파일 클릭: 입력 목록에 추가/제거</EmptyStateHelpLine>
          <EmptyStateHelpLine>- [+ Add]: 탐색기에서 직접 파일 추가</EmptyStateHelpLine>
          <EmptyStateHelpLine>- 행 선택 후 [Delete]: 선택한 파일 목록 제거</EmptyStateHelpLine>
          {mode === 'split' && (
            <EmptyStateHelpLine style={{ color: 'var(--accent)', fontWeight: 600 }}>
              - 파일 더블 클릭: 내부 구성 계층 열기 / 닫기
            </EmptyStateHelpLine>
          )}
        </EmptyState>
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
              const isExpanded = viewingInternalPath === item.path;

              return (
                <React.Fragment key={item.path}>
                  <div
                    className={`converter-item-row ${isSelected ? 'selected' : ''} ${isExpanded ? 'is-expanded-parent' : ''}`}
                    title={`${item.path}\n클릭하여 선택 (더블 클릭 시 ${mode === 'split' ? '내부 파일 열기/닫기' : '삭제'})`}
                    onClick={(e) => handleRowClick(item.path, e)}
                    onDoubleClick={() => {
                      if (mode === 'split') {
                        void handleViewInternalList(item.path);
                      } else {
                        onRemoveItems([item.path]);
                      }
                    }}
                    onContextMenu={(e) => handleOpenContextMenu(e, item.path)} // Item-specific context menu + auto-select
                    style={isExpanded ? {
                      borderLeft: '3px solid var(--accent)',
                      backgroundColor: 'var(--bg-base)', // 🛡️ [완벽 불투명화] 하위 항목 스크롤 침입 차단!
                      backgroundImage: 'linear-gradient(rgba(255, 107, 0, 0.08), rgba(255, 107, 0, 0.08))', // 🎨 기존 테마 조화
                      position: 'sticky',
                      top: 0,
                      zIndex: 10, // 🛸 다른 행들을 뚫고 올라오는 고정 좌석 권한 부여!
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)', // 🧱 떠있는 레이어임을 알리는 입체 그림자
                      borderBottom: '1px solid rgba(255, 107, 0, 0.2)' // 📐 하단 경계선 명확화
                    } : {}}
                  >
                    <span className="converter-item-index">{mode === 'split' ? '' : index + 1}</span>
                    <span className="converter-item-name" style={{ fontWeight: isExpanded ? '700' : 'inherit', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{isExpanded ? '📂 ' : ''}{item.name}</span>
                      {typeof item.totalPages === 'number' && (
                        <span style={{
                          fontWeight: '500',
                          fontSize: '0.75rem',
                          color: 'var(--accent)',
                          opacity: 0.85,
                          background: 'rgba(255,107,0,0.06)',
                          border: '1px solid rgba(255,107,0,0.25)',
                          padding: '0px 5px',
                          borderRadius: '3px',
                          whiteSpace: 'nowrap'
                        }}>
                          {item.totalPages} 쪽
                        </span>
                      )}
                    </span>
                    <span
                      className="converter-item-size"
                      title={item.uncompressedSizeBytes ? `원본 내용량: ${formatSize(item.uncompressedSizeBytes)} (압축 파일: ${formatSize(item.sizeBytes)})` : undefined}
                    >
                      {formatSize(item.uncompressedSizeBytes ?? item.sizeBytes)}
                    </span>
                  </div>

                  {/* 🌳 [계단식 트리] 분할 모드 전용 중첩 자식 리스트 렌더링! */}
                  {isExpanded && internalPages.length > 0 && (
                    <div className="converter-nested-items-container" style={{
                      // 🔥 [컬럼 사수대] 그리드 파괴범 '전체 여백'을 박멸하여 상단 컬럼과 자와 같이 정렬!
                      backgroundColor: 'rgba(0,0,0,0.15)',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                      {internalPages.map((page, pIdx) => {
                        const isPageSelected = selectedInternalIndices.has(pIdx);

                        return (
                          <div
                            key={`${item.path}-page-${pIdx}`}
                            className={`converter-item-row ${isPageSelected ? 'selected' : ''}`}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                              cursor: 'pointer' /* 🖱️ 손가락 커서 장착! */
                            }}
                            title={page.entryName}
                            onClick={(e) => handleInternalRowClick(pIdx, e)}
                            onDoubleClick={() => void handleInternalRowDoubleClick(page)} /* 🛸 [최신 패치] 더블 클릭 시 즉각 화상 송출! */
                          >
                            <span
                              className="converter-item-index"
                              style={{
                                color: 'var(--text-dim)',
                                borderLeft: '3px solid rgba(255, 107, 0, 0.3)', // 🪜 트리 정체성은 기둥 하나로 완벽 구현!
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%'
                              }}
                            >
                              {pIdx + 1}
                            </span>
                            <span className="converter-item-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '18px' }}>
                              {/* 🎯 내용물만 살짝 밀어서 계층감은 유지하고 컬럼 라인은 100% 직결! */}
                              📄 {page.displayName || page.entryName}
                            </span>
                            <span className="converter-item-size" style={{ opacity: 0.7, fontSize: '0.85rem' }}>
                              {formatSize(page.sizeBytes)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          {mode === 'merge' && (
            <div className="converter-item-footer">
              <div className="converter-item-footer-text">
                <span className="converter-item-footer-label">예상 출력({outputFormat.toUpperCase()}, 압축률 추정)</span>
                <span className="converter-item-footer-sub">
                  압축 정책: {effectivePolicy === 'store' ? '무압축' : '압축 적용'}
                  {compressionPolicy === 'auto' ? ' (자동)' : ' (수동)'}
                </span>
                <span className="converter-item-footer-sub">입력 합계(원본): {formatSize(knownTotalSize)} ({knownTotalPages} 쪽)</span>
              </div>
              <span className="converter-item-footer-value">{expectedSizeText}</span>
            </div>
          )}
        </div>
      )}

      {/* 🚀 [마스터 대시보드 V2] 이제 병합/분할 공용으로 좌측 하단에 황금비 관제탑 배치! */}
      <div className="converter-console-layout">
        {/* 🎮 좌측 (1/3): 실행 버튼 & 사이버네틱 타이머 */}
        <div className="console-control-column">
          {/* 🎁 [구조 개선] 버튼 전용 박스를 신설하여 게이지 박스와 완벽한 상하 구조적 동형성 구현! */}
          <div className="console-btn-wrapper">
            <button
              className={`primary-btn converter-execute-btn ${isProcessing ? 'processing' : ''}`}
              type="button"
              disabled={!canExecute}
              title={(!canExecute && disabledReason) ? disabledReason : undefined}
              onClick={onExecute}
              style={{ borderRadius: '8px', height: '27px' }}
            >
              <span className="btn-label-text" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                {isProcessing ? '중지' : mode === 'merge' ? '병합 실행' : '분할 실행'}
              </span>
            </button>
          </div>

          <div className="console-gauge-wrapper">
            <div className="console-gauge-container" style={{ width: '80px', height: '80px' }}>
              <svg className="gauge-svg" viewBox="0 0 100 100">
                <circle className="gauge-track" cx="50" cy="50" r={r} />
                <circle
                  className={`gauge-fill ${isProcessing ? 'pulsing' : ''}`}
                  cx="50" cy="50" r={r}
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                />
              </svg>
              <div className="gauge-center-content">
                <span className="gauge-percent-text" style={{ fontSize: '0.7rem', fontWeight: '500' }}>
                  {elapsedTime > 0 ? (progressPercent / elapsedTime).toFixed(1) : '0.0'}%/sec
                </span>
                {isProcessing && (
                  <span className="gauge-timer-text" style={{ fontSize: '0.6rem', fontWeight: '400' }}>{formatTimer(elapsedTime)}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 📟 우측 (2/3): 광활한 로그 터미널 */}
        {/* 📟 우측 (2/3): 광활한 로그 터미널 + 미디어 미리보기 통합 보드 */}
        <div className="console-log-column">
          <div className="converter-terminal-panel" style={{ position: 'relative', overflow: 'hidden' }}>

            {/* 🖼️ [스마트 프리뷰 엔진] 프로세싱이 아닐 때 더블클릭 이미지가 오면 로그판을 이미지 캔버스로 즉각 변환! */}
            {(!isProcessing && previewImageUrl) ? (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px',
                position: 'relative'
              }}>
                <img
                  src={previewImageUrl || undefined}
                  alt="Preview"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                />
                <button
                  type="button"
                  style={{
                    position: 'absolute', top: '8px', right: '8px', width: '24px', height: '24px',
                    background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    fontSize: '12px', backdropFilter: 'blur(4px)', zIndex: 5, fontWeight: 'bold'
                  }}
                  title="닫기"
                  onClick={() => setPreviewImageUrl(null)}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="terminal-logs-container" ref={terminalRef}>
                {executionLogs.length === 0 ? (
                  <div className="terminal-log-line" style={{ opacity: 0.4 }}>
                    [SYSTEM] 명령 대기 중...
                  </div>
                ) : (
                  executionLogs.map((log, idx) => (
                    <div key={idx} className="terminal-log-line">
                      {log}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>


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