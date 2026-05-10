import React, { useState, useEffect, useCallback } from 'react';

// 📦 모듈화된 명품 부품들 소환
import { FloatingAnchor } from './components/layout/FloatingAnchor';
import { Sidebar } from './components/layout/Sidebar';
import { ViewerCanvas } from './components/layout/ViewerCanvas';
import { ConverterModal } from './components/modals/ConverterModal';
import { TitleBarControls } from './components/layout/TitleBarControls';
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

function App() {
  // 🚥 메인 레이아웃 및 콘텐츠 상태
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isSidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  const [isConverterOpen, setConverterOpen] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(false); // 🛡️ [유저 고안] 철통 보안 마이크로 락 스테이트!
  
  // 🎬 [신규] 콘텐츠 시연 모드 및 뷰 모드(1쪽/2쪽) 추적기 탑재!
  const [hasActiveFile, setHasActiveFile] = useState(false);
  const [viewMode, setViewMode] = useState<'1' | '2'>('1'); // 기본값: 1쪽 보기
  const [imageFitMode, setImageFitMode] = useState<'auto' | 'actual' | 'width' | 'height'>('auto'); // 🔍 [신규] 스케일 추적기 탑재!

  // 🧬 [신규] 진짜 데이터 로딩을 위한 생명줄!
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null); // 💡 [신규] 단순 시각적 선택용 하이라이트 상태 추가!
  const [pages, setPages] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 📚 [신규] (같은책) 묶음 로딩 모드 및 라이브러리 항목
  const [loadSameBook, setLoadSameBook] = useState(true);
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [libraryFolderName, setLibraryFolderName] = useState<string | null>(null); // 📂 라이브러리 루트 폴더명

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
  const loadZipIntoViewer = async (filePath: string, initialIndex: number = 0) => {
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
        
        // 🎯 착륙 지점 보정: -1이면 정밀 유도하여 마지막 페이지에 안착!
        const targetIdx = initialIndex === -1 ? Math.max(0, loadedPages.length - 1) : initialIndex;
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
  const handleLibraryItemClick = (filePath: string) => {
    // 🚀 [완벽한 회귀] 유저 제안의 미학대로, 편안한 '1-클릭'으로 롤백하여 즉시 실행합니다!
    void loadZipIntoViewer(filePath); 
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

  // ⚔️ [유니버설 마스터 엔진] 페이지 넘김과 책 넘김을 통합 처리하는 인공지능 알고리즘!
  // 🚀 [최고급 기동성] useCallback으로 래핑하여 키보드 리스너와 영구 동기화!
  const handleNavPrev = useCallback(() => {
    // 🔒 [유저 엄명: 스킵 가드] 시스템이 연산 중(Loading)일 때 들어오는 모든 추가 이동 명령은 무자비하게 스킵!
    if (isAppLoading) return; 

    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1); // 1. 내부 페이지 뒤로
    } else if (canGoPrevLibrary) {
      // 2. 이전 책으로 넘어가서 '마지막 페이지(-1)'에 소프트 랜딩!
      void loadZipIntoViewer(libraryItems[currentLibraryIndex - 1].path, -1);
    }
  }, [currentIndex, canGoPrevLibrary, currentLibraryIndex, libraryItems, loadZipIntoViewer, isAppLoading]);

  const handleNavNext = useCallback(() => {
    // 🔒 [유저 엄명: 스킵 가드] 로딩 중일 때 어떠한 중복 명령 유입도 허용하지 않음!
    if (isAppLoading) return;

    if (currentIndex < pages.length - 1) {
      setCurrentIndex(prev => prev + 1); // 1. 내부 페이지 앞으로
    } else if (canGoNextLibrary) {
      // 2. 다음 책으로 넘어가서 '첫 페이지(0)'부터 시작!
      void loadZipIntoViewer(libraryItems[currentLibraryIndex + 1].path, 0);
    }
  }, [currentIndex, pages.length, canGoNextLibrary, currentLibraryIndex, libraryItems, loadZipIntoViewer, isAppLoading]);

  // 🏁 전역 내비게이션 가능 상태 최종 판독
  const canGlobalPrev = currentIndex > 0 || canGoPrevLibrary;
  const canGlobalNext = (pages.length > 0 && currentIndex < pages.length - 1) || canGoNextLibrary;

  // 🎹 [유저 특명] 키보드 '좌/우' 화살표 텔레파시 시스템 주입!
  useEffect(() => {
    // 활성화된 파일이 없거나 컨버터가 떠있으면 키보드 차단
    if (!hasActiveFile || isConverterOpen) return;

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasActiveFile, isConverterOpen, handleNavPrev, handleNavNext]);

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
      />
      
      {/* ⚓ 관제탑 (앵커바) */}
      <FloatingAnchor 
        onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
        onToggleMenu={toggleSidebarMenu}
      />

      {/* 📂 서고 */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        isMenuOpen={isSidebarMenuOpen}
        onOpenConverter={() => setConverterOpen(true)}
        onOpenFile={handleOpenFileClick} 
        onOpenFolder={handleOpenFolderClick} // ⚡ [1.0 복제분실 연동!!]
        onFileSelect={handleFileSelect}
        loadSameBook={loadSameBook}
        onToggleLoadSameBook={setLoadSameBook}
        libraryItems={libraryItems}
        activeLibraryPath={selectedPath}
        onLibraryItemClick={handleLibraryItemClick}
        // onLibraryItemDoubleClick는 다시 역사속으로 사라집니다.
        libraryFolderName={libraryFolderName} // 📂 [전송] 라이브러리 그룹 이름!
      />

      {/* 📏 리사이저 */}
      {isSidebarOpen && (
        <div 
          className={`layout-resizer ${isResizing ? 'active' : ''}`}
          onMouseDown={startResizing}
        />
      )}

      {/* 🖼️ 무대 (메인 뷰어) */}
      <ViewerCanvas 
        hasActiveFile={hasActiveFile}
        zipPath={zipPath}
        entryName={pages[currentIndex]?.entryName || null}
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

      {/* 🛰️ [긴급 재탈출] 상태바를 뷰어 둥지 밖으로 꺼내, 화면 하단 전체를 웅장하게 점령합니다! */}
      <StatusBar 
        hasActiveFile={hasActiveFile}
        activeFileName={zipPath ? zipPath.split(/[/\\]/).pop() : null}
        currentPageIndex={currentIndex}
        totalPages={pages.length}
        bookPositionHint={getBookPositionHint()}
        totalLibraryItems={libraryItems.length} // 📚 [연동] 라이브러리 총 개수 하달!
        isSidebarOpen={isSidebarOpen} // 📏 [연동] 사이드바 개폐 정보 하달!
        
        // 🧭 [유저 하달] 상태바 중앙 내비게이션 엔진 주입!!
        canGoPrev={canGlobalPrev}
        canGoNext={canGlobalNext}
        onPrev={handleNavPrev}
        onNext={handleNavNext}
      />

      {/* 🎁 콘텐츠 컨버터 모달 */}
      <ConverterModal 
        isOpen={isConverterOpen} 
        onClose={() => setConverterOpen(false)} 
      />

      {/* 🌌 궁극의 전천후 팝업 메뉴 (🔒 뷰모드 & 스케일 모드 동기화!) */}
      <ContextMenu 
        x={contextMenu.x} 
        y={contextMenu.y} 
        show={contextMenu.show} 
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
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

      </div>
  );
}

export default App;
