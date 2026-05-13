import React, { useState, useEffect, useRef } from 'react';
import type { ConverterMode } from './ConverterPanel'; // 🛰️ [격상] 모드 상태 타입 공유

/**
 * TitleBarControls
 * Equiped with Move, View, Edit subsystems and professional visual shortcuts.
 */
interface TitleBarProps {
  viewMode: '1' | '2';
  onChangeViewMode: (mode: '1' | '2') => void;
  themeMode: 'default' | 'light' | 'dark' | 'system' | 'hwasa';
  onChangeThemeMode: (mode: 'default' | 'light' | 'dark' | 'system' | 'hwasa') => void;
  
  // 🚀 Workspace Context
  workspaceMode?: 'viewer' | 'converter';
  hasActiveFile?: boolean;
}

type ActiveMenuKey = 'view' | 'move' | 'edit';

export const TitleBarControls: React.FC<TitleBarProps> = ({ 
  viewMode, 
  onChangeViewMode, 
  themeMode, 
  onChangeThemeMode,
  workspaceMode = 'viewer',
  hasActiveFile = false
}) => {
  
  const [isExpanded, setExpanded] = useState(false);
  const [activeMenu, setActiveMenu] = useState<ActiveMenuKey | null>(null);
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

  const toggleSubmenu = (menuName: ActiveMenuKey) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleMouseEnterMenu = (menuName: ActiveMenuKey) => {
    if (activeMenu !== null) setActiveMenu(menuName);
  };

  // 🏎️ [초정밀 고성능 JS 드래그 엔진 가동] 
  const handleDragMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // 좌클릭만 허용
    
    // 1. Main 프로세스에 시작 신호탄 발사 (오프셋 캡처)
    appApi?.startWindowDrag?.({ screenX: e.screenX, screenY: e.screenY });

    let rafId: number | null = null;

    const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
      // ⚡ GPU 가속 프레임 유실을 막기 위해 RAF로 쓰로틀링
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        appApi?.moveWindow?.({ screenX: moveEvent.screenX, screenY: moveEvent.screenY });
        rafId = null;
      });
    };

    const handleGlobalMouseUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };

    // 🌎 윈도우 창 밖으로 마우스가 튀어 나가도 부드럽게 추적하기 위해 전역 리스너 장착!
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
  };

  return (
    <>
      {/* 🚀 [궁극의 하이브리드 아키텍처] CSS drag를 걷어내고, 100% 완벽한 커서 컨트롤과 초정밀 JS 드래그 엔진이 통합된 구역 */}
      <div 
        className="titlebar-draggable-region"
        onMouseDown={handleDragMouseDown}
        onDoubleClick={handleMaximize}
        title="창 잡고 끌기 (더블클릭 시 최대화)"
      ></div>

      {/* 🛸 [이동 완수] 컨버터 통합 헤더는 ConverterPanelShell로 귀환 조치됨! */}
      
      <div className="window-controls" ref={containerRef}>
        
        {/* 🌊 [확장 리본] */}
        <div className={`title-menu-ribbon ${isExpanded ? 'expanded' : ''}`}>

          {/* 뷰어 전용 메뉴 3총사 (컨버터 모드일 땐 비지블 = 0!) */}
          {workspaceMode === 'viewer' && (
            <>
              {/* 🧭 [2번 타자] 이동 */}
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

              {/* 🔍 [3번 타자] 보기 */}
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
                        <span>⚓ 기본설정</span>
                      </div>
                    </button>
                    
                    <button
                      className={`ribbon-dropdown-item ${themeMode === 'hwasa' ? 'active-mode' : ''}`}
                      onClick={() => { onChangeThemeMode('hwasa'); setActiveMenu(null); }}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>🌸 화사함</span>
                      </div>
                    </button>
                    <button
                      className={`ribbon-dropdown-item ${themeMode === 'light' ? 'active-mode' : ''}`}
                      onClick={() => { onChangeThemeMode('light'); setActiveMenu(null); }}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>☀️ 라이트</span>
                      </div>
                    </button>
                    <button
                      className={`ribbon-dropdown-item ${themeMode === 'dark' ? 'active-mode' : ''}`}
                      onClick={() => { onChangeThemeMode('dark'); setActiveMenu(null); }}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>🌙 다크</span>
                      </div>
                    </button>
                    <button
                      className={`ribbon-dropdown-item ${themeMode === 'system' ? 'active-mode' : ''}`}
                      onClick={() => { onChangeThemeMode('system'); setActiveMenu(null); }}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>💻 시스템</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* ✏️ [4번 타자] 편집 */}
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
            </>
          )}
        </div>

        {/* 🍔 메인 햄버거 토글 */}
        <button 
          className={`win-btn btn-titlebar-hamburger ${(workspaceMode !== 'viewer' || !hasActiveFile) ? 'disabled' : ''}`} 
          disabled={workspaceMode !== 'viewer' || !hasActiveFile}
          onClick={() => {
            setExpanded(!isExpanded);
            if (isExpanded) setActiveMenu(null); 
          }} 
          title={workspaceMode !== 'viewer' ? '이 메뉴는 뷰어 전용입니다' : (!hasActiveFile ? '파일을 먼저 열어주세요' : '확장 메뉴')}
          style={{ 
            opacity: (workspaceMode !== 'viewer' || !hasActiveFile) ? 0.25 : 0.7, 
            color: isExpanded ? 'var(--accent)' : 'inherit',
            cursor: (workspaceMode !== 'viewer' || !hasActiveFile) ? 'default' : 'pointer',
            pointerEvents: (workspaceMode !== 'viewer' || !hasActiveFile) ? 'none' : 'auto' 
          }}
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
