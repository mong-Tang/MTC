import React, { useState, useEffect } from 'react';

interface ViewerCanvasProps {
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  hasActiveFile?: boolean;
  children?: React.ReactNode; // 🛰️ [신규] 스테이터스바 수용 창구
  
  // 🧬 전달된 생명줄
  zipPath?: string | null;
  entryName?: string | null;
  imageFitMode?: 'auto' | 'actual' | 'width' | 'height'; // 🔍 [신규] 보기 스케일 모드
  
  // 🧭 [유저 오더] 내비게이션 컨트롤 엔진 주입
  showNavArrows?: boolean;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

export const ViewerCanvas: React.FC<ViewerCanvasProps> = ({ 
  onClick, onContextMenu, hasActiveFile, children, zipPath, entryName,
  imageFitMode = 'auto',
  showNavArrows = false, canGoPrev = false, canGoNext = false, onPrev, onNext
}) => {
  
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);

  // 🔄 [이미지 로딩 마법]
  useEffect(() => {
    if (!zipPath || !entryName) {
      setImgSrc(null);
      return;
    }

    let isCancelled = false;
    const loadPage = async () => {
      setLoading(true);
      try {
        const appApi = (window as any).appApi;
        const result = await appApi.getPage(zipPath, entryName);

        if (isCancelled) return;

        if (result.ok) {
          // 💎 [핵심] 백엔드에서 날아온 순수 Uint8Array를 변환 없이(Zero-copy) 즉시 URL로!
          const blob = new Blob([result.data.bytes], { type: result.data.mimeType });
          const objectUrl = URL.createObjectURL(blob);
          
          setImgSrc(objectUrl);
        } else {
          console.error("Page load fail:", result.error);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadPage();

    return () => {
      isCancelled = true; // 메모리 꼬임 방지
    };
  }, [zipPath, entryName]);

  // ♻️ [메모리 클린업] 이전 이미지 흔적 지우기
  useEffect(() => {
    const prevSrc = imgSrc;
    return () => {
      if (prevSrc) {
        URL.revokeObjectURL(prevSrc); // 초정밀 메모리 청소!!
      }
    };
  }, [imgSrc]);

  // 🛡️ 브라우저 기본 우클릭을 막고 우리의 커스텀 센서로 넘기기
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onContextMenu) {
      onContextMenu(e);
    }
  };

  return (
    <main 
      className="app-main-content" 
      onClick={onClick}
      onContextMenu={handleContextMenu}
      style={{ 
        cursor: 'default',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-base)' // 🎨 시스템 테마 배경색 동기화!
      }}
    >
      {hasActiveFile ? (
        <div className="viewer-render-area" style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          overflow: 'auto' /* 📜 [확장] 1:1 보기 등에서 이미지가 삐져나올 때 스크롤바 생성 허용! */
        }}>
          {isLoading && !imgSrc && (
            <div style={{ color: 'var(--accent)', fontWeight: 600 }}>📥 로딩 중...</div>
          )}
          
          {imgSrc ? (
            <img 
              src={imgSrc} 
              alt="Comic Page"
              style={{
                // 💡 [유저 긴급 피드백 반영] '자동 맞춤' 시 1:1이 되지 않게 강제 Full Scale 유도!
                maxWidth: (imageFitMode === 'auto' || imageFitMode === 'width') ? '100%' : 'none',
                maxHeight: (imageFitMode === 'auto' || imageFitMode === 'height') ? '100%' : 'none',
                width: (imageFitMode === 'auto' || imageFitMode === 'width') ? '100%' : (imageFitMode === 'height' ? 'auto' : undefined),
                height: (imageFitMode === 'auto' || imageFitMode === 'height') ? '100%' : (imageFitMode === 'width' ? 'auto' : undefined),
                objectFit: imageFitMode === 'actual' ? 'none' : 'contain', // actual 외에는 무조건 최적비율 핏팅
                margin: 'auto', // 🚀 초월적 스크롤 중앙 정렬
                boxShadow: '0 0 50px rgba(0,0,0,0.8)',
                animation: 'fadeInImg 0.3s ease'
              }}
            />
          ) : !isLoading && (
            <div style={{ color: 'rgba(255,255,255,0.4)' }}>⚠️ 이미지를 불러올 수 없습니다.</div>
          )}
        </div>
      ) : (
        <div className="viewer-placeholder">
          <h1>단아(端雅)의 미학</h1>
          <p>
            오직 작품만이 당신의 시야에 머물 수 있도록,<br /> 
            불필요한 소음을 걷어내었습니다.<br /><br />
            <small style={{ opacity: 0.5 }}>(💡 사이드바 메뉴 ➡️ '파일 열기'를 클릭하세요.)</small>
          </p>
        </div>
      )}
      
      {/* 🛰️ 뷰어 하단에 기생하여 사이드바 침범을 막는 스테이터스바!! */}
      {children}

      {/* 🧭 [유저 신성 명시] 단일 이미지 모드 전용 오버레이 내비게이션 화살표 < > */}
      {hasActiveFile && showNavArrows && (
        <>
          <div 
            className={`viewer-nav-overlay left ${!canGoPrev ? 'disabled' : ''}`} 
            onClick={(e) => { e.stopPropagation(); onPrev && onPrev(); }}
          >
            <div className="nav-circle-btn">
              <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
            </div>
          </div>
          <div 
            className={`viewer-nav-overlay right ${!canGoNext ? 'disabled' : ''}`} 
            onClick={(e) => { e.stopPropagation(); onNext && onNext(); }}
          >
            <div className="nav-circle-btn">
              <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
            </div>
          </div>
        </>
      )}
    </main>
  );
};
