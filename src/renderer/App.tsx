import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// 📦 모듈화된 명품 부품들 소환
import { FloatingAnchor } from './components/layout/FloatingAnchor';
import { Sidebar } from './components/layout/Sidebar';
import { ViewerCanvas } from './components/layout/ViewerCanvas';
import { ConverterPanel } from './components/layout/ConverterPanel';
import type { ConverterSourceItem } from './components/layout/ConverterPanel';
import { TitleBarControls } from './components/layout/TitleBarControls';
import type { ConverterMode } from './components/layout/ConverterPanel'; // 🚀 [신규] 모드 상태 상위 격상
import { ContextMenu } from './components/ui/ContextMenu'; // 🌌 [신규] 우클릭 부품
import { StatusBar } from './components/layout/StatusBar'; // 🌌 [신규] 실시간 현황판

// 🛠️ [신규] 파일 경로 및 시리즈 매칭 헬퍼 유틸리티
// 🛠️ [특수강화] 시리즈 식별 고도화 엔진 (숫자 범위 '001-026', 괄호 주석 등 완벽 정복)
const getSeriesKeyFromName = (fileName: string): string => {
  let key = fileName.replace(/\.[^.]+$/, '').toLowerCase().trim();
  
  // 1. (버전명), [공유] 등의 괄호 수식어가 맨 뒤에 있을 경우 재귀적으로 전부 박살냄
  while (true) {
    const prev = key;
    key = key.replace(/\s*[([][^)\]]*[)\]]\s*$/, '').trim();
    if (key === prev) break;
  }

  // 2. [초광역 레인지 대응] 권차 표시 제거 (예: 01, 001-026, 1부, 1권, Vol.2)
  // 꼬리 부분의 숫자, 하이픈/물결 조합 범위, 단위 명사까지 일망타진!
  key = key.replace(/[\s._-]*(v|vol\.?)?[\s._-]*\d+([\s._~-]+\d+)*[\s가-힣a-z]*$/i, '').trim();

  // 3. 잔류 꼬리 기호 정리
  key = key.replace(/[\s._-]+$/, '').trim();
  
  return key || fileName.replace(/\.[^.]+$/, '').toLowerCase().trim();
};

interface ViewerPage {
  index: number;
  entryName: string;
  displayName: string;
  zipPath: string; // [핵심] 어느 파일 출신인지 각인!
}

const VIEW_MODE_STORAGE_KEY = 'mtc:viewMode';
const PAGE_MEMORY_STORAGE_KEY = 'mtc:lastPageByPath';
const THEME_MODE_STORAGE_KEY = 'mtc:themeMode';
type ThemeMode = 'default' | 'light' | 'dark' | 'system';
type WorkspaceMode = 'viewer' | 'converter';

function readSavedViewMode(): '1' | '2' {
  const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return saved === '2' ? '2' : '1';
}

