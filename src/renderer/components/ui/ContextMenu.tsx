import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { TRANSLATIONS, AppLanguage } from '../../i18n'; // 🌍 [글로벌] 다국어 번역 자재 조달!

interface ContextMenuProps {
  x: number;
  y: number;
  show: boolean;
  onClose: () => void;
  viewMode: '1' | '2';
  onChangeViewMode: (mode: '1' | '2') => void;
  themeMode: 'default' | 'light' | 'dark' | 'system' | 'hwasa';
  onChangeThemeMode: (mode: 'default' | 'light' | 'dark' | 'system' | 'hwasa') => void;
  imageFitMode: 'auto' | 'actual' | 'width' | 'height'; // 🔍 [신규] 스케일 모드 수신
  onChangeImageFitMode: (mode: 'auto' | 'actual' | 'width' | 'height') => void; // ⚡ 스케일 변경 위임
  onDeletePage?: (target: 'left' | 'right') => void; // 🗑️ [신규] 페이지 소각 처리기 수신!
  
  language?: AppLanguage; // 🌍 [글로벌] 언어 설정 채널 개방!
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ 
  x, y, show, onClose, viewMode, onChangeViewMode, themeMode, onChangeThemeMode, imageFitMode, onChangeImageFitMode, onDeletePage,
  language = 'ko' /* 🌍 기본 한국어 안전 락온 */
}) => {
  const t = TRANSLATIONS[language]; // ⚡ 실시간 다국어 팩 번역기 구동!
  
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: y, left: x });
  const [isThemeSubmenuOpen, setThemeSubmenuOpen] = useState(false);
  const [isNavSubmenuOpen, setNavSubmenuOpen] = useState(false); // 🧭 [신규] 이동 서브메뉴 상태 추가!
  
  // 🛡️ [유저 특명 궁극의 안전장치] 화면 우측 끝에서 서브메뉴가 짤려나가지 않도록 좌측 오픈 모드를 자동 전환합니다!
  const [openSubmenuLeft, setOpenSubmenuLeft] = useState(false);

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

    // 🚨 [초정밀 지능형 충돌 탐지] 메인메뉴 좌표 우측에 서브메뉴(약 160px)가 확보될 여력이 있는지 검측
    const submenuWidth = 165;
    const isOverflowingRight = (finalX + menuRect.width + submenuWidth) > winWidth;
    setOpenSubmenuLeft(isOverflowingRight);
  }, [show, x, y]);

  useEffect(() => {
    if (!show) return;
    
    let timerId: NodeJS.Timeout | number | null = null;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };

    // 🛡️ 우클릭 프레임 연쇄 방어용 마이크로 딜레이 탑재
    timerId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }, 50);

    return () => {
      if (timerId) clearTimeout(timerId); // 🧹 타이머 유령 누수 방지용 안전장치
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
      <div className="menu-section-title">{t.menuNavigation}</div>
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
            <span>🧭 {t.menuMove}</span> <span className="shortcut">▶</span>
          </div>
        </button>

        {isNavSubmenuOpen && (
          <div 
            className="context-submenu-panel" 
            style={{ 
              top: 0,
              // 🛡️ 충돌 감지 시 좌측으로 역오버랩 오픈!
              ...(openSubmenuLeft ? { left: 'auto', right: 'calc(100% - 4px)' } : {})
            }}
          >
            <button className="context-item" onClick={onClose}>
              <span className="check-slot"></span>
              <div className="item-label-group">
                <span>⏭️ {t.menuNextPage}</span> <span className="shortcut" style={{ fontSize: '0.65rem' }}>Space / → / ↓</span>
              </div>
            </button>
            <button className="context-item" onClick={onClose}>
              <span className="check-slot"></span>
              <div className="item-label-group">
                <span>⏮️ {t.menuPrevPage}</span> <span className="shortcut" style={{ fontSize: '0.65rem' }}>BkSpc / ← / ↑</span>
              </div>
            </button>
            <div className="ribbon-divider" />
            <button className="context-item" onClick={onClose}>
              <span className="check-slot"></span>
              <div className="item-label-group">
                <span>⏩ {t.menuNext10}</span> <span className="shortcut">PgDn</span>
              </div>
            </button>
            <button className="context-item" onClick={onClose}>
              <span className="check-slot"></span>
              <div className="item-label-group">
                <span>⏪ {t.menuPrev10}</span> <span className="shortcut">PgUp</span>
              </div>
            </button>
          </div>
        )}
      </div>

      <div className="ribbon-divider" />
      
      {/* 🔍 [2번 타자] 보기 설정 (비율 & 스케일) */}
      <div className="menu-section-title">{t.menuScaleSetting}</div>
      <button 
        className={`context-item ${imageFitMode === 'auto' ? 'active-mode' : ''}`} 
        onClick={() => { onChangeImageFitMode('auto'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>⚙️ {t.menuFitAuto} (Full)</span> <span className="shortcut">F</span>
        </div>
      </button>
      <button 
        className={`context-item ${imageFitMode === 'height' ? 'active-mode' : ''}`} 
        onClick={() => { onChangeImageFitMode('height'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>↕️ {t.menuFitHeight} (Height)</span> <span className="shortcut">H</span>
        </div>
      </button>
      <button 
        className={`context-item ${imageFitMode === 'width' ? 'active-mode' : ''}`} 
        onClick={() => { onChangeImageFitMode('width'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>↔️ {t.menuFitWidth} (Width)</span> <span className="shortcut">W</span>
        </div>
      </button>
      <button 
        className={`context-item ${imageFitMode === 'actual' ? 'active-mode' : ''}`} 
        onClick={() => { onChangeImageFitMode('actual'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>💎 {t.menuFitActual} (Original)</span> <span className="shortcut">O</span>
        </div>
      </button>

      <div className="ribbon-divider" />
      <div className="menu-section-title">{t.menuPageSetting}</div>
      
      {/* 💎 우클릭 메뉴용 정통 체크 결합 */}
      <button 
        className={`context-item ${viewMode === '1' ? 'active-mode' : ''}`} 
        onClick={() => { onChangeViewMode('1'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>👤 {t.menuSinglePage}</span> <span className="shortcut">1</span>
        </div>
      </button>
      <button 
        className={`context-item ${viewMode === '2' ? 'active-mode' : ''}`} 
        onClick={() => { onChangeViewMode('2'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>👥 {t.menuDoublePage}</span> <span className="shortcut">2</span>
        </div>
      </button>

      <div className="ribbon-divider" />
      <div className="menu-section-title">{t.menuTheme}</div>
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
            <span>{t.menuTheme}</span> <span className="shortcut">▶</span>
          </div>
        </button>

        {isThemeSubmenuOpen && (
          <div 
            className="context-submenu-panel"
            style={{
              // 🛡️ 테마 메뉴도 우측 공간 부족 시 좌측 오픈으로 긴급 전환!
              ...(openSubmenuLeft ? { left: 'auto', right: 'calc(100% - 4px)' } : {})
            }}
          >
            <button
              className={`context-item ${themeMode === 'default' ? 'active-mode' : ''}`}
              onClick={() => { onChangeThemeMode('default'); onClose(); }}
            >
              <span className="check-slot">✓</span>
              <div className="item-label-group">
                <span>⚓ {t.menuThemeDefault}</span>
              </div>
            </button>

            <button
              className={`context-item ${themeMode === 'hwasa' ? 'active-mode' : ''}`}
              onClick={() => { onChangeThemeMode('hwasa'); onClose(); }}
            >
              <span className="check-slot">✓</span>
              <div className="item-label-group">
                <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>🌸 {t.menuThemeHwasa}</span>
              </div>
            </button>
            <button
              className={`context-item ${themeMode === 'light' ? 'active-mode' : ''}`}
              onClick={() => { onChangeThemeMode('light'); onClose(); }}
            >
              <span className="check-slot">✓</span>
              <div className="item-label-group">
                <span>☀️ {t.menuThemeLight}</span>
              </div>
            </button>
            <button
              className={`context-item ${themeMode === 'dark' ? 'active-mode' : ''}`}
              onClick={() => { onChangeThemeMode('dark'); onClose(); }}
            >
              <span className="check-slot">✓</span>
              <div className="item-label-group">
                <span>🌙 {t.menuThemeDark}</span>
              </div>
            </button>
            <button
              className={`context-item ${themeMode === 'system' ? 'active-mode' : ''}`}
              onClick={() => { onChangeThemeMode('system'); onClose(); }}
            >
              <span className="check-slot">✓</span>
              <div className="item-label-group">
                <span>💻 {t.menuThemeSystem}</span>
              </div>
            </button>
          </div>
        )}
      </div>
      
      <div className="ribbon-divider" />
      
      {/* ✏️ [3번 타자] 편집 */}
      <div className="menu-section-title">{t.menuEditLocked}</div>
      <button 
        className="context-item" 
        disabled={viewMode !== '1'} 
        onClick={() => { if (onDeletePage) onDeletePage('left'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>🗑️ {t.menuDeletePage}</span> <span className="shortcut">Del</span>
        </div>
      </button>
      <button 
        className="context-item" 
        disabled={viewMode !== '2'} 
        onClick={() => { if (onDeletePage) onDeletePage('left'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>◀️ {t.menuDeleteLeft}</span> <span className="shortcut">Shift+Del</span>
        </div>
      </button>
      <button 
        className="context-item" 
        disabled={viewMode !== '2'} 
        onClick={() => { if (onDeletePage) onDeletePage('right'); onClose(); }}
      >
        <span className="check-slot">✓</span>
        <div className="item-label-group">
          <span>▶️ {t.menuDeleteRight}</span> <span className="shortcut">Alt+Del</span>
        </div>
      </button>
    </div>
  );
};
