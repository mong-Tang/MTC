import React from 'react';

interface StatusBarProps {
  hasActiveFile: boolean;
  activeFileName?: string | null;
  currentPageIndex: number;
  totalPages: number;
  bookPositionHint?: string | null; // 🗺️ '첫 번째', '마지막' 등의 위치 힌트
  totalLibraryItems: number; // 📚 [신규] 라이브러리에 적재된 전체 아이템 수
  isSidebarOpen: boolean; // 📏 [신규] 사이드바 개폐 상태 동기화
  
  // 🧭 [유저 오더] 중앙 조종 엔진 연결선!
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  hasActiveFile,
  activeFileName,
  currentPageIndex,
  totalPages,
  bookPositionHint,
  totalLibraryItems,
  isSidebarOpen,
  canGoPrev = false,
  canGoNext = false,
  onPrev,
  onNext
}) => {
  
  // 📊 진행률 계산 (1.0 재현)
  const progressPercent = totalPages > 0 
    ? Math.round(((currentPageIndex + 1) / totalPages) * 100)
    : 0;

  return (
    <footer className={`custom-status-bar ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      
      {/* 🏛️ [1구역] 사이드바 직속 하단: 인벤토리 명찰 + 총량 */}
      <div className="status-left">
        <span className="status-badge idle badge-list">
          LIST
        </span>
        <span className="status-text">
          총 : {totalLibraryItems}
        </span>
      </div>

      {/* 🌌 [2구역] 메인 캔버스 하단: 3개 군집으로 분할된 커맨드 센터! */}
      <div className="status-main-content-zone">
        
        {/* ⬅️ 좌측: 배지 + 파일명 */}
        <div className="status-content-left">
          <span className={`status-badge badge-engine ${hasActiveFile ? 'active' : 'idle'}`}>
            {hasActiveFile ? 'VIEWING' : 'STANDBY'}
          </span>
          <span className="status-text filename-text">
            {hasActiveFile ? activeFileName : '대기 중...'}
          </span>
        </div>

        {/* 🧭 [중앙 신규] 유저 특명! 상태바 정중앙 다기능 내비게이터!! */}
        {hasActiveFile && (
          <div className="status-content-center">
            <button 
              className="status-nav-btn prev" 
              onClick={onPrev} 
              disabled={!canGoPrev}
              title="이전 (페이지/책)"
            >
              ‹
            </button>
            <button 
              className="status-nav-btn next" 
              onClick={onNext} 
              disabled={!canGoNext}
              title="다음 (페이지/책)"
            >
              ›
            </button>
          </div>
        )}

        {/* ➡️ 우측 계기판: 페이징 텔레메트리 */}
        {hasActiveFile && (
          <div className="status-right">
            {bookPositionHint && (
              <span className="nav-hint-badge">
                {bookPositionHint}
              </span>
            )}

            {totalPages > 0 && (
              <span className="status-telemetry">
                [ 현재 쪽수 : {currentPageIndex + 1}/{totalPages}, 진행률 : {progressPercent}% ]
              </span>
            )}
          </div>
        )}
      </div>
    </footer>
  );
};
