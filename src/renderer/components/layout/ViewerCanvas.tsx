import React, { useState, useEffect } from 'react';
import { IconPlay, IconZip, IconFolder, IconFile } from '../ui/Icons';
import { TRANSLATIONS } from '../../i18n';
import type { AppLanguage } from '../../i18n';

interface ViewerCanvasProps {
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  hasActiveFile?: boolean;
  children?: React.ReactNode; // 🛰️ [신규] 스테이터스바 수용 창구
  
  // 🧬 [진화형 생명줄] 개별 파일 경로 지정이 가능토록 아키텍처 개선! (낱개 이미지 2쪽 보기 지원용)
  pagesToRender?: { filePath: string; entryName: string }[];
  viewMode?: '1' | '2';
  imageFitMode?: 'auto' | 'actual' | 'width' | 'height'; // 🔍 [신규] 보기 스케일 모드
  
  // 🧭 [유저 오더] 내비게이션 컨트롤 엔진 주입
  showNavArrows?: boolean;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onRecentCountClick?: () => void; // 🛸 [신규] 히스토리 탐사 시작 트리거!
  onSelectRecentItem?: (path: string) => void; // 🚀 [긴급 특명] 캔버스 내부 리스트 클릭 전송 파이프!
  language?: AppLanguage; // 🌍 [다국어] 현재 언어
}

