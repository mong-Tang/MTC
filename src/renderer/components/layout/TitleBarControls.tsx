import React, { useState, useEffect, useRef } from 'react';
import type { ConverterMode } from './ConverterPanel'; // 🛰️ [격상] 모드 상태 타입 공유
import { TRANSLATIONS, AppLanguage } from '../../i18n'; // 🌍 [글로벌] 다국어 번역 엔진 수혈!

/**
 * TitleBarControls
 * Equiped with Move, View, Edit subsystems and professional visual shortcuts.
 */
interface TitleBarProps {
  viewMode: '1' | '2';
  onChangeViewMode: (mode: '1' | '2') => void;
  pageReadDirection: 'ltr' | 'rtl';
  onChangePageReadDirection: (direction: 'ltr' | 'rtl') => void;
  themeMode: 'default' | 'light' | 'dark' | 'system' | 'hwasa';
  onChangeThemeMode: (mode: 'default' | 'light' | 'dark' | 'system' | 'hwasa') => void;
  
  // 🚀 Workspace Context
  workspaceMode?: 'viewer' | 'converter';
  hasActiveFile?: boolean;
  
  language?: AppLanguage; // 🌍 [글로벌] 다국어 데이터 포트 증설!
}

type ActiveMenuKey = 'view' | 'move' | 'edit';

