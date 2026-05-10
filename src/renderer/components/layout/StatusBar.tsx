import React from 'react';

interface StatusBarProps {
  hasActiveFile: boolean;
  activeFileName?: string | null;
  currentPageIndex: number;
  totalPages: number;
  bookPositionHint?: string | null; // 🗺️ '첫 번째', '마지막' 등의 위치 힌트
  totalLibraryItems: number; // 📚 [신규] 라이브러리에 적재된 전체 아이템 수
  isSidebarOpen: boolean; // 📏 [신규] 사이드바 개폐 상태 동기화
}

export const StatusBar: React.FC<StatusBarProps> = ({
  hasActiveFile,
  activeFileName,
  currentPageIndex,
  totalPages,
  bookPositionHint,
  totalLibraryItems,
  isSidebarOpen
}) => {
  
  // 📊 진행률 계산 (1.0 재현)
  const progressPercent = totalPages > 0 
    ? Math.round(((currentPageIndex + 1) / totalPages) * 100)
    : 0;

  return (
    <footer className={`custom-status-bar ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      
      {/* 🏛️ [1구역] 사이드바 직속 하단: 인벤토리 명찰 + 총량 */}
      <div className="status-left">
        {/* 🏷️ 1구역의 새로운 정체성: 'LIST' 명찰 (고유 클래스 'badge-list' 부여) */}
        <span className="status-badge idle badge-list">
          LIST
        </span>
        <span className="status-text">
          총 : {totalLibraryItems}
        </span>
      </div>

      {/* 🌌 [2구역] 메인 캔버스 하단: 배지 + 파일명 조합! */}
      <div className="status-main-content-zone">
        
        {/* ⬅️ 2구역 전용 좌측 정렬 클러스터 */}
        <div className="status-content-left">
          {/* 🎯 [공식 이관] 정통 상태 엔진 배지 (고유 클래스 'badge-engine' 부여) */}
          <span className={`status-badge badge-engine ${hasActiveFile ? 'active' : 'idle'}`}>
            {hasActiveFile ? 'VIEWING' : 'STANDBY'}
          </span>

          {/* 💬 파일명 본체 (더욱 넓어진 공간에서 우아하게 표시) */}
          <span className="status-text filename-text">
            {hasActiveFile ? activeFileName : '대기 중...'}
          </span>
        </div>

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
