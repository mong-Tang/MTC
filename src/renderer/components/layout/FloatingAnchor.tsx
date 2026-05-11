import React from 'react';
import { IconSidebarToggle, IconChevronLeft, IconChevronRight, IconList } from '../ui/Icons';

interface FloatingAnchorProps {
  onToggleSidebar: () => void;
  onToggleMenu: () => void; // ⚡ 역할 변경: 컨버터 직접 열기 -> 메뉴 토글
  onShowViewer: () => void;
  onShowConverter: () => void;
  canShowViewer: boolean;
  canShowConverter: boolean;
}

export const FloatingAnchor: React.FC<FloatingAnchorProps> = ({
  onToggleSidebar,
  onToggleMenu,
  onShowViewer,
  onShowConverter,
  canShowViewer,
  canShowConverter
}) => {
  return (
    <header className="floating-control-anchor">
      <button 
        className="anchor-control-btn" 
        onClick={onToggleSidebar} 
        title="사이드바 열기/닫기"
      >
        <IconSidebarToggle />
      </button>
      <button className="anchor-control-btn" title="뷰어 화면" onClick={onShowViewer} disabled={!canShowViewer}>
        <IconChevronLeft />
      </button>
      <button className="anchor-control-btn" title="컨버터 화면" onClick={onShowConverter} disabled={!canShowConverter}>
        <IconChevronRight />
      </button>
      <button 
        className="anchor-control-btn" 
        onClick={onToggleMenu} 
        title="통합 메뉴 열기/닫기"
      >
        <IconList />
      </button>
    </header>
  );
};