export const TitleBarControls: React.FC<TitleBarProps> = ({ 
  viewMode, 
  onChangeViewMode, 
  pageReadDirection,
  onChangePageReadDirection,
  themeMode, 
  onChangeThemeMode,
  workspaceMode = 'viewer',
  hasActiveFile = false,
  language = 'ko' /* 🌍 기본값은 한국어로 자동 안전 랜딩 */
}) => {
  const t = TRANSLATIONS[language]; // ⚡ 실시간 현지 사전 가동!
  
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
                  // ⚡ [유저 특명] 활성화 시에도 테마 포인트 컬러로 또렷하게 락온!
                  style={{ color: activeMenu === 'move' ? 'var(--accent)' : '', opacity: activeMenu === 'move' ? 1 : '' }}
                >
                  {t.menuMove}
                </button>
                {activeMenu === 'move' && (
                  <div className="ribbon-dropdown">
                    <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>⏭️ {t.menuNextPage}</span> <span className="shortcut">Space / → / ↓</span>
                      </div>
                    </button>
                    <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>⏮️ {t.menuPrevPage}</span> <span className="shortcut">BkSpc / ← / ↑</span>
                      </div>
                    </button>
                    <div className="ribbon-divider" />
                    <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>⏩ {t.menuNext10}</span> <span className="shortcut">PgDn</span>
                      </div>
                    </button>
                    <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>⏪ {t.menuPrev10}</span> <span className="shortcut">PgUp</span>
                      </div>
                    </button>
                    <div className="ribbon-divider" />
                    <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>⏹️ {t.menuFirstPage}</span> <span className="shortcut">Home</span>
                      </div>
                    </button>
                    <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>⏺️ {t.menuLastPage}</span> <span className="shortcut">End</span>
                      </div>
                    </button>
                    <div className="ribbon-divider" />
                    <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>📚 {t.menuNextBook}</span> <span className="shortcut">Ctrl + →</span>
                      </div>
                    </button>
                    <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>📚 {t.menuPrevBook}</span> <span className="shortcut">Ctrl + ←</span>
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
                  // ⚡ [유저 특명] 활성화 시에도 테마 포인트 컬러로 또렷하게 락온!
                  style={{ color: activeMenu === 'view' ? 'var(--accent)' : '', opacity: activeMenu === 'view' ? 1 : '' }}
                >
                  {t.menuView}
                </button>
                {activeMenu === 'view' && (
                  <div className="ribbon-dropdown">
                    <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>⚙️ {t.menuFitAuto}</span> <span className="shortcut">F</span>
                      </div>
                    </button>
                    <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>🔍 {t.menuFitActual}</span> <span className="shortcut">O</span>
                      </div>
                    </button>
                    <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>↔️ {t.menuFitWidth}</span> <span className="shortcut">W</span>
                      </div>
                    </button>
                    <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>↕️ {t.menuFitHeight}</span> <span className="shortcut">H</span>
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
                        <span>👤 {t.menuSinglePage}</span> <span className="shortcut">1</span>
                      </div>
                    </button>
                    <button 
                      className={`ribbon-dropdown-item ${viewMode === '2' ? 'active-mode' : ''}`} 
                      onClick={() => { onChangeViewMode('2'); setActiveMenu(null); }}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>👥 {t.menuDoublePage}</span> <span className="shortcut">2</span>
                      </div>
                    </button>
                    <div className="ribbon-divider" />
                    <button
                      className={`ribbon-dropdown-item ${pageReadDirection === 'ltr' ? 'active-mode' : ''}`}
                      onClick={() => { onChangePageReadDirection('ltr'); setActiveMenu(null); }}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>↔ {t.menuPageDirectionLtr}</span>
                      </div>
                    </button>
                    <button
                      className={`ribbon-dropdown-item ${pageReadDirection === 'rtl' ? 'active-mode' : ''}`}
                      onClick={() => { onChangePageReadDirection('rtl'); setActiveMenu(null); }}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>↔ {t.menuPageDirectionRtl}</span>
                      </div>
                    </button>
                    <div className="ribbon-divider" />

                    <button
                      className={`ribbon-dropdown-item ${themeMode === 'default' ? 'active-mode' : ''}`}
                      onClick={() => { onChangeThemeMode('default'); setActiveMenu(null); }}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>⚓ {t.menuThemeDefault}</span>
                      </div>
                    </button>
                    
                    <button
                      className={`ribbon-dropdown-item ${themeMode === 'hwasa' ? 'active-mode' : ''}`}
                      onClick={() => { onChangeThemeMode('hwasa'); setActiveMenu(null); }}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>🌸 {t.menuThemeHwasa}</span>
                      </div>
                    </button>
                    <button
                      className={`ribbon-dropdown-item ${themeMode === 'light' ? 'active-mode' : ''}`}
                      onClick={() => { onChangeThemeMode('light'); setActiveMenu(null); }}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>☀️ {t.menuThemeLight}</span>
                      </div>
                    </button>
                    <button
                      className={`ribbon-dropdown-item ${themeMode === 'dark' ? 'active-mode' : ''}`}
                      onClick={() => { onChangeThemeMode('dark'); setActiveMenu(null); }}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>🌙 {t.menuThemeDark}</span>
                      </div>
                    </button>
                    <button
                      className={`ribbon-dropdown-item ${themeMode === 'system' ? 'active-mode' : ''}`}
                      onClick={() => { onChangeThemeMode('system'); setActiveMenu(null); }}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>💻 {t.menuThemeSystem}</span>
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
                  // ⚡ [유저 특명] 활성화 시에도 테마 포인트 컬러로 또렷하게 락온!
                  style={{ color: activeMenu === 'edit' ? 'var(--accent)' : '', opacity: activeMenu === 'edit' ? 1 : '' }}
                >
                  {t.menuEdit}
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
                        <span>🗑️ {t.menuDeletePage}</span> <span className="shortcut">Delete</span>
                      </div>
                    </button>
                    <button 
                      className="ribbon-dropdown-item" 
                      disabled={viewMode !== '2'} 
                      onClick={() => setActiveMenu(null)}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>◀️ {t.menuDeleteLeft}</span> <span className="shortcut">Shift+Del</span>
                      </div>
                    </button>
                    <button 
                      className="ribbon-dropdown-item" 
                      disabled={viewMode !== '2'} 
                      onClick={() => setActiveMenu(null)}
                    >
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>▶️ {t.menuDeleteRight}</span> <span className="shortcut">Alt+Del</span>
                      </div>
                    </button>
                    <div className="ribbon-divider" />
                    <button className="ribbon-dropdown-item" onClick={() => setActiveMenu(null)}>
                      <span className="check-slot">✓</span>
                      <div className="item-label-group">
                        <span>➕ {t.menuInsertAfter}</span> <span className="shortcut">Insert</span>
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
          // 🚫 [유저 특명 초정밀 처방] 브라우저의 강제 회색 왜곡(User Agent graytext)을 차단하기 위해 
          // HTML 네이티브 disabled 속성을 제거하고 pointer-events 스타일링으로만 논리적 잠금을 수행합니다!
          onClick={() => {
            if (workspaceMode !== 'viewer' || !hasActiveFile) return; // 만약의 사태 대비 안전핀
            setExpanded(!isExpanded);
            if (isExpanded) setActiveMenu(null); 
          }} 
          title={workspaceMode !== 'viewer' ? t.menuViewerOnly : (!hasActiveFile ? t.menuOpenFileFirst : t.menuExpand)}
          style={{ 
            // 🎨 브라우저의 개입이 사라졌으므로 투명도 제어만으로 완벽한 톤 조율이 가능해졌습니다!
            opacity: (workspaceMode !== 'viewer' || !hasActiveFile) ? 0.6 : 1.0, 
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

        <button className="win-btn" onClick={handleMinimize} title={t.winMinimize}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button className="win-btn" onClick={handleMaximize} title={t.winMaximize}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="1"></rect>
          </svg>
        </button>
        <button className="win-btn btn-close" onClick={handleClose} title={t.winClose}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </>
  );
};