export const ViewerCanvas: React.FC<ViewerCanvasProps> = ({ 
  onClick, onContextMenu, hasActiveFile, children, pagesToRender = [], viewMode = '1',
  imageFitMode = 'auto',
  showNavArrows = false, canGoPrev = false, canGoNext = false, onPrev, onNext,
  onRecentCountClick, onSelectRecentItem,
  language = 'ko'
}) => {
  const t = TRANSLATIONS[language]; // ⚡ 실시간 사전 가동!
  
  const [imgSrcList, setImgSrcList] = useState<string[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [recentCount, setRecentCount] = useState<number>(0); 
  const [recentItems, setRecentItems] = useState<any[]>([]); // 📜 [신규] 히스토리 데이터 원천 보관소
  const [showRecentPanel, setShowRecentPanel] = useState(false); // 🌓 [신규] 캔버스 내 듀얼 패널 스위치

  // 🛸 [신규] 인트로 렌딩 시 살아있는 최근 기록 총합 집계 센서!
  useEffect(() => {
    if (!hasActiveFile) {
      const appApi = (window as any).appApi;
      if (appApi?.getRecent) {
        appApi.getRecent()
          .then((res: any) => {
            if (res.ok && Array.isArray(res.data)) {
              setRecentCount(res.data.length);
              setRecentItems(res.data); // ✨ 전체 데이터 통째로 확보!
            }
          })
          .catch((err: any) => console.error('[ViewerCanvas] History fetch failed:', err));
      }
    }
  }, [hasActiveFile]);

  // 🔄 [이미지 로딩 마법]
  useEffect(() => {
    if (pagesToRender.length === 0) {
      setImgSrcList([]);
      return;
    }

    let isCancelled = false;
    const loadPage = async () => {
      setLoading(true);
      try {
        const appApi = (window as any).appApi;
        // 🚀 [유저 특명: 버그 소탕] 각 페이지가 가지고 있는 독자적인 filePath로 개별 비동기 페치 요청!
        const results = await Promise.all(
          pagesToRender.map((p) => appApi.getPage(p.filePath, p.entryName))
        );

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
  }, [pagesToRender]);

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
        position: 'relative', // 부모의 절대좌표 앵커 기능 활성화 확보!
        flex: 1,
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-base)' // 🎨 시스템 테마 배경색 동기화!
      }}
    >
      {/* 🎨 [유저 특명 최종판] 뷰어 바탕(최상위 코어)에 다이렉트 격납! (절대 간섭 불가 구역) */}
      {showRecentPanel && !hasActiveFile && recentItems.length > 0 && (
        <div className="zen-recent-panel" style={{ zIndex: 100 }}>
          <div className="zen-recent-panel-header">{t.recentHistoryTitle}</div>
          <div className="zen-recent-list-scroll">
            {recentItems
              .slice(0, 15)
              .sort((a, b) => {
                const aHasExt = /\.[a-zA-Z0-9]+$/.test(a.zipPath || '');
                const bHasExt = /\.[a-zA-Z0-9]+$/.test(b.zipPath || '');
                if (!aHasExt && bHasExt) return -1; // 폴더를 위로!
                if (aHasExt && !bHasExt) return 1;  // 파일을 아래로!
                return 0; // 동일 타입 내에서는 기존 시간순(안정적 정렬) 유지
              })
              .map((item, idx) => {
                const hasExt = /\.[a-zA-Z0-9]+$/.test(item.zipPath || '');
              return (
                <div 
                  key={item.zipPath || idx} 
                  className="zen-recent-item"
                  onClick={(e) => {
                    e.stopPropagation(); // 🛑 버블링 차단
                    onSelectRecentItem && onSelectRecentItem(item.zipPath);
                  }}
                  title={item.title}
                >
                  {/* 🚥 [유저 로직 이식] 확장자가 없으면 폴더, 있으면 아카이브! */}
                  {hasExt ? <IconZip /> : <IconFolder />}
                  <span className="zen-recent-item-name">{item.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
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
            <div style={{ color: 'var(--accent)', fontWeight: 600 }}>{t.loadingState}</div>
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
                    maxWidth: imageFitMode === 'actual' ? 'none' : (viewMode === '2' ? '50%' : '100%'),
                    maxHeight: imageFitMode === 'actual' ? 'none' : '100%',
                    width: (imageFitMode === 'auto' || imageFitMode === 'width') ? (viewMode === '2' ? '50%' : '100%') : (imageFitMode === 'height' ? 'auto' : undefined),
                    height: (imageFitMode === 'auto' || imageFitMode === 'height') ? '100%' : (imageFitMode === 'width' ? 'auto' : undefined),
                    objectFit: imageFitMode === 'actual' ? 'none' : 'contain',
                    objectPosition: viewMode === '2' ? (idx === 0 ? 'right center' : 'left center') : 'center center',
                    margin: viewMode === '2' ? '0' : 'auto',
                    paddingLeft: '0',
                    paddingRight: '0',
                    boxShadow: '0 0 50px rgba(0,0,0,0.8)',
                    animation: 'fadeInImg 0.3s ease'
                  }}
                />
              ))}
            </div>
          ) : !isLoading && (
            <div style={{ color: 'rgba(255,255,255,0.4)' }}>{t.failLoadImage}</div>
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
                background: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.06) 50%, rgba(0,0,0,0) 100%)'
              }}
            />
          )}
        </div>
      ) : (
        <div className="viewer-placeholder">
          {/* 🎭 [중앙 독립 패널] 기존 전면 로고 및 타이포그래피 컴포지션 */}
          <div className="zen-logo-wrap">
            <div className="zen-anim-container">
              {/* ✨ 프리미엄 커스텀 지오메트릭 엠블럼 */}
              <svg className="zen-logo-mark" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M32 12L52 26L32 40L12 26L32 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M32 26L52 40L32 54L12 40L32 26Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.5" />
                <path d="M32 40V54" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
                <circle cx="32" cy="26" r="2.5" fill="currentColor" />
              </svg>

              {/* 🖋️ 정제된 타이포그래피 메시지 */}
              <h2 className="zen-title">MTC Center</h2>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div className="zen-divider" />
              </div>
              <p className="zen-subtitle">
                <span>{t.centerSidebarMenu}</span>
                <span style={{ fontSize: '10px', opacity: 0.6 }}>➔</span>
                <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{t.centerClickOpenFile}</span>
              </p>
              
              {/* 📜 [유저 특명] 살아있는 히스토리 카운팅 대시보드 링크 */}
              {recentCount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span 
                    className="zen-recent-link" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRecentPanel(prev => !prev);
                    }}
                  >
                    {recentCount}{language === 'ko' ? '' : ' '}{t.centerRecentItemsSuffix}
                  </span>
                </div>
              )}
            </div>
          </div>
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
            <div className="viewer-nav-circle-btn">
              <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
            </div>
          </div>
          <div 
            className={`viewer-nav-overlay right ${!canGoNext ? 'disabled' : ''}`} 
            onClick={(e) => { e.stopPropagation(); onNext && onNext(); }}
          >
            <div className="viewer-nav-circle-btn">
              <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
            </div>
          </div>
        </>
      )}
    </main>
  );
};
