import React, { useState, useEffect } from 'react';

interface ViewerCanvasProps {
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  hasActiveFile?: boolean;
  children?: React.ReactNode; // 🛰️ [신규] 스테이터스바 수용 창구
  
  // 🧬 전달된 생명줄
  zipPath?: string | null;
  entryName?: string | null;
}

export const ViewerCanvas: React.FC<ViewerCanvasProps> = ({ 
  onClick, onContextMenu, hasActiveFile, children, zipPath, entryName 
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
          // 💎 [핵심] 로우 바이트를 안전한 Blob 브라우저 URL로 승화!
          const blob = new Blob([new Uint8Array(result.data.bytes)], { type: result.data.mimeType });
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
          alignItems: 'center' 
        }}>
          {isLoading && !imgSrc && (
            <div style={{ color: 'var(--accent)', fontWeight: 600 }}>📥 로딩 중...</div>
          )}
          
          {imgSrc ? (
            <img 
              src={imgSrc} 
              alt="Comic Page"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain', // 비율을 유지하며 화면 꽉 차게 맞춤!
                boxShadow: '0 0 50px rgba(0,0,0,0.8)', // 살짝 띄워주는 센스
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
    </main>
  );
};
