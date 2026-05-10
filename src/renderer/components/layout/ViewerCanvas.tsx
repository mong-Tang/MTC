import React, { useState, useEffect } from 'react';

interface ViewerCanvasProps {
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  hasActiveFile?: boolean;
  children?: React.ReactNode; // 🛰️ [신규] 스테이터스바 수용 창구
  
  // 🧬 전달된 생명줄
  zipPath?: string | null;
  entryNames?: string[];
  viewMode?: '1' | '2';
  imageFitMode?: 'auto' | 'actual' | 'width' | 'height'; // 🔍 [신규] 보기 스케일 모드
  
  // 🧭 [유저 오더] 내비게이션 컨트롤 엔진 주입
  showNavArrows?: boolean;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

export const ViewerCanvas: React.FC<ViewerCanvasProps> = ({ 
  onClick, onContextMenu, hasActiveFile, children, zipPath, entryNames = [], viewMode = '1',
  imageFitMode = 'auto',
  showNavArrows = false, canGoPrev = false, canGoNext = false, onPrev, onNext
}) => {
  
  const [imgSrcList, setImgSrcList] = useState<string[]>([]);
  const [isLoading, setLoading] = useState(false);

  // 🔄 [이미지 로딩 마법]
  useEffect(() => {
    if (!zipPath || entryNames.length === 0) {
      setImgSrcList([]);
      return;
    }

    let isCancelled = false;
    const loadPage = async () => {
      setLoading(true);
      try {
        const appApi = (window as any).appApi;
        const results = await Promise.all(entryNames.map((entryName) => appApi.getPage(zipPath, entryName)));

        if (isCancelled) return;

        const nextSrcList: string[] = [];
        for (const result of results) {
          if (result.ok) {
            const blob = new Blob([result.data.bytes], { type: result.data.mimeType });
            nextSrcList.push(URL.createObjectURL(blob));
          } else {
            console.error("Page load fail:", result.error);
          }
        }
        setImgSrcList(nextSrcList);
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
  }, [zipPath, entryNames]);

  // ♻️ [메모리 클린업] 이전 이미지 흔적 지우기
  useEffect(() => {
    const prevSrcList = imgSrcList;
    return () => {
      prevSrcList.forEach((src) => URL.revokeObjectURL(src));
    };
  }, [imgSrcList]);

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
          overflow: 'auto', /* 📜 [확장] 1:1 보기 등에서 이미지가 삐져나올 때 스크롤바 생성 허용! */
          position: 'relative'
        }}>
          {isLoading && imgSrcList.length === 0 && (
            <div style={{ color: 'var(--accent)', fontWeight: 600 }}>📥 로딩 중...</div>
          )}
          
          {imgSrcList.length > 0 ? (
            <div
              style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0'
              }}
            >
              {imgSrcList.map((imgSrc, idx) => (
                <img
                  key={`${imgSrc}-${idx}`}
                  src={imgSrc}
                  alt={`Comic Page ${idx + 1}`}
                  style={{
                    maxWidth: (imageFitMode === 'auto' || imageFitMode === 'width') ? (viewMode === '2' ? 'calc(50% - 5px)' : '100%') : 'none',
                    maxHeight: (imageFitMode === 'auto' || imageFitMode === 'height') ? '100%' : 'none',
                    width: (imageFitMode === 'auto' || imageFitMode === 'width') ? (viewMode === '2' ? 'calc(50% - 5px)' : '100%') : (imageFitMode === 'height' ? 'auto' : undefined),
                    height: (imageFitMode === 'auto' || imageFitMode === 'height') ? '100%' : (imageFitMode === 'width' ? 'auto' : undefined),
                    objectFit: imageFitMode === 'actual' ? 'none' : 'contain',
                    objectPosition: viewMode === '2' ? (idx === 0 ? 'right center' : 'left center') : 'center center',
                    margin: viewMode === '2' ? '0' : 'auto',
                    paddingLeft: viewMode === '2' && idx === 1 ? '5px' : '0',
                    paddingRight: viewMode === '2' && idx === 0 ? '5px' : '0',
                    boxShadow: '0 0 50px rgba(0,0,0,0.8)',
                    animation: 'fadeInImg 0.3s ease'
                  }}
                />
              ))}
            </div>
          ) : !isLoading && (
            <div style={{ color: 'rgba(255,255,255,0.4)' }}>⚠️ 이미지를 불러올 수 없습니다.</div>
          )}

          {/* 중앙 책등 느낌: 하드 라인 대신 부드러운 그라데이션 음영 */}
          {viewMode === '2' && imgSrcList.length > 1 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '50%',
                width: '16px',
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
                background: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.12) 50%, rgba(0,0,0,0) 100%)'
              }}
            />
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
