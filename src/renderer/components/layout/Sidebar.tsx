import React from 'react';
import { IconFile, IconFolder, IconPlay, IconSettings, IconImage, IconZip } from '../ui/Icons';

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
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, isMenuOpen, onOpenConverter, onOpenFile, onOpenFolder, onFileSelect,
  loadSameBook, onToggleLoadSameBook,
  libraryItems = [], activeLibraryPath = null, selectedLibraryPaths = [], onLibraryItemClick,
  libraryFolderName = null, // 📂 기본값 설정
  workspaceMode = 'viewer',
  onShowViewer
}) => {
  const selectedPathSet = new Set(selectedLibraryPaths);
  return (
    <aside className={`app-sidebar ${!isOpen ? 'collapsed' : ''}`}>
      <header className="sidebar-header">
        라이브러리
      </header>

      {/* 🚀 [신규] 스르륵 열리며 아래 리스트를 밀어내는 메뉴판 패널 */}
      <div className={`sidebar-menu-panel ${isMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-menu-list">
          {/* 📍 [절대 좌표 래퍼] 버튼을 감싸는 절대 기준점 생성! */}
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            <button className="sidebar-menu-btn" onClick={onOpenFile}>
              <IconFile />
              파일 열기
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
              <span className="sidebar-option-text" style={{ fontSize: '0.7rem', opacity: 0.6 }}>(같은책)</span>
            </label>
          </div>

          <button className="sidebar-menu-btn" onClick={onOpenFolder}>
            <IconFolder />
            폴더 열기
          </button>
          {/* 💎 [공간 초월 연동] 컨버터와 뷰어(MTC Center)를 자재로 넘나드는 디멘션 스위치! */}
          {workspaceMode === 'converter' ? (
            <button className="sidebar-menu-btn" onClick={onShowViewer}>
              <IconImage />
              MTC Center 실행
            </button>
          ) : (
            <button className="sidebar-menu-btn" onClick={onOpenConverter}>
              <IconPlay />
              컨버터 실행
            </button>
          )}
          <button className="sidebar-menu-btn" onClick={() => console.log('Settings open')}>
            <IconSettings />
            설정
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
                  className={`sidebar-file-item ${(activeLibraryPath === item.path || selectedPathSet.has(item.path)) ? 'active' : ''}`}
                  onClick={() => onLibraryItemClick && onLibraryItemClick(item.path)}
                  title={item.name}
                >
                  {/* 🚥 [유저 피드백 반영] 파일 타입별 동적 이모지(아이콘) 교체 엔진 가동! */}
                  {item.type === 'zip' || item.type === 'archive' ? (
                    <IconZip />
                  ) : item.type === 'image' ? (
                    <IconImage />
                  ) : (
                    <IconFile />
                  )}
                  <span className="sidebar-file-name-text">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="sidebar-tree-info" style={{ opacity: 0.3, fontSize: '0.8rem', padding: '20px', textAlign: 'center' }}>
            선택된 라이브러리가 없습니다.
          </div>
        )}
      </div>
    </aside>
  );
};
