import React from 'react';
import { IconFile, IconFolder, IconPlay, IconSettings, IconImage, IconZip, IconDots, IconHome } from '../ui/Icons';
import { TRANSLATIONS } from '../../i18n';
import type { AppLanguage } from '../../i18n';

interface SidebarProps {
  isOpen: boolean;
  isMenuOpen: boolean;
  onOpenConverter: () => void;
  onOpenFile?: () => void; // ⚡ [신규] 진짜 파일 다이얼로그 트리거!
  onOpenFolder?: () => void; // 📂 [신규] 폴더 열기 트리거!
  onFileSelect?: () => void; 
  loadSameBook: boolean;
  onToggleLoadSameBook: (checked: boolean) => void;
  libraryItems?: Array<{ name: string; path: string; type: string }>;
  activeLibraryPath?: string | null;
  selectedLibraryPaths?: string[];
  onLibraryItemClick?: (path: string) => void;
  libraryFolderName?: string | null; // 📂 [추가] 라이브러리 그룹 폴더 명칭
  workspaceMode?: 'viewer' | 'converter'; // 🛰️ [신규] 현재 탑승 중인 차원(모드) 정보
  onShowViewer?: () => void; // 🏡 [신규] 메인 'MTC Center'로의 회귀 신호 발생기
  sidebarWidth?: number; // 📏 [추가] 현재 사이드바의 리사이즈 실측 너비 정보
  onLibraryItemContextMenu?: (e: React.MouseEvent, path: string) => void; // 🖱️ [유저 특명] 우클릭 팝업 시동 엔진!
  sidebarViewMode?: 'library' | 'recent'; // 🛸 [신규] 사이드바 현재 뷰 모드 판별자
  onOpenSettings?: () => void; // ⚙️ [신규] 설정 모달 트리거 게이트웨이
  language: AppLanguage; // 🌍 [글로벌] 현재 언어 정보
  onLanguageChange: (lang: AppLanguage) => void; // 📡 [글로벌] 언어 변경 명령 채널
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, isMenuOpen, onOpenConverter, onOpenFile, onOpenFolder, onFileSelect,
  loadSameBook, onToggleLoadSameBook,
  libraryItems = [], activeLibraryPath = null, selectedLibraryPaths = [], onLibraryItemClick,
  libraryFolderName = null, // 📂 기본값 설정
  workspaceMode = 'viewer',
  onShowViewer,
  sidebarWidth = 180,
  onLibraryItemContextMenu,
  sidebarViewMode = 'library', // ✨ 기본값은 평화로운 라이브러리
  onOpenSettings,
  language,
  onLanguageChange
}) => {
  const selectedPathSet = new Set(selectedLibraryPaths);
  const t = TRANSLATIONS[language]; // ⚡ 번역 객체 고속 소환
  
  return (
    <aside className={`app-sidebar ${!isOpen ? 'collapsed' : ''}`}>
      <header className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{sidebarViewMode === 'recent' ? t.recentRecords : t.library}</span>
        
        {/* 🌍 [초소형 럭셔리 모드 제어실] 한/영 토글 캡슐 */}
        <div className="lang-toggle-wrapper" onClick={(e) => e.stopPropagation()}>
          <button 
            type="button"
            className={`lang-btn ${language === 'ko' ? 'active' : ''}`}
            onClick={() => onLanguageChange('ko')}
            title="한국어 (Korean)"
          >
            KO
          </button>
          <button 
            type="button"
            className={`lang-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => onLanguageChange('en')}
            title="English"
          >
            EN
          </button>
        </div>
      </header>

      {/* 🚀 [신규] 스르륵 열리며 아래 리스트를 밀어내는 메뉴판 패널 */}
      <div className={`sidebar-menu-panel ${isMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-menu-list">
          {/* 📍 [절대 좌표 래퍼] 버튼을 감싸는 절대 기준점 생성! */}
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            <button className="sidebar-menu-btn" onClick={onOpenFile}>
              <IconFile />
              {t.openFile}
            </button>
            
            {/* 🛡️ [초강경 우측 잠금] 버튼 우측 벽에 완전히 못 박아버림! */}
            <label 
              className="sidebar-toggle-label" 
              onClick={(e) => e.stopPropagation()} 
              style={{ 
                position: 'absolute', 
                right: '16px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                zIndex: 10 // 버튼 위에서 당당하게 군림!
              }}
            >
              <input 
                type="checkbox" 
                className="sidebar-invisible-check" 
                checked={loadSameBook} 
                onChange={(e) => onToggleLoadSameBook(e.target.checked)} 
              />
              <span className="sidebar-checkbox-ui"></span>
              <span className="sidebar-option-text" style={{ fontSize: '0.7rem', opacity: 0.6 }}>{t.sameBook}</span>
            </label>
          </div>

          <button className="sidebar-menu-btn" onClick={onOpenFolder}>
            <IconFolder />
            {t.openFolder}
          </button>

          {/* 🏠 [통합 홈 버튼] 사이드바에서는 언제나 초기 화면(MTC Center) 복귀 경로만 상시 개방합니다. */}
          <button className="sidebar-menu-btn" onClick={onShowViewer}>
            <IconHome />
            MTC Center
          </button>
          <button className="sidebar-menu-btn" onClick={onOpenSettings}>
            <IconSettings />
            {t.settings}
          </button>
        </div>
      </div>

      {/* 🌊 밀려 내려가는 유연한 콘텐츠 리스트 */}
      <div className="sidebar-content">
        {libraryItems && libraryItems.length > 0 ? (
          <div className="library-list-container">
            {/* 📂 폴더명 헤더 (있을 때만 영광스럽게 등장!) */}
            {libraryFolderName && (
              <div className="sidebar-folder-header">
                <IconFolder />
                <span className="sidebar-folder-name" title={libraryFolderName}>
                  {libraryFolderName}
                </span>
              </div>
            )}
            
            {/* 📜 하위 파일 리스트 (폴더 밑으로 쏙 들어가게 들여쓰기!) */}
            <div className={libraryFolderName ? "sidebar-file-list-nested" : "sidebar-file-list-flat"}>
              {libraryItems.map((item) => (
                <div 
                  key={item.path} 
                  className={`sidebar-file-item ${(activeLibraryPath === item.path || selectedPathSet.has(item.path)) ? 'active' : ''} ${item.type === 'recent' ? 'is-recent' : ''}`}
                  onClick={() => onLibraryItemClick && onLibraryItemClick(item.path)}
                  onContextMenu={(e) => {
                    e.preventDefault(); // 기본 브라우저 메뉴 차단
                    onLibraryItemContextMenu && onLibraryItemContextMenu(e, item.path);
                  }}
                  title={item.name}
                >
                  {/* 🚥 [유저 피드백 반영] 파일 타입별 동적 이모지(아이콘) 교체 엔진 가동! */}
                  {item.type === 'recent' ? (
                    <IconPlay /> // ✨ 아우라는 CSS가 담당합니다!
                  ) : item.type === 'zip' || item.type === 'archive' ? (
                    <IconZip />
                  ) : item.type === 'image' ? (
                    <IconImage />
                  ) : (
                    <IconFile />
                  )}
                  <span className="sidebar-file-name-text" style={{ flex: 1 }}>
                    {item.name}
                  </span>
                  
                  {/* 🍔 [유저 특명] 파일 관리 햄버거 팝업 호출용 막둥이 버튼 탑재! */}
                  <button 
                    className="sidebar-item-action-btn"
                    title={t.fileMenu}
                    onClick={(e) => {
                      e.stopPropagation(); // 부모 클릭(파일 열기) 이벤트 간섭 차단!
                      onLibraryItemContextMenu && onLibraryItemContextMenu(e as any, item.path);
                    }}
                  >
                    <IconDots />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="sidebar-tree-info" style={{ opacity: 0.65, fontSize: '0.8rem', padding: '20px', textAlign: 'center' }}>
            {t.noLibrary}
          </div>
        )}
      </div>
    </aside>
  );
};
