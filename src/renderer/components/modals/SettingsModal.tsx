import React from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  
  // 🎨 테마 제어부
  themeMode: string;
  onChangeThemeMode: (mode: any) => void;
  
  // 📖 뷰어 제어부
  viewMode: '1' | '2';
  onChangeViewMode: (mode: '1' | '2') => void;
  imageFitMode: 'auto' | 'actual' | 'width' | 'height';
  onChangeImageFitMode: (mode: 'auto' | 'actual' | 'width' | 'height') => void;
  
  // 🔄 작동 정책
  loadSameBook: boolean;
  onChangeLoadSameBook: (val: boolean) => void;
  
  // 📐 하드웨어 초기화 센서
  onResetSidebarWidth: () => void;
  onResetNoticePos: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  themeMode,
  onChangeThemeMode,
  viewMode,
  onChangeViewMode,
  imageFitMode,
  onChangeImageFitMode,
  loadSameBook,
  onChangeLoadSameBook,
  onResetSidebarWidth,
  onResetNoticePos
}) => {
  if (!isOpen) return null;

  // 💾 [유저 특명] 실시간 프리뷰 조율 중 취소 시, 원본 데이터를 지켜낼 스냅샷 기억 장치
  const initialValuesRef = React.useRef<{
    themeMode: string;
    viewMode: '1' | '2';
    imageFitMode: 'auto' | 'actual' | 'width' | 'height';
    loadSameBook: boolean;
  } | null>(null);

  // 📸 모달이 개방되는 찬란한 순간, 모든 세팅값을 원본 백업 파일로 영구 박제!
  React.useEffect(() => {
    if (isOpen) {
      initialValuesRef.current = {
        themeMode,
        viewMode,
        imageFitMode,
        loadSameBook
      };
    }
  }, [isOpen]);

  // 🔄 [지능형 롤백 엔진] 취소 버튼 또는 ✕ 버튼 클릭 시 실시간 변경 값을 완벽히 기각!
  const handleCancel = () => {
    if (initialValuesRef.current) {
      onChangeThemeMode(initialValuesRef.current.themeMode);
      onChangeViewMode(initialValuesRef.current.viewMode);
      onChangeImageFitMode(initialValuesRef.current.imageFitMode);
      onChangeLoadSameBook(initialValuesRef.current.loadSameBook);
    }
    onClose();
  };

  // 🔮 [CSS-in-JS 프리미엄 스타일 아키텍처]
  const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'var(--modal-backdrop)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3000, // 🛡️ 최상위 질서 유지!
      animation: 'fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'wait' // ⏳ [유저 특명] 모달 경계선 밖 마우스 진입 시 로딩/웨이트 마크 투사!
    },
    modal: {
      width: '530px', // 📏 [유저 명령] 기존 480px에서 +50px 확장하여 쾌적한 레이아웃 설계!
      background: 'var(--bg-floating-panel)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '24px',
      boxShadow: 'var(--shadow-popup)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'slideUpPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
      cursor: 'default' // 🖱️ [유저 특명] 설정창 내부에 안착하면 안전하게 기본 포인터로 원복!
    },
    header: {
      padding: '20px 28px', // 📏 [유저 특명] 상하 패딩 4px 압축 조정 (24px -> 20px)
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid var(--border-subtle)'
    },
    body: {
      padding: '24px 28px', // 📏 [유저 특명] 상하 패딩 4px 압축 조정 (28px -> 24px)
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      maxHeight: '70vh',
      overflowY: 'auto'
    },
    section: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    sectionTitle: {
      fontSize: '0.85rem',
      fontWeight: 600,
      color: 'var(--accent)',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      borderBottom: '1px solid rgba(var(--rgb-contrast), 0.05)',
      paddingBottom: '6px',
      marginBottom: '4px'
    },
    row: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px'
    },
    labelGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px'
    },
    label: {
      fontSize: '0.95rem',
      fontWeight: 500,
      color: 'var(--text-main)'
    },
    desc: {
      fontSize: '0.78rem',
      color: 'var(--text-dim)',
      opacity: 0.8
    },
    select: {
      background: 'rgba(var(--rgb-contrast), 0.05)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '8px',
      padding: '8px 12px',
      color: 'var(--text-main)',
      fontSize: '0.9rem',
      outline: 'none',
      cursor: 'pointer',
      fontFamily: 'inherit'
    },
    segmentedContainer: {
      display: 'flex',
      background: 'rgba(var(--rgb-contrast), 0.05)',
      padding: '3px',
      borderRadius: '10px',
      border: '1px solid var(--border-subtle)'
    },
    segmentBtn: {
      padding: '6px 14px',
      border: 'none',
      borderRadius: '7px',
      fontSize: '0.85rem',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.2s',
      fontFamily: 'inherit'
    },
    actionBtn: {
      padding: '8px 16px',
      background: 'rgba(var(--rgb-contrast), 0.03)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '8px',
      color: 'var(--text-main)',
      fontSize: '0.85rem',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    footer: {
      padding: '16px 28px', // 📏 [유저 특명] 상하 패딩 4px 압축 조정 (20px -> 16px)
      borderTop: '1px solid var(--border-subtle)',
      background: 'rgba(var(--rgb-contrast), 0.02)',
      display: 'flex',
      justifyContent: 'center', // 🎯 [유저 특명] 하단 버튼들의 정중앙 정렬 완료!
      gap: '12px' // 🤝 버튼 간의 심적 평안을 주는 완벽 격차!
    },
    cancelBtn: {
      padding: '10px 28px',
      background: 'rgba(var(--rgb-contrast), 0.06)',
      color: 'var(--text-main)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '10px',
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: '0.95rem',
      transition: 'all 0.2s'
    },
    primaryBtn: {
      padding: '10px 28px',
      background: 'var(--accent)',
      color: '#FFFFFF',
      border: 'none',
      borderRadius: '10px',
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: '0.95rem',
      boxShadow: '0 4px 12px rgba(var(--theme-def-accent-rgb), 0.3)',
      transition: 'all 0.2s'
    }
  };

  return (
    <div style={styles.overlay}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUpPop { 
          from { transform: translateY(30px) scale(0.97); opacity: 0; } 
          to { transform: translateY(0) scale(1); opacity: 1; } 
        }
        
        /* 🌿 커스텀 스위치 토글 */
        .settings-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }
        .settings-switch input { opacity: 0; width: 0; height: 0; }
        .switch-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(var(--rgb-contrast), 0.1);
          transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 34px;
          border: 1px solid var(--border-subtle);
        }
        .switch-slider:before {
          position: absolute;
          content: "";
          height: 16px; width: 16px;
          left: 3px; bottom: 3px;
          background-color: var(--text-main);
          transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .settings-switch input:checked + .switch-slider {
          background-color: var(--accent);
        }
        .settings-switch input:checked + .switch-slider:before {
          transform: translateX(20px);
          background-color: #ffffff;
        }
        
        /* 호버 인터렉션 */
        .settings-action-btn:hover {
          background: var(--accent) !important;
          color: #ffffff !important;
          border-color: var(--accent) !important;
          box-shadow: 0 4px 10px rgba(var(--theme-def-accent-rgb), 0.2);
        }
        
        /* 🎯 [유저 버그 리포트 최종 정복] 크롬 네이티브 드롭다운 옵션들의 백화 버그 전격 박멸!! */
        .settings-modal-select option {
          background-color: var(--bg-floating-panel) !important;
          color: var(--text-main) !important;
        }

        /* 취소 버튼 호버 */
        .settings-cancel-btn:hover {
          background: rgba(var(--rgb-contrast), 0.12) !important;
          border-color: rgba(var(--rgb-contrast), 0.2) !important;
        }
      `}</style>

      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* 🏷️ Header */}
        <header style={styles.header}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            통합 환경 설정
          </h2>
          <button 
            onClick={handleCancel} 
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}
          >
            ✕
          </button>
        </header>

        {/* 📦 Body */}
        <div style={styles.body}>
          
          {/* 🎨 Section: 테마 설정 */}
          <section style={styles.section}>
            <div style={styles.sectionTitle}>App Theme</div>
            <div style={styles.row}>
              <div style={styles.labelGroup}>
                <span style={styles.label}>인터페이스 테마</span>
                <span style={styles.desc}>애플리케이션의 전반적인 디자인 스킨을 결정합니다.</span>
              </div>
              <select 
                className="settings-modal-select"
                style={styles.select} 
                value={themeMode}
                onChange={(e) => onChangeThemeMode(e.target.value)}
              >
                <option value="default">⚓ 기본설정 (Warm Mocha)</option>
                <option value="hwasa">🌸 화사함 (Beige)</option>
                <option value="light">☀️ 라이트 (Pure White)</option>
                <option value="dark">🌙 다크 (Deep Grey)</option>
                <option value="system">💻 시스템 동기화</option>
              </select>
            </div>
          </section>

          {/* 📖 Section: 뷰어 설정 */}
          <section style={styles.section}>
            <div style={styles.sectionTitle}>Viewer Settings</div>
            
            {/* Row 1: 보기 모드 */}
            <div style={styles.row}>
              <div style={styles.labelGroup}>
                <span style={styles.label}>화면 보기 모드</span>
                <span style={styles.desc}>단일 이미지로 감상할지, 양쪽 페이지로 볼지 선택합니다.</span>
              </div>
              <div style={styles.segmentedContainer}>
                <button 
                  style={{ 
                    ...styles.segmentBtn, 
                    background: viewMode === '1' ? 'var(--accent)' : 'transparent',
                    color: viewMode === '1' ? '#FFFFFF' : 'var(--text-dim)'
                  }}
                  onClick={() => onChangeViewMode('1')}
                >
                  단면
                </button>
                <button 
                  style={{ 
                    ...styles.segmentBtn, 
                    background: viewMode === '2' ? 'var(--accent)' : 'transparent',
                    color: viewMode === '2' ? '#FFFFFF' : 'var(--text-dim)'
                  }}
                  onClick={() => onChangeViewMode('2')}
                >
                  양면
                </button>
              </div>
            </div>

            {/* Row 2: 맞춤 모드 */}
            <div style={styles.row}>
              <div style={styles.labelGroup}>
                <span style={styles.label}>이미지 화면 맞춤</span>
                <span style={styles.desc}>이미지 비율을 뷰어 크기에 어떻게 맞출지 정합니다.</span>
              </div>
              <select 
                className="settings-modal-select"
                style={styles.select} 
                value={imageFitMode}
                onChange={(e) => onChangeImageFitMode(e.target.value as any)}
              >
                <option value="auto">스마트 자동 맞춤</option>
                <option value="actual">원본 크기 (1:1)</option>
                <option value="width">너비 기준 맞춤</option>
                <option value="height">높이 기준 맞춤</option>
              </select>
            </div>
          </section>

          {/* 🔄 Section: 일반 작동 */}
          <section style={styles.section}>
            <div style={styles.sectionTitle}>Behavioral</div>
            <div style={styles.row}>
              <div style={styles.labelGroup}>
                <span style={styles.label}>같은 책 연속 로딩</span>
                <span style={styles.desc}>폴더 내에 넘버링된 다음 책이 발견되면 자동으로 이어서 엽니다.</span>
              </div>
              <label className="settings-switch">
                <input 
                  type="checkbox" 
                  checked={loadSameBook} 
                  onChange={(e) => onChangeLoadSameBook(e.target.checked)} 
                />
                <span className="switch-slider"></span>
              </label>
            </div>
          </section>

          {/* ⚡ Section: 환경 초기화 */}
          <section style={styles.section}>
            <div style={styles.sectionTitle}>Layout & Factory Reset</div>
            
            <div style={styles.row}>
              <div style={styles.labelGroup}>
                <span style={styles.label}>알림 메시지 위치 초기화</span>
                <span style={styles.desc}>드래그하여 이동시킨 '다음 책 이동 알림창'의 위치를 원복시킵니다.</span>
              </div>
              <button 
                className="settings-action-btn"
                style={styles.actionBtn}
                onClick={() => {
                  onResetNoticePos();
                  alert('알림 메시지 위치가 우측 상단 기본값으로 복구되었습니다.');
                }}
              >
                위치 리셋
              </button>
            </div>

            <div style={styles.row}>
              <div style={styles.labelGroup}>
                <span style={styles.label}>사이드바 너비 기본값 복구</span>
                <span style={styles.desc}>사이드바 너비를 태초의 표준 크기(260px)로 정렬합니다.</span>
              </div>
              <button 
                className="settings-action-btn"
                style={styles.actionBtn}
                onClick={() => {
                  onResetSidebarWidth();
                  alert('사이드바 너비가 기본값으로 초기화되었습니다.');
                }}
              >
                크기 리셋
              </button>
            </div>
          </section>

        </div>

        {/* 🏁 Footer */}
        <footer style={styles.footer}>
          <button 
            className="settings-cancel-btn"
            style={styles.cancelBtn} 
            onClick={handleCancel}
          >
            취소
          </button>
          <button style={styles.primaryBtn} onClick={onClose}>
            설정 저장 및 닫기
          </button>
        </footer>
      </div>
    </div>
  );
};