function readSavedPageMemory(): Record<string, number> {
  try {
    const raw = localStorage.getItem(PAGE_MEMORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, number>;
  } catch {
    return {};
  }
}

function readSavedThemeMode(): ThemeMode {
  const saved = localStorage.getItem(THEME_MODE_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system' || saved === 'default') {
    return saved;
  }
  return 'default';
}

function App() {
  // 🚥 메인 레이아웃 및 콘텐츠 상태
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isSidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  const [converterStatusText, setConverterStatusText] = useState<string>(''); // 📡 [신규] 컨버터 전용 상태 메시지 저장소
  const [converterMode, setConverterMode] = useState<ConverterMode>('merge'); // 🚀 [격상] 컨버터 통합 관제 모드
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('viewer');
  const [isAppLoading, setIsAppLoading] = useState(false); // 🛡️ [유저 고안] 철통 보안 마이크로 락 스테이트!
  const [autoMoveNotice, setAutoMoveNotice] = useState<string | null>(null);
  const autoMoveNoticeTimerRef = useRef<number | null>(null);
  
  // 🛡️ [영속화 방어막] 초기 백엔드 로딩이 끝날 때까지 자동 저장을 일시 봉쇄하는 특수 가드!
  const isSettingsLoadedRef = useRef(false);
  
  // 🎬 [신규] 콘텐츠 시연 모드 및 뷰 모드(1쪽/2쪽) 추적기 탑재!
  const [hasActiveFile, setHasActiveFile] = useState(false);
  const [viewMode, setViewMode] = useState<'1' | '2'>(() => readSavedViewMode()); // 기본값: 저장값 우선
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readSavedThemeMode());
  const [imageFitMode, setImageFitMode] = useState<'auto' | 'actual' | 'width' | 'height'>('auto'); // 🔍 [신규] 스케일 추적기 탑재!

  // 🧬 [신규] 진짜 데이터 로딩을 위한 생명줄!
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null); // 💡 [신규] 단순 시각적 선택용 하이라이트 상태 추가!
  const [pages, setPages] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pageMemoryByPath, setPageMemoryByPath] = useState<Record<string, number>>(() => readSavedPageMemory());

  // 📚 [신규] (같은책) 묶음 로딩 모드 및 라이브러리 항목
  const [loadSameBook, setLoadSameBook] = useState(true);
  const [libraryItems, setLibraryItems] = useState<ConverterSourceItem[]>([]);
  const [libraryFolderName, setLibraryFolderName] = useState<string | null>(null); // 📂 라이브러리 루트 폴더명
  const [converterSourceItems, setConverterSourceItems] = useState<ConverterSourceItem[]>([]);
  const [selectedConverterPaths, setSelectedConverterPaths] = useState<Set<string>>(new Set());

  // 📍 [신규] 컨텍스트 메뉴 좌표 및 활성화 상태
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean }>({
    x: 0, y: 0, show: false
  });

  // 📏 사이드바 가변 너비 상태
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);

  // --- 🛠️ 리사이저 로직 ---
  const startResizing = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      // 🛡️ [최종 조율] 230px로 한계선 확정!
      const newWidth = Math.min(Math.max(e.clientX, 230), 600);
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // --- 💡 핸들러 모음 ---
  const toggleSidebarMenu = () => {
    if (!isSidebarOpen && !isSidebarMenuOpen) setSidebarOpen(true);
    setSidebarMenuOpen(!isSidebarMenuOpen);
  };

  // 🛡️ 우클릭 차단 및 활성화 로직
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!hasActiveFile) return; // 🛑 이미지가 없으면 철저하게 무시!
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      show: true
    });
  };

  // 📂 [핵심 헬퍼] 단일 압축파일을 통째로 뷰어 레일에 장전!
  // 🚀 [업그레이드] initialIndex를 받아 책 전환 시 특정 페이지(예: -1이면 마지막) 착륙 지원!
  const loadZipIntoViewer = async (filePath: string, initialIndex?: number) => {
    setIsAppLoading(true); // 🚨 [방어선 구축] 로딩 시작 즉시 전방위 클릭 차단막 가동!
    
    // ⚡ 즉각적인 시각적 피드백 보장
    setZipPath(filePath);
    setSelectedPath(filePath); 
    
    try {
      const appApi = (window as any).appApi;
      const openResult = await appApi.openZip(filePath);
      if (openResult.ok) {
        const loadedPages = openResult.data.pages;
        setPages(loadedPages);
        
        // 🎯 착륙 지점 보정: 명시된 인덱스 > 저장된 마지막 페이지 > 0
        let targetIdx = 0;
        if (initialIndex === -1) {
          targetIdx = Math.max(0, loadedPages.length - 1);
        } else if (typeof initialIndex === 'number') {
          targetIdx = initialIndex;
        } else {
          targetIdx = pageMemoryByPath[filePath] ?? 0;
        }
        targetIdx = Math.max(0, Math.min(targetIdx, Math.max(0, loadedPages.length - 1)));
        setCurrentIndex(targetIdx);
        
        setHasActiveFile(true);
        return true;
      } else {
        alert(`[에러] 파일을 열 수 없습니다.\n${openResult.error?.message || 'Unknown error'}`);
        return false;
      }
    } catch (err) {
      console.error(err);
      return false;
    } finally {
      setIsAppLoading(false); // 🏳️ [방어선 해제] 작전 완료! 즉시 통행 재개!
    }
  };

  // 🚀 [백엔드 마스터 로더] 앱 구동 즉시 디스크 금고에서 최후의 설정을 가져와 투입합니다.
  useEffect(() => {
    const bootstrapSettings = async () => {
      try {
        const appApi = (window as any).appApi;
        if (!appApi?.getAppSettings) return;
        
        const settings = await appApi.getAppSettings();
        if (settings) {
          // 1:1 매핑 주입 및 복원
          if (typeof settings.sidebarWidth === 'number') setSidebarWidth(settings.sidebarWidth);
          if (typeof settings.showSidebarList === 'boolean') setSidebarOpen(settings.showSidebarList);
          if (settings.theme) {
            setThemeMode(settings.theme as ThemeMode);
            document.documentElement.setAttribute('data-theme', settings.theme);
          }
          if (settings.pageViewMode) setViewMode(settings.pageViewMode === 'double' ? '2' : '1');
          if (settings.imageFitMode) setImageFitMode(settings.imageFitMode);
        }
      } catch (err) {
        console.error('[Settings] Failed to restore saved settings from backend:', err);
      } finally {
        // 🔓 복원 완료! 이제부터 발생하는 모든 변화는 기록할 가치가 있습니다.
        isSettingsLoadedRef.current = true;
      }
    };
    bootstrapSettings();
  }, []);

  // 📡 [오토세이브 엔진] 주요 설정값 변동 즉시 백엔드 원장에 영구 타각!
  useEffect(() => {
    // 🛡️ 아직 불러오기 전이라면 덮어쓰기 참사를 막기 위해 셔터 내림
    if (!isSettingsLoadedRef.current) return;
    
    const appApi = (window as any).appApi;
    if (!appApi?.updateAppSettings) return;
    
    const payload = {
      sidebarWidth,
      showSidebarList: isSidebarOpen,
      theme: themeMode,
      pageViewMode: viewMode === '2' ? 'double' : 'single' as 'single' | 'double',
      imageFitMode
    };
    
    // 화면 갱신을 위한 사이드 이펙트 수행 (테마 등)
    document.documentElement.setAttribute('data-theme', themeMode);
    
    // 비동기 저장 요청 발신
    appApi.updateAppSettings(payload).catch((err: any) => {
      console.error('[Settings] Persistent auto-save failed:', err);
    });
  }, [sidebarWidth, isSidebarOpen, themeMode, viewMode, imageFitMode]);

  useEffect(() => {
    localStorage.setItem(PAGE_MEMORY_STORAGE_KEY, JSON.stringify(pageMemoryByPath));
  }, [pageMemoryByPath]);

  useEffect(() => {
    if (!zipPath || !hasActiveFile || pages.length === 0) return;
    setPageMemoryByPath((prev) => {
      if (prev[zipPath] === currentIndex) return prev;
      return { ...prev, [zipPath]: currentIndex };
    });
  }, [zipPath, currentIndex, hasActiveFile, pages.length]);

  // 📂 [핵심] 진짜 파일 열기 실전 배치!!
  const handleOpenFileClick = async () => {
    try {
      const appApi = (window as any).appApi;
      // 1. 🪟 OS 기본 다이얼로그 호출
      const filePath = await appApi.openFileDialog({
        title: '작품 열기',
        zipFilterName: 'ZIP 압축파일',
        imageFilterName: '이미지 파일'
      });

      if (!filePath) return; // 캔슬시 조용히 귀환

      // 🚀 뷰어에는 선택한 파일 '하나'만 고고하게 적재!
      const loaded = await loadZipIntoViewer(filePath);
      if (!loaded) return;

      const fileName = await appApi.getBasename(filePath);

      // ⚡ [신규] (같은책) 체크 시, 나머지를 라이브러리에만 든든하게 적치!
      if (loadSameBook) {
        const dirPath = await appApi.getDirectory(filePath);
        console.log('[System] Listing files in:', dirPath);
        const listResult = await appApi.listFolderItems(dirPath);
        if (listResult.ok) {
          const currentKey = getSeriesKeyFromName(fileName);
          console.log('[System] Matched Series Key:', currentKey);
          
          const siblings = (listResult.data as any[])
            .filter((item) => (item.type === 'zip' || item.type === 'archive') && getSeriesKeyFromName(item.name) === currentKey)
            .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
          
          console.log('[System] Filtered Library Items:', siblings);
          setLibraryItems(siblings);

          // 🤝 [핵심 규칙] 시리즈 형제가 1개 이상이면 상위 '진짜 폴더명'을 헤더로 하사!
          if (siblings.length > 1) {
            const parentFolderName = await appApi.getBasename(dirPath);
            setLibraryFolderName(parentFolderName);
          } else {
            setLibraryFolderName(null);
          }
        } else {
          console.error('[System] Failed to list folder items:', listResult.error);
        }
      } else {
        // 단일 모드면 라이브러리엔 본인 하나만 존재감 있게 표시
        setLibraryItems([{ name: fileName, path: filePath, type: 'zip' }]);
        setLibraryFolderName(null); // 단일 파일은 폴더 헤더 불필요
      }

      setSidebarMenuOpen(false); // 기분 좋게 메뉴 닫기!
    } catch (err: any) {
      console.error("Failed to open file:", err);
      alert("치명적 오류가 발생했습니다.");
    }
  };

  // 📂 [1.0 복제이식] 진짜 폴더 열기 기능 소환!!
  const handleOpenFolderClick = async () => {
    try {
      const appApi = (window as any).appApi;
      if (!appApi || typeof appApi.openFolderDialog !== 'function') {
        alert("[오류] appApi.openFolderDialog 엔진을 찾을 수 없습니다.");
        return;
      }
      const folderPath = await appApi.openFolderDialog('폴더 열기');
      if (!folderPath) return;

      const result = await appApi.listFolderItems(folderPath);
      if (result.ok) {
        console.log('[System] Loaded Folder Items:', result.data);
        const items = (result.data as any[]).sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
        setLibraryItems(items);
        
        // 📂 폴더명 추출하여 라이브러리 대장으로 임명!
        const folderName = await appApi.getBasename(folderPath);
        setLibraryFolderName(folderName);
        
        setSidebarOpen(true); // 폴더 열었으니 사이드바 당당히 공개!
      } else {
        alert(`[에러] 폴더를 읽을 수 없습니다.\n${result.error?.message || ''}`);
      }
      setSidebarMenuOpen(false);
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  };

  // 🗺️ [신규] 현재 열린 파일의 라이브러리 내 위치 추적
  const getBookPositionHint = () => {
    if (!zipPath || libraryItems.length <= 1) return null;
    const currentIndex = libraryItems.findIndex(item => item.path === zipPath);
    if (currentIndex === -1) return null;
    
    if (currentIndex === 0) return "처음";
    if (currentIndex === libraryItems.length - 1) return "끝";
    return null; // 중간은 비워둠
  };

  // 📚 사이드바 라이브러리 항목 클릭 핸들러
  const handleLibraryItemClick = async (filePath: string) => {
    const item = libraryItems.find((candidate) => candidate.path === filePath);
    if (!item) return;

    if (workspaceMode === 'converter') {
      const appApi = (window as any).appApi;
      let normalizedItem = item;
      const needsSize = typeof normalizedItem.sizeBytes !== 'number';
      const needsPages = typeof normalizedItem.totalPages !== 'number';
      const needsUncompressed = typeof normalizedItem.uncompressedSizeBytes !== 'number';

      if (needsSize || needsPages || needsUncompressed) {
        try {
          let { sizeBytes, totalPages, uncompressedSizeBytes } = normalizedItem;
          if (needsSize) sizeBytes = await appApi.getFileSize(filePath);
          if (needsPages || needsUncompressed) {
            if (normalizedItem.type === 'image') {
              totalPages = 1;
              uncompressedSizeBytes = sizeBytes;
            } else {
              const info = await appApi.openZip(filePath);
              totalPages = info?.data?.meta?.totalPages ?? 0;
              uncompressedSizeBytes = info?.data?.meta?.totalUncompressedSizeBytes ?? sizeBytes;
            }
          }
          normalizedItem = { ...normalizedItem, sizeBytes, totalPages, uncompressedSizeBytes };
          setLibraryItems((prev) => prev.map((entry) => (entry.path === filePath ? normalizedItem : entry)));
        } catch (error) {
          console.error('Failed to resolve metadata from sidebar item', error);
        }
      }

      setConverterSourceItems((prev) => {
        if (converterMode === 'split') {
          // [분할 모드 칙령] 무조건 새로운 왕을 즉위시켜 단일 지배 체제 확립!
          return [normalizedItem];
        }
        const exists = prev.some((entry) => entry.path === filePath);
        if (exists) {
          return prev.filter((entry) => entry.path !== filePath);
        }
        return [...prev, normalizedItem];
      });
      return;
    }

    // 🚀 [완벽한 회귀] 유저 제안의 미학대로, 편안한 '1-클릭'으로 롤백하여 즉시 실행합니다!
    void loadZipIntoViewer(filePath); 
  };

  const handleAddConverterSource = async () => {
    try {
      const appApi = (window as any).appApi;
      let filePaths: string[] = [];
      const isSplitMode = converterMode === 'split';

      if (isSplitMode) {
        // [분할 전용] 단일 파일 선택 모드로 초고속 강제 전환!
        const picked = await appApi.openFileDialog({
          title: '분할 대상 파일 선택',
          zipFilterName: '압축/이미지 파일',
          imageFilterName: '이미지 파일'
        });
        if (!picked) return;
        filePaths = [picked];
      } else {
        // [병합 전용] 기존 멀티 셀렉션 레일 가동!
        if (typeof appApi.openFileDialogMulti === 'function') {
          const multi = await appApi.openFileDialogMulti({
            title: '컨버터 소스 추가',
            zipFilterName: '압축/이미지 파일',
            imageFilterName: '이미지 파일'
          });
          if (!multi || multi.length === 0) return;
          filePaths = multi;
        } else {
          // Fallback: preload hot-reload 전 구버전 런타임 호환
          const picked = await appApi.openFileDialog({
            title: '컨버터 소스 추가',
            zipFilterName: '압축/이미지 파일',
            imageFilterName: '이미지 파일',
            multiSelections: true
          });
          if (!picked) return;
          filePaths = Array.isArray(picked) ? picked : [picked];
        }
      }

      const items = await Promise.all(
        filePaths.map(async (filePath: string) => {
          const name = await appApi.getBasename(filePath);
          const sizeBytes = await appApi.getFileSize(filePath);
          const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
          const type = ['zip', 'cbz', '7z', 'rar'].includes(ext) ? 'archive' : 'image';
          let totalPages = 0;
          let uncompressedSizeBytes = sizeBytes;
          try {
            if (type === 'archive') {
              const info = await appApi.openZip(filePath);
              totalPages = info?.data?.meta?.totalPages ?? 0;
              uncompressedSizeBytes = info?.data?.meta?.totalUncompressedSizeBytes ?? sizeBytes;
            } else {
              totalPages = 1;
              uncompressedSizeBytes = sizeBytes;
            }
          } catch { totalPages = 0; }
          return { name, path: filePath, type, sizeBytes, totalPages, uncompressedSizeBytes } as ConverterSourceItem;
        })
      );

      setConverterSourceItems((prev) => {
        if (isSplitMode) {
          // [분할 모드 특권] 기존 리스트를 무조건 덮어쓰고 오직 '하나'만 왕좌에 안착!
          return items;
        }
        const existing = new Set(prev.map((entry) => entry.path));
        const next = [...prev];
        for (const item of items) {
          if (!existing.has(item.path)) {
            next.push(item);
          }
        }
        return next;
      });
      setWorkspaceMode('converter');
    } catch (error) {
      console.error('Failed to add converter source', error);
    }
  };

  const handleAddAllConverterSource = async () => {
    setWorkspaceMode('converter');
    const appApi = (window as any).appApi;

    const normalizedItems = await Promise.all(
      libraryItems.map(async (item) => {
        const needsSize = typeof item.sizeBytes !== 'number';
        const needsPages = typeof item.totalPages !== 'number';
        const needsUncompressed = typeof item.uncompressedSizeBytes !== 'number';
        if (!needsSize && !needsPages && !needsUncompressed) return item;

        try {
          let { sizeBytes, totalPages, uncompressedSizeBytes } = item;
          if (needsSize) sizeBytes = await appApi.getFileSize(item.path);
          if (needsPages || needsUncompressed) {
            if (item.type === 'image') {
              totalPages = 1;
              uncompressedSizeBytes = sizeBytes;
            } else {
              const info = await appApi.openZip(item.path);
              totalPages = info?.data?.meta?.totalPages ?? 0;
              uncompressedSizeBytes = info?.data?.meta?.totalUncompressedSizeBytes ?? sizeBytes;
            }
          }
          return { ...item, sizeBytes, totalPages, uncompressedSizeBytes };
        } catch (error) {
          console.error('Failed to resolve metadata for Add All item', error);
          return item;
        }
      })
    );

    setLibraryItems(normalizedItems);
    setConverterSourceItems(normalizedItems);
  };

  const handleClearConverterSource = () => {
    setConverterSourceItems([]);
    if (workspaceMode === 'converter') {
      setSelectedPath(null);
    }
  };

  // 🔄 [격상 연산] 상위에서 동작을 총괄하는 모드 통합 전환 핸들러!
  const handleConverterModeChange = (nextMode: ConverterMode) => {
    if (nextMode === converterMode) return;
    setConverterMode(nextMode);
    handleClearConverterSource(); // 🧹 변경 즉시 유기적 정제 발동!
  };

  const handleRemoveConverterSourceItems = (pathsToRemove: string[]) => {
    const removalSet = new Set(pathsToRemove);
    setConverterSourceItems((prev) => prev.filter((item) => !removalSet.has(item.path)));
    
    // 🎯 Also purge from global selection set!
    setSelectedConverterPaths(prev => {
      const next = new Set(prev);
      pathsToRemove.forEach(p => next.delete(p));
      return next;
    });
  };

  const handleDeleteSelectedConverterSources = () => {
    if (selectedConverterPaths.size === 0) return;
    handleRemoveConverterSourceItems(Array.from(selectedConverterPaths));
    // Note: Selection cleanup is handled inside the call above!
  };

  // 🎭 가상 파일 선택 시뮬레이터 (우선 유지하되 비활성 유도)
  const handleFileSelect = () => {
    // 향후 실데이터 로더로 대체 예정
    setHasActiveFile(true); 
  };

  // 🧭 [신규] 초고속 파일간 내비게이션 트래커 엔진
  const currentLibraryIndex = libraryItems.findIndex(item => item.path === zipPath);
  const canGoPrevLibrary = currentLibraryIndex > 0;
  const canGoNextLibrary = currentLibraryIndex !== -1 && currentLibraryIndex < libraryItems.length - 1;
  
  // 💡 [유저 명령 충실 이행] 단일 이미지(1페이지)이면서 형제 파일이 있을 때만 화살표 전설 가동!
  const showNavArrows = hasActiveFile && pages.length === 1 && libraryItems.length > 1;
  const pageStep = viewMode === '2' ? 2 : 1;

  // ⚔️ [유니버설 마스터 엔진] 페이지 넘김과 책 넘김을 통합 처리하는 인공지능 알고리즘!
  // 🚀 [최고급 기동성] useCallback으로 래핑하여 키보드 리스너와 영구 동기화!
  const handleNavPrev = useCallback(() => {
    // 🔒 [유저 엄명: 스킵 가드] 시스템이 연산 중(Loading)일 때 들어오는 모든 추가 이동 명령은 무자비하게 스킵!
    if (isAppLoading) return; 

    if (currentIndex > 0) {
      setCurrentIndex(prev => Math.max(0, prev - pageStep)); // 1. 내부 페이지 뒤로
    } else if (canGoPrevLibrary) {
      // 2. 이전 책으로 넘어가서 '마지막 페이지(-1)'에 소프트 랜딩!
      setAutoMoveNotice('이전 권으로 이동합니다');
      if (autoMoveNoticeTimerRef.current !== null) {
        window.clearTimeout(autoMoveNoticeTimerRef.current);
      }
      autoMoveNoticeTimerRef.current = window.setTimeout(() => {
        setAutoMoveNotice(null);
      }, 3000);
      void loadZipIntoViewer(libraryItems[currentLibraryIndex - 1].path, -1);
    }
  }, [currentIndex, pageStep, canGoPrevLibrary, currentLibraryIndex, libraryItems, loadZipIntoViewer, isAppLoading]);

  const handleNavNext = useCallback(() => {
    // 🔒 [유저 엄명: 스킵 가드] 로딩 중일 때 어떠한 중복 명령 유입도 허용하지 않음!
    if (isAppLoading) return;

    if (currentIndex < pages.length - pageStep) {
      setCurrentIndex(prev => Math.min(pages.length - 1, prev + pageStep)); // 1. 내부 페이지 앞으로
    } else if (canGoNextLibrary) {
      // 2. 다음 책으로 넘어가서 '첫 페이지(0)'부터 시작!
      setAutoMoveNotice('다음 권으로 이동합니다');
      if (autoMoveNoticeTimerRef.current !== null) {
        window.clearTimeout(autoMoveNoticeTimerRef.current);
      }
      autoMoveNoticeTimerRef.current = window.setTimeout(() => {
        setAutoMoveNotice(null);
      }, 3000);
      void loadZipIntoViewer(libraryItems[currentLibraryIndex + 1].path, 0);
    }
  }, [currentIndex, pages.length, pageStep, canGoNextLibrary, currentLibraryIndex, libraryItems, loadZipIntoViewer, isAppLoading]);

  useEffect(() => {
    return () => {
      if (autoMoveNoticeTimerRef.current !== null) {
        window.clearTimeout(autoMoveNoticeTimerRef.current);
      }
    };
  }, []);

  // 🏁 전역 내비게이션 가능 상태 최종 판독
  const canGlobalPrev = currentIndex > 0 || canGoPrevLibrary;
  const canGlobalNext = (pages.length > 0 && currentIndex < pages.length - pageStep) || canGoNextLibrary;
  const visibleEntryNames = useMemo(
    () =>
      viewMode === '2'
        ? [pages[currentIndex]?.entryName, pages[currentIndex + 1]?.entryName].filter(Boolean)
        : [pages[currentIndex]?.entryName].filter(Boolean),
    [viewMode, pages, currentIndex]
  );

  // 🎹 [유저 특명] 키보드 '좌/우' 화살표 텔레파시 시스템 주입!
  useEffect(() => {
    // 활성화된 파일이 없거나 컨버터가 떠있으면 키보드 차단
    if (!hasActiveFile || workspaceMode === 'converter') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 포커스가 인풋 창에 가 있을 때는 단축키 비활성화 (안전장치)
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handleNavPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNavNext();
          break;
        case 'PageUp':
          e.preventDefault();
          setCurrentIndex((prev) => Math.max(0, prev - 10));
          break;
        case 'PageDown':
          e.preventDefault();
          setCurrentIndex((prev) => Math.min(Math.max(0, pages.length - 1), prev + 10));
          break;
        case 'Home':
          e.preventDefault();
          setCurrentIndex(0);
          break;
        case 'End':
          e.preventDefault();
          if (pages.length > 0) {
            if (viewMode === '2') {
              // 2쪽 보기에서는 마지막 펼침 기준으로 이동
              setCurrentIndex(Math.max(0, pages.length - (pages.length % 2 === 0 ? 2 : 1)));
            } else {
              setCurrentIndex(pages.length - 1);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasActiveFile, workspaceMode, handleNavPrev, handleNavNext, pages.length, viewMode]);

  return (
    <div 
      className={`app-container ${isResizing ? 'resizing' : ''}`}
      style={{ 
        ['--sidebar-width' as any]: `${sidebarWidth}px` 
      }}
    >
      {/* 🪟 상단 프레임리스 컨트롤 (🔒 뷰모드 동기화!) */}
      <TitleBarControls 
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        themeMode={themeMode}
        onChangeThemeMode={setThemeMode}
        // 🚀 [New] Global Workspace Integration
        workspaceMode={workspaceMode}
        hasActiveFile={hasActiveFile}
        converterMode={converterMode} // 🛸 [신규] 타이틀바에 실시간 주입!!
        onChangeConverterMode={handleConverterModeChange} // ⚡ 통합 리모컨 연결!
      />
      
      {/* ⚓ 관제탑 (앵커바) */}
      <FloatingAnchor 
        onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
        onToggleMenu={toggleSidebarMenu}
        onShowViewer={() => setWorkspaceMode('viewer')}
        onShowConverter={() => setWorkspaceMode('converter')}
        canShowViewer={workspaceMode !== 'viewer'}
        canShowConverter={workspaceMode !== 'converter'}
        isSidebarOpen={isSidebarOpen} // 🧬 [동기화] 최신형 라이브 상태 동기화 완료!
      />

      {/* 📂 서고 */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        isMenuOpen={isSidebarMenuOpen}
        onOpenConverter={() => {
          setWorkspaceMode('converter');
          setSidebarMenuOpen(false);
        }}
        onOpenFile={handleOpenFileClick} 
        onOpenFolder={handleOpenFolderClick} // ⚡ [1.0 복제분실 연동!!]
        onFileSelect={handleFileSelect}
        loadSameBook={loadSameBook}
        onToggleLoadSameBook={setLoadSameBook}
        libraryItems={libraryItems}
        activeLibraryPath={workspaceMode === 'viewer' ? selectedPath : null}
        selectedLibraryPaths={[]}
        onLibraryItemClick={handleLibraryItemClick}
        // onLibraryItemDoubleClick는 다시 역사속으로 사라집니다.
        libraryFolderName={libraryFolderName} // 📂 [전송] 라이브러리 그룹 이름!
        workspaceMode={workspaceMode} // 🛸 [연동] 현재 차원 정보 송신!
        onShowViewer={() => { // 🏡 [복귀] MTC Center로의 귀환 명령 생성!
          setWorkspaceMode('viewer');
          setSidebarMenuOpen(false);
        }}
      />

      {/* 📏 리사이저 */}
      {isSidebarOpen && (
        <div 
          className={`layout-resizer ${isResizing ? 'active' : ''}`}
          onMouseDown={startResizing}
        />
      )}

      {workspaceMode === 'viewer' ? (
        <>
          {/* 🖼️ 무대 (메인 뷰어) */}
          <ViewerCanvas 
            hasActiveFile={hasActiveFile}
            zipPath={zipPath}
            entryNames={visibleEntryNames}
            viewMode={viewMode}
            imageFitMode={imageFitMode} /* 🔍 [동기화] 보기 모드 정보 하달! */
            
            // 🧭 [신규] 내비게이션 제어 신호 송신!
            showNavArrows={showNavArrows}
            canGoPrev={canGoPrevLibrary}
            canGoNext={canGoNextLibrary}
            onPrev={handleNavPrev}
            onNext={handleNavNext}

            onClick={() => {
              if (isSidebarMenuOpen) setSidebarMenuOpen(false);
              if (contextMenu.show) setContextMenu(prev => ({ ...prev, show: false }));
            }} 
            onContextMenu={handleContextMenu}
          />

        </>
      ) : (
        <ConverterPanel
          mode={converterMode} // 🛸 [격상 완수] 하향식 주입!
          sourceItems={converterSourceItems}
          hasSidebarItems={libraryItems.length > 0}
          selectedPaths={selectedConverterPaths}
          onToggleSelection={setSelectedConverterPaths}
          onAddSource={handleAddConverterSource}
          onAddAllSource={handleAddAllConverterSource}
          onClearSource={handleClearConverterSource}
          onRemoveSourceItems={handleRemoveConverterSourceItems}
          onUpdateStatusText={setConverterStatusText} // 📡 하달받은 실시간 메시지를 상태 저장소로 업링크!
        />
      )}

      {/* 🛰️ 상태바는 화면 전환과 무관하게 하단 고정 유지 */}
      <StatusBar 
        workspaceMode={workspaceMode}
        converterStatusText={converterStatusText} // 📢 통합 메시지 발동!!
        hasActiveFile={hasActiveFile}
        activeFileName={zipPath ? zipPath.split(/[/\\]/).pop() : null}
        currentPageIndex={currentIndex}
        totalPages={pages.length}
        bookPositionHint={getBookPositionHint()}
        totalLibraryItems={libraryItems.length}
        isSidebarOpen={isSidebarOpen}
        canGoPrev={canGlobalPrev}
        canGoNext={canGlobalNext}
        onPrev={handleNavPrev}
        onNext={handleNavNext}
      />

      {/* 🌌 궁극의 전천후 팝업 메뉴 (🔒 뷰모드 & 스케일 모드 동기화!) */}
      <ContextMenu 
        x={contextMenu.x} 
        y={contextMenu.y} 
        show={contextMenu.show} 
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        themeMode={themeMode}
        onChangeThemeMode={setThemeMode}
        imageFitMode={imageFitMode} /* 🔍 [전송] 현재 스케일 */
        onChangeImageFitMode={setImageFitMode} /* ⚡ [트리거] 스케일 스왑 엔진 */
        onClose={() => setContextMenu(prev => ({ ...prev, show: false }))} 
      />

      {/* 🛡️ [유저 인벤션: Micro Safety Lock] 초단위 클릭 연사 무지개반사 실드!! */}
      {isAppLoading && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 99999, cursor: 'wait',
          backgroundColor: 'rgba(0,0,0,0)' // 투명하게 존재하며 모든 클릭을 스펀지처럼 흡수!
        }} />
      )}

      {autoMoveNotice && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100000,
            padding: '14px 20px',
            borderRadius: '10px',
            border: '1px solid rgba(var(--rgb-contrast), 0.18)',
            background: 'var(--bg-floating-panel)',
            color: 'var(--text-main)',
            boxShadow: 'var(--shadow-popup)',
            backdropFilter: 'blur(12px)',
            pointerEvents: 'none',
            fontSize: '0.95rem',
            fontWeight: 600
          }}
        >
          {autoMoveNotice}
        </div>
      )}

      </div>
  );
}

export default App;
