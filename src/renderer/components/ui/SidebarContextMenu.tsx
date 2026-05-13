import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';

interface SidebarContextMenuProps {
  x: number;
  y: number;
  show: boolean;
  onClose: () => void;
  onOpen: () => void;        // 📂 문서 열기
  onCloseDoc: () => void;    // 🚪 문서 닫기
  onRemove: () => void;      // 🧹 목록에서만 제거 (Remove)
  onDeleteFile: () => void;  // 💣 디스크에서 영구 삭제 (Delete)
}

export const SidebarContextMenu: React.FC<SidebarContextMenuProps> = ({ 
  x, y, show, onClose, onOpen, onCloseDoc, onRemove, onDeleteFile
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: y, left: x });

  // 🛡️ 뷰포트 삐져나감 방어 로직 (오버플로우 가드)
  useLayoutEffect(() => {
    if (!show || !menuRef.current) return;
    const menuRect = menuRef.current.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    let finalX = x;
    let finalY = y;

    // 우측/하단 화면 경계선에 닿으면 반전 처리
    if (x + menuRect.width > winWidth) finalX = x - menuRect.width;
    if (y + menuRect.height > winHeight) finalY = y - menuRect.height;

    // 최소 여백 사수
    finalX = Math.max(5, finalX);
    finalY = Math.max(5, finalY);
    setCoords({ top: finalY, left: finalX });
  }, [show, x, y]);

  // 🛡️ 메뉴 바깥 클릭 시 자동 닫힘 시스템
  useEffect(() => {
    if (!show) return;
    
    let timerId: NodeJS.Timeout | number | null = null;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    // 즉시 등록하면 현재 우클릭 이벤트가 트리거 시켜 바로 꺼질 수 있으므로 딜레이 살짝 부여
    timerId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }, 50);

    return () => {
      if (timerId) clearTimeout(timerId); // 🧹 잔여 타이머 잔상 완벽 소거!
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div 
      ref={menuRef}
      className="custom-context-menu sidebar-ctx-menu"
      style={{ 
        position: 'fixed',
        top: coords.top, 
        left: coords.left,
        zIndex: 9999,
        minWidth: '160px'
      }}
    >
      <div className="menu-section-title">문서 관리</div>
      
      <button className="context-item" onClick={() => { onOpen(); onClose(); }}>
        <span className="check-slot"></span>
        <div className="item-label-group">
          <span>📂 문서 열기</span>
        </div>
      </button>

      <button className="context-item" onClick={() => { onCloseDoc(); onClose(); }}>
        <span className="check-slot"></span>
        <div className="item-label-group">
          <span>🚪 문서 닫기</span>
        </div>
      </button>

      <div className="ribbon-divider" />
      
      <button className="context-item" onClick={() => { onRemove(); onClose(); }}>
        <span className="check-slot"></span>
        <div className="item-label-group">
          <span>🧹 목록에서 리무브</span>
        </div>
      </button>

      <div className="ribbon-divider" />

      <button 
        className="context-item danger-item" 
        style={{ color: '#ff6b6b' }}
        onClick={() => { onDeleteFile(); onClose(); }}
      >
        <span className="check-slot"></span>
        <div className="item-label-group">
          <span style={{ fontWeight: 600 }}>🔥 파일 완전 삭제</span>
        </div>
      </button>
    </div>
  );
};
