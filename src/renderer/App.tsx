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
import { SidebarContextMenu } from './components/ui/SidebarContextMenu'; // 📂 [신규] 사이드바 전용 메뉴
import { StatusBar } from './components/layout/StatusBar'; // 🌌 [신규] 실시간 현황판
import { SettingsModal } from './components/modals/SettingsModal'; // ⚙️ [신규] 통합 설정 센터 입항!
import type { AppLanguage } from './i18n'; // 🌍 [글로벌] 다국어 타입 명세서 소환

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
const LANGUAGE_STORAGE_KEY = 'mtc:language'; // 📡 [글로벌] 언어 코드 메모리 주소
type ThemeMode = 'default' | 'light' | 'dark' | 'system' | 'hwasa'; /* 🌸 [유저 특명] 화사(Hwasa) 차원 신설! */
type WorkspaceMode = 'viewer' | 'converter';

function readSavedLanguage(): AppLanguage {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return saved === 'en' ? 'en' : 'ko';
}

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
  if (saved === 'light' || saved === 'dark' || saved === 'system' || saved === 'default' || saved === 'hwasa') {
    return saved as ThemeMode;
  }
  return 'default';
}

function App() {
  // 🚥 메인 레이아웃 및 콘텐츠 상태
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isSidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false); // ⚙️ [신규] 통합 설정 모달 라이브 채널 개방
  const [converterStatusText, setConverterStatusText] = useState<string>(''); // 📡 [신규] 컨버터 전용 상태 메시지 저장소
  const [converterMode, setConverterMode] = useState<ConverterMode>('merge'); // 🚀 [격상] 컨버터 통합 관제 모드
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('viewer');
  const [isAppLoading, setIsAppLoading] = useState(false); // 🛡️ [유저 고안] 철통 보안 마이크로 락 스테이트!
  const [autoMoveNotice, setAutoMoveNotice] = useState<string | null>(null);
  const autoMoveNoticeTimerRef = useRef<number | null>(null);
  
  // 📡 [유저 인벤션] 권 이동 알림창 자유 드래깅 포지셔너 탑재!
  const [noticePos, setNoticePos] = useState<{ x: number, y: number } | null>(() => {
    const saved = localStorage.getItem('mtc_notice_pos');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null; // 초기화 시 CSS 기본 중앙 배치 활용
  });
  const [isDraggingNotice, setIsDraggingNotice] = useState(false);

  const lastWheelTimeRef = useRef<number>(0); // 🎡 [신규] 휠 페이지 넘김 연속 난사 방지 타이머
  
  // 🛡️ [영속화 방어막] 초기 백엔드 로딩이 끝날 때까지 자동 저장을 일시 봉쇄하는 특수 가드!
  const isSettingsLoadedRef = useRef(false);
  
  // 🎬 [신규] 콘텐츠 시연 모드 및 뷰 모드(1쪽/2쪽) 추적기 탑재!
  const [hasActiveFile, setHasActiveFile] = useState(false);
  const [viewMode, setViewMode] = useState<'1' | '2'>(() => readSavedViewMode()); // 기본값: 저장값 우선
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readSavedThemeMode());
  const [imageFitMode, setImageFitMode] = useState<'auto' | 'actual' | 'width' | 'height'>('auto'); // 🔍 [신규] 스케일 추적기 탑재!
  const [language, setLanguage] = useState<AppLanguage>(() => readSavedLanguage()); // 🌍 [글로벌] 다국어 뇌관 가동!

  // 🌍 [글로벌 싱크] 언어 설정 변경 시 브라우저 로컬 스토리지 자동 기록기 기동!
  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

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
  const [libraryFolderPath, setLibraryFolderPath] = useState<string | null>(null); // 📂 라이브러리 루트 절대 경로 (최근기록 실체)
  const [converterSourceItems, setConverterSourceItems] = useState<ConverterSourceItem[]>([]);
  const [selectedConverterPaths, setSelectedConverterPaths] = useState<Set<string>>(new Set());
  
  // 🛰️ [신규] 사이드바 다중 페르소나(뷰) 통제소
  const [sidebarViewMode, setSidebarViewMode] = useState<'library' | 'recent'>('library');
  const [recentSidebarItems, setRecentSidebarItems] = useState<any[]>([]); // 📜 최근 항목용 전용 데이터 파이프

  // 📍 [신규] 컨텍스트 메뉴 좌표 및 활성화 상태
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean }>({
    x: 0, y: 0, show: false
  });

  // 📂 [유저 특명] 사이드바 아이템 전용 컨텍스트 메뉴 상태
  const [sidebarCtxMenu, setSidebarCtxMenu] = useState<{ x: number; y: number; show: boolean; targetPath: string | null }>({
    x: 0, y: 0, show: false, targetPath: null
  });

  // 📏 사이드바 가변 너비 상태
  const [sidebarWidth, setSidebarWidth] = useState(230);
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
  
  // ⏳ [글로벌 통합 커서 제어] 시스템 연산 중(isAppLoading)일 시, 전체 화면 마우스 커서를 'Wait'로 강제 잠금!
  useEffect(() => {
    document.body.style.cursor = isAppLoading ? 'wait' : '';
  }, [isAppLoading]);

  // 🧹 [신규] 워크스페이스 차원(뷰어 ↔ 컨버터) 교체 시, 화면에 떠있던 모든 종류의 팝업/우클릭 메뉴를 강제 소각!
  useEffect(() => {
    setContextMenu(prev => prev.show ? { ...prev, show: false } : prev);
    setSidebarCtxMenu(prev => prev.show ? { ...prev, show: false, targetPath: null } : prev);
    setSidebarMenuOpen(false); // 사이드바 햄버거도 동시에 청소
  }, [workspaceMode]);

  // 📡 [유저 인벤션] 안내 메시지 알림 타이머 & 드래그 처리 엔진
  const clearNoticeTimer = useCallback(() => {
    if (autoMoveNoticeTimerRef.current !== null) {
      window.clearTimeout(autoMoveNoticeTimerRef.current);
      autoMoveNoticeTimerRef.current = null;
    }
  }, []);

  const startNoticeTimer = useCallback((duration = 3000) => {
    clearNoticeTimer();
    autoMoveNoticeTimerRef.current = window.setTimeout(() => {
      setAutoMoveNotice(null);
    }, duration);
  }, [clearNoticeTimer]);

  const dispatchNotice = useCallback((msg: string) => {
    setAutoMoveNotice(msg);
    startNoticeTimer(3000);
  }, [startNoticeTimer]);

  const handleNoticeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // 좌클릭만 인정
    e.preventDefault();
    
    clearNoticeTimer(); // 드래그 시작 시 사라짐 타이머 동결
    setIsDraggingNotice(true);

    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    
    // 마우스 포인터와 요소 내부 간 오프셋 계산
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
      const newX = moveEvent.clientX - offsetX + rect.width / 2;
      const newY = moveEvent.clientY - offsetY + rect.height / 2;
      
      // 뷰포트 밖으로 완전히 이탈하지 않도록 세이프 가드 탑재!
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const boundedX = Math.max(rect.width / 2, Math.min(winW - rect.width / 2, newX));
      const boundedY = Math.max(rect.height / 2, Math.min(winH - rect.height / 2, newY));

      setNoticePos({ x: boundedX, y: boundedY });
    };

    const handleGlobalMouseUp = (upEvent: MouseEvent) => {
      setIsDraggingNotice(false);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);

      // 마우스를 뗀 지점의 최종 오프셋 기반 정밀 포지션 영속화
      const finalX = upEvent.clientX - offsetX + rect.width / 2;
      const finalY = upEvent.clientY - offsetY + rect.height / 2;
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const finalBoundedX = Math.max(rect.width / 2, Math.min(winW - rect.width / 2, finalX));
      const finalBoundedY = Math.max(rect.height / 2, Math.min(winH - rect.height / 2, finalY));

      localStorage.setItem('mtc_notice_pos', JSON.stringify({ x: finalBoundedX, y: finalBoundedY }));
      startNoticeTimer(2500); // 마우스 떼는 시점부터 종료 카운트 재개
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
  };

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

  // 🛡️ 사이드바 아이템 우클릭 유입 및 연동 제어
  const handleSidebarItemContextMenu = (e: React.MouseEvent, path: string) => {
    setSidebarCtxMenu({
      x: e.clientX,
      y: e.clientY,
      show: true,
      targetPath: path
    });
  };

  // 🧹 [사이드바 작업 로직 1] 문서 닫기 (해당 문서가 활성 문서일 때만 초기화)
  const handleCloseDocFromSidebar = useCallback((targetPath: string) => {
    if (zipPath === targetPath) {
      setHasActiveFile(false);
      setZipPath(null);
      setSelectedPath(null);
    }
  }, [zipPath]);

  // 🧹 [사이드바 작업 로직 2] 리스트에서만 보이지 않게 추방 (하드디스크는 무결)
  const handleRemoveDocFromSidebar = useCallback((targetPath: string) => {
    setLibraryItems(prev => prev.filter(item => item.path !== targetPath));
  }, []);

  // 💣 [사이드바 작업 로직 3] 물리적 공간 반환 - 디스크에서 파일 자체를 소각!
  const handleDeleteFileFromSidebar = useCallback(async (targetPath: string) => {
    const confirmed = window.confirm(`[🚨 영구 삭제 경고]\n\n파일을 하드디스크에서 완전히 소각하시겠습니까?\n(주의: 휴지통 이동 혹은 영구 삭제가 진행됩니다.)`);
    if (!confirmed) return;

    setIsAppLoading(true);
    try {
      const appApi = (window as any).appApi;
      const result = await appApi.deleteFile(targetPath);
      if (result.ok) {
        // 1. 리스트에서 제거하여 시각적으로 소각 완료 각인
        setLibraryItems(prev => prev.filter(item => item.path !== targetPath));
        // 2. 혹시 내가 열어놓은 파일이었다면 뷰어도 치운다
        if (zipPath === targetPath) {
          setHasActiveFile(false);
          setZipPath(null);
          setSelectedPath(null);
        }
      } else {
        alert(`[삭제 실패] ${result.error?.message || '파일 삭제 명령이 거부되었습니다.'}`);
      }
    } catch (err) {
      console.error('Physical file deletion failed:', err);
      alert('파일 소각 중 치명적 오류가 발생했습니다.');
    } finally {
      setIsAppLoading(false);
    }
  }, [zipPath]);

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

  // 🗑️ [페이지 삭제 시스템] 열려있는 압축파일 내부의 페이지를 직접 소각하는 기능!
  const handleDeletePage = useCallback(async (target: 'left' | 'right') => {
    if (!hasActiveFile || !zipPath || pages.length === 0) return;

    const targetIdx = target === 'right' ? currentIndex + 1 : currentIndex;
    const targetPage = pages[targetIdx];

    if (!targetPage) {
      alert('삭제할 대상을 찾을 수 없습니다.');
      return;
    }

    // ☢️ [경고 & 안내] 유저에게 최종 승인 절차 및 백업 정책 자동 고지!
    const confirmed = window.confirm(
      `[🚨 페이지 삭제]\n\n` +
      `"${targetPage.displayName || targetPage.entryName}"\n\n` +
      `정말로 이 페이지를 영구적으로 삭제하시겠습니까?\n\n` +
      `💡 (안내) 원본은 안전하게 백업 보관되며, 삭제가 반영된 최신 수정본으로 즉시 화면을 새롭게 펼칩니다.`
    );
    if (!confirmed) return;

    setIsAppLoading(true); // 🛡️ 작업 중 조작 차단
    try {
      const appApi = (window as any).appApi;
      // 🛡️ [UX 최적화] 너무 빨라서 마우스가 안 보일 정도이므로, 최소 400ms의 가시적 피드백 시간을 확보한다!
      const [result] = await Promise.all([
        appApi.editZipPages(zipPath, {
          kind: 'delete',
          targetEntryName: targetPage.entryName
        }),
        new Promise(resolve => setTimeout(resolve, 400)) // ⏳ 인지 유도용 인위적 지연
      ]);

      if (result.ok) {
        // 🔥 [초긴급 수정] 기존 zipPath가 아닌 백엔드에서 반환한 editedZipPath로 경로를 갈아끼운다!
        const newZipPath = result.data.editedZipPath;
        
        // 📚 [유저 특명: 사이드바 실시간 등록 엔진] 새로 탄생한 가공 파일을 목록에 즉시 투입!
        try {
          const newFileName = await appApi.getBasename(newZipPath);
          setLibraryItems(prev => {
            if (prev.some(item => item.path === newZipPath)) return prev; // 중복 방어
            const newItem = { name: newFileName, path: newZipPath, type: 'zip' as const };
            // 기존 목록에 탑승시키고 가나다/숫자 순으로 완벽한 서열 정렬 수행!
            return [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
          });
        } catch (err) {
          console.warn('[Sidebar sync failed]', err);
        }

        const nextIdx = Math.max(0, Math.min(currentIndex, pages.length - 2));
        await loadZipIntoViewer(newZipPath, nextIdx);
      } else {
        alert(`[삭제 실패]\n${result.error?.message || '알 수 없는 오류'}`);
      }
    } catch (err) {
      console.error('Page deletion failed:', err);
      alert('삭제 수행 중 치명적 오류가 발생했습니다.');
    } finally {
      setIsAppLoading(false);
    }
  }, [hasActiveFile, zipPath, pages, currentIndex, loadZipIntoViewer]);

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

  // ⏳ [글로벌 커서 컨트롤러] 전체 로딩 혹은 비동기 파일 추출 시 전체 앱 커서를 대기 상태로 전환!
  useEffect(() => {
    if (isAppLoading) {
      document.body.classList.add('is-processing');
    } else {
      document.body.classList.remove('is-processing');
    }
    return () => {
      document.body.classList.remove('is-processing');
    };
  }, [isAppLoading]);

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

  // 📜 [유저 특명] 최근 열람 목록(Recent Items) 지능형 조건부 기록 엔진
  useEffect(() => {
    const appApi = (window as any).appApi;
    if (!appApi?.upsertRecent) return;

    const executeRecentUpsert = async () => {
      try {
        // 💡 [초고급 하이브리드 분기 시스템]
        
        // ✅ 분기 1: 라이브러리 폴더 컨텍스트가 존재할 때 (최우선순위 🏆)
        if (libraryFolderPath && libraryFolderName) {
          await appApi.upsertRecent({
            fileId: libraryFolderPath,    // 📂 폴더 전체를 고유 식별자로 각인!
            zipPath: libraryFolderPath,  // 물리 경로도 폴더로 지정!
            title: libraryFolderName,    // 👑 타이틀도 웅장한 폴더명으로 명명!
            lastPageIndex: 0             // 폴더 레벨의 초기 진입점
          });
          console.log('[Recent Engine] Master record logged as FOLDER:', libraryFolderName);
          return; // 폴더가 최우선이므로 이대로 종료!
        }

        // ✅ 분기 2: 독립형 단일 파일 로딩 컨텍스트 (차선순위 🥈)
        if (zipPath && hasActiveFile) {
          const fileName = await appApi.getBasename(zipPath);
          await appApi.upsertRecent({
            fileId: zipPath,             // 📄 단일 파일 경로를 식별자로!
            zipPath: zipPath,
            title: fileName,            // 파일명을 수수하게 등재
            lastPageIndex: currentIndex
          });
          console.log('[Recent Engine] Individual record logged as FILE:', fileName);
        }
      } catch (error) {
        console.error('[Recent Engine] History sync operation failed:', error);
      }
    };

    executeRecentUpsert();
    // 🛸 [전략적 센서 감지] 폴더 주소, 파일 주소, 활성 상태가 요동칠 때마다 즉시 판독 개시!
  }, [libraryFolderPath, libraryFolderName, zipPath, hasActiveFile]);

  // 📜 [유저 특명] 최근 열람 기록 사이드바 소환술!
  const handleShowRecentList = async () => {
    try {
      const appApi = (window as any).appApi;
      if (!appApi?.getRecent) return;
      
      const result = await appApi.getRecent();
      if (result.ok && Array.isArray(result.data)) {
        // 🎨 사이드바 렌더링 스펙에 맞춰 데이터를 다듬어 탑재!
        const mapped = result.data.map((item: any) => ({
          name: item.title,
          path: item.zipPath,
          type: 'recent' // ✨ '최근 항목' 전용 페르소나 부여
        }));
        setRecentSidebarItems(mapped);
        
        // 🚀 사이드바 모드를 전환하고 강제 개방!!
        setSidebarViewMode('recent');
        setSidebarOpen(true);
        
        console.log(`[System] Triggered Recent sidebar with ${mapped.length} items.`);
      }
    } catch (err) {
      console.error('[Recent Handler] Failed to load sidebar items:', err);
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
      
      // 🏰 [안전장치] 수동으로 새 파일을 열면 사이드바를 즉각 라이브러리 모드로 환원!
      setSidebarViewMode('library');

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
            .filter((item) => (item.type === 'zip' || item.type === 'archive' || item.type === 'image') && getSeriesKeyFromName(item.name) === currentKey)
            .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
          
          console.log('[System] Filtered Library Items:', siblings);
          setLibraryItems(siblings);

          // 🤝 [유저 특명 강화] '같은 책' 로딩 시에는 개수 상관없이 무조건 폴더를 최종 각인하여 히스토리 상위권을 보장합니다!
          const parentFolderName = await appApi.getBasename(dirPath);
          setLibraryFolderName(parentFolderName);
          setLibraryFolderPath(dirPath); // 🛰️ [절대주소 동반 각인]
        } else {
          console.error('[System] Failed to list folder items:', listResult.error);
        }
      } else {
        // ⚡ [버그 척살] 단일 모드라도 파일 확장자를 지능형으로 추론하여 올바른 타입 각인!
        const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
        const targetType = ['zip','cbz','7z','rar'].includes(ext) ? 'archive' : (['png','jpg','jpeg','webp','gif','bmp','avif'].includes(ext) ? 'image' : 'zip');
        
        // 📐 [특명] 단일 파일 오프닝 시에도 누수 없는 용량 수집망 가동!
        const singleFileSize = await appApi.getFileSize(filePath).catch(() => 0);
        setLibraryItems([{ name: fileName, path: filePath, type: targetType, sizeBytes: singleFileSize }]);
        setLibraryFolderName(null); // 단일 파일은 폴더 헤더 불필요
        setLibraryFolderPath(null);
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
      
      // 🏰 [안전장치] 새 폴더를 여는 즉시 사이드바를 본연의 라이브러리 모드로 즉각 환원!
      setSidebarViewMode('library');

      const result = await appApi.listFolderItems(folderPath);
      if (result.ok) {
        console.log('[System] Loaded Folder Items:', result.data);
        const items = (result.data as any[]).sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
        setLibraryItems(items);
        
        // 📂 폴더명 추출하여 라이브러리 대장으로 임명!
        const folderName = await appApi.getBasename(folderPath);
        setLibraryFolderName(folderName);
        setLibraryFolderPath(folderPath); // 🛰️ [폴더 열기 시의 마스터 주소 고착화!]
        
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
    const currentBookIndex = libraryItems.findIndex(item => item.path === zipPath);
    if (currentBookIndex === -1) return null;
    
    const total = libraryItems.length;
    const current = currentBookIndex + 1;
    
    if (currentBookIndex === 0) return `처음 [ ${current} / ${total} ]`;
    if (currentBookIndex === total - 1) return `끝 [ ${current} / ${total} ]`;
    return `[ ${current} / ${total} ]`;
  };

  // 🔮 [신규 궁극의 해법] 사이드바 든 캔버스 든, 어디서든 '최근 기록'을 눌렀을 때 공통 발동할 만능 열쇠!
  const handleRecentItemSelect = async (filePath: string) => {
    try {
      const appApi = (window as any).appApi;
      if (!appApi) return;
      setIsAppLoading(true);

      // 🛰️ 1. 폴더 여부 원격 정찰 (성공 시 폴더 라이브러리 모드 전개)
      const folderScan = await appApi.listFolderItems(filePath);
      if (folderScan.ok) {
        const rawItems = folderScan.data as any[];
        const sorted = rawItems.sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
        
        setLibraryItems(sorted);
        setLibraryFolderName(await appApi.getBasename(filePath));
        setLibraryFolderPath(filePath);
        
        // 🏰 왕의 귀환: 어떤 루트로 왔든 임무 완료 후 '라이브러리 뷰'로 평화 귀속!
        setSidebarViewMode('library');
        setSidebarOpen(true); // 📂 [유저 특명 고수] 폴더가 로딩되자마자 우아하게 사이드바를 즉각 개방합니다!
        console.log('[System] Loaded Entity as Folder Library.');
        return;
      }

      // 🛰️ 2. 폴더 로딩 실패 시 -> 파일로 간주!
      console.log('[System] Path is not a folder, initiating smart contextual loading...');
      const loaded = await loadZipIntoViewer(filePath);
      if (!loaded) return;

      // 🏰 [유저 특명 1] 파일을 열자마자 사이드바를 '라이브러리' 모드로 전환하고 즉각 개방!
      setSidebarViewMode('library');
      setSidebarOpen(true); // 📂 즉각 시각화!

      const fileName = await appApi.getBasename(filePath);

      // 🤝 [유저 특명 2] '같은 책 불러오기' 체크 상태라면, 존재하던 폴더 내 형제들을 색출해 서고를 채웁니다!
      if (loadSameBook) {
        const dirPath = await appApi.getDirectory(filePath);
        const listResult = await appApi.listFolderItems(dirPath);
        if (listResult.ok) {
          const currentKey = getSeriesKeyFromName(fileName);
          const siblings = (listResult.data as any[])
            .filter((item) => (item.type === 'zip' || item.type === 'archive' || item.type === 'image') && getSeriesKeyFromName(item.name) === currentKey)
            .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
          
          setLibraryItems(siblings);

          // 🤝 [유저 특명 강화] 형제가 몇 개든 상관없이 부모 폴더 컨텍스트를 마스터로 승격하여 향후 폴더 위주 히스토리 적립 유도!
          const parentFolderName = await appApi.getBasename(dirPath);
          setLibraryFolderName(parentFolderName);
          setLibraryFolderPath(dirPath);
        }
      } else {
        // 단일 모드라도, 사이드바에 본인은 당당하게 등재!
        const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
        const targetType = ['zip','cbz','7z','rar'].includes(ext) ? 'archive' : (['png','jpg','jpeg','webp'].includes(ext) ? 'image' : 'zip');
        
        // 📐 [특명] 단일 직통 오픈 시에도 철저한 용량 계측 반영!
        const singleFileSize = await appApi.getFileSize(filePath).catch(() => 0);
        setLibraryItems([{ name: fileName, path: filePath, type: targetType, sizeBytes: singleFileSize }]);
        setLibraryFolderName(null);
        setLibraryFolderPath(null);
      }
      
    } catch (err) {
      console.error('[Universal Loader] Critical failure loading path:', err);
    } finally {
      setIsAppLoading(false);
    }
  };

  // 📚 사이드바 라이브러리 항목 클릭 핸들러
  const handleLibraryItemClick = async (filePath: string) => {
    // 🕵️‍♂️ [리팩토링 완료] 최근 열람 기록 뷰모드일 경우 만능 공통 처리기로 토스!
    if (sidebarViewMode === 'recent') {
      return handleRecentItemSelect(filePath);
    }

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
          setIsAppLoading(true); // ⏳ [긴급 가동] 메타데이터 로딩 시 가드 가동!
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
        } finally {
          setIsAppLoading(false); // 🏁 작전 해제
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

      if (!filePaths || filePaths.length === 0) return;

      setIsAppLoading(true); // ⏳ [작전 개시] 대량 파일 메타데이터 연산 가드 발동!
      try {
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
      } finally {
        setIsAppLoading(false); // 🏁 해제
      }
    } catch (error) {
      console.error('Failed to add converter source', error);
    }
  };

  const handleAddAllConverterSource = async () => {
    setWorkspaceMode('converter');
    const appApi = (window as any).appApi;

    setIsAppLoading(true); // ⏳ [작전 개시] 전수 로딩 연산 돌입!
    try {
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
    } finally {
      setIsAppLoading(false); // 🏁 종료 해제
    }
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
  
  // 🖼️ [지능형 디텍터] 현재 개방된 파일의 낱개 이미지 여부 감별 엔진
  const isLooseImageMode = useMemo(() => {
    if (!zipPath) return false;
    return /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(zipPath);
  }, [zipPath]);

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
      // 2. 이전 책/파일로 넘어가서 소프트 랜딩!
      // 🖼️ [유저 특명: 버그 폭발 소탕] 낱개 파일 이미지 모드이고 양면보기인 경우, 앞장 2개분을 쾌속 점프!
      const stepScale = (isLooseImageMode && viewMode === '2') ? 2 : 1;
      const targetIdx = Math.max(0, currentLibraryIndex - stepScale);
      const targetItem = libraryItems[targetIdx];

      // 🖼️ [유저 명령] 이미지는 권 이동 개념이 아니므로 알림 통과!
      const isImageTarget = targetItem?.type === 'image' || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(targetItem?.path || '');

      if (!isImageTarget) {
        dispatchNotice('이전 권으로 이동합니다');
      }
      void loadZipIntoViewer(targetItem.path, -1);
    }
  }, [currentIndex, pageStep, canGoPrevLibrary, currentLibraryIndex, libraryItems, loadZipIntoViewer, isAppLoading, dispatchNotice, isLooseImageMode, viewMode]);

  const handleNavNext = useCallback(() => {
    // 🔒 [유저 엄명: 스킵 가드] 로딩 중일 때 어떠한 중복 명령 유입도 허용하지 않음!
    if (isAppLoading) return;

    if (currentIndex < pages.length - pageStep) {
      setCurrentIndex(prev => Math.min(pages.length - 1, prev + pageStep)); // 1. 내부 페이지 앞으로
    } else if (canGoNextLibrary) {
      // 2. 다음 책/파일로 넘어가서 시작!
      // 🖼️ [유저 특명: 버그 폭발 소탕] 낱개 파일 이미지 모드이고 양면보기인 경우, 뒷장 2개분을 쾌속 점프!
      const stepScale = (isLooseImageMode && viewMode === '2') ? 2 : 1;
      const targetIdx = Math.min(libraryItems.length - 1, currentLibraryIndex + stepScale);
      const targetItem = libraryItems[targetIdx];

      const isImageTarget = targetItem?.type === 'image' || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(targetItem?.path || '');

      if (!isImageTarget) {
        dispatchNotice('다음 권으로 이동합니다');
      }
      void loadZipIntoViewer(targetItem.path, 0);
    }
  }, [currentIndex, pages.length, pageStep, canGoNextLibrary, currentLibraryIndex, libraryItems, loadZipIntoViewer, isAppLoading, dispatchNotice, isLooseImageMode, viewMode]);

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

  // 🚀 [지능형 하이브리드 패커] ZIP파일 다중 페이지와 낱개 이미지 2쪽 보기를 단일 스펙트럼 통신 파이프로 통합!
  const pagesToRender = useMemo(() => {
    if (!zipPath) return [];

    // 🔥 [유저 특명] 낱개 파일 이미지이면서 양면(2쪽) 보기일 때, 본인 파일과 다음 인접 형제 파일을 동시에 묶어 출격!!
    if (isLooseImageMode && viewMode === '2') {
      const packets = [{ filePath: zipPath, entryName: '__IMAGE_SINGLE_ENTRY__' }];
      
      if (currentLibraryIndex !== -1 && currentLibraryIndex < libraryItems.length - 1) {
        const nextItem = libraryItems[currentLibraryIndex + 1];
        const isNextImage = nextItem?.type === 'image' || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(nextItem?.path || '');
        if (isNextImage) {
          packets.push({ filePath: nextItem.path, entryName: '__IMAGE_SINGLE_ENTRY__' });
        }
      }
      return packets;
    }

    // ZIP 압축파일 다중 열람 또는 단면 모드인 경우
    const rawActivePages = viewMode === '2'
      ? [pages[currentIndex], pages[currentIndex + 1]].filter(Boolean)
      : [pages[currentIndex]].filter(Boolean);

    return rawActivePages.map(p => ({
      filePath: zipPath,
      entryName: p.entryName
    }));
  }, [zipPath, pages, currentIndex, viewMode, isLooseImageMode, libraryItems, currentLibraryIndex]);

  // 🎹 [유저 특명] 키보드 화살표 & 🎡 마우스 휠 지능형 텔레파시 시스템 연동!
  useEffect(() => {
    // 활성화된 파일이 없거나 컨버터가 떠있으면 키보드/휠 차단
    if (!hasActiveFile || workspaceMode === 'converter') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 포커스가 인풋 창에 가 있을 때는 단축키 비활성화 (안전장치)
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'Backspace':
          e.preventDefault();
          handleNavPrev();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ': // Spacebar
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
              setCurrentIndex(Math.max(0, pages.length - (pages.length % 2 === 0 ? 2 : 1)));
            } else {
              setCurrentIndex(pages.length - 1);
            }
          }
          break;
        // 💎 [유저 특명] 쪽보기 즉시 스왑 시스템!
        case '1':
          e.preventDefault();
          setViewMode('1');
          break;
        case '2':
          e.preventDefault();
          setViewMode('2');
          break;
        // 🔍 [보너스] 메뉴판에 기재된 알파벳 스케일 스왑 엔진 가동!
        case 'f': case 'F':
          e.preventDefault();
          setImageFitMode('auto');
          break;
        case 'h': case 'H':
          e.preventDefault();
          setImageFitMode('height');
          break;
        case 'w': case 'W':
          e.preventDefault();
          setImageFitMode('width');
          break;
        case 'o': case 'O':
          e.preventDefault();
          setImageFitMode('actual');
          break;
        // 🗑️ [핵심 단축키] 메뉴판에 예고된 페이지 즉시 소각 프로세스 연동!
        case 'Delete':
          e.preventDefault();
          if (e.shiftKey) {
            handleDeletePage('left');
          } else if (e.altKey) {
            handleDeletePage('right');
          } else {
            handleDeletePage('left'); // 기본 Del 키는 현재/왼쪽 대상
          }
          break;
      }
    };

    // 🎡 [명품 휠 리스너] 스크롤이 있으면 스크롤링을 먼저 돕고, 바닥에 닿으면 페이지를 넘기는 명품 알고리즘!
    const handleWheel = (e: WheelEvent) => {
      // 🛡️ [유저 버그 리포트] 마우스가 사이드바 등 서브 영역에 올려져 있을 때는 휠 탈취 즉각 방어(중단)!
      const isInsideViewer = (e.target as HTMLElement).closest?.('.app-main-content');
      if (!isInsideViewer) return;

      // 스페이스바 스크롤링 중 등 기본 폼 활성화 상태면 방해하지 않음
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      const viewerArea = document.querySelector('.viewer-render-area');
      if (!viewerArea) return;

      const isScrollable = viewerArea.scrollHeight > viewerArea.clientHeight;
      const deltaY = e.deltaY;
      const now = Date.now();
      const throttle = 400; // ⏱️ 0.4초 쿨다운 (스팸 연사 방지)

      if (deltaY > 0) { // ⬇️ 휠 아래로 (다음)
        // 이미지가 짧아 스크롤바가 없거나, 바닥 끝까지 내려간 상태라면 페이지 넘김 허용!
        const isAtBottom = !isScrollable || (viewerArea.scrollTop + viewerArea.clientHeight >= viewerArea.scrollHeight - 10);
        if (isAtBottom) {
          if (now - lastWheelTimeRef.current > throttle) {
            lastWheelTimeRef.current = now;
            handleNavNext();
          }
          // 브라우저 밖으로 휠 이벤트가 빠져나가지 않게 봉쇄
          e.preventDefault();
        }
      } else if (deltaY < 0) { // ⬆️ 휠 위로 (이전)
        // 스크롤바가 없거나, 천장 끝에 닿은 상태라면 이전 페이지로!
        const isAtTop = !isScrollable || (viewerArea.scrollTop <= 10);
        if (isAtTop) {
          if (now - lastWheelTimeRef.current > throttle) {
            lastWheelTimeRef.current = now;
            handleNavPrev();
          }
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // ⚠️ passive: false를 주어야 e.preventDefault()를 통해 브라우저 동작을 온전히 제어 가능합니다.
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [hasActiveFile, workspaceMode, handleNavPrev, handleNavNext, pages.length, viewMode, setViewMode, setImageFitMode, handleDeletePage]);

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
        language={language} /* 🌍 [글로벌] 다국어 통신선 연결 개통! */
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
        onOpenSettings={() => setSettingsOpen(true)} // ⚙️ [신규 연결] 설정 모달 트리거 개통!
        
        // 🚀 [지능형 분기] 현재 뷰 모드에 따라 '실시간 데이터 스트림'을 자동 스위칭!
        libraryItems={sidebarViewMode === 'recent' ? recentSidebarItems : libraryItems}
        
        activeLibraryPath={workspaceMode === 'viewer' ? selectedPath : null}
        selectedLibraryPaths={[]}
        onLibraryItemClick={handleLibraryItemClick}
        
        // 🛸 [전달] 폴더 헤더는 라이브러리 모드일 때만 투사!
        libraryFolderName={sidebarViewMode === 'recent' ? null : libraryFolderName} 
        
        sidebarViewMode={sidebarViewMode} // ✨ 현재 사이드바의 영혼(모드)을 주입
        workspaceMode={workspaceMode} // 🛸 [연동] 현재 차원 정보 송신!
        onLibraryItemContextMenu={handleSidebarItemContextMenu} // 🖱️ [신규] 사이드바 우클릭 관문 연결!
        language={language} // 🌍 [글로벌] 현재 언어 상태 투사!
        onLanguageChange={setLanguage} // 📡 [글로벌] 언어 변경 피드백 채널 개방!
        onShowViewer={() => { // 🏡 [무조건 복귀] 태초의 MTC Center(초기 화면)로 강제 송환!
          setWorkspaceMode('viewer');
          setSidebarMenuOpen(false);
          setHasActiveFile(false); // 🚫 [초기화] 활성 파일 레일 비우기
          setZipPath(null);       // 🧼 [청소] 경로 데이터 소각
          setSelectedPath(null);  // 🧹 [선택 해제] 라이브러리 포커스 아웃
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
            language={language}
            pagesToRender={pagesToRender}
            viewMode={viewMode}
            imageFitMode={imageFitMode} /* 🔍 [동기화] 보기 모드 정보 하달! */
            isSidebarOpen={isSidebarOpen} // 📏 [신규] 사이드바 점유 면적 감시선 개설!
            
            // 🧭 [신규] 내비게이션 제어 신호 송신!
            showNavArrows={showNavArrows}
            canGoPrev={canGoPrevLibrary}
            canGoNext={canGoNextLibrary}
            onPrev={handleNavPrev}
            onNext={handleNavNext}
            
            // 🚀 [유저 특명] 캔버스 내부 '최근 패널'에서 아이템 클릭 시의 최종 타격 연결!!
            onSelectRecentItem={handleRecentItemSelect}

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
          onChangeMode={handleConverterModeChange} // ⚡ [신규] 통합 리모컨 연결!
          sourceItems={converterSourceItems}
          hasSidebarItems={libraryItems.length > 0}
          selectedPaths={selectedConverterPaths}
          onToggleSelection={setSelectedConverterPaths}
          onAddSource={handleAddConverterSource}
          onAddAllSource={handleAddAllConverterSource}
          onClearSource={handleClearConverterSource}
          onRemoveSourceItems={handleRemoveConverterSourceItems}
          onUpdateStatusText={setConverterStatusText} // 📡 하달받은 실시간 메시지를 상태 저장소로 업링크!
          language={language} // 🌍 [글로벌] 연합 전파선 연결 완수!
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
        totalLibrarySize={libraryItems.reduce((sum, it) => sum + (it.sizeBytes || 0), 0)} // 🔋 [초정밀 합계 파이프라인]
        isSidebarOpen={isSidebarOpen}
        canGoPrev={canGlobalPrev}
        canGoNext={canGlobalNext}
        onPrev={handleNavPrev}
        onNext={handleNavNext}
      />

      {/* 🌌 궁극의 전천후 팝업 메뉴 (🔒 뷰모드 & 스케일 모드 동기화!) */}
      {contextMenu.show && (
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
          onDeletePage={handleDeletePage} /* 🗑️ [연결] 페이지 소각 처리 엔진 */
          language={language} /* 🌍 [글로벌] 우클릭 메뉴도 다국어 무선 장착 완수! */
          onClose={() => setContextMenu(prev => ({ ...prev, show: false }))} 
        />
      )}

      {/* 📂 [유저 특명] 사이드바 전용 파일 관리 메뉴 탑재 */}
      {sidebarCtxMenu.show && (
        <SidebarContextMenu 
          x={sidebarCtxMenu.x}
          y={sidebarCtxMenu.y}
          show={sidebarCtxMenu.show}
          onClose={() => setSidebarCtxMenu(prev => ({ ...prev, show: false }))}
          onOpen={() => {
            if (sidebarCtxMenu.targetPath) loadZipIntoViewer(sidebarCtxMenu.targetPath);
          }}
          onCloseDoc={() => {
            if (sidebarCtxMenu.targetPath) handleCloseDocFromSidebar(sidebarCtxMenu.targetPath);
          }}
          onRemove={() => {
            if (sidebarCtxMenu.targetPath) handleRemoveDocFromSidebar(sidebarCtxMenu.targetPath);
          }}
          onDeleteFile={() => {
            if (sidebarCtxMenu.targetPath) handleDeleteFileFromSidebar(sidebarCtxMenu.targetPath);
          }}
        />
      )}

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
          onMouseDown={handleNoticeMouseDown}
          onMouseEnter={clearNoticeTimer} // 🛡️ 마우스 오버 시 사라지는 타이머 일시 동결!
          onMouseLeave={() => !isDraggingNotice && startNoticeTimer(1500)} // 마우스 퇴장 시 1.5초 후 부드러운 퇴장 유도!
          style={{
            position: 'fixed',
            // 📍 커스텀 드래그 좌표 유무에 따른 다이내믹 랜딩 설계
            left: noticePos ? `${noticePos.x}px` : '50%',
            top: noticePos ? `${noticePos.y}px` : '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100000,
            padding: '14px 20px',
            borderRadius: '10px',
            border: '1px solid rgba(var(--rgb-contrast), 0.18)',
            background: 'var(--bg-floating-panel)',
            color: 'var(--text-main)',
            boxShadow: isDraggingNotice ? '0 20px 50px rgba(0,0,0,0.4)' : 'var(--shadow-popup)',
            backdropFilter: 'blur(12px)',
            pointerEvents: 'auto', // 🔓 [봉인해제] 드래그 및 호버 피드백을 위한 활성화!
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: isDraggingNotice ? 'grabbing' : 'grab', // 🏎️ 지능형 마우스 포인터 메타포
            userSelect: 'none', // 드래그 중 불필요한 글자 긁힘 방어
            transition: isDraggingNotice ? 'none' : 'box-shadow 0.2s, transform 0.1s' // 실시간 드래깅 시 프레임 유실 제로화!
          }}
          title="잡아서 드래그하면 원하는 곳으로 알림창 위치가 이동합니다"
        >
          {autoMoveNotice}
        </div>
      )}

      {/* ⚙️ [유저 특명] 무한 확장 가능한 프리미엄 통합 환경 설정 허브 */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        themeMode={themeMode}
        onChangeThemeMode={setThemeMode}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        imageFitMode={imageFitMode}
        onChangeImageFitMode={setImageFitMode}
        loadSameBook={loadSameBook}
        onChangeLoadSameBook={setLoadSameBook}
        onResetSidebarWidth={() => setSidebarWidth(230)}
        onResetNoticePos={() => {
          localStorage.removeItem('mtc_notice_pos');
          setNoticePos(null);
        }}
      />

      </div>
  );
}

export default App;
