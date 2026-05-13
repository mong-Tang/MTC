import React from 'react';

interface StatusBarProps {
  hasActiveFile: boolean;
  activeFileName?: string | null;
  currentPageIndex: number;
  totalPages: number;
  bookPositionHint?: string | null; // 🗺️ '첫 번째', '마지막' 등의 위치 힌트
  totalLibraryItems: number; // 📚 [신규] 라이브러리에 적재된 전체 아이템 수
  totalLibrarySize?: number; // 🔋 [대특명] 라이브러리 총 용량(바이트) 수신선 개통!
  isSidebarOpen: boolean; // 📏 [신규] 사이드바 개폐 상태 동기화
  
  // 🧭 [유저 오더] 중앙 조종 엔진 연결선!
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;

  // 🚀 [신규] 작업공간 통합 제어 벡터!
  workspaceMode?: 'viewer' | 'converter';
  converterStatusText?: string; // 🛰️ [신규] 컨버터 연동 메시지 수신 포트!
}

export const StatusBar: React.FC<StatusBarProps> = ({
  hasActiveFile,
  activeFileName,
  currentPageIndex,
  totalPages,
  bookPositionHint,
  totalLibraryItems,
  totalLibrarySize = 0,
  isSidebarOpen,
  canGoPrev = false,
  canGoNext = false,
  onPrev,
  onNext,
  workspaceMode = 'viewer',
  converterStatusText = ''
}) => {
  
  // 📊 진행률 계산 (1.0 재현)
  const progressPercent = totalPages > 0 
    ? Math.round(((currentPageIndex + 1) / totalPages) * 100)
    : 0;

  // ⚙️ [특명] 바이트 용량을 보고 자동 판단하여 MB/GB로 절삭 보정하는 고급 포맷터!
  const formatLibrarySize = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    // 로그 연산을 통해 단위 인덱스 고속 판별
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    // 소수점 1자리로 포맷
    const formatted = (bytes / Math.pow(k, i)).toFixed(1);
    // 만약 정수면 '.0'을 제거하여 극도의 정갈함 도모!
    const finalVal = formatted.endsWith('.0') ? formatted.slice(0, -2) : formatted;
    return `${finalVal} ${sizes[i]}`;
  };

  return (
    <footer className={`custom-status-bar ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      
      {/* 🏛️ [1구역] 사이드바 직속 하단: 유저 지정 인벤토리 실시간 전력량 대시보드! */}
      <div className="status-left">
        <span className="status-badge idle badge-list">
          LIST
        </span>
        <span className="library-meta-text">
          {totalLibraryItems}개 파일 : 총 {formatLibrarySize(totalLibrarySize)}
        </span>
      </div>

      {/* 🌌 [2구역] 메인 캔버스 하단: 3개 군집으로 분할된 커맨드 센터! */}
      <div className="status-main-content-zone">
        {workspaceMode === 'converter' ? (
          // 🏗️ 컨버터 모드 전용 레이아웃: 뷰어의 잔상 제거!
          <div className="status-content-left">
            <span className="status-badge badge-engine active">
              CONVERTER
            </span>
            <span className="status-text filename-text">
              {converterStatusText || '변환 작업 대기 중...'}
            </span>
          </div>
        ) : (
          // 🖼️ 기본 뷰어 모드 레이아웃
          <>
            {/* ⬅️ 좌측: 배지 + 파일명 */}
            <div className="status-content-left">
              <span className={`status-badge badge-engine ${hasActiveFile ? 'active' : 'idle'}`}>
                {hasActiveFile ? 'VIEWING' : 'STANDBY'}
              </span>
              <span className="status-text filename-text">
                {hasActiveFile ? activeFileName : '대기 중...'}
              </span>
            </div>

            {/* 🧭 [중앙] 유저 특명! 상태바 정중앙 다기능 내비게이터!! */}
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
          </>
        )}
      </div>
    </footer>
  );
};
