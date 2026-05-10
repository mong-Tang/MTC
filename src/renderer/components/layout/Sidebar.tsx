import React from 'react';
import { IconFile, IconFolder, IconPlay, IconSettings } from '../ui/Icons';

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
  onLibraryItemClick?: (path: string) => void;
  libraryFolderName?: string | null; // 📂 [추가] 라이브러리 그룹 폴더 명칭
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, isMenuOpen, onOpenConverter, onOpenFile, onOpenFolder, onFileSelect,
  loadSameBook, onToggleLoadSameBook,
  libraryItems = [], activeLibraryPath = null, onLibraryItemClick,
  libraryFolderName = null // 📂 기본값 설정
}) => {
  return (
    <aside className={`app-sidebar ${!isOpen ? 'collapsed' : ''}`}>
      <header className="sidebar-header">
        라이브러리
      </header>

      {/* 🚀 [신규] 스르륵 열리며 아래 리스트를 밀어내는 메뉴판 패널 */}
      <div className={`sidebar-menu-panel ${isMenuOpen ? 'open' : ''}`}>
        <div className="menu-list">
          {/* 📍 [절대 좌표 래퍼] 버튼을 감싸는 절대 기준점 생성! */}
          <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
            <button className="menu-btn" onClick={onOpenFile}>
              <IconFile />
              파일 열기
            </button>
            
            {/* 🛡️ [초강경 우측 잠금] 버튼 우측 벽에 완전히 못 박아버림! */}
            <label 
              className="custom-toggle-label" 
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
                className="invisible-check" 
                checked={loadSameBook} 
                onChange={(e) => onToggleLoadSameBook(e.target.checked)} 
              />
              <span className="custom-checkbox-ui"></span>
              <span className="option-text" style={{ fontSize: '0.7rem', opacity: 0.6 }}>(같은책)</span>
            </label>
          </div>

          <button className="menu-btn" onClick={onOpenFolder}>
            <IconFolder />
            폴더 열기
          </button>
          {/* 💎 컨버터 모달을 여는 핵심 진입로! */}
          <button className="menu-btn" onClick={onOpenConverter}>
            <IconPlay />
            콘텐츠 변환
          </button>
          <button className="menu-btn" onClick={() => console.log('Settings open')}>
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
              <div className="folder-item-header">
                <IconFolder />
                <span className="folder-name" title={libraryFolderName}>
                  {libraryFolderName}
                </span>
              </div>
            )}
            
            {/* 📜 하위 파일 리스트 (폴더 밑으로 쏙 들어가게 들여쓰기!) */}
            <div className={libraryFolderName ? "file-list-nested" : "file-list-flat"}>
              {libraryItems.map((item) => (
                <div 
                  key={item.path} 
                  className={`file-item ${activeLibraryPath === item.path ? 'active' : ''}`}
                  onClick={() => onLibraryItemClick && onLibraryItemClick(item.path)}
                  title={item.name}
                >
                  <IconFile />
                  <span className="file-name-text">
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="tree-info" style={{ opacity: 0.3, fontSize: '0.8rem', padding: '20px', textAlign: 'center' }}>
            선택된 라이브러리가 없습니다.
          </div>
        )}
      </div>
    </aside>
  );
};
