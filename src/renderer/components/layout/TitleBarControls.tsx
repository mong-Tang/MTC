import React, { useState, useEffect, useRef } from 'react';

/**
 * TitleBarControls
 * Equiped with Move, View, Edit subsystems and professional visual shortcuts.
 */
interface TitleBarProps {
  viewMode: '1' | '2';
  onChangeViewMode: (mode: '1' | '2') => void;
  themeMode: 'default' | 'light' | 'dark' | 'system';
  onChangeThemeMode: (mode: 'default' | 'light' | 'dark' | 'system') => void;
}

export const TitleBarControls: React.FC<TitleBarProps> = ({ viewMode, onChangeViewMode, themeMode, onChangeThemeMode }) => {
  
  const [isExpanded, setExpanded] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'view' | 'move' | 'edit' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const appApi = (window as any).appApi;

  // Auto-close EVERYTHING when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMinimize = () => appApi?.minimizeWindow?.();
  const handleMaximize = () => appApi?.maximizeWindow?.();
  const handleClose = () => appApi?.closeWindow?.();

  const toggleSubmenu = (menuName: 'view' | 'move' | 'edit') => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleMouseEnterMenu = (menuName: 'view' | 'move' | 'edit') => {
    if (activeMenu !== null) setActiveMenu(menuName);
  };

  return (
    <>
      <div className="titlebar-draggable-region"></div>
      
      <div className="window-controls" ref={containerRef}>
        
        {/* 🌊 [확장 리본] */}
        <div className={`title-menu-ribbon ${isExpanded ? 'expanded' : ''}`}>
          
          {/* 🧭 [1번 타자] 이동 */}
          <div className="ribbon-dropdown-container">
            <button 
              className="ribbon-item" 
              onClick={() => toggleSubmenu('move')}
              onMouseEnter={() => handleMouseEnterMenu('move')}
              style={{ color: activeMenu === 'move' ? 'var(--text-main)' : '' }}
            >
              이동
            </button>
            {activeMenu === 'move' && (
              <div className="ribbon-dropdown">
                <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>⏭️ 다음 페이지</span> <span className="shortcut">Space / → / ↓</span>
                  </div>
                </button>
                <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>⏮️ 이전 페이지</span> <span className="shortcut">BkSpc / ← / ↑</span>
                  </div>
                </button>
                <div className="ribbon-divider" />
                <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>⏩ 10 페이지 앞으로</span> <span className="shortcut">PgDn</span>
                  </div>
                </button>
                <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>⏪ 10 페이지 뒤로</span> <span className="shortcut">PgUp</span>
                  </div>
                </button>
                <div className="ribbon-divider" />
                <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>⏹️ 첫 페이지</span> <span className="shortcut">Home</span>
                  </div>
                </button>
                <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>⏺️ 마지막 페이지</span> <span className="shortcut">End</span>
                  </div>
                </button>
                <div className="ribbon-divider" />
                <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>📚 다음권 보기</span> <span className="shortcut">Ctrl + →</span>
                  </div>
                </button>
                <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>📚 이전권 보기</span> <span className="shortcut">Ctrl + ←</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* 🔍 [2번 타자] 보기 */}
          <div className="ribbon-dropdown-container">
            <button 
              className="ribbon-item" 
              onClick={() => toggleSubmenu('view')}
              onMouseEnter={() => handleMouseEnterMenu('view')}
              style={{ color: activeMenu === 'view' ? 'var(--text-main)' : '' }}
            >
              보기
            </button>
            {activeMenu === 'view' && (
              <div className="ribbon-dropdown">
                <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>⚙️ 자동 맞춤</span> <span className="shortcut">F</span>
                  </div>
                </button>
                <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>🔍 1:1 맞춤</span> <span className="shortcut">O</span>
                  </div>
                </button>
                <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>↔️ 폭 맞춤</span> <span className="shortcut">W</span>
                  </div>
                </button>
                <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>↕️ 높이 맞춤</span> <span className="shortcut">H</span>
                  </div>
                </button>
                <div className="ribbon-divider" />
                
                {/* 💎 뷰모드 체크 연동 */}
                <button 
                  className={`ribbon-dropdown-item ${viewMode === '1' ? 'active-mode' : ''}`} 
                  onClick={() => { onChangeViewMode('1'); setActiveMenu(null); }}
                >
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>👤 1쪽 보기</span> <span className="shortcut">1</span>
                  </div>
                </button>
                <button 
                  className={`ribbon-dropdown-item ${viewMode === '2' ? 'active-mode' : ''}`} 
                  onClick={() => { onChangeViewMode('2'); setActiveMenu(null); }}
                >
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>👥 2쪽 보기</span> <span className="shortcut">2</span>
                  </div>
                </button>
                <div className="ribbon-divider" />
                <button
                  className={`ribbon-dropdown-item ${themeMode === 'default' ? 'active-mode' : ''}`}
                  onClick={() => { onChangeThemeMode('default'); setActiveMenu(null); }}
                >
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>기본설정</span>
                  </div>
                </button>
                <button
                  className={`ribbon-dropdown-item ${themeMode === 'light' ? 'active-mode' : ''}`}
                  onClick={() => { onChangeThemeMode('light'); setActiveMenu(null); }}
                >
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>라이트</span>
                  </div>
                </button>
                <button
                  className={`ribbon-dropdown-item ${themeMode === 'dark' ? 'active-mode' : ''}`}
                  onClick={() => { onChangeThemeMode('dark'); setActiveMenu(null); }}
                >
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>다크</span>
                  </div>
                </button>
                <button
                  className={`ribbon-dropdown-item ${themeMode === 'system' ? 'active-mode' : ''}`}
                  onClick={() => { onChangeThemeMode('system'); setActiveMenu(null); }}
                >
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>시스템</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* ✏️ [3번 타자] 편집 */}
          <div className="ribbon-dropdown-container">
            <button 
              className="ribbon-item" 
              onClick={() => toggleSubmenu('edit')}
              onMouseEnter={() => handleMouseEnterMenu('edit')}
              style={{ color: activeMenu === 'edit' ? 'var(--text-main)' : '' }}
            >
              편집
            </button>
            {activeMenu === 'edit' && (
              <div className="ribbon-dropdown">
                <button 
                  className="ribbon-dropdown-item" 
                  disabled={viewMode !== '1'} 
                  onClick={() => setActiveMenu(null)}
                >
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>🗑️ 현재 페이지 삭제</span> <span className="shortcut">Delete</span>
                  </div>
                </button>
                <button 
                  className="ribbon-dropdown-item" 
                  disabled={viewMode !== '2'} 
                  onClick={() => setActiveMenu(null)}
                >
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>◀️ 왼쪽 페이지 삭제</span> <span className="shortcut">Shift+Del</span>
                  </div>
                </button>
                <button 
                  className="ribbon-dropdown-item" 
                  disabled={viewMode !== '2'} 
                  onClick={() => setActiveMenu(null)}
                >
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>▶️ 오른쪽 페이지 삭제</span> <span className="shortcut">Alt+Del</span>
                  </div>
                </button>
                <div className="ribbon-divider" />
                <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                  <span className="check-slot">✓</span>
                  <div className="item-label-group">
                    <span>➕ 페이지 다음에 추가</span> <span className="shortcut">Insert</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 🍔 메인 햄버거 토글 */}
        <button 
          className="win-btn btn-menu" 
          onClick={() => {
            setExpanded(!isExpanded);
            if (isExpanded) setActiveMenu(null); 
          }} 
          title="확장 메뉴" 
          style={{ opacity: 0.7, color: isExpanded ? 'var(--accent)' : 'inherit' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <button className="win-btn" onClick={handleMinimize} title="최소화">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button className="win-btn" onClick={handleMaximize} title="최대화">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="1"></rect>
          </svg>
        </button>
        <button className="win-btn btn-close" onClick={handleClose} title="닫기">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </>
  );
};
