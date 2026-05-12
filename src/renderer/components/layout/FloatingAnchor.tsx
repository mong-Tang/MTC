import React from 'react';
import { IconSidebarToggle, IconChevronLeft, IconChevronRight, IconList } from '../ui/Icons';

interface FloatingAnchorProps {
  onToggleSidebar: () => void;
  onToggleMenu: () => void; // ⚡ 역할 변경: 컨버터 직접 열기 -> 메뉴 토글
  onShowViewer: () => void;
  onShowConverter: () => void;
  canShowViewer: boolean;
  canShowConverter: boolean;
  isSidebarOpen: boolean; // 🧬 [신규] 사이드바 개폐 상태 주입 수신!
}

export const FloatingAnchor: React.FC<FloatingAnchorProps> = ({
  onToggleSidebar,
  onToggleMenu,
  onShowViewer,
  onShowConverter,
  canShowViewer,
  canShowConverter,
  isSidebarOpen
}) => {
  // 🚀 [핵심 격상] 마우스 호버를 클릭 트리거로 전환하는 전용 로우레벨 상태!
  const [isExpanded, setIsExpanded] = React.useState(false);
  const anchorRef = React.useRef<HTMLElement>(null);

  // 🛡️ [영점 리셋] 사이드바가 강제 개폐될 때마다 확장 상태를 안전하게 원상복구!
  React.useEffect(() => {
    setIsExpanded(false);
  }, [isSidebarOpen]);

  // 📡 [지능형 클리너] 유저가 외부 공간을 클릭하면 영리하게 다시 스르륵 감춤!
  React.useEffect(() => {
    if (!isExpanded) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isExpanded]);

  // 📍 [트리거 핸들러] 꼬리 클릭 시 잠금을 풀고 출격!
  const handleTriggerClick = (e: React.MouseEvent) => {
    if (!isSidebarOpen && !isExpanded) {
      e.stopPropagation();
      setIsExpanded(true);
    }
  };

  // ⚔️ [액션 연동 헬퍼] 버튼 클릭 시 기능 수행 후 기민하게 자동 은폐!
  const withAutoCollapse = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
    if (!isSidebarOpen) setIsExpanded(false);
  };

  return (
    <header 
      ref={anchorRef}
      className={`floating-control-anchor ${!isSidebarOpen ? 'immersive-mode' : ''} ${(!isSidebarOpen && isExpanded) ? 'expanded' : ''}`}
      onClick={handleTriggerClick}
      style={{ cursor: (!isSidebarOpen && !isExpanded) ? 'pointer' : 'default' }}
    >
      <button 
        className="anchor-control-btn" 
        onClick={withAutoCollapse(onToggleSidebar)} 
        title="사이드바 열기/닫기"
      >
        <IconSidebarToggle />
      </button>
      <button 
        className="anchor-control-btn" 
        title="뷰어 화면" 
        onClick={withAutoCollapse(onShowViewer)} 
        disabled={!canShowViewer}
      >
        <IconChevronLeft />
      </button>
      <button 
        className="anchor-control-btn" 
        title="컨버터 화면" 
        onClick={withAutoCollapse(onShowConverter)} 
        disabled={!canShowConverter}
      >
        <IconChevronRight />
      </button>
      <button 
        className="anchor-control-btn" 
        onClick={withAutoCollapse(onToggleMenu)} 
        title="통합 메뉴 열기/닫기"
      >
        <IconList />
      </button>
    </header>
  );
};
