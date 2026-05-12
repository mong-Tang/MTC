import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  show: boolean;
  onClose: () => void;
  viewMode: '1' | '2';
  onChangeViewMode: (mode: '1' | '2') => void;
  themeMode: 'default' | 'light' | 'dark' | 'system';
  onChangeThemeMode: (mode: 'default' | 'light' | 'dark' | 'system') => void;
  imageFitMode: 'auto' | 'actual' | 'width' | 'height'; // 🔍 [신규] 스케일 모드 수신
  onChangeImageFitMode: (mode: 'auto' | 'actual' | 'width' | 'height') => void; // ⚡ 스케일 변경 위임
  onDeletePage?: (target: 'left' | 'right') => void; // 🗑️ [신규] 페이지 소각 처리기 수신!
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ 
  x, y, show, onClose, viewMode, onChangeViewMode, themeMode, onChangeThemeMode, imageFitMode, onChangeImageFitMode, onDeletePage
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: y, left: x });
  const [isThemeSubmenuOpen, setThemeSubmenuOpen] = useState(false);
  const [isNavSubmenuOpen, setNavSubmenuOpen] = useState(false); // 🧭 [신규] 이동 서브메뉴 상태 추가!

  useLayoutEffect(() => {
    if (!show || !menuRef.current) return;
    const menuRect = menuRef.current.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    let finalX = x;
    let finalY = y;
    if (x + menuRect.width > winWidth) finalX = x - menuRect.width;
    if (y + menuRect.height > winHeight) finalY = y - menuRect.height;
    finalX = Math.max(5, finalX);
    finalY = Math.max(5, finalY);
    setCoords({ top: finalY, left: finalX });
  }, [show, x, y]);

  useEffect(() => {
    if (!show) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }, 50);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [show, onClose]);

  useEffect(() => {
    if (!show) {
      setThemeSubmenuOpen(false);
      setNavSubmenuOpen(false); // 🧹 [리셋] 메뉴가 닫히면 서브메뉴 상태도 초기화!
    }
  }, [show]);

  if (!show) return null;

  return (
    <div 
      ref={menuRef}
      className="custom-context-menu"
      style={{ top: coords.top, left: coords.left }}
    >
      {/* 🧭 [1번 타자] 이동 (서브메뉴로 콤팩트하게 수납) */}
      <div className="menu-section-title">내비게이션</div>
      <div
        className="context-submenu-wrap"
        onMouseEnter={() => setNavSubmenuOpen(true)}
        onMouseLeave={() => setNavSubmenuOpen(false)}
      >
        <button
          className="context-item"
          onClick={(e) => {
            e.stopPropagation();
            setNavSubmenuOpen((prev) => !prev);
          }}
        >
          <span className="check-slot"></span>
          <div className="item-label-group">
            <span>🧭 이동</span> <span className="shortcut">▶</span>
          </div>
        </button>

        {isNavSubmenuOpen && (
          <div className="context-submenu-panel" style={{ top: 0 }}>
            <button className="context-item" onClick={onClose}>
              <span className="check-slot"></span>
              <div className="item-label-group">
                <span>⏭️ 다음 페이지</span> <span className="shortcut" style={{ fontSize: '0.65rem' }}>Space / → / ↓</span>
              </div>
            </button>
            <button className="context-item" onClick={onClose}>
              <span className="check-slot"></span>
              <div className="item-label-group">
                <span>⏮️ 이전 페이지</span> <span className="shortcut" style={{ fontSize: '0.65rem' }}>BkSpc / ← / ↑</span>
              </div>
            </button>
            <div className="ribbon-divider" />
            <button className="context-item" onClick={onClose}>
              <span className="check-slot"></span>
              <div className="item-label-group">
                <span>⏩ 10 페이지 앞으로</span> <span className="shortcut">PgDn</span>
              </div>
            </button>
            <button className="context-item" onClick={onClose}>
              <span className="check-slot"></span>
              <div className="item-label-group">
                <span>⏪ 10 페이지 뒤로</span> <span className="shortcut">PgUp</span>
              </div>
            </button>
          </div>
        )}
      </div>

      <div className="ribbon-divider" />
      
      {/* 🔍 [2번 타자] 보기 설정 (비율 & 스케일) */}
      <div className="menu-section-title">스케일 설정</div>
      <button 
        className={`context-item ${imageFitMode === 'auto' ? 'active-mode' : ''}`} 
        onClick={() => { onChangeImageFitMode('auto'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>⚙️ 자동 맞춤 (Full)</span> <span className="shortcut">F</span>
        </div>
      </button>
      <button 
        className={`context-item ${imageFitMode === 'height' ? 'active-mode' : ''}`} 
        onClick={() => { onChangeImageFitMode('height'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>↕️ 높이 맞춤 (Height)</span> <span className="shortcut">H</span>
        </div>
      </button>
      <button 
        className={`context-item ${imageFitMode === 'width' ? 'active-mode' : ''}`} 
        onClick={() => { onChangeImageFitMode('width'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>↔️ 폭 맞춤 (Width)</span> <span className="shortcut">W</span>
        </div>
      </button>
      <button 
        className={`context-item ${imageFitMode === 'actual' ? 'active-mode' : ''}`} 
        onClick={() => { onChangeImageFitMode('actual'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>💎 1:1 보기 (Original)</span> <span className="shortcut">O</span>
        </div>
      </button>

      <div className="ribbon-divider" />
      <div className="menu-section-title">페이지 설정</div>
      
      {/* 💎 우클릭 메뉴용 정통 체크 결합 */}
      <button 
        className={`context-item ${viewMode === '1' ? 'active-mode' : ''}`} 
        onClick={() => { onChangeViewMode('1'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>👤 1쪽 보기</span> <span className="shortcut">1</span>
        </div>
      </button>
      <button 
        className={`context-item ${viewMode === '2' ? 'active-mode' : ''}`} 
        onClick={() => { onChangeViewMode('2'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>👥 2쪽 보기</span> <span className="shortcut">2</span>
        </div>
      </button>

      <div className="ribbon-divider" />
      <div className="menu-section-title">테마</div>
      <div
        className="context-submenu-wrap"
        onMouseEnter={() => setThemeSubmenuOpen(true)}
        onMouseLeave={() => setThemeSubmenuOpen(false)}
      >
        <button
          className="context-item"
          onClick={(e) => {
            e.stopPropagation();
            setThemeSubmenuOpen((prev) => !prev);
          }}
        >
          <span className="check-slot">{themeMode ? '✓' : ''}</span>
          <div className="item-label-group">
            <span>테마</span> <span className="shortcut">▶</span>
          </div>
        </button>

        {isThemeSubmenuOpen && (
          <div className="context-submenu-panel">
            <button
              className={`context-item ${themeMode === 'default' ? 'active-mode' : ''}`}
              onClick={() => { onChangeThemeMode('default'); onClose(); }}
            >
              <span className="check-slot">✓</span>
              <div className="item-label-group">
                <span>기본설정</span>
              </div>
            </button>
            <button
              className={`context-item ${themeMode === 'light' ? 'active-mode' : ''}`}
              onClick={() => { onChangeThemeMode('light'); onClose(); }}
            >
              <span className="check-slot">✓</span>
              <div className="item-label-group">
                <span>라이트</span>
              </div>
            </button>
            <button
              className={`context-item ${themeMode === 'dark' ? 'active-mode' : ''}`}
              onClick={() => { onChangeThemeMode('dark'); onClose(); }}
            >
              <span className="check-slot">✓</span>
              <div className="item-label-group">
                <span>다크</span>
              </div>
            </button>
            <button
              className={`context-item ${themeMode === 'system' ? 'active-mode' : ''}`}
              onClick={() => { onChangeThemeMode('system'); onClose(); }}
            >
              <span className="check-slot">✓</span>
              <div className="item-label-group">
                <span>시스템</span>
              </div>
            </button>
          </div>
        )}
      </div>
      
      <div className="ribbon-divider" />
      
      {/* ✏️ [3번 타자] 편집 */}
      <div className="menu-section-title">편집 (🔒 모드 잠금)</div>
      <button 
        className="context-item" 
        disabled={viewMode !== '1'} 
        onClick={() => { if (onDeletePage) onDeletePage('left'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>🗑️ 현재 페이지 삭제</span> <span className="shortcut">Del</span>
        </div>
      </button>
      <button 
        className="context-item" 
        disabled={viewMode !== '2'} 
        onClick={() => { if (onDeletePage) onDeletePage('left'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>◀️ 왼쪽 페이지 삭제</span> <span className="shortcut">Shift+Del</span>
        </div>
      </button>
      <button 
        className="context-item" 
        disabled={viewMode !== '2'} 
        onClick={() => { if (onDeletePage) onDeletePage('right'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>▶️ 오른쪽 페이지 삭제</span> <span className="shortcut">Alt+Del</span>
        </div>
      </button>
    </div>
  );
};
