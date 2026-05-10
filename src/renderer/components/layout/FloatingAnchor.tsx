import React from 'react';
import { IconSidebarToggle, IconChevronLeft, IconChevronRight, IconList } from '../ui/Icons';

interface FloatingAnchorProps {
  onToggleSidebar: () => void;
  onToggleMenu: () => void; // ⚡ 역할 변경: 컨버터 직접 열기 -> 메뉴 토글
}

export const FloatingAnchor: React.FC<FloatingAnchorProps> = ({ onToggleSidebar, onToggleMenu }) => {
  return (
    <header className="floating-control-anchor">
      <button 
        className="control-btn" 
        onClick={onToggleSidebar} 
        title="사이드바 열기/닫기"
      >
        <IconSidebarToggle />
      </button>
      <button className="control-btn" title="이전 파일">
        <IconChevronLeft />
      </button>
      <button className="control-btn" title="다음 파일">
        <IconChevronRight />
      </button>
      <button 
        className="control-btn" 
        onClick={onToggleMenu} 
        title="통합 메뉴 열기/닫기"
      >
        <IconList />
      </button>
    </header>
  );
};
